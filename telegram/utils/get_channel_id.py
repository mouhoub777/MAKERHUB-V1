
from telethon.sync import TelegramClient
from telethon.tl.functions.channels import JoinChannelRequest
from dotenv import load_dotenv
import os

# Charger les variables d’environnement
load_dotenv()

api_id = int(os.getenv("TELEGRAM_API_ID"))
api_hash = os.getenv("TELEGRAM_API_HASH")

link = input("🔗 Lien du canal (ex: https://t.me/+xxxx) : ")

with TelegramClient("userbot_session", api_id, api_hash) as client:
    client.start()
    try:
        print("🔁 Tentative de rejoindre le canal...")
        client(JoinChannelRequest(link))
        entity = client.get_entity(link)
        channel_id = f"-100{entity.id}"
        print(f"✅ Le userbot a rejoint le canal.")
        print(f"📡 ID du canal : {channel_id}")
    except Exception as e:
        print(f"❌ Erreur : {e}")
