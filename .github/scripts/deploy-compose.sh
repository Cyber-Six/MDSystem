#!/usr/bin/env bash
set -euo pipefail

required=(DEPLOY_HOST DEPLOY_USER DEPLOY_PATH SSH_PRIVATE_KEY SSH_KNOWN_HOSTS IMAGE_NAME IMAGE_TAG)
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required deployment setting: $name" >&2
    exit 1
  fi
done

if [[ ! "$DEPLOY_HOST" =~ ^[A-Za-z0-9.-]+$ ]]; then
  echo 'DEPLOY_HOST must be a hostname or IPv4 address.' >&2
  exit 1
fi
if [[ ! "$DEPLOY_USER" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo 'DEPLOY_USER contains unsupported characters.' >&2
  exit 1
fi
if [[ ! "$DEPLOY_PATH" =~ ^/[A-Za-z0-9._/-]+$ || "$DEPLOY_PATH" == *..* ]]; then
  echo 'DEPLOY_PATH must be a simple absolute path without parent-directory segments.' >&2
  exit 1
fi
if [[ ! "$IMAGE_TAG" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
  echo 'IMAGE_TAG contains unsupported characters.' >&2
  exit 1
fi

install -d -m 700 "$HOME/.ssh"
printf '%s\n' "$SSH_PRIVATE_KEY" > "$HOME/.ssh/mdsystem_deploy_key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$HOME/.ssh/known_hosts"
chmod 600 "$HOME/.ssh/mdsystem_deploy_key" "$HOME/.ssh/known_hosts"

remote="cd '$DEPLOY_PATH' && IMAGE_TAG='$IMAGE_TAG' docker compose pull patient staff email-worker && IMAGE_TAG='$IMAGE_TAG' docker compose up -d --no-build --pull never patient staff email-worker && docker compose ps patient staff email-worker"
ssh \
  -i "$HOME/.ssh/mdsystem_deploy_key" \
  -o IdentitiesOnly=yes \
  -o StrictHostKeyChecking=yes \
  "$DEPLOY_USER@$DEPLOY_HOST" \
  "$remote"
