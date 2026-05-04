// Phase 3 — nodeId / inferTags / checkBraces test cases + harness
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type analysisCase struct {
	Name    string `json:"name"`
	Op      string `json:"op"` // "nodeId" | "inferTags" | "checkBraces"
	Content string `json:"content"`
	Type    string `json:"type"`
}

func analysisCases() []analysisCase {
	return []analysisCase{
		// nodeId
		{Name: "nodeId simple", Op: "nodeId", Content: "module:foo:bar"},
		{Name: "nodeId with dots", Op: "nodeId", Content: "a.b.c-1"},
		{Name: "nodeId already safe", Op: "nodeId", Content: "abc_123"},
		{Name: "nodeId with japanese", Op: "nodeId", Content: "foo:こんにちは:bar"},

		// inferTags
		{Name: "inferTags empty", Op: "inferTags", Content: "", Type: ""},
		{Name: "inferTags console only", Op: "inferTags", Content: "console.log('hi')", Type: ""},
		{Name: "inferTags pure function", Op: "inferTags", Content: "return a + b;", Type: "function"},
		{Name: "inferTags impure function", Op: "inferTags", Content: "console.log(x); return 1;", Type: "function"},
		{Name: "inferTags test code", Op: "inferTags", Content: "test('foo', () => { assert(x === 1); })", Type: ""},
		{Name: "inferTags io + async", Op: "inferTags", Content: "async function r() { await readFileSync('x'); }", Type: "function"},
		{Name: "inferTags network", Op: "inferTags", Content: "fetch('/api')", Type: ""},
		{Name: "inferTags inheritance", Op: "inferTags", Content: "class Foo extends Bar {}", Type: ""},
		{Name: "inferTags collection", Op: "inferTags", Content: "const m = new Map(); const s = new Set();", Type: ""},
		{Name: "inferTags large", Op: "inferTags", Content: makeNLines(60, "x = 1;"), Type: "function"},
		{Name: "inferTags small function", Op: "inferTags", Content: "return 1;", Type: "function"},

		// checkBraces
		{Name: "checkBraces balanced", Op: "checkBraces", Content: "function f() { return { x: 1 }; }"},
		{Name: "checkBraces extra close", Op: "checkBraces", Content: "function f() { return; } }"},
		{Name: "checkBraces unbalanced open", Op: "checkBraces", Content: "function f() { return { "},
		{Name: "checkBraces with string", Op: "checkBraces", Content: `const s = "}}}"; const o = {};`},
		{Name: "checkBraces with template literal", Op: "checkBraces", Content: "const s = `${x + 1}`; const o = {a: 1};"},
		{Name: "checkBraces with line comment", Op: "checkBraces", Content: "// } } }\nconst o = {};"},
		{Name: "checkBraces with block comment", Op: "checkBraces", Content: "/* { } */\nconst o = {a: 1};"},
		{Name: "checkBraces with regex", Op: "checkBraces", Content: "const r = /\\}{2,}/g;\nconst o = {};"},
	}
}

func makeNLines(n int, line string) string {
	out := ""
	for i := 0; i < n; i++ {
		if i > 0 {
			out += "\n"
		}
		out += line
	}
	return out
}

func analysisHarness() {
	if len(os.Args) > 2 && os.Args[2] == "--emit-cases" {
		out, _ := json.MarshalIndent(analysisCases(), "", "  ")
		fmt.Println(string(out))
		return
	}
	if len(os.Args) > 2 && os.Args[2] == "--emit-go-results" {
		results := []map[string]any{}
		for _, c := range analysisCases() {
			var got any
			switch c.Op {
			case "nodeId":
				got = NodeId(c.Content)
			case "inferTags":
				got = InferTags(c.Content, c.Type)
			case "checkBraces":
				got = CheckBraces(c.Content)
			}
			results = append(results, map[string]any{"name": c.Name, "result": got})
		}
		out, _ := json.MarshalIndent(results, "", "  ")
		fmt.Println(string(out))
		return
	}
	fmt.Println("crystallize Phase 3 — nodeId / inferTags / checkBraces verification")
	fmt.Println("============================================================")
	for _, c := range analysisCases() {
		var got any
		switch c.Op {
		case "nodeId":
			got = NodeId(c.Content)
		case "inferTags":
			got = InferTags(c.Content, c.Type)
		case "checkBraces":
			got = CheckBraces(c.Content)
		}
		fmt.Printf("  %-40s → Go: %v\n", c.Name, got)
	}
}
