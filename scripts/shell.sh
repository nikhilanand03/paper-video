#!/usr/bin/env bash
# Open a shell into the running Azure Container App
set -e

RESOURCE_GROUP="${RESOURCE_GROUP:-banim-rg}"
APP_NAME="${APP_NAME:-banim-api}"

echo "Connecting to $APP_NAME in $RESOURCE_GROUP..."
az containerapp exec \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --command /bin/bash