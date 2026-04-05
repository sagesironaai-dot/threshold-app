from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.db import postgres, sqlite


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to both databases. Shutdown: disconnect cleanly."""
    await postgres.connect()
    await sqlite.connect()
    yield
    await sqlite.disconnect()
    await postgres.disconnect()


app = FastAPI(title="Aelarian Archives", lifespan=lifespan)


@app.get("/health")
async def health():
    """Verify both database connections are live."""
    pg_ok = False
    sqlite_ok = False

    try:
        from sqlalchemy import text

        async with postgres.engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            pg_ok = True
    except Exception:
        pass

    try:
        from sqlalchemy import text

        async with sqlite.engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            sqlite_ok = True
    except Exception:
        pass

    status = "ok" if (pg_ok and sqlite_ok) else "degraded"
    return {"status": status, "postgres": pg_ok, "sqlite": sqlite_ok}
