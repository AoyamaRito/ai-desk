#!/bin/bash
set -e

COG="./ai_desk"
TARGET="e2e_app.js"

echo "1. Preparing initial file..."
cat <<'EOT' > $TARGET
//{ 01:Initialization @low
console.log("init 1");
console.log("init 2");
//}
//{ 02:CoreLogic @high
function process() {
  return "old data";
}
//}
//{ 03:View @mid
function render() {
  console.log("render");
}
//}
EOT

echo "2. Stabilizing UIDs (restore)..."
$COG $TARGET restore
# UIDを取得
UID_LOGIC=$(grep "CoreLogic" $TARGET | grep -o '\$[A-Z0-9]*')
echo "Detected CoreLogic UID: $UID_LOGIC"

echo "3. Generating skeleton for AI..."
$COG $TARGET skeleton > skeleton.js
echo "--- Skeleton Output (should be focused and collapsed) ---"
cat skeleton.js

# 検証: CoreLogicが先頭に来ているか、他がCollapsedか
if ! head -n 5 skeleton.js | grep -q "CoreLogic"; then
  echo "FAIL: CoreLogic should be at the top in skeleton mode"
  exit 1
fi
if ! grep -q "Collapsed: 2 lines" skeleton.js; then
  echo "FAIL: Low/Mid sections should be collapsed"
  exit 1
fi

echo "4. Simulating AI response (patch)..."
cat <<EOT > patch_from_ai.js
//{ 02:CoreLogic @high $UID_LOGIC
function process() {
  // Updated by AI!
  return "NEW DATA";
}
//}
EOT

echo "5. Applying AI patch to original file..."
$COG $TARGET apply patch_from_ai.js

echo "6. Final verification..."
echo "--- Final Original File Content ---"
cat $TARGET

# 検証: 修正が反映されているか
if ! grep -q "NEW DATA" $TARGET; then
  echo "FAIL: Patch was not applied"
  exit 1
fi
# 重要: 折りたたまれていた部分が「復活（維持）」しているか
if ! grep -q "init 2" $TARGET; then
  echo "FAIL: Collapsed parts were lost! Apply must be non-destructive."
  exit 1
fi

echo -e "\n✅ E2E TEST PASSED!"
