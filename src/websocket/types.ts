import { WebSocket } from 'ws';

export interface WebSocketMessage {
  type: string;
  data?: unknown;
  timestamp: string;
  id?: string;
}

export interface WebSocketClient {
  id: string;
  ws: WebSocket;
  connectedAt: Date;
  lastActivity: Date;
  metadata?: Record<string, unknown>;
}

export interface WebSocketEvent {
  type: 'connection' | 'message' | 'disconnect' | 'error';
  clientId: string;
  data?: unknown;
  timestamp: Date;
}

export interface WebSocketServerConfig {
  port: number;
  host: string;
  path?: string;
  maxConnections?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

export type MessageHandler = (message: WebSocketMessage, client: WebSocketClient) => void;
export type ConnectionHandler = (client: WebSocketClient) => void;
export type DisconnectionHandler = (client: WebSocketClient) => void;
export type ErrorHandler = (error: Error, client?: WebSocketClient) => void;
