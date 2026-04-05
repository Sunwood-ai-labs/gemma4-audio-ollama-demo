[CmdletBinding()]
param(
    [string]$BaseUrl = "http://127.0.0.1:50021",
    [string]$Text = "What is your favorite color?",
    [int]$Speaker = 2,
    [string]$OutputPath = "",
    [string]$QueryOutputPath = ""
)

$ErrorActionPreference = "Stop"
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path -Path $scriptDir -ChildPath "artifacts\question.wav"
}

if ([string]::IsNullOrWhiteSpace($QueryOutputPath)) {
    $QueryOutputPath = Join-Path -Path $scriptDir -ChildPath "artifacts\question_query.json"
}

$encodedText = [uri]::EscapeDataString($Text)
$audioQueryUri = "$BaseUrl/audio_query?text=$encodedText&speaker=$Speaker"
$synthesisUri = "$BaseUrl/synthesis?speaker=$Speaker"

$audioQuery = Invoke-RestMethod -Method Post -Uri $audioQueryUri
$audioQueryJson = $audioQuery | ConvertTo-Json -Depth 20

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$queryOutputDir = Split-Path -Parent $QueryOutputPath
if ($queryOutputDir -and -not (Test-Path -LiteralPath $queryOutputDir)) {
    New-Item -ItemType Directory -Path $queryOutputDir | Out-Null
}

[System.IO.File]::WriteAllText($QueryOutputPath, $audioQueryJson, [System.Text.UTF8Encoding]::new($false))

Invoke-WebRequest `
    -Method Post `
    -Uri $synthesisUri `
    -ContentType "application/json" `
    -Body $audioQueryJson `
    -OutFile $OutputPath | Out-Null

$item = Get-Item -LiteralPath $OutputPath
Write-Output "Generated: $($item.FullName)"
Write-Output "Size: $($item.Length) bytes"
