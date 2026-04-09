FROM python:3.11-slim

WORKDIR /app

# Install deps first (cached layer)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy data and source
COPY backend/data/ ./data/

# Verify the CSV made it in
RUN test -f /app/data/atp_tennis.csv || (echo "ERROR: atp_tennis.csv not found" && exit 1)

COPY backend/ .

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
