//go:build ignore

// Summarizes a Gooze reports directory (`.gooze-reports/` or `.gooze-reports/run/`) into stable findings,
// scores, and (optionally) a per-mutant delta against a second reports directory.
// Read-only: reads the report YAML files; with --origin-ref it also runs `git show <ref>:<file>`.
// No network, no writes.
//
// Usage:
//
//	go run summarize-mutants.go --report <reports-dir> [--compare <other-dir>]
//	     [--credit <test-file>]... [--findings <mutation-findings.json>] [--origin-ref <base-ref>]
//	     [--repo <dir>] [--only <path-substring>]... [--format md|json]
//
//	--report      Reports directory to summarize. A --diff, --run or --mutagens run writes to
//	              <output>/run; point at that directory. Sharded runs: merge first (`gooze report merge`).
//	--compare     Earlier reports directory for the SAME source revision and scope (e.g. base-branch tests,
//	              or the run before a proposed fix). Deltas: newly-killed, still-surviving, no-longer-killed.
//	--credit      Test file(s) changed by the PR. With --compare, the newly-killed mutants are credited
//	              to them. Gooze does not record WHICH test killed a mutant, so credit is file-level.
//	--findings    Triaged findings file. Mutants classified equivalent/defensive/cosmetic (matched by id)
//	              are excluded from the "actionable" score.
//	--origin-ref  Base ref (merge-base). Tags each unkilled mutant "new" or "pre-existing": pre-existing
//	              means the mutated line already existed in the base file (whitespace/gofmt/trailing-comma
//	              differences ignored). Renamed identifiers count as "new". Run from the repo checkout.
//	--repo        Repo dir for --origin-ref (default ".").
//	--only        Keep only files whose path contains this substring (repeatable).
//
// Scores (same as Gooze): score = killed / (all mutants - error).
// survived, not_covered, timeout and skipped count against the score; error (does not compile) is excluded.
// Report format: one YAML file per mutant (status as an integer, the diff as a byte list), plus
// _index.yaml and _selection.json, which this helper reads only for the run scope.
package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

type multi []string

func (m *multi) String() string     { return strings.Join(*m, ",") }
func (m *multi) Set(v string) error { *m = append(*m, v); return nil }

// Status integers as stored in report files (pkg/report TestStatus).
var statusNames = map[int]string{0: "killed", 1: "survived", 2: "skipped", 3: "timeout", 4: "error", 5: "not_covered"}

type mutant struct {
	ID       string `json:"id"`
	File     string `json:"file"`
	Line     int    `json:"line"`
	Mutagen  string `json:"mutagen"`
	Status   string `json:"status"`
	Original string `json:"original,omitempty"`
	Mutated  string `json:"mutated,omitempty"`
	TestFile string `json:"testFileChosenByGooze,omitempty"`
	Origin   string `json:"origin,omitempty"`
	Class    string `json:"classification,omitempty"`
	State    string `json:"state,omitempty"`
}

type scoreT struct {
	Total    int      `json:"total"`
	Killed   int      `json:"killed"`
	Unkilled int      `json:"unkilled"`
	Score    *float64 `json:"score"`
}

var unkilled = map[string]bool{"survived": true, "not_covered": true, "timeout": true, "skipped": true}
var notActionable = map[string]bool{"equivalent": true, "defensive": true, "cosmetic": true}
var refRe = regexp.MustCompile(`^[\w./~^@-]+$`)
var hunkRe = regexp.MustCompile(`^@@ -(\d+)`)

type rawMutant struct {
	id      string
	mutagen string
	status  int
}

// parseReport reads one report file. The format is regular enough to read line by line.
func parseReport(path string) (file, testFile string, line int, diff string, raws []rawMutant, ok bool) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 1<<20), 16<<20)
	section := ""
	var cur *rawMutant
	var diffBytes []byte
	inDiff := false
	for sc.Scan() {
		l := sc.Text()
		trim := strings.TrimSpace(l)
		if inDiff {
			if strings.HasPrefix(trim, "- ") {
				if n, err := strconv.Atoi(strings.TrimSpace(trim[2:])); err == nil {
					diffBytes = append(diffBytes, byte(n))
					continue
				}
			}
			inDiff = false
		}
		switch {
		case l == "diff:":
			inDiff = true
		case strings.HasPrefix(l, "line: "):
			line, _ = strconv.Atoi(strings.TrimPrefix(l, "line: "))
		case trim == "origin:":
			section = "origin"
		case trim == "test:":
			section = "test"
		case strings.HasPrefix(trim, "shortpath: "):
			v := strings.TrimPrefix(trim, "shortpath: ")
			if section == "origin" && file == "" {
				file = v
			} else if section == "test" && testFile == "" {
				testFile = v
			}
		case strings.HasPrefix(trim, "- name: "):
			raws = append(raws, rawMutant{mutagen: strings.TrimPrefix(trim, "- name: "), status: -1})
			cur = nil
		case strings.HasPrefix(trim, "- mutationid: ") && len(raws) > 0:
			raws[len(raws)-1].id = strings.TrimPrefix(trim, "- mutationid: ")
			cur = &raws[len(raws)-1]
		case strings.HasPrefix(trim, "mutationid: ") && len(raws) > 0:
			raws[len(raws)-1].id = strings.TrimPrefix(trim, "mutationid: ")
			cur = &raws[len(raws)-1]
		case strings.HasPrefix(trim, "status: ") && cur != nil:
			cur.status, _ = strconv.Atoi(strings.TrimPrefix(trim, "status: "))
		}
	}
	return file, testFile, line, string(diffBytes), raws, file != "" && len(raws) > 0
}

// changeFromDiff returns the removed and added code of a unified diff, and the first hunk's changed line.
func changeFromDiff(diff string) (orig, mutated string, line int) {
	var rem, add []string
	hunkStart, offset := 0, 0
	for _, l := range strings.Split(diff, "\n") {
		switch {
		case strings.HasPrefix(l, "---") || strings.HasPrefix(l, "+++"):
		case hunkRe.MatchString(l):
			hunkStart, _ = strconv.Atoi(hunkRe.FindStringSubmatch(l)[1])
			offset = 0
		case strings.HasPrefix(l, "-"):
			if len(rem) == 0 && line == 0 {
				line = hunkStart + offset
			}
			rem = append(rem, strings.TrimSpace(l[1:]))
			offset++
		case strings.HasPrefix(l, "+"):
			add = append(add, strings.TrimSpace(l[1:]))
		case strings.HasPrefix(l, " "):
			offset++
		}
	}
	orig = truncate(strings.Join(rem, " ⏎ "), 160)
	mutated = truncate(strings.Join(add, " ⏎ "), 160)
	if mutated == "" && orig != "" {
		mutated = "(line removed)"
	}
	return
}

func load(dir string, only []string) (map[string]*mutant, []string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		fatal(err)
	}
	out := map[string]*mutant{}
	var warnings []string
	for _, e := range entries {
		n := e.Name()
		if e.IsDir() || strings.HasPrefix(n, "_") || filepath.Ext(n) != ".yaml" {
			continue
		}
		file, testFile, line, diff, raws, ok := parseReport(filepath.Join(dir, n))
		if !ok || (len(only) > 0 && !anyContains(file, only)) {
			continue
		}
		orig, mutated, dline := changeFromDiff(diff)
		if line == 0 {
			line = dline
		}
		for _, r := range raws {
			st, known := statusNames[r.status]
			if !known {
				warnings = append(warnings, fmt.Sprintf("%s: unknown status %d, treated as survived", n, r.status))
				st = "survived"
			}
			id := "MT-" + truncate(r.id, 10)
			out[id] = &mutant{ID: id, File: file, Line: line, Mutagen: r.mutagen, Status: st, Original: orig, Mutated: mutated, TestFile: testFile}
		}
	}
	if len(out) == 0 {
		warnings = append(warnings, "no mutants read from "+dir+" (wrong directory? --diff/--run/--mutagens runs write to <output>/run)")
	}
	if _, err := os.Stat(filepath.Join(dir, "_partial.json")); err == nil {
		warnings = append(warnings, dir+" has _partial.json: the run stopped early (fail-fast or interrupt); the score covers only the mutants that ran")
	}
	return out, warnings
}

func anyContains(s string, subs []string) bool {
	for _, x := range subs {
		if strings.Contains(s, x) {
			return true
		}
	}
	return false
}

func truncate(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

func score(ms []*mutant) scoreT {
	var s scoreT
	for _, m := range ms {
		switch {
		case m.Status == "error":
		case m.Status == "killed":
			s.Total++
			s.Killed++
		default:
			s.Total++
			s.Unkilled++
		}
	}
	if s.Total > 0 {
		v := float64(int(10000*float64(s.Killed)/float64(s.Total)+0.5)) / 100
		s.Score = &v
	}
	return s
}

func pct(s scoreT) string {
	if s.Score == nil {
		return "100% (no scorable mutants)"
	}
	return fmt.Sprintf("%v%%", *s.Score)
}

var normRe = regexp.MustCompile(`\s+`)

func norm(s string) string {
	return strings.TrimRight(normRe.ReplaceAllString(s, ""), ",;")
}

func baseLines(repo, ref, file string) map[string]bool {
	out, err := exec.Command("git", "-C", repo, "show", ref+":"+file).Output()
	if err != nil {
		return nil // file added by the PR
	}
	set := map[string]bool{}
	sc := bufio.NewScanner(strings.NewReader(string(out)))
	sc.Buffer(make([]byte, 1<<20), 16<<20)
	for sc.Scan() {
		set[norm(sc.Text())] = true
	}
	return set
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(2)
}

func readSelection(dir string) map[string]any {
	data, err := os.ReadFile(filepath.Join(dir, "_selection.json"))
	if err != nil {
		return nil
	}
	var sel map[string]any
	if json.Unmarshal(data, &sel) != nil {
		return nil
	}
	return sel
}

func main() {
	var credit, only multi
	reportPath := flag.String("report", "", "")
	comparePath := flag.String("compare", "", "")
	findingsPath := flag.String("findings", "", "")
	originRef := flag.String("origin-ref", "", "")
	repo := flag.String("repo", ".", "")
	format := flag.String("format", "md", "")
	flag.Var(&credit, "credit", "")
	flag.Var(&only, "only", "")
	flag.Parse()
	if *reportPath == "" || (*format != "md" && *format != "json") {
		fmt.Fprintln(os.Stderr, "Usage: go run summarize-mutants.go --report <reports-dir> [--compare old-dir] [--credit test.go]... [--findings json] [--origin-ref ref] [--repo dir] [--only substr]... [--format md|json]")
		os.Exit(2)
	}
	if *originRef != "" && !refRe.MatchString(*originRef) {
		fatal(fmt.Errorf("refusing suspicious ref: %s", *originRef))
	}

	classOf := map[string]string{}
	if *findingsPath != "" {
		data, err := os.ReadFile(*findingsPath)
		if err != nil {
			fatal(err)
		}
		var ff struct {
			Findings []struct{ ID, Classification string } `json:"findings"`
		}
		if err := json.Unmarshal(data, &ff); err != nil {
			fatal(err)
		}
		for _, f := range ff.Findings {
			classOf[f.ID] = f.Classification
		}
	}

	cur, warnings := load(*reportPath, only)
	selection := readSelection(*reportPath)
	all := make([]*mutant, 0, len(cur))
	for _, m := range cur {
		all = append(all, m)
	}
	sort.Slice(all, func(i, j int) bool {
		if all[i].File != all[j].File {
			return all[i].File < all[j].File
		}
		if all[i].Line != all[j].Line {
			return all[i].Line < all[j].Line
		}
		return all[i].ID < all[j].ID
	})

	byFile := map[string][]*mutant{}
	var fileOrder []string
	for _, m := range all {
		if _, ok := byFile[m.File]; !ok {
			fileOrder = append(fileOrder, m.File)
		}
		byFile[m.File] = append(byFile[m.File], m)
	}
	isActionable := func(m *mutant) bool { return !(unkilled[m.Status] && notActionable[classOf[m.ID]]) }
	filterActionable := func(ms []*mutant) []*mutant {
		var r []*mutant
		for _, m := range ms {
			if isActionable(m) {
				r = append(r, m)
			}
		}
		return r
	}

	type fileRow struct {
		File       string  `json:"file"`
		Score      scoreT  `json:"score"`
		Actionable *scoreT `json:"actionable,omitempty"`
	}
	var files []fileRow
	for _, f := range fileOrder {
		row := fileRow{File: f, Score: score(byFile[f])}
		if *findingsPath != "" {
			a := score(filterActionable(byFile[f]))
			row.Actionable = &a
		}
		files = append(files, row)
	}

	counts := map[string]int{}
	for _, m := range all {
		counts[m.Status]++
	}

	baseCache := map[string]map[string]bool{}
	var findings []*mutant
	for _, m := range all {
		if !unkilled[m.Status] {
			continue
		}
		m.State = "open"
		m.Class = classOf[m.ID]
		if m.Class == "" {
			m.Class = "untriaged"
		}
		if *originRef != "" {
			set, ok := baseCache[m.File]
			if !ok {
				set = baseLines(*repo, *originRef, m.File)
				baseCache[m.File] = set
			}
			m.Origin = "new"
			if set != nil && m.Original != "" && set[norm(strings.Split(m.Original, " ⏎ ")[0])] {
				m.Origin = "pre-existing"
			}
		}
		findings = append(findings, m)
	}

	type delta struct {
		NewlyKilled, StillSurviving, NoLongerKilled, OnlyInCurrent, OnlyInCompare []string
		CompareScore                                                              scoreT
	}
	var d *delta
	if *comparePath != "" {
		old, w := load(*comparePath, only)
		warnings = append(warnings, w...)
		d = &delta{NewlyKilled: []string{}, StillSurviving: []string{}, NoLongerKilled: []string{}, OnlyInCurrent: []string{}, OnlyInCompare: []string{}}
		for _, m := range all {
			if m.Status == "error" {
				continue
			}
			o, ok := old[m.ID]
			switch {
			case !ok:
				d.OnlyInCurrent = append(d.OnlyInCurrent, m.ID)
			case o.Status == "error":
			case unkilled[o.Status] && m.Status == "killed":
				d.NewlyKilled = append(d.NewlyKilled, m.ID)
			case unkilled[o.Status] && unkilled[m.Status]:
				d.StillSurviving = append(d.StillSurviving, m.ID)
			case o.Status == "killed" && unkilled[m.Status]:
				d.NoLongerKilled = append(d.NoLongerKilled, m.ID)
			}
		}
		var oldAll []*mutant
		for id, o := range old {
			oldAll = append(oldAll, o)
			if _, ok := cur[id]; !ok {
				d.OnlyInCompare = append(d.OnlyInCompare, id)
			}
		}
		d.CompareScore = score(oldAll)
		for _, s := range [][]string{d.NewlyKilled, d.StillSurviving, d.NoLongerKilled, d.OnlyInCurrent, d.OnlyInCompare} {
			sort.Strings(s)
		}
		if len(d.OnlyInCurrent)+len(d.OnlyInCompare) > 0 {
			warnings = append(warnings, "mutant IDs hash the whole mutated file, so they differ between runs on different source; onlyInCurrent/onlyInCompare mean the sources or scopes differ (or a mutant is new/gone). Compare runs on the same source revision.")
		}
	}

	overall := score(all)
	var overallAct *scoreT
	if *findingsPath != "" {
		a := score(filterActionable(all))
		overallAct = &a
	}

	if *format == "json" {
		out := map[string]any{
			"report": *reportPath, "compare": nilIfEmpty(*comparePath), "originRef": nilIfEmpty(*originRef),
			"selection": selection, "overall": overall, "overallActionable": overallAct, "statusCounts": counts,
			"files": files, "findings": findings, "credit": credit, "delta": d, "warnings": warnings,
		}
		enc := json.NewEncoder(os.Stdout)
		enc.SetIndent("", "  ")
		_ = enc.Encode(out)
		return
	}

	esc := func(s string) string { return strings.NewReplacer("|", "\\|", "`", "'").Replace(s) }
	fmt.Printf("## Mutation summary\n\nOverall: %s (%d killed / %d scorable; scorable = all mutants - errors; timeouts are not kills)\n", pct(overall), overall.Killed, overall.Total)
	if overallAct != nil {
		fmt.Printf("Actionable: %s (%d/%d; excludes equivalent/defensive/cosmetic)\n", pct(*overallAct), overallAct.Killed, overallAct.Total)
	}
	fmt.Printf("Statuses: killed %d, survived %d, not covered %d, timeout %d, skipped %d, error (excluded) %d\n",
		counts["killed"], counts["survived"], counts["not_covered"], counts["timeout"], counts["skipped"], counts["error"])
	if selection != nil {
		b, _ := json.Marshal(selection)
		fmt.Printf("Run scope: %s\n", b)
	}
	if counts["timeout"] > 0 && counts["timeout"] >= overall.Total-counts["error"]-counts["skipped"] {
		fmt.Println("\n> WARNING: every tested mutant timed out. Raise --mutation-timeout or lower --parallel; treat this run as inconclusive.")
	}
	for _, w := range warnings {
		fmt.Println("\n> WARNING:", w)
	}
	hdr := "| File | Mutants | Killed | Unkilled | Errors | Score |"
	sep := "|---|---|---|---|---|---|"
	if overallAct != nil {
		hdr += " Actionable |"
		sep += "---|"
	}
	fmt.Printf("\n%s\n%s\n", hdr, sep)
	for _, f := range files {
		errs := 0
		for _, m := range byFile[f.File] {
			if m.Status == "error" {
				errs++
			}
		}
		row := fmt.Sprintf("| %s | %d | %d | %d | %d | %s |", f.File, f.Score.Total, f.Score.Killed, f.Score.Unkilled, errs, pct(f.Score))
		if f.Actionable != nil {
			row += fmt.Sprintf(" %s (%d/%d) |", pct(*f.Actionable), f.Actionable.Killed, f.Actionable.Total)
		}
		fmt.Println(row)
	}
	fmt.Printf("\n## Findings (%d unkilled)\n\n| ID | Location | Mutagen | Status |", len(findings))
	if *originRef != "" {
		fmt.Print(" Origin |")
	}
	fmt.Print(" Class | Original | Mutated |\n|---|---|---|---|")
	if *originRef != "" {
		fmt.Print("---|")
	}
	fmt.Println("---|---|---|")
	for _, f := range findings {
		fmt.Printf("| %s | %s:%d | %s | %s |", f.ID, f.File, f.Line, f.Mutagen, f.Status)
		if *originRef != "" {
			fmt.Printf(" %s |", f.Origin)
		}
		fmt.Printf(" %s | `%s` | `%s` |\n", f.Class, esc(f.Original), esc(f.Mutated))
	}
	fmt.Print("\n## Test credit\n\n")
	if d == nil {
		fmt.Println("Gooze does not record which test killed a mutant. Pass --compare (base-tests run) with --credit <test files> for file-level credit.")
	} else {
		fmt.Printf("Newly killed vs %s: %d", *comparePath, len(d.NewlyKilled))
		if len(credit) > 0 {
			fmt.Printf(" (credited to %s)", strings.Join(credit, ", "))
		}
		fmt.Println()
		for _, id := range d.NewlyKilled {
			m := cur[id]
			fmt.Printf("- %s %s:%d %s\n", id, m.File, m.Line, m.Mutagen)
		}
	}
	if d != nil {
		fmt.Printf("\n## Delta vs %s\n\nCompare score: %s -> current: %s\n", *comparePath, pct(d.CompareScore), pct(overall))
		for _, kv := range []struct {
			k string
			v []string
		}{{"newlyKilled", d.NewlyKilled}, {"stillSurviving", d.StillSurviving}, {"noLongerKilled", d.NoLongerKilled}, {"onlyInCurrent", d.OnlyInCurrent}, {"onlyInCompare", d.OnlyInCompare}} {
			extra := ""
			if len(kv.v) > 0 {
				extra = " (" + strings.Join(kv.v, ", ") + ")"
			}
			fmt.Printf("- %s: %d%s\n", kv.k, len(kv.v), extra)
		}
	}
}

func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}
