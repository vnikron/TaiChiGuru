#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FUNCTION_NAME="${1:-request-email1}"
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-ca-central-1}}"
BUILD_DIR="$ROOT_DIR/.lambda-build"
ZIP_FILE="$BUILD_DIR/${FUNCTION_NAME}.zip"

if ! command -v aws >/dev/null 2>&1; then
	echo "AWS CLI is not installed or is not on PATH." >&2
	exit 1
fi

if ! command -v zip >/dev/null 2>&1; then
	echo "zip is not installed or is not on PATH." >&2
	exit 1
fi

if ! aws sts get-caller-identity >/dev/null; then
	echo "AWS credentials are not available. Run aws login, then try again." >&2
	exit 1
fi

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"
cp "$ROOT_DIR/lambda/request-handler.mjs" "$BUILD_DIR/request-handler.mjs"

(
	cd "$BUILD_DIR"
	zip -q "$ZIP_FILE" request-handler.mjs
)

aws lambda update-function-code \
	--function-name "$FUNCTION_NAME" \
	--region "$REGION" \
	--zip-file "fileb://$ZIP_FILE" \
	--publish

echo "Deployed $FUNCTION_NAME in $REGION from lambda/request-handler.mjs"
