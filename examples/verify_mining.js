const { calculateShipping } = require('./mined_logic.js');
const data = require('./shipping_data.json');

console.log("🔍 [Verification] Checking synthesized logic against original data...");

let passCount = 0;
data.forEach((item, index) => {
  const result = calculateShipping(item.price, item.weight);
  if (result === item.result) {
    passCount++;
  } else {
    console.error(`❌ Mismatch at index ${index}: Price=${item.price}, Weight=${item.weight} | Expected=${item.result}, Got=${result}`);
  }
});

const accuracy = (passCount / data.length) * 100;
console.log(`\n📊 [Final Result] Pass: ${passCount}/${data.length} (${accuracy.toFixed(1)}%)`);

if (accuracy === 100) {
  console.log("✅ PROOF COMPLETE: The synthesized logic is mathematically consistent with the data mining results.");
} else {
  console.log("⚠️ PROOF FAILED: Some edge cases were not captured.");
  process.exit(1);
}
