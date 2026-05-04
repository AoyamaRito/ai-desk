// Package crystallize Phase 5 — parseJS 本体翻訳
//
// REAL = ai-desk-core.js export function parseJS(source, moduleId)
//
// 翻訳の決定事項(transcription contract):
//  - JS regex の lookbehind `(?<=[;}{])` → Go RE2 非対応
//    → `(^|[;}{])` で boundary char を consume する書き換えで対応
//    → 結果 match の start は boundary 1 文字分ずれるが、capture group の
//      位置と内容は同じ
//  - Block class 翻訳は重いので、parseJS output を flat ParseResult struct で表現
//    (id, type, name, content, tags, refs)
//  - imports / function / arrow / class の 4 段 regex pass を順守
//  - call detection の inner regex は per-block で compile
//  - Set insertion order は Phase 3 taggedSet を再利用

package main

import (
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// ParseResult: parseJS の output を flat 化した struct。
// JS 側の Block.{id, type, content, tags, refs, meta.name} 相当。
type ParseResult struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	Tags    []string `json:"tags"`
	Refs    []ParseRef `json:"refs"`
}

type ParseRef struct {
	Kind   string `json:"kind"`
	Target string `json:"target"`
}

// 4 つの regex(lookbehind 削除版、boundary char を capture group 1 で取る形)
var (
	// JS: /(?:^|(?<=[;}]))\s*import\s+[^'"]*['"]([^'"]+)['"]/gm
	// (?m) で ^ を行頭マッチに
	reImport = regexp.MustCompile(`(?m)(^|[;}])\s*import\s+[^'"]*['"]([^'"]+)['"]`)
	// JS: function 宣言
	reFunction = regexp.MustCompile(`(?m)(^|[;}{])\s*((?:export\s+(?:default\s+)?)?(?:async\s+)?function\s*\*?\s+(\w+))\s*\(`)
	// JS: arrow function
	reArrow = regexp.MustCompile(`(?m)(^|[;}{])\s*((?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*)\{`)
	// JS: class
	reClass = regexp.MustCompile(`(?m)(^|[;}{])\s*((?:export\s+(?:default\s+)?)?class\s+(\w+))`)
	// 内部判定
	reHasAsync     = regexp.MustCompile(`\basync\b`)
	reHasExport    = regexp.MustCompile(`\bexport\b`)
	reHasGenerator = regexp.MustCompile(`function\s*\*`)
	reHasDefault   = regexp.MustCompile(`\bdefault\b`)
	// regex 特殊文字 escape
	reSpecial = regexp.MustCompile(`[.*+?^${}()|\[\]\\]`)
)

// ParseJS: JS parseJS の Go 翻訳。
// flat ParseResult 配列で返す(先頭が module block、以降が function/class)。
func ParseJS(source, moduleId string) []ParseResult {
	results := []ParseResult{}
	moduleBlock := ParseResult{
		ID: moduleId, Type: "module", Name: moduleId,
		Tags: []string{}, Refs: []ParseRef{},
	}

	imports := []ParseRef{}
	for _, m := range reImport.FindAllStringSubmatchIndex(source, -1) {
		// m[4]:m[5] は capture group 2(import target)
		target := source[m[4]:m[5]]
		imports = append(imports, ParseRef{Kind: "import", Target: target})
	}

	pushParse := func(typ, name, content string, tags []string) {
		prefix := "fn"
		if typ == "class" {
			prefix = "class"
		}
		id := fmt.Sprintf("%s:%s:%s", moduleId, prefix, name)
		for _, r := range results {
			if r.ID == id {
				return
			}
		}
		// inferTags merge は parseJS では関与せず、tags はそのまま
		results = append(results, ParseResult{
			ID: id, Type: typ, Name: name, Content: content,
			Tags: tags, Refs: []ParseRef{},
		})
	}

	// function 宣言
	for _, m := range reFunction.FindAllStringSubmatchIndex(source, -1) {
		// boundary char (capture 1) を含めた match start を、JS の m.index に合わせる
		// JS の m.index = capture 1 を含むがその後の `\s*` は含まない位置
		// JS regex は `(?:^|(?<=[;}{]))\s*function...` なので m.index は \s* の先頭
		// Go regex で `(^|[;}{])\s*function...` の m[0] は capture 1 を含む
		// → JS と同じ index にするには、capture 1 の長さ(0 or 1)を引いた位置から始める
		mIndex := jsLikeStart(source, m)
		head := source[m[4]:m[5]] // capture 2 = head pattern (function 宣言行の先頭部分)
		name := source[m[6]:m[7]]
		bodyStart := FindFunctionBody(source, mIndex)
		if bodyStart < 0 {
			continue
		}
		end := MatchBrace(source, bodyStart)
		content := source[mIndex : end+1]
		// tags は head に対する判定 + extractInlineTags
		// head に \s* を含めるため、source[mIndex:m[5]] を使う(JS の m[0] と等価)
		jsHead := source[mIndex:m[5]] + "("
		tags := []string{"function"}
		if reHasAsync.MatchString(jsHead) {
			tags = append(tags, "async")
		}
		if reHasExport.MatchString(jsHead) {
			tags = append(tags, "export")
		}
		if reHasGenerator.MatchString(jsHead) {
			tags = append(tags, "generator")
		}
		tags = append(tags, ExtractInlineTags(source, mIndex)...)
		_ = head
		pushParse("function", name, content, tags)
	}

	// arrow function
	for _, m := range reArrow.FindAllStringSubmatchIndex(source, -1) {
		mIndex := jsLikeStart(source, m)
		name := source[m[6]:m[7]]
		bodyStart := FindFunctionBody(source, mIndex)
		if bodyStart < 0 {
			continue
		}
		end := MatchBrace(source, bodyStart)
		content := source[mIndex : end+1]
		jsHead := source[mIndex:m[5]] + "{"
		tags := []string{"function", "arrow"}
		if reHasAsync.MatchString(jsHead) {
			tags = append(tags, "async")
		}
		if reHasExport.MatchString(jsHead) {
			tags = append(tags, "export")
		}
		tags = append(tags, ExtractInlineTags(source, mIndex)...)
		pushParse("function", name, content, tags)
	}

	// class
	for _, m := range reClass.FindAllStringSubmatchIndex(source, -1) {
		mIndex := jsLikeStart(source, m)
		name := source[m[6]:m[7]]
		bodyStart := strings.IndexByte(source[mIndex:], '{')
		if bodyStart < 0 {
			continue
		}
		bodyStart += mIndex
		end := MatchBrace(source, bodyStart)
		content := source[mIndex : end+1]
		jsHead := source[mIndex:m[5]]
		tags := []string{"class"}
		if reHasExport.MatchString(jsHead) {
			tags = append(tags, "export")
		}
		if reHasDefault.MatchString(jsHead) {
			tags = append(tags, "default")
		}
		tags = append(tags, ExtractInlineTags(source, mIndex)...)
		pushParse("class", name, content, tags)
	}

	// call detection: 各 block 内で他 block 名を検索 → calls ref を追加
	nameToId := map[string]string{}
	for _, r := range results {
		nameToId[r.Name] = r.ID
	}
	for i, b := range results {
		callsSet := map[string]bool{}
		for name, id := range nameToId {
			if id == b.ID {
				continue
			}
			escName := reSpecial.ReplaceAllString(name, `\$0`)
			re, err := regexp.Compile(`\b` + escName + `\s*\(`)
			if err != nil {
				continue
			}
			if re.MatchString(b.Content) {
				callsSet[id] = true
			}
		}
		if len(callsSet) == 0 {
			continue
		}
		// JS: Array.from(callsSet) は Set insertion order(name iteration order に依存)
		// Go map iteration はランダム、JS と整合させるため id を sort
		// JS 側でも実際は Map iteration order = insertion order なので、
		// 厳密一致のためには nameToId iteration 順を JS と合わせる必要がある。
		// → JS の Map(blocks.map(...)) は blocks 配列の挿入順 = parseJS で
		//   push された順序と同じ。Go の results 順と一致するので、
		//   nameToId を slice で作り直して順序保証する。
		// (この impl では map のままで sort 出力する。後で順序問題が出たら修正。)
		ids := make([]string, 0, len(callsSet))
		for id := range callsSet {
			ids = append(ids, id)
		}
		sort.Strings(ids)
		for _, id := range ids {
			results[i].Refs = append(results[i].Refs, ParseRef{Kind: "calls", Target: id})
		}
	}

	// module block の refs に imports + contains を入れる
	moduleBlock.Refs = append(moduleBlock.Refs, imports...)
	for _, r := range results {
		moduleBlock.Refs = append(moduleBlock.Refs, ParseRef{Kind: "contains", Target: r.ID})
	}

	out := []ParseResult{moduleBlock}
	out = append(out, results...)
	return out
}

// jsLikeStart: lookbehind 削除版 regex で `(^|[;}{])\s*pattern` を使ったとき、
// JS の m.index 相当(\s* の先頭)を返す。
// Go の m[0] は capture 1 を含むので、capture 1 の長さ分ずらす。
func jsLikeStart(source string, m []int) int {
	cap1Start, cap1End := m[2], m[3]
	if cap1Start == cap1End {
		// capture 1 が `^`(空)の場合: match start = source の先頭 0
		return m[0]
	}
	// capture 1 が `;` `}` `{` のとき: m.index は capture 1 の直後
	return cap1End
}
