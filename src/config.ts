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
    apiKeys: string[];
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
