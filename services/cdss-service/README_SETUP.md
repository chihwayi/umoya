# CDSS Service - Setup Guide

## 🐳 Docker Setup (Recommended)

The easiest way to run the CDSS service is using Docker:

```bash
# Build the container (creates Python environment automatically)
docker compose build cdss-service

# Run the service
docker compose up -d cdss-service

# Check logs
docker compose logs -f cdss-service

# Verify it's working
curl http://localhost:8000/health
```

The Dockerfile automatically:
- ✅ Sets up Python 3.11 environment
- ✅ Installs all required modules from `requirements.txt`
- ✅ Verifies all modules are installed correctly
- ✅ Runs the service with hot-reload enabled

---

## 💻 Local Development Setup

If you want to develop locally (outside Docker):

### 1. Prerequisites
- Python 3.11 or higher
- pip (Python package manager)

### 2. Automated Setup (Recommended)

```bash
cd services/cdss-service
./setup.sh
```

This script will:
- ✅ Check Python version
- ✅ Create virtual environment (`venv/`)
- ✅ Install all dependencies
- ✅ Provide next steps

### 3. Manual Setup

```bash
cd services/cdss-service

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip

# Install all dependencies
pip install -r requirements.txt

# Verify installation
python verify_setup.py
```

### 4. Run Locally

```bash
# Activate virtual environment first
source venv/bin/activate

# Run the service
python main.py

# Or use uvicorn directly
uvicorn main:app --reload --port 8000
```

---

## 📦 Required Python Modules

All modules are listed in `requirements.txt`:

### Core Framework
- `fastapi==0.104.1` - Web framework
- `uvicorn[standard]==0.24.0` - ASGI server
- `pydantic==2.5.0` - Data validation

### Utilities
- `python-multipart==0.0.6` - File uploads
- `httpx==0.25.1` - HTTP client
- `redis==5.0.1` - Redis client

### Data Science / ML (for future features)
- `numpy==1.26.2` - Numerical computing
- `pandas==2.1.3` - Data manipulation
- `scikit-learn==1.3.2` - Machine learning

### Optional (commented out for now)
- `tensorflow` - Deep learning (for future AI features)
- `torch` - PyTorch (alternative ML framework)
- `transformers` - NLP transformers

---

## ✅ Verify Installation

### In Docker:
```bash
docker compose exec cdss-service python verify_setup.py
```

### Locally:
```bash
source venv/bin/activate
python verify_setup.py
```

Expected output:
```
✅ fastapi
✅ uvicorn
✅ pydantic
✅ httpx
✅ numpy
✅ pandas
✅ sklearn (scikit-learn)
✅ redis

✅ All required modules are installed!
🚀 CDSS Service is ready to run!
```

---

## 🔧 Troubleshooting

### Module Not Found Errors
```bash
# Reinstall requirements
pip install --force-reinstall -r requirements.txt
```

### Docker Build Issues
```bash
# Rebuild without cache
docker compose build --no-cache cdss-service
```

### Python Version Issues
- Ensure Python 3.11+ is installed
- Check with: `python3 --version`

---

## 📝 Development Notes

- **Docker**: Recommended for consistency and isolation
- **Local venv**: Good for IDE debugging and development
- **Hot Reload**: Both Docker and local development support auto-reload on file changes
- **API Docs**: Available at `http://localhost:8000/docs` when running

---

## 🚀 Quick Start

**Docker (Easiest):**
```bash
docker compose up -d cdss-service
curl http://localhost:8000/health
```

**Local:**
```bash
cd services/cdss-service
./setup.sh
source venv/bin/activate
python main.py
```

---

## ✅ Status

All Python modules are properly configured and ready to use!

