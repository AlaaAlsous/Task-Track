$RESOURCE_GROUP = "Task-Track"
$APPNAME = "Task-Track-App"
$ZIPFILE = "deploy.zip"

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Write-Host "🧹 Cleaning old ZIP..."
Remove-Item $ZIPFILE -Force -Confirm:$false -ErrorAction SilentlyContinue

Write-Host "🗜 Creating ZIP..."
Compress-Archive -Path server.js,package.json,public,package-lock.json -DestinationPath $ZIPFILE -Force

Write-Host "☁ Deploying to Azure..."
az webapp deployment source config-zip `
  --resource-group $RESOURCE_GROUP `
  --name $APPNAME `
  --src $ZIPFILE

Remove-Item $ZIPFILE -Force -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "✅ Done!"
