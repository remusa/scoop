---
name: update-scoop
description: Use when updating scoop bucket manifest versions, checking for new releases, computing hashes, or regenerating versions.json. Trigger on requests like "update [app]", "check for updates", "bump version", "update the bucket".
---

# Update Scoop Bucket Manifests

Skill for managing version updates across all manifests in this Scoop bucket.

## Bucket Structure

- **Manifests**: `bucket/*.json` (9 active apps)
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

Affected: `hurl.json`, `netbird-ui.json`, `open-webui-desktop.json`, `rhi.json`

**URL + regex** (`"url": "...", "regex": "..."`):
```powershell
$page = Invoke-RestMethod "<url>"
$version = [regex]::Match($page, "<regex>").Groups[1].Value
```

Affected: `displaymagician.json`, `monarch.json`, `raycast.json`, `msty.json`

**URL + jsonpath** (`"url": "...", "jsonpath": "..."`):
```powershell
$json = Invoke-RestMethod "<url>"
$version = $json.<jsonpath.field>
```

Affected: `futo-notes.json`

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
| `msty.json` | `"version": "latest"` with static URL. Autoupdate won't change URL. Only update if the version field needs fixing. |
| `raycast.json` | No autoupdate. Uses `winget install`. Only update the `version` field from checkver. **Note**: changelog page regex may not match — verify manually. |
| `displaymagician.json` | Filename has extra `.1` suffix: `DisplayMagicianSetup_v$version.1.exe` |
| `netbird-ui.json` | Uses `#/dl.7z` fragment for NSIS extraction. Has `post_install` cleanup. |
| `futo-notes.json` | Only GitLab source. Uses `jsonpath` not `regex`. Assets at `projects/488/packages/generic/futo-notes/v$version/` |
| `hurl.json` | Uses `innosetup: true` extraction. |
| `rhi.json` | Tag format is `RHI-$version` (prefix). Asset filename is always `RHI-Setup.exe` (no version in filename). Uses `innosetup: true`. |

## Manifests Without Autoupdate

These cannot be auto-updated (no URL template):
- `raycast.json` — winget-based, no download URL
- `msty.json` — static URL, version is "latest"

For these, only update the `version` field and `versions.json`.

## Verification

After updating, verify:
1. All JSON files are valid: `Get-Content bucket/*.json | ConvertFrom-Json`
2. `versions.json` matches manifest versions (run `generate-versions.ps1` and check diff)
3. Download URLs return HTTP 200 (or 302 redirect for GitHub releases)
4. Computed hashes match downloaded file hashes
5. Run `scoop checkver <app-name>` locally to confirm checkver works

## Version Check Summary

| App | checkver Source | Autoupdate | Last Verified |
|-----|----------------|------------|---------------|
| displaymagician | GitHub releases (regex) | Yes | 2026-08-23 |
| futo-notes | GitLab API (jsonpath) | Yes (with `$sha256`) | 2026-08-23 |
| hurl | GitHub shorthand | Yes | 2026-08-23 |
| monarch | GitHub releases (regex) | Yes | 2026-08-23 |
| msty | msty.app changelog | No (static URL) | 2026-08-23 |
| netbird-ui | GitHub shorthand | Yes | 2026-08-23 |
| open-webui-desktop | GitHub shorthand | Yes (with `$sha256`) | 2026-08-23 |
| raycast | raycast.com changelog | No (winget) | 2026-08-23 |
| rhi | GitHub shorthand | Yes | 2026-08-23 |

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
