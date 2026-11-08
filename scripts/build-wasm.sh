#!/bin/sh
set -eu

# Normal builds use the pinned cwtone.wasm committed in public/engine. This
# script refreshes it from a sibling cwtone checkout when explicitly requested.
engine=${CWTONE_DIR:-../cwtone}

(cd "$engine" && ./build-wasm.sh)
cp "$engine/dist/cwtone.wasm" public/engine/cwtone.wasm
sha256sum public/engine/cwtone.wasm | awk '{print $1}' > CWTONE_SHA256
echo "Copied cwtone.wasm from $engine and updated CWTONE_SHA256"
