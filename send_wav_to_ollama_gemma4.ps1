[CmdletBinding()]
param(
    [string]$BaseUrl = "http://127.0.0.1:11434",
    [string]$Model = "gemma4:e2b",
    [string]$WavPath = "",
    [ValidateSet("answer", "transcribe")]
    [string]$Task = "answer",
    [string]$Prompt = "",
    [string]$ResponseJsonPath = "",
    [Alias("TranscriptPath")]
    [string]$TextOutputPath = ""
)

$ErrorActionPreference = "Stop"
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

if ([string]::IsNullOrWhiteSpace($WavPath)) {
    $WavPath = Join-Path -Path $scriptDir -ChildPath "artifacts\question.wav"
}

$defaultPrompts = @{
    answer = "Answer the spoken question in Japanese with one short natural sentence as if you were the person being asked. Do not say you are an AI. Do not mention limitations. Do not transcribe the audio. Do not repeat the question. Do not add explanations."
    transcribe = "Transcribe the audio in its original language. Output only the transcription. Do not answer the question. Do not add explanations."
}

if (-not (Test-Path -LiteralPath $WavPath)) {
    throw "WAV file not found: $WavPath"
}

if ([string]::IsNullOrWhiteSpace($Prompt)) {
    $Prompt = $defaultPrompts[$Task]
}

if ([string]::IsNullOrWhiteSpace($ResponseJsonPath)) {
    $responseFileName = if ($Task -eq "answer") { "gemma4_e2b_audio_answer_response.json" } else { "gemma4_e2b_audio_transcript_response.json" }
    $ResponseJsonPath = Join-Path -Path (Split-Path -Parent $WavPath) -ChildPath $responseFileName
}

if ([string]::IsNullOrWhiteSpace($TextOutputPath)) {
    $fileName = if ($Task -eq "answer") { "gemma4_e2b_audio_answer.txt" } else { "gemma4_e2b_audio_transcript.txt" }
    $TextOutputPath = Join-Path -Path (Split-Path -Parent $ResponseJsonPath) -ChildPath $fileName
}

$audioBase64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($WavPath))
$body = @{
    model = $Model
    prompt = $Prompt
    images = @($audioBase64)
    stream = $false
    options = @{
        temperature = 0
    }
}

$json = $body | ConvertTo-Json -Depth 8 -Compress
$response = Invoke-RestMethod `
    -Method Post `
    -Uri "$BaseUrl/api/generate" `
    -ContentType "application/json" `
    -Body $json `
    -TimeoutSec 300

$responseDir = Split-Path -Parent $ResponseJsonPath
if ($responseDir -and -not (Test-Path -LiteralPath $responseDir)) {
    New-Item -ItemType Directory -Path $responseDir | Out-Null
}

$textOutputDir = Split-Path -Parent $TextOutputPath
if ($textOutputDir -and -not (Test-Path -LiteralPath $textOutputDir)) {
    New-Item -ItemType Directory -Path $textOutputDir | Out-Null
}

$responseJson = $response | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText($ResponseJsonPath, $responseJson, [System.Text.UTF8Encoding]::new($true))
[System.IO.File]::WriteAllText($TextOutputPath, $response.response, [System.Text.UTF8Encoding]::new($true))

Write-Output "Task: $Task"
Write-Output "Model: $($response.model)"
Write-Output "Response: $($response.response)"
Write-Output "SavedJson: $ResponseJsonPath"
Write-Output "SavedText: $TextOutputPath"
