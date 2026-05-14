#!/usr/bin/env bash
# Phase 10.16 Test Matrix Runner
# Runs the 10-query test matrix against /api/chat/stream and saves evidence.
# Usage: bash scripts/test-matrix-runner.sh [backend-url]
set -u

BACKEND="${1:-http://localhost:3011}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="evidence/phase-10-16"
mkdir -p "$EVIDENCE_DIR"
OUT="$EVIDENCE_DIR/test-matrix_${TIMESTAMP}.json"
SUMMARY="$EVIDENCE_DIR/test-matrix_${TIMESTAMP}.md"

declare -A QUERIES=(
  [T1]="ค้นหาหลักฐานคดีล่าสุดในระบบมีกี่รายการ"
  [T2]="จังหวัดเชียงใหม่อยู่ภาคอะไร มีอำเภอกี่อำเภอ"
  [T3]="สถานะเครื่อง docker และ evidence db ตอนนี้เป็นอย่างไร"
  [T4]="บอกข้อมูลพื้นฐานเกี่ยวกับประเทศไทยและภูมิศาสตร์"
  [T5]="พยากรณ์อากาศพรุ่งนี้ที่กรุงเทพมหานครเป็นอย่างไร"
  [T6]="คำนวณ 15% ของ 87450 บาทเท่ากับเท่าไหร่"
  [T7]="วันนี้วันที่เท่าไหร่ และอีก 45 วันจะตรงกับวันอะไร"
  [T8]="สวัสดีครับ ช่วยแนะนำตัวเองหน่อยได้ไหม"
  [T9]="วางแผนระบบรักษาความปลอดภัยสำหรับสถานีตำรวจ 3 จังหวัด"
  [T10]="เขียน Python function ดึงข้อมูล JSON จาก REST API พร้อม error handling"
)

echo "[" > "$OUT"
echo "# Test Matrix Run — $TIMESTAMP" > "$SUMMARY"
echo "Backend: \`$BACKEND\`" >> "$SUMMARY"
echo "" >> "$SUMMARY"
echo "| ID | Final | Agents | MDES Models | Latency |" >> "$SUMMARY"
echo "|----|-------|--------|-------------|---------|" >> "$SUMMARY"

FIRST=1
for KEY in T1 T2 T3 T4 T5 T6 T7 T8 T9 T10; do
  Q="${QUERIES[$KEY]}"
  echo "=== Running $KEY: $Q ===" >&2
  START=$(date +%s%N)
  RESPONSE=$(curl -s --max-time 45 -X POST "$BACKEND/api/chat/stream" \
    -H "Content-Type: application/json" \
    --data-binary @- <<EOF
{"message":"$Q"}
EOF
)
  END=$(date +%s%N)
  LATENCY_MS=$(( (END - START) / 1000000 ))

  AGENTS=$(echo "$RESPONSE" | grep -c "agent_started" | tr -d '\n' || echo 0)
  HAS_FINAL=$(echo "$RESPONSE" | grep -c "final_answer" | tr -d '\n' || echo 0)
  [ -z "$AGENTS" ] && AGENTS=0
  [ -z "$HAS_FINAL" ] && HAS_FINAL=0
  MODELS=$(echo "$RESPONSE" | grep -oE '"model":"[^"]+' | sed 's/"model":"//' | sort -u | head -3 | paste -sd "," -)
  FINAL_TEXT=$(echo "$RESPONSE" | grep -oE '"finalText":"[^"]{0,80}' | head -1 | sed 's/"finalText":"//')
  STATUS="FAIL"
  [ "$HAS_FINAL" -gt 0 ] && STATUS="PASS"

  [ $FIRST -eq 0 ] && echo "," >> "$OUT"
  FIRST=0
  cat >> "$OUT" <<JSON
  {"id":"$KEY","query":"$Q","status":"$STATUS","agents":$AGENTS,"hasFinal":$HAS_FINAL,"models":"$MODELS","latency_ms":$LATENCY_MS}
JSON

  echo "| $KEY | $STATUS | $AGENTS | ${MODELS:-—} | ${LATENCY_MS}ms |" >> "$SUMMARY"
  echo "  → $STATUS | agents=$AGENTS | models=${MODELS:-none} | ${LATENCY_MS}ms" >&2
done

echo "" >> "$OUT"
echo "]" >> "$OUT"

PASS=$(grep -c "PASS" "$SUMMARY" || echo 0)
TOTAL=10
echo "" >> "$SUMMARY"
echo "**Result: $PASS / $TOTAL passing**" >> "$SUMMARY"

echo ""
echo "Evidence saved:"
echo "  JSON:    $OUT"
echo "  Summary: $SUMMARY"
echo ""
echo "Result: $PASS / $TOTAL passing"
