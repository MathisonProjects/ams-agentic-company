const WebSocket = require('ws');

// WebSocket client example
class WebSocketClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.isConnected = false;
    this.messageId = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('✅ Connected to WebSocket server');
        this.isConnected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data);
          console.log('📨 Received:', message);
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });

      this.ws.on('close', (code, reason) => {
        console.log(`🔌 Disconnected from WebSocket server (${code}: ${reason})`);
        this.isConnected = false;
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      });
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'welcome':
        console.log('🎉 Welcome message received:', message.data);
        break;
      case 'echo':
        console.log('🔄 Echo response:', message.data);
        break;
      case 'broadcast':
        console.log('📢 Broadcast message:', message.data);
        break;
      case 'stats':
        console.log('📊 Server stats:', message.data);
        break;
      case 'heartbeat':
        console.log('💓 Heartbeat received');
        break;
      default:
        console.log('❓ Unknown message type:', message.type);
    }
  }

  send(type, data) {
    if (!this.isConnected) {
      console.error('❌ Not connected to WebSocket server');
      return;
    }

    const message = {
      type,
      data,
      timestamp: new Date().toISOString(),
      id: ++this.messageId,
    };

    this.ws.send(JSON.stringify(message));
    console.log('📤 Sent:', message);
  }

  echo(text) {
    this.send('echo', { text });
  }

  broadcast(text) {
    this.send('broadcast', { text });
  }

  getStats() {
    this.send('stats', {});
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Example usage
async function main() {
  const client = new WebSocketClient('ws://localhost:8081');

  try {
    await client.connect();

    // Wait a bit for the welcome message
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send some test messages
    client.echo('Hello, WebSocket server!');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    client.broadcast('This is a broadcast message!');
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    client.getStats();

    // Keep the connection alive for a while
    console.log('⏰ Keeping connection alive for 10 seconds...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    console.error('❌ Failed to connect:', error);
  } finally {
    client.disconnect();
    console.log('👋 Goodbye!');
  }
}

// Run the example
if (require.main === module) {
  main();
}

module.exports = WebSocketClient;
