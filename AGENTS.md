# Agents

## Conventions

### Commits

Always use **conventional commits** with **atomic changes**. Each commit should represent exactly one logical change.

- One manifest update = one commit
- One config change = one commit
- Regenerating `versions.json` = separate commit (depends on manifest changes)

Format: `type(scope): description`

**Types**: `feat`, `fix`, `chore`, `docs`, `refactor`, `ci`, `test`, `build`

**Scopes** (for bucket changes): `bucket`

**Examples**:
```
feat(bucket): update netbird-ui to v0.77.1
feat(bucket): update rhi to v2.3.8
chore: regenerate versions.json
feat: add update-scoop skill for version management
fix(bucket): correct hash for futo-notes manifest
docs: update AGENTS.md with commit conventions
```

**Rules**:
- Never mix multiple app updates in one commit
- Never combine manifest edits with `versions.json` regeneration in one commit
- Run `generate-versions.ps1` after manifest changes, commit separately
- All commits pass `commitlint` via lefthook (`@commitlint/config-conventional`)
