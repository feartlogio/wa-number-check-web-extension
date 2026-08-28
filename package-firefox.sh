#!/bin/sh
set -eu

rm -rf dist/firefox
mkdir -p dist/firefox
cp -R background.js example.csv icons popup dist/firefox/
cp manifest.firefox.json dist/firefox/manifest.json
