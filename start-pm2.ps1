# Script PowerShell pour démarrer CloudFNE avec PM2
# Usage: .\start-pm2.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CloudFNE - Démarrage avec PM2" -ForegroundColor Cyan
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

# Créer le dossier de logs s'il n'existe pas
Write-Host ""
Write-Host "Création du dossier de logs..." -ForegroundColor Yellow
if (!(Test-Path -Path "./logs")) {
    New-Item -ItemType Directory -Force -Path "./logs" | Out-Null
    Write-Host "✓ Dossier logs créé" -ForegroundColor Green
} else {
    Write-Host "✓ Dossier logs existe déjà" -ForegroundColor Green
}

# Vérifier si le build existe
Write-Host ""
Write-Host "Vérification du build..." -ForegroundColor Yellow
if (!(Test-Path -Path "./.next")) {
    Write-Host "✗ Le build n'existe pas" -ForegroundColor Red
    Write-Host "Lancement du build..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Erreur lors du build" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Build terminé avec succès" -ForegroundColor Green
} else {
    Write-Host "✓ Build trouvé" -ForegroundColor Green
}

# Vérifier si l'application est déjà en cours d'exécution
Write-Host ""
Write-Host "Vérification des processus existants..." -ForegroundColor Yellow
$existingApp = pm2 list | Select-String "cloudfne"
if ($existingApp) {
    Write-Host "⚠ L'application est déjà en cours d'exécution" -ForegroundColor Yellow
    $response = Read-Host "Voulez-vous la redémarrer? (O/N)"
    if ($response -eq "O" -or $response -eq "o") {
        Write-Host "Redémarrage de l'application..." -ForegroundColor Yellow
        pm2 restart cloudfne
        Write-Host "✓ Application redémarrée" -ForegroundColor Green
    } else {
        Write-Host "Démarrage annulé" -ForegroundColor Yellow
        exit 0
    }
} else {
    # Démarrer l'application
    Write-Host ""
    Write-Host "Démarrage de l'application avec PM2..." -ForegroundColor Yellow
    pm2 start ecosystem.config.js
    if ($LASTEXITCODE -ne 0) {
        Write-Host "✗ Erreur lors du démarrage" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ Application démarrée avec succès" -ForegroundColor Green
}

# Afficher le statut
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Statut de l'application" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
pm2 status

Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Cyan
Write-Host "  pm2 logs cloudfne          - Voir les logs" -ForegroundColor Gray
Write-Host "  pm2 monit                  - Monitoring en temps réel" -ForegroundColor Gray
Write-Host "  pm2 restart cloudfne       - Redémarrer" -ForegroundColor Gray
Write-Host "  pm2 stop cloudfne          - Arrêter" -ForegroundColor Gray
Write-Host "  pm2 save                   - Sauvegarder la configuration" -ForegroundColor Gray
Write-Host ""





