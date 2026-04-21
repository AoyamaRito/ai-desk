#!/bin/bash
set -e

COG="./ai_desk"
TARGET="e2e_vvv.txt"

echo "1. Preparing VVV file..."
cat <<'EOT' > $TARGET
VVV 01:Docs @low
This is doc line 1.
This is doc line 2.
AAA
VVV 02:Main @high
This is main logic.
AAA
EOT

echo "2. Stabilizing UIDs..."
$COG $TARGET restore
UID_MAIN=$(grep "Main" $TARGET | grep -o '\$[A-Z0-9]*')

echo "3. Testing skeleton..."
$COG $TARGET skeleton > skeleton_vvv.txt
if ! head -n 5 skeleton_vvv.txt | grep -q "Main"; then
  echo "FAIL: Main should be at the top"
  exit 1
fi
if ! grep -q "Collapsed" skeleton_vvv.txt; then
  echo "FAIL: Low sections should be collapsed"
  exit 1
fi

echo "4. Simulating patch..."
cat <<EOT > patch_vvv.txt
VVV 02:Main @high $UID_MAIN
This is NEW logic.
AAA
EOT

echo "5. Applying patch..."
$COG $TARGET apply patch_vvv.txt

echo "6. Verification..."
if ! grep -q "NEW logic" $TARGET; then
  echo "FAIL: Patch not applied"
  exit 1
fi
if ! grep -q "doc line 2" $TARGET; then
  echo "FAIL: Collapsed parts lost"
  exit 1
fi

echo -e "\n✅ VVV TEST PASSED!"
