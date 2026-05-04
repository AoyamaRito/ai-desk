// Phase 2 — sameArr / sameRefs test cases + harness
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type pairCase struct {
	Name string `json:"name"`
	Op   string `json:"op"` // "sameArr" or "sameRefs"
	A    []any  `json:"a"`
	B    []any  `json:"b"`
}

func sameOpsCases() []pairCase {
	return []pairCase{
		{Name: "sameArr empty", Op: "sameArr", A: []any{}, B: []any{}},
		{Name: "sameArr equal strings", Op: "sameArr", A: []any{"a", "b", "c"}, B: []any{"a", "b", "c"}},
		{Name: "sameArr different length", Op: "sameArr", A: []any{"a", "b"}, B: []any{"a", "b", "c"}},
		{Name: "sameArr different element", Op: "sameArr", A: []any{"a", "b", "c"}, B: []any{"a", "x", "c"}},
		{Name: "sameArr numbers equal", Op: "sameArr", A: []any{float64(1), float64(2), float64(3)}, B: []any{float64(1), float64(2), float64(3)}},
		{Name: "sameArr mixed types", Op: "sameArr", A: []any{"1", float64(2)}, B: []any{float64(1), float64(2)}},

		{Name: "sameRefs empty", Op: "sameRefs", A: []any{}, B: []any{}},
		{Name: "sameRefs equal", Op: "sameRefs",
			A: []any{map[string]any{"kind": "calls", "target": "foo"}},
			B: []any{map[string]any{"kind": "calls", "target": "foo"}}},
		{Name: "sameRefs reordered (set-like)", Op: "sameRefs",
			A: []any{map[string]any{"kind": "calls", "target": "foo"}, map[string]any{"kind": "calls", "target": "bar"}},
			B: []any{map[string]any{"kind": "calls", "target": "bar"}, map[string]any{"kind": "calls", "target": "foo"}}},
		{Name: "sameRefs different target", Op: "sameRefs",
			A: []any{map[string]any{"kind": "calls", "target": "foo"}},
			B: []any{map[string]any{"kind": "calls", "target": "bar"}}},
	}
}

// sameOpsHarness は --phase2 オプションのときに sameArr/sameRefs を比較する。
func sameOpsHarness() {
	if len(os.Args) > 2 && os.Args[2] == "--emit-cases" {
		out, _ := json.MarshalIndent(sameOpsCases(), "", "  ")
		fmt.Println(string(out))
		return
	}
	if len(os.Args) > 2 && os.Args[2] == "--emit-go-results" {
		results := []map[string]any{}
		for _, c := range sameOpsCases() {
			var got bool
			switch c.Op {
			case "sameArr":
				got = SameArr(c.A, c.B)
			case "sameRefs":
				got = SameRefs(c.A, c.B)
			}
			results = append(results, map[string]any{"name": c.Name, "result": got})
		}
		out, _ := json.MarshalIndent(results, "", "  ")
		fmt.Println(string(out))
		return
	}
	// default: print Go-side
	fmt.Println("crystallize Phase 2 — sameArr / sameRefs verification")
	fmt.Println("============================================================")
	for _, c := range sameOpsCases() {
		var got bool
		switch c.Op {
		case "sameArr":
			got = SameArr(c.A, c.B)
		case "sameRefs":
			got = SameRefs(c.A, c.B)
		}
		fmt.Printf("  %-40s → Go: %v\n", c.Name, got)
	}
}
