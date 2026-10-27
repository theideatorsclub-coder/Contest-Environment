# ── TIC Contest Backend — Production Dockerfile ──
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Generate Prisma client
RUN prisma generate || true

# Copy application code
COPY . .

# Expose the API port
EXPOSE 8000

# Run the API server (no --reload in production)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
