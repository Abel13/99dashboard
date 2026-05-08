#!/usr/bin/env python3
"""Enriquece oportunidades 99Freelas com dados públicos da página do projeto."""

from __future__ import annotations

import argparse
import html as html_lib
import json
import re
import sys
import time
import urllib.request
from dataclasses import asdict
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

# Permite importar o parser/scoring atual sem empacotar o projeto ainda.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from parse_99freelas_eml import analyze  # noqa: E402


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        data = data.strip()
        if data:
            self.parts.append(data)


def html_to_lines(html: str) -> list[str]:
    parser = TextExtractor()
    parser.feed(html)
    return [p.strip() for p in parser.parts if p.strip()]


def first_after(lines: list[str], label: str) -> str | None:
    for i, line in enumerate(lines):
        if line.strip().lower() == label.lower() and i + 1 < len(lines):
            return lines[i + 1].strip()
    return None


def parse_duration_pt(value: str | None) -> timedelta | None:
    if not value:
        return None
    hours = minutes = seconds = 0
    mh = re.search(r"(\d+)\s*h", value, re.I)
    mm = re.search(r"(\d+)\s*m", value, re.I)
    ms = re.search(r"(\d+)\s*s", value, re.I)
    if mh:
        hours = int(mh.group(1))
    if mm:
        minutes = int(mm.group(1))
    if ms:
        seconds = int(ms.group(1))
    if not any([hours, minutes, seconds]):
        return None
    return timedelta(hours=hours, minutes=minutes, seconds=seconds)


def iso_from_ts(ts: float) -> str:
    return datetime.fromtimestamp(ts).astimezone().replace(microsecond=0).isoformat()


def extract_page_details(html: str) -> dict[str, Any]:
    lines = html_to_lines(html)
    text = "\n".join(lines)

    exclusive_note = None
    exclusive = False
    m_exclusive = re.search(
        r"<img[^>]+(?:alt|title)=[\"'][^\"']*Projeto\s+Exclusivo[^\"']*[\"'][^>]*>",
        html,
        re.I,
    )
    if m_exclusive:
        exclusive = True
        m_title = re.search(r"title=[\"']([^\"']+)[\"']", m_exclusive.group(0), re.I)
        if m_title:
            exclusive_note = html_lib.unescape(m_title.group(1)).strip()

    exclusive_remaining_seconds = None
    exclusive_duration = parse_duration_pt(exclusive_note)
    if exclusive_duration is not None:
        exclusive_remaining_seconds = int(exclusive_duration.total_seconds())

    full_description = None
    m = re.search(
        r"Descrição do Projeto:\n(?P<desc>.*?)(?:\nAtividades do cliente nesse projeto:|\nTem dúvidas\?|\nInformações adicionais)",
        text,
        re.S | re.I,
    )
    if m:
        full_description = re.sub(r"\n+", "\n", m.group("desc")).strip()

    proposals = first_after(lines, "Propostas:")
    interested = first_after(lines, "Interessados:")
    min_value = first_after(lines, "Valor Mínimo:")
    category = first_after(lines, "Categoria:")
    subcategory = first_after(lines, "Subcategoria:")
    budget = first_after(lines, "Orçamento:")
    level = first_after(lines, "Nível de experiência:")
    visibility = first_after(lines, "Visibilidade:")
    last_view = first_after(lines, "Última visualização:")

    status_flags = []
    # Captura status perto da área de atividade, sem depender de classe CSS.
    activity_idx = text.lower().find("atividades do cliente nesse projeto:")
    if activity_idx >= 0:
        activity_block = text[activity_idx:activity_idx + 400].lower()
        for flag in ["cancelado", "aberto", "fechado", "em andamento"]:
            if flag in activity_block:
                status_flags.append(flag)

    return {
        "full_description": full_description,
        "category": category,
        "subcategory": subcategory,
        "budget": budget,
        "level": level,
        "visibility": visibility,
        "proposals": proposals,
        "interested": interested,
        "min_value": min_value,
        "last_view": last_view,
        "is_exclusive": exclusive,
        "exclusive_note": exclusive_note,
        "exclusive_remaining_seconds": exclusive_remaining_seconds,
        "status_flags": status_flags,
    }


def fetch(url: str) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SoftwarehouseBot/0.1; local-analysis)",
            "Accept": "text/html,application/xhtml+xml",
        },
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/home/abel13/.openclaw/workspace/softwarehouse/out/opportunities.json")
    ap.add_argument("--out", default="/home/abel13/.openclaw/workspace/softwarehouse/out/opportunities.enriched.json")
    ap.add_argument("--pages-dir", default="/home/abel13/.openclaw/workspace/softwarehouse/data/pages")
    ap.add_argument("--sleep", type=float, default=1.0, help="Pausa entre requests")
    args = ap.parse_args()

    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    pages_dir = Path(args.pages_dir)
    pages_dir.mkdir(parents=True, exist_ok=True)

    enriched = []
    for item in data["items"]:
        pid = item.get("source_project_id") or "unknown"
        page_path = pages_dir / f"{pid}.html"
        if page_path.exists():
            html = page_path.read_text(encoding="utf-8")
            page_read_at_ts = page_path.stat().st_mtime
        else:
            html = fetch(item["project_url"])
            page_path.write_text(html, encoding="utf-8")
            page_read_at_ts = page_path.stat().st_mtime
            time.sleep(args.sleep)

        details = extract_page_details(html)
        details["page_read_at"] = iso_from_ts(page_read_at_ts)
        remaining = details.get("exclusive_remaining_seconds")
        if remaining is not None:
            until = datetime.fromtimestamp(page_read_at_ts).astimezone() + timedelta(seconds=int(remaining))
            details["exclusive_until_estimated"] = until.replace(microsecond=0).isoformat()
        full = details.get("full_description") or item.get("description_preview") or ""
        category = details.get("subcategory") or item.get("category") or ""
        budget = details.get("budget") or item.get("budget") or ""
        level = details.get("level") or item.get("level") or ""

        item["full_description"] = details.get("full_description")
        item["page_details"] = {k: v for k, v in details.items() if k != "full_description"}
        item["analysis"] = asdict(analyze(item.get("title", ""), category, level, budget, full))
        enriched.append(item)

    enriched.sort(key=lambda x: x["analysis"]["final_score"], reverse=True)
    payload = {"generated_from": str(args.input), "count": len(enriched), "items": enriched}
    Path(args.out).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Enriched: {len(enriched)}")
    print(f"JSON: {args.out}")
    for item in enriched:
        a = item["analysis"]
        pd = item.get("page_details", {})
        print(f"{a['final_score']:3d} | {a['recommended_action']:26s} | {a['preference_class']:24s} | propostas={pd.get('proposals')} | {item['title']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
