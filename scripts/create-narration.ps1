param([Parameter(Mandatory=$true)][string]$ScriptPath,[string]$OutputName='cleardrop-narration.wav')
$ErrorActionPreference='Stop'
Write-Output 'Preparing local narration.'
if($OutputName -notmatch '^[a-zA-Z0-9_-]+\.wav$'){throw 'Use a simple WAV filename.'}
$clearDropRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$clearDropInput=[IO.Path]::GetFullPath($ScriptPath)
if(-not $clearDropInput.StartsWith($clearDropRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Script must be inside this project.'}
$clearDropText=Get-Content -LiteralPath $clearDropInput -Raw
if($clearDropText.Length -gt 6000 -or $clearDropText -match 'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN .*PRIVATE KEY'){throw 'Use a short script with no credentials.'}
$clearDropSpeaker=New-Object -ComObject SAPI.SpVoice
$clearDropStream=$null
try{
 $clearDropVoices=$clearDropSpeaker.GetVoices()
 $clearDropVoice=$null
 for($clearDropIndex=0;$clearDropIndex -lt $clearDropVoices.Count;$clearDropIndex++){
  $clearDropCandidate=$clearDropVoices.Item($clearDropIndex)
  if($clearDropCandidate.GetAttribute('Gender') -eq 'Female' -and $clearDropCandidate.GetAttribute('Language') -match '(^|;)409(;|$)'){$clearDropVoice=$clearDropCandidate;break}
 }
 if(-not $clearDropVoice){throw 'No installed English female speech voice is available.'}
 Write-Output ('Selecting '+$clearDropVoice.GetDescription())
 $clearDropDirectory=Join-Path $clearDropRoot 'dist/narration'
 New-Item -ItemType Directory -Path $clearDropDirectory -Force|Out-Null
 $clearDropOutput=Join-Path $clearDropDirectory $OutputName
 if(Test-Path -LiteralPath $clearDropOutput){throw 'Output exists. Choose a new filename to preserve it.'}
 $clearDropSpeaker.Voice=$clearDropVoice
 $clearDropSpeaker.Rate=0;$clearDropSpeaker.Volume=90
 $clearDropStream=New-Object -ComObject SAPI.SpFileStream
 $clearDropStream.Open($clearDropOutput,3,$false)
 $clearDropSpeaker.AudioOutputStream=$clearDropStream
 [void]$clearDropSpeaker.Speak($clearDropText)
 $clearDropStream.Close()
 if((Get-Item -LiteralPath $clearDropOutput).Length -lt 1000){throw 'Speech generation produced no usable audio.'}
 Get-Item -LiteralPath $clearDropOutput|Select-Object FullName,Length
 Write-Output ('Synthetic voice: '+$clearDropVoice.GetDescription()+'; generated locally, with no external upload.')
}finally{
 if($clearDropStream){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($clearDropStream)}
 [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($clearDropSpeaker)
}
