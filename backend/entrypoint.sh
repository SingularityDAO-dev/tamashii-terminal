#!/bin/sh
set -e

echo "Running database migrations..."

# Check if alembic_version table exists
if ! python -c "
from database import engine
from sqlalchemy import text
with engine.connect() as conn:
    conn.execute(text('SELECT 1 FROM alembic_version LIMIT 1'))
" 2>/dev/null; then
    echo "No alembic_version table found, stamping base revision..."
    # Get the base revision (first migration)
    BASE_REV=$(alembic history | grep '<base>' | awk '{print $3}' | tr -d ',')
    alembic stamp "$BASE_REV"
fi

alembic upgrade head
echo "Migrations complete."

exec uvicorn main:app --host 0.0.0.0 --port 8000
