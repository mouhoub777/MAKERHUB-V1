# MAKERHUB V1 - Telegram Subscription Platform

## 🎯 Vue d'ensemble

MAKERHUB V1 est une plateforme permettant aux créateurs de monétiser leurs canaux Telegram via des abonnements payants automatisés.

## 📁 Structure du Projet

```
makerhubv1/
├── backend/                    # Service Node.js (API + Stripe Connect)
│   ├── config/
│   │   ├── database.js         # Configuration Firebase Admin
│   │   └── stripe.js           # Configuration Stripe
│   ├── routes/
│   │   ├── auth.js             # Routes authentification
│   │   ├── landing.js          # Routes landing pages
│   │   ├── stripe.js           # Routes Stripe Connect
│   │   ├── emails.js           # Routes emails
│   │   └── channels.js         # Routes canaux Telegram
│   └── services/
│       └── landingService.js   # Service génération landing pages
│
├── telegram/                   # Service Python (Bots + Stripe Checkout)
│   ├── app.py                  # Application Flask principale
│   └── requirements.txt        # Dépendances Python
│
├── frontend/                   # Interface utilisateur
│   ├── pages/
│   │   ├── auth.html           # Page authentification
│   │   ├── dashboard.html      # Dashboard principal
│   │   ├── telegramsubscription.html
│   │   ├── emails.html         # Gestion emails
│   │   ├── statistiques.html   # Analytics
│   │   ├── avis.html           # Gestion avis
│   │   ├── prix.html           # Configuration prix
│   │   ├── ajoutcanal.html     # Connexion canal
│   │   └── payments.html       # Paiements Stripe
│   └── assets/
│       ├── css/
│       │   └── global.css      # Styles globaux
│       └── js/
│           └── auth.js         # Script authentification
│
├── config/
│   └── firebase.js             # Configuration Firebase Frontend
│
├── utils/
│   └── constants.js            # Constantes globales
│
├── server.js                   # Serveur Node.js principal
├── package.json                # Dépendances Node.js
└── .env.example                # Template variables d'environnement
```

## 🚀 Installation

### Prérequis
- Node.js 18+
- Python 3.11+
- Compte Firebase
- Compte Stripe (avec Connect activé)
- Bot Telegram (@BotFather)

### 1. Cloner et installer

```bash
cd makerhubv1

# Backend Node.js
npm install

# Service Python
cd telegram
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
pip install -r requirements.txt
```

### 2. Configuration

Copier `.env.example` vers `.env` et remplir les valeurs:

```bash
cp .env.example .env
```

### 3. Firebase

Placer le fichier `firebase-service-account.json` à la racine du projet.

### 4. Démarrer les services

```bash
# Terminal 1 - Node.js (Port 3000)
npm start

# Terminal 2 - Python (Port 5001)
cd telegram
python app.py
```

## 📊 Pages Disponibles

| Page | URL | Description |
|------|-----|-------------|
| Auth | `/auth.html` | Connexion/Inscription |
| Dashboard | `/dashboard.html` | Vue d'ensemble |
| Telegram | `/telegramsubscription.html` | Gestion pages |
| Emails | `/emails.html` | Liste des emails |
| Analytics | `/statistiques.html` | Statistiques |
| Avis | `/avis.html` | Gestion des avis |
| Prix | `/prix.html` | Configuration tarifs |
| Canal | `/ajoutcanal.html` | Connexion Telegram |
| Paiements | `/payments.html` | Stripe Connect |

## 🔗 API Endpoints

### Node.js (Port 3000)

```
GET  /api/health                 # Health check
GET  /api/stripe-status          # Statut Stripe

# Landing Pages
GET  /api/landing/list           # Liste des pages
GET  /api/landing/:id            # Détails page
POST /api/landing/create         # Créer page
PUT  /api/landing/:id            # Modifier page
DELETE /api/landing/:id          # Supprimer page

# Stripe
POST /api/stripe/connect         # Connexion Stripe
GET  /api/stripe/dashboard       # Lien dashboard
POST /api/stripe/checkout        # Créer checkout

# Emails
GET  /api/emails/list            # Liste emails
GET  /api/emails/export          # Export CSV

# Channels
POST /api/channels/connect       # Connecter canal
```

### Python (Port 5001)

```
GET  /health                     # Health check
GET  /checkout/:page_id          # Créer checkout Stripe
POST /webhook                    # Webhook Stripe
```

## 💰 Flux de Paiement

1. Client visite la landing page (`/:profile/:channel`)
2. Clique sur le bouton de paiement
3. Redirigé vers Stripe Checkout (Python)
4. Paiement traité avec commission 5%
5. Webhook reçu → Ajout au canal Telegram
6. Email collecté dans Firebase

## 🛡️ Sécurité

- Authentification Firebase
- Webhooks Stripe vérifiés
- CORS configuré
- Rate limiting
- CSP Headers

## 📈 V1 Features

✅ Landing pages personnalisées
✅ Stripe Connect (commission 5%)
✅ Collection d'emails automatique
✅ Connexion canaux Telegram
✅ Dashboard analytics
✅ Gestion des avis
✅ Configuration des prix
✅ Multi-devises

## 🚧 Coming in V2

- Campagnes email SMTP
- Traduction multilingue
- Copy trading signals
- Abonnements récurrents

---

**Version**: 1.0.0
**Support**: live@makerhub.pro
