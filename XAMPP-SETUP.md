# Configuration XAMPP pour CloudFNE

Ce guide explique comment configurer XAMPP pour démarrer automatiquement Apache et MySQL au démarrage de Windows.

## Méthode 1 : Script PowerShell automatique (Recommandé)

Le script `xampp-startup.ps1` configure automatiquement le démarrage automatique :

```powershell
.\xampp-startup.ps1
```

Le script va :
1. Demander le chemin d'installation de XAMPP (défaut: `C:\xampp`)
2. Créer deux tâches planifiées Windows :
   - `XAMPP_Apache_Startup` - Démarre Apache au boot
   - `XAMPP_MySQL_Startup` - Démarre MySQL au boot

## Méthode 2 : Configuration manuelle via le Planificateur de tâches

### Pour Apache

1. Ouvrez le **Planificateur de tâches Windows** (Task Scheduler)
2. Créez une **nouvelle tâche**
3. Onglet **Général** :
   - Nom : `XAMPP_Apache_Startup`
   - Cochez "Exécuter que l'utilisateur soit connecté ou non"
   - Cochez "Exécuter avec les privilèges les plus élevés"
4. Onglet **Déclencheurs** :
   - Nouveau → Au démarrage
5. Onglet **Actions** :
   - Nouveau → Action : Démarrer un programme
   - Programme : `cmd.exe`
   - Arguments : `/c "C:\xampp\apache_start.bat"`
   - Démarrer dans : `C:\xampp`
6. Onglet **Conditions** :
   - Décochez "Mettre fin à la tâche si elle s'exécute plus de :"
   - Cochez "Démarrer la tâche uniquement si l'ordinateur est branché sur secteur"
7. Onglet **Paramètres** :
   - Cochez "Autoriser l'exécution de la tâche à la demande"
   - Cochez "Si la tâche échoue, redémarrer toutes les :" → 1 minute

### Pour MySQL

Répétez les mêmes étapes en remplaçant :
- Nom : `XAMPP_MySQL_Startup`
- Arguments : `/c "C:\xampp\mysql_start.bat"`

## Méthode 3 : Via le Panneau de contrôle XAMPP

1. Ouvrez le Panneau de contrôle XAMPP
2. Cliquez sur "Config" pour Apache
3. Sélectionnez "Autostart" pour Apache
4. Répétez pour MySQL

**Note** : Cette méthode nécessite que le Panneau de contrôle XAMPP soit ouvert, ce qui n'est pas idéal pour un serveur de production.

## Vérification

Après avoir configuré le démarrage automatique :

1. **Redémarrez votre ordinateur**
2. Vérifiez que MySQL est démarré :
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 3306
   ```
3. Vérifiez que Apache est démarré :
   ```powershell
   Test-NetConnection -ComputerName localhost -Port 80
   ```

## Désactiver le démarrage automatique

Pour désactiver le démarrage automatique :

1. Ouvrez le **Planificateur de tâches Windows**
2. Trouvez les tâches `XAMPP_Apache_Startup` et `XAMPP_MySQL_Startup`
3. Clic droit → Désactiver ou Supprimer

## Démarrer manuellement

Si vous préférez démarrer manuellement :

```powershell
# Démarrer Apache
C:\xampp\apache_start.bat

# Démarrer MySQL
C:\xampp\mysql_start.bat

# Ou via le Panneau de contrôle XAMPP
C:\xampp\xampp-control.exe
```

## Configuration de la base de données CloudFNE

Une fois MySQL démarré, configurez la base de données :

```bash
# Se connecter à MySQL (mot de passe root généralement vide dans XAMPP)
mysql -u root

# Créer la base de données
CREATE DATABASE cloudfne CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# Quitter MySQL
exit;

# Appliquer les migrations Prisma
npm run db:migrate
npm run db:push
npm run db:seed
```

## Fichier .env

Assurez-vous que votre fichier `.env` contient :

```env
DATABASE_URL="mysql://root:@localhost:3306/cloudfne"
```

**Note** : Si vous avez défini un mot de passe root dans XAMPP, ajoutez-le dans l'URL :
```env
DATABASE_URL="mysql://root:VotreMotDePasse@localhost:3306/cloudfne"
```

