# AMS Agentic Company

A TypeScript-based application with WebSocket support for real-time communication and Gemini AI integration.

## Features

- **TypeScript**: Full TypeScript support with strict type checking
- **WebSocket Server**: Real-time bidirectional communication
- **Gemini AI Integration**: Advanced AI capabilities for text, images, and videos
- **Server-Sent Events**: Real-time streaming responses
- **Modern Development**: ESLint, Jest testing, and hot reloading
- **Docker Ready**: Containerized deployment support

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ams-agentic-company
```

2. Install dependencies:
```bash
npm install
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the project for production
- `npm run start` - Start the production server
- `npm run watch` - Watch for changes and rebuild automatically
- `npm run test` - Run tests
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically
- `npm run clean` - Clean build directory

### Development Workflow

1. Start the development server:
```bash
npm run dev
```

2. The server will start on the default port (see configuration in `src/config.ts`)

3. For production build:
```bash
npm run build
npm start
```

## WebSocket Usage

This project includes a WebSocket server for real-time communication. The WebSocket server is configured in `src/websocket/server.ts`.

### WebSocket Events

The server supports the following events:

- `connection` - Client connects
- `message` - Client sends a message
- `disconnect` - Client disconnects

### Example WebSocket Client

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8080');

ws.on('open', function open() {
  console.log('Connected to WebSocket server');
  
  // Send a message
  ws.send(JSON.stringify({
    type: 'message',
    data: 'Hello, WebSocket server!'
  }));
});

ws.on('message', function message(data) {
  console.log('Received:', JSON.parse(data));
});

ws.on('close', function close() {
  console.log('Disconnected from WebSocket server');
});
```

## Project Structure

```
ams-agentic-company/
├── src/
│   ├── index.ts              # Application entry point
│   ├── app.ts                # Main application logic
│   ├── config.ts             # Configuration settings
│   ├── websocket/
│   │   ├── server.ts         # WebSocket server implementation
│   │   └── types.ts          # WebSocket type definitions
│   └── utils/
│       └── logger.ts         # Logging utilities
├── dist/                     # Compiled JavaScript output
├── tests/                    # Test files
├── package.json              # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── .eslintrc.js             # ESLint configuration
├── jest.config.js           # Jest configuration
└── README.md                # This file
```

## Configuration

Configuration is managed through environment variables and the `src/config.ts` file. The application automatically loads environment variables from a `.env` file in the project root.

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Application Configuration
NODE_ENV=development
PORT=8080
WS_PORT=8081
HOST=localhost

# Add your custom environment variables below
# DATABASE_URL=your_database_url_here
# API_KEY=your_api_key_here
# JWT_SECRET=your_jwt_secret_here
# REDIS_URL=your_redis_url_here
```

### Key Configuration Options

- `PORT`: HTTP server port (default: 8080)
- `WS_PORT`: WebSocket server port (default: 8081)
- `HOST`: Server host (default: localhost)
- `NODE_ENV`: Environment (development/production/test)
- `GEMINI_API_KEY`: Your Gemini AI API key (required for AI features)
- `GEMINI_API_URL`: Gemini AI API endpoint (optional, has default)

### Environment File Setup

1. Copy the example environment file:
   ```bash
   cp env.example .env
   ```

2. Edit the `.env` file with your specific values

3. The `.env` file is automatically loaded when the application starts

## Gemini AI Integration

This project includes a comprehensive Gemini AI plugin that supports:

### Features
- **Text Processing**: Conversational AI with context awareness
- **Image Analysis**: Process and analyze images with text prompts
- **Video Processing**: Handle video content with AI analysis
- **Streaming Responses**: Real-time streaming with Server-Sent Events
- **Customizable Parameters**: Temperature, max tokens, top-p, top-k

### Usage Examples

```typescript
import GeminiAiPlugin from './src/plugins/gemini.ai';

// Initialize the plugin
const gemini = new GeminiAiPlugin();

// Text-only conversation
const response = await gemini.processText([
  { role: 'user', parts: [{ text: 'Hello! How are you?' }] }
]);

// Text with images
const imageResponse = await gemini.processTextWithImages(
  'What do you see in this image?',
  [{ data: imageBuffer, mimeType: 'image/jpeg' }]
);

// Streaming response
for await (const chunk of gemini.streamText(messages)) {
  console.log(chunk.text);
  if (chunk.isComplete) break;
}
```

### Running the Demo

```bash
# Run the Gemini AI demo
npx ts-node examples/gemini-usage.ts
```

### Startup Message

The application automatically sends a greeting message to Gemini on startup and displays the response. You'll see output like:

```
🚀 GEMINI STARTUP MESSAGE
================================================================================
📤 Sent: "Hello Gemini, how are you?"
📥 Response: [Gemini's response will appear here]
================================================================================
```

## Testing

Run tests with:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## Docker Support

### Building the Docker Image

```bash
docker build -t ams-agentic-company .
```

### Running with Docker

```bash
docker run -p 8080:8080 -p 8081:8081 ams-agentic-company
```

### Docker Compose

```bash
docker-compose up
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License.

## Support

For support and questions, please open an issue in the repository.
