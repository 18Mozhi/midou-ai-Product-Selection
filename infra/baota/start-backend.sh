#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)"
ROOT="$(CDPATH= cd -- "$SCRIPT_DIR/../.." && pwd -P)"
CURRENT="$(readlink -f "$ROOT/current")"

set -a
. "$ROOT/shared/config/product_scout.env"
set +a

BUILD_SHA="$(basename "$CURRENT")"
case "$BUILD_SHA" in
  *[!0-9a-f]*|'')
    echo "invalid current release identity: $BUILD_SHA" >&2
    exit 1
    ;;
esac

if [ "${#BUILD_SHA}" -ne 40 ]; then
  echo "current release identity must be a full Git SHA" >&2
  exit 1
fi

export APP_HOST=127.0.0.1
export APP_PORT=4101
export APP_VERSION="${APP_VERSION:-0.1.0}"
export BUILD_SHA="$BUILD_SHA"

cd "$CURRENT"
exec /www/server/nodejs/v20.19.6/bin/node apps/backend/dist/server.js
