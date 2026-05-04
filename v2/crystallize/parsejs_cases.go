// Phase 5 — parseJS test cases + harness
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
)

// jsonNoEscape: JS と同じく < > & を生 ASCII で出力する MarshalIndent。
func jsonNoEscape(v any) []byte {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetIndent("", "  ")
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
	// Encoder は末尾に \n を入れる、JS の JSON.stringify は入れないので除去
	out := buf.Bytes()
	if len(out) > 0 && out[len(out)-1] == '\n' {
		out = out[:len(out)-1]
	}
	return out
}

type pjCase struct {
	Name     string `json:"name"`
	Source   string `json:"source"`
	ModuleId string `json:"moduleId"`
}

func parseJSCases() []pjCase {
	return []pjCase{
		{Name: "empty source", Source: "", ModuleId: "mod"},
		{Name: "single function", Source: "function foo() { return 1; }", ModuleId: "mod"},
		{Name: "exported function", Source: "export function bar(a) { return a; }", ModuleId: "mod"},
		{Name: "async function", Source: "export async function baz() { await x(); }", ModuleId: "mod"},
		{Name: "arrow function", Source: "const add = (a, b) => { return a + b; }", ModuleId: "mod"},
		{Name: "class", Source: "export class Foo { bar() { return 1; } }", ModuleId: "mod"},
		{Name: "import", Source: `import { x } from './x.js';` + "\n" + `function f() { return x(); }`, ModuleId: "mod"},
		{Name: "two functions with call", Source: "function a() { return b(); }\nfunction b() { return 1; }", ModuleId: "mod"},
		{Name: "function with inline tags", Source: "// [ai_s_emblem:tag1#tag2 mod]\nfunction f() {}", ModuleId: "mod"},
		{Name: "mixed imports and class", Source: `import { Foo } from './foo.js';` + "\n" + `export class Bar extends Foo { x() {} }`, ModuleId: "mod"},
	}
}

func parseJSHarness() {
	if len(os.Args) > 2 && os.Args[2] == "--emit-cases" {
		fmt.Println(string(jsonNoEscape(parseJSCases())))
		return
	}
	if len(os.Args) > 2 && os.Args[2] == "--emit-go-results" {
		results := []map[string]any{}
		for _, c := range parseJSCases() {
			got := ParseJS(c.Source, c.ModuleId)
			results = append(results, map[string]any{"name": c.Name, "result": got})
		}
		fmt.Println(string(jsonNoEscape(results)))
		return
	}
	fmt.Println("crystallize Phase 5 — parseJS verification")
	fmt.Println("============================================================")
	for _, c := range parseJSCases() {
		got := ParseJS(c.Source, c.ModuleId)
		fmt.Printf("  %-40s → Go: %d blocks\n", c.Name, len(got))
	}
}
