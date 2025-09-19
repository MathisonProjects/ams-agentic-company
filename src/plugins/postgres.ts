import { Pool, PoolClient, QueryResult, PoolConfig, QueryResultRow } from 'pg';
import { Logger } from '../utils/logger';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max: number;
  idleTimeoutMillis: number;
  connectionTimeoutMillis: number;
}

interface QueryOptions {
  timeout?: number;
  client?: PoolClient;
}

class PostgresPlugin {
  private pool: Pool | null = null;
  private logger: Logger;
  private config: DatabaseConfig;

  constructor(config: Partial<DatabaseConfig> = {}) {
    this.logger = new Logger('PostgresPlugin');
    
    // Default configuration
    this.config = {
      host: process.env['DB_HOST'] || 'localhost',
      port: parseInt(process.env['DB_PORT'] || '5432'),
      database: process.env['DB_NAME'] || 'ams_agentic_company',
      user: process.env['DB_USER'] || 'postgres',
      password: process.env['DB_PASSWORD'] || 'postgres',
      max: parseInt(process.env['DB_MAX_CONNECTIONS'] || '20'),
      idleTimeoutMillis: parseInt(process.env['DB_IDLE_TIMEOUT'] || '30000'),
      connectionTimeoutMillis: parseInt(process.env['DB_CONNECTION_TIMEOUT'] || '2000'),
      ...config
    };
  }

  /**
   * Initialize the database connection pool
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing PostgreSQL connection pool', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        maxConnections: this.config.max
      });

      const poolConfig: PoolConfig = {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database,
        user: this.config.user,
        password: this.config.password,
        max: this.config.max,
        idleTimeoutMillis: this.config.idleTimeoutMillis,
        connectionTimeoutMillis: this.config.connectionTimeoutMillis,
        // Additional configuration for better performance
        allowExitOnIdle: true,
        // SSL configuration (optional)
        ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false
      };

      this.pool = new Pool(poolConfig);

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      this.logger.info('PostgreSQL connection pool initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL connection pool', error);
      throw error;
    }
  }

  /**
   * Execute a query with parameters
   */
  async query<T extends QueryResultRow = any>(
    text: string, 
    params: any[] = [], 
    options: QueryOptions = {}
  ): Promise<QueryResult<T>> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized. Call initialize() first.');
    }

    const { timeout, client } = options;
    const queryConfig = {
      text,
      values: params,
      ...(timeout && { timeout })
    };

    try {
      this.logger.debug('Executing query', { 
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params: params.length,
        timeout 
      });

      let result: QueryResult<T>;
      
      if (client) {
        // Use provided client (for transactions)
        result = await client.query<T>(queryConfig);
      } else {
        // Use pool
        result = await this.pool.query<T>(queryConfig);
      }

      this.logger.debug('Query executed successfully', { 
        rowCount: result.rowCount,
        command: result.command 
      });

      return result;
    } catch (error) {
      this.logger.error('Query execution failed', { 
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        params: params.length,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized. Call initialize() first.');
    }
    return await this.pool.connect();
  }

  /**
   * Execute a transaction with multiple queries
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      this.logger.debug('Transaction started');

      const result = await callback(client);
      
      await client.query('COMMIT');
      this.logger.debug('Transaction committed successfully');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction rolled back due to error', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Initialize database schema
   */
  async initializeSchema(): Promise<void> {
    try {
      this.logger.info('Initializing database schema');

      const schemaQueries = [
        // Create users table
        `CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Create conversations table
        `CREATE TABLE IF NOT EXISTS conversations (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Create messages table
        `CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
          role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
          content TEXT NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Create execution_logs table
        `CREATE TABLE IF NOT EXISTS execution_logs (
          id SERIAL PRIMARY KEY,
          plan_name VARCHAR(255) NOT NULL,
          department VARCHAR(255),
          status VARCHAR(50) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
          execution_time_ms INTEGER,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,

        // Create indexes for better performance
        `CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id)`,
        `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)`,
        `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`,
        `CREATE INDEX IF NOT EXISTS idx_execution_logs_created_at ON execution_logs(created_at)`,
        `CREATE INDEX IF NOT EXISTS idx_execution_logs_plan_name ON execution_logs(plan_name)`
      ];

      for (const query of schemaQueries) {
        await this.query(query);
      }

      this.logger.info('Database schema initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize database schema', error);
      throw error;
    }
  }

  /**
   * Health check for the database
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.pool) {
        return false;
      }

      const result = await this.query('SELECT 1 as health_check');
      return result.rows[0]?.health_check === 1;
    } catch (error) {
      this.logger.error('Database health check failed', error);
      return false;
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  }> {
    if (!this.pool) {
      throw new Error('PostgreSQL pool not initialized');
    }

    return {
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingClients: this.pool.waitingCount
    };
  }

  /**
   * Close the database connection pool
   */
  async close(): Promise<void> {
    if (this.pool) {
      this.logger.info('Closing PostgreSQL connection pool');
      await this.pool.end();
      this.pool = null;
      this.logger.info('PostgreSQL connection pool closed');
    }
  }
}

export default PostgresPlugin;