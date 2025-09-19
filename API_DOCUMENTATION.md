# Database API Documentation

## Overview

The application now includes a comprehensive CRUD API layer for managing agent recordings and scheduled recordings. This provides separation of concerns by abstracting database operations into a dedicated helper class.

## Architecture

- **AppApiPlugin** (`src/plugins/app-api.ts`): Main API helper class that handles all database operations
- **PostgresPlugin** (`src/plugins/postgres.ts`): Database connection and query management
- **HTTP Handlers** (`src/app.ts`): REST API endpoints that use the AppApiPlugin

## API Endpoints

### Agent Recordings

#### GET /api/recordings
Retrieve all agent recordings (excluding deleted ones)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Recording Name",
      "description": "Description",
      "sequence": [...],
      "next_sequence_id": 1,
      "created_at": "2025-08-26T16:07:08.477Z",
      "updated_at": "2025-08-26T16:07:08.477Z",
      "deleted_at": null
    }
  ],
  "count": 1
}
```

#### GET /api/recordings/{id}
Retrieve a specific agent recording by ID

#### POST /api/recordings
Create a new agent recording

**Request Body:**
```json
{
  "name": "Recording Name",
  "description": "Description",
  "sequence": [...],
  "next_sequence_id": 1
}
```

#### PUT /api/recordings/{id}
Update an existing agent recording

#### DELETE /api/recordings/{id}
Soft delete an agent recording

### Scheduled Recordings

#### GET /api/scheduled
Retrieve all scheduled recordings with associated agent recording details

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Scheduled Name",
      "description": "Description",
      "code": "0 9 * * *",
      "sequenceid": "uuid",
      "created_at": "2025-08-26T16:07:16.339Z",
      "updated_at": "2025-08-26T16:07:16.339Z",
      "deleted_at": null,
      "sequence_name": "Test Recording",
      "sequence_description": "A test recording"
    }
  ],
  "count": 1
}
```

#### GET /api/scheduled/{id}
Retrieve a specific scheduled recording by ID

#### POST /api/scheduled
Create a new scheduled recording

**Request Body:**
```json
{
  "name": "Scheduled Name",
  "description": "Description",
  "code": "0 9 * * *",
  "sequenceId": "uuid"
}
```

#### PUT /api/scheduled/{id}
Update an existing scheduled recording

#### DELETE /api/scheduled/{id}
Soft delete a scheduled recording

### Database Health & Stats

#### GET /api/db/health
Check database health status

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-08-26T16:04:55.675Z",
    "database": true
  }
}
```

#### GET /api/db/stats
Get database statistics

## Data Types

### AgentRecording
```typescript
interface AgentRecording {
  id?: string;
  name: string;
  description?: string;
  sequence: any; // JSONB data
  next_sequence_id?: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}
```

### ScheduledRecording
```typescript
interface ScheduledRecording {
  id?: string;
  name: string;
  description?: string;
  code: string; // Cron expression
  sequenceId: string; // UUID reference to agent_recordings
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}
```

### QueryResult
```typescript
interface QueryResult<T> {
  success: boolean;
  data?: T | T[] | undefined;
  error?: string;
  count?: number;
}
```

## Features

### Separation of Concerns
- Database operations are abstracted into `AppApiPlugin`
- HTTP handlers focus on request/response handling
- Clear interface definitions for type safety

### Error Handling
- Comprehensive error handling with detailed error messages
- Consistent response format across all endpoints
- Proper HTTP status codes

### Soft Deletes
- All delete operations are soft deletes (sets `deleted_at` timestamp)
- Queries automatically exclude deleted records
- Data integrity is maintained

### Relationships
- Scheduled recordings can reference agent recordings
- JOIN queries provide detailed information
- Foreign key relationships are maintained

### Logging
- All operations are logged with appropriate detail levels
- Error logging includes stack traces
- Success operations include relevant metadata

## Usage Examples

### Create an Agent Recording
```bash
curl -X POST http://localhost:8080/api/recordings \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Login Sequence",
    "description": "Automated login process",
    "sequence": [
      {"action": "click", "x": 100, "y": 200},
      {"action": "type", "text": "username"},
      {"action": "click", "x": 100, "y": 250},
      {"action": "type", "text": "password"}
    ]
  }'
```

### Create a Scheduled Recording
```bash
curl -X POST http://localhost:8080/api/scheduled \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Login",
    "description": "Login every morning at 9 AM",
    "code": "0 9 * * *",
    "sequenceId": "uuid-of-agent-recording"
  }'
```

### Get All Recordings with Details
```bash
curl http://localhost:8080/api/scheduled
```

## Database Schema

The API works with two main tables:

### agent_recordings
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `description` (TEXT)
- `sequence` (JSONB)
- `next_sequence_id` (INTEGER)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP, NULL)

### scheduled_recordings
- `id` (UUID, Primary Key)
- `name` (VARCHAR)
- `description` (TEXT)
- `code` (VARCHAR) - Cron expression
- `sequenceId` (UUID, Foreign Key to agent_recordings.id)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)
- `deleted_at` (TIMESTAMP, NULL)

## Integration

The API layer is fully integrated into the main application:

1. **Initialization**: PostgresPlugin and AppApiPlugin are initialized during app startup
2. **HTTP Routes**: All database endpoints are registered in the main HTTP server
3. **Error Handling**: Consistent error handling across the application
4. **Logging**: Integrated with the application's logging system
5. **Type Safety**: Full TypeScript support with proper interfaces

This provides a clean, maintainable, and scalable architecture for database operations.
