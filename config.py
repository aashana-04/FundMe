"""
FundMe Backend Configuration.
Swap DATABASE_URL to PostgreSQL when ready:
  postgresql://user:password@localhost:5432/fundme
"""
import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./fundme.db")
