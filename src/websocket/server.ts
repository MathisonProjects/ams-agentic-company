import { WebSocketServer as WS, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../utils/logger';
import {
  WebSocketClient,
  WebSocketMessage,
  WebSocketServerConfig,
  MessageHandler,
  ConnectionHandler,
  DisconnectionHandler,
  ErrorHandler,
} from './types';

export class WebSocketServer {
  private wss: WS;
  private clients: Map<string, WebSocketClient> = new Map();
  private config: WebSocketServerConfig;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  private disconnectionHandlers: DisconnectionHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private heartbeatInterval?: NodeJS.Timeout;
  private logger: Logger;

  constructor(config: WebSocketServerConfig) {
    this.config = {
      maxConnections: 1000,
      heartbeatInterval: 30000, // 30 seconds
      connectionTimeout: 60000, // 60 seconds
      ...config,
    };

    this.logger = new Logger('WebSocketServer');

    this.wss = new WS({
      port: this.config.port,
      host: this.config.host,
      path: this.config.path,
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error', error);
      this.errorHandlers.forEach(handler => handler(error));
    });

    this.wss.on('listening', () => {
      this.logger.info(`WebSocket server listening on ${this.config.host}:${this.config.port}`);
    });
  }

  private handleConnection(ws: WebSocket, request: any): void {
    const clientId = uuidv4();
    const client: WebSocketClient = {
      id: clientId,
      ws,
      connectedAt: new Date(),
      lastActivity: new Date(),
    };

    // Check max connections
    if (this.clients.size >= (this.config.maxConnections || 1000)) {
      this.logger.warn('Maximum connections reached, rejecting new connection');
      ws.close(1013, 'Maximum connections reached');
      return;
    }

    this.clients.set(clientId, client);
    this.logger.info(`Client connected: ${clientId}`, { 
      totalConnections: this.clients.size,
      remoteAddress: request.socket.remoteAddress 
    });

    // Setup client event handlers
    ws.on('message', (data: Buffer) => {
      this.handleMessage(client, data);
    });

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleDisconnection(client, code, reason);
    });

    ws.on('error', (error: Error) => {
      this.logger.error(`Client error: ${clientId}`, error);
      this.errorHandlers.forEach(handler => handler(error, client));
    });

    // Send welcome message
    this.sendToClient(client, {
      type: 'welcome',
      data: { clientId, serverTime: new Date().toISOString() },
      timestamp: new Date().toISOString(),
    });

    // Notify connection handlers
    this.connectionHandlers.forEach(handler => handler(client));
  }

  private handleMessage(client: WebSocketClient, data: Buffer): void {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      client.lastActivity = new Date();

      this.logger.debug(`Received message from ${client.id}`, message);

      // Handle specific message types
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(message, client);
      } else {
        // Echo message back if no handler is registered
        this.sendToClient(client, {
          ...message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      this.logger.error(`Error parsing message from ${client.id}`, error);
      this.sendToClient(client, {
        type: 'error',
        data: { message: 'Invalid message format' },
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleDisconnection(client: WebSocketClient, code: number, reason: Buffer): void {
    this.clients.delete(client.id);
    this.logger.info(`Client disconnected: ${client.id}`, { 
      code, 
      reason: reason.toString(),
      totalConnections: this.clients.size 
    });

    this.disconnectionHandlers.forEach(handler => handler(client));
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval) {
      this.heartbeatInterval = setInterval(() => {
        this.clients.forEach((client) => {
          const timeSinceLastActivity = Date.now() - client.lastActivity.getTime();
          if (timeSinceLastActivity > (this.config.connectionTimeout || 60000)) {
            this.logger.warn(`Client ${client.id} timed out, closing connection`);
            client.ws.close(1000, 'Connection timeout');
            this.clients.delete(client.id);
          } else {
            // Send heartbeat
            this.sendToClient(client, {
              type: 'heartbeat',
              data: { timestamp: new Date().toISOString() },
              timestamp: new Date().toISOString(),
            });
          }
        });
      }, this.config.heartbeatInterval);
    }
  }

  // Public API methods

  public onMessage(type: string, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  public onConnection(handler: ConnectionHandler): void {
    this.connectionHandlers.push(handler);
  }

  public onDisconnection(handler: DisconnectionHandler): void {
    this.disconnectionHandlers.push(handler);
  }

  public onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  public sendToClient(client: WebSocketClient, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message));
    }
  }

  public broadcast(message: WebSocketMessage, excludeClientId?: string): void {
    this.clients.forEach((client) => {
      if (client.id !== excludeClientId) {
        this.sendToClient(client, message);
      }
    });
  }

  public getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }

  public getConnectedClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }

  public getConnectionCount(): number {
    return this.clients.size;
  }

  public close(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach((client) => {
      client.ws.close(1000, 'Server shutdown');
    });

    this.wss.close(() => {
      this.logger.info('WebSocket server closed');
    });
  }
}
