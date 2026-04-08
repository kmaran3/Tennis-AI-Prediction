import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from rate_limiter import limiter
from routers import players, predict, tournament, matches, auth, saved_predictions
from services.data_loader import load_data
from services.rag_pipeline import index_all_matches

app = FastAPI(title="ATP Tennis Predictor", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allows the React dev server and any Vercel deployment to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(players.router,    prefix="/api/players",    tags=["Players"])
app.include_router(predict.router,    prefix="/api/predict",    tags=["Predictions"])
app.include_router(tournament.router, prefix="/api/tournament", tags=["Tournament"])
app.include_router(matches.router,          prefix="/api/matches",           tags=["Matches"])
app.include_router(saved_predictions.router, prefix="/api/saved-predictions", tags=["Saved Predictions"])


@app.on_event("startup")
async def startup():
    """Runs once when the server starts. Loads data, optionally indexes RAG in background."""
    import threading
    load_data()
    # RAG indexing takes 6+ hours on CPU. Skip it in production by setting
    # SKIP_RAG_INDEXING=true. Predictions still work — the LLM just uses
    # statistical context instead of retrieved match history.
    if os.getenv("SKIP_RAG_INDEXING", "").lower() != "true":
        thread = threading.Thread(target=index_all_matches, daemon=True)
        thread.start()
    else:
        print("[RAG] Skipping indexing (SKIP_RAG_INDEXING=true)")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler — returns JSON instead of crashing."""
    return JSONResponse(status_code=500, content={"detail": str(exc)})


# Serve the built React app — only active when the dist folder exists (i.e. in production)
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
