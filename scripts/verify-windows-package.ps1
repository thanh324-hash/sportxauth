param(
  [Parameter(Mandatory=$true)][string]$Executable,
  [string]$ExpectedVersion = "0.10.0",
  [switch]$RequireSignature,
  [string]$IconPreview
)

$resolved = (Resolve-Path -LiteralPath $Executable).Path
$item = Get-Item -LiteralPath $resolved
$version = $item.VersionInfo
if ($version.ProductName -ne "BOT 68") { throw "Unexpected ProductName: $($version.ProductName)" }
if (-not $version.FileVersion.StartsWith($ExpectedVersion)) { throw "Unexpected FileVersion: $($version.FileVersion)" }
if ($version.FileDescription -ne "BOT 68") { throw "Unexpected FileDescription: $($version.FileDescription)" }
if ($version.CompanyName -ne "BOT 68") { throw "Unexpected CompanyName: $($version.CompanyName)" }
if ($version.LegalTrademarks -ne "BOT 68") { throw "Unexpected LegalTrademarks: $($version.LegalTrademarks)" }

$signature = Get-AuthenticodeSignature -LiteralPath $resolved
if ($RequireSignature -and $signature.Status -ne "Valid") { throw "Authenticode signature is $($signature.Status)" }

if ($IconPreview) {
  Add-Type -AssemblyName System.Drawing
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($resolved)
  if (-not $icon) { throw "No Windows icon found" }
  $bitmap = $icon.ToBitmap()
  $previewPath = [IO.Path]::GetFullPath($IconPreview)
  $bitmap.Save($previewPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose(); $icon.Dispose()
}

[pscustomobject]@{
  ProductName = $version.ProductName
  FileVersion = $version.FileVersion
  CompanyName = $version.CompanyName
  FileDescription = $version.FileDescription
  LegalTrademarks = $version.LegalTrademarks
  SignatureStatus = $signature.Status
  SizeBytes = $item.Length
}
