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
    libmagic-dev \
    poppler-utils \
    tesseract-ocr \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip
RUN pip install --upgrade pip setuptools wheel

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt

# Download NLTK data (required for unstructured)
RUN python -m nltk.downloader punkt averaged_perceptron_tagger

# Install scispacy model
RUN pip install --default-timeout=1000 --no-cache-dir https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.4/en_core_sci_sm-0.5.4.tar.gz

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

