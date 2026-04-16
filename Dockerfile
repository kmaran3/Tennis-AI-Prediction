# ── Stage 1: Build the React frontend ────────────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
# Build WITHOUT VITE_API_URL so the axios client falls back to same-origin ('').
# Both frontend and backend run on the same Railway service/port, so same-origin is correct.
RUN npm run build

# ── Stage 2: Python backend ───────────────────────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# Install Python deps first (cached layer — only re-runs when requirements change)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy data and convert CSV → Parquet at build time for faster startup
COPY backend/data/ ./data/
RUN test -f /app/data/atp_tennis.csv || (echo "ERROR: atp_tennis.csv not found" && exit 1)
RUN python -c "\
import pandas as pd; \
df = pd.read_csv('./data/atp_tennis.csv', low_memory=False); \
df.to_parquet('./data/atp_tennis.parquet', index=False); \
print(f'Converted CSV → Parquet ({len(df)} rows)')"

# Copy backend source
COPY backend/ .

# Copy the built React app into backend/static so FastAPI can serve it
COPY --from=frontend-builder /frontend/dist ./static/

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
