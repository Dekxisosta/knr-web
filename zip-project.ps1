param(
  [string]$Output
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
if (-not $root) { $root = (Get-Location).Path }
$root = (Resolve-Path -LiteralPath $root).Path.TrimEnd('\', '/')
$name = Split-Path $root -Leaf

if (-not $Output) {
  $parent = Split-Path $root -Parent
  $Output = Join-Path $parent ("{0}-{1}.zip" -f $name, (Get-Date -Format 'yyyyMMdd-HHmmss'))
}
$Output = [System.IO.Path]::GetFullPath($Output)
if (Test-Path -LiteralPath $Output) { Remove-Item -LiteralPath $Output -Force }

# -- Always skipped, whatever .gitignore says --------------------------------
function Test-AlwaysExcluded([string]$rel) {
  return ($rel -eq '.git' -or $rel.StartsWith('.git/') -or $rel -eq 'public' -or $rel.StartsWith('public/'))
}

# -- Option 1: let git decide (exact .gitignore behaviour) -------------------
function Get-FilesFromGit {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) { return $null }

  Push-Location $root
  try {
    $inside = & git rev-parse --is-inside-work-tree 2>$null
    if ($LASTEXITCODE -ne 0 -or $inside -ne 'true') { return $null }

    # Tracked + untracked files that are not ignored.
    $files = @(& git -c core.quotepath=off ls-files --cached --others --exclude-standard)
    if ($LASTEXITCODE -ne 0) { return $null }

    # A file that is tracked AND matches .gitignore still shows up above; drop those too.
    if ($files.Count -gt 0) {
      $ignored = @($files | & git -c core.quotepath=off check-ignore --no-index --stdin 2>$null)
      if ($ignored.Count -gt 0) {
        $skip = New-Object 'System.Collections.Generic.HashSet[string]' (, [string[]]$ignored)
        $files = @($files | Where-Object { -not $skip.Contains($_) })
      }
    }
    return $files
  } finally {
    Pop-Location
  }
}

# -- Option 2: parse the root .gitignore ourselves ---------------------------
function ConvertTo-IgnoreRule([string]$line) {
  $p = $line.TrimEnd()
  if ($p -eq '' -or $p.StartsWith('#')) { return $null }

  $negate = $false
  if ($p.StartsWith('!')) { $negate = $true; $p = $p.Substring(1) }
  if ($p.StartsWith('\')) { $p = $p.Substring(1) }   # escaped leading # or !

  $dirOnly = $p.EndsWith('/')
  $p = $p.TrimEnd('/')
  if ($p -eq '') { return $null }

  $anchored = $p.Contains('/')
  $p = $p.TrimStart('/')

  $sb = New-Object System.Text.StringBuilder
  for ($i = 0; $i -lt $p.Length; $i++) {
    $c = $p[$i]
    if ($c -eq '*') {
      if ($i + 1 -lt $p.Length -and $p[$i + 1] -eq '*') {
        if ($i + 2 -lt $p.Length -and $p[$i + 2] -eq '/') { [void]$sb.Append('(?:.*/)?'); $i += 2 }
        else { [void]$sb.Append('.*'); $i += 1 }
      } else { [void]$sb.Append('[^/]*') }
    }
    elseif ($c -eq '?') { [void]$sb.Append('[^/]') }
    else { [void]$sb.Append([regex]::Escape([string]$c)) }
  }

  $body = $sb.ToString()
  $prefix = if ($anchored) { '^' } else { '^(?:.*/)?' }
  # Matches the path itself (unless dir-only) or anything beneath a matching folder.
  $suffix = if ($dirOnly) { '/.*$' } else { '(?:/.*)?$' }

  [pscustomobject]@{
    Negate = $negate
    Regex  = [regex]::new($prefix + $body + $suffix, 'IgnoreCase')
  }
}

function Get-FilesFromGitignore {
  $rules = @()
  $giPath = Join-Path $root '.gitignore'
  if (Test-Path -LiteralPath $giPath) {
    $rules = @(Get-Content -LiteralPath $giPath | ForEach-Object { ConvertTo-IgnoreRule $_ } | Where-Object { $_ })
  }

  $result = New-Object System.Collections.Generic.List[string]
  $rootLen = $root.Length + 1
  Get-ChildItem -LiteralPath $root -Recurse -File -Force | ForEach-Object {
    $rel = $_.FullName.Substring($rootLen).Replace('\', '/')
    if (Test-AlwaysExcluded $rel) { return }
    $ignored = $false
    foreach ($r in $rules) {
      if ($r.Regex.IsMatch($rel)) { $ignored = -not $r.Negate }
    }
    if (-not $ignored) { $result.Add($rel) }
  }
  return $result.ToArray()
}

# -- Collect the file list ----------------------------------------------------
$method = 'git'
$files = Get-FilesFromGit
if ($null -eq $files) {
  $method = '.gitignore parser'
  $files = Get-FilesFromGitignore
}

$files = @(
  $files |
    ForEach-Object { $_.Replace('\', '/') } |
    Where-Object { -not (Test-AlwaysExcluded $_) } |
    Where-Object { Test-Path -LiteralPath (Join-Path $root $_) -PathType Leaf } |
    Sort-Object -Unique
)

# Never zip the output into itself (relevant if -Output points inside the project).
$outRel = $null
if ($Output.StartsWith($root + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  $outRel = $Output.Substring($root.Length + 1).Replace('\', '/')
  $files = @($files | Where-Object { $_ -ne $outRel })
}

if ($files.Count -eq 0) { throw 'Nothing to zip: no files left after exclusions.' }

# -- Write the zip ------------------------------------------------------------
$zip = [System.IO.Compression.ZipFile]::Open($Output, [System.IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($rel in $files) {
    $full = Join-Path $root $rel
    # The top-level folder inside the zip matches the project folder name.
    [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
      $zip, $full, "$name/$rel", [System.IO.Compression.CompressionLevel]::Optimal)
  }
} finally {
  $zip.Dispose()
}

$sizeMb = [math]::Round((Get-Item -LiteralPath $Output).Length / 1MB, 2)
Write-Host ("Zipped {0} files ({1} MB) using {2}" -f $files.Count, $sizeMb, $method) -ForegroundColor Green
Write-Host ("Excluded: .gitignore entries, public/, .git/") -ForegroundColor DarkGray
Write-Host $Output