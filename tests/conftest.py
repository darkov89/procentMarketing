"""Pytest fixtures for Lead Machine."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from leadmachine.db.models import Base


@pytest.fixture
def db_session():
    """Provides an isolated in-memory SQLite session for testing."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    SessionLocal = sessionmaker(bind=engine)
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
