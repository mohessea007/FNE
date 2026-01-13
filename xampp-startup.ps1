# Script PowerShell pour configurer XAMPP (Apache et MySQL) au démarrage Windows
# Usage: .\xampp-startup.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration XAMPP - Démarrage Auto" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Chemin par défaut de XAMPP
$defaultXamppPath = "C:\xampp"
$xamppPath = Read-Host "Chemin d'installation de XAMPP (défaut: $defaultXamppPath)"
if ([string]::IsNullOrWhiteSpace($xamppPath)) {
    $xamppPath = $defaultXamppPath
}

# Vérifier que XAMPP existe
if (-not (Test-Path $xamppPath)) {
    Write-Host "✗ XAMPP non trouvé dans : $xamppPath" -ForegroundColor Red
    Write-Host "Veuillez vérifier le chemin d'installation de XAMPP" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ XAMPP trouvé dans : $xamppPath" -ForegroundColor Green
Write-Host ""

# Chemins des exécutables
$apachePath = Join-Path $xamppPath "apache_start.bat"
$mysqlPath = Join-Path $xamppPath "mysql_start.bat"

# Vérifier que les fichiers existent
if (-not (Test-Path $apachePath)) {
    Write-Host "✗ Fichier apache_start.bat non trouvé" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $mysqlPath)) {
    Write-Host "✗ Fichier mysql_start.bat non trouvé" -ForegroundColor Red
    exit 1
}

Write-Host "Création des tâches planifiées..." -ForegroundColor Yellow

# Créer une tâche pour Apache
$apacheTaskName = "XAMPP_Apache_Startup"
$apacheAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$apachePath`""
$apacheTrigger = New-ScheduledTaskTrigger -AtStartup
$apachePrincipal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$apacheSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    # Supprimer la tâche si elle existe déjà
    Unregister-ScheduledTask -TaskName $apacheTaskName -Confirm:$false -ErrorAction SilentlyContinue
    
    # Créer la tâche pour Apache
    Register-ScheduledTask -TaskName $apacheTaskName -Action $apacheAction -Trigger $apacheTrigger -Principal $apachePrincipal -Settings $apacheSettings -Description "Démarre Apache XAMPP au démarrage de Windows"
    Write-Host "✓ Tâche Apache créée : $apacheTaskName" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur lors de la création de la tâche Apache : $_" -ForegroundColor Red
}

# Créer une tâche pour MySQL
$mysqlTaskName = "XAMPP_MySQL_Startup"
$mysqlAction = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$mysqlPath`""
$mysqlTrigger = New-ScheduledTaskTrigger -AtStartup
$mysqlPrincipal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Highest
$mysqlSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    # Supprimer la tâche si elle existe déjà
    Unregister-ScheduledTask -TaskName $mysqlTaskName -Confirm:$false -ErrorAction SilentlyContinue
    
    # Créer la tâche pour MySQL
    Register-ScheduledTask -TaskName $mysqlTaskName -Action $mysqlAction -Trigger $mysqlTrigger -Principal $mysqlPrincipal -Settings $mysqlSettings -Description "Démarre MySQL XAMPP au démarrage de Windows"
    Write-Host "✓ Tâche MySQL créée : $mysqlTaskName" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur lors de la création de la tâche MySQL : $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Configuration terminée" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Les services Apache et MySQL démarreront automatiquement au prochain démarrage de Windows." -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester maintenant, vous pouvez démarrer manuellement :" -ForegroundColor Yellow
Write-Host "  - Ouvrir le Panneau de contrôle XAMPP" -ForegroundColor Gray
Write-Host "  - Ou exécuter : $apachePath" -ForegroundColor Gray
Write-Host "  - Et : $mysqlPath" -ForegroundColor Gray
Write-Host ""
Write-Host "Pour désactiver le démarrage automatique :" -ForegroundColor Yellow
Write-Host "  - Ouvrir le Planificateur de tâches Windows" -ForegroundColor Gray
Write-Host "  - Supprimer les tâches : $apacheTaskName et $mysqlTaskName" -ForegroundColor Gray
Write-Host ""

