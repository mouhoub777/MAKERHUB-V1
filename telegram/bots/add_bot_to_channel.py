import os
import asyncio
from telethon.sync import TelegramClient
from telethon.tl.functions.channels import InviteToChannelRequest
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

api_id = int(os.getenv("TELEGRAM_API_ID"))
api_hash = os.getenv("TELEGRAM_API_HASH")
phone = os.getenv("PHONE_NUMBER")
bot_username = os.getenv("BOT_USERNAME").replace('@', '')  # Enlever @ si présent

client = TelegramClient("session_userbot", api_id, api_hash)

async def add_bot(channel_link):
    await client.start(phone=phone)
    try:
        entity = await client.get_entity(channel_link)
        await client(InviteToChannelRequest(
            channel=entity,
            users=[bot_username]
        ))
        print(f"✅ Bot @{bot_username} ajouté dans {channel_link}")
        return True
    except Exception as e:
        print(f"❌ Erreur lors de l'ajout du bot : {e}")
        return False

if __name__ == "__main__":
    test_channel = input("Colle ici le lien du canal Telegram (@ ou lien complet) : ")
    asyncio.run(add_bot(test_channel))