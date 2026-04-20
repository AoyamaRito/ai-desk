// ==== Global Config ====
const VERSION = "1.0.0";



//{ 01:State @mid
let state = { count: 0 };
//}
//{ 02:Logic @high #core
function calc() {
    return "logic";
}
//}
//{ 03:Draw @low #ui
function render() {
    console.log("draw");
}
//}
