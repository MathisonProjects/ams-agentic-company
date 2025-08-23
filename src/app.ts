import { createServer, IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { WebSocketServer } from './websocket/server';
import { config } from './config';
import { Logger } from './utils/logger';
import GeminiAiPlugin from './plugins/gemini.ai';
import RobotJsPlugin from './plugins/robotjs';

export class App {
  private httpServer: any;
  private wsServer!: WebSocketServer;
  private gemini!: GeminiAiPlugin;
  private robotJs!: RobotJsPlugin;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('App');
    this.setupGemini();
    this.setupRobotJs();
    this.setupHttpServer();
    this.setupWebSocketServer();
    this.setupGracefulShutdown();
  }

  private setupGemini(): void {
    try {
      if (!config.gemini.apiKey) {
        this.logger.warn('Gemini API key not configured. Skipping Gemini initialization.');
        return;
      }

      this.gemini = new GeminiAiPlugin();
      this.logger.info('Gemini AI plugin initialized successfully');
      
      // Send startup message to Gemini
      this.sendStartupMessage();
    } catch (error) {
      this.logger.error('Failed to initialize Gemini AI plugin', error);
    }
  }

  private async sendStartupMessage(): Promise<void> {
    try {
      this.logger.info('Sending startup message to Gemini...');
      
      const response = await this.gemini.processText([
        {
          role: 'user',
          parts: [{ text: 'Hello Gemini, how are you?' }]
        }
      ]);

      this.logger.info('✨ Gemini startup response received:');
      this.logger.info(`🤖 Response length: ${response.text.length}`);
      this.logger.info(`🤖 Response text: "${response.text}"`);
      
      // Also log with a visual separator for better readability
      console.log('\n' + '='.repeat(80));
      console.log('🚀 GEMINI STARTUP MESSAGE');
      console.log('='.repeat(80));
      console.log(`📤 Sent: "Hello Gemini, how are you?"`);
      console.log(`📥 Response length: ${response.text.length}`);
      console.log(`📥 Response: "${response.text}"`);
      console.log('='.repeat(80) + '\n');

      // Open the web interface
      setTimeout(() => {
        this.robotJs.openBrowser(`http://${config.host}:${config.port}`);
      }, 1000);

    } catch (error) {
      this.logger.error('Failed to send startup message to Gemini', error);
    }
  }

  private setupRobotJs(): void {
    this.robotJs = new RobotJsPlugin();
    this.logger.info('RobotJS plugin initialized');
  }



  private setupHttpServer(): void {
    this.httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      this.handleHttpRequest(req, res);
    });

    this.httpServer.listen(config.port, config.host, () => {
      this.logger.info(`HTTP server listening on ${config.host}:${config.port}`);
    });

    this.httpServer.on('error', (error: Error) => {
      this.logger.error('HTTP server error', error);
    });
  }

  private setupWebSocketServer(): void {
    this.wsServer = new WebSocketServer({
      port: config.wsPort,
      host: config.host,
    });

    // Setup WebSocket event handlers
    this.wsServer.onConnection((client) => {
      this.logger.info(`WebSocket client connected: ${client.id}`);
    });

    this.wsServer.onDisconnection((client) => {
      this.logger.info(`WebSocket client disconnected: ${client.id}`);
    });

    this.wsServer.onError((error) => {
      this.logger.error('WebSocket error', error);
    });

    // Setup message handlers
    this.wsServer.onMessage('echo', (message, client) => {
      this.logger.debug(`Echo message from ${client.id}`, message);
      this.wsServer.sendToClient(client, {
        type: 'echo',
        data: message.data,
        timestamp: new Date().toISOString(),
      });
    });

    this.wsServer.onMessage('broadcast', (message, client) => {
      this.logger.debug(`Broadcast message from ${client.id}`, message);
      this.wsServer.broadcast({
        type: 'broadcast',
        data: message.data,
        timestamp: new Date().toISOString(),
      }, client.id);
    });

    this.wsServer.onMessage('stats', (_message, client) => {
      this.logger.debug(`Stats request from ${client.id}`);
      this.wsServer.sendToClient(client, {
        type: 'stats',
        data: {
          totalConnections: this.wsServer.getConnectionCount(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
        timestamp: new Date().toISOString(),
      });
    });
  }

  private handleHttpRequest(req: IncomingMessage, res: ServerResponse): void {
    const { method, url } = req;

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Handle different routes
    switch (url) {
      case '/':
        this.handleRoot(req, res);
        break;
      case '/health':
        this.handleHealth(req, res);
        break;
      case '/stats':
        this.handleStats(req, res);
        break;
      case '/config.json':
        this.handleConfig(req, res);
        break;
      case '/api/gemini/text':
        this.handleGeminiText(req, res);
        break;
      case '/api/gemini/stream':
        this.handleGeminiStream(req, res);
        break;
      case '/api/upload':
        this.handleFileUpload(req, res);
        break;
      default:
        // Try to serve static files from public directory
        if (method === 'GET') {
          this.handleStaticFile(req, res);
        } else {
          this.handleNotFound(req, res);
        }
    }
  }

  private handleRoot(_req: IncomingMessage, res: ServerResponse): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const htmlPath = path.join(__dirname, '../public/index.html');
      
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
      } else {
        // Fallback to JSON response if HTML file doesn't exist
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          message: 'AMS Agentic Company API',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
          websocket: {
            url: `ws://${config.host}:${config.wsPort}`,
          },
        }));
      }
    } catch (error) {
      this.logger.error('Error serving HTML file', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    }
  }

  private handleHealth(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    }));
  }

  private handleStats(_req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      http: {
        port: config.port,
        host: config.host,
      },
      websocket: {
        port: config.wsPort,
        host: config.host,
        connections: this.wsServer.getConnectionCount(),
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
    }));
  }

  private handleConfig(_req: IncomingMessage, res: ServerResponse): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../public/config.json');
      
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(configData);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Config file not found' }));
      }
    } catch (error) {
      this.logger.error('Error serving config file', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error' }));
    }
  }

  private handleStaticFile(req: IncomingMessage, res: ServerResponse): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const url = req.url || '';
      
      // Security check: prevent directory traversal
      if (url.includes('..') || url.includes('~')) {
        this.handleNotFound(req, res);
        return;
      }
      
      const filePath = path.join(__dirname, '../public', url);
      
      if (!fs.existsSync(filePath)) {
        this.handleNotFound(req, res);
        return;
      }
      
      // Check if it's a file (not a directory)
      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        this.handleNotFound(req, res);
        return;
      }
      
      // Determine content type based on file extension
      const ext = path.extname(filePath).toLowerCase();
      const contentTypes: { [key: string]: string } = {
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain',
        '.html': 'text/html',
      };
      
      const contentType = contentTypes[ext] || 'application/octet-stream';
      
      // Read and serve the file
      const fileContent = fs.readFileSync(filePath);
      res.writeHead(200, { 
        'Content-Type': contentType,
        'Content-Length': fileContent.length
      });
      res.end(fileContent);
      
    } catch (error) {
      this.logger.error('Error serving static file', error);
      this.handleNotFound(req, res);
    }
  }

  private handleNotFound(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not Found',
      message: `Route ${req.url} not found`,
      timestamp: new Date().toISOString(),
    }));
  }

  private async handleGeminiText(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const body = await this.getRequestBody(req);
      const { messages, systemMessage, aiName, temperature, maxTokens, topP, topK } = JSON.parse(body);

      if (!this.gemini) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gemini service not available' }));
        return;
      }

      // Combine AI name with system message
      let fullSystemMessage = '';
      if (aiName) {
        fullSystemMessage = `You are ${aiName}.`;
        if (systemMessage) {
          fullSystemMessage += ` ${systemMessage}`;
        }
      } else if (systemMessage) {
        fullSystemMessage = systemMessage;
      }

      const response = await this.gemini.processText(messages, { temperature, maxTokens, topP, topK }, fullSystemMessage);
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));
    } catch (error) {
      this.logger.error('Error handling Gemini text request', error);
      this.logger.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name
      });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  private async handleGeminiStream(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const body = await this.getRequestBody(req);
      const { messages, systemMessage, aiName, temperature, maxTokens, topP, topK } = JSON.parse(body);

      if (!this.gemini) {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Gemini service not available' }));
        return;
      }

      // Combine AI name with system message
      let fullSystemMessage = '';
      if (aiName) {
        fullSystemMessage = `You are ${aiName}.`;
        if (systemMessage) {
          fullSystemMessage += ` ${systemMessage}`;
        }
      } else if (systemMessage) {
        fullSystemMessage = systemMessage;
      }

      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Stream the response
      for await (const chunk of this.gemini.streamText(messages, { temperature, maxTokens, topP, topK }, fullSystemMessage)) {
        if (chunk.text) {
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
        if (chunk.isComplete) {
          res.write('data: [DONE]\n\n');
          break;
        }
      }

      res.end();
    } catch (error) {
      this.logger.error('Error handling Gemini stream request', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  }

  private async handleFileUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      // Ensure uploads directory exists
      const uploadsDir = join(__dirname, '../uploads');
      if (!existsSync(uploadsDir)) {
        mkdirSync(uploadsDir, { recursive: true });
      }

      // Parse multipart form data
      const formData = await this.parseMultipartForm(req);
      
      if (!formData.file || !formData.fileId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No file uploaded or missing fileId' }));
        return;
      }

      // Generate safe filename
      const originalName = formData.file.filename || 'upload';
      const ext = extname(originalName);
      const safeName = `${formData.fileId}${ext}`;
      const filePath = join(uploadsDir, safeName);

      // Write file to disk
      writeFileSync(filePath, formData.file.buffer);

      this.logger.info(`File uploaded: ${originalName} -> ${safeName}`);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        path: filePath,
        filename: safeName,
        originalName: originalName,
        size: formData.file.buffer.length
      }));

    } catch (error) {
      this.logger.error('Error handling file upload', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File upload failed' }));
    }
  }

  private parseMultipartForm(req: IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let body = Buffer.alloc(0);
      
      req.on('data', (chunk) => {
        body = Buffer.concat([body, chunk]);
      });

      req.on('end', () => {
        try {
          const contentType = req.headers['content-type'] || '';
          const boundary = contentType.split('boundary=')[1];
          
          if (!boundary) {
            reject(new Error('No boundary found in multipart form'));
            return;
          }

          const parts = this.parseMultipartParts(body, boundary);
          resolve(parts);
        } catch (error) {
          reject(error);
        }
      });

      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  private parseMultipartParts(body: Buffer, boundary: string): any {
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts: any = {};
    
    // Split by boundary
    const chunks = [];
    let start = 0;
    
    while (true) {
      const index = body.indexOf(boundaryBuffer, start);
      if (index === -1) break;
      
      if (start > 0) {
        chunks.push(body.slice(start, index));
      }
      
      start = index + boundaryBuffer.length;
    }

    // Parse each part
    for (const chunk of chunks) {
      if (chunk.length === 0) continue;
      
      // Find double CRLF that separates headers from body
      const headerEnd = chunk.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      
      const headerBuffer = chunk.slice(0, headerEnd);
      const bodyBuffer = chunk.slice(headerEnd + 4);
      const headers = headerBuffer.toString();
      
      // Parse Content-Disposition header
      const dispositionMatch = headers.match(/Content-Disposition: form-data; name="([^"]+)"(?:; filename="([^"]+)")?/);
      if (!dispositionMatch) continue;
      
      const fieldName = dispositionMatch[1];
      const filename = dispositionMatch[2];
      
      if (fieldName) {
        if (filename) {
          // This is a file field
          parts[fieldName] = {
            filename,
            buffer: bodyBuffer.slice(0, -2) // Remove trailing CRLF
          };
        } else {
          // This is a regular field
          parts[fieldName] = bodyBuffer.slice(0, -2).toString(); // Remove trailing CRLF
        }
      }
    }
    
    return parts;
  }

  private getRequestBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', (chunk) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        resolve(body);
      });
      req.on('error', (error) => {
        reject(error);
      });
    });
  }

  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      this.logger.info(`Received ${signal}, shutting down gracefully...`);
      
      // Close WebSocket server
      this.wsServer.close();
      
      // Close HTTP server
      this.httpServer.close(() => {
        this.logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        this.logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  public getWebSocketServer(): WebSocketServer {
    return this.wsServer;
  }

  public getHttpServer(): any {
    return this.httpServer;
  }

  public getGeminiPlugin(): GeminiAiPlugin | undefined {
    return this.gemini;
  }

  public getRobotJsPlugin(): RobotJsPlugin {
    return this.robotJs;
  }
}
