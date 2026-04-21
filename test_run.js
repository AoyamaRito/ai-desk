//@ order = $8120B, $8700F
//@ bookmark:mybook = $8120B, $8700F

//{ 01:Utils @low #lib $8120B
function add(a, b) {
  return a + b;
}
//}
//{ 02:Main @high $8700F
function main() {
  console.log("Updated Hello");
}
//}
