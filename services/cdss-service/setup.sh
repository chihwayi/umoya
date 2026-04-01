#!/bin/bash

# Load environment variables
source "$(dirname "$0")/../../scripts/load-env.sh"
# Setup script for CDSS Service - Local Development

echo "🐍 Setting up Python environment for CDSS Service..."

# Check if Python 3.11+ is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11 or higher."
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ Found Python $PYTHON_VERSION"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📥 Installing Python packages..."
pip install -r requirements.txt -c constraints.txt

echo ""
echo "✅ Setup complete!"
echo ""
echo "To activate the virtual environment manually, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run the service locally:"
echo "  python main.py"
echo ""
echo "Or use Docker (recommended):"
echo "  docker compose up -d cdss-service"
