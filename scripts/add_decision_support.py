#!/usr/bin/env python3
"""Adiciona apoio à decisão às oportunidades do Softwarehouse.

MVP heurístico: preço, esforço, prazo, perguntas, alerta de concorrência e proposta-base.
Não substitui validação do Abel; serve como rascunho inicial.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


def money(v: int) -> str:
    return f"R$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    digits = "".join(ch for ch in str(value) if ch.isdigit())
    return int(digits) if digits else None


def has_any(text: str, terms: list[str]) -> bool:
    t = text.lower()
    return any(term.lower() in t for term in terms)


def has_integration_automation(text: str) -> bool:
    t = text.lower()
    padded = f" {t} "
    return any(term in t for term in ["n8n", "asaas", "nota fiscal", "webhook", "pix", "cartão"]) or " nf " in padded or " nf-e" in t or "nfe" in t


def classify_base(item: dict[str, Any]) -> dict[str, Any]:
    a = item.get("analysis", {})
    pd = item.get("page_details", {})
    title = item.get("title") or ""
    desc = item.get("full_description") or item.get("description_preview") or ""
    text = f"{title}\n{desc}".lower()
    risks = set(a.get("risk_flags") or [])
    blocked = set(a.get("blocked_reasons") or [])
    matched = set(a.get("matched_groups") or [])
    proposals = int_or_none(pd.get("proposals")) or 0
    interested = int_or_none(pd.get("interested")) or 0

    if "wordpress" in blocked:
        return {
            "status_manual": "descartar",
            "price_min": None,
            "price_suggested": None,
            "price_max": None,
            "effort_estimate": "não estimado",
            "delivery_estimate": "não recomendado",
            "pricing_note": "Bloqueado por preferência explícita: WordPress.",
            "competition_alert": competition_alert(proposals, interested),
            "questions_to_client": [],
            "proposal_draft": "Projeto bloqueado pela régua atual do Softwarehouse. Não preparar proposta, salvo desbloqueio manual do Abel.",
        }

    if "gambling_or_betting" in risks:
        return {
            "status_manual": "caso_a_caso",
            "price_min": 2500,
            "price_suggested": 4500,
            "price_max": 9000,
            "effort_estimate": "médio/alto",
            "delivery_estimate": "10 a 20 dias úteis, dependendo da fonte de dados e limitações da plataforma",
            "pricing_note": "Risco alto por envolver aposta/cassino/automação de jogo. Só avançar se escopo e responsabilidade forem muito claros.",
            "competition_alert": competition_alert(proposals, interested),
            "questions_to_client": [
                "A ferramenta usará dados fornecidos oficialmente pela plataforma ou captura visual/tela?",
                "Você precisa apenas de alertas ou também de execução automática de ações?",
                "Quais canais de alerta deseja usar: Telegram, WhatsApp, e-mail ou painel web?",
                "Você entende que padrões probabilísticos não garantem resultado financeiro?",
            ],
            "proposal_draft": proposal(title, "automação/análise de padrões", "um MVP de alerta com regras bem definidas", "10 a 20 dias úteis", 4500, caution="sem promessa de resultado financeiro e sem automação de apostas"),
        }

    if "large_marketplace_scope" in risks:
        return {
            "status_manual": "preparar_proposta",
            "price_min": 12000,
            "price_suggested": 22000,
            "price_max": 45000,
            "effort_estimate": "alto",
            "delivery_estimate": "30 a 60 dias úteis por fase/MVP",
            "pricing_note": "Aplicativo/marketplace com dois lados precisa ser vendido por fases. Não propor app completo fechado sem discovery.",
            "competition_alert": competition_alert(proposals, interested),
            "questions_to_client": [
                "O MVP precisa ter pagamento dentro do app ou apenas contato/intermediação?",
                "Quais perfis entram na primeira versão: cliente, prestador e admin?",
                "Será necessário chat, geolocalização, avaliações, agenda ou notificações push já na primeira fase?",
                "Você já tem identidade visual, regras de negócio e fluxo de cadastro definidos?",
                "A prioridade é Android/iOS simultâneo ou podemos começar com uma versão multiplataforma em fases?",
            ],
            "proposal_draft": proposal(title, "aplicativo multiplataforma", "um MVP por fases, com escopo fechado para cliente/prestador/admin", "30 a 60 dias úteis por fase", 22000),
        }

    if "mobile_multiplatform" in matched or has_any(text, ["aplicativo", "app", "autoatendimento"]):
        return {
            "status_manual": "preparar_proposta",
            "price_min": 6000,
            "price_suggested": 12000,
            "price_max": 25000,
            "effort_estimate": "médio/alto",
            "delivery_estimate": "20 a 40 dias úteis, dependendo da integração e estado do sistema existente",
            "pricing_note": "Aplicativo/integracão operacional: bom candidato, mas precisa validar ERP, tecnologia atual, acesso ao código e ambiente de testes.",
            "competition_alert": competition_alert(proposals, interested),
            "questions_to_client": [
                "O aplicativo existente tem código-fonte disponível e em qual tecnologia foi feito?",
                "Como é feita hoje a integração com o ERP: banco direto, API, arquivo ou outro método?",
                "O ERP possui documentação técnica ou ambiente de homologação?",
                "O objetivo é corrigir o app atual ou criar uma nova versão do zero?",
                "Quais fluxos precisam funcionar no MVP: comanda, pedido, pagamento, caixa e sincronização?",
            ],
            "proposal_draft": proposal(title, "aplicativo/integracão", "uma análise técnica inicial seguida de correção ou MVP do app de autoatendimento integrado ao ERP", "20 a 40 dias úteis", 12000),
        }

    if "desktop" in matched:
        return {
            "status_manual": "preparar_proposta",
            "price_min": 1800,
            "price_suggested": 3500,
            "price_max": 8000,
            "effort_estimate": "pequeno/médio",
            "delivery_estimate": "3 a 8 dias úteis",
            "pricing_note": "Projeto desktop/configuração: bom candidato se acesso remoto, licenças e requisitos estiverem claros.",
            "competition_alert": competition_alert(proposals, interested),
            "questions_to_client": [
                "O ambiente será configurado localmente ou via acesso remoto?",
                "As licenças/instaladores do GeneXus e banco SQL já estão disponíveis?",
                "Qual versão do Windows/servidor e SQL Server será usada?",
                "Será necessário configurar apenas uma máquina ou mais de um ambiente?",
                "Você precisa de documentação ou suporte pós-instalação?",
            ],
            "proposal_draft": proposal(title, "configuração desktop", "instalação, configuração e validação do ambiente desktop com banco SQL", "3 a 8 dias úteis", 3500),
        }

    if "cms_editable_content" in matched:
        return {
            "status_manual": "preparar_proposta",
            "price_min": 3500,
            "price_suggested": 6500,
            "price_max": 12000,
            "effort_estimate": "médio",
            "delivery_estimate": "10 a 20 dias úteis",
            "pricing_note": "Site editável/CMS: bom candidato se usar plataforma adequada e limitar páginas, SEO e identidade visual.",
            "competition_alert": competition_alert(proposals, interested),
            "questions_to_client": [
                "Você prefere uma plataforma específica ou aceita recomendação técnica?",
                "Quais conteúdos você precisa editar sozinho depois: textos, imagens, blog, serviços e cases?",
                "A identidade visual será criada do zero ou existe alguma referência obrigatória?",
                "O blog precisa estar funcional no MVP ou apenas estruturado para uso futuro?",
                "Você precisa de treinamento ou documentação para editar o conteúdo?",
            ],
            "proposal_draft": proposal(title, "site institucional editável", "um site responsivo, rápido, com SEO básico e área de edição de conteúdo", "10 a 20 dias úteis", 6500),
        }

    if "website" in matched:
        return {
            "status_manual": "preparar_proposta",
            "price_min": 2500,
            "price_suggested": 4500,
            "price_max": 9000,
            "effort_estimate": "pequeno/médio",
            "delivery_estimate": "7 a 15 dias úteis",
            "pricing_note": "Website simples costuma ser bom candidato se escopo, páginas e conteúdo estiverem claros.",
            "competition_alert": competition_alert(proposals, interested),
            "questions_to_client": [
                "Quantas páginas serão entregues na primeira versão?",
                "Você já possui textos, imagens, domínio e hospedagem?",
                "Precisa de formulário de contato, blog ou integração com WhatsApp?",
            ],
            "proposal_draft": proposal(title, "website", "um site responsivo com boa estrutura, performance e SEO básico", "7 a 15 dias úteis", 4500),
        }

    return {
        "status_manual": "revisar",
        "price_min": 2000,
        "price_suggested": 4000,
        "price_max": 8000,
        "effort_estimate": "a confirmar",
        "delivery_estimate": "a confirmar após alinhamento de escopo",
        "pricing_note": "Projeto fora das categorias principais; precisa de avaliação manual.",
        "competition_alert": competition_alert(proposals, interested),
        "questions_to_client": ["Pode detalhar o objetivo, entregáveis esperados, prazo e orçamento disponível?"],
        "proposal_draft": proposal(title, "solução sob medida", "uma primeira versão bem delimitada conforme o objetivo do projeto", "a confirmar", 4000),
    }


def competition_alert(proposals: int, interested: int) -> dict[str, Any]:
    if proposals >= 30 or interested >= 40:
        level = "alta"
        note = "Concorrência alta; proposta precisa ser muito objetiva, consultiva e com diferencial claro."
    elif proposals >= 12 or interested >= 20:
        level = "média"
        note = "Concorrência moderada; vale responder rápido e com escopo bem delimitado."
    else:
        level = "baixa"
        note = "Concorrência ainda baixa/moderada; boa janela para proposta cuidadosa."
    return {"level": level, "proposals": proposals, "interested": interested, "note": note}


def proposal(title: str, kind: str, deliverable: str, deadline: str, price: int, caution: str | None = None) -> str:
    caution_text = f"\n\nUm ponto importante: eu trabalharia com {caution}, mantendo o escopo seguro e bem definido." if caution else ""
    return (
        f"Olá! Vi o projeto \"{title}\" e acredito que posso ajudar.\n\n"
        f"Minha sugestão é começarmos com {deliverable}, alinhando primeiro os requisitos principais e os limites da entrega. "
        f"Para esse tipo de {kind}, eu costumo trabalhar com uma etapa inicial bem objetiva: entendimento do fluxo, definição do escopo, desenvolvimento, validação e ajustes finais.\n\n"
        f"Prazo estimado: {deadline}.\n"
        f"Investimento sugerido para referência: a partir de {money(price)}, podendo ajustar conforme detalhes finais do escopo."
        f"{caution_text}\n\n"
        f"Antes de fechar a proposta, eu gostaria de confirmar alguns pontos para evitar orçamento errado e garantir uma entrega segura."
    )


HOURLY_RATE = 130
PLATFORM_FEE_PCT = 0.20


def round_money(value: float, step: int = 500) -> int:
    return max(step, int(round(value / step) * step))


def pricing_from_hours(hours_min: int, hours_max: int, risk_pct: float, note: str) -> dict[str, Any]:
    avg = (hours_min + hours_max) / 2
    platform_multiplier = 1 / (1 - PLATFORM_FEE_PCT)

    net_min = hours_min * HOURLY_RATE * (1 + max(risk_pct - 0.10, 0))
    net_suggested = avg * HOURLY_RATE * (1 + risk_pct)
    net_max = hours_max * HOURLY_RATE * (1 + risk_pct + 0.15)

    price_min = round_money(net_min * platform_multiplier)
    price_suggested = round_money(net_suggested * platform_multiplier)
    price_max = round_money(net_max * platform_multiplier)
    return {
        "price_min": price_min,
        "price_suggested": price_suggested,
        "price_max": price_max,
        "pricing_calc": {
            "hourly_rate": HOURLY_RATE,
            "platform_fee_pct": PLATFORM_FEE_PCT,
            "platform_fee_multiplier": round(platform_multiplier, 4),
            "net_target_min": round_money(net_min),
            "net_target_suggested": round_money(net_suggested),
            "net_target_max": round_money(net_max),
            "hours_min": hours_min,
            "hours_max": hours_max,
            "hours_avg": round(avg, 1),
            "risk_pct": risk_pct,
            "formula": "preço ao cliente = (horas estimadas × R$ 130/h × margem de risco) ÷ (1 - 20% taxa da plataforma)",
            "note": note,
        },
    }


def delivery_from_hours(hours_min: int | None, hours_max: int | None) -> str:
    if not hours_min or not hours_max:
        return "a confirmar"
    # Considera cerca de 6h produtivas/dia + folga de agenda/alinhamentos.
    min_days = max(2, round(hours_min / 6))
    max_days = max(min_days + 2, round(hours_max / 5))
    return f"{min_days} a {max_days} dias úteis"


def estimate_pricing(item: dict[str, Any]) -> dict[str, Any]:
    a = item.get("analysis", {})
    title = item.get("title") or ""
    desc = item.get("full_description") or item.get("description_preview") or ""
    text = f"{title}\n{desc}".lower()
    matched = set(a.get("matched_groups") or [])
    risks = set(a.get("risk_flags") or [])

    # Ordem importa: casos específicos antes das categorias amplas.
    if has_any(text, ["contabilidade digital", "portal logado"]):
        hours_min, hours_max, risk, note = 90, 220, 0.35, "MVP web com autenticação, portal, admin, documentos, integrações e deploy: precisa ser fatiado por módulos."
    elif has_any(text, ["power apps", "powerapps", "power platform"]):
        hours_min, hours_max, risk, note = 24, 60, 0.35, "Power Apps/Power Platform: escopo tende a ser menor, mas há risco de curva e licenças."
    elif has_any(text, ["landing page"]):
        hours_min, hours_max, risk, note = 24, 70, 0.25, "Landing/site: depende de conteúdo, acabamento visual, responsividade e formulário/SEO básico."
    elif has_any(text, ["genexus", "outlook classic", "suporte remoto para outlook"]):
        hours_min, hours_max, risk, note = 12, 40, 0.25, "Configuração/desktop: inclui acesso remoto, instalação, validação e suporte curto."
    elif has_any(text, ["novnc", "redroid", "proxmox", "android virtualizado"]):
        hours_min, hours_max, risk, note = 60, 150, 0.40, "Infra/app remoto virtualizado: envolve várias camadas técnicas e alto risco de diagnóstico."
    elif has_integration_automation(text):
        hours_min, hours_max, risk, note = 35, 90, 0.30, "Integração/automações: inclui discovery, credenciais, webhooks, testes de erro e homologação."
    elif "large_marketplace_scope" in risks:
        hours_min, hours_max, risk, note = 140, 300, 0.40, "Marketplace/app com múltiplos perfis deve ser vendido por fase; estimativa é para MVP controlado."
    elif has_any(text, ["loja", "e-commerce", "ecommerce", "checkout", "produto"]):
        hours_min, hours_max, risk, note = 45, 110, 0.30, "Loja/site comercial: depende de catálogo, checkout, meios de pagamento e conteúdo."
    elif "cms_editable_content" in matched:
        hours_min, hours_max, risk, note = 40, 90, 0.25, "Site editável/CMS: inclui estrutura, responsividade, SEO básico e treinamento leve."
    elif "website" in matched or has_any(text, ["site", "página"]):
        hours_min, hours_max, risk, note = 24, 70, 0.25, "Website/landing: varia conforme número de páginas, conteúdo, formulário e acabamento visual."
    elif "mobile_multiplatform" in matched or has_any(text, ["aplicativo", " app ", "mobile"]):
        hours_min, hours_max, risk, note = 70, 180, 0.35, "App/sistema operacional: inclui telas, fluxo, integração, testes e ajustes de publicação/ambiente."
    elif "desktop" in matched:
        hours_min, hours_max, risk, note = 12, 40, 0.25, "Configuração/desktop: inclui acesso remoto, instalação, validação e suporte curto."
    elif has_any(text, ["python", "scripts", "api", "pipeline", "data warehouse", "sql", "nosql"]):
        hours_min, hours_max, risk, note = 30, 90, 0.30, "Scripts/APIs/integrações/dados: depende de fontes, tratamento de erro, agendamento e documentação."
    else:
        hours_min, hours_max, risk, note = 20, 60, 0.25, "Estimativa genérica: precisa de perguntas para reduzir incerteza."

    if "vague_or_open_scope" in risks:
        hours_max = int(hours_max * 1.25)
        risk += 0.10
        note += " Escopo vago: acrescentei margem de risco."

    return pricing_from_hours(hours_min, hours_max, risk, note)


def contextual_questions(item: dict[str, Any], decision: dict[str, Any]) -> list[str]:
    title = item.get("title") or ""
    desc = item.get("full_description") or item.get("description_preview") or ""
    text = f"{title}\n{desc}".lower()

    if has_any(text, ["stripe", "gemini", "google ai studio", "vite/react"]):
        return [
            "O fluxo será pagamento único, assinatura recorrente ou compra de créditos?",
            "O backend Node.js já existe ou precisa ser criado/organizado para proteger chaves e webhooks?",
            "Como o acesso deve ser liberado após o pagamento: por usuário, plano, assinatura ou crédito?",
            "O projeto já possui autenticação de usuários funcionando?",
            "Onde pretende fazer o deploy: Vercel, Railway, Render ou outra plataforma?",
        ]
    if has_any(text, ["contabilidade digital", "portal logado"]):
        return [
            "Quais módulos entram obrigatoriamente no MVP: portal do cliente, upload de documentos, solicitações, tarefas internas, notificações e admin?",
            "Quais ferramentas externas você já pretende contratar/integrar no início?",
            "A autenticação precisa ter perfis diferentes para cliente, equipe interna e administrador?",
            "Os documentos terão armazenamento em cloud com controle de acesso e histórico?",
            "Você já tem fluxos operacionais desenhados ou devemos mapear isso na etapa inicial?",
        ]
    if has_any(text, ["getninja", "intermediação de serviços", "prestador", "contrata"]):
        return [
            "No MVP, o cliente apenas solicita orçamento ou já haverá pagamento/contratação dentro da plataforma?",
            "Quais perfis precisam existir na primeira fase: cliente, prestador e painel admin?",
            "O matching será por categoria/cidade ou precisa de geolocalização em tempo real?",
            "Será necessário chat, avaliações, agenda, notificações push ou cobrança de comissão já no MVP?",
            "A prioridade é validar o negócio rapidamente ou lançar Android/iOS completo desde o início?",
        ]
    if has_any(text, ["semijoias", "loja online"]):
        return [
            "Você já possui identidade visual, fotos dos produtos e textos das categorias?",
            "Quantos produtos/categorias entram na primeira versão?",
            "Precisa de pagamento online, cálculo de frete e gestão de estoque já no MVP?",
            "Prefere uma loja editável em plataforma pronta ou desenvolvimento customizado?",
            "Haverá integração com Instagram/WhatsApp para atendimento e vendas?",
        ]
    if (" jogo" in text or "jogo " in text or " game" in text or "game " in text or "download" in text):
        return [
            "O jogo já possui identidade visual, imagens, trailer e arquivo de download final?",
            "O download será hospedado no próprio servidor, Google Drive/Itch.io/Steam ou outro serviço?",
            "Precisa de captura de e-mail, contador de downloads ou área de novidades/atualizações?",
            "O site será estático ou precisa de painel para editar conteúdo depois?",
            "Há requisitos de segurança para evitar link quebrado, arquivo antigo ou download indevido?",
        ]
    if has_any(text, ["site institucional", "consultoria empresarial"]):
        return [
            "Você tem referências visuais de sites que combinam com a consultoria?",
            "Quem fornecerá textos e imagens das até 6 páginas?",
            "O blog precisa ser publicável/editável desde a primeira entrega?",
            "Você prefere WordPress, Webflow ou aceita uma recomendação com base em facilidade de edição?",
            "Precisa de configuração de domínio, hospedagem, formulário e integração com WhatsApp/e-mail?",
        ]
    if has_any(text, ["landing page", "elementor", "hostinger"]):
        return [
            "O layout está em Figma, imagem, PDF ou outro formato editável?",
            "A entrega precisa ser obrigatoriamente em WordPress/Elementor na Hostinger?",
            "Há animações ou efeitos específicos além do sticky menu e botão fixo de WhatsApp?",
            "Os textos, imagens, links de WhatsApp/Instagram/e-mail já estão finais?",
            "Você espera apenas montagem fiel do layout ou também ajustes de copy/performance?",
        ]
    if has_any(text, ["bot", "pix", "cartão", "telegram", "discord", "assinaturas", "grupo privado"]):
        return [
            "O grupo privado será no Telegram, Discord ou ambos?",
            "Qual gateway de pagamento deseja usar para PIX/cartão e assinaturas?",
            "A liberação/remoção de membros precisa ser totalmente automática ou com aprovação manual?",
            "O painel precisa apenas listar usuários/pagamentos ou também permitir ações administrativas?",
            "Você já tem VPS/domínio/contas das APIs ou precisa incluir essa configuração na entrega?",
        ]
    if has_any(text, ["python", "pipeline", "data warehouse", "snowflake", "azure", "aws"]):
        return [
            "A contratação será por pacote mensal de horas ou por entregas fechadas?",
            "Quais stacks serão usadas no início: banco, cloud, orquestração e repositório?",
            "Já existe backlog de scripts/APIs/pipelines ou será definido semana a semana?",
            "Há ambiente de desenvolvimento, homologação e produção separados?",
            "Qual disponibilidade semanal esperada e como será feita a priorização das demandas?",
        ]
    if False and has_any(text, ["bot", "pix", "cartão", "telegram", "discord", "assinaturas"]):
        return [
            "O grupo privado será no Telegram, Discord ou ambos?",
            "Qual gateway de pagamento deseja usar para PIX/cartão e assinaturas?",
            "A liberação/remoção de membros precisa ser totalmente automática ou com aprovação manual?",
            "O painel precisa apenas listar usuários/pagamentos ou também permitir ações administrativas?",
            "Você já tem VPS/domínio/contas das APIs ou precisa incluir essa configuração na entrega?",
        ]
    if has_any(text, ["bac bo", "evolution"]):
        return [
            "A coleta dos resultados virá de API, histórico exportado ou leitura/captura da tela?",
            "O robô será apenas de alerta ou executará alguma ação automaticamente?",
            "Qual canal de alerta deseja usar: Telegram, WhatsApp, Discord ou painel web?",
            "As regras descritas são finais ou haverá ajustes depois dos primeiros testes?",
            "Você aceita uma entrega com logs e validação estatística, sem promessa de resultado financeiro?",
        ]
    return decision.get("questions_to_client") or []


def contextual_proposal(item: dict[str, Any], decision: dict[str, Any]) -> str:
    title = item.get("title") or ""
    desc = item.get("full_description") or item.get("description_preview") or ""
    text = f"{title}\n{desc}".lower()
    price = money(decision.get("price_suggested") or 0)
    deadline = decision.get("delivery_estimate") or "a confirmar"

    def close(extra: str = "") -> str:
        return (
            f"\n\nPrazo estimado: {deadline}.\n"
            f"Investimento de referência: a partir de {price}, sujeito a ajuste após alinharmos os detalhes finais."
            f"{extra}\n\n"
            "Antes de fechar, eu gostaria de confirmar alguns pontos para evitar proposta subestimada e garantir uma entrega segura."
        )

    if has_any(text, ["stripe", "gemini", "google ai studio", "vite/react"]):
        return (
            f"Olá! Li o projeto \"{title}\" e entendi que a plataforma web já está em andamento, mas precisa finalizar uma etapa transacional/de integração com backend seguro.\n\n"
            "Minha proposta é atuar nessa parte: organizar o backend para proteger chaves e credenciais, integrar o fluxo de pagamento/checkout quando aplicável, configurar webhooks para confirmar eventos importantes e validar o acesso do usuário conforme a regra de negócio definida.\n\n"
            "Também posso ajudar no deploy inicial, validando o fluxo completo em ambiente publicado: autenticação, integração, confirmação de eventos e liberação correta das funcionalidades contratadas."
            + close("\n\nAntes de fechar, eu só preciso confirmar o modelo de cobrança/liberação de acesso, porque isso muda a regra de persistência e validação dos usuários.")
        )
    if has_any(text, ["contabilidade digital", "portal logado"]):
        return (
            f"Olá! Li a descrição do projeto \"{title}\" e gostei do direcionamento: construir um MVP próprio para uma contabilidade digital, sem tentar transformar isso em um ERP contábil completo logo de início.\n\n"
            "Minha proposta seria começar por uma fase de definição técnica curta, para fechar o escopo do MVP, os perfis de acesso e as ferramentas externas que serão integradas. Depois disso, eu seguiria com a implementação do portal web com autenticação segura, área do cliente, área administrativa/operacional, upload/organização de documentos e as integrações prioritárias para deixar o fluxo ponta a ponta funcionando.\n\n"
            "Também posso cuidar da publicação/deploy e validação inicial do ambiente, deixando uma base preparada para evoluções futuras, sem amarrar o projeto em uma arquitetura difícil de manter."
            + close("\n\nEu trataria essa primeira entrega como MVP por fases, priorizando segurança, clareza operacional e estabilidade antes de adicionar automações mais avançadas.")
        )
    if has_any(text, ["getninja", "intermediação de serviços", "prestador", "contrata"]):
        return (
            f"Olá! Vi o projeto \"{title}\". Pelo que descreveu, a ideia é uma plataforma de intermediação de serviços no modelo GetNinjas, com dois lados: prestadores que oferecem/publicam serviços e clientes que buscam/contratam.\n\n"
            "Esse tipo de produto costuma crescer bastante se tentar nascer completo, então minha sugestão é começar com um MVP bem delimitado: cadastro/login, perfis de cliente e prestador, cadastro de serviços/categorias, fluxo de solicitação de orçamento/contato e um painel administrativo para acompanhar usuários e solicitações.\n\n"
            "Funcionalidades como chat interno, pagamento, avaliações, geolocalização avançada e notificações podem entrar em fases seguintes, depois que o fluxo principal estiver validado. Assim você reduz custo inicial e evita investir em um aplicativo grande antes de validar a operação."
            + close("\n\nEu não recomendaria fechar como app completo estilo marketplace desde o primeiro pacote; entraria com escopo fechado por fase.")
        )
    if has_any(text, ["semijoias", "loja online"]):
        return (
            f"Olá! Vi o projeto \"{title}\". Entendi que a loja precisa transmitir uma percepção mais premium para semijoias, com visual elegante, categorias bem organizadas e uma experiência simples para o cliente encontrar e comprar as peças.\n\n"
            "Minha proposta é criar uma loja responsiva e editável, com página inicial, categorias como anéis/colares/pulseiras/brincos, vitrine de produtos, página de produto, carrinho/checkout conforme a plataforma escolhida, integração com WhatsApp/redes sociais e estrutura preparada para fotos de alta qualidade.\n\n"
            "Eu também cuidaria para que o layout não pareça genérico: cores, espaçamento, banners e hierarquia visual precisam reforçar luxo e delicadeza, como você descreveu."
            + close("\n\nO valor pode variar bastante se houver pagamento online, frete, estoque e cadastro inicial de muitos produtos.")
        )
    if (" jogo" in text or "jogo " in text or " game" in text or "game " in text or "download" in text):
        return (
            f"Olá! Li o projeto \"{title}\". A necessidade aqui parece ser um site de apresentação para o jogo, com visual imersivo e uma área de download clara, rápida e segura.\n\n"
            "Minha proposta é desenvolver uma página/site responsivo com seções para apresentação do game, trailer ou imagens, história/recursos, requisitos mínimos, novidades e chamada principal para download. Também posso estruturar o botão de download com rastreio básico, orientação visual clara e proteção contra links confusos ou quebrados.\n\n"
            "A parte visual seria pensada para combinar com o universo do jogo, usando efeitos e interações com moderação para não prejudicar performance, principalmente no mobile."
            + close("\n\nSe o conteúdo do jogo ainda não estiver fechado, posso deixar a estrutura editável para facilitar futuras atualizações.")
        )
    if has_any(text, ["site institucional", "consultoria empresarial"]):
        return (
            f"Olá! Vi que você precisa de um site institucional para consultoria empresarial com até 6 páginas, SEO básico, boa performance e possibilidade de edição futura.\n\n"
            "Minha sugestão é construir uma estrutura profissional para Home, Sobre, Serviços, Cases/Resultados, Blog básico e Contato, já pensando em responsividade, clareza comercial e facilidade de manutenção. Como você ainda não tem identidade visual definida, eu posso partir de referências de estilo e propor uma linha visual adequada ao segmento de consultoria.\n\n"
            "Sobre a plataforma: se a prioridade for edição simples e autonomia, eu recomendaria WordPress com uma estrutura leve e bem organizada; se a prioridade for acabamento visual e menos manutenção técnica, podemos avaliar Webflow ou uma alternativa estática/editável."
            + close("\n\nNa entrega eu incluiria orientação para você conseguir alterar textos/imagens e publicar conteúdos básicos depois.")
        )
    if has_any(text, ["landing page", "elementor", "hostinger"]):
        return (
            f"Olá! Li a descrição da landing page e entendi que o layout desktop/mobile já está pronto; o foco não é criar do zero, mas montar fielmente, deixar responsivo e editável.\n\n"
            "Minha proposta é implementar a landing na estrutura indicada, preferencialmente WordPress/Elementor na Hostinger se esse for o caminho desejado, respeitando o layout existente, imagens, espaçamentos, botões e comportamento mobile. Também incluiria os links para WhatsApp, Instagram e e-mail, botão fixo lateral de WhatsApp e menu sticky com efeito de scroll.\n\n"
            "Como o visual já está definido, eu trabalharia com atenção em fidelidade, organização dos blocos e facilidade para futuras alterações de textos, títulos, botões e imagens."
            + close("\n\nConsidero importante validar antes o formato do layout e se todos os assets/links finais já estão prontos.")
        )
    if has_any(text, ["bot", "pix", "cartão", "telegram", "discord", "assinaturas", "grupo privado"]):
        return (
            f"Olá! Li o projeto \"{title}\" e entendi que você precisa de um bot para automatizar a venda de acesso a grupos privados, com confirmação de pagamento, liberação de membros e controle de assinaturas/inadimplência.\n\n"
            "Consigo desenvolver essa solução em Node.js, com um backend simples para centralizar a lógica, integração com gateway de pagamento para PIX/cartão, webhooks para confirmar pagamentos automaticamente, banco de dados para registrar usuários/pagamentos/status e integração com Telegram e/ou Discord para liberar ou remover membros conforme as regras combinadas.\n\n"
            "Também posso incluir um painel administrativo básico para consulta de membros, pagamentos e status das assinaturas, além da instalação em VPS e uma explicação de uso após a entrega."
            + close("\n\nPonto importante: eu manteria o escopo bem delimitado e discreto, principalmente nas regras de assinatura, liberação automática e remoção de inadimplentes.")
        )
    if has_any(text, ["python", "pipeline", "data warehouse", "snowflake", "azure", "aws"]):
        return (
            f"Olá! Vi que a demanda é para desenvolvimento Python em um projeto contínuo, envolvendo scripts, APIs, integrações, pipelines de dados, Data Warehouse e cloud.\n\n"
            "Para esse tipo de trabalho, eu recomendaria organizar a contratação por pacote de horas ou sprint mensal, com backlog priorizado. Posso atuar em criação/manutenção de scripts e APIs, integrações entre serviços, consultas/modelagem de dados, automações e interfaces simples quando necessário.\n\n"
            "Também considero importante manter boas práticas desde o início: versionamento, documentação mínima, tratamento de erros, logs e separação entre ambiente de desenvolvimento e produção."
            + close("\n\nComo o projeto é de 6 meses a 1 ano, o ideal é alinharmos disponibilidade semanal, stack principal e forma de priorização das demandas.")
        )
    if False and has_any(text, ["bot", "pix", "cartão", "telegram", "discord", "assinaturas"]):
        return (
            f"Olá! Li o projeto do bot para pagamentos e liberação automática em grupos privados. Entendi que a solução precisa receber pagamentos, confirmar PIX/cartão, liberar acesso, gerenciar assinaturas/membros e remover inadimplentes quando possível.\n\n"
            "Minha proposta seria desenvolver uma automação com backend simples, integração com gateway de pagamento, bot para Telegram e/ou Discord, banco de dados para registrar usuários/pagamentos/status e um painel administrativo básico para acompanhamento. Também posso incluir instalação em VPS, configuração inicial e uma explicação de uso após a entrega.\n\n"
            "Eu trabalharia com discrição e com escopo bem definido, principalmente nas regras de assinatura, liberação e remoção automática para evitar falhas de acesso."
            + close("\n\nAntes de fechar, é essencial confirmar gateway de pagamento, plataforma do grupo e regras exatas de inadimplência.")
        )
    if has_any(text, ["bac bo", "evolution"]):
        return (
            f"Olá! Li a regra do robô de alerta para Bac Bo na Evolution. Entendi que a ideia é monitorar ocorrências específicas por número/cor, validar janelas históricas e disparar alerta apenas quando os critérios estatísticos descritos forem atendidos.\n\n"
            "Minha sugestão seria começar por um MVP de monitoramento e alerta, com regras configuráveis, registro das análises em log e validação dos resultados antes de qualquer expansão. O foco seria notificação, não promessa de resultado financeiro.\n\n"
            "A parte mais importante é definir a fonte dos dados: API, histórico exportado ou leitura da tela. Isso muda bastante a complexidade e a estabilidade da solução."
            + close("\n\nEu manteria o escopo limitado a alertas e validação das regras, sem automação de apostas.")
        )

    return decision.get("proposal_draft") or proposal(title, "solução sob medida", "uma primeira versão bem delimitada conforme o objetivo do projeto", deadline, decision.get("price_suggested") or 0)


def classify(item: dict[str, Any]) -> dict[str, Any]:
    decision = classify_base(item)
    if decision.get("price_suggested") is None or decision.get("status_manual") == "descartar":
        return decision

    refined = estimate_pricing(item)
    decision.update(refined)
    calc_for_delivery = decision.get("pricing_calc", {})
    decision["delivery_estimate"] = delivery_from_hours(calc_for_delivery.get("hours_min"), calc_for_delivery.get("hours_max"))

    decision["questions_to_client"] = contextual_questions(item, decision)
    decision["proposal_draft"] = contextual_proposal(item, decision)

    calc = decision.get("pricing_calc", {})
    decision["pricing_note"] = (
        f"{decision.get('pricing_note', '')} Cálculo: {calc.get('hours_min')}–{calc.get('hours_max')}h × R$ {HOURLY_RATE}/h "
        f"+ {int((calc.get('risk_pct') or 0)*100)}% de margem de risco, dividido por 0,80 para cobrir os 20% de intermediação da plataforma. "
        f"O valor líquido-alvo sugerido é {money(calc.get('net_target_suggested') or 0)}. {calc.get('note', '')}"
    ).strip()
    return decision


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/home/abel13/.openclaw/workspace/softwarehouse/out/opportunities.enriched.json")
    ap.add_argument("--out", default="/home/abel13/.openclaw/workspace/softwarehouse/out/opportunities.decisions.json")
    args = ap.parse_args()
    data = json.loads(Path(args.input).read_text(encoding="utf-8"))
    for item in data.get("items", []):
        item["decision_support"] = classify(item)
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Decision support: {args.out}")
    print(f"Items: {len(data.get('items', []))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
