# Installation et Configuration CloudFNE

## 1. Installation des dépendances patrick

```bash
npm install --force
npx prisma generate
```

## 2. Configuration de la base de données

### 2.1. Démarrer MySQL (XAMPP)

Si vous utilisez XAMPP, vous devez démarrer MySQL :

**Méthode 1 : Via le Panneau de contrôle XAMPP**
- Ouvrez le Panneau de contrôle XAMPP
- Cliquez sur "Start" pour MySQL

**Méthode 2 : Démarrage automatique au boot (Recommandé)**

Utilisez le script PowerShell fourni :

```powershell
.\xampp-startup.ps1
```

Ce script créera des tâches planifiées Windows pour démarrer automatiquement Apache et MySQL au démarrage.

**Méthode 3 : Manuellement via PowerShell**

```powershell
# Démarrer Apache
C:\xampp\apache_start.bat

# Démarrer MySQL
C:\xampp\mysql_start.bat
```

### 2.2. Créer la base de données

```bash
# Se connecter à MySQL (si vous utilisez XAMPP, le mot de passe root est généralement vide)
mysql -u root -p

# Créer la base de données
CREATE DATABASE cloudfne CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

### 2.3. Appliquer les migrations

```bash
npm run db:migrate
npm run db:push
npm run db:seed
```

## 3. Configuration des variables d'environnement

Créez un fichier `.env` à la racine du projet avec les variables suivantes :

```env
DATABASE_URL="mysql://user:password@localhost:3306/cloudfne"
JWT_SECRET="votre_secret_jwt_super_securise_changez_en_production"
FNE_API_URL="http://54.247.95.108/ws/external"
NODE_ENV="production"
PORT=3000
```

## 4. Build de l'application

```bash
npm run build
```

## 5. Déploiement avec PM2

### Installation de PM2 (si pas déjà installé)

```bash
npm install pm2 -g
```

### Création du dossier de logs

```bash
# Windows PowerShell
New-Item -ItemType Directory -Force -Path ./logs

# Linux/Mac
mkdir -p logs
```

### Démarrage avec PM2

```bash
# Démarrer l'application
pm2 start ecosystem.config.js

# Voir les logs en temps réel
pm2 logs cloudfne

# Voir le statut
pm2 status

# Redémarrer l'application
pm2 restart cloudfne

# Arrêter l'application
pm2 stop cloudfne

# Supprimer l'application de PM2
pm2 delete cloudfne
```

### Configuration du démarrage automatique au boot

#### Sur Linux/Mac

```bash
# Générer le script de démarrage automatique
pm2 startup

# Sauvegarder la configuration actuelle
pm2 save
```

#### Sur Windows

Sur Windows, `pm2 startup` ne fonctionne pas. Utilisez l'une des méthodes suivantes :

**Option 1 : Utiliser pm2-windows-startup (Recommandé)**

```bash
# Installer pm2-windows-startup
npm install -g pm2-windows-startup

# Configurer le démarrage automatique (utiliser npx si la commande n'est pas trouvée)
npx pm2-windows-startup install

# Démarrer l'application et sauvegarder
pm2 start ecosystem.config.js
pm2 save
```

**Note** : Si la commande `pm2-windows-startup` n'est pas reconnue après l'installation, utilisez `npx pm2-windows-startup install` à la place.

**Option 2 : Créer une tâche planifiée Windows**

1. Ouvrez le Planificateur de tâches Windows
2. Créez une nouvelle tâche
3. Déclencheur : "Au démarrage"
4. Action : Exécuter un programme
   - Programme : `pm2`
   - Arguments : `resurrect`
   - Démarrer dans : Chemin vers votre projet

**Option 3 : Utiliser pm2-windows-service**

```bash
# Installer pm2-windows-service
npm install -g pm2-windows-service

# Installer le service
pm2-service-install

# Démarrer l'application
pm2 start ecosystem.config.js
pm2 save
```

## 6. Commandes PM2 utiles

```bash
# Monitoring en temps réel
pm2 monit

# Redémarrer toutes les applications
pm2 restart all

# Recharger sans interruption (zero-downtime)
pm2 reload cloudfne

# Voir les informations détaillées
pm2 show cloudfne

# Voir les logs (dernières 100 lignes)
pm2 logs cloudfne --lines 100

# Vider les logs
pm2 flush
```

## 7. Mode développement (sans PM2)

```bash
npm run dev
```

## Dépannage

- Si l'application ne démarre pas, vérifiez les logs : `pm2 logs cloudfne`
- Vérifiez que le port 3000 n'est pas déjà utilisé
- Assurez-vous que la base de données est accessible
- Vérifiez les variables d'environnement avec `pm2 env 0`



