import { createServer, IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { WebSocketServer } from './websocket/server';
import { config } from './config';
import { Logger } from './utils/logger';
import GeminiAiPlugin from './plugins/gemini.ai';
import RobotJsPlugin from './plugins/robotjs';
import TrackerPlugin from './plugins/tracker';
import PlanExecutor from './plugins/plan-executor';
import PostgresPlugin from './plugins/postgres';
import AppApiPlugin from './plugins/app-api';

export class App {
  private httpServer: any;
  private wsServer!: WebSocketServer;
  private gemini!: GeminiAiPlugin;
  private robotJs!: RobotJsPlugin;
  private tracker!: TrackerPlugin;
  private planExecutor!: PlanExecutor;
  private postgres!: PostgresPlugin;
  private appApi!: AppApiPlugin;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('App');
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.setupPostgres();
    this.setupAppApi();
    this.setupGemini();
    this.setupRobotJs();
    this.setupTracker();
    this.setupPlanExecutor();
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

  private setupTracker(): void {
    this.tracker = new TrackerPlugin();
    this.logger.info('Tracker plugin initialized');
  }

  private async setupPostgres(): Promise<void> {
    try {
      this.postgres = new PostgresPlugin();
      await this.postgres.initialize();
      this.logger.info('PostgreSQL plugin initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize PostgreSQL plugin', error);
    }
  }

  private setupAppApi(): void {
    try {
      this.appApi = new AppApiPlugin(this.postgres);
      this.logger.info('App API plugin initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize App API plugin', error);
    }
  }

  private setupPlanExecutor(): void {
    this.planExecutor = new PlanExecutor();
    this.logger.info('Plan executor initialized');
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
      case '/api/tracker/start':
        this.handleTrackerStart(req, res);
        break;
      case '/api/tracker/stop':
        this.handleTrackerStop(req, res);
        break;
      case '/api/tracker/status':
        this.handleTrackerStatus(req, res);
        break;
      case '/api/tracker/clear':
        this.handleTrackerClear(req, res);
        break;
      case '/api/tracker/export':
        this.handleTrackerExport(req, res);
        break;
      case '/api/tracker/replay':
        this.handleTrackerReplay(req, res);
        break;
      case '/api/tracker/record-click':
        this.handleTrackerRecordClick(req, res);
        break;
      case '/api/tracker/record-key':
        this.handleTrackerRecordKey(req, res);
        break;
      case '/api/tracker/record-scroll':
        this.handleTrackerRecordScroll(req, res);
        break;
      case '/api/tracker/record-double-click':
        this.handleTrackerRecordDoubleClick(req, res);
        break;
      case '/api/plan/execute':
        this.handlePlanExecute(req, res);
        break;
      case '/api/plan/status':
        this.handlePlanStatus(req, res);
        break;
      case '/api/plan/stop':
        this.handlePlanStop(req, res);
        break;
      case '/api/plan/execute-recorded':
        this.handlePlanExecuteRecorded(req, res);
        break;
      case '/api/plan/execute-sequence':
        this.handlePlanExecuteSequence(req, res);
        break;
      case '/api/tracker/sequence':
        this.handleGetRecordedSequence(req, res);
        break;
      // Agent Recordings API
      case '/api/recordings':
        this.handleRecordings(req, res);
        break;
      case '/api/recordings/':
        this.handleRecordings(req, res);
        break;
      // Scheduled Recordings API
      case '/api/scheduled':
        this.handleScheduledRecordings(req, res);
        break;
      case '/api/scheduled/':
        this.handleScheduledRecordings(req, res);
        break;
      // Database Health API
      case '/api/db/health':
        this.handleDatabaseHealth(req, res);
        break;
      case '/api/db/stats':
        this.handleDatabaseStats(req, res);
        break;
      // AI Modes API
      case '/api/ai-modes':
        this.handleAiModes(req, res);
        break;
      case '/api/ai-modes/':
        this.handleAiModes(req, res);
        break;
      case '/api/ai-modes/active':
        this.handleActiveAiModes(req, res);
        break;
      case '/api/ai-modes/toggle':
        this.handleToggleAiMode(req, res);
        break;
      default:
        // Handle AI modes by department
        if (req.url?.startsWith('/api/ai-modes/department')) {
          this.handleAiModesByDepartment(req, res);
        }
        // Handle individual AI mode operations (GET, PUT, DELETE by ID)
        else if (req.url?.startsWith('/api/ai-modes/') && req.url.split('/').length === 4) {
          this.handleAiModes(req, res);
        }
        // Handle individual recording operations (GET, PUT, DELETE by ID)
        else if (req.url?.startsWith('/api/recordings/') && req.url.split('/').length === 4) {
          this.handleRecordings(req, res);
        }
        // Handle department config files
        else if (req.url?.startsWith('/departments/') && req.url.endsWith('/config.json')) {
          this.handleDepartmentConfig(req, res);
        }
        // Try to serve static files from public directory
        else if (method === 'GET') {
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

  private handleDepartmentConfig(req: IncomingMessage, res: ServerResponse): void {
    try {
      const fs = require('fs');
      const path = require('path');
      const url = req.url || '';
      
      // Security check: prevent directory traversal
      if (url.includes('..') || url.includes('~')) {
        this.handleNotFound(req, res);
        return;
      }
      
      // Extract department name from URL (e.g., /departments/analytics/config.json -> analytics)
      const urlParts = url.split('/');
      if (urlParts.length !== 4 || urlParts[1] !== 'departments' || urlParts[3] !== 'config.json') {
        this.handleNotFound(req, res);
        return;
      }
      
      const departmentName = urlParts[2];
      const filePath = path.join(__dirname, '../departments', departmentName, 'config.json');
      
      if (!fs.existsSync(filePath)) {
        this.handleNotFound(req, res);
        return;
      }
      
      // Read and serve the config file
      const fileContent = fs.readFileSync(filePath);
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Content-Length': fileContent.length
      });
      res.end(fileContent);
      
    } catch (error) {
      this.logger.error('Error serving department config', error);
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

  // Tracker API handlers
  private handleTrackerStart(_req: IncomingMessage, res: ServerResponse): void {
    try {
      this.tracker.startTracking();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Tracking started' }));
    } catch (error) {
      this.logger.error('Error starting tracker', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to start tracking' }));
    }
  }

  private async handleTrackerStop(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      await this.tracker.endTracking();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Tracking stopped and sequence copied to clipboard' }));
    } catch (error) {
      this.logger.error('Error stopping tracker', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to stop tracking' }));
    }
  }

  private handleTrackerStatus(_req: IncomingMessage, res: ServerResponse): void {
    try {
      const status = this.tracker.getTrackingStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status }));
    } catch (error) {
      this.logger.error('Error getting tracker status', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get tracking status' }));
    }
  }

  private handleTrackerClear(_req: IncomingMessage, res: ServerResponse): void {
    try {
      this.tracker.clearSequence();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Sequence cleared' }));
    } catch (error) {
      this.logger.error('Error clearing tracker sequence', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to clear sequence' }));
    }
  }

  private async handleTrackerExport(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.getRequestBody(req);
      const filename = JSON.parse(body).filename;
      
      const filepath = await this.tracker.exportSequenceToFile(filename);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, filepath }));
    } catch (error) {
      this.logger.error('Error exporting tracker sequence', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to export sequence' }));
    }
  }

  private async handleTrackerReplay(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.getRequestBody(req);
      const sequence = JSON.parse(body).sequence;
      
      await this.tracker.replaySequence(sequence);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Sequence replayed successfully' }));
    } catch (error) {
      this.logger.error('Error replaying tracker sequence', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to replay sequence' }));
    }
  }

  private handleTrackerRecordClick(_req: IncomingMessage, res: ServerResponse): void {
    try {
      this.tracker.manualRecordLeftClick();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Click recorded' }));
    } catch (error) {
      this.logger.error('Error recording click', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to record click' }));
    }
  }

  private async handleTrackerRecordKey(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.getRequestBody(_req);
      const { key, modifiers } = JSON.parse(body);
      this.tracker.manualRecordKeyPress(key, modifiers);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Key recorded' }));
    } catch (error) {
      this.logger.error('Error recording key', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to record key' }));
    }
  }

  private async handleTrackerRecordScroll(_req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await this.getRequestBody(_req);
      const { direction, amount } = JSON.parse(body);
      this.tracker.manualRecordScroll(direction, amount);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Scroll recorded' }));
    } catch (error) {
      this.logger.error('Error recording scroll', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to record scroll' }));
    }
  }

  private handleTrackerRecordDoubleClick(_req: IncomingMessage, res: ServerResponse): void {
    try {
      this.tracker.manualRecordDoubleClick();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Double click recorded' }));
    } catch (error) {
      this.logger.error('Error recording double click', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to record double click' }));
    }
  }

  private async handlePlanExecute(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const body = await this.getRequestBody(req);
      const { planKey, departmentKey, speed = 1.0 } = JSON.parse(body);

      if (!planKey || !departmentKey) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing planKey or departmentKey' }));
        return;
      }

      // Load the department config to get the plan
      const fs = require('fs');
      const path = require('path');
      const configPath = path.join(__dirname, '../departments', departmentKey, 'config.json');
      
      if (!fs.existsSync(configPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Department not found' }));
        return;
      }

      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const plan = config.strategies?.find((s: any) => s.key === planKey);

      if (!plan) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Plan not found' }));
        return;
      }

      const success = await this.planExecutor.executePlan(plan, speed);
      
      if (success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Plan execution started' }));
      } else {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Plan execution already in progress' }));
      }
    } catch (error) {
      this.logger.error('Error executing plan', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to execute plan' }));
    }
  }

  private handlePlanStatus(_req: IncomingMessage, res: ServerResponse): void {
    try {
      const status = this.planExecutor.getExecutionStatus();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, status }));
    } catch (error) {
      this.logger.error('Error getting plan status', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get plan status' }));
    }
  }

  private handlePlanStop(_req: IncomingMessage, res: ServerResponse): void {
    try {
      this.planExecutor.stopExecution();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Plan execution stopped' }));
    } catch (error) {
      this.logger.error('Error stopping plan execution', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to stop plan execution' }));
    }
  }

  private async handlePlanExecuteRecorded(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const body = await this.getRequestBody(req);
      const { speed = 1.0 } = JSON.parse(body);

      // Get the current recorded sequence from tracker
      const plan = this.tracker.convertToPlanFormat();
      
      if (!plan) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'No recorded sequence available' }));
        return;
      }

      const success = await this.planExecutor.executePlan(plan, speed);
      
      if (success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Recorded sequence execution started' }));
      } else {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Plan execution already in progress' }));
      }
    } catch (error) {
      this.logger.error('Error executing recorded sequence', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to execute recorded sequence' }));
    }
  }

  private async handlePlanExecuteSequence(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const body = await this.getRequestBody(req);
      const { sequence, speed = 1.0 } = JSON.parse(body);

      if (!sequence) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Sequence data is required' }));
        return;
      }

      // Execute the sequence using the plan executor
      const success = await this.planExecutor.executePlan(sequence, speed);
      
      if (success) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: 'Sequence execution started' }));
      } else {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Plan execution already in progress' }));
      }
    } catch (error) {
      this.logger.error('Error executing sequence', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to execute sequence' }));
    }
  }

  private async handleGetRecordedSequence(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      // Get the current recorded sequence from tracker
      const plan = this.tracker.convertToPlanFormat();
      const rawSequence = this.tracker.getSequence();
      
      if (!plan || rawSequence.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'No recorded sequence available' }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        success: true, 
        data: {
          plan: plan,
          rawSequence: rawSequence,
          eventCount: rawSequence.length,
          duration: rawSequence.length > 0 ? 
            (rawSequence[rawSequence.length - 1]?.timestamp || 0) - (rawSequence[0]?.timestamp || 0) : 0
        }
      }));
    } catch (error) {
      this.logger.error('Error getting recorded sequence', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get recorded sequence' }));
    }
  }

  // ========================================
  // DATABASE API HANDLERS
  // ========================================

  private async handleRecordings(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const { method } = req;
      const url = req.url || '';
      const id = url.split('/').pop();

      switch (method) {
        case 'GET':
          if (id && id !== 'recordings') {
            // Get single recording by ID
            const result = await this.appApi.getAgentRecordingById(id);
            res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            // Get all recordings
            const result = await this.appApi.getAllAgentRecordings();
            res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
          break;

        case 'POST':
          // Create new recording
          const body = await this.getRequestBody(req);
          const newRecording = JSON.parse(body);
          const createResult = await this.appApi.createAgentRecording(newRecording);
          res.writeHead(createResult.success ? 201 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(createResult));
          break;

        case 'PUT':
          // Update recording
          if (id && id !== 'recordings') {
            const updateBody = await this.getRequestBody(req);
            const updates = JSON.parse(updateBody);
            const updateResult = await this.appApi.updateAgentRecording(id, updates);
            res.writeHead(updateResult.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(updateResult));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Recording ID required for update' }));
          }
          break;

        case 'DELETE':
          // Delete recording
          if (id && id !== 'recordings') {
            const deleteResult = await this.appApi.deleteAgentRecording(id);
            res.writeHead(deleteResult.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(deleteResult));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Recording ID required for deletion' }));
          }
          break;

        default:
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      }
    } catch (error) {
      this.logger.error('Error handling recordings API', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
  }

  private async handleScheduledRecordings(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const { method } = req;
      const url = req.url || '';
      const id = url.split('/').pop();

      switch (method) {
        case 'GET':
          if (id && id !== 'scheduled') {
            // Get single scheduled recording by ID
            const result = await this.appApi.getScheduledRecordingById(id);
            res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            // Get all scheduled recordings with details
            const result = await this.appApi.getScheduledRecordingsWithDetails();
            res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
          break;

        case 'POST':
          // Create new scheduled recording
          const body = await this.getRequestBody(req);
          const newScheduled = JSON.parse(body);
          const createResult = await this.appApi.createScheduledRecording(newScheduled);
          res.writeHead(createResult.success ? 201 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(createResult));
          break;

        case 'PUT':
          // Update scheduled recording
          if (id && id !== 'scheduled') {
            const updateBody = await this.getRequestBody(req);
            const updates = JSON.parse(updateBody);
            const updateResult = await this.appApi.updateScheduledRecording(id, updates);
            res.writeHead(updateResult.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(updateResult));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Scheduled recording ID required for update' }));
          }
          break;

        case 'DELETE':
          // Delete scheduled recording
          if (id && id !== 'scheduled') {
            const deleteResult = await this.appApi.deleteScheduledRecording(id);
            res.writeHead(deleteResult.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(deleteResult));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Scheduled recording ID required for deletion' }));
          }
          break;

        default:
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      }
    } catch (error) {
      this.logger.error('Error handling scheduled recordings API', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
  }

  private async handleDatabaseHealth(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const result = await this.appApi.getHealthStatus();
      res.writeHead(result.success ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Error getting database health', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get database health' }));
    }
  }

  private async handleDatabaseStats(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const result = await this.appApi.getDatabaseStats();
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Error getting database stats', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get database stats' }));
    }
  }

  // ========================================
  // AI MODES API HANDLERS
  // ========================================

  private async handleAiModes(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const { method } = req;
      const url = req.url || '';
      const id = url.split('/').pop();

      switch (method) {
        case 'GET':
          if (id && id !== 'ai-modes') {
            // Get single AI mode by ID
            const result = await this.appApi.getAiModeById(id);
            res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          } else {
            // Get all AI modes
            const result = await this.appApi.getAllAiModes();
            res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
          }
          break;

        case 'POST':
          // Create new AI mode
          const body = await this.getRequestBody(req);
          const newMode = JSON.parse(body);
          const createResult = await this.appApi.createAiMode(newMode);
          res.writeHead(createResult.success ? 201 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(createResult));
          break;

        case 'PUT':
          // Update AI mode
          if (id && id !== 'ai-modes') {
            const updateBody = await this.getRequestBody(req);
            const updates = JSON.parse(updateBody);
            const updateResult = await this.appApi.updateAiMode(id, updates);
            res.writeHead(updateResult.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(updateResult));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'AI mode ID required for update' }));
          }
          break;

        case 'DELETE':
          // Delete AI mode
          if (id && id !== 'ai-modes') {
            const deleteResult = await this.appApi.deleteAiMode(id);
            res.writeHead(deleteResult.success ? 200 : 404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(deleteResult));
          } else {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'AI mode ID required for deletion' }));
          }
          break;

        default:
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Method not allowed' }));
      }
    } catch (error) {
      this.logger.error('Error handling AI modes API', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Internal server error' }));
    }
  }

  private async handleActiveAiModes(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const result = await this.appApi.getActiveAiModes();
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Error getting active AI modes', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get active AI modes' }));
    }
  }

  private async handleAiModesByDepartment(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const department = url.searchParams.get('department');
      
      if (!department) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Department parameter required' }));
        return;
      }

      const result = await this.appApi.getAiModesByDepartment(department);
      res.writeHead(result.success ? 200 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Error getting AI modes by department', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to get AI modes by department' }));
    }
  }

  private async handleToggleAiMode(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    try {
      const body = await this.getRequestBody(req);
      const { id } = JSON.parse(body);
      
      if (!id) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'AI mode ID required' }));
        return;
      }

      const result = await this.appApi.toggleAiModeActive(id);
      res.writeHead(result.success ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      this.logger.error('Error toggling AI mode active status', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Failed to toggle AI mode active status' }));
    }
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
