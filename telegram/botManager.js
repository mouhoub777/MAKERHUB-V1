// backend/bots/botManager.js
// Gestionnaire minimal - le vrai bot est côté Python

class BotManager {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        console.log('🤖 Bot Manager initialisé (le bot Python fait le travail)');
        this.initialized = true;
        return Promise.resolve();
    }

    async shutdown() {
        console.log('🛑 Bot Manager arrêté');
        this.initialized = false;
        return Promise.resolve();
    }

    getStatus() {
        return {
            initialized: this.initialized,
            message: 'Le bot de signaux est géré par le service Python sur le port 5001'
        };
    }
}

module.exports = new BotManager();