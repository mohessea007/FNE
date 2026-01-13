# Guide PM2 pour CloudFNE

Ce guide explique comment déployer et gérer CloudFNE avec PM2.

## Prérequis

1. Node.js installé
2. PM2 installé globalement : `npm install pm2 -g`
3. Application buildée : `npm run build`

## Démarrage rapide

### Méthode 1 : Script PowerShell (Windows)

```powershell
.\start-pm2.ps1
```

### Méthode 2 : Commande directe

```bash
pm2 start ecosystem.config.js
```

### Méthode 3 : Script npm

```bash
npm run pm2:start
```

## Commandes PM2 essentielles

### Gestion de l'application

```bash
# Démarrer
npm run pm2:start
# ou
pm2 start ecosystem.config.js

# Arrêter
npm run pm2:stop
# ou
pm2 stop cloudfne

# Redémarrer
npm run pm2:restart
# ou
pm2 restart cloudfne

# Recharger sans interruption (zero-downtime)
pm2 reload cloudfne

# Supprimer de PM2
npm run pm2:delete
# ou
pm2 delete cloudfne
```

### Monitoring et logs

```bash
# Voir le statut
npm run pm2:status
# ou
pm2 status

# Voir les logs en temps réel
npm run pm2:logs
# ou
pm2 logs cloudfne

# Voir les dernières 100 lignes
pm2 logs cloudfne --lines 100

# Monitoring en temps réel
npm run pm2:monit
# ou
pm2 monit

# Voir les informations détaillées
pm2 show cloudfne

# Vider les logs
pm2 flush
```

## Configuration du démarrage automatique

### Sur Linux/Mac

Pour que l'application démarre automatiquement au boot du serveur :

```bash
# Générer le script de démarrage automatique
pm2 startup

# Sauvegarder la configuration actuelle
npm run pm2:save
# ou
pm2 save
```

**Note** : Après `pm2 startup`, suivez les instructions affichées pour finaliser la configuration.

### Sur Windows

Sur Windows, `pm2 startup` ne fonctionne pas. Utilisez l'une des méthodes suivantes :

#### Option 1 : pm2-windows-startup (Recommandé)

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

#### Option 2 : Tâche planifiée Windows

1. Ouvrez le **Planificateur de tâches Windows** (Task Scheduler)
2. Créez une **nouvelle tâche**
3. Onglet **Général** :
   - Nom : `CloudFNE PM2 Startup`
   - Cochez "Exécuter que l'utilisateur soit connecté ou non"
4. Onglet **Déclencheurs** :
   - Nouveau → Au démarrage
5. Onglet **Actions** :
   - Nouveau → Action : Démarrer un programme
   - Programme : `pm2`
   - Arguments : `resurrect`
   - Démarrer dans : Chemin vers votre projet (ex: `E:\cours\fne_boti\cloudfnePro\cloudfnePro`)

#### Option 3 : pm2-windows-service

```bash
# Installer pm2-windows-service
npm install -g pm2-windows-service

# Installer le service Windows
pm2-service-install

# Démarrer l'application
pm2 start ecosystem.config.js
pm2 save
```

**Important** : Après avoir configuré le démarrage automatique, redémarrez votre ordinateur pour tester que l'application démarre bien automatiquement.

## Structure des logs

Les logs sont stockés dans le dossier `./logs/` :

- `pm2-error.log` - Erreurs
- `pm2-out.log` - Sortie standard
- `pm2-combined.log` - Logs combinés

## Configuration PM2

Le fichier `ecosystem.config.js` contient la configuration :

- **name** : `cloudfne` - Nom de l'application dans PM2
- **script** : Chemin vers le binaire Next.js
- **instances** : `1` - Nombre d'instances (1 pour le mode fork)
- **max_memory_restart** : `1G` - Redémarrage automatique si mémoire > 1GB
- **autorestart** : `true` - Redémarrage automatique en cas de crash
- **watch** : `false` - Pas de surveillance des fichiers (production)

## Variables d'environnement

Les variables d'environnement peuvent être définies dans :

1. Fichier `.env` à la racine du projet
2. Section `env` ou `env_production` dans `ecosystem.config.js`

Variables importantes :
- `DATABASE_URL` - URL de connexion à la base de données
- `JWT_SECRET` - Secret pour les tokens JWT
- `FNE_API_URL` - URL de l'API FNE (optionnel)
- `NODE_ENV` - Environnement (production)
- `PORT` - Port d'écoute (défaut: 3000)

## Dépannage

### L'application ne démarre pas

1. Vérifiez les logs : `pm2 logs cloudfne`
2. Vérifiez que le build existe : `ls .next`
3. Vérifiez les variables d'environnement : `pm2 env 0`
4. Vérifiez que le port n'est pas utilisé : `netstat -ano | findstr :3000`

### L'application crash en boucle

1. Vérifiez les logs d'erreur : `pm2 logs cloudfne --err`
2. Vérifiez la mémoire : `pm2 monit`
3. Vérifiez la connexion à la base de données
4. Augmentez `max_memory_restart` si nécessaire

### Redémarrer après un changement de code

```bash
# 1. Rebuild l'application
npm run build

# 2. Redémarrer avec PM2
pm2 restart cloudfne
```

## Mise à jour de l'application

```bash
# 1. Arrêter l'application
pm2 stop cloudfne

# 2. Pull les dernières modifications (si Git)
git pull

# 3. Installer les dépendances
npm install

# 4. Générer Prisma Client
npx prisma generate

# 5. Appliquer les migrations
npm run db:migrate

# 6. Rebuild
npm run build

# 7. Redémarrer
pm2 start cloudfne
```

## Performance

Pour améliorer les performances en production, vous pouvez :

1. **Augmenter le nombre d'instances** (mode cluster) :
   ```js
   instances: 2, // ou 'max' pour utiliser tous les CPU
   exec_mode: "cluster"
   ```

2. **Optimiser la mémoire** :
   ```js
   max_memory_restart: "2G"
   ```

3. **Activer le cache Next.js** dans `next.config.js`

## Sécurité

- Ne jamais commiter le fichier `.env`
- Utiliser des secrets forts pour `JWT_SECRET`
- Configurer un firewall pour limiter l'accès au port 3000
- Utiliser HTTPS en production avec un reverse proxy (nginx)



