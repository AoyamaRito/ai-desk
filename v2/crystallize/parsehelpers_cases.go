// Phase 4 — parseJS helpers test cases + harness
package main

import (
	"encoding/json"
	"fmt"
	"os"
)

type parseCase struct {
	Name      string `json:"name"`
	Op        string `json:"op"` // matchBrace | matchParen | findFunctionBody | extractInlineTags
	Source    string `json:"source"`
	OpenIdx   int    `json:"openIdx"`
	DeclStart int    `json:"declStart"`
}

func parseHelperCases() []parseCase {
	return []parseCase{
		// matchBrace
		{Name: "matchBrace simple", Op: "matchBrace", Source: "{ a }", OpenIdx: 0},
		{Name: "matchBrace nested", Op: "matchBrace", Source: "{ a { b } c }", OpenIdx: 0},
		{Name: "matchBrace with string", Op: "matchBrace", Source: `{ "a}" }`, OpenIdx: 0},
		{Name: "matchBrace with line comment", Op: "matchBrace", Source: "{ // }\n}", OpenIdx: 0},
		{Name: "matchBrace with block comment", Op: "matchBrace", Source: "{ /* } */ x }", OpenIdx: 0},

		// matchParen
		{Name: "matchParen simple", Op: "matchParen", Source: "(a, b)", OpenIdx: 0},
		{Name: "matchParen nested", Op: "matchParen", Source: "(a, (b, c))", OpenIdx: 0},
		{Name: "matchParen with string paren", Op: "matchParen", Source: `(a, ")")`, OpenIdx: 0},

		// findFunctionBody
		{Name: "findFunctionBody simple", Op: "findFunctionBody", Source: "function foo() { return 1; }", DeclStart: 0},
		{Name: "findFunctionBody with args", Op: "findFunctionBody", Source: "function foo(a, b) { return a + b; }", DeclStart: 0},
		{Name: "findFunctionBody arrow not direct", Op: "findFunctionBody", Source: "const f = (a, b) => { return a; }", DeclStart: 10},

		// extractInlineTags
		{Name: "extractInlineTags emblem", Op: "extractInlineTags",
			Source: "// [ai_s_emblem:tag1#tag2 module]\nfunction foo() {}",
			DeclStart: 35,
		},
		{Name: "extractInlineTags @tags", Op: "extractInlineTags",
			Source: "// @tags: alpha, beta\nfunction foo() {}",
			DeclStart: 23,
		},
		{Name: "extractInlineTags none", Op: "extractInlineTags",
			Source: "function foo() {}",
			DeclStart: 0,
		},
	}
}

func parseHelperHarness() {
	if len(os.Args) > 2 && os.Args[2] == "--emit-cases" {
		out, _ := json.MarshalIndent(parseHelperCases(), "", "  ")
		fmt.Println(string(out))
		return
	}
	if len(os.Args) > 2 && os.Args[2] == "--emit-go-results" {
		results := []map[string]any{}
		for _, c := range parseHelperCases() {
			var got any
			switch c.Op {
			case "matchBrace":
				got = MatchBrace(c.Source, c.OpenIdx)
			case "matchParen":
				got = MatchParen(c.Source, c.OpenIdx)
			case "findFunctionBody":
				got = FindFunctionBody(c.Source, c.DeclStart)
			case "extractInlineTags":
				got = ExtractInlineTags(c.Source, c.DeclStart)
			}
			results = append(results, map[string]any{"name": c.Name, "result": got})
		}
		out, _ := json.MarshalIndent(results, "", "  ")
		fmt.Println(string(out))
		return
	}
	fmt.Println("crystallize Phase 4 — parseJS helpers verification")
	fmt.Println("============================================================")
	for _, c := range parseHelperCases() {
		var got any
		switch c.Op {
		case "matchBrace":
			got = MatchBrace(c.Source, c.OpenIdx)
		case "matchParen":
			got = MatchParen(c.Source, c.OpenIdx)
		case "findFunctionBody":
			got = FindFunctionBody(c.Source, c.DeclStart)
		case "extractInlineTags":
			got = ExtractInlineTags(c.Source, c.DeclStart)
		}
		fmt.Printf("  %-40s → Go: %v\n", c.Name, got)
	}
}
