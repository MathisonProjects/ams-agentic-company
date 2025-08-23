import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  port: number;
  wsPort: number;
  nodeEnv: string;
  host: string;
  gemini: {
    apiKey: string;
    apiUrl: string;
  };
}

export const config: Config = {
  port: parseInt(process.env['PORT'] || '8080', 10),
  wsPort: parseInt(process.env['WS_PORT'] || '8081', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  host: process.env['HOST'] || 'localhost',
  gemini: {
    apiKey: process.env['GEMINI_API_KEY'] || '',
    apiUrl: process.env['GEMINI_API_URL'] || 'https://generativelanguage.googleapis.com/v1beta/models',
  },
};

export const isDevelopment = config.nodeEnv === 'development';
export const isProduction = config.nodeEnv === 'production';
