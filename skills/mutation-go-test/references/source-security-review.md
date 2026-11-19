# Source and supply-chain review: Gooze

Reviewed before adopting Gooze (gooze.dev) as the engine for this skill. Source read: `gooze.dev/pkg/gooze@v1.6.1` in the Go module cache.

| Item | Finding | Decision |
|---|---|---|
| `gooze.dev/pkg/gooze` | Open source (MIT), repo `gooze-dev/gooze`. Vanity import path `gooze.dev` resolved through the Go module proxy and verified against the Go checksum database. Latest tag at review time: `v1.6.1`. **Young project with very few stars and a single-maintainer feel**: less community vetting than older tools. | Adopted, pinned to `v1.6.1`; re-review the diff before bumping |
| Install method | `GOBIN=<ws>/bin go install gooze.dev/pkg/gooze@v1.6.1`. No install scripts run. Avoids `curl \| sh`, Homebrew taps and `@latest`. The README's `@latest` is not used. | Adopted |
| Dependencies | `go version -m` shows a small tree (e.g. `atotto/clipboard`, `goccy/go-json`, `mattn/go-colorable`, `xo/terminfo`). | Spot-check with `go version -m <bin>` after install |
| Network | Only two paths import `net/http`: `release_checker.go` (a GET to `proxy.golang.org/gooze.dev/pkg/gooze/@latest` at run time) and `oci_registry.go` (`gooze report push` / `pull`, only when you run them). No telemetry code found. | Set `no_update_check: true` (or `--no-update-check`); never run `report push`/`pull` without approval |
| Workspace | Default `--workspace overlay` builds mutants with `go test -overlay`, so the working tree is never edited or copied. `deep-copy` copies the module to a temp dir. | Keep `overlay` |
| Writes | Reports in `.gooze-reports/` and a log in `.gooze.log` under the current directory, plus a persistent Go build cache in the user cache dir (`~/Library/Caches/gooze` or `~/.cache/gooze`, default cap 2 GiB) that Gooze wires in through `GOCACHEPROG` pointing at its own binary. | Redirect reports/logs with `-o`, `--log-output` (the template does) and run in a clone; use `--go-cache shared` to avoid the extra cache |
| Config | `./gooze.yaml` and `GOOZE_*` env vars are read; there is no `--config` flag. A stray `GOOZE_*` variable or a repo-owned `gooze.yaml` can change behavior. | Check `gooze config show` (SOURCE column) before a run |
| Code execution | Gooze runs the repo's tests, i.e. arbitrary repo code (including `init()` and `TestMain`), once unmutated and once per mutant. | Only run on trusted code; use a clone, never the user's checkout, for PR heads |
| Extras (`goozels` LSP, Claude Code plugin, OCI report sharing) | Not needed. | Not installed |
| Third-party wrappers (GitHub Actions, forks, other Go mutation tools such as `go-mutesting`, `ooze`) | Not used; different mutation models and maintenance status. | Rejected for this skill |
| Helper scripts | `scripts/diff-ranges.go` and `scripts/summarize-mutants.go` are stdlib-only, first-party, read-only (`git diff`, `git show`, file reads). No network or writes. | Adopted; read before running if modified |

Never set `GONOSUMDB`, `GONOSUMCHECK`, `GOFLAGS=-insecure` or `GOINSECURE` for the install. Never run `gooze report push` or `pull`, and never enable CI/registry integrations, without explicit approval.
