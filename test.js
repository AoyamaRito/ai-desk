//@ order = $70CD, $7652
// 地の文1
const a = 1;

//{ State $70CD
let state = { count: 0 };
function increment() { state.count++; }
//}

// 地の文2

//{ Logic $7652
function calc(x) {
    return x * 2;
}
//}

console.log("done");
