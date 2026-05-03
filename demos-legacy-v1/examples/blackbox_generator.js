// 開発者だけが知っている（または誰も中身を知らない）レガシーシステムのブラックボックス
function legacyShippingCalc(price, weight) {
  // AIにはこの中身は見せない前提で実験する
  let shipping = 800; // 基本料金
  
  if (weight > 10) {
    shipping += 500; // 10kgオーバーは大型料金+500円
  } else if (weight > 5) {
    shipping += 200; // 5kgオーバーは中型料金+200円
  }
  
  if (price >= 10000) {
    shipping = 0; // 1万円以上は送料無料
  } else if (price >= 5000) {
    shipping = Math.floor(shipping / 2); // 5000円以上は送料半額
  }
  
  return shipping;
}

console.log("--- 採掘された鉱脈（正解データセット50件）---");
const data = [];
for(let i=0; i<50; i++) {
  // ランダムな入力を生成
  const price = Math.floor(Math.random() * 15) * 1000; // 0 ~ 14000円
  const weight = Math.floor(Math.random() * 15) + 1;    // 1 ~ 15kg
  
  // ブラックボックスに入れて結果を得る
  const result = legacyShippingCalc(price, weight);
  data.push({ price, weight, result });
}
console.table(data);
