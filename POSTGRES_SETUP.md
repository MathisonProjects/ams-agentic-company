# PostgreSQL Setup for AMS Agentic Company

This document describes the PostgreSQL database setup for the AMS Agentic Company application.

## Overview

The application uses PostgreSQL as its primary database, running in Docker containers for easy development and deployment.

## Architecture

- **PostgreSQL 15**: Main database server
- **pgAdmin 4**: Web-based database management interface (development only)
- **Docker Compose**: Orchestration for all database services
- **Custom Network**: `ams-agentic-company` network for service communication

## Services

### PostgreSQL Database
- **Image**: `postgres:15-alpine`
- **Port**: `5432`
- **Database**: `ams_agentic_company`
- **User**: `postgres`
- **Password**: `postgres`
- **Health Check**: `pg_isready` command

### pgAdmin (Development Only)
- **Image**: `dpage/pgadmin4:latest`
- **Port**: `5050`
- **Email**: `admin@ams-agentic-company.com`
- **Password**: `admin`

## Database Schema

### Tables

1. **users**
   - Primary user accounts
   - Username, email, password hash
   - Timestamps for creation and updates

2. **conversations**
   - Chat conversations
   - Linked to users
   - Title and timestamps

3. **messages**
   - Individual messages in conversations
   - Role-based (user, assistant, system)
   - Content and timestamps

4. **execution_logs**
   - Plan execution tracking
   - Status, timing, and error information
   - Department and plan name tracking

### Indexes
- Performance indexes on foreign keys and timestamps
- Optimized for common query patterns

### Triggers
- Automatic `updated_at` timestamp updates
- Maintains data consistency

## Environment Variables

```bash
# Database Configuration
DB_HOST=localhost          # Database host (use 'postgres' in Docker)
DB_PORT=5432              # Database port
DB_NAME=ams_agentic_company # Database name
DB_USER=postgres          # Database user
DB_PASSWORD=postgres      # Database password
DB_MAX_CONNECTIONS=20     # Connection pool size
DB_IDLE_TIMEOUT=30000     # Idle connection timeout (ms)
DB_CONNECTION_TIMEOUT=2000 # Connection timeout (ms)
```

## Docker Commands

### Start Services
```bash
# Start all services (production)
npm run docker:up

# Start with development profile (includes pgAdmin)
docker-compose --profile dev up -d

# Build and start
npm run docker:build
npm run docker:up
```

### Stop Services
```bash
# Stop all services
npm run docker:down

# Stop and remove volumes
npm run docker:clean
```

### Management
```bash
# View logs
npm run docker:logs

# Restart services
npm run docker:restart

# Check service status
docker-compose ps
```

## Development Workflow

### 1. Initial Setup
```bash
# Copy environment file
cp env.example .env

# Start database services
npm run docker:up

# Wait for PostgreSQL to be ready
docker-compose logs postgres
```

### 2. Database Access
```bash
# Connect via psql
docker exec -it ams-agentic-company-postgres psql -U postgres -d ams_agentic_company

# Access pgAdmin (development)
# Open http://localhost:5050
# Login: admin@ams-agentic-company.com / admin
```

### 3. Schema Changes
```bash
# Edit init-scripts/01-init.sql
# Restart PostgreSQL to apply changes
npm run docker:restart postgres
```

## Production Deployment

### Environment Configuration
```bash
# Production environment variables
DB_HOST=your-production-host
DB_PORT=5432
DB_NAME=ams_agentic_company
DB_USER=your-production-user
DB_PASSWORD=your-secure-password
DB_MAX_CONNECTIONS=50
DB_IDLE_TIMEOUT=60000
DB_CONNECTION_TIMEOUT=5000
```

### Security Considerations
- Use strong passwords in production
- Enable SSL connections
- Restrict network access
- Regular backups
- Monitor connection pools

## Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if PostgreSQL is running
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

2. **Database Not Found**
   ```bash
   # Check if database exists
   docker exec -it ams-agentic-company-postgres psql -U postgres -l
   
   # Create database manually if needed
   docker exec -it ams-agentic-company-postgres createdb -U postgres ams_agentic_company
   ```

3. **Permission Denied**
   ```bash
   # Check file permissions
   ls -la init-scripts/
   
   # Fix permissions if needed
   chmod 644 init-scripts/*.sql
   ```

### Health Checks
```bash
# Check PostgreSQL health
docker exec ams-agentic-company-postgres pg_isready -U postgres

# Check application database connection
curl http://localhost:8080/health
```

## Backup and Restore

### Backup
```bash
# Create backup
docker exec ams-agentic-company-postgres pg_dump -U postgres ams_agentic_company > backup.sql

# Create compressed backup
docker exec ams-agentic-company-postgres pg_dump -U postgres ams_agentic_company | gzip > backup.sql.gz
```

### Restore
```bash
# Restore from backup
docker exec -i ams-agentic-company-postgres psql -U postgres ams_agentic_company < backup.sql

# Restore from compressed backup
gunzip -c backup.sql.gz | docker exec -i ams-agentic-company-postgres psql -U postgres ams_agentic_company
```

## Performance Tuning

### Connection Pool Settings
- Adjust `DB_MAX_CONNECTIONS` based on application load
- Monitor connection usage with `getStats()` method
- Set appropriate timeouts for your use case

### Database Optimization
- Regular VACUUM and ANALYZE operations
- Monitor slow queries
- Optimize indexes based on query patterns

## Integration with Application

The PostgreSQL plugin provides:
- Connection pool management
- Query execution with parameters
- Transaction support
- Health monitoring
- Schema initialization
- Error handling and logging

See `src/plugins/postgres.ts` for the complete implementation.
