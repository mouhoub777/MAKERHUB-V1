# telegram/templates/__init__.py - Templates HTML MAKERHUB V1

SUCCESS_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Successful - MAKERHUB</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #10b981, #059669);
            padding: 20px;
        }
        .container {
            background: white;
            padding: 48px;
            border-radius: 24px;
            text-align: center;
            max-width: 480px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
        }
        .icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 40px;
            animation: bounce 0.6s ease;
        }
        @keyframes bounce {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        h1 {
            font-size: 28px;
            color: #18181b;
            margin-bottom: 12px;
        }
        p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .info-box {
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
            border-radius: 12px;
            padding: 16px;
            margin-bottom: 24px;
        }
        .info-box p {
            color: #166534;
            margin: 0;
            font-size: 14px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 14px 28px;
            background: #18181b;
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
        }
        .footer {
            margin-top: 32px;
            font-size: 13px;
            color: #9ca3af;
        }
        .footer a {
            color: #6b7280;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✅</div>
        <h1>Payment Successful!</h1>
        <p>Thank you for your purchase. Your payment has been processed successfully.</p>
        
        <div class="info-box">
            <p>📱 Check your Telegram messages for your exclusive access link!</p>
        </div>
        
        <a href="https://t.me/{bot_username}" class="btn">
            Open Telegram
        </a>
        
        <p class="footer">
            Powered by <a href="https://makerhub.pro">MAKERHUB</a>
        </p>
    </div>
</body>
</html>
"""

CANCEL_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Cancelled - MAKERHUB</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            padding: 20px;
        }
        .container {
            background: white;
            padding: 48px;
            border-radius: 24px;
            text-align: center;
            max-width: 480px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
        }
        .icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #fecaca, #fca5a5);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 40px;
        }
        h1 {
            font-size: 28px;
            color: #18181b;
            margin-bottom: 12px;
        }
        p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 14px 28px;
            background: #18181b;
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
        }
        .btn-secondary {
            background: white;
            color: #18181b;
            border: 2px solid #e5e7eb;
            margin-left: 12px;
        }
        .footer {
            margin-top: 32px;
            font-size: 13px;
            color: #9ca3af;
        }
        .footer a {
            color: #6b7280;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">❌</div>
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled. No charges have been made to your account.</p>
        
        <a href="javascript:history.back()" class="btn">
            ← Go Back
        </a>
        <a href="https://makerhub.pro" class="btn btn-secondary">
            Home
        </a>
        
        <p class="footer">
            Powered by <a href="https://makerhub.pro">MAKERHUB</a>
        </p>
    </div>
</body>
</html>
"""

ERROR_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - MAKERHUB</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', sans-serif;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #6b7280, #4b5563);
            padding: 20px;
        }
        .container {
            background: white;
            padding: 48px;
            border-radius: 24px;
            text-align: center;
            max-width: 480px;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
        }
        .icon {
            width: 80px;
            height: 80px;
            background: linear-gradient(135deg, #fde68a, #fbbf24);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 24px;
            font-size: 40px;
        }
        h1 {
            font-size: 28px;
            color: #18181b;
            margin-bottom: 12px;
        }
        p {
            color: #6b7280;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 24px;
        }
        .error-code {
            background: #f3f4f6;
            padding: 12px 16px;
            border-radius: 8px;
            font-family: monospace;
            color: #ef4444;
            margin-bottom: 24px;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 14px 28px;
            background: #18181b;
            color: white;
            text-decoration: none;
            border-radius: 12px;
            font-weight: 600;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(0, 0, 0, 0.15);
        }
        .footer {
            margin-top: 32px;
            font-size: 13px;
            color: #9ca3af;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">⚠️</div>
        <h1>Something went wrong</h1>
        <p>{error_message}</p>
        
        <div class="error-code">{error_code}</div>
        
        <a href="https://makerhub.pro" class="btn">
            Return to Home
        </a>
        
        <p class="footer">
            If this problem persists, contact support@makerhub.pro
        </p>
    </div>
</body>
</html>
"""

def get_success_html(bot_username: str = "Makerhubsub_bot") -> str:
    """Générer la page de succès"""
    return SUCCESS_TEMPLATE.format(bot_username=bot_username.replace('@', ''))

def get_cancel_html() -> str:
    """Générer la page d'annulation"""
    return CANCEL_TEMPLATE

def get_error_html(error_message: str = "An unexpected error occurred.", error_code: str = "UNKNOWN_ERROR") -> str:
    """Générer la page d'erreur"""
    return ERROR_TEMPLATE.format(error_message=error_message, error_code=error_code)
