from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from backend.config import SQLITE_URL, SQLITE_FULL_PATH

engine: AsyncEngine = create_async_engine(SQLITE_URL, echo=False)

async_session_factory: sessionmaker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def connect() -> None:
    """Create the SQLite file if absent, enable WAL mode, verify connection."""
    SQLITE_FULL_PATH.parent.mkdir(parents=True, exist_ok=True)

    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("SELECT 1"))


async def disconnect() -> None:
    """Dispose of the engine's connection pool."""
    await engine.dispose()
