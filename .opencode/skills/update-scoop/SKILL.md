---
name: update-scoop
description: Use when updating scoop bucket manifest versions, checking for new releases, computing hashes, or regenerating versions.json. Trigger on requests like "update [app]", "check for updates", "bump version", "update the bucket".
---

# Update Scoop Bucket Manifests

Skill for managing version updates across all manifests in this Scoop bucket.

## Bucket Structure

- **Manifests**: `bucket/*.json` (10 active apps)
- **Versions tracking**: `versions.json` (auto-generated from manifests)
- **Version generator**: `bin/generate-versions.ps1`

## Update Workflow

### Step 1: Check for Updates

For each manifest, detect the latest version based on its `checkver` configuration:

**GitHub shorthand** (`"github": "<url>"`):
```powershell
$repo = "<owner>/<repo>"  # extracted from checkver.github
$latest = (Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest").tag_name -replace '^v',''
```

Affected: `hurl.json`, `netbird-ui.json`, `open-webui-desktop.json`, `windisplay.json`

`rhi.json` is also github-shorthand, but needs an explicit `"regex"` since its tags are `RHI-$version`.

**URL + regex** (`"url": "...", "regex": "..."`):
```powershell
$page = Invoke-RestMethod "<url>"
$version = [regex]::Match($page, "<regex>").Groups[1].Value
```

Affected: `displaymagician.json`, `futo-notes.json`, `monarch.json`, `raycast.json`, `rhi.json`

**URL + jsonpath** (`"url": "...", "jsonpath": "..."`):
```powershell
$json = Invoke-RestMethod "<url>"
$version = $json.<jsonpath.field>
```

Affected: none currently — `futo-notes.json` used jsonpath until 2026-09-12, but its tag carries a `v` prefix which jsonpath cannot strip.

### Step 2: Compare Versions

Compare detected version against current `version` field in the manifest. Skip if equal.

### Step 3: Download and Hash

For each architecture entry in the manifest, construct the download URL using the `autoupdate` template (replace `$version`), then:

```powershell
$url = "<autoupdate_url>" -replace '\$version', $newVersion
$tmp = Join-Path $env:TEMP "scoop_dl_$([guid]::NewGuid().ToString('N').Substring(0,8))"
Invoke-WebRequest -Uri $url -OutFile $tmp
$hash = (Get-FileHash $tmp -Algorithm SHA256).Hash.ToLower()
Remove-Item $tmp
```

**Hash format**: Check existing hash format in the manifest:
- Bare hex: `"hash": "abc123..."` → use `$hash`
- Prefixed: `"hash": "sha256:ABC123..."` → use `"sha256:$hash"` (uppercase if original is uppercase)

### Step 4: Update Manifest

Update the following fields:
1. `version` → new version
2. `architecture.<arch>.url` → replace version in URL
3. `architecture.<arch>.hash` → new hash (preserve format)

### Step 5: Regenerate versions.json

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File bin/generate-versions.ps1
```

## Known Manifest Quirks

| Manifest | Quirk |
|----------|-------|
| `msty.json` | `"version": "latest"` with a rolling, unversioned URL (`assets.msty.app/win/auto/Msty_x64.exe`) and no autoupdate. `checkver` removed 2026-09-12: the old `msty.app/changelog` now 301s to a JS-rendered `msty.ai` page, and there is no version to compare anyway. |
| `raycast.json` | No autoupdate, no `url` — installs via `winget install Raycast` (Raycast for Windows ships as a Microsoft Store MSIX only), so the manifest is schema-invalid and `scoop install` cannot work. Kept intentionally; do not touch. Changelog page is JS-rendered, so `checkver` always errors. |
| `displaymagician.json` | Filename has extra `.1` suffix: `DisplayMagicianSetup_v$version.1.exe` |
| `netbird-ui.json` | Uses `#/dl.7z` fragment for NSIS extraction. Has `post_install` cleanup. |
| `futo-notes.json` | Only GitLab source. checkver hits `/api/v4/projects/488/releases?per_page=1` with a regex that strips the `v` tag prefix; jsonpath on `tag_name` keeps the `v` and makes autoupdate build `vv$version` (404). No `hash` in autoupdate; scoop computes it. Assets at `projects/488/packages/generic/futo-notes/v$version/`. |
| `hurl.json` | Uses `innosetup: true` extraction. |

| `open-webui-desktop.json` | Autoupdate URLs need the `v` tag prefix (`releases/download/v$version/`). A bare `"hash": "$sha256"` is **invalid** — `$sha256` is only a placeholder inside a hash-file `regex`; omit the key, scoop computes the hash. |
| `windisplay.json` | Tauri NSIS installer extracted via `#/dl.7z`; `post_install` removes `$PLUGINSDIR` and the bundled `uninstall.exe`. Upstream ships no LICENSE file, so `"license": "Unknown"` (schema requires the key). |
| `rhi.json` | Tag format is `RHI-$version` (prefix). A single-key `github` checkver makes scoop query the GitHub API with the default `/releases/tag/(?:v|V)?([\d.]+)` regex, which never matches — an explicit `"regex": "RHI-([\\d.]+)"` is required. Asset filename is always `RHI-Setup.exe` (no version in it). Uses `innosetup: true`. |

## Manifests Without Autoupdate

These cannot be auto-updated (no URL template):
- `raycast.json` — winget-based, no download URL
- `msty.json` — static rolling URL, version is "latest", `checkver` removed

For these, only update the `version` field and `versions.json`.

## Verification

After updating, verify:
1. All JSON files are valid: `Get-Content bucket/*.json | ConvertFrom-Json`
2. `versions.json` matches manifest versions (run `generate-versions.ps1` and check diff)
3. Download URLs return HTTP 200 (or 302 redirect for GitHub releases)
4. Computed hashes match downloaded file hashes
5. Run checkver locally: on apollo `& "C:\Program Files\PowerShell\7-preview\pwsh.exe" -NoProfile -Command "& \"$env:SCOOP_HOME\bin\checkver.ps1\" -Dir <dir>"` (`-Update` rewrites versions/hashes; the repo `bin/checkver.ps1` hardcodes `-Dir bucket`)
6. Validate against Scoop's `schema.json` with `jsonschema` — CI only validates JSON files changed by the pushed head commit, so untouched manifests can stay schema-invalid indefinitely

## Version Check Summary

| App | checkver Source | Autoupdate | Last Verified |
|-----|----------------|------------|---------------|
| displaymagician | GitHub releases (regex) | Yes | 2026-08-23 |
| futo-notes | GitLab API (regex, strips `v`) | Yes | 2026-09-12 |
| hurl | GitHub shorthand | Yes | 2026-08-23 |
| monarch | GitHub releases (regex) | Yes | 2026-08-23 |
| msty | none (checkver removed) | No (static URL) | 2026-09-12 |
| netbird-ui | GitHub shorthand | Yes | 2026-08-23 |
| open-webui-desktop | GitHub shorthand | Yes (`v$version` URL) | 2026-09-12 |
| raycast | raycast.com changelog | No (winget) | 2026-08-23 |
| rhi | GitHub shorthand + `RHI-` regex | Yes | 2026-09-12 |
| windisplay | GitHub shorthand | Yes | 2026-09-12 |

## Quick Commands

**Check single app updates:**
```
Update scoop manifest [app-name]
```

**Check all apps:**
```
Check all scoop bucket apps for updates
```

**Regenerate versions.json only:**
```
Regenerate versions.json from manifests
```
