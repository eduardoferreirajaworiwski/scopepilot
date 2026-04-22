import logging
from pathlib import Path
from time import perf_counter

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router as api_router
from app.core.config import settings
from app.core.logging import configure_logging
from app.db.database import init_db

configure_logging(settings.log_level)
logger = logging.getLogger("bugbountycopilot.api")

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description=(
        "MVP de plataforma de bug bounty com fluxo human-in-the-loop, "
        "validação de escopo obrigatória e trilha de auditoria."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)

frontend_dir = Path(__file__).resolve().parent / "frontend"
app.mount("/static", StaticFiles(directory=frontend_dir), name="static")


@app.on_event("startup")
def on_startup() -> None:
    init_db()
    logger.info("startup_complete", extra={"database_url": settings.database_url})


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    started_at = perf_counter()
    response = await call_next(request)
    elapsed_ms = round((perf_counter() - started_at) * 1000, 2)
    logger.info(
        "request_completed",
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
        },
    )
    return response


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(frontend_dir / "index.html")

