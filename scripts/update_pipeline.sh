#!/usr/bin/env bash
set -euo pipefail

ROOT="${SOFTWAREHOUSE_WORKSPACE:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/storage}"
SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INPUT_DIR="${1:-${SOFTWAREHOUSE_EML_DIR:-$ROOT/emls}}"
FEEDBACK="${SOFTWAREHOUSE_FEEDBACK:-$ROOT/data/feedback.json}"
OUT_DIR="$ROOT/out"
PAGES_DIR="$ROOT/pages"

mkdir -p "$ROOT" "$INPUT_DIR" "$ROOT/data" "$OUT_DIR" "$PAGES_DIR"
if [ ! -f "$FEEDBACK" ]; then
  printf '{"schema_version":1,"items":{}}\n' > "$FEEDBACK"
fi

echo "[99Dashboard] Workspace: $ROOT"
echo "[99Dashboard] Entrada EML: $INPUT_DIR"
echo "[99Dashboard] EMLs encontrados: $(find "$INPUT_DIR" -maxdepth 1 -type f -iname '*.eml' 2>/dev/null | wc -l)"

python3 "$SCRIPT_ROOT/parse_99freelas_eml.py" --input "$INPUT_DIR" --out "$OUT_DIR"
python3 "$SCRIPT_ROOT/enrich_99freelas_pages.py" --input "$OUT_DIR/opportunities.json" --out "$OUT_DIR/opportunities.enriched.json" --pages-dir "$PAGES_DIR"
python3 "$SCRIPT_ROOT/add_decision_support.py" --input "$OUT_DIR/opportunities.enriched.json" --out "$OUT_DIR/opportunities.decisions.json"
python3 "$SCRIPT_ROOT/apply_feedback.py" --input "$OUT_DIR/opportunities.decisions.json" --feedback "$FEEDBACK" --out "$OUT_DIR/opportunities.feedback.json"

echo "[99Dashboard] Dados atualizados: $OUT_DIR/opportunities.feedback.json"
