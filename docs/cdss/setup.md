# CDSS Setup & Deployment

## Prerequisites
*   Docker & Docker Compose
*   Python 3.9+ (for local development)
*   Access to `ehr-service` (for full integration)

## Docker Deployment (Recommended)

The CDSS service is part of the main `docker-compose.yml`.

To start the service:
```bash
docker compose up -d cdss-service
```

To view logs:
```bash
docker logs -f medicore-cdss-service
```

The service will be available at `http://localhost:8000` (internal network).

## Local Development Setup

1.  **Navigate to the service directory:**
    ```bash
    cd services/cdss-service
    ```

2.  **Create a virtual environment:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate  # On Windows: venv\Scripts\activate
    ```

3.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```
    *Note: This may install heavy AI libraries (PyTorch). For a lighter setup, you may exclude AI dependencies if only working on rule-based features.*

4.  **Run the service:**
    ```bash
    uvicorn main:app --reload --port 8000
    ```

5.  **Access API Docs:**
    Open `http://localhost:8000/docs` in your browser.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CDSS_ENABLE_AI` | Enable AI model loading | `true` |
| `LOG_LEVEL` | Logging verbosity | `INFO` |
| `MODEL_CACHE_DIR` | Directory for caching downloaded models | `./model_cache` |

## Testing

Run unit and integration tests:
```bash
pytest
```
