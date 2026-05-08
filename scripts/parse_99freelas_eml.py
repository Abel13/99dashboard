#!/usr/bin/env python3
"""
Softwarehouse - parser inicial de oportunidades 99Freelas.

Lê arquivos .eml exportados do Gmail/Outlook, extrai campos principais e aplica
uma primeira régua de classificação definida por Abel.

Uso:
  python3 softwarehouse/scripts/parse_99freelas_eml.py \
    --input /mnt/c/Users/abelo/OneDrive/Workspace/Softwarehouse \
    --out softwarehouse/out
"""

from __future__ import annotations

import argparse
import csv
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from pathlib import Path
from typing import Any

PROJECT_URL_RE = re.compile(r"https://www\.99freelas\.com\.br/project/[^>\s]+", re.I)
PROJECT_BLOCK_RE = re.compile(
    r"interesse:\s*"
    r"(?P<title>.*?)\s*"
    r"<(?P<url>https://www\.99freelas\.com\.br/project/[^>]+)>\s*"
    r"(?P<category>.*?)\s*\|\s*"
    r"(?P<level>.*?)\s*\|\s*"
    r"Orçamento:\s*(?P<budget>[^\n\r]+?)\s+"
    r"(?P<description>.*?)\s+Leia mais\.",
    re.I | re.S,
)

PRIORITY_KEYWORDS = {
    "mobile_multiplatform": [
        "mobile", "aplicativo", "app", "android", "ios", "multiplataforma", "flutter", "react native",
    ],
    "website": [
        "website", "site", "landing page", "institucional", "web", "frontend",
    ],
    "desktop": [
        "desktop", "windows", "electron", "aplicativo desktop", "software desktop",
    ],
}

CONDITIONAL_KEYWORDS = {
    "backend": ["backend", "api", "integração", "integracao", "servidor", "banco de dados", "database"],
    "data_analysis": ["análise de dados", "analise de dados", "dados", "probabilidade", "padrões", "padroes", "relatório", "dashboard", "bi"],
    "ai_agents": ["ia", "ai", "agente", "agentes", "chatbot", "llm", "automação inteligente", "automacao inteligente"],
    "cms_editable_content": ["cms", "editar conteúdo", "editar conteudo", "gerenciar conteúdo", "gerenciar conteudo", "painel administrativo", "conteúdo sozinho", "conteudo sozinho"],
}

BLOCK_KEYWORDS = {
    "wordpress": ["wordpress", "wp-admin", "woocommerce", "elementor"],
}

RISK_KEYWORDS = {
    "gambling_or_betting": ["bac bo", "cassino", "aposta", "roleta", " bet "],
    "large_marketplace_scope": ["getninja", "getninjas", "intermediação de serviços", "intermediacao de servicos", "dois lados", "prestador e cliente", "cliente e prestador", "marketplace"],
    "vague_or_open_scope": ["orçamento: aberto", "orcamento: aberto", "como", "sistema completo"],
}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def lower_blob(*values: str) -> str:
    return " ".join(values).lower()


def keyword_seen(blob: str, keyword: str) -> bool:
    k = keyword.lower()
    # Evita falso positivo de termos curtíssimos como "ia" dentro de "consultoria".
    if len(k) <= 3 and re.fullmatch(r"[a-z0-9]+", k):
        return re.search(rf"(?<![a-z0-9]){re.escape(k)}(?![a-z0-9])", blob) is not None
    return k in blob


def find_keyword_groups(blob: str, groups: dict[str, list[str]]) -> list[str]:
    found: list[str] = []
    for group, keywords in groups.items():
        if any(keyword_seen(blob, k) for k in keywords):
            found.append(group)
    return found


def extract_text_parts(msg: Any) -> tuple[str, str]:
    plain_parts: list[str] = []
    html_parts: list[str] = []
    parts = msg.walk() if msg.is_multipart() else [msg]
    for part in parts:
        ctype = part.get_content_type()
        if ctype == "text/plain":
            try:
                plain_parts.append(part.get_content())
            except Exception:
                pass
        elif ctype == "text/html":
            try:
                html_parts.append(part.get_content())
            except Exception:
                pass
    return "\n".join(plain_parts), "\n".join(html_parts)


def parse_auth(msg: Any) -> dict[str, Any]:
    auth_header = " | ".join(str(x).replace("\n", " ") for x in msg.get_all("Authentication-Results", []))
    auth_lower = auth_header.lower()
    return {
        "gmail_dmarc_fail": "dmarc=fail" in auth_lower,
        "gmail_spf_pass": "spf=pass" in auth_lower,
        "outlook_redirect_seen": "outlook.com" in auth_lower,
        "amazon_ses_seen": "amazonses.com" in auth_lower,
        "original_99freelas_dkim_pass_seen": "header.d=99freelas.com.br" in auth_lower and "dkim=pass" in auth_lower,
        "auth_status": "redirect_validated_partial"
        if "header.d=99freelas.com.br" in auth_lower and "dkim=pass" in auth_lower
        else "redirect_unverified",
    }


@dataclass
class Analysis:
    preference_class: str
    matched_groups: list[str] = field(default_factory=list)
    blocked_reasons: list[str] = field(default_factory=list)
    risk_flags: list[str] = field(default_factory=list)
    technical_score: int = 0
    commercial_score: int = 0
    scope_clarity_score: int = 0
    risk_score: int = 0
    interest_score: int = 0
    final_score: int = 0
    recommended_action: str = "needs_review"
    notes: list[str] = field(default_factory=list)


@dataclass
class Opportunity:
    source: str
    source_project_id: str | None
    title: str
    project_url: str
    category: str
    level: str
    budget: str
    description_preview: str
    received_at_raw: str
    email_subject: str
    email_from: str
    email_to: str
    raw_email_path: str
    auth: dict[str, Any]
    analysis: Analysis
    full_description: str | None = None
    page_details: dict[str, Any] = field(default_factory=dict)


def analyze(title: str, category: str, level: str, budget: str, description: str) -> Analysis:
    blob = lower_blob(title, category, level, budget, description)
    content_blob = lower_blob(title, description)

    # A categoria "Outra - Web, Mobile & Software" da 99Freelas é genérica demais;
    # não deve transformar projeto em prioridade sozinha. Categorias específicas sim.
    priority = find_keyword_groups(content_blob, PRIORITY_KEYWORDS)
    category_l = category.lower()
    if "desenvolvimento mobile" in category_l and "mobile_multiplatform" not in priority:
        priority.append("mobile_multiplatform")
    if "desenvolvimento web" in category_l and "website" not in priority:
        priority.append("website")

    conditional = find_keyword_groups(blob, CONDITIONAL_KEYWORDS)
    # WordPress não é bloqueio absoluto.
    # Bloquear manutenção/migração/SEO/plugin/erro crítico/WooCommerce/legado.
    # Landing page simples/editável em WordPress/Elementor fica como caso a caso/só se pagar bem.
    blocked = []
    wordpress_mentioned = find_keyword_groups(blob, BLOCK_KEYWORDS)
    wordpress_hard_block = re.search(
        r"(especializad[oa] em wordpress|site wordpress|projeto wordpress|manutenção.*wordpress|manutencao.*wordpress|correção.*wordpress|correcao.*wordpress|gestão.*wordpress|gestao.*wordpress|migraç[aã]o.*wordpress|seo.*wordpress|wordpress.*seo|erro crítico|erro critico|woocommerce|plugin|plugins|rank math|wp rocket|litespeed|slider revolution)",
        blob,
    )
    wordpress_landing_exception = re.search(r"(landing page|layout.*pronto|não é criação do zero|nao e criacao do zero|elementor.*similar editável|elementor.*similar editavel)", blob)
    if wordpress_mentioned and wordpress_hard_block and not wordpress_landing_exception:
        blocked.append("wordpress")

    risks = find_keyword_groups(blob, RISK_KEYWORDS)

    if blocked:
        preference_class = "blocked"
    elif wordpress_mentioned and wordpress_landing_exception:
        preference_class = "conditional_high_price"
    elif "cms_editable_content" in conditional:
        preference_class = "conditional_high_price"
    elif priority:
        preference_class = "priority"
    elif conditional:
        preference_class = "conditional_high_price"
    else:
        preference_class = "case_by_case"

    notes: list[str] = []

    # 1. Match técnico — 35
    if blocked:
        technical = 0
        notes.append("Bloqueado por preferência explícita de Abel.")
    elif wordpress_mentioned and wordpress_landing_exception:
        technical = 18
        notes.append("WordPress/Elementor permitido apenas como landing page simples/editável, caso a caso e se pagar bem.")
    elif "cms_editable_content" in conditional:
        technical = 22
        notes.append("Site com edição de conteúdo/CMS: candidato apenas se bem precificado e sem virar WordPress por padrão.")
    elif priority:
        technical = 30
    elif conditional:
        technical = 22
        notes.append("Área aceita se houver bom potencial financeiro.")
    else:
        technical = 15
        notes.append("Tipo não mapeado; precisa de avaliação caso a caso.")

    # Ajustes por nível declarado
    if "especialista" in blob and not priority:
        technical = max(technical - 3, 0)

    # 2. Valor comercial — 25
    commercial = 12
    if any(g in priority for g in ["mobile_multiplatform", "desktop"]):
        commercial += 5
    if "website" in priority:
        commercial += 3
    if conditional:
        commercial += 4
    if "large_marketplace_scope" in risks:
        commercial += 4
    if "aberto" in budget.lower():
        notes.append("Orçamento aberto: valor comercial precisa ser confirmado.")
    commercial = min(commercial, 25)

    # 3. Clareza de escopo — 15
    desc_len = len(description)
    if desc_len >= 180:
        clarity = 10
    elif desc_len >= 80:
        clarity = 8
    else:
        clarity = 5
    if "..." in description:
        clarity = max(clarity - 2, 0)
        notes.append("Descrição veio truncada no e-mail; ideal abrir o projeto antes da proposta.")
    if "large_marketplace_scope" in risks:
        clarity = max(clarity - 5, 0)
    clarity = min(clarity, 15)

    # 4. Risco/dor de cabeça — 15 (maior é melhor)
    risk_score = 13
    if "gambling_or_betting" in risks:
        risk_score -= 9
        notes.append("Risco alto: projeto relacionado a aposta/cassino ou automação de jogo.")
    if "large_marketplace_scope" in risks:
        risk_score -= 7
        notes.append("Risco alto de escopo grande: marketplace/app com múltiplos lados; só propor com limites e fases muito explícitos.")
    if "vague_or_open_scope" in risks:
        risk_score -= 3
    if blocked:
        risk_score = min(risk_score, 4)
    risk_score = max(min(risk_score, 15), 0)

    # 5. Interesse pessoal — 10
    if blocked:
        interest = 0
    elif wordpress_mentioned and wordpress_landing_exception:
        interest = 3
    elif "cms_editable_content" in conditional:
        interest = 4
    elif priority:
        interest = 9
    elif conditional:
        interest = 4
    else:
        interest = 5

    final = technical + commercial + clarity + risk_score + interest

    if blocked:
        action = "discard"
    elif "gambling_or_betting" in risks:
        action = "discard_or_case_by_case"
    elif final >= 80:
        action = "high_priority"
    elif final >= 60:
        action = "prepare_or_review_proposal"
    elif final >= 40:
        action = "ask_questions_or_review"
    else:
        action = "discard_or_archive"

    return Analysis(
        preference_class=preference_class,
        matched_groups=priority + conditional,
        blocked_reasons=blocked,
        risk_flags=risks,
        technical_score=technical,
        commercial_score=commercial,
        scope_clarity_score=clarity,
        risk_score=risk_score,
        interest_score=interest,
        final_score=final,
        recommended_action=action,
        notes=notes,
    )


def parse_eml(path: Path) -> Opportunity | None:
    msg = BytesParser(policy=policy.default).parsebytes(path.read_bytes())
    plain, html = extract_text_parts(msg)
    source_text = plain or re.sub(r"<[^>]+>", " ", html)
    flat = normalize_text(source_text)
    match = PROJECT_BLOCK_RE.search(flat)
    if not match:
        return None

    url = match.group("url").strip()
    project_id_match = re.search(r"-(\d+)(?:\?|$)", url)
    title = normalize_text(match.group("title"))
    category = normalize_text(match.group("category"))
    level = normalize_text(match.group("level"))
    budget = normalize_text(match.group("budget"))
    description = normalize_text(match.group("description"))

    return Opportunity(
        source="99freelas",
        source_project_id=project_id_match.group(1) if project_id_match else None,
        title=title,
        project_url=url,
        category=category,
        level=level,
        budget=budget,
        description_preview=description,
        full_description=None,
        page_details={},
        received_at_raw=str(msg.get("Date", "")).strip(),
        email_subject=str(msg.get("Subject", "")).strip(),
        email_from=str(msg.get("From", "")).strip(),
        email_to=str(msg.get("To", "")).strip(),
        raw_email_path=str(path),
        auth=parse_auth(msg),
        analysis=analyze(title, category, level, budget, description),
    )


def write_outputs(items: list[Opportunity], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    generated_at = datetime.now(timezone.utc).isoformat()
    payload = {
        "generated_at": generated_at,
        "count": len(items),
        "items": [asdict(item) for item in items],
    }
    (out_dir / "opportunities.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    rows = []
    for item in items:
        d = asdict(item)
        analysis = d.pop("analysis")
        auth = d.pop("auth")
        rows.append({
            "source_project_id": d["source_project_id"],
            "title": d["title"],
            "category": d["category"],
            "level": d["level"],
            "budget": d["budget"],
            "preference_class": analysis["preference_class"],
            "matched_groups": ",".join(analysis["matched_groups"]),
            "blocked_reasons": ",".join(analysis["blocked_reasons"]),
            "risk_flags": ",".join(analysis["risk_flags"]),
            "technical_score": analysis["technical_score"],
            "commercial_score": analysis["commercial_score"],
            "scope_clarity_score": analysis["scope_clarity_score"],
            "risk_score": analysis["risk_score"],
            "interest_score": analysis["interest_score"],
            "final_score": analysis["final_score"],
            "recommended_action": analysis["recommended_action"],
            "auth_status": auth["auth_status"],
            "project_url": d["project_url"],
        })

    csv_path = out_dir / "opportunities.csv"
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()) if rows else [])
        if rows:
            writer.writeheader()
            writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="/mnt/c/Users/abelo/OneDrive/Workspace/Softwarehouse", help="Pasta com arquivos .eml")
    parser.add_argument("--out", default="/home/abel13/.openclaw/workspace/softwarehouse/out", help="Pasta de saída")
    args = parser.parse_args()

    input_dir = Path(args.input)
    out_dir = Path(args.out)
    items: list[Opportunity] = []
    failures: list[str] = []

    for path in sorted(input_dir.glob("*.eml")):
        item = parse_eml(path)
        if item is None:
            failures.append(str(path))
        else:
            items.append(item)

    items.sort(key=lambda i: i.analysis.final_score, reverse=True)
    write_outputs(items, out_dir)

    print(f"Parsed: {len(items)}")
    if failures:
        print(f"Failures: {len(failures)}")
        for f in failures:
            print(f" - {f}")
    print(f"JSON: {out_dir / 'opportunities.json'}")
    print(f"CSV:  {out_dir / 'opportunities.csv'}")
    for item in items:
        a = item.analysis
        print(f"{a.final_score:3d} | {a.recommended_action:26s} | {a.preference_class:24s} | {item.title}")

    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())
