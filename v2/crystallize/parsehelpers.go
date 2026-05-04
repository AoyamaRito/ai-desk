// Package crystallize Phase 4 — parseJS 補助関数群
//
// REAL = ai-desk-core.js
//   - matchPair(source, openIdx, openCh, closeCh)
//   - matchBrace / matchParen
//   - extractInlineTags(source, declStart)
//   - findFunctionBody(source, declStart)
//
// 翻訳の決定事項:
//  - matchPair の string / comment / regex 文脈処理は Phase 3 jsanalysis.go の
//    isRegexContext / skipRegex を再利用
//  - extractInlineTags の Set insertion order は Phase 3 と同じパターン
//  - JS の `lastIndexOf` / `indexOf` は Go strings.LastIndexByte / IndexByte / Index で代替

package main

import (
	"regexp"
	"strings"
)

// MatchPair: JS matchPair の Go 翻訳。
func MatchPair(source string, openIdx int, openCh, closeCh byte) int {
	depth := 0
	var inString byte = 0
	escape := false
	inTemplate := 0
	n := len(source)
	for i := openIdx; i < n; i++ {
		c := source[i]
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
			} else if inString == '`' && c == '$' && i+1 < n && source[i+1] == '{' {
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
		if c == '/' && i+1 < n && source[i+1] == '/' {
			nl := strings.IndexByte(source[i:], '\n')
			if nl < 0 {
				i = n
			} else {
				i = i + nl
			}
			continue
		}
		if c == '/' && i+1 < n && source[i+1] == '*' {
			end := strings.Index(source[i+2:], "*/")
			if end < 0 {
				i = n
			} else {
				i = i + 2 + end + 1
			}
			continue
		}
		if c == '/' && isRegexContext(source, i) {
			i = skipRegex(source, i)
			continue
		}
		if c == openCh {
			depth++
		} else if c == closeCh {
			depth--
			if depth == 0 {
				return i
			}
		}
	}
	return n - 1
}

func MatchBrace(source string, openIdx int) int {
	return MatchPair(source, openIdx, '{', '}')
}

func MatchParen(source string, openIdx int) int {
	return MatchPair(source, openIdx, '(', ')')
}

// FindFunctionBody: JS findFunctionBody の Go 翻訳。
// declStart 以降の `(` を見つけ、引数末尾の後の `{` 位置を返す。見つからなければ -1。
func FindFunctionBody(source string, declStart int) int {
	argStart := strings.IndexByte(source[declStart:], '(')
	if argStart < 0 {
		return -1
	}
	argStart += declStart
	argEnd := MatchParen(source, argStart)
	idx := strings.IndexByte(source[argEnd:], '{')
	if idx < 0 {
		return -1
	}
	return argEnd + idx
}

// ExtractInlineTags: JS extractInlineTags の Go 翻訳。
// declStart より前の最大 20 行を遡り、emblem / @tags pragma を抽出。
var (
	reEmblem = regexp.MustCompile(`\[(?:ai_s_emblem|EMBLEM):([^\s\]]+)\s+\w+`)
	reAtTags = regexp.MustCompile(`@tags\s*[:=]\s*([\w\s,]+)`)
)

func ExtractInlineTags(source string, declStart int) []string {
	t := &taggedSet{}
	lineEnd := strings.LastIndexByte(source[:declStart], '\n')
	for i := 0; i < 20 && lineEnd > 0; i++ {
		lineStart := strings.LastIndexByte(source[:lineEnd], '\n') + 1
		line := source[lineStart:lineEnd]
		if strings.TrimSpace(line) == "" {
			break
		}
		if m := reEmblem.FindStringSubmatch(line); m != nil {
			for _, s := range strings.Split(m[1], "#") {
				if s != "" {
					t.add(s)
				}
			}
		}
		if m := reAtTags.FindStringSubmatch(line); m != nil {
			for _, s := range strings.Split(m[1], ",") {
				s = strings.TrimSpace(s)
				if s != "" {
					t.add(s)
				}
			}
		}
		lineEnd = lineStart - 1
	}
	if t.keys == nil {
		return []string{}
	}
	return t.keys
}
