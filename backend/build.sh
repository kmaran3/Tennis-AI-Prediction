#!/bin/bash
set -e

# Install Python deps
pip install -r backend/requirements.txt

# Build the React frontend and copy into backend/static
cd frontend
npm install
npm run build
mkdir -p ../backend/static
cp -r dist/. ../backend/static/
