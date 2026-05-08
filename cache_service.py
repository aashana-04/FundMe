"""
FundMe — In-Memory Caching Layer.

Provides TTL-based caching for:
  - Recommendation results per user
  - AI insight results per user
  - Opportunity catalogue snapshots
  - Search/filter results

Designed for single-process deployment (SQLite).
Replace with Redis when scaling horizontally.
"""
import time
import threading
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class CacheEntry:
    __slots__ = ("value", "expires_at", "created_at")

    def __init__(self, value: Any, ttl_seconds: int):
        now = time.time()
        self.value = value
        self.created_at = now
        self.expires_at = now + ttl_seconds


class InMemoryCache:
    """Thread-safe in-memory cache with TTL expiration."""

    def __init__(self):
        self._store: dict[str, CacheEntry] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if time.time() > entry.expires_at:
                del self._store[key]
                return None
            return entry.value

    def set(self, key: str, value: Any, ttl: int = 300):
        """Store a value with TTL in seconds (default 5 min)."""
        with self._lock:
            self._store[key] = CacheEntry(value, ttl)

    def invalidate(self, key: str):
        with self._lock:
            self._store.pop(key, None)

    def invalidate_prefix(self, prefix: str):
        """Remove all keys starting with prefix."""
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]

    def clear(self):
        with self._lock:
            self._store.clear()

    def cleanup_expired(self):
        """Remove all expired entries. Call periodically."""
        now = time.time()
        with self._lock:
            expired = [k for k, v in self._store.items() if now > v.expires_at]
            for k in expired:
                del self._store[k]
            if expired:
                logger.debug("Cache cleanup: removed %d expired entries", len(expired))

    @property
    def size(self) -> int:
        return len(self._store)


# ─── Singleton instances ───

# Recommendations cache: key = f"rec:{user_id}", TTL = 10 min
recommendations_cache = InMemoryCache()

# AI insights cache: key = f"ai_insight:{user_id}", TTL = 15 min
ai_insights_cache = InMemoryCache()

# Opportunity list cache: key = "opportunities:active", TTL = 5 min
opportunity_cache = InMemoryCache()

# Search results cache: key = f"search:{hash}", TTL = 3 min
search_cache = InMemoryCache()


# ─── Cache key builders ───

def rec_key(user_id: str) -> str:
    return f"rec:{user_id}"

def ai_key(user_id: str) -> str:
    return f"ai_insight:{user_id}"

def search_key(params: dict) -> str:
    """Build a deterministic cache key from search parameters."""
    import hashlib, json
    raw = json.dumps(params, sort_keys=True, default=str)
    return f"search:{hashlib.md5(raw.encode()).hexdigest()}"

def detail_key(opp_id: str, user_id: str = "") -> str:
    return f"detail:{opp_id}:{user_id}"


# ─── TTL constants ───

TTL_RECOMMENDATIONS = 600      # 10 minutes
TTL_AI_INSIGHTS = 900          # 15 minutes
TTL_OPPORTUNITY_LIST = 300     # 5 minutes
TTL_SEARCH = 180               # 3 minutes
TTL_DETAIL = 600               # 10 minutes


def invalidate_user_caches(user_id: str):
    """Call after user actions (shortlist, apply) to bust stale data."""
    recommendations_cache.invalidate(rec_key(user_id))
    ai_insights_cache.invalidate(ai_key(user_id))
    search_cache.invalidate_prefix("search:")


def invalidate_all_opportunity_caches():
    """Call after ingestion refresh to bust all opportunity-related caches."""
    opportunity_cache.clear()
    search_cache.clear()
    recommendations_cache.clear()
    ai_insights_cache.clear()
    logger.info("All opportunity caches invalidated")
