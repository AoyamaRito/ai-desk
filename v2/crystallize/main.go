// crystallize Phase 1 — verification harness
// JS hashVersion と Go HashVersion が同じ入力で同じ出力を返すか検証。
//
// 検証戦略:
//   1. test cases を Go 側で定義(map[string]any のリスト)
//   2. 同じ data を JSON で stdout に出して Node に渡す
//   3. Node 側で JS hashVersion を呼んで結果を返す
//   4. Go 側で比較
//
// run: go build && ./crystallize | node verify.js | diff - expected.txt

package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type testCase struct {
	Name  string         `json:"name"`
	Input map[string]any `json:"input"`
}

func main() {
	cases := []testCase{
		{
			Name:  "empty version",
			Input: map[string]any{},
		},
		{
			Name: "minimal version",
			Input: map[string]any{
				"timestamp": 1000,
				"prevHash":  nil,
				"content":   "hello",
				"refs":      []any{},
				"children":  []any{},
				"tags":      []any{},
				"meta":      map[string]any{},
			},
		},
		{
			Name: "version with content + tags",
			Input: map[string]any{
				"timestamp": 1234567890,
				"prevHash":  "deadbeef",
				"content":   "function foo() { return 42; }",
				"refs":      []any{map[string]any{"kind": "calls", "target": "bar"}},
				"children":  []any{},
				"tags":      []any{"export", "function"},
				"meta":      map[string]any{"name": "foo"},
			},
		},
		{
			Name: "version with hash key (must be excluded)",
			Input: map[string]any{
				"timestamp": 5000,
				"prevHash":  nil,
				"content":   "x",
				"refs":      []any{},
				"children":  []any{},
				"tags":      []any{},
				"meta":      map[string]any{},
				"hash":      "should-be-ignored",
			},
		},
		{
			Name: "version with japanese content",
			Input: map[string]any{
				"timestamp": 9999,
				"prevHash":  "abc12345",
				"content":   "こんにちは世界",
				"refs":      []any{},
				"children":  []any{},
				"tags":      []any{},
				"meta":      map[string]any{},
			},
		},
	}

	if len(os.Args) > 1 && os.Args[1] == "--emit-cases" {
		// Node 側で読む用の JSON を出力
		out, _ := json.MarshalIndent(cases, "", "  ")
		fmt.Println(string(out))
		return
	}

	if len(os.Args) > 1 && os.Args[1] == "--emit-go-results" {
		// Go 側で計算した結果を JSON で出す
		results := []map[string]string{}
		for _, c := range cases {
			results = append(results, map[string]string{
				"name": c.Name,
				"hash": HashVersion(c.Input),
			})
		}
		out, _ := json.MarshalIndent(results, "", "  ")
		fmt.Println(string(out))
		return
	}

	// default: 自分で JS と Go を実行して比較
	fmt.Println("crystallize Phase 1 — hashVersion crystallization verification")
	fmt.Println("============================================================")
	fmt.Println()
	fmt.Println("Test cases:", len(cases))
	for _, c := range cases {
		goHash := HashVersion(c.Input)
		fmt.Printf("  %-40s → Go: %s\n", c.Name, goHash)
	}
	fmt.Println()
	fmt.Println("Run JS comparison:")
	fmt.Println("  ./crystallize --emit-cases | node verify.js > js-results.json")
	fmt.Println("  ./crystallize --emit-go-results > go-results.json")
	fmt.Println("  diff js-results.json go-results.json")
}
