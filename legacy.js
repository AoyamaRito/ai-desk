const VERSION = "1.0";

//{ 01:calculateTotal @high $F1E4
function calculateTotal(items) {
  let sum = 0;
  for (let i of items) sum += i;
  return sum;
}
//}

//{ 02:User @mid $089C
class User {
  constructor(name) {
    this.name = name;
  }
}
//}
