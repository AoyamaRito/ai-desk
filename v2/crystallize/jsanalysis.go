// Package crystallize Phase 3 — nodeId / inferTags / checkBraces
//
// REAL = ai-desk-core.js
//   - export function inferTags(content, type)
//   - export function checkBraces(content)
//   - function nodeId(id)
//   - function isRegexContext(source, slashIdx)
//   - function skipRegex(source, startIdx)
//
// 翻訳の決定事項:
//  - JS regex `/[\w$\]\)]/` → Go regexp.MustCompile(`[\w$\])]`)
//    注: Go 内 raw string で `\w` は使える(POSIX 拡張)、`$` `]` `)` はリテラル文字。
//  - JS Set の insertion order → Go では []string + 重複防止 map で再現
//  - inferTags の regex には RegExp の実装差は無い(全部 ascii literal patterns)
//  - checkBraces は文字単位走査、charCodeAt 不要(c === '"' 等の literal 比較のみ)
//  - 全部 ASCII 中心、UTF-8 でも問題なし(byte 走査で OK)

package main

import (
	"regexp"
	"strings"
)

// NodeId: JS nodeId の Go 翻訳。
// `[^a-zA-Z0-9_]` を `_` に置換、prefix `n_` をつける。
var nodeIdRe = regexp.MustCompile(`[^a-zA-Z0-9_]`)

func NodeId(id string) string {
	return "n_" + nodeIdRe.ReplaceAllString(id, "_")
}

// InferTags: JS inferTags の Go 翻訳。
// content / type から tag を推論、insertion order で返す。
type taggedSet struct {
	keys []string
	seen map[string]bool
}

func (t *taggedSet) add(s string) {
	if t.seen == nil {
		t.seen = map[string]bool{}
	}
	if !t.seen[s] {
		t.seen[s] = true
		t.keys = append(t.keys, s)
	}
}

var (
	reTestCall    = regexp.MustCompile(`\b(test|describe|it)\s*\(\s*['"]`)
	reAssert      = regexp.MustCompile(`\bassert\b`)
	reIO          = regexp.MustCompile(`\b(readFileSync|writeFileSync|readFile|writeFile|fs\.)`)
	reNetwork     = regexp.MustCompile(`\bfetch\s*\(|\bXMLHttpRequest\b`)
	reLogging     = regexp.MustCompile(`\bconsole\.`)
	reAsync       = regexp.MustCompile(`\basync\b|\bawait\b`)
	reRegex       = regexp.MustCompile(`\bnew\s+RegExp|/[^/\n]+/[gimuy]*`)
	reInheritance = regexp.MustCompile(`\bclass\s+\w+\s+extends\b`)
	reCollection  = regexp.MustCompile(`\bMap\s*\(|\bSet\s*\(`)
	reImpure      = regexp.MustCompile(`\b(console\.|fs\.|writeFileSync|readFileSync|fetch\(|process\.)`)
)

func InferTags(content string, typ string) []string {
	if content == "" {
		return []string{}
	}
	t := &taggedSet{}
	if reTestCall.MatchString(content) {
		t.add("test")
	}
	if reAssert.MatchString(content) {
		t.add("assertion")
	}
	if reIO.MatchString(content) {
		t.add("io")
	}
	if reNetwork.MatchString(content) {
		t.add("network")
	}
	if reLogging.MatchString(content) {
		t.add("logging")
	}
	if reAsync.MatchString(content) {
		t.add("async")
	}
	if reRegex.MatchString(content) {
		t.add("regex")
	}
	if reInheritance.MatchString(content) {
		t.add("inheritance")
	}
	if reCollection.MatchString(content) {
		t.add("collection")
	}
	if !reImpure.MatchString(content) && typ == "function" {
		t.add("pure")
	}
	numLines := strings.Count(content, "\n") + 1
	if numLines > 50 {
		t.add("large")
	}
	if numLines < 10 && typ == "function" {
		t.add("small")
	}
	if t.keys == nil {
		return []string{}
	}
	return t.keys
}

// BraceError: JS checkBraces の return value 型(insertion order を保つため struct 化)。
// JS では `{ error, at }` または `{ error, remaining }` の object literal。
// Go の map[string]any は JSON 出力時に key alphabetical sort されるので、
// JS の insertion order に合わせるため struct + omitempty を使う。
type BraceError struct {
	Error     string `json:"error"`
	At        *int   `json:"at,omitempty"`
	Remaining *int   `json:"remaining,omitempty"`
}

// CheckBraces: JS checkBraces の Go 翻訳。
// 戻り値 nil = 平衡、それ以外は BraceError(JS object と同じ field 順)。
func CheckBraces(content string) *BraceError {
	depth := 0
	var inString byte = 0
	escape := false
	inTemplate := 0
	n := len(content)
	for i := 0; i < n; i++ {
		c := content[i]
		if escape {
			escape = false
			continue
		}
		if c == '\\' {
			escape = true
			continue
		}
		if inString != 0 {
			if c == inString {
				inString = 0
			} else if inString == '`' && c == '$' && i+1 < n && content[i+1] == '{' {
				inTemplate++
				i++
			}
			continue
		}
		if inTemplate > 0 && c == '}' {
			inTemplate--
			continue
		}
		if c == '"' || c == '\'' || c == '`' {
			inString = c
			continue
		}
		if c == '/' && i+1 < n && content[i+1] == '/' {
			nl := strings.IndexByte(content[i:], '\n')
			if nl < 0 {
				i = n
			} else {
				i = i + nl
			}
			continue
		}
		if c == '/' && i+1 < n && content[i+1] == '*' {
			end := strings.Index(content[i+2:], "*/")
			if end < 0 {
				i = n
			} else {
				i = i + 2 + end + 1
			}
			continue
		}
		if c == '/' && isRegexContext(content, i) {
			i = skipRegex(content, i)
			continue
		}
		if c == '{' {
			depth++
		} else if c == '}' {
			depth--
			if depth < 0 {
				idx := i
				return &BraceError{Error: "extra-closing-brace", At: &idx}
			}
		}
	}
	if depth != 0 {
		rem := depth
		return &BraceError{Error: "unbalanced-braces", Remaining: &rem}
	}
	return nil
}

var reWordOrCloseBracket = regexp.MustCompile(`[\w$\])]`)

func isRegexContext(source string, slashIdx int) bool {
	for j := slashIdx - 1; j >= 0; j-- {
		c := source[j]
		if c == ' ' || c == '\t' {
			continue
		}
		if c == '\n' {
			return true
		}
		if reWordOrCloseBracket.MatchString(string(c)) {
			return false
		}
		return true
	}
	return true
}

var reFlagChar = regexp.MustCompile(`[gimuysd]`)

func skipRegex(source string, startIdx int) int {
	inClass := false
	escape := false
	n := len(source)
	for i := startIdx + 1; i < n; i++ {
		c := source[i]
		if escape {
			escape = false
			continue
		}
		if c == '\\' {
			escape = true
			continue
		}
		if c == '[' {
			inClass = true
		} else if c == ']' {
			inClass = false
		} else if c == '/' && !inClass {
			j := i + 1
			for j < n && reFlagChar.MatchString(string(source[j])) {
				j++
			}
			return j - 1
		}
		if c == '\n' {
			return i
		}
	}
	return n - 1
}
