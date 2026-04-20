//@ order = $UID1, $UID2
//{ 01:Setup @low $UID1
const a = 1;
const b = 2;
const c = 3;
const d = 4;
//}
//{ 02:Main @high $UID2
function main() {
  console.log("hello");
}
//}
