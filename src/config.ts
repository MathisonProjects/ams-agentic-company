import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  port: number;
  wsPort: number;
  nodeEnv: string;
  host: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
  };
  redis: {
    host: string;
    port: number;
  };
  elasticsearch: {
    host: string;
    port: number;
  };
  kafka: {
    brokers: string[];
  };
  gemini: {
    apiKey: string;
    apiUrl: string;
    apiKeys: string[];
  };
}

export const config: Config = {
  port: parseInt(process.env['PORT'] || '8080', 10),
  wsPort: parseInt(process.env['WS_PORT'] || '8081', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  host: process.env['HOST'] || 'localhost',
  database: {
    host: process.env['DB_HOST'] || 'localhost',
    port: parseInt(process.env['DB_PORT'] || '5432', 10),
    name: process.env['DB_NAME'] || 'ams_agentic_company',
    user: process.env['DB_USER'] || 'postgres',
    password: process.env['DB_PASSWORD'] || 'postgres',
  },
  redis: {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
  },
  elasticsearch: {
    host: process.env['ELASTICSEARCH_HOST'] || 'localhost',
    port: parseInt(process.env['ELASTICSEARCH_PORT'] || '9200', 10),
  },
  kafka: {
    brokers: (process.env['KAFKA_BROKERS'] || 'localhost:9092').split(','),
  },
  gemini: {
    apiKey: process.env['GEMINI_API_KEY'] || '',
    apiUrl: process.env['GEMINI_API_URL'] || 'https://generativelanguage.googleapis.com/v1beta/models',
    apiKeys: [
      process.env['GEMINI_API_KEY'] || '',
      process.env['GEMINI_API_KEY_2'] || '',
      process.env['GEMINI_API_KEY_3'] || '',
      process.env['GEMINI_API_KEY_4'] || '',
      process.env['GEMINI_API_KEY_5'] || '',
      process.env['GEMINI_API_KEY_6'] || '',
      process.env['GEMINI_API_KEY_7'] || '',
      process.env['GEMINI_API_KEY_8'] || '',
      process.env['GEMINI_API_KEY_9'] || '',
      process.env['GEMINI_API_KEY_10'] || '',
      process.env['GEMINI_API_KEY_11'] || '',
      process.env['GEMINI_API_KEY_12'] || '',
    ]
  },
};

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
