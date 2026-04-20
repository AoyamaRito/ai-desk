//@ order = $UID1, $UID2, $UID3
//{ 01:Setup @low $UID1
const a = 1;
//}
//{ 02:Main @high $UID2
function main() {
  console.log("hello");
}
//}
//{ 03:Footer @low $UID3
const z = 99;
//}
