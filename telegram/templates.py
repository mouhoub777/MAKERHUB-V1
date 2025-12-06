# telegram/templates.py
"""
Templates HTML pour les pages de succès, annulation et erreur
MAKERHUB V1
"""


def get_success_html(session_id=None, page_id=None):
    """Template HTML pour la page de succès après paiement"""
    return '''
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paiement réussi - MakerHub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }
        .container { text-align: center; padding: 40px; max-width: 500px; }
        .success-icon {
            width: 80px; height: 80px;
            background: linear-gradient(135deg, #00c853, #00e676);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 24px;
            animation: pulse 2s infinite;
        }
        .success-icon svg { width: 40px; height: 40px; fill: white; }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        h1 { font-size: 28px; margin-bottom: 16px; color: #00e676; }
        p { font-size: 16px; color: #aaa; margin-bottom: 24px; line-height: 1.6; }
        .btn {
            display: inline-block; padding: 14px 32px;
            background: linear-gradient(135deg, #ffd600, #ffab00);
            color: #000; text-decoration: none; border-radius: 8px;
            font-weight: 600; transition: transform 0.2s;
        }
        .btn:hover { transform: translateY(-2px); }
        .info {
            margin-top: 32px; padding: 16px;
            background: rgba(255,255,255,0.05); border-radius: 8px;
            font-size: 14px; color: #888;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="success-icon">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        </div>
        <h1>Paiement réussi !</h1>
        <p>Merci pour votre achat ! Vous allez recevoir un email de confirmation avec les instructions d'accès.</p>
        <p>Si vous avez connecté Telegram, vérifiez vos messages pour recevoir votre lien d'invitation au canal.</p>
        <a href="https://t.me/Makerhubsub_bot" class="btn">Ouvrir Telegram</a>
        <div class="info">Un problème ? Contactez-nous à support@makerhub.pro</div>
    </div>
</body>
</html>
'''


def get_cancel_html(page_id=None):
    """Template HTML pour la page d'annulation"""
    return '''
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Paiement annulé - MakerHub</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
            min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
            color: #fff;
        }
        .container { text-align: center; padding: 40px; max-width: 500px; }
        .cancel-icon {
            width: 80px; height: 80px;
            background: linear-gradient(135deg, #ff9800, #ffc107);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 24px;
        }
        .cancel-icon svg { width: 40px; height: 40px; fill: white; }
        h1 { font-size: 28px; margin-bottom: 16px; color: #ffc107; }
        p { font-size: 16px; color: #aaa; margin-bottom: 24px; line-height: 1.6; }
        .btn {
            display: inline-block; padding: 14px 32px;
            background: linear-gradient(135deg, #ffd600, #ffab00);
            color: #000; text-decoration: none; border-radius: 8px;
            font-weight: 600; transition: transform 0.2s; margin: 8px;
        }
        .btn:hover { transform: translateY(-2px); }
        .btn-secondary { background: rgba(255,255,255,0.1); color: #fff; }
    </style>
</head>
<body>
    <div class="container">
        <div class="cancel-icon">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        </div>
        <h1>Paiement annulé</h1>
        <p>Votre paiement a été annulé. Aucun montant n'a été débité de votre compte.</p>
        <a href="javascript:history.back()" class="btn">Réessayer</a>
        <a href="https://makerhub.pro" class="btn btn-secondary">Retour à l'accueil</a>
    </div>
</body>
</html>
'''


def get_error_html(error_message='Une erreur est survenue', error_code=None):
    """Template HTML pour les pages d'erreur"""
    error_code_html = f'<br><small>Code: {error_code}</small>' if error_code else ''
    return f'''
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erreur - MakerHub</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
            min-height: 100vh;
            display: flex; align-items: center; justify-content: center;
            color: #fff;
        }}
        .container {{ text-align: center; padding: 40px; max-width: 500px; }}
        .error-icon {{
            width: 80px; height: 80px;
            background: linear-gradient(135deg, #f44336, #e91e63);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            margin: 0 auto 24px;
        }}
        .error-icon svg {{ width: 40px; height: 40px; fill: white; }}
        h1 {{ font-size: 28px; margin-bottom: 16px; color: #f44336; }}
        p {{ font-size: 16px; color: #aaa; margin-bottom: 24px; line-height: 1.6; }}
        .error-details {{
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid rgba(244, 67, 54, 0.3);
            border-radius: 8px; padding: 16px; margin-bottom: 24px;
            font-family: monospace; font-size: 14px; color: #ff8a80;
        }}
        .btn {{
            display: inline-block; padding: 14px 32px;
            background: linear-gradient(135deg, #ffd600, #ffab00);
            color: #000; text-decoration: none; border-radius: 8px;
            font-weight: 600; transition: transform 0.2s; margin: 8px;
        }}
        .btn:hover {{ transform: translateY(-2px); }}
        .btn-secondary {{ background: rgba(255,255,255,0.1); color: #fff; }}
        .info {{
            margin-top: 32px; padding: 16px;
            background: rgba(255,255,255,0.05); border-radius: 8px;
            font-size: 14px; color: #888;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="error-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </div>
        <h1>Oups ! Une erreur est survenue</h1>
        <p>Nous n'avons pas pu traiter votre demande. Veuillez réessayer ou contacter notre support.</p>
        <div class="error-details">{error_message}{error_code_html}</div>
        <a href="javascript:history.back()" class="btn">Réessayer</a>
        <a href="https://makerhub.pro" class="btn btn-secondary">Retour à l'accueil</a>
        <div class="info">Besoin d'aide ? Contactez-nous à support@makerhub.pro</div>
    </div>
</body>
</html>
'''