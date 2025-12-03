# telegram/config/__init__.py
"""
Configuration module for Telegram services
"""

from .database import db, get_db, initialize_firebase, test_connection, COLLECTIONS

__all__ = ['db', 'get_db', 'initialize_firebase', 'test_connection', 'COLLECTIONS']