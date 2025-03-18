#!/bin/bash

# Start MeiliSearch in the background
/usr/local/bin/meilisearch --db-path /data.ms --master-key ${MEILI_MASTER_KEY:-"masterKey"} &

# Wait for MeiliSearch to be ready
echo "Waiting for MeiliSearch to be ready..."
until curl -s "http://localhost:7700/health" > /dev/null; do
    sleep 1
done
echo "MeiliSearch is ready!"

# Start Flask application
exec flask run --host=0.0.0.0