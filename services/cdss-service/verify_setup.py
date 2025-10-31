#!/usr/bin/env python3
"""
Verify that all required Python modules are installed correctly
"""
import sys

required_modules = [
    'fastapi',
    'uvicorn',
    'pydantic',
    'httpx',
    'numpy',
    'pandas',
    'sklearn',  # scikit-learn
    'redis',
]

missing_modules = []

print("🔍 Checking Python modules...")
print(f"Python version: {sys.version}\n")

for module in required_modules:
    try:
        if module == 'sklearn':
            __import__('sklearn')
            print(f"✅ {module} (scikit-learn)")
        else:
            __import__(module)
            print(f"✅ {module}")
    except ImportError:
        missing_modules.append(module)
        print(f"❌ {module} - MISSING")

print()

if missing_modules:
    print("⚠️  Missing modules detected!")
    print(f"Please install: pip install {' '.join(missing_modules)}")
    sys.exit(1)
else:
    print("✅ All required modules are installed!")
    print("\n🚀 CDSS Service is ready to run!")
    sys.exit(0)

