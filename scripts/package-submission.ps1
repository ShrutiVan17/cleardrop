$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputDirectory = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$zipPath = Join-Path $outputDirectory ('cleardrop-source-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.zip')
$rootNames = @('package.json','pnpm-lock.yaml','pnpm-workspace.yaml','README.md','LICENSE','.gitignore','.env.example','tsconfig.json','next-env.d.ts','next.config.js','postcss.config.js','tailwind.config.js')
$sourceFiles = @($rootNames | ForEach-Object { Get-Item -LiteralPath (Join-Path $projectRoot $_) })
foreach ($directoryName in @('app','lib','scripts','docs','public')) {
  $sourceFiles += Get-ChildItem -LiteralPath (Join-Path $projectRoot $directoryName) -Recurse -File
}
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::Open($zipPath,[IO.Compression.ZipArchiveMode]::Create)
try {
  foreach ($sourceFile in $sourceFiles) {
    $fullPath = [IO.Path]::GetFullPath($sourceFile.FullName)
    if (-not $fullPath.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar)) { throw 'File is outside the project.' }
    $relative = $fullPath.Substring($projectRoot.Length + 1).Replace('\','/')
    if ($relative -match '(^|/)(\.env(?!\.example$)|node_modules|\.next|\.git|__pycache__)(/|\.|$)' -or $relative -match '\.(log|pyc|webm|mp4)$') { continue }
    if ($sourceFile.Extension -in @('.ts','.tsx','.js','.cjs','.json','.md','.yaml','.py','.ps1') -or $sourceFile.Name -eq '.env.example') {
      $contents = [IO.File]::ReadAllText($fullPath)
      if ($contents -match 'eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{10,}' -or $contents -match '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----') { throw "Potential secret in $relative; packaging stopped." }
    }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$fullPath,'cleardrop/'+$relative) | Out-Null
  }
} finally { $archive.Dispose() }
$check = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  if ($check.Entries.FullName -match '\.env\.local|node_modules/|\.next/|\.git/') { throw 'Archive exclusion check failed.' }
  Write-Output ('Archive entries: ' + $check.Entries.Count)
} finally { $check.Dispose() }
Get-Item -LiteralPath $zipPath | Select-Object FullName,Length
Get-FileHash -LiteralPath $zipPath -Algorithm SHA256
