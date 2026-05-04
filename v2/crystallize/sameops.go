// Package crystallize Phase 2 — sameArr / sameRefs
//
// 5-stage flow: REAL = ai-desk-core.js sameArr + sameRefs → SHADOW (this file)
//
// JS originals:
//   export function sameArr(a, b) {
//     if (a.length !== b.length) return false;
//     for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
//     return true;
//   }
//
//   export function sameRefs(a, b) {
//     if (a.length !== b.length) return false;
//     const key = r => `${r.kind}:${r.target}`;
//     const aKeys = a.map(key).sort();
//     const bKeys = b.map(key).sort();
//     for (let i = 0; i < aKeys.length; i++) if (aKeys[i] !== bKeys[i]) return false;
//     return true;
//   }
//
// 翻訳の決定事項:
//  - JS の任意要素配列 → Go では []any
//  - JS `===` (strict equality) → Go では reflect.DeepEqual を使わず、
//    numeric / string / nil の simple な等価比較で十分(ai-desk 内で sameArr が
//    呼ばれる対象は string / primitive のみ)
//  - sameRefs の ref は {kind, target} object → Go では map[string]any
//  - JS の Array.sort() は default で string sort → Go では sort.Strings

package main

import (
	"fmt"
	"sort"
)

// SameArr: JS sameArr の Go 翻訳。
// JS `===` を Go 等価で再現するため、両側を Sprint で正規化して比較する。
// JS 側は任意 primitive 比較なので、深い構造は考慮しない(JS と仕様一致)。
func SameArr(a, b []any) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if !strictEqual(a[i], b[i]) {
			return false
		}
	}
	return true
}

// SameRefs: JS sameRefs の Go 翻訳。
// ref は {kind, target} 形の object 想定。
func SameRefs(a, b []any) bool {
	if len(a) != len(b) {
		return false
	}
	aKeys := refKeys(a)
	bKeys := refKeys(b)
	sort.Strings(aKeys)
	sort.Strings(bKeys)
	for i := range aKeys {
		if aKeys[i] != bKeys[i] {
			return false
		}
	}
	return true
}

func refKeys(refs []any) []string {
	out := make([]string, 0, len(refs))
	for _, r := range refs {
		m, _ := r.(map[string]any)
		out = append(out, fmt.Sprintf("%v:%v", m["kind"], m["target"]))
	}
	return out
}

// strictEqual: JS `===` の Go 近似。
// number / string / bool / nil で等価判定。型が違えば false。
// 注: JS の NaN === NaN は false だが、ai-desk core では NaN が登場する
// コンテキストはないので無視して OK(必要になれば対応)。
func strictEqual(a, b any) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	// 型一致チェック: 数値型は float64 / int の両方ありうる
	switch av := a.(type) {
	case string:
		bv, ok := b.(string)
		return ok && av == bv
	case bool:
		bv, ok := b.(bool)
		return ok && av == bv
	case float64:
		bv, ok := b.(float64)
		return ok && av == bv
	case int:
		bv, ok := b.(int)
		return ok && av == bv
	case int64:
		bv, ok := b.(int64)
		return ok && av == bv
	default:
		return fmt.Sprintf("%v", a) == fmt.Sprintf("%v", b)
	}
}
