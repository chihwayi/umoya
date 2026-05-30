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

# Install asyncpg separately so it gets its own cached layer.
# It compiles from source on ARM64 which is slow — isolating it means
# changes to other requirements don't force a recompile.
RUN pip install --default-timeout=600 --no-cache-dir "asyncpg>=0.29.0"

# Copy requirements and install Python dependencies
COPY requirements.txt constraints.txt ./
RUN pip install --default-timeout=1000 --no-cache-dir -r requirements.txt -c constraints.txt

# Download NLTK data (required for unstructured)
RUN python -c "import nltk; [nltk.download(p, download_dir='/usr/share/nltk_data', quiet=True) for p in ('punkt','punkt_tab','averaged_perceptron_tagger','averaged_perceptron_tagger_eng')]"

# Install scispacy model
RUN pip install --default-timeout=1000 --no-cache-dir https://s3-us-west-2.amazonaws.com/ai2-s2-scispacy/releases/v0.5.4/en_core_sci_sm-0.5.4.tar.gz

# Pre-download HF models required by RAGEngine so they're baked into the image
# (avoids throttled/blocked HuggingFace downloads at runtime)
# HF_HOME is set inline so this layer doesn't bust the pip install cache on future builds
RUN mkdir -p /opt/hf_cache && \
    HF_HOME=/opt/hf_cache TRANSFORMERS_CACHE=/opt/hf_cache \
      python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')" && \
    HF_HOME=/opt/hf_cache TRANSFORMERS_CACHE=/opt/hf_cache \
      python -c "from sentence_transformers import CrossEncoder; CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')" && \
    HF_HOME=/opt/hf_cache \
      python -c "from faster_whisper import WhisperModel; WhisperModel('base', device='cpu', compute_type='int8')" && \
    chown -R 1000:1000 /opt/hf_cache

# Verify installation
RUN python -c "import asyncpg, fastapi, uvicorn, pydantic, numpy, pandas, sklearn, redis, pytesseract; from pgvector.psycopg2 import register_vector; print('✅ All modules installed successfully')"

# Copy application code
COPY . .

# Create a non-root user for security (optional but recommended)
RUN useradd -m -u 1000 cdssuser && chown -R cdssuser:cdssuser /app
USER cdssuser

# Expose port
EXPOSE 8000

# Health check (using curl or python http.client)
HEALTHCHECK --interval=30s --timeout=35s --start-period=90s --retries=3 \
    CMD python -c "import http.client; conn = http.client.HTTPConnection('localhost', 8000); conn.request('GET', '/health'); r = conn.getresponse(); exit(0 if r.status == 200 else 1)" || exit 1

# Run the application (no --reload: WatchFiles reloader blocks worker startup with heavy AI models)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
