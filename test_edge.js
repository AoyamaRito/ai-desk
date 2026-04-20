//@ order = $ECE3, $9B4C, $BE4F
// ヘッダー（先頭の地の文）
const VERSION = "1.0";

//{ 01:State @high $ECE3
let x = 1;
//}

// Stateの後の地の文

//{ 02:Logic @low $9B4C
function test() {}
//}

// Logicの後の地の文

//{ 03:Render @mid $BE4F
// render
//}

// 末尾の地の文
