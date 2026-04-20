//@ order = $A1A0, $DE34, $8689, $8BEB, $AFE6, $DF64, $9D2C
package main

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"
)

//{ 01:Types @mid #core $A1A0
type Chunk struct {
	Type       string   // "section" or "plain"
	SortOrder  string   // "01", "02" 等
	Name       string   // セクション名
	Importance int      // 3(high), 2(mid), 1(low)
	Tags       []string // ["tag1", "tag2"] 等
	UID        string   // 自動生成ID "$XXXX"
	Content    string   // 中身
}

type Metadata struct {
	Order     []string            // 正規順の$UID列
	Bookmarks map[string][]string // bookmark名 -> $UID列
}

// セクション開始行をパースする正規表現
var sectionRegex = regexp.MustCompile(`^//\{\s*(?:([0-9a-zA-Z]+):)?([^\s@#$]+)?(?:\s+@([a-zA-Z0-9]+))?(?:\s+(#[^$]*))?(?:\s*(\$[A-Z0-9]+))?`)

// メタデータ行の正規表現
var metaOrderRegex = regexp.MustCompile(`^//@\s*order\s*=\s*(.+)$`)
var metaBookmarkRegex = regexp.MustCompile(`^//@\s*bookmark:(\w+)\s*=\s*(.+)$`)
//}

//{ 02:Parsing @high #core $DE34
func generateUID() string {
	bytes := make([]byte, 2)
	rand.Read(bytes)
	return "$" + strings.ToUpper(hex.EncodeToString(bytes))
}

func parseHeader(line string) (sortOrder, name string, importance int, tags []string, uid string) {
	matches := sectionRegex.FindStringSubmatch(line)
	if len(matches) == 0 {
		return "", "Unknown", 1, nil, ""
	}

	sortOrder = matches[1]
	name = strings.TrimSpace(matches[2])
	if name == "" {
		name = "Unnamed"
	}

	importanceStr := strings.ToLower(matches[3])
	switch importanceStr {
	case "high", "3":
		importance = 3
	case "mid", "2", "medium":
		importance = 2
	case "low", "1":
		importance = 1
	default:
		importance = 1
	}

	tagsStr := strings.TrimSpace(matches[4])
	if tagsStr != "" {
		tagParts := strings.Split(tagsStr, " ")
		for _, p := range tagParts {
			p = strings.TrimPrefix(strings.TrimSpace(p), "#")
			if p != "" {
				tags = append(tags, p)
			}
		}
	}

	uid = strings.TrimSpace(matches[5])
	return sortOrder, name, importance, tags, uid
}

func parseMetadata(lines []string) Metadata {
	meta := Metadata{
		Bookmarks: make(map[string][]string),
	}

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if matches := metaOrderRegex.FindStringSubmatch(line); len(matches) > 1 {
			parts := strings.Split(matches[1], ",")
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					meta.Order = append(meta.Order, p)
				}
			}
		}

		if matches := metaBookmarkRegex.FindStringSubmatch(line); len(matches) > 2 {
			name := matches[1]
			parts := strings.Split(matches[2], ",")
			var uids []string
			for _, p := range parts {
				p = strings.TrimSpace(p)
				if p != "" {
					uids = append(uids, p)
				}
			}
			meta.Bookmarks[name] = uids
		}
	}

	return meta
}

func parse(filePath string) ([]Chunk, Metadata, []string, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, Metadata{}, nil, err
	}
	defer file.Close()

	var chunks []Chunk
	var currentLines []string
	var metaLines []string
	inSection := false

	var curSortOrder, curName, curUID string
	var curImportance int
	var curTags []string

	scanner := bufio.NewScanner(file)
	const maxCapacity = 16 * 1024 * 1024
	buf := make([]byte, 64*1024)
	scanner.Buffer(buf, maxCapacity)

	for scanner.Scan() {
		line := scanner.Text()
		trimmedLine := strings.TrimSpace(line)

		if strings.HasPrefix(trimmedLine, "//@") {
			metaLines = append(metaLines, trimmedLine)
			continue
		}

		if strings.HasPrefix(trimmedLine, "//{") {
			if !inSection && len(currentLines) > 0 {
				chunks = append(chunks, Chunk{Type: "plain", Content: strings.Join(currentLines, "\n") + "\n"})
				currentLines = nil
			}
			inSection = true
			curSortOrder, curName, curImportance, curTags, curUID = parseHeader(trimmedLine)
			currentLines = append(currentLines, line)
		} else if strings.HasPrefix(trimmedLine, "//}") {
			currentLines = append(currentLines, line)
			chunks = append(chunks, Chunk{
				Type:       "section",
				SortOrder:  curSortOrder,
				Name:       curName,
				Importance: curImportance,
				Tags:       curTags,
				UID:        curUID,
				Content:    strings.Join(currentLines, "\n") + "\n",
			})
			currentLines = nil
			inSection = false
		} else {
			currentLines = append(currentLines, line)
		}
	}

	if len(currentLines) > 0 {
		chunks = append(chunks, Chunk{Type: "plain", Content: strings.Join(currentLines, "\n") + "\n"})
	}

	meta := parseMetadata(metaLines)
	return chunks, meta, metaLines, scanner.Err()
}
//}

//{ 03:Logic @mid #core $8689
func ensureUIDs(chunks []Chunk) []Chunk {
	for i := range chunks {
		if chunks[i].Type == "section" && chunks[i].UID == "" {
			chunks[i].UID = generateUID()
			lines := strings.Split(strings.TrimSuffix(chunks[i].Content, "\n"), "\n")
			if len(lines) > 0 {
				lines[0] = strings.TrimRight(lines[0], " ") + " " + chunks[i].UID
				chunks[i].Content = strings.Join(lines, "\n") + "\n"
			}
		}
	}
	return chunks
}

func extractSections(chunks []Chunk) ([]int, []Chunk) {
	var indices []int
	var sections []Chunk
	for i, c := range chunks {
		if c.Type == "section" {
			indices = append(indices, i)
			sections = append(sections, c)
		}
	}
	return indices, sections
}

func placeSections(chunks []Chunk, indices []int, sortedSections []Chunk) []Chunk {
	result := make([]Chunk, len(chunks))
	copy(result, chunks)
	for i, idx := range indices {
		if i < len(sortedSections) {
			result[idx] = sortedSections[i]
		}
	}
	return result
}
//}

//{ 04:Sorting @mid #core $8BEB
func sortForFocus(chunks []Chunk) []Chunk {
	indices, sections := extractSections(chunks)
	if len(sections) == 0 {
		return chunks
	}

	sort.SliceStable(sections, func(i, j int) bool {
		si, sj := sections[i], sections[j]
		if si.Importance != sj.Importance {
			return si.Importance > sj.Importance
		}
		ti := ""
		if len(si.Tags) > 0 {
			ti = si.Tags[0]
		}
		tj := ""
		if len(sj.Tags) > 0 {
			tj = sj.Tags[0]
		}
		if ti != tj {
			return ti < tj
		}
		return si.SortOrder < sj.SortOrder
	})

	return placeSections(chunks, indices, sections)
}

func sortForSkeleton(chunks []Chunk) []Chunk {
	for i, c := range chunks {
		if c.Type == "section" && c.Importance < 3 { // @mid (2) and @low (1)
			lines := strings.Split(strings.TrimSuffix(c.Content, "\n"), "\n")
			if len(lines) >= 2 {
				header := lines[0]
				footer := lines[len(lines)-1]
				chunks[i].Content = fmt.Sprintf("%s\n  // [Collapsed: %d lines]\n%s\n", header, len(lines)-2, footer)
			}
		}
	}
	return chunks
}

func sortForRestore(chunks []Chunk, meta Metadata) []Chunk {
	indices, sections := extractSections(chunks)
	if len(sections) == 0 {
		return chunks
	}

	if len(meta.Order) > 0 {
		uidIndex := make(map[string]int)
		for i, uid := range meta.Order {
			uidIndex[uid] = i
		}

		sort.SliceStable(sections, func(i, j int) bool {
			ii, oki := uidIndex[sections[i].UID]
			ij, okj := uidIndex[sections[j].UID]
			if oki && okj {
				return ii < ij
			}
			if oki {
				return true
			}
			if okj {
				return false
			}
			return sections[i].SortOrder < sections[j].SortOrder
		})
	} else {
		sort.SliceStable(sections, func(i, j int) bool {
			si, sj := sections[i], sections[j]
			if si.SortOrder != sj.SortOrder {
				if si.SortOrder == "" {
					return false
				}
				if sj.SortOrder == "" {
					return true
				}
				return si.SortOrder < sj.SortOrder
			}
			return si.Name < sj.Name
		})
	}

	return placeSections(chunks, indices, sections)
}

func sortByBookmark(chunks []Chunk, uidOrder []string) []Chunk {
	indices, sections := extractSections(chunks)
	if len(sections) == 0 {
		return chunks
	}

	uidIndex := make(map[string]int)
	for i, uid := range uidOrder {
		uidIndex[uid] = i
	}

	sort.SliceStable(sections, func(i, j int) bool {
		ii, oki := uidIndex[sections[i].UID]
		ij, okj := uidIndex[sections[j].UID]
		if oki && okj {
			return ii < ij
		}
		if oki {
			return true
		}
		if okj {
			return false
		}
		return sections[i].SortOrder < sections[j].SortOrder
	})

	return placeSections(chunks, indices, sections)
}

func getCurrentUIDOrder(chunks []Chunk) []string {
	var uids []string
	for _, c := range chunks {
		if c.Type == "section" && c.UID != "" {
			uids = append(uids, c.UID)
		}
	}
	return uids
}
//}

//{ 05:IO @low $AFE6
func formatMetadata(meta Metadata) string {
	var lines []string

	if len(meta.Order) > 0 {
		lines = append(lines, "//@ order = "+strings.Join(meta.Order, ", "))
	}

	var names []string
	for name := range meta.Bookmarks {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		uids := meta.Bookmarks[name]
		lines = append(lines, fmt.Sprintf("//@ bookmark:%s = %s", name, strings.Join(uids, ", ")))
	}

	if len(lines) > 0 {
		return strings.Join(lines, "\n") + "\n"
	}
	return ""
}

func writeFile(filePath string, chunks []Chunk, meta Metadata) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	metaStr := formatMetadata(meta)
	if metaStr != "" {
		file.WriteString(metaStr)
	}

	for _, c := range chunks {
		file.WriteString(c.Content)
	}

	return nil
}
//}

//{ 06:CLI @high $DF64
func printHelp() {
	fmt.Println(`ai_desk - AI-Native Cognitive Workspace Manager

[Philosophy: The AI-Native Manifesto]
1. Locality over DRY: AI thrives on local context. Fragmentation is the enemy.
2. Single-File Principle: File boundaries are "git casts" (gypsum).
3. Cognitive Boundary Design: Virtual Boundaries (//{ }) over Physical Boundaries (Files).
4. AI_DESK: Organizing the desk for the AI Secretary to work at peak performance.

Usage:
  ai_desk <filename> [mode] [args...]

Modes:
  focus     (Default) Sorts by Importance (@high) and Tags (#tag).
  restore   Restores to original order for clean git diff.
  apply <patch>  Applies section updates from a patch file (matched by $UID).
  skeleton  Collapses @mid and @low sections to save tokens for AI.
  init      Interactive assistant to add sections to a plain file.
  test      Parses and prints structure without modifying.

Bookmarks:
  ai_desk <filename> << <name>   Save current order as bookmark
  ai_desk <filename> >> <name>   Load bookmark order
  ai_desk <filename> list        Show all bookmarks

Section Format:
  // { [SortOrder]:[Name] @[Importance] #[Tag] $[UID]
  // ... code ...
  // }

Placeholder Mode:
  Plain text (HTML tags, etc.) stays FIXED in position.
  Only section contents are swapped between slots.
  This preserves any surrounding structure (HTML, Markdown, etc.).

Examples:
  ai_desk app.js              # Focus mode
  ai_desk app.js restore      # Restore for git commit
  ai_desk app.js apply ai.txt # Apply AI-generated fixes from ai.txt
  ai_desk app.js << auth      # Save current as "auth"
  ai_desk app.js >> auth      # Load "auth" bookmark
`)
}
//}

//{ 07:Main @high #core $9D2C
func main() {

	if len(os.Args) < 2 || os.Args[1] == "-h" || os.Args[1] == "--help" {
		printHelp()
		return
	}

	filePath := os.Args[1]
	mode := "focus"
	var extraArgs []string

	if len(os.Args) >= 3 {
		arg2 := os.Args[2]
		if arg2 == "<<" && len(os.Args) >= 4 {
			mode = "save"
			extraArgs = []string{os.Args[3]}
		} else if arg2 == ">>" && len(os.Args) >= 4 {
			mode = "load"
			extraArgs = []string{os.Args[3]}
		} else {
			mode = arg2
			if len(os.Args) > 3 {
				extraArgs = os.Args[3:]
			}
		}
	}

	chunks, meta, _, err := parse(filePath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing file %s: %v\n", filePath, err)
		os.Exit(1)
	}

	chunks = ensureUIDs(chunks)

	if len(meta.Order) == 0 {
		meta.Order = getCurrentUIDOrder(chunks)
	}
	if meta.Bookmarks == nil {
		meta.Bookmarks = make(map[string][]string)
	}

	if mode == "test" {
		for i, c := range chunks {
			if c.Type == "section" {
				fmt.Printf("[%d] Type: %s, Order: %q, Name: %q, Importance: %d, Tags: %v, UID: %s\n",
					i, c.Type, c.SortOrder, c.Name, c.Importance, c.Tags, c.UID)
			} else {
				fmt.Printf("[%d] Type: %s\n", i, c.Type)
			}
		}
		fmt.Println("\nMetadata:")
		fmt.Printf("  Order: %v\n", meta.Order)
		fmt.Printf("  Bookmarks: %v\n", meta.Bookmarks)
		return
	}

	if mode == "list" {
		fmt.Printf("Bookmarks in %s:\n", filePath)
		if len(meta.Bookmarks) == 0 {
			fmt.Println("  (none)")
		} else {
			for name, uids := range meta.Bookmarks {
				fmt.Printf("  %-12s (%d sections)\n", name, len(uids))
			}
		}
		return
	}

	var outputChunks []Chunk

	switch mode {
	case "init":
		// インタラクティブ初期化
		file, err := os.Open(filePath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error opening file: %v\n", err)
			os.Exit(1)
		}
		
		var lines []string
		scanner := bufio.NewScanner(file)
		for scanner.Scan() {
			lines = append(lines, scanner.Text())
		}
		file.Close()

		declRegex := regexp.MustCompile(`^(?:export\s+)?(?:func|function|const|let|var|class|type)\s+([a-zA-Z0-9_]+)`)
		
		fmt.Println("=== Interactive Section Init ===")
		fmt.Println("Scanning for declarations. Press 'y' to wrap in a section, 'n' to skip, 'q' to quit.")
		
		var newLines []string
		inAutoSection := false
		reader := bufio.NewReader(os.Stdin)
		sectionCount := 1

		for i := 0; i < len(lines); i++ {
			line := lines[i]
			
			// すでにセクション内ならスキップ判定などはしないが、今回は単純なプレーンテキストを想定
			if strings.HasPrefix(strings.TrimSpace(line), "//{") {
				inAutoSection = true
				newLines = append(newLines, line)
				continue
			}
			if strings.HasPrefix(strings.TrimSpace(line), "//}") {
				inAutoSection = false
				newLines = append(newLines, line)
				continue
			}

			if !inAutoSection {
				if matches := declRegex.FindStringSubmatch(line); len(matches) > 1 {
					name := matches[1]
					fmt.Printf("\n[Line %d] %s\n", i+1, strings.TrimSpace(line))
					fmt.Printf("Create section '%s'? [y/N/q]: ", name)
					
					ans, _ := reader.ReadString('\n')
					ans = strings.ToLower(strings.TrimSpace(ans))
					
					if ans == "q" {
						break
					} else if ans == "y" {
						fmt.Printf("Importance (3=high, 2=mid, 1=low) [2]: ")
						imp, _ := reader.ReadString('\n')
						imp = strings.TrimSpace(imp)
						impStr := "@mid"
						if imp == "3" { impStr = "@high" }
						if imp == "1" { impStr = "@low" }

						orderStr := fmt.Sprintf("%02d", sectionCount)
						uid := generateUID()
						header := fmt.Sprintf("//{ %s:%s %s %s", orderStr, name, impStr, uid)
						
						newLines = append(newLines, header)
						newLines = append(newLines, line)
						inAutoSection = true
						sectionCount++
						continue
					}
				}
			}

			// 自動セクション内で空行が来たらセクションを閉じる（簡易的な推測）
			if inAutoSection && strings.TrimSpace(line) == "" {
				newLines = append(newLines, "//}")
				newLines = append(newLines, line)
				inAutoSection = false
				continue
			}

			newLines = append(newLines, line)
		}

		if inAutoSection {
			newLines = append(newLines, "//}")
		}

		err = os.WriteFile(filePath, []byte(strings.Join(newLines, "\n")+"\n"), 0644)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error writing file: %v\n", err)
		}
		fmt.Println("\nInit complete! Run 'cog-sort restore' to normalize.")
		return // initは独自フローで終了

	case "focus":
		outputChunks = sortForFocus(chunks)
	case "restore":
		outputChunks = sortForRestore(chunks, meta)
	case "save":
		bookmarkName := extraArgs[0]
		meta.Bookmarks[bookmarkName] = getCurrentUIDOrder(chunks)
		outputChunks = chunks
		fmt.Printf("Bookmark '%s' saved.\n", bookmarkName)
	case "load":
		bookmarkName := extraArgs[0]
		if uids, ok := meta.Bookmarks[bookmarkName]; ok {
			outputChunks = sortByBookmark(chunks, uids)
			fmt.Printf("Bookmark '%s' loaded.\n", bookmarkName)
		} else {
			fmt.Fprintf(os.Stderr, "Bookmark '%s' not found.\n", bookmarkName)
			os.Exit(1)
		}
	case "skeleton":
		// AI用に重要度順にソート（仮想的）してからスケルトン化
		focusedChunks := sortForFocus(chunks)
		outputChunks = sortForSkeleton(focusedChunks)
		metaStr := formatMetadata(meta)
		if metaStr != "" {
			fmt.Print(metaStr)
		}
		for _, c := range outputChunks {
			fmt.Print(c.Content)
		}
		// ファイルは上書きせず終了
		return
	case "apply":
		if len(extraArgs) < 1 {
			fmt.Fprintln(os.Stderr, "Usage: cog-sort <file> apply <patch_file>")
			os.Exit(1)
		}
		patchPath := extraArgs[0]
		patchChunks, _, _, err := parse(patchPath)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error parsing patch file %s: %v\n", patchPath, err)
			os.Exit(1)
		}

		// Patchマップの作成 (UID優先, 名前フォールバック用)
		patchUIDMap := make(map[string]Chunk)
		patchNameMap := make(map[string]Chunk)
		for _, pc := range patchChunks {
			if pc.Type == "section" {
				if pc.UID != "" {
					patchUIDMap[pc.UID] = pc
				}
				if pc.Name != "" && pc.Name != "Unnamed" && pc.Name != "Unknown" {
					patchNameMap[pc.Name] = pc
				}
			}
		}

		appliedCount := 0
		for i, c := range chunks {
			if c.Type != "section" {
				continue
			}

			applied := false
			// 1. UIDでマッチング
			if c.UID != "" {
				if pc, ok := patchUIDMap[c.UID]; ok {
					chunks[i] = pc
					applied = true
				}
			}

			// 2. 名前でマッチング（UIDで未適用かつ名前が有効な場合）
			if !applied && c.Name != "" && c.Name != "Unnamed" && c.Name != "Unknown" {
				if pc, ok := patchNameMap[c.Name]; ok {
					chunks[i] = pc
					applied = true
					fmt.Printf("  Notice: Matched section %q by Name (UID was missing or mismatched)\n", c.Name)
				}
			}

			if applied {
				appliedCount++
			}
		}

		if appliedCount == 0 {
			fmt.Println("No matching sections found in patch. Check UIDs and section names.")
		} else {
			outputChunks = chunks
			fmt.Printf("Successfully applied %d sections from %s.\n", appliedCount, patchPath)
		}

	default:
		fmt.Fprintf(os.Stderr, "Unknown mode: %s\n\n", mode)
		printHelp()
		os.Exit(1)
	}

	if err := writeFile(filePath, outputChunks, meta); err != nil {
		fmt.Fprintf(os.Stderr, "Error writing file: %v\n", err)
		os.Exit(1)
	}

	if mode == "focus" || mode == "restore" || mode == "load" || mode == "apply" {
		fmt.Printf("File %s processed in %s mode.\n", filePath, mode)
	}
}
//}
