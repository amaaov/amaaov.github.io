#!/bin/bash
# Deprecated wrapper. Use: ruby scripts/submit_urls.rb submit --sitemap
exec ruby "$(dirname "$0")/submit_urls.rb" submit --sitemap "$@"
