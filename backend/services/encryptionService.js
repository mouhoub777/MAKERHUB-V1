// backend/services/encryptionService.js
const crypto = require('crypto');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        
        // Récupérer la clé depuis l'environnement ou générer une clé sécurisée
        const envKey = process.env.ENCRYPTION_KEY;
        
        if (!envKey) {
            console.warn('⚠️ ENCRYPTION_KEY non définie dans .env - Utilisation d\'une clé temporaire');
            console.warn('⚠️ Pour la production, générez une clé avec: openssl rand -base64 32');
            // Clé temporaire pour le développement uniquement
            this.key = crypto.createHash('sha256').update('makerhub-dev-key-2025').digest();
        } else if (envKey.length < 32) {
            console.error('❌ ENCRYPTION_KEY doit faire au moins 32 caractères');
            throw new Error('Clé de chiffrement invalide');
        } else {
            // Convertir la clé en Buffer de 32 octets pour AES-256
            this.key = crypto.createHash('sha256').update(envKey).digest();
        }
    }
    
    encrypt(text) {
        try {
            if (!text) {
                return null;
            }
            
            // Générer un IV aléatoire
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            // Chiffrer le texte
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Obtenir le tag d'authentification
            const authTag = cipher.getAuthTag();
            
            // Retourner le format: iv:authTag:encrypted
            return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
            
        } catch (error) {
            console.error('❌ Erreur de chiffrement:', error.message);
            throw new Error('Échec du chiffrement des données');
        }
    }
    
    decrypt(encryptedData) {
        try {
            if (!encryptedData) {
                return null;
            }
            
            // Parser les composants
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Format de données chiffrées invalide');
            }
            
            const iv = Buffer.from(parts[0], 'hex');
            const authTag = Buffer.from(parts[1], 'hex');
            const encrypted = parts[2];
            
            // Déchiffrer
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
            
        } catch (error) {
            console.error('❌ Erreur de déchiffrement:', error.message);
            throw new Error('Échec du déchiffrement des données');
        }
    }
    
    // Méthode utilitaire pour générer une clé sécurisée
    static generateSecureKey() {
        return crypto.randomBytes(32).toString('base64');
    }
    
    // Méthode pour hasher les mots de passe (différent du chiffrement)
    hashPassword(password) {
        const salt = crypto.randomBytes(16);
        const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
        return salt.toString('hex') + ':' + hash.toString('hex');
    }
    
    // Méthode pour vérifier un mot de passe hashé
    verifyPassword(password, hashedPassword) {
        try {
            const parts = hashedPassword.split(':');
            if (parts.length !== 2) {
                return false;
            }
            
            const salt = Buffer.from(parts[0], 'hex');
            const originalHash = parts[1];
            
            const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512');
            return hash.toString('hex') === originalHash;
            
        } catch (error) {
            console.error('❌ Erreur vérification mot de passe:', error.message);
            return false;
        }
    }
}

// Export singleton
module.exports = new EncryptionService();

// Export de la classe pour les tests
module.exports.EncryptionService = EncryptionService;