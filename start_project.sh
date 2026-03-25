#!/bin/bash

# Configuration
BACKEND_PORT=8000
ANALYTICS_PORT=3005
BACKOFFICE_PORT=3006
PLAYWRIGHT_PORT=3007

echo "🚀 Starting Social Analytics Platform..."

# 1. Start Backend + Playwright Server
echo "📡 Starting Backend on port $BACKEND_PORT..."
cd backend
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment and installing dependencies..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi
nohup uvicorn main:app --reload --port $BACKEND_PORT > backend.log 2>&1 &
BACKEND_PID=$!

CHROME_EXE="/Users/nicolasanzoategui/Library/Caches/ms-playwright/chromium-1208/chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
echo "🌐 Starting Chrome for Testing with remote debugging on port $PLAYWRIGHT_PORT..."
nohup "$CHROME_EXE" \
    --remote-debugging-port=$PLAYWRIGHT_PORT \
    --no-sandbox \
    --disable-setuid-sandbox \
    --disable-blink-features=AutomationControlled \
    --disable-infobars \
    --window-size=1280,900 \
    --user-data-dir=/tmp/scraper-chrome-profile \
    --headless \
    > playwright.log 2>&1 &
PLAYWRIGHT_PID=$!
cd ..

# 2. Start Analytics
echo "📊 Starting Analytics Frontend on port $ANALYTICS_PORT..."
cd analytics
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies for analytics..."
    npm install
fi
nohup npm run dev > analytics.log 2>&1 &
ANALYTICS_PID=$!
cd ..

# 3. Start Backoffice
echo "🛠️ Starting Backoffice Frontend on port $BACKOFFICE_PORT..."
cd backoffice
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies for backoffice..."
    npm install
fi
nohup npm run dev > backoffice.log 2>&1 &
BACKOFFICE_PID=$!
cd ..

echo "✅ All services are starting up!"
echo "--------------------------------------------------"
echo "🔗 Backend API:        http://localhost:$BACKEND_PORT"
echo "🔗 Analytics:          http://localhost:$ANALYTICS_PORT"
echo "🔗 Backoffice:         http://localhost:$BACKOFFICE_PORT"
echo "🔗 Playwright Server:  ws://localhost:$PLAYWRIGHT_PORT"
echo "--------------------------------------------------"
echo "📝 Logs are being written to: backend.log, backend/playwright.log, analytics/analytics.log, backoffice/backoffice.log"
echo "💡 To stop all services, you can run: kill $BACKEND_PID $PLAYWRIGHT_PID $ANALYTICS_PID $BACKOFFICE_PID"
echo "   (Or look for processes on these ports using 'lsof -i :PORT')"
