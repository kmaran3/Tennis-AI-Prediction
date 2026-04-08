#!/bin/bash
set -e

# Install Python deps
pip install -r requirements.txt

# Build the React frontend and copy it into backend/static
cd ../frontend
npm install
npm run build
cp -r dist ../backend/static
