FROM python:3.11-slim

WORKDIR /app

# Install deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Explicitly copy data directory first
COPY data/ ./data/

# Verify the CSV made it in (build fails here if not)
RUN test -f /app/data/atp_tennis.csv || (echo "ERROR: atp_tennis.csv not found in build context" && exit 1)

# Copy remaining source files
COPY . .

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port $PORT"]
