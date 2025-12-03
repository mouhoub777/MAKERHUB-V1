# telegram/telegram_app.py
import os
import sys
import asyncio
import logging
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials
from routes.telegram_routes import telegram_bp
from services.TelegramBotHandler import TelegramBotHandler

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')

# Configure CORS
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://localhost:5000", "https://makerhub.pro"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Initialize Firebase Admin SDK
def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    try:
        # Check if already initialized
        if len(firebase_admin._apps) > 0:
            logger.info("Firebase already initialized")
            return
        
        # Get service account path from environment
        service_account_path = os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH')
        
        if service_account_path and os.path.exists(service_account_path):
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            logger.info("✅ Firebase Admin SDK initialized with service account")
        else:
            # Try to initialize with default credentials
            firebase_admin.initialize_app()
            logger.info("✅ Firebase Admin SDK initialized with default credentials")
            
    except Exception as error:
        logger.error(f"❌ Error initializing Firebase: {error}")
        # Continue without Firebase if initialization fails
        pass

# Initialize Firebase
initialize_firebase()

# Register blueprints
app.register_blueprint(telegram_bp)

# Initialize Telegram Bot Handler
bot_handler = None

async def start_telegram_bots():
    """Start Telegram bots"""
    global bot_handler
    try:
        bot_handler = TelegramBotHandler()
        await bot_handler.start_polling()
        logger.info("✅ Telegram bots started")
    except Exception as error:
        logger.error(f"❌ Error starting Telegram bots: {error}")

def run_async_task(coro):
    """Run async task in a new event loop"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()

# Root endpoint
@app.route('/')
def index():
    """Root endpoint"""
    return jsonify({
        'service': 'MAKERHUB Telegram Service',
        'version': '1.0.0',
        'status': 'active',
        'endpoints': {
            'creator-bot': '/api/telegram/creator-bot',
            'lists': '/api/telegram/lists',
            'campaigns': '/api/telegram/campaigns',
            'translate': '/api/telegram/translate',
            'validate': '/api/telegram/validate-channel'
        }
    })

# Health check endpoint
@app.route('/health')
def health_check():
    """Health check endpoint"""
    from datetime import datetime
    return jsonify({
        'status': 'healthy',
        'service': 'telegram-service',
        'timestamp': datetime.now().isoformat()
    })

# Error handlers
@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        'success': False,
        'message': 'Endpoint not found',
        'error': str(error)
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {error}")
    return jsonify({
        'success': False,
        'message': 'Internal server error',
        'error': str(error)
    }), 500

@app.errorhandler(Exception)
def handle_exception(error):
    """Handle all other exceptions"""
    logger.error(f"Unhandled exception: {error}")
    return jsonify({
        'success': False,
        'message': 'An error occurred',
        'error': str(error)
    }), 500

# Shutdown handler
def shutdown_handler():
    """Clean shutdown of services"""
    global bot_handler
    if bot_handler:
        logger.info("Shutting down Telegram bots...")
        run_async_task(bot_handler.stop_bots())
    logger.info("✅ Shutdown complete")

# Register shutdown handler
import atexit
atexit.register(shutdown_handler)

# Main entry point
if __name__ == '__main__':
    try:
        # Start Telegram bots in a separate thread
        import threading
        
        def start_bots():
            asyncio.run(start_telegram_bots())
        
        bot_thread = threading.Thread(target=start_bots, daemon=True)
        bot_thread.start()
        
        # Get port from environment or use default
        port = int(os.getenv('PORT', 5001))
        
        # Start Flask app
        logger.info(f"🚀 Starting MAKERHUB Telegram Service on port {port}")
        app.run(
            host='0.0.0.0',
            port=port,
            debug=os.getenv('FLASK_ENV') == 'development',
            use_reloader=False  # Disable reloader to avoid issues with threads
        )
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
        shutdown_handler()
    except Exception as error:
        logger.error(f"Failed to start server: {error}")
        sys.exit(1)