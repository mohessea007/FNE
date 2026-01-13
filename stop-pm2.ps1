# Script PowerShell pour arrêter CloudFNE avec PM2
# Usage: .\stop-pm2.ps1

Write-Host "Arrêt de CloudFNE..." -ForegroundColor Yellow

pm2 stop cloudfne

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Application arrêtée avec succès" -ForegroundColor Green
} else {
    Write-Host "⚠ L'application n'était pas en cours d'exécution" -ForegroundColor Yellow
}

pm2 status





