#Requires -Version 5.1

$repoRoot = "$PSScriptRoot/.."
$versionsPath = Join-Path $repoRoot "versions.json"

$versions = @{}
Get-ChildItem (Join-Path $repoRoot "bucket/*.json") -Exclude "*.template" | ForEach-Object {
    $manifest = Get-Content $_.FullName -Raw | ConvertFrom-Json
    $versions[$_.BaseName] = $manifest.version
}

$sorted = [ordered]@{}
$versions.GetEnumerator() | Sort-Object Name | ForEach-Object {
    $sorted[$_.Name] = $_.Value
}

$sorted | ConvertTo-Json | Set-Content -LiteralPath $versionsPath -NoNewline
