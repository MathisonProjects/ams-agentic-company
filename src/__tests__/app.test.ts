import { App } from '../app';
import { WebSocketServer } from '../websocket/server';
import { config } from '../config';

describe('App', () => {
  let app: App;

  beforeEach(() => {
    app = new App();
  });

  afterEach(() => {
    // Clean up
    const wsServer = app.getWebSocketServer();
    const httpServer = app.getHttpServer();
    
    wsServer.close();
    httpServer.close();
  });

  test('should create App instance', () => {
    expect(app).toBeInstanceOf(App);
  });

  test('should have WebSocket server', () => {
    const wsServer = app.getWebSocketServer();
    expect(wsServer).toBeInstanceOf(WebSocketServer);
  });

  test('should have HTTP server', () => {
    const httpServer = app.getHttpServer();
    expect(httpServer).toBeDefined();
  });
});

describe('Configuration', () => {
  test('should have valid port configuration', () => {
    expect(config.port).toBeGreaterThan(0);
    expect(config.port).toBeLessThan(65536);
  });

  test('should have valid WebSocket port configuration', () => {
    expect(config.wsPort).toBeGreaterThan(0);
    expect(config.wsPort).toBeLessThan(65536);
  });

  test('should have valid host configuration', () => {
    expect(config.host).toBeDefined();
    expect(typeof config.host).toBe('string');
  });

  test('should have valid node environment', () => {
    expect(['development', 'production', 'test']).toContain(config.nodeEnv);
  });
});
