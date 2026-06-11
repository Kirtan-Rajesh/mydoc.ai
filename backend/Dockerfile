# mydoc.ai backend — built for Cloud Run (honors $PORT) but runs anywhere.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY app ./app

# Non-root user
RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
# Cloud Run sets PORT; default to 8000 locally. Single worker per container —
# scale horizontally with instances, not processes.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
