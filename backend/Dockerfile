FROM python:3.11-slim

WORKDIR /app

# Install deps first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy ALL project files including data/
COPY . .

CMD uvicorn main:app --host 0.0.0.0 --port $PORT
