
from telethon.sync import TelegramClient
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()
api_id = int(os.getenv("TELEGRAM_API_ID"))
api_hash = os.getenv("TELEGRAM_API_HASH")

def get_channel_id_from_link(link):
    async def fetch_channel_id():
        async with TelegramClient("userbot_session", api_id, api_hash) as client:
            try:
                entity = await client.get_entity(link)
                return entity.id
            except Exception as e:
                print(f"Erreur lors de la récupération de l'ID du canal : {e}")
                return None

    return asyncio.run(fetch_channel_id())
