#!/usr/bin/env bash
# Asserts README.md's app table covers exactly the manifests in bucket/.
#
# Versions are NOT checked here on purpose: every row's version cell is a
# shields.io dynamic badge that reads versions.json at render time, so a
# version literal can never drift. What can drift is app coverage, row order
# and copy-pasted badge keys - that is what this catches.
set -euo pipefail
cd "$(dirname "$0")/.."

readme=README.md
badge_src='remusa%2Fscoop%2Fmaster%2Fversions.json'
fail=0
err() { echo "::error file=$readme::$*"; fail=1; }

apps=$(ls bucket/*.json | sed -e 's|^bucket/||' -e 's|\.json$||' | grep -v '\.template$' | LC_ALL=C sort -u)

# one "name|url|badgekey" line per table row, in file order
rows=$(sed -n 's/^| \[\([^]]*\)\](\([^)]*\)) *|.*query=%24\.\([A-Za-z0-9._-]*\).*/\1|\2|\3/p' "$readme")
names=$(printf '%s\n' "$rows" | cut -d'|' -f1)

[ -n "$rows" ] || { err "no app rows parsed - table shape changed"; exit 1; }

# 1. every manifest has exactly one row
while read -r app; do
  [ -n "$app" ] || continue
  n=$(printf '%s\n' "$names" | grep -cx -- "$app" || true)
  [ "$n" -eq 1 ] || err "bucket/$app.json has $n rows in $readme (want 1)"
done <<< "$apps"

# 2. no row without a manifest
while read -r name; do
  [ -n "$name" ] || continue
  [ -f "bucket/$name.json" ] || err "row '$name' has no bucket/$name.json"
done <<< "$names"

# 3. rows stay alphabetical, matching the versions.json ordering
if [ "$names" != "$(printf '%s\n' "$names" | LC_ALL=C sort -u)" ]; then
  err "rows are not in alphabetical order: expected $(printf '%s\n' "$names" | LC_ALL=C sort -u | tr '\n' ' ')"
fi

# 4. per row: badge key == row name, and the badge reads master's versions.json
while IFS='|' read -r name url key; do
  [ -n "$name" ] || continue
  [ "$key" = "$name" ] || err "row '$name' has badge key '\$.$key' (want '\$.$name')"
  case $url in
    https://*) ;;
    *) err "row '$name' link is not https: $url" ;;
  esac
done <<< "$rows"

n_badge=$(grep -c "$badge_src" "$readme" || true)
[ "$n_badge" -eq "$(printf '%s\n' "$names" | grep -c .)" ] ||
  err "$n_badge rows read master versions.json, expected $(printf '%s\n' "$names" | grep -c .)"

if [ "$fail" -ne 0 ]; then
  echo "README.md app table is out of sync with bucket/ - see errors above."
  exit 1
fi
echo "README.md OK: $(printf '%s\n' "$names" | grep -c .) apps, alphabetical, badge keys match."
