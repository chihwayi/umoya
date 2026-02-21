import os


# Provide deterministic defaults so importing main.py during test collection
# does not fail on production-oriented security env checks.
os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("JWT_SECRET", "test_jwt_secret_0123456789")
os.environ.setdefault("CDSS_ENCRYPTION_ENABLED", "false")
