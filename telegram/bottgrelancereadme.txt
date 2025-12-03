===============================================
🔔 BOT TELEGRAM RELANCE - @Makerhubreminder_bot
===============================================

📋 VUE D'ENSEMBLE
Système de rappels automatiques Telegram exclusivement pour les relances avec Firebase et cron jobs avancés.

===============================================
📁 FICHIERS REQUIS
===============================================

Fichiers essentiels :
📁 Telegram-Relance-Bot/
├── 📄 telegramreminder.js          ✅ Bot de relances @Makerhubreminder_bot
├── 📄 test_reminder_bot.js         ✅ Test du bot de relances
├── 📄 config/database.js           ✅ Configuration Firebase
├── 📄 serviceAccountKey.json       ✅ Clés Firebase
├── 📄 firebase.json                ✅ Config Firebase
├── 📄 .env                         ✅ Variables bot de relances
├── 📄 package.json                 ✅ Dépendances Node.js
└── 📄 bottgrelancereadme.txt       ✅ Documentation (ce fichier)

===============================================
🔧 CONFIGURATION .ENV
===============================================

Variables requises :
# 🔔 TELEGRAM BOT REMINDER (@Makerhubreminder_bot) - Pour les relances UNIQUEMENT
REMINDER_BOT_TOKEN=**********************:***************************
REMINDER_BOT_USERNAME=@Makerhubreminder_bot

# 🔥 FIREBASE
FIREBASE_PROJECT_ID=autosub-ab7b1
FIREBASE_STORAGE_BUCKET=autosub-ab7b1.appspot.com

# ⚙️ SERVEUR
NODE_ENV=production
PORT=4040

===============================================
🚀 INSTALLATION ET LANCEMENT
===============================================

1. Installation des dépendances :
npm install telegraf firebase-admin node-cron dotenv

2. Configuration Firebase :
- Placer serviceAccountKey.json à la racine
- Vérifier firebase.json et firestore.indexes.json

3. Test du bot :
node test_reminder_bot.js

4. Lancement du système :
node telegramreminder.js

5. Vérification :
Le bot affiche :
✅ Makerhubreminder_bot started successfully!
🔗 Bot link: https://t.me/Makerhubreminder_bot
🚀 Telegram reminder bot is fully operational!

===============================================
✨ FONCTIONNALITÉS
===============================================

🔔 Rappels automatiques :
- ✅ Persistance Firebase (pas de perte de données)
- ✅ Cron jobs toutes les 2 minutes
- ✅ Rappels programmables avant événements
- ✅ Support multi-utilisateurs avec tokens uniques

🤖 Bot Telegram avancé :
- ✅ Framework Telegraf
- ✅ Inscription via liens spéciaux /start reminder_TOKEN
- ✅ Commandes /stop, /info, /help
- ✅ Messages personnalisés avec liens directs

💾 Base de données Firebase :
- ✅ Firestore pour stockage persistant
- ✅ Collection registrations avec tokens
- ✅ Tracking des rappels envoyés
- ✅ Gestion des utilisateurs Telegram

===============================================
📊 ARCHITECTURE TECHNIQUE
===============================================

Stack technologique :
- Node.js - Runtime JavaScript
- Telegraf - Framework Telegram Bot
- Firebase Admin - Base de données Firestore
- Node-cron - Tâches programmées
- @Makerhubreminder_bot - Bot Telegram officiel
- telegramreminder.js - Fichier principal du bot

Collection Firebase :
📊 Firestore Collection: registrations
├── telegramStartToken     # Token unique d'inscription
├── telegramUserId         # ID utilisateur Telegram
├── telegramUsername       # Username Telegram
├── eventType             # Type d'événement
├── trainerName           # Nom du formateur
├── eventDate             # Date de l'événement
├── reminderTime          # Minutes avant l'événement
├── liveLink              # Lien direct vers le live
├── reminderSent          # Statut d'envoi
└── reminderSentAt        # Date d'envoi du rappel

===============================================
🔗 UTILISATION
===============================================

1. Inscription utilisateur :
https://t.me/Makerhubreminder_bot?start=reminder_TOKEN_UNIQUE

2. Commandes disponibles :
/start reminder_TOKEN  → S'inscrire avec token
/stop                  → Se désinscrire de tous les rappels
/info                  → Voir ses rappels actifs

3. Flux automatique :
- Utilisateur clique sur lien d'inscription
- Bot configure les rappels automatiquement
- Cron job vérifie toutes les 2 minutes
- Rappel envoyé avec lien direct vers le live

===============================================
🛠️ FONCTIONNEMENT TECHNIQUE
===============================================

Processus de rappel :
1. Inscription : Via token unique dans URL
2. Stockage : Données sauvées dans Firestore
3. Calcul : Date de rappel = eventDate - reminderTime
4. Cron : Vérification toutes les 2 minutes
5. Envoi : Message avec lien direct si c'est l'heure
6. Tracking : Marquage comme envoyé pour éviter doublons

Gestion des erreurs :
- Reconnexion automatique Firebase
- Logs détaillés pour debugging
- Gestion des utilisateurs bloqués/supprimés

===============================================
📈 MONITORING ET LOGS
===============================================

Logs automatiques :
🤖 Initializing Makerhubreminder Telegram Bot...
✅ Bot database connection established
✅ Makerhubreminder_bot started successfully!
⏰ Reminder check: [timestamp]
✅ Reminder sent to: email | Live link: url

Health check :
- Cron job santé toutes les heures
- Vérification connexion Firebase
- Monitoring des rappels envoyés

Stats base de données :
- Nombre d'utilisateurs inscrits
- Événements programmés
- Rappels envoyés aujourd'hui

===============================================
🔒 SÉCURITÉ
===============================================

Tokens et authentification :
- Token unique par inscription (reminder_TOKEN)
- Validation des tokens avant configuration
- Clés Firebase sécurisées dans serviceAccountKey.json

Variables sensibles :
- Tokens bot dans .env (jamais commités)
- Clés Firebase sécurisées
- CORS configuré pour domaines autorisés

Validation :
- Vérification des tokens d'inscription
- Validation des dates d'événements
- Protection contre spam

===============================================
🚨 DÉPANNAGE
===============================================

Problèmes courants :

Bot ne répond pas :
# Vérifier le token dans .env
echo $REMINDER_BOT_TOKEN

# Tester la connexion
node test_reminder_bot.js

# Vérifier les logs
node telegramreminder.js

Firebase connexion échoue :
# Vérifier le fichier de clés
ls -la serviceAccountKey.json

# Tester la connexion
node -e "require('./config/database').checkConnection()"

Rappels non envoyés :
# Vérifier les cron jobs dans les logs
# Rechercher: "⏰ Reminder check"
# Et: "✅ Reminder sent to"

Health check API :
curl http://localhost:4040/api/health

===============================================
📞 SUPPORT TECHNIQUE
===============================================

Commandes de diagnostic :
- Vérifier les logs du bot
- Tester la connexion Firebase
- Valider la configuration .env
- Vérifier les données dans Firestore

Bot officiel :
- Nom : @Makerhubreminder_bot
- Lien : https://t.me/Makerhubreminder_bot
- Token : **********************:***************************
- Fonction : RELANCES AUTOMATIQUES UNIQUEMENT

===============================================

Version : Bot de relances @Makerhubreminder_bot UNIQUEMENT
Dernière mise à jour : Août 2025
Statut : Production Ready 🚀

🔔 BOT DE RELANCES AUTOMATIQUES SPÉCIALISÉ !

===============================================