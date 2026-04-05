from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from backend.config import DATABASE_URL

engine: AsyncEngine = create_async_engine(DATABASE_URL, echo=False)

async_session_factory: sessionmaker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def connect() -> None:
    """Verify the PostgreSQL connection is reachable."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))


async def disconnect() -> None:
    """Dispose of the engine's connection pool."""
    await engine.dispose()
