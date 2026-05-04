// ai-desk-go — Go CLI shell for ai-desk v2
//
// 思想:
//   - JS core(ai-desk-core.js + AiRunAndRead_BIBLE.js)はそのまま、Go binary
//     に embed して goja で実行する
//   - Go は I/O / process / fs / signal だけを担当(Bible §3 Eternal
//     Compatibility の現実的最終形 ─ Node 必須を解除する)
//   - 1 binary 配布(Node install 不要)、cross-compile 可
//
// build:
//   node bundle.js              # JS を 1 file に bundle
//   go build -o ai-desk          # binary 生成
//   ./ai-desk bible-info         # 動作確認

package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/dop251/goja"
)

//go:embed ai-desk-bundle.js
var bundleSrc string

// ============================================================
// Goja runtime — JS core を embed して 1 度だけ実行
// ============================================================

type Runtime struct {
	vm     *goja.Runtime
	aiDesk *goja.Object
}

func NewRuntime() (*Runtime, error) {
	vm := goja.New()
	if _, err := vm.RunString(bundleSrc); err != nil {
		return nil, fmt.Errorf("goja exec bundle: %w", err)
	}
	v := vm.Get("AiDesk")
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil, fmt.Errorf("globalThis.AiDesk not exposed by bundle")
	}
	return &Runtime{vm: vm, aiDesk: v.ToObject(vm)}, nil
}

// Call calls a function on globalThis.AiDesk.<name> with given args
func (r *Runtime) Call(name string, args ...interface{}) (goja.Value, error) {
	fn := r.aiDesk.Get(name)
	if fn == nil || goja.IsUndefined(fn) {
		return nil, fmt.Errorf("AiDesk.%s not found", name)
	}
	cb, ok := goja.AssertFunction(fn)
	if !ok {
		return nil, fmt.Errorf("AiDesk.%s is not a function", name)
	}
	jsArgs := make([]goja.Value, len(args))
	for i, a := range args {
		jsArgs[i] = r.vm.ToValue(a)
	}
	return cb(goja.Undefined(), jsArgs...)
}

// Get returns globalThis.AiDesk.<name> as goja.Value
func (r *Runtime) Get(name string) goja.Value {
	return r.aiDesk.Get(name)
}

// New creates an instance of class on globalThis.AiDesk
func (r *Runtime) New(className string, args ...interface{}) (*goja.Object, error) {
	cls := r.aiDesk.Get(className)
	if cls == nil || goja.IsUndefined(cls) {
		return nil, fmt.Errorf("AiDesk.%s not found", className)
	}
	jsArgs := make([]goja.Value, len(args))
	for i, a := range args {
		jsArgs[i] = r.vm.ToValue(a)
	}
	ctor, ok := goja.AssertConstructor(cls)
	if !ok {
		return nil, fmt.Errorf("AiDesk.%s is not a constructor", className)
	}
	return ctor(nil, jsArgs...)
}

// ============================================================
// Helpers — Go ↔ JS の橋渡し
// ============================================================

// jsToJSON: goja.Value を JSON-serializable な Go の interface{} に変換
func jsToJSON(rt *Runtime, v goja.Value) interface{} {
	if v == nil || goja.IsUndefined(v) || goja.IsNull(v) {
		return nil
	}
	return v.Export()
}

// readSource: ファイルを読み、エラーは exit
func readSource(path string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintln(os.Stderr, "read error:", err)
		os.Exit(1)
	}
	return string(b)
}

// printJSON: 任意値を pretty JSON で stdout に
func printJSON(v interface{}) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		fmt.Fprintln(os.Stderr, "marshal error:", err)
		os.Exit(1)
	}
	fmt.Println(string(b))
}

// ============================================================
// CLI commands
// ============================================================

func cmdBibleInfo(rt *Runtime) {
	axioms := rt.aiDesk.Get("Axioms").Export().(map[string]interface{})
	blockTypes := rt.aiDesk.Get("BlockTypes").Export().(map[string]interface{})
	taboos := rt.aiDesk.Get("Taboos").Export().([]interface{})
	vocab := rt.aiDesk.Get("Vocabulary").Export().(map[string]interface{})
	version := rt.aiDesk.Get("VERSION").String()

	fmt.Printf("BIBLE.js version: %s\n", version)
	fmt.Printf("Axioms (%d):\n", len(axioms))
	keys := make([]string, 0, len(axioms))
	for k := range axioms {
		keys = append(keys, k)
	}
	// keep id order
	order := []string{"A0", "A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"}
	for _, id := range order {
		if a, ok := axioms[id].(map[string]interface{}); ok {
			fmt.Printf("  %s %s\n", a["id"], a["name"])
		}
	}
	fmt.Printf("Block types (%d):\n", len(blockTypes))
	for k, v := range blockTypes {
		t := v.(map[string]interface{})
		p, _ := t["purpose"].(string)
		if len(p) > 60 {
			p = p[:60] + "..."
		}
		fmt.Printf("  %s: %s\n", k, p)
	}
	fmt.Printf("Taboos (%d): ", len(taboos))
	names := []string{}
	for _, tb := range taboos {
		t := tb.(map[string]interface{})
		names = append(names, t["name"].(string))
	}
	fmt.Println(strings.Join(names, ", "))
	fmt.Println("Vocabulary: use new terms, avoid old ones")
	use := vocab["use"].(map[string]interface{})
	for k, v := range use {
		entry := v.(map[string]interface{})
		fmt.Printf("  %-8s ← %s\n", k, entry["replaces"])
	}
}

func cmdBibleCheck(rt *Runtime, file string) {
	src := readSource(file)
	v, err := rt.Call("Kernel"+".diagnose", src, file)
	_ = v
	_ = err
	// 上の Call は AiDesk.Kernel.diagnose() を呼ぶには不十分。Kernel オブジェクトを取り出して method call:
	kernelV := rt.aiDesk.Get("Kernel")
	kernelObj := kernelV.ToObject(rt.vm)
	diagFn := kernelObj.Get("diagnose")
	cb, _ := goja.AssertFunction(diagFn)
	res, err := cb(kernelV, rt.vm.ToValue(src), rt.vm.ToValue(file))
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	out := res.Export()
	printJSON(out)
	if m, ok := out.(map[string]interface{}); ok {
		if ok2, _ := m["ok"].(bool); !ok2 {
			os.Exit(1)
		}
	}
}

func cmdBibleSummon(rt *Runtime, axiomIDs []string) {
	kernelV := rt.aiDesk.Get("Kernel")
	kernelObj := kernelV.ToObject(rt.vm)
	fn := kernelObj.Get("summonContext")
	cb, _ := goja.AssertFunction(fn)
	args := []goja.Value{rt.vm.ToValue(axiomIDs), rt.vm.ToValue(map[string]interface{}{"spotlight": true})}
	res, err := cb(kernelV, args...)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
	fmt.Print(res.String())
}

func cmdSkeleton(rt *Runtime, file string) {
	src := readSource(file)
	v, err := rt.Call("parseJS", src, file)
	if err != nil {
		fmt.Fprintln(os.Stderr, "parseJS error:", err)
		os.Exit(1)
	}
	// v は Block[] — 各 Block.id, type, refs を出力
	blocks := v.Export().([]interface{})
	for _, b := range blocks {
		bm := b.(map[string]interface{})
		fmt.Printf("%s (%s)\n", bm["id"], bm["type"])
		// refs は head().refs(getter)、export 後は plain object なので versions[最後].refs を見る
		if versions, ok := bm["versions"].([]interface{}); ok && len(versions) > 0 {
			last := versions[len(versions)-1].(map[string]interface{})
			if refs, ok := last["refs"].([]interface{}); ok {
				for _, r := range refs {
					rm := r.(map[string]interface{})
					fmt.Printf("  %s -> %s\n", rm["kind"], rm["target"])
				}
			}
		}
	}
}

func cmdFocus(rt *Runtime, file, id string) {
	src := readSource(file)
	v, err := rt.Call("parseJS", src, file)
	if err != nil {
		fmt.Fprintln(os.Stderr, "parseJS error:", err)
		os.Exit(1)
	}
	blocks := v.Export().([]interface{})
	for _, b := range blocks {
		bm := b.(map[string]interface{})
		if bm["id"] == id {
			if versions, ok := bm["versions"].([]interface{}); ok && len(versions) > 0 {
				last := versions[len(versions)-1].(map[string]interface{})
				fmt.Println(last["content"])
			}
			return
		}
	}
	fmt.Fprintln(os.Stderr, "not found:", id)
	os.Exit(1)
}

func cmdSave(rt *Runtime, outPath string, files []string) {
	// 各ファイルを parseJS、Graph に集約、JSON で書き出し
	graphV, err := rt.New("Graph")
	if err != nil {
		fmt.Fprintln(os.Stderr, "Graph new:", err)
		os.Exit(1)
	}
	addFn := graphV.Get("add")
	addCb, _ := goja.AssertFunction(addFn)
	for _, f := range files {
		src := readSource(f)
		v, err := rt.Call("parseJS", src, f)
		if err != nil {
			fmt.Fprintln(os.Stderr, "parseJS error:", err)
			os.Exit(1)
		}
		// blocks は actual goja Object (array of Block instances)
		blocksV := v.ToObject(rt.vm)
		length := blocksV.Get("length").ToInteger()
		for i := int64(0); i < length; i++ {
			b := blocksV.Get(fmt.Sprintf("%d", i))
			_, _ = addCb(graphV, b)
		}
	}
	// graph.toJSON() を呼ぶ
	toJSONFn := graphV.Get("toJSON")
	toJSONCb, _ := goja.AssertFunction(toJSONFn)
	jsonV, err := toJSONCb(graphV)
	if err != nil {
		fmt.Fprintln(os.Stderr, "toJSON:", err)
		os.Exit(1)
	}
	out := jsonV.Export()
	b, err := json.MarshalIndent(out, "", "  ")
	if err != nil {
		fmt.Fprintln(os.Stderr, "marshal:", err)
		os.Exit(1)
	}
	if err := os.WriteFile(outPath, b, 0644); err != nil {
		fmt.Fprintln(os.Stderr, "write:", err)
		os.Exit(1)
	}
	abs, _ := filepath.Abs(outPath)
	fmt.Printf("saved → %s\n", abs)
}

// ============================================================
// main
// ============================================================

func usage() {
	fmt.Fprintln(os.Stderr, "ai-desk-go — Go CLI for ai-desk v2 (single binary, no Node required)")
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "commands:")
	fmt.Fprintln(os.Stderr, "  bible-info               — Bible 9 axioms / 7 BlockTypes / 7 Taboos / Vocabulary")
	fmt.Fprintln(os.Stderr, "  bible-check <file>       — Bible 違反診断 (exit 1 if violated)")
	fmt.Fprintln(os.Stderr, "  bible-summon <ids...>    — 重力場 prompt 動的生成")
	fmt.Fprintln(os.Stderr, "  skeleton <file>          — Block 構造の透視")
	fmt.Fprintln(os.Stderr, "  focus <file> <id>        — 指定 Block の content")
	fmt.Fprintln(os.Stderr, "  save <out.json> <files>  — Graph を JSON に保存")
	os.Exit(2)
}

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	rt, err := NewRuntime()
	if err != nil {
		fmt.Fprintln(os.Stderr, "init runtime:", err)
		os.Exit(1)
	}
	cmd := os.Args[1]
	args := os.Args[2:]

	switch cmd {
	case "bible-info":
		cmdBibleInfo(rt)
	case "bible-check":
		if len(args) < 1 {
			fmt.Fprintln(os.Stderr, "usage: bible-check <file>")
			os.Exit(2)
		}
		cmdBibleCheck(rt, args[0])
	case "bible-summon":
		ids := args
		if len(ids) == 0 {
			ids = []string{"A0", "A4", "A5", "A6", "A8"}
		}
		cmdBibleSummon(rt, ids)
	case "skeleton":
		if len(args) < 1 {
			fmt.Fprintln(os.Stderr, "usage: skeleton <file>")
			os.Exit(2)
		}
		cmdSkeleton(rt, args[0])
	case "focus":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "usage: focus <file> <id>")
			os.Exit(2)
		}
		cmdFocus(rt, args[0], args[1])
	case "save":
		if len(args) < 2 {
			fmt.Fprintln(os.Stderr, "usage: save <out.json> <files...>")
			os.Exit(2)
		}
		cmdSave(rt, args[0], args[1:])
	case "version":
		v := rt.aiDesk.Get("VERSION")
		fmt.Println("ai-desk-go (Bible v" + v.String() + ", goja embed)")
	case "help", "-h", "--help":
		usage()
	default:
		fmt.Fprintln(os.Stderr, "unknown command:", cmd)
		usage()
	}
}
