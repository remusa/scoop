# Contributing

Thank you for your interest in contributing to this Scoop bucket.

## Prerequisites

- [Scoop](https://scoop.sh) installed
- [PowerShell](https://github.com/PowerShell/PowerShell) 7+ (for running scripts)
- [mise](https://mise.jdx.dev) (for dev tooling)

## Development Setup

```pwsh
# Install dev tools
mise install
bun install
```

## Commit Convention

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). All commits are validated by `commitlint` via a pre-commit hook.

### Format

```
type(scope): description
```

**Types**: `feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `test`, `build`

**Scopes** (for bucket changes): `bucket`

### Examples

```
feat(bucket): update netbird-ui to v0.77.1
feat(bucket): update rhi to v2.3.8
chore: regenerate versions.json
fix(bucket): correct hash for futo-notes manifest
```

### Rules

- Never mix multiple app updates in one commit
- Never combine manifest edits with `versions.json` regeneration in one commit
- Run `.\bin\generate-versions.ps1` after manifest changes, commit separately

## Adding/Updating Manifests

1. Create or edit the manifest in `bucket/`
2. Run `.\bin\checkver.ps1` to verify the latest version
3. Run `.\bin\checkhashes.ps1` to compute hashes
4. Run `.\bin\generate-versions.ps1` to update `versions.json`
5. Commit changes following the conventions above

## Testing

```pwsh
.\bin\test.ps1
```

## Code Style

- PowerShell: OTBS preset (enforced by VS Code + PSScriptAnalyzer)
- JSON: 4-space indentation
- YAML: 2-space indentation
