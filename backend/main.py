from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from rate_limiter import limiter
from routers import players, predict, tournament
from services.data_loader import load_data
from services.rag_pipeline import index_all_matches

app = FastAPI(title="ATP Tennis Predictor", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — allows the React app at localhost:5173 to call this API
# In production, replace "http://localhost:5173" with your Vercel domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(players.router, prefix="/api/players", tags=["Players"])
app.include_router(predict.router, prefix="/api/predict", tags=["Predictions"])
app.include_router(tournament.router, prefix="/api/tournament", tags=["Tournament"])


@app.on_event("startup")
async def startup():
    """Runs once when the server starts. Loads data and indexes into ChromaDB."""
    load_data()
    index_all_matches()  # No-op if already indexed


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler — returns JSON instead of crashing."""
    return JSONResponse(status_code=500, content={"detail": str(exc)})
