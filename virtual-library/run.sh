#!/usr/bin/with-contenv bashio

# The library and its covers are kept in the add-on's persistent /data folder
export STATE_FILE="/data/library.json"
export COVERS_DIR="/data/covers"
# Must match ingress_port in config.yaml
export PORT=3100

# Optional API keys for better search results (see DOCS.md)
if bashio::config.has_value 'tmdb_api_key'; then
    export TMDB_API_KEY="$(bashio::config 'tmdb_api_key')"
    bashio::log.info "Movies and series: searching TMDB"
fi
if bashio::config.has_value 'rawg_api_key'; then
    export RAWG_API_KEY="$(bashio::config 'rawg_api_key')"
    bashio::log.info "Games: searching RAWG"
fi

bashio::log.info "Starting Hoard Board on port ${PORT}..."
exec node /app/src/server.js
