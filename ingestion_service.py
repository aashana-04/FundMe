"""
FundMe — Opportunity Ingestion Service with Modular Source Adapters.

Architecture:
  1. BaseSourceAdapter — abstract interface for all sources
  2. CuratedSeedAdapter — wraps existing curated opportunity data
  3. DevpostAdapter — fetches hackathons from Devpost (stub with curated data)
  4. StartupIndiaAdapter — fetches from Startup India (stub with curated data)
  5. Normalization pipeline — raw data → standard Opportunity format
  6. Duplicate detection — by title + organization fingerprint
  7. Deadline management — mark expired opportunities inactive
  8. APScheduler-based refresh — production-grade periodic sync
  9. Sync history tracking — per-source last sync timestamps
  10. Graceful failure handling — per-source retry with isolation

This does NOT scrape random websites.
All sources are curated, government/institutional APIs and datasets.
"""
from __future__ import annotations

import hashlib
import logging
import threading
from abc import ABC, abstractmethod
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from backend.models.opportunities import Opportunity
from backend.services.opportunity_data import CURATED_OPPORTUNITIES
from backend.services.cache_service import invalidate_all_opportunity_caches

# Live adapter imports
from backend.services.ingestion.ingestion_manager import (
    run_live_ingestion,
    get_live_ingestion_report,
    get_live_adapter_statuses,
    get_sync_history,
    LIVE_ADAPTERS,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────
#  Source Adapter Base
# ─────────────────────────────────────────

class BaseSourceAdapter(ABC):
    """Abstract base for all opportunity source adapters."""

    name: str = "unknown"
    url: str = ""
    categories: list[str] = []
    refresh_interval_hours: int = 6

    @abstractmethod
    def fetch(self) -> list[dict]:
        """Fetch raw opportunity data from the source. Returns list of dicts."""
        ...

    def is_healthy(self) -> bool:
        """Check if the source is reachable."""
        return True


class CuratedSeedAdapter(BaseSourceAdapter):
    """Serves the built-in curated opportunity catalogue."""

    name = "Curated Seed"
    url = "#"
    categories = ["all"]
    refresh_interval_hours = 24

    def fetch(self) -> list[dict]:
        return CURATED_OPPORTUNITIES


class DevpostAdapter(BaseSourceAdapter):
    """Fetches hackathon opportunities from Devpost."""

    name = "Devpost Hackathons"
    url = "https://devpost.com/hackathons"
    categories = ["hackathon"]
    refresh_interval_hours = 12

    def fetch(self) -> list[dict]:
        # In production, this would call the Devpost API or RSS feed.
        # For now, returns curated Devpost entries from seed data.
        return [o for o in CURATED_OPPORTUNITIES
                if o.get("source_name", "").lower() == "devpost"]


class StartupIndiaAdapter(BaseSourceAdapter):
    """Fetches government opportunities from Startup India."""

    name = "Startup India / DPIIT"
    url = "https://www.startupindia.gov.in/"
    categories = ["government", "grant"]
    refresh_interval_hours = 24

    def fetch(self) -> list[dict]:
        return [o for o in CURATED_OPPORTUNITIES
                if "startup india" in (o.get("source_name") or "").lower()
                or "dpiit" in (o.get("source_name") or "").lower()]


class GovernmentGrantsAdapter(BaseSourceAdapter):
    """Aggregates Indian government grant sources: NIDHI, BIRAC, MeitY, AIM."""

    name = "Indian Government Grants"
    url = "#"
    categories = ["grant", "incubator"]
    refresh_interval_hours = 24

    def fetch(self) -> list[dict]:
        gov_sources = {"dst nidhi", "birac", "meity tide 2.0", "atal innovation mission",
                       "karnataka startup mission", "niti aayog wep"}
        return [o for o in CURATED_OPPORTUNITIES
                if (o.get("source_name") or "").lower() in gov_sources]


class AcceleratorAdapter(BaseSourceAdapter):
    """Aggregates global accelerator sources: YC, Google, Techstars, etc."""

    name = "Global Accelerators"
    url = "#"
    categories = ["accelerator"]
    refresh_interval_hours = 12

    def fetch(self) -> list[dict]:
        accel_sources = {"y combinator", "google for startups", "techstars",
                         "microsoft for startups", "aws", "tata communications"}
        return [o for o in CURATED_OPPORTUNITIES
                if (o.get("source_name") or "").lower() in accel_sources]


class UniversityIncubatorAdapter(BaseSourceAdapter):
    """University incubators and fellowship programs."""

    name = "University Programs"
    url = "#"
    categories = ["incubator", "fellowship"]
    refresh_interval_hours = 48

    def fetch(self) -> list[dict]:
        uni_sources = {"sine iit bombay", "ciie.co iima", "tiss", "nasscom"}
        return [o for o in CURATED_OPPORTUNITIES
                if (o.get("source_name") or "").lower() in uni_sources]


# ─────────────────────────────────────────
#  Source Registry
# ─────────────────────────────────────────

SOURCE_ADAPTERS: list[BaseSourceAdapter] = [
    CuratedSeedAdapter(),
    DevpostAdapter(),
    StartupIndiaAdapter(),
    GovernmentGrantsAdapter(),
    AcceleratorAdapter(),
    UniversityIncubatorAdapter(),
]

# Sync history: tracks last successful sync per adapter
_sync_history: dict[str, dict] = {}


TRUSTED_SOURCES = [
    {"name": s.name, "url": s.url, "categories": s.categories, "adapter": s.__class__.__name__}
    for s in SOURCE_ADAPTERS
]

# Append live adapters to trusted sources list
for la in LIVE_ADAPTERS:
    TRUSTED_SOURCES.append({
        "name": la.name,
        "url": la.source_url,
        "categories": la.categories,
        "adapter": la.__class__.__name__,
        "live": True,
    })


# ─────────────────────────────────────────
#  Fingerprinting (Duplicate Detection)
# ─────────────────────────────────────────

def _fingerprint(title: str, organization: str) -> str:
    """Generate a stable fingerprint for duplicate detection."""
    raw = f"{title.strip().lower()}|{organization.strip().lower()}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


# ─────────────────────────────────────────
#  Normalization
# ─────────────────────────────────────────

VALID_CATEGORIES = {
    "grant", "hackathon", "incubator", "accelerator",
    "fellowship", "government", "student", "research",
}

VALID_STAGES = {"idea", "validation", "mvp", "pre-seed", "seed"}


def normalize_opportunity(raw: dict) -> dict:
    """Normalize raw opportunity data into a consistent format."""
    category = (raw.get("category") or "").lower().strip()
    if category not in VALID_CATEGORIES:
        category = "grant"

    stages = raw.get("startup_stages") or []
    stages = [s.lower().strip() for s in stages if s.lower().strip() in VALID_STAGES]

    tags = raw.get("tags") or []
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]

    geography = raw.get("geography") or []
    if isinstance(geography, str):
        geography = [g.strip() for g in geography.split(",")]

    domain_focus = raw.get("domain_focus") or []
    if isinstance(domain_focus, str):
        domain_focus = [d.strip() for d in domain_focus.split(",")]

    benefits = raw.get("benefits") or []
    if isinstance(benefits, str):
        benefits = [b.strip() for b in benefits.split(",")]

    required_docs = raw.get("required_docs") or []
    if isinstance(required_docs, str):
        required_docs = [d.strip() for d in required_docs.split(",")]

    founder_criteria = raw.get("founder_criteria") or []
    if isinstance(founder_criteria, str):
        founder_criteria = [c.strip() for c in founder_criteria.split(",")]

    return {
        "id": raw.get("id") or _fingerprint(raw.get("title", ""), raw.get("organization", "")),
        "title": (raw.get("title") or "").strip(),
        "organization": (raw.get("organization") or "").strip(),
        "description": (raw.get("description") or "").strip(),
        "category": category,
        "tags": tags,
        "eligibility_summary": (raw.get("eligibility_summary") or "").strip() or None,
        "startup_stages": stages or ["idea"],
        "geography": geography or ["India"],
        "domain_focus": domain_focus,
        "founder_criteria": founder_criteria,
        "funding_amount": (raw.get("funding_amount") or "").strip() or None,
        "benefits": benefits,
        "required_docs": required_docs,
        "official_link": (raw.get("official_link") or "").strip(),
        "deadline": (raw.get("deadline") or "").strip() or None,
        "source_name": (raw.get("source_name") or "").strip() or None,
    }


# ─────────────────────────────────────────
#  Ingestion Engine
# ─────────────────────────────────────────

def ingest_opportunities(db: Session, source_data: list[dict] = None) -> dict:
    """
    Ingest opportunities from provided data or all registered adapters.
    Returns: {added: int, updated: int, skipped: int, deactivated: int, sources_synced: int}
    """
    stats = {"added": 0, "updated": 0, "skipped": 0, "deactivated": 0, "sources_synced": 0}

    if source_data is not None:
        _ingest_batch(db, source_data, stats)
    else:
        # Run all adapters
        for adapter in SOURCE_ADAPTERS:
            try:
                data = adapter.fetch()
                _ingest_batch(db, data, stats)
                _sync_history[adapter.name] = {
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                    "status": "success",
                    "count": len(data),
                }
                stats["sources_synced"] += 1
                logger.info("Adapter '%s' synced %d opportunities", adapter.name, len(data))
            except Exception as exc:
                _sync_history[adapter.name] = {
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                    "status": f"error: {exc}",
                    "count": 0,
                }
                logger.error("Adapter '%s' failed: %s", adapter.name, exc)

    db.commit()
    invalidate_all_opportunity_caches()

    logger.info(
        "Ingestion complete: added=%d, updated=%d, skipped=%d, sources=%d",
        stats["added"], stats["updated"], stats["skipped"], stats["sources_synced"],
    )
    return stats


def _ingest_batch(db: Session, source_data: list[dict], stats: dict):
    """Ingest a batch of raw opportunity data."""
    existing_opps = db.query(Opportunity).all()
    existing_by_id = {o.id: o for o in existing_opps}
    existing_fingerprints = {}
    for o in existing_opps:
        fp = _fingerprint(o.title, o.organization)
        existing_fingerprints[fp] = o

    for raw in source_data:
        normalized = normalize_opportunity(raw)

        if not normalized["title"] or not normalized["organization"]:
            stats["skipped"] += 1
            continue

        opp_id = normalized["id"]
        fp = _fingerprint(normalized["title"], normalized["organization"])

        existing = existing_by_id.get(opp_id)
        if not existing:
            existing = existing_fingerprints.get(fp)

        if existing:
            _update_opportunity(existing, normalized)
            stats["updated"] += 1
        else:
            opp = Opportunity(
                id=opp_id,
                title=normalized["title"],
                organization=normalized["organization"],
                description=normalized["description"],
                category=normalized["category"],
                tags=normalized["tags"],
                eligibility_summary=normalized["eligibility_summary"],
                startup_stages=normalized["startup_stages"],
                geography=normalized["geography"],
                domain_focus=normalized["domain_focus"],
                founder_criteria=normalized["founder_criteria"],
                funding_amount=normalized["funding_amount"],
                benefits=normalized["benefits"],
                required_docs=normalized["required_docs"],
                official_link=normalized["official_link"],
                deadline=normalized["deadline"],
                source_name=normalized["source_name"],
                last_verified=datetime.now(timezone.utc),
                is_active=True,
                ingestion_batch=_current_batch_id(),
            )
            db.add(opp)
            stats["added"] += 1


def _update_opportunity(opp: Opportunity, data: dict):
    """Update an existing Opportunity with fresh normalized data."""
    opp.description = data["description"] or opp.description
    opp.category = data["category"] or opp.category
    opp.tags = data["tags"] or opp.tags
    opp.eligibility_summary = data["eligibility_summary"] or opp.eligibility_summary
    opp.startup_stages = data["startup_stages"] or opp.startup_stages
    opp.geography = data["geography"] or opp.geography
    opp.domain_focus = data["domain_focus"] or opp.domain_focus
    opp.founder_criteria = data["founder_criteria"] or opp.founder_criteria
    opp.funding_amount = data["funding_amount"] or opp.funding_amount
    opp.benefits = data["benefits"] or opp.benefits
    opp.required_docs = data["required_docs"] or opp.required_docs
    opp.deadline = data["deadline"] or opp.deadline
    opp.source_name = data["source_name"] or opp.source_name
    opp.last_verified = datetime.now(timezone.utc)
    opp.is_active = True


def _current_batch_id() -> str:
    """Generate a batch ID for tracking ingestion runs."""
    return datetime.now(timezone.utc).strftime("batch_%Y%m%d_%H%M%S")


# ─────────────────────────────────────────
#  Deadline Management
# ─────────────────────────────────────────

def deactivate_expired_opportunities(db: Session) -> int:
    """Mark opportunities with past deadlines as inactive. Returns count."""
    now = datetime.now(timezone.utc)
    count = 0

    opportunities = db.query(Opportunity).filter(
        Opportunity.is_active == True,
        Opportunity.deadline.isnot(None),
    ).all()

    for opp in opportunities:
        if _is_expired(opp.deadline, now):
            opp.is_active = False
            count += 1

    if count:
        db.commit()
        invalidate_all_opportunity_caches()
        logger.info("Deactivated %d expired opportunities", count)

    return count


def _is_expired(deadline_str: str, now: datetime) -> bool:
    """Check if a deadline string represents a past date."""
    if not deadline_str:
        return False

    lower = deadline_str.strip().lower()

    if lower in ("rolling", "ongoing", "open", "always open", "continuous"):
        return False
    if "rolling" in lower or "cohort" in lower or "batch" in lower:
        return False
    if "check" in lower or "annual" in lower or "bi-annual" in lower:
        return False

    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            deadline_date = datetime.strptime(lower, fmt).replace(tzinfo=timezone.utc)
            return now > deadline_date
        except ValueError:
            continue

    return False


# ─────────────────────────────────────────
#  Stale Opportunity Detection
# ─────────────────────────────────────────

def get_stale_opportunities(db: Session, stale_days: int = 90) -> list[Opportunity]:
    """Find opportunities not verified in the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=stale_days)
    return db.query(Opportunity).filter(
        Opportunity.is_active == True,
        (Opportunity.last_verified < cutoff) | (Opportunity.last_verified.is_(None)),
    ).all()


# ─────────────────────────────────────────
#  APScheduler-based Refresh
# ─────────────────────────────────────────

_scheduler = None


def start_scheduled_refresh(db_factory, interval_seconds: int = 7200):
    """
    Start APScheduler-based background refresh.
    Falls back to threading.Timer if APScheduler is not installed.
    """
    global _scheduler

    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger

        _scheduler = BackgroundScheduler(daemon=True)

        def _refresh_job():
            try:
                db = db_factory()
                try:
                    logger.info("Running scheduled opportunity refresh...")
                    ingest_opportunities(db)
                    deactivate_expired_opportunities(db)

                    # Run live adapter ingestion
                    logger.info("Running live adapter ingestion...")
                    live_stats = run_live_ingestion(db)
                    logger.info(
                        "Live ingestion: added=%d, updated=%d, sources=%d",
                        live_stats.get('added', 0),
                        live_stats.get('updated', 0),
                        live_stats.get('sources_synced', 0),
                    )
                    logger.info("Scheduled refresh complete")
                finally:
                    db.close()
            except Exception as exc:
                logger.error("Scheduled refresh failed: %s", exc)

        _scheduler.add_job(
            _refresh_job,
            trigger=IntervalTrigger(seconds=interval_seconds),
            id="opportunity_refresh",
            name="Opportunity Catalogue Refresh",
            replace_existing=True,
            max_instances=1,
            misfire_grace_time=300,
        )

        # Initial run after 10 seconds
        _scheduler.add_job(
            _refresh_job,
            trigger='date',
            run_date=datetime.now(timezone.utc) + timedelta(seconds=10),
            id="opportunity_initial_refresh",
            name="Initial Opportunity Refresh",
            replace_existing=True,
        )

        _scheduler.start()
        logger.info("APScheduler started (interval: %ds)", interval_seconds)

    except ImportError:
        logger.warning("APScheduler not installed — falling back to threading.Timer")
        _start_timer_refresh(db_factory, interval_seconds)


def _start_timer_refresh(db_factory, interval_seconds: int):
    """Fallback: threading.Timer based refresh."""
    global _scheduler

    def _run():
        try:
            db = db_factory()
            try:
                logger.info("Running scheduled opportunity refresh (timer)...")
                ingest_opportunities(db)
                deactivate_expired_opportunities(db)

                # Run live adapter ingestion
                logger.info("Running live adapter ingestion (timer)...")
                live_stats = run_live_ingestion(db)
                logger.info(
                    "Live ingestion (timer): added=%d, updated=%d",
                    live_stats.get('added', 0),
                    live_stats.get('updated', 0),
                )
            finally:
                db.close()
        except Exception as exc:
            logger.error("Scheduled refresh failed: %s", exc)

        timer = threading.Timer(interval_seconds, _run)
        timer.daemon = True
        timer.start()

    timer = threading.Timer(10, _run)
    timer.daemon = True
    timer.start()
    logger.info("Timer-based refresh started (interval: %ds)", interval_seconds)


def stop_scheduled_refresh():
    """Stop the background refresh."""
    global _scheduler
    if _scheduler and hasattr(_scheduler, 'shutdown'):
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("APScheduler stopped")


# ─────────────────────────────────────────
#  Source Health Report
# ─────────────────────────────────────────

def get_ingestion_report(db: Session) -> dict:
    """Get a summary of the current opportunity catalogue health."""
    total = db.query(Opportunity).count()
    active = db.query(Opportunity).filter(Opportunity.is_active == True).count()
    inactive = total - active

    from sqlalchemy import func
    source_counts = (
        db.query(Opportunity.source_name, func.count(Opportunity.id))
        .filter(Opportunity.is_active == True)
        .group_by(Opportunity.source_name)
        .all()
    )

    category_counts = (
        db.query(Opportunity.category, func.count(Opportunity.id))
        .filter(Opportunity.is_active == True)
        .group_by(Opportunity.category)
        .all()
    )

    stale = len(get_stale_opportunities(db))

    # Count live vs curated
    live_count = 0
    try:
        live_count = db.query(Opportunity).filter(
            Opportunity.is_active == True,
            Opportunity.source_type == "live"
        ).count()
    except Exception:
        pass

    return {
        "total_opportunities": total,
        "active": active,
        "inactive": inactive,
        "live_count": live_count,
        "curated_count": active - live_count,
        "stale_count": stale,
        "sources": {name or "Unknown": count for name, count in source_counts},
        "categories": {cat or "Unknown": count for cat, count in category_counts},
        "trusted_sources": len(TRUSTED_SOURCES),
        "live_adapters": get_live_adapter_statuses(),
        "sync_history": get_sync_history(),
        "last_refresh": datetime.now(timezone.utc).isoformat(),
    }
