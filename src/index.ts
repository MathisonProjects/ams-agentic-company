import { App } from './app';
import { Logger } from './utils/logger';
import { config } from './config';

const logger = new Logger('Main');

async function startApplication(): Promise<void> {
  try {
    logger.info('Starting AMS Agentic Company application...');
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`HTTP Server: ${config.host}:${config.port}`);
    logger.info(`WebSocket Server: ${config.host}:${config.wsPort}`);

    const app = new App();
    
    // Wait a moment for the Gemini startup message to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    logger.info('Application started successfully');
    logger.info(`HTTP Server: ${app.getHttpServer() ? 'Running' : 'Failed'}`);
    logger.info(`WebSocket Server: ${app.getWebSocketServer() ? 'Running' : 'Failed'}`);
    logger.info(`Gemini Plugin: ${app.getGeminiPlugin() ? 'Initialized' : 'Not configured'}`);
    
    // Keep the process alive
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start application', error);
    process.exit(1);
  }
}

// Start the application
startApplication();
