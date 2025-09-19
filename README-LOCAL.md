# Running AMS Agentic Company Locally for Desktop Automation

## Overview

The AMS Agentic Company application can run in two modes:

1. **Docker Mode** (default): All services run in Docker containers, but desktop automation is limited to mock functions
2. **Local Mode**: App runs locally with access to your desktop environment for full automation capabilities

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose installed
- macOS (for RobotJS compatibility)

## Setup for Local Desktop Automation

### 1. Start the Database Services (Docker)

```bash
# Start only the database services in Docker
docker compose up -d postgres redis elasticsearch kafka zookeeper

# Verify they're running
docker compose ps
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Application

```bash
npm run build
```

### 4. Start the Application Locally

#### Option A: Using the startup script
```bash
./start-local.sh
```

#### Option B: Manual startup
```bash
# Set environment variables
export NODE_ENV=development
export HOST=localhost
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=ams_agentic_company
export DB_USER=postgres
export DB_PASSWORD=postgres
export REDIS_HOST=localhost
export REDIS_PORT=6379
export ELASTICSEARCH_HOST=localhost
export ELASTICSEARCH_PORT=9200
export KAFKA_BROKERS=localhost:9092

# Start the application
node dist/index.js
```

### 5. Access the Application

Open your browser and navigate to: http://localhost:8080

## Desktop Automation Features

When running locally, the following features are available:

### ✅ Working Features
- **Mouse Control**: Click, double-click, right-click, scroll
- **Keyboard Input**: Type text, key combinations, special keys
- **Screen Interaction**: Move mouse, get screen size, get mouse position
- **Sequence Recording**: Record your actions and replay them
- **Plan Execution**: Execute predefined automation plans

### 🔧 How to Use Desktop Automation

1. **Record a Sequence**:
   - Click "Create Sequence" in the Actions dropdown
   - Perform your desired actions (mouse clicks, typing, etc.)
   - Click "End Sequence" to stop recording
   - The sequence is automatically copied to your clipboard

2. **Execute a Recorded Sequence**:
   - Click "Execute Recorded" in the Actions dropdown
   - The recorded sequence will be replayed on your desktop

3. **Check Execution Status**:
   - Click "Check Status" to see if automation is running

## Troubleshooting

### RobotJS Issues
If you see "PlanExecutor running in Docker mode with mock functions":
- Make sure you're running the app locally (not in Docker)
- Verify `NODE_ENV` is set to `development`
- Check that RobotJS is properly installed: `npm list robotjs`

### Database Connection Issues
If the app can't connect to databases:
- Ensure Docker services are running: `docker compose ps`
- Check that ports are accessible: `telnet localhost 5432`
- Verify environment variables are set correctly

### Permission Issues
On macOS, you may need to grant accessibility permissions:
1. Go to System Preferences > Security & Privacy > Privacy
2. Select "Accessibility" from the left sidebar
3. Add your terminal application (Terminal.app or iTerm2)
4. Restart the application

## Switching Between Modes

### From Local to Docker
```bash
# Stop the local app (Ctrl+C)
# Start the full Docker stack
docker compose up -d
```

### From Docker to Local
```bash
# Stop the Docker app
docker compose stop app

# Start databases only
docker compose up -d postgres redis elasticsearch kafka zookeeper

# Start app locally
./start-local.sh
```

## Development

For development with hot reloading:
```bash
npm run local:dev
```

This will automatically restart the app when you make changes to the TypeScript files.

## Security Note

⚠️ **Important**: When running locally, the application has full access to your desktop environment. Only run this mode when you trust the application and understand the implications of desktop automation.

