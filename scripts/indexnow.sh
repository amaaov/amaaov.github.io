#!/bin/bash

# IndexNow submission script
# Submits all URLs from sitemap.xml to IndexNow

API_KEY="407224196d6a4e3f83fff59ae28c738e"
HOST="amaaov.github.io"
KEY_LOCATION="https://amaaov.github.io/407224196d6a4e3f83fff59ae28c738e.txt"
SITEMAP_FILE="sitemap.xml"

# Extract URLs from sitemap.xml
URLS=$(grep -oP '<loc>\K[^<]+' "$SITEMAP_FILE")

# Build JSON array
URL_LIST="["
FIRST=true
while IFS= read -r url; do
    if [ "$FIRST" = true ]; then
        FIRST=false
    else
        URL_LIST="$URL_LIST,"
    fi
    URL_LIST="$URL_LIST \"$url\""
done <<< "$URLS"
URL_LIST="$URL_LIST]"

# Create JSON payload
JSON_PAYLOAD=$(cat <<EOF
{
  "host": "$HOST",
  "key": "$API_KEY",
  "keyLocation": "$KEY_LOCATION",
  "urlList": $URL_LIST
}
EOF
)

echo "Submitting URLs to IndexNow..."
echo "$JSON_PAYLOAD"

# Submit to IndexNow
curl -X POST "https://api.indexnow.org/IndexNow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "$JSON_PAYLOAD"

echo -e "\n\nSubmission complete."
