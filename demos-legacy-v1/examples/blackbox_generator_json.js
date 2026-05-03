function legacyShippingCalc(price, weight) {
  let shipping = 800;
  if (weight > 10) shipping += 500;
  else if (weight > 5) shipping += 200;
  if (price >= 10000) shipping = 0;
  else if (price >= 5000) shipping = Math.floor(shipping / 2);
  return shipping;
}
const data = [];
for(let i=0; i<30; i++) {
  const price = Math.floor(Math.random() * 15) * 1000;
  const weight = Math.floor(Math.random() * 15) + 1;
  data.push({ price, weight, result: legacyShippingCalc(price, weight) });
}
console.log(JSON.stringify(data, null, 2));
