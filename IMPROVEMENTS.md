# Improvement Plan

## Medium Priority

### 1. Remove unrelated files
`docker-compose.yml` and `scripts/open-webui.ps1` are for a local Open WebUI setup, not the Scoop bucket. Consider moving them to a separate repo or `.gitignore`.

---

## Low Priority

### 2. Clean up `deprecated/`
The `.gitkeep` says "delete once directory has files" - it's empty, so remove both.

### 3. Remove `app-name.json.template` from the repo root
It's useful but shouldn't be in `bucket/` where Scoop scans. Move to a `docs/` or `templates/` folder.

### 4. Fix pre-existing CI failure
The Scoop test infrastructure scans `versions.json` (at repo root) as a manifest when it's in the git diff, causing schema validation errors. Either exclude `versions.json` from the git-changed-files scan, or move it out of the repo root.
