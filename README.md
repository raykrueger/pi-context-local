# pi-context-local

Your `AGENTS.md` is checked in and shared with the team — but you have preferences, credentials, and paths that are *yours*. `pi-context-local` lets pi pick up a `<basename>.local.md` sibling next to any context file it loads:

| Context file pi loads | Local file picked up |
|---|---|
| `AGENTS.md` | `AGENTS.local.md` |
| `CLAUDE.md` | `CLAUDE.local.md` |

The local file is appended to the system prompt, so per-developer instructions live right next to the shared ones — while staying out of version control via your *global* git ignore file (so you never need per-repo `.gitignore` entries):

```sh
# Point git at a global ignore file (one-time setup)
git config --global core.excludesFile ~/.gitignore_global
echo "*.local.md" >> ~/.gitignore_global
```

## How it works

The extension hooks `before_agent_start`. After pi has resolved the context files for the current directories, the extension looks for a `<basename>.local.md` in each directory that contributed a context file and appends everything it finds under a `## Local Context Files` section. Directories are deduplicated (a directory with both `AGENTS.md` and `CLAUDE.md` only contributes one local file) and `AGENTS.local.md` takes precedence over `CLAUDE.local.md` within a directory.

Nothing is done if no local file exists — a project without `AGENTS.local.md` behaves exactly as before.

## Installation

Prerequisite: the [pi](https://pi.dev) coding agent.

Install from git:

```sh
pi install git:github.com/raykrueger/pi-context-local@v1.0.0
```

Or install this local checkout directly:

```sh
pi install /path/to/pi-context-local
```

Then run `/reload` in pi (or restart).

## Usage

Create a local file next to your existing context file:

```sh
echo "Use pnpm, never npm. My Go modules live in ~/src/go." > AGENTS.local.md
```

The next session in that directory (or any descendant) includes it in the system prompt. Commit the shared `AGENTS.md`; the `.local.md` stays on disk and out of version control globally — no per-repo `.gitignore` entries needed.

## Development

The extension is a single TypeScript file loaded directly by pi — no build step. Runtime requirements:

- Node ≥ 22 (TypeScript type stripping)
- pi host packages `@earendil-works/pi-ai` and `@earendil-works/pi-coding-agent`, provided by pi itself and declared as `peerDependencies` — never bundle them.

Local development loop: edit `index.ts`, run `/reload` in a pi session, and check the system prompt.

### Tests

Unit tests cover the local-file discovery logic (`index.test.ts`, run with Node's built-in test runner). They run against a temp directory tree with synthetic `before_agent_start` events — no real context files are touched:

```sh
npm install
npm test
```

The pi host packages are `devDependencies` for testing only; they remain peer dependencies at runtime and are provided by pi itself, never bundled.

## Releases

Releases are automated with [release-please](https://github.com/googleapis/release-please) (`.github/workflows/release-please.yml`, `node` strategy). The flow:

1. Merge a commit prefixed `feat:` (minor) or `fix:`/`deps:` (patch) to `main`.
2. The bot opens a release PR — version bump in `package.json`, a `CHANGELOG.md` update, labeled `autorelease: pending`.
3. Merge the release PR: the commit is tagged (`vX.Y.Z`) and a GitHub Release is created.

Other prefixes (`chore:`, `docs:`, `test:`, `build:`) are not releasable and never open a release PR on their own. To force a specific version, add a `Release-As: x.y.z` footer to the commit body.

Installers should pin a tag (`pi install git:github.com/raykrueger/pi-context-local@v1.0.0`); the latest tag is listed under [Releases](https://github.com/raykrueger/pi-context-local/releases).

## License

Apache License 2.0 — see [LICENSE](LICENSE).
