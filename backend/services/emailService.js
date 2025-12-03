// ==========================================
// EMAIL SERVICE
// ==========================================

const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
  constructor() {
    // Configuration du transporteur SMTP (Brevo)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true pour 465, false pour les autres ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Vérifier la connexion au démarrage
    this.verifyConnection();
  }

  /**
   * Vérifie la connexion SMTP
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Service email prêt (Brevo SMTP)');
    } catch (error) {
      console.error('❌ Erreur de connexion SMTP:', error);
    }
  }

  /**
   * Envoie un email personnalisé pour landing page (MÉTHODE PRINCIPALE UTILISÉE)
   */
  async sendCustomLandingEmail(emailData) {
    try {
      const { firstName, email, emailContent, brandName } = emailData;

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"BRANDLYNK" <noreply@brandlynk.com>',
        to: email,
        subject: `Merci ${firstName} - ${brandName}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Merci ${firstName} !</h2>
            <div>${emailContent || 'Merci pour votre inscription !'}</div>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              ${brandName} - Email automatique
            </p>
          </div>
        `
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email envoyé à ${email}`);
      return { success: true, messageId: result.messageId };

    } catch (error) {
      console.error('❌ Erreur envoi email:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoie un email de bienvenue
   */
  async sendWelcomeEmail(to, name, profileUrl) {
    const subject = 'Bienvenue sur BRANDLYNK! 🎉';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 30px; background: #ffd600; color: #000; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Bienvenue ${name}! 🚀</h1>
          </div>
          <div class="content">
            <p>Félicitations! Votre profil BRANDLYNK a été créé avec succès.</p>
            
            <h3>Voici vos prochaines étapes:</h3>
            <ul>
              <li>✅ Personnalisez votre profil</li>
              <li>📱 Connectez vos réseaux sociaux</li>
              <li>🎨 Créez vos premières pages</li>
              <li>🤖 Configurez votre bot Telegram</li>
            </ul>
            
            <center>
              <a href="${profileUrl}" class="button">Voir mon profil</a>
            </center>
            
            <p>Si vous avez des questions, n'hésitez pas à nous contacter!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} BRANDLYNK. Tous droits réservés.</p>
            <p>Cet email a été envoyé à ${to}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail(to, subject, html);
  }

  /**
   * Méthode générique pour envoyer un email
   */
  async sendEmail(to, subject, html, text = '') {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"BRANDLYNK" <noreply@brandlynk.com>',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('✅ Email envoyé:', {
        to,
        subject,
        messageId: info.messageId
      });

      return {
        success: true,
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convertit le HTML en texte brut (basique)
   */
  htmlToText(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Valide une adresse email
   */
  validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Test de connectivité
   */
  async testConnection() {
    try {
      await this.transporter.verify();
      return { success: true, message: 'Connexion OK' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

// Créer une instance unique (singleton)
const emailService = new EmailService();

// ✅ CORRECTION FINALE - Export correct
module.exports = emailService;