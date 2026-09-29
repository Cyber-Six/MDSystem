#!/bin/sh
set -eu

mkdir -p "$MEDIA_PATH"
chown -R app:app "$MEDIA_PATH"

exec gosu app "$@"
