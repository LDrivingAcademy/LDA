# Codex Workspace Safety

Keep this repository light enough for Codex and local editors to open reliably.

## Safe Baseline

- Source files should stay focused and reasonably small. Split a file once it starts becoming difficult to scan.
- Keep generated output out of the repo: `node_modules`, `.next`, `out`, `dist`, `build`, `coverage`, `.turbo`, `.vercel`, and `*.tsbuildinfo`.
- Do not commit dependency folders, build artifacts, exported logs, screenshots, videos, or large data dumps.
- Keep public assets compressed before adding them to `public/`.
- Prefer one active app root. The root project is the deployable app; `lda-web/` is legacy/reference material unless it is deliberately removed or revived.

## Before Adding Large Features

Run a quick size check from the repo root:

```powershell
Get-ChildItem -Recurse -File |
  Sort-Object Length -Descending |
  Select-Object -First 20 @{Name='KB';Expression={[math]::Round($_.Length/1KB,1)}},FullName
```

If any source file is unusually large, split it before continuing. If generated folders appear, remove them from the working tree and make sure they are ignored.

## If Codex Feels Slow Or Stops Responding

1. Close any running dev server or long build process.
2. Check for generated folders: `.next`, `node_modules`, `out`, `dist`, `build`, `coverage`, `.turbo`, or `.vercel`.
3. Move large temporary files, logs, media exports, and archives out of the repository.
4. Reopen Codex after the workspace is back to source files only.
