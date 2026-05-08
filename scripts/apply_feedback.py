#!/usr/bin/env python3
"""Mescla feedback manual do Abel nas oportunidades do Softwarehouse."""
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any

VALID_STATUSES = {
    "new",
    "review",
    "liked",
    "discarded",
    "prepare_proposal",
    "proposal_sent",
    "won",
    "lost",
}

STATUS_LABELS = {
    "new": "Novo",
    "review": "Revisar",
    "liked": "Gostei",
    "discarded": "Descartado por Abel",
    "prepare_proposal": "Preparar proposta",
    "proposal_sent": "Proposta enviada",
    "won": "Ganhou",
    "lost": "Perdeu",
}


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def normalize_feedback(raw: dict[str, Any]) -> dict[str, Any]:
    status = raw.get("status")
    if status and status not in VALID_STATUSES:
        status = "review"
    return {
        "status": status,
        "status_label": STATUS_LABELS.get(status, None),
        "abel_score": raw.get("abel_score"),
        "price_override": raw.get("price_override"),
        "reason": raw.get("reason"),
        "notes": raw.get("notes"),
        "proposal_sent_price": raw.get("proposal_sent_price"),
        "proposal_sent_at": raw.get("proposal_sent_at"),
        "outcome": raw.get("outcome"),
        "updated_at": raw.get("updated_at"),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="/home/abel13/.openclaw/workspace/softwarehouse/out/opportunities.decisions.json")
    ap.add_argument("--feedback", default="/home/abel13/.openclaw/workspace/softwarehouse/data/feedback.json")
    ap.add_argument("--out", default="/home/abel13/.openclaw/workspace/softwarehouse/out/opportunities.feedback.json")
    args = ap.parse_args()

    data = load_json(Path(args.input), {"items": []})
    feedback = load_json(Path(args.feedback), {"schema_version": 1, "items": {}})
    items_feedback = feedback.get("items", {})

    for item in data.get("items", []):
        pid = str(item.get("source_project_id") or "")
        fb = normalize_feedback(items_feedback.get(pid, {}))
        item["abel_feedback"] = fb
        ds = item.get("decision_support", {})
        # Campo efetivo para o dashboard: feedback manual vence sugestão heurística.
        item["effective_status"] = fb.get("status") or ds.get("status_manual") or "review"
        item["effective_status_label"] = fb.get("status_label") or (item["effective_status"].replace("_", " ").title())
        if fb.get("price_override") is not None:
            ds["price_suggested_effective"] = fb.get("price_override")
        else:
            ds["price_suggested_effective"] = ds.get("price_suggested")

    data["feedback_applied_at"] = datetime.now().isoformat(timespec="seconds")
    data["feedback_source"] = str(Path(args.feedback))
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Feedback merged: {args.out}")
    print(f"Items: {len(data.get('items', []))}")
    print(f"Feedback records: {len(items_feedback)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
