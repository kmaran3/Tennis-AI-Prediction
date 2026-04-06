from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from rate_limiter import limiter
from routers import players, predict, tournament, matches
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

app.include_router(players.router,    prefix="/api/players",    tags=["Players"])
app.include_router(predict.router,    prefix="/api/predict",    tags=["Predictions"])
app.include_router(tournament.router, prefix="/api/tournament", tags=["Tournament"])
app.include_router(matches.router,    prefix="/api/matches",    tags=["Matches"])


@app.on_event("startup")
async def startup():
    """Runs once when the server starts. Loads data, then indexes in background."""
    import threading
    load_data()
    # Run indexing in a background thread so the server starts immediately
    # and Railway's health check passes without waiting 20+ minutes.
    thread = threading.Thread(target=index_all_matches, daemon=True)
    thread.start()


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler — returns JSON instead of crashing."""
    return JSONResponse(status_code=500, content={"detail": str(exc)})
