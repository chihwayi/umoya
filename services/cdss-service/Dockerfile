FROM python:3.11-slim

WORKDIR /app

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip setuptools wheel

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Verify installation
RUN python -c "import fastapi, uvicorn, pydantic, numpy, pandas, sklearn, redis; print('✅ All modules installed successfully')"

# Copy application code
COPY . .

# Create a non-root user for security (optional but recommended)
RUN useradd -m -u 1000 cdssuser && chown -R cdssuser:cdssuser /app
USER cdssuser

# Expose port
EXPOSE 8000

# Health check (using curl or python http.client)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import http.client; conn = http.client.HTTPConnection('localhost', 8000); conn.request('GET', '/health'); r = conn.getresponse(); exit(0 if r.status == 200 else 1)" || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

