# ---- Builder stage: install heavy deps in a fresh layer ----
FROM python:3.12-slim AS builder

WORKDIR /build

COPY server/requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# ---- Runtime stage ----
FROM python:3.12-slim AS runtime

RUN useradd --create-home --shell /bin/bash appuser

# Set working dir to /app — server package lives at /app/server/
WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy the server files flat into /app
COPY server/ /app/

ENV PORT=4000 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

USER appuser

EXPOSE 4000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
