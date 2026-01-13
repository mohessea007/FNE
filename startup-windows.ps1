# Script PowerShell pour configurer le démarrage automatique PM2 sur Windows
# Usage: .\startup-windows.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration PM2 - Démarrage Auto" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Vérifier si PM2 est installé
Write-Host "Vérification de PM2..." -ForegroundColor Yellow
try {
    $pm2Version = pm2 --version
    Write-Host "✓ PM2 installé (version $pm2Version)" -ForegroundColor Green
} catch {
    Write-Host "✗ PM2 n'est pas installé" -ForegroundColor Red
    Write-Host "Installation de PM2..." -ForegroundColor Yellow
    npm install pm2 -g
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Erreur lors de l'installation de PM2" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ PM2 installé avec succès" -ForegroundColor Green
}

Write-Host ""
Write-Host "Options de démarrage automatique :" -ForegroundColor Cyan
Write-Host "1. pm2-windows-startup (Recommandé)" -ForegroundColor White
Write-Host "2. Tâche planifiée Windows (Manuel)" -ForegroundColor White
Write-Host "3. pm2-windows-service (Service Windows)" -ForegroundColor White
Write-Host ""
$choice = Read-Host "Choisissez une option (1-3)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Installation de pm2-windows-startup..." -ForegroundColor Yellow
        npm install -g pm2-windows-startup
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ pm2-windows-startup installé" -ForegroundColor Green
            Write-Host ""
            Write-Host "Configuration du démarrage automatique..." -ForegroundColor Yellow
            npx pm2-windows-startup install
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Démarrage automatique configuré" -ForegroundColor Green
                Write-Host ""
                Write-Host "N'oubliez pas de démarrer votre application et de sauvegarder :" -ForegroundColor Yellow
                Write-Host "  pm2 start ecosystem.config.js" -ForegroundColor Gray
                Write-Host "  pm2 save" -ForegroundColor Gray
            } else {
                Write-Host "✗ Erreur lors de la configuration" -ForegroundColor Red
            }
        } else {
            Write-Host "✗ Erreur lors de l'installation" -ForegroundColor Red
        }
    }
    "2" {
        Write-Host ""
        Write-Host "Instructions pour créer une tâche planifiée :" -ForegroundColor Yellow
        Write-Host "1. Ouvrez le Planificateur de tâches Windows" -ForegroundColor White
        Write-Host "2. Créez une nouvelle tâche" -ForegroundColor White
        Write-Host "3. Déclencheur : Au démarrage" -ForegroundColor White
        Write-Host "4. Action : Exécuter 'pm2' avec arguments 'resurrect'" -ForegroundColor White
        Write-Host "5. Démarrer dans : $PWD" -ForegroundColor White
        Write-Host ""
        Write-Host "Assurez-vous d'avoir sauvegardé votre configuration PM2 :" -ForegroundColor Yellow
        Write-Host "  pm2 start ecosystem.config.js" -ForegroundColor Gray
        Write-Host "  pm2 save" -ForegroundColor Gray
    }
    "3" {
        Write-Host ""
        Write-Host "Installation de pm2-windows-service..." -ForegroundColor Yellow
        npm install -g pm2-windows-service
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ pm2-windows-service installé" -ForegroundColor Green
            Write-Host ""
            Write-Host "Installation du service Windows..." -ForegroundColor Yellow
            pm2-service-install
            if ($LASTEXITCODE -eq 0) {
                Write-Host "✓ Service Windows installé" -ForegroundColor Green
                Write-Host ""
                Write-Host "N'oubliez pas de démarrer votre application et de sauvegarder :" -ForegroundColor Yellow
                Write-Host "  pm2 start ecosystem.config.js" -ForegroundColor Gray
                Write-Host "  pm2 save" -ForegroundColor Gray
            } else {
                Write-Host "✗ Erreur lors de l'installation du service" -ForegroundColor Red
            }
        } else {
            Write-Host "✗ Erreur lors de l'installation" -ForegroundColor Red
        }
    }
    default {
        Write-Host "Option invalide" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration terminée" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

