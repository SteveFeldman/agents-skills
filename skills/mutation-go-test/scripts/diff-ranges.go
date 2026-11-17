//go:build ignore

// Prints the added/changed line ranges of production Go files between a base ref and a head ref,
// so a mutation run can be scoped to what a PR touched and the result can be explained.
// Read-only: only runs `git diff`. No network, no writes.
//
// Usage (from the repo checkout):
//
//	go run diff-ranges.go --base <base-ref> [--head <ref>] [--tests]
//
//	--base   Base branch/commit. The merge-base with --head is used (three-dot diff).
//	--head   Head ref (default HEAD).
//	--tests  Print changed *_test.go files instead (use them with --credit / for the base-tests run).
//
// Output: one `path/file.go:start-end` per range. Excluded: tests, vendor/, testdata/, mocks,
// generated code (*.pb.go, *_gen.go, zz_generated*).
package main

import (
	"bufio"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

var refRe = regexp.MustCompile(`^[\w./~^@-]+$`)

func production(path string) bool {
	if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "_test.go") {
		return false
	}
	segments := strings.Split(path, "/")
	for _, seg := range segments[:len(segments)-1] {
		if seg == "vendor" || seg == "testdata" || seg == "mocks" || seg == "mock" {
			return false
		}
	}
	base := segments[len(segments)-1]
	return !(strings.HasSuffix(base, ".pb.go") || strings.HasSuffix(base, "_gen.go") ||
		strings.HasPrefix(base, "zz_generated") || strings.HasPrefix(base, "mock_"))
}

func main() {
	base := flag.String("base", "", "base ref")
	head := flag.String("head", "HEAD", "head ref")
	tests := flag.Bool("tests", false, "list changed test files")
	flag.Parse()
	if *base == "" || !refRe.MatchString(*base) || !refRe.MatchString(*head) {
		fmt.Fprintln(os.Stderr, "Usage: go run diff-ranges.go --base <ref> [--head <ref>] [--tests]")
		os.Exit(2)
	}
	cmd := exec.Command("git", "diff", "--unified=0", "--no-color", "--no-ext-diff", *base+"..."+*head, "--", "*.go")
	out, err := cmd.StdoutPipe()
	if err != nil {
		panic(err)
	}
	if err := cmd.Start(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	hunk := regexp.MustCompile(`^@@ -\S+ \+(\d+)(?:,(\d+))? @@`)
	file := ""
	seen := map[string]bool{}
	sc := bufio.NewScanner(out)
	sc.Buffer(make([]byte, 1<<20), 16<<20)
	for sc.Scan() {
		line := sc.Text()
		switch {
		case strings.HasPrefix(line, "+++ "):
			file = strings.TrimPrefix(strings.TrimPrefix(line, "+++ "), "b/")
			if file == "/dev/null" {
				file = ""
			}
			if *tests && file != "" && strings.HasSuffix(file, "_test.go") && !seen[file] {
				seen[file] = true
				fmt.Println(file)
			}
		case file != "" && !*tests && production(file):
			if m := hunk.FindStringSubmatch(line); m != nil {
				start, _ := strconv.Atoi(m[1])
				n := 1
				if m[2] != "" {
					n, _ = strconv.Atoi(m[2])
				}
				if n > 0 {
					fmt.Printf("%s:%d-%d\n", file, start, start+n-1)
				}
			}
		}
	}
	if err := cmd.Wait(); err != nil {
		fmt.Fprintln(os.Stderr, "git diff failed:", err)
		os.Exit(1)
	}
}
