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

# With the "ssl" option: https on a second port with Home Assistant's own certificate (e.g. Let's Encrypt,
# in the ssl folder), so Android can install the app. It's opened by the certificate's domain name,
# e.g. https://ha.example.com:3101. The server reloads it by itself when it's renewed.
# Only the file name counts, so "fullchain.pem", "/ssl/fullchain.pem" and "../../ssl/fullchain.pem" are the same.
if bashio::config.true 'ssl'; then
    CERTFILE="$(bashio::config 'certfile')"
    KEYFILE="$(bashio::config 'keyfile')"
    CERTFILE="/ssl/${CERTFILE##*/}"
    KEYFILE="/ssl/${KEYFILE##*/}"
    if [ -f "${CERTFILE}" ] && [ -f "${KEYFILE}" ]; then
        export HTTPS_PORT=3101
        export TLS_CERT="${CERTFILE}"
        export TLS_KEY="${KEYFILE}"
        bashio::log.info "https on port ${HTTPS_PORT} with ${CERTFILE}"
    else
        bashio::log.warning "ssl is on, but ${CERTFILE} or ${KEYFILE} doesn't exist: no https"
    fi
fi

bashio::log.info "Starting Hoard Board on port ${PORT}..."
exec node /app/src/server.js
