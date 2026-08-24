---
name: generate-programs-csv
description: Use when generating the installed programs CSV list, running the generate-installed-programs script, or exporting a list of installed software. Trigger on "generate programs", "export installed apps", "list installed software", "csv of programs".
---

# Generate Installed Programs CSV

Runs `scripts/generate-installed-programs.ts` to collect installed programs from all sources and export a categorized CSV.

## Usage

```bash
bun run generate:programs
```

Or directly:

```bash
bun run scripts/generate-installed-programs.ts
```

## What It Does

1. **Collects programs** from 4 sources:
   - Windows Registry (HKLM + HKCU Uninstall keys)
   - Scoop (`scoop export`)
   - Winget (`winget list --source winget`)
   - OpenShell pinned items (`%APPDATA%/OpenShell/Pinned/*.lnk`)

2. **Filters out** non-user-installed programs:
   - NVIDIA CUDA/dev tools, infrastructure components
   - .NET runtimes, Visual C++ redistributables
   - SQL Server components, Windows SDK
   - Windows updates, drivers, system components
   - Android system packages, redistributables
   - Publisher-based heuristics for Microsoft/NVIDIA/Intel/AMD

3. **Deduplicates** across sources (prefers Scoop/Winget version over Registry)

4. **Categorizes** each program:
   - Manual overrides (~200 entries) for known apps
   - Publisher-based game detection (Valve, Ubisoft, EA, etc.)
   - Keyword pattern matching for category fallback

5. **Writes CSV** to `output/InstalledPrograms.csv`

## Output

- **File**: `output/InstalledPrograms.csv`
- **Columns**: `DisplayName,DisplayVersion,Publisher,InstallDate,Source,Category`
- **Categories**: Games, Gaming, Productivity, Development, Media, Browsers, Communication, Utilities, Other
- **Sources**: registry, scoop, winget, openshell

## Modifying Behavior

### Add/Change Categories

Edit the `CATEGORY_OVERRIDES` map in `scripts/generate-installed-programs.ts`:

```typescript
const CATEGORY_OVERRIDES: Record<string, Category> = {
  "app-name": "Utilities",  // exact normalized name match
  ...
};
```

### Block Additional Programs

Add regex patterns to `BLOCKLIST_PATTERNS`:

```typescript
const BLOCKLIST_PATTERNS: RegExp[] = [
  /\bpattern\b/i,
  ...
];
```

### Add Infrastructure Publishers

Add to `INFRASTRUCTURE_PUBLISHERS` to filter their components:

```typescript
const INFRASTRUCTURE_PUBLISHERS = [
  "publisher name",
  ...
];
```

## Requirements

- **Bun** runtime (for TypeScript execution)
- **PowerShell** (Registry queries)
- **scoop** (for Scoop app export)
- **winget** (for Winget app listing)
- Windows with OpenShell (optional, for pinned items)
