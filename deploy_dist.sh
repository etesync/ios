#!/bin/bash

set -e

SSH_HOST=expo.etesync.com
SSH_PORT=22
SSH_USER=etesync
SSH_TARGET_DIR=sites/expo.etesync.com

OUTPUTDIR='dist'

PUBLIC_URL=https://expo.etesync.com
DEPLOY_PATH='release'
# DEPLOY_PATH='test'

APP_VERSION=3

yarn lint --max-warnings 0
yarn tsc

rm -rf "$OUTPUTDIR"
yarn run expo export --dump-sourcemap --public-url ${PUBLIC_URL}/${DEPLOY_PATH}/${APP_VERSION}
rsync -e "ssh -p ${SSH_PORT}" -P --delete -rvc -zz ${OUTPUTDIR}/ ${SSH_USER}@${SSH_HOST}:${SSH_TARGET_DIR}/${DEPLOY_PATH}/${APP_VERSION}
