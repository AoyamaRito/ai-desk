// aijs — minimal JS runtime that runs ESM-flavored .js without Node
//
// 思想:
//   Bible §3 Eternal Compatibility — Node 必須を解除し、自前で握る runtime。
//   1 つの aijs binary を ~/.local/bin/aijs に置けば、shebang `#!/usr/bin/env aijs`
//   付きの .js が単体起動する。runtime install は普通(python / bash と同列)。
//
// 使い方:
//   aijs script.js [args...]
//   ./script.js                      # shebang `#!/usr/bin/env aijs` 付き + chmod +x
//
// 提供する runtime:
//   - console.log / error / warn / info
//   - process.argv / process.exit / process.env / process.cwd
//   - readFileSync / writeFileSync / existsSync(globals に直接、Node の node:fs に近似)
//   - import / export(自前の lazy resolver、規則: 同じ dir の './X.js' のみ)
//
// build:
//   go build -o aijs

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/dop251/goja"
)

// ============================================================
// ESM resolver — main file の import を再帰的に解決して 1 つの flat blob にする
// ============================================================
//
// サポート構文:
//   import { A, B } from './X.js'
//   import { A as Z } from './X.js'
//   import * as X from './X.js'
//   import X from './X.js'
//
// 各 .js は下流ファイルのみで参照される(循環依存は未対応、検出して error)。
// 正規表現ベース、AST は使わない(Bible §3、加えて Zero-Dep)。

// 各 module を IIFE で wrap、export は globalThis.__aijs_mod_<id> namespace 経由。
// これで同名 const(VERSION 等)が collision しない。

var importRE = regexp.MustCompile(`(?m)^\s*import\s+([^;]+?)\s+from\s+['"]([^'"]+)['"]\s*;?\s*$`)
var nodeImportRE = regexp.MustCompile(`(?m)^\s*const\s+(\w+)\s*=\s*await\s+import\s*\(\s*['"]node:[^'"]+['"]\s*\)\s*;?\s*$`)
var exportDeclRE = regexp.MustCompile(`(?m)^export\s+(class|function|const|let|var|async)\s+`)
var exportBraceRE = regexp.MustCompile(`(?m)^export\s*\{([^}]*)\};?\s*$`)
var exportDefaultRE = regexp.MustCompile(`(?m)^export\s+default\s+`)
var exportNameRE = regexp.MustCompile(`(?m)^export\s+(?:class|function|const|let|var|async\s+function)\s+(\w+)`)

type loader struct {
	loaded     map[string]string // abs path → module-id
	emitted    map[string]bool   // モジュールが既に emit 済か
	output     []string          // 順次積む source 片
	stack      []string          // for cycle detection
	idCounter  int
}

func (l *loader) modID(absPath string) string {
	if id, ok := l.loaded[absPath]; ok {
		return id
	}
	l.idCounter++
	id := fmt.Sprintf("m%d", l.idCounter)
	l.loaded[absPath] = id
	return id
}

// resolve: 入口 path を渡すと、依存全て + 入口を IIFE wrap して 1 つの blob にする。
// 戻り値は実行可能な JS 文字列。入口 module の export は globalThis.__aijs_mod_<entryId> 経由でアクセス可能。
func (l *loader) resolve(absPath string) (entryID string, err error) {
	for _, p := range l.stack {
		if p == absPath {
			return "", fmt.Errorf("cyclic import: %s", absPath)
		}
	}
	if l.emitted[absPath] {
		return l.modID(absPath), nil
	}
	l.stack = append(l.stack, absPath)
	defer func() { l.stack = l.stack[:len(l.stack)-1] }()

	rawBytes, err := os.ReadFile(absPath)
	if err != nil {
		return "", fmt.Errorf("read %s: %w", absPath, err)
	}
	src := string(rawBytes)
	// shebang 除去
	if strings.HasPrefix(src, "#!") {
		if nl := strings.Index(src, "\n"); nl > 0 {
			src = src[nl+1:]
		}
	}
	// goja 未対応の top-level `await import(...)` を変換
	// `const fs = await import('node:fs');` → `// aijs: fs is global`
	src = nodeImportRE.ReplaceAllString(src, "/* aijs: $1 is global */")

	id := l.modID(absPath)
	dir := filepath.Dir(absPath)

	// import 文を抽出 + 各 dep を再帰 resolve、その上で import 文を「const {...} = globalThis.__aijs_mod_<depId>;」に置換
	matches := importRE.FindAllStringSubmatchIndex(src, -1)
	if len(matches) > 0 {
		// 後ろから処理してオフセット崩さない
		for i := len(matches) - 1; i >= 0; i-- {
			m := matches[i]
			start, end := m[0], m[1]
			importClause := strings.TrimSpace(src[m[2]:m[3]])
			specifier := src[m[4]:m[5]]
			if !strings.HasPrefix(specifier, "./") && !strings.HasPrefix(specifier, "../") {
				return "", fmt.Errorf("only relative imports supported: %q in %s", specifier, absPath)
			}
			depPath := filepath.Clean(filepath.Join(dir, specifier))
			depID, err := l.resolve(depPath)
			if err != nil {
				return "", err
			}
			binding := importClauseToBinding(importClause, depID)
			src = src[:start] + binding + src[end:]
		}
	}

	// 当 module の export 名を収集(IIFE return で expose する)
	exportNames := collectExportNames(src)
	body := stripExports(src)

	// IIFE wrap
	wrapped := fmt.Sprintf(
		"globalThis.__aijs_mod_%s = (function () {\n%s\nreturn { %s };\n})();",
		id, body, strings.Join(exportNames, ", "),
	)
	l.output = append(l.output, wrapped)
	l.emitted[absPath] = true
	return id, nil
}

// `{ A, B as C } / X / * as X` を runtime binding 文字列に変換
func importClauseToBinding(clause, depID string) string {
	clause = strings.TrimSpace(clause)
	mod := fmt.Sprintf("globalThis.__aijs_mod_%s", depID)
	// `* as X`
	if strings.HasPrefix(clause, "*") {
		parts := strings.SplitN(clause, " as ", 2)
		if len(parts) == 2 {
			return fmt.Sprintf("const %s = %s;", strings.TrimSpace(parts[1]), mod)
		}
	}
	// `{ A, B as C }`
	if strings.HasPrefix(clause, "{") {
		inner := strings.TrimSuffix(strings.TrimPrefix(clause, "{"), "}")
		var pairs []string
		for _, part := range strings.Split(inner, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			if strings.Contains(part, " as ") {
				kv := strings.SplitN(part, " as ", 2)
				orig := strings.TrimSpace(kv[0])
				alias := strings.TrimSpace(kv[1])
				pairs = append(pairs, orig+": "+alias)
			} else {
				pairs = append(pairs, part)
			}
		}
		return fmt.Sprintf("const { %s } = %s;", strings.Join(pairs, ", "), mod)
	}
	// `X`(default import — 簡易: 同名の export を取る)
	return fmt.Sprintf("const %s = %s.default ?? %s;", clause, mod, mod)
}

func collectExportNames(src string) []string {
	seen := map[string]bool{}
	var names []string
	for _, m := range exportNameRE.FindAllStringSubmatch(src, -1) {
		if !seen[m[1]] {
			seen[m[1]] = true
			names = append(names, m[1])
		}
	}
	// `export { A, B as C }` も対応(C は alias 公開、内部 A は値が同じ)
	for _, m := range exportBraceRE.FindAllStringSubmatch(src, -1) {
		for _, part := range strings.Split(m[1], ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			n := part
			if strings.Contains(part, " as ") {
				kv := strings.SplitN(part, " as ", 2)
				n = strings.TrimSpace(kv[1])
			}
			if !seen[n] {
				seen[n] = true
				names = append(names, n)
			}
		}
	}
	return names
}

func stripExports(src string) string {
	src = exportDeclRE.ReplaceAllString(src, "$1 ")
	src = exportBraceRE.ReplaceAllString(src, "")
	src = exportDefaultRE.ReplaceAllString(src, "")
	return src
}

// ============================================================
// Runtime — globals の提供
// ============================================================

func setupRuntime(vm *goja.Runtime, scriptPath string, scriptArgs []string) error {
	// console
	console := vm.NewObject()
	for _, name := range []string{"log", "info", "warn", "error", "debug"} {
		n := name
		_ = console.Set(n, func(args ...interface{}) {
			parts := make([]string, len(args))
			for i, a := range args {
				parts[i] = fmt.Sprint(a)
			}
			out := os.Stdout
			if n == "error" || n == "warn" {
				out = os.Stderr
			}
			fmt.Fprintln(out, strings.Join(parts, " "))
		})
	}
	if err := vm.Set("console", console); err != nil {
		return err
	}

	// process
	proc := vm.NewObject()
	_ = proc.Set("argv", append([]string{"aijs", scriptPath}, scriptArgs...))
	_ = proc.Set("exit", func(code int) { os.Exit(code) })
	_ = proc.Set("cwd", func() string { d, _ := os.Getwd(); return d })
	// process.stdout / stderr — Node 互換の最小サブセット
	stdout := vm.NewObject()
	_ = stdout.Set("write", func(s string) { fmt.Fprint(os.Stdout, s) })
	_ = stdout.Set("isTTY", func() bool { /* MVP: always false */ return false })
	_ = proc.Set("stdout", stdout)
	stderr := vm.NewObject()
	_ = stderr.Set("write", func(s string) { fmt.Fprint(os.Stderr, s) })
	_ = stderr.Set("isTTY", func() bool { return false })
	_ = proc.Set("stderr", stderr)
	envObj := vm.NewObject()
	for _, e := range os.Environ() {
		i := strings.Index(e, "=")
		if i > 0 {
			_ = envObj.Set(e[:i], e[i+1:])
		}
	}
	_ = proc.Set("env", envObj)
	if err := vm.Set("process", proc); err != nil {
		return err
	}

	// fs(最小)— globals に直接 + node:fs 互換 namespace
	fs := vm.NewObject()
	_ = fs.Set("readFileSync", func(p string, enc ...interface{}) interface{} {
		b, err := os.ReadFile(p)
		if err != nil {
			panic(vm.NewGoError(err))
		}
		if len(enc) == 0 {
			// no encoding: return Buffer-like(現状は文字列だけ返す、Buffer は未実装)
			return string(b)
		}
		return string(b)
	})
	_ = fs.Set("writeFileSync", func(p string, content string) {
		if err := os.WriteFile(p, []byte(content), 0644); err != nil {
			panic(vm.NewGoError(err))
		}
	})
	_ = fs.Set("existsSync", func(p string) bool {
		_, err := os.Stat(p)
		return err == nil
	})
	_ = fs.Set("readdirSync", func(p string) []string {
		entries, err := os.ReadDir(p)
		if err != nil {
			panic(vm.NewGoError(err))
		}
		out := make([]string, len(entries))
		for i, e := range entries {
			out[i] = e.Name()
		}
		return out
	})
	if err := vm.Set("fs", fs); err != nil {
		return err
	}
	// グローバルにも(import せず使う場合用)
	for _, name := range []string{"readFileSync", "writeFileSync", "existsSync"} {
		if err := vm.Set(name, fs.Get(name)); err != nil {
			return err
		}
	}

	return nil
}

// ============================================================
// main
// ============================================================

func usage() {
	fmt.Fprintln(os.Stderr, "aijs — minimal JS runtime (no Node required)")
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "usage:")
	fmt.Fprintln(os.Stderr, "  aijs <script.js> [args...]")
	fmt.Fprintln(os.Stderr, "  ./script.js [args...]   (with shebang #!/usr/bin/env aijs)")
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "supported:")
	fmt.Fprintln(os.Stderr, "  - ES2017+ syntax(goja)")
	fmt.Fprintln(os.Stderr, "  - import/export with relative paths('./X.js')")
	fmt.Fprintln(os.Stderr, "  - console.log / process.argv / process.exit / process.env / process.cwd")
	fmt.Fprintln(os.Stderr, "  - readFileSync / writeFileSync / existsSync / readdirSync")
	fmt.Fprintln(os.Stderr, "")
	fmt.Fprintln(os.Stderr, "not yet supported:")
	fmt.Fprintln(os.Stderr, "  - top-level await / dynamic import()")
	fmt.Fprintln(os.Stderr, "  - npm packages / node_modules")
	fmt.Fprintln(os.Stderr, "  - Buffer / streams / child_process / http / etc.")
	os.Exit(2)
}

func main() {
	if len(os.Args) < 2 || os.Args[1] == "-h" || os.Args[1] == "--help" {
		usage()
	}
	scriptPath, err := filepath.Abs(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, "abs path:", err)
		os.Exit(1)
	}
	if _, err := os.Stat(scriptPath); err != nil {
		fmt.Fprintln(os.Stderr, "script not found:", scriptPath)
		os.Exit(1)
	}
	scriptArgs := []string{}
	if len(os.Args) > 2 {
		scriptArgs = os.Args[2:]
	}

	// resolve ESM forest
	l := &loader{loaded: map[string]string{}, emitted: map[string]bool{}}
	entryID, err := l.resolve(scriptPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, "resolve error:", err)
		os.Exit(1)
	}
	// 入口 module の export を top-level に展開(self-display 等から参照可能に)
	bundle := strings.Join(l.output, "\n\n") +
		fmt.Sprintf("\n\n// expose entry exports as top-level identifiers\n"+
			"if (globalThis.__aijs_mod_%s) {\n"+
			"  for (const k of Object.keys(globalThis.__aijs_mod_%s)) {\n"+
			"    globalThis[k] = globalThis.__aijs_mod_%s[k];\n"+
			"  }\n"+
			"}\n", entryID, entryID, entryID)

	// runtime
	vm := goja.New()
	if err := setupRuntime(vm, scriptPath, scriptArgs); err != nil {
		fmt.Fprintln(os.Stderr, "runtime setup:", err)
		os.Exit(1)
	}

	// exec
	if _, err := vm.RunString(bundle); err != nil {
		fmt.Fprintln(os.Stderr, "exec error:", err)
		os.Exit(1)
	}
}
