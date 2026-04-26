/**
 * AI-Miner によってデータから自動抽出された送料計算ロジック
 * 採掘元: shipping_data.json (2026-04-26)
 */
// [ai_s_emblem:#high#logic Shipping-Logic]
function calculateShipping(price, weight) {
  // 1. 送料無料の絶対条件
  if (price >= 10000) {
    return 0;
  }

  // 2. 重量帯による基本送料の決定
  let baseAmount = 800; // 0-5kg
  if (weight > 10) {
    baseAmount = 1300; // 10kg超
  } else if (weight > 5) {
    baseAmount = 1000; // 5kg超
  }

  // 3. 価格帯による割引（5000円以上は半額）の適用
  if (price >= 5000) {
    return Math.floor(baseAmount / 2);
  }

  // 4. 標準料金
  return baseAmount;
}
// [/ai_s_emblem: Shipping-Logic]

// Node.js用エクスポート（検証用）
if (typeof module !== 'undefined') {
  module.exports = { calculateShipping };
}
