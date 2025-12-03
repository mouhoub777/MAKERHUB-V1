// backend/services/telegramService.js - Service Telegram MAKERHUB V1
'use strict';

const firebaseService = require('./firebaseService');

/**
 * Service Telegram pour la gestion des canaux et membres
 * Note: L'intégration bot complète est dans le service Python
 */
class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_TOKEN;
    this.botUsername = process.env.BOT_USERNAME || '@Makerhubsub_bot';
    this.pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';
  }

  // ==================== CHANNEL MANAGEMENT ====================

  /**
   * Connecter un canal Telegram à une page
   */
  async connectChannel(pageId, channelLink) {
    try {
      // Valider le lien
      const channelInfo = this.parseChannelLink(channelLink);
      if (!channelInfo) {
        throw new Error('Invalid Telegram channel link');
      }

      // Mettre à jour la page
      await firebaseService.updateLandingPage(pageId, {
        telegramChannelId: channelInfo.id || channelInfo.username,
        telegramChannelLink: channelLink,
        telegramConnected: true
      });

      return {
        success: true,
        channelId: channelInfo.id || channelInfo.username,
        channelLink: channelLink
      };

    } catch (error) {
      console.error('❌ Connect channel error:', error);
      throw error;
    }
  }

  /**
   * Déconnecter un canal Telegram
   */
  async disconnectChannel(pageId) {
    try {
      await firebaseService.updateLandingPage(pageId, {
        telegramChannelId: null,
        telegramChannelLink: null,
        telegramConnected: false
      });

      return { success: true };

    } catch (error) {
      console.error('❌ Disconnect channel error:', error);
      throw error;
    }
  }

  /**
   * Parser un lien de canal Telegram
   */
  parseChannelLink(link) {
    if (!link) return null;

    // Format: https://t.me/+hash (invite privé)
    const privateMatch = link.match(/t\.me\/\+([a-zA-Z0-9_-]+)/);
    if (privateMatch) {
      return { type: 'private', id: privateMatch[1] };
    }

    // Format: https://t.me/username (public)
    const publicMatch = link.match(/t\.me\/([a-zA-Z0-9_]+)/);
    if (publicMatch) {
      return { type: 'public', username: publicMatch[1] };
    }

    // Format: @username
    const usernameMatch = link.match(/^@([a-zA-Z0-9_]+)$/);
    if (usernameMatch) {
      return { type: 'public', username: usernameMatch[1] };
    }

    return null;
  }

  // ==================== MEMBER MANAGEMENT ====================

  /**
   * Ajouter un membre à un canal (via service Python)
   */
  async addMemberToChannel(pageId, telegramUserId, email) {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/telegram/add-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          telegram_user_id: telegramUserId,
          email: email
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add member');
      }

      const result = await response.json();

      // Enregistrer dans Firebase
      await firebaseService.addTelegramMember({
        pageId,
        telegramUserId,
        email,
        inviteLink: result.invite_link
      });

      return result;

    } catch (error) {
      console.error('❌ Add member to channel error:', error);
      throw error;
    }
  }

  /**
   * Retirer un membre d'un canal (via service Python)
   */
  async removeMemberFromChannel(pageId, telegramUserId) {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/telegram/remove-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          telegram_user_id: telegramUserId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to remove member');
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Remove member from channel error:', error);
      throw error;
    }
  }

  /**
   * Récupérer les membres d'une page
   */
  async getMembers(pageId) {
    return firebaseService.getTelegramMembersByPage(pageId);
  }

  /**
   * Compter les membres d'une page
   */
  async getMemberCount(pageId) {
    const members = await this.getMembers(pageId);
    return members.length;
  }

  // ==================== INVITE LINKS ====================

  /**
   * Créer un lien d'invitation (via service Python)
   */
  async createInviteLink(pageId, options = {}) {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/telegram/create-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page_id: pageId,
          expire_hours: options.expireHours || 24,
          member_limit: options.memberLimit || 1
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create invite link');
      }

      return await response.json();

    } catch (error) {
      console.error('❌ Create invite link error:', error);
      throw error;
    }
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Vérifier la connexion avec le service Python
   */
  async checkPythonService() {
    try {
      const response = await fetch(`${this.pythonServiceUrl}/api/health`);
      if (response.ok) {
        return { status: 'ok', service: 'python' };
      }
      return { status: 'error', service: 'python' };
    } catch (error) {
      return { status: 'unreachable', service: 'python', error: error.message };
    }
  }

  /**
   * Vérifier la configuration du bot
   */
  async checkBotConfig() {
    return {
      configured: !!this.botToken,
      botUsername: this.botUsername,
      pythonServiceUrl: this.pythonServiceUrl
    };
  }
}

// Export singleton
module.exports = new TelegramService();
