# redis_cache.py - Module de cache Redis pour le backend Python MAKERHUB

import redis
import json
import os
import logging
from functools import wraps
from datetime import datetime, timedelta
from typing import Any, Optional, Callable
import pickle

# Configuration du logging
logger = logging.getLogger(__name__)

class RedisCache:
    """Classe de gestion du cache Redis pour MAKERHUB Python"""
    
    def __init__(self, host='localhost', port=6380, db=0, decode_responses=False):
        """
        Initialise la connexion Redis
        
        Args:
            host: Hôte Redis (par défaut localhost)
            port: Port Redis (6380 pour MAKERHUB)
            db: Numéro de la base Redis
            decode_responses: Si True, décode automatiquement les réponses
        """
        self.host = os.getenv('REDIS_HOST', host)
        self.port = int(os.getenv('REDIS_PORT', port))
        self.db = db
        self.client = None
        self.is_connected = False
        
        try:
            self.client = redis.Redis(
                host=self.host,
                port=self.port,
                db=db,
                decode_responses=decode_responses,
                socket_connect_timeout=5,
                socket_timeout=5
            )
            # Test de connexion
            self.client.ping()
            self.is_connected = True
            logger.info(f"✅ Redis connecté sur {self.host}:{self.port}")
        except (redis.ConnectionError, redis.TimeoutError) as e:
            logger.warning(f"⚠️ Redis non disponible: {e}")
            logger.info("L'application continuera sans cache")
            self.is_connected = False
    
    def get(self, key: str) -> Optional[Any]:
        """
        Récupère une valeur du cache
        
        Args:
            key: Clé à récupérer
            
        Returns:
            Valeur décodée ou None si non trouvée
        """
        if not self.is_connected:
            return None
            
        try:
            value = self.client.get(key)
            if value:
                # Essayer de décoder en JSON d'abord
                try:
                    return json.loads(value)
                except (json.JSONDecodeError, TypeError):
                    # Si échec, essayer pickle
                    try:
                        return pickle.loads(value)
                    except:
                        # Retourner la valeur brute
                        return value.decode('utf-8') if isinstance(value, bytes) else value
            return None
        except Exception as e:
            logger.error(f"Erreur Redis GET {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = 300) -> bool:
        """
        Stocke une valeur dans le cache
        
        Args:
            key: Clé de stockage
            value: Valeur à stocker
            ttl: Temps d'expiration en secondes (défaut 5 minutes)
            
        Returns:
            True si succès, False sinon
        """
        if not self.is_connected:
            return False
            
        try:
            # Encoder la valeur
            if isinstance(value, (dict, list)):
                encoded_value = json.dumps(value)
            elif isinstance(value, (str, int, float, bool)):
                encoded_value = json.dumps(value)
            else:
                # Pour les objets complexes, utiliser pickle
                encoded_value = pickle.dumps(value)
            
            # Stocker avec TTL
            if ttl:
                self.client.setex(key, ttl, encoded_value)
            else:
                self.client.set(key, encoded_value)
            
            return True
        except Exception as e:
            logger.error(f"Erreur Redis SET {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Supprime une clé du cache
        
        Args:
            key: Clé à supprimer
            
        Returns:
            True si supprimée, False sinon
        """
        if not self.is_connected:
            return False
            
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Erreur Redis DELETE {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        """
        Vérifie si une clé existe
        
        Args:
            key: Clé à vérifier
            
        Returns:
            True si existe, False sinon
        """
        if not self.is_connected:
            return False
            
        try:
            return self.client.exists(key) > 0
        except Exception as e:
            logger.error(f"Erreur Redis EXISTS {key}: {e}")
            return False
    
    def incr(self, key: str, amount: int = 1) -> int:
        """
        Incrémente une valeur
        
        Args:
            key: Clé à incrémenter
            amount: Montant d'incrémentation
            
        Returns:
            Nouvelle valeur après incrémentation
        """
        if not self.is_connected:
            return 1
            
        try:
            return self.client.incr(key, amount)
        except Exception as e:
            logger.error(f"Erreur Redis INCR {key}: {e}")
            return 1
    
    def expire(self, key: str, seconds: int) -> bool:
        """
        Définit un TTL sur une clé existante
        
        Args:
            key: Clé cible
            seconds: TTL en secondes
            
        Returns:
            True si TTL défini, False sinon
        """
        if not self.is_connected:
            return False
            
        try:
            return self.client.expire(key, seconds)
        except Exception as e:
            logger.error(f"Erreur Redis EXPIRE {key}: {e}")
            return False
    
    def flush_pattern(self, pattern: str) -> int:
        """
        Supprime toutes les clés correspondant à un pattern
        
        Args:
            pattern: Pattern de clés (ex: "landing:*")
            
        Returns:
            Nombre de clés supprimées
        """
        if not self.is_connected:
            return 0
            
        try:
            keys = self.client.keys(pattern)
            if keys:
                return self.client.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Erreur Redis FLUSH_PATTERN {pattern}: {e}")
            return 0

# Instance globale du cache
redis_cache = RedisCache()

def cache_result(ttl: int = 300, key_prefix: str = None):
    """
    Décorateur pour mettre en cache le résultat d'une fonction
    
    Args:
        ttl: Temps d'expiration en secondes
        key_prefix: Préfixe personnalisé pour la clé
        
    Usage:
        @cache_result(ttl=600, key_prefix="landing")
        def get_landing_page(slug):
            return fetch_from_database(slug)
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Construire la clé de cache
            if key_prefix:
                cache_key = f"{key_prefix}:{func.__name__}"
            else:
                cache_key = f"func:{func.__name__}"
            
            # Ajouter les arguments à la clé
            if args:
                cache_key += f":{':'.join(str(arg) for arg in args)}"
            if kwargs:
                cache_key += f":{':'.join(f'{k}={v}' for k, v in sorted(kwargs.items()))}"
            
            # Vérifier le cache
            cached_value = redis_cache.get(cache_key)
            if cached_value is not None:
                logger.info(f"📦 Cache hit: {cache_key}")
                return cached_value
            
            # Exécuter la fonction
            logger.info(f"🔍 Cache miss: {cache_key}")
            result = func(*args, **kwargs)
            
            # Mettre en cache le résultat
            redis_cache.set(cache_key, result, ttl)
            
            return result
        
        return wrapper
    return decorator

def invalidate_cache(pattern: str):
    """
    Invalide le cache pour un pattern donné
    
    Args:
        pattern: Pattern de clés à invalider
        
    Returns:
        Nombre de clés invalidées
    """
    count = redis_cache.flush_pattern(pattern)
    if count > 0:
        logger.info(f"🧹 Cache invalidé: {count} clés supprimées pour pattern '{pattern}'")
    return count

# Fonctions spécifiques pour les routes Python MAKERHUB

def cache_landing_page(slug: str, data: dict, ttl: int = 600):
    """
    Met en cache une landing page
    
    Args:
        slug: Slug de la landing page
        data: Données de la landing page
        ttl: TTL en secondes (défaut 10 minutes)
    """
    key = f"landing:{slug}"
    redis_cache.set(key, data, ttl)

def get_cached_landing_page(slug: str) -> Optional[dict]:
    """
    Récupère une landing page du cache
    
    Args:
        slug: Slug de la landing page
        
    Returns:
        Données de la landing page ou None
    """
    key = f"landing:{slug}"
    return redis_cache.get(key)

def invalidate_landing_cache(slug: str):
    """
    Invalide le cache d'une landing page
    
    Args:
        slug: Slug de la landing page
    """
    key = f"landing:{slug}"
    redis_cache.delete(key)
    # Invalider aussi les stats
    redis_cache.delete(f"landing:stats:{slug}")

def cache_landing_stats(slug: str, stats: dict, ttl: int = 300):
    """
    Met en cache les stats d'une landing page
    
    Args:
        slug: Slug de la landing page
        stats: Statistiques
        ttl: TTL en secondes (défaut 5 minutes)
    """
    key = f"landing:stats:{slug}"
    redis_cache.set(key, stats, ttl)

def get_cached_landing_stats(slug: str) -> Optional[dict]:
    """
    Récupère les stats d'une landing page du cache
    
    Args:
        slug: Slug de la landing page
        
    Returns:
        Statistiques ou None
    """
    key = f"landing:stats:{slug}"
    return redis_cache.get(key)

# Rate limiting pour le backend Python
def check_rate_limit(identifier: str, limit: int = 100, window: int = 60) -> tuple:
    """
    Vérifie le rate limit pour un identifiant
    
    Args:
        identifier: IP ou ID utilisateur
        limit: Nombre maximum de requêtes
        window: Fenêtre de temps en secondes
        
    Returns:
        Tuple (allowed: bool, remaining: int, reset_at: datetime)
    """
    if not redis_cache.is_connected:
        return (True, limit, None)
    
    key = f"ratelimit:python:{identifier}"
    
    # Incrémenter le compteur
    count = redis_cache.incr(key)
    
    # Si première requête, définir l'expiration
    if count == 1:
        redis_cache.expire(key, window)
    
    # Calculer le temps de reset
    ttl = redis_cache.client.ttl(key) if redis_cache.is_connected else 0
    reset_at = datetime.now() + timedelta(seconds=ttl) if ttl > 0 else None
    
    # Vérifier la limite
    allowed = count <= limit
    remaining = max(0, limit - count)
    
    return (allowed, remaining, reset_at)

# Middleware Flask pour le rate limiting
def rate_limit_middleware(app, limit=100, window=60):
    """
    Ajoute un middleware de rate limiting à l'app Flask
    
    Args:
        app: Application Flask
        limit: Limite de requêtes
        window: Fenêtre en secondes
    """
    @app.before_request
    def check_rate_limit_before_request():
        from flask import request, jsonify
        
        # Identifier le client
        identifier = request.remote_addr
        
        # Vérifier le rate limit
        allowed, remaining, reset_at = check_rate_limit(identifier, limit, window)
        
        # Ajouter les headers
        @app.after_request
        def add_rate_limit_headers(response):
            response.headers['X-RateLimit-Limit'] = str(limit)
            response.headers['X-RateLimit-Remaining'] = str(remaining)
            if reset_at:
                response.headers['X-RateLimit-Reset'] = reset_at.isoformat()
            return response
        
        # Bloquer si limite dépassée
        if not allowed:
            return jsonify({
                'error': 'Limite de requêtes dépassée',
                'retry_after': (reset_at - datetime.now()).seconds if reset_at else window
            }), 429

# Export des fonctions principales
__all__ = [
    'redis_cache',
    'cache_result',
    'invalidate_cache',
    'cache_landing_page',
    'get_cached_landing_page',
    'invalidate_landing_cache',
    'cache_landing_stats',
    'get_cached_landing_stats',
    'check_rate_limit',
    'rate_limit_middleware'
]