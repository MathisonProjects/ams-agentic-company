import { GoogleGenerativeAI, GenerativeModel, Part } from '@google/generative-ai';
import { Logger } from '../utils/logger';
import { config } from '../config';

export interface GeminiMessage {
  role: 'user' | 'model';
  parts: Part[];
}

export interface GeminiRequest {
  messages: GeminiMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  stream?: boolean;
}

export interface GeminiResponse {
  text: string;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  } | undefined;
  finishReason?: string | undefined;
}

export interface GeminiStreamResponse {
  text: string;
  isComplete: boolean;
  usage?: {
    promptTokens: number;
    responseTokens: number;
    totalTokens: number;
  } | undefined;
  finishReason?: string | undefined;
}

export interface ImageData {
  data: Buffer | string;
  mimeType: string;
}

export interface VideoData {
  data: Buffer | string;
  mimeType: string;
  duration?: number;
}

export class GeminiAiPlugin {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private logger: Logger;

  constructor() {
    this.logger = new Logger('GeminiAI');
    
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is required');
    }

    this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.5-pro'
    });
    
    this.logger.info('Gemini AI plugin initialized');
  }

  /**
   * Process conversation with text and files
   */
  async processText(messages: GeminiMessage[], options?: Partial<GeminiRequest>, systemMessage?: string): Promise<GeminiResponse> {
    try {
      this.logger.debug('Processing request', { 
        messageCount: messages?.length || 0, 
        hasSystemMessage: !!systemMessage,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        topP: options?.topP,
        topK: options?.topK
      });
      
      // Prepare messages with system message if provided
      let processedMessages = [...(messages || [])];
      if (systemMessage) {
        // Add system message at the beginning
        processedMessages = [
          { role: 'user', parts: [{ text: systemMessage }] },
          { role: 'model', parts: [{ text: 'I understand. I will follow these instructions in my responses.' }] },
          ...messages
        ];
      }
      
      // Convert file parts to Gemini format
      const convertedMessages = await this.convertMessagesWithFiles(processedMessages);
      
      const chat = this.model.startChat({
        history: convertedMessages.slice(0, -1).map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: msg.parts,
        })),
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
          topP: options?.topP || 0.8,
          topK: options?.topK || 40,
        },
      });

      const lastMessage = convertedMessages[convertedMessages.length - 1];
      if (!lastMessage) {
        throw new Error('No message to process');
      }

      const result = await chat.sendMessage(lastMessage.parts);
      const response = await result.response;
      const text = response.text();

      this.logger.debug('Processing completed', { responseLength: text.length });

      return {
        text,
        usage: undefined, // Not available in current API
        finishReason: undefined, // Not available in current API
      };
    } catch (error) {
      this.logger.error('Error processing request', error);
      throw error;
    }
  }

  /**
   * Process text with images
   */
  async processTextWithImages(
    text: string, 
    images: ImageData[], 
    options?: Partial<GeminiRequest>
  ): Promise<GeminiResponse> {
    try {
      this.logger.debug('Processing text with images', { 
        textLength: text.length, 
        imageCount: images.length 
      });

      const parts: Part[] = [
        { text },
        ...images.map(img => ({
          inlineData: {
            data: typeof img.data === 'string' ? img.data : img.data.toString('base64'),
            mimeType: img.mimeType,
          },
        })),
      ];

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
          topP: options?.topP || 0.8,
          topK: options?.topK || 40,
        },
      });

      const response = await result.response;
      const responseText = response.text();

      this.logger.debug('Text with images processing completed', { responseLength: responseText.length });

      return {
        text: responseText,
        usage: undefined, // Not available in current API
        finishReason: undefined, // Not available in current API
      };
    } catch (error) {
      this.logger.error('Error processing text with images', error);
      throw error;
    }
  }

  /**
   * Process text with videos
   */
  async processTextWithVideos(
    text: string, 
    videos: VideoData[], 
    options?: Partial<GeminiRequest>
  ): Promise<GeminiResponse> {
    try {
      this.logger.debug('Processing text with videos', { 
        textLength: text.length, 
        videoCount: videos.length 
      });

      const parts: Part[] = [
        { text },
        ...videos.map(video => ({
          inlineData: {
            data: typeof video.data === 'string' ? video.data : video.data.toString('base64'),
            mimeType: video.mimeType,
          },
        })),
      ];

      const result = await this.model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
          topP: options?.topP || 0.8,
          topK: options?.topK || 40,
        },
      });

      const response = await result.response;
      const responseText = response.text();

      this.logger.debug('Text with videos processing completed', { responseLength: responseText.length });

      return {
        text: responseText,
        usage: undefined, // Not available in current API
        finishReason: undefined, // Not available in current API
      };
    } catch (error) {
      this.logger.error('Error processing text with videos', error);
      throw error;
    }
  }

  /**
   * Stream response with Server-Sent Events (supports files)
   */
  async *streamText(messages: GeminiMessage[], options?: Partial<GeminiRequest>, systemMessage?: string): AsyncGenerator<GeminiStreamResponse> {
    try {
      this.logger.debug('Starting stream', { 
        messageCount: messages.length, 
        hasSystemMessage: !!systemMessage,
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        topP: options?.topP,
        topK: options?.topK
      });

      // Prepare messages with system message if provided
      let processedMessages = [...messages];
      if (systemMessage) {
        // Add system message at the beginning
        processedMessages = [
          { role: 'user', parts: [{ text: systemMessage }] },
          { role: 'model', parts: [{ text: 'I understand. I will follow these instructions in my responses.' }] },
          ...messages
        ];
      }

      // Convert file parts to Gemini format
      const convertedMessages = await this.convertMessagesWithFiles(processedMessages);

      const chat = this.model.startChat({
        history: convertedMessages.slice(0, -1).map(msg => ({
          role: msg.role === 'model' ? 'model' : 'user',
          parts: msg.parts,
        })),
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
          topP: options?.topP || 0.8,
          topK: options?.topK || 40,
        },
      });

      const lastMessage = convertedMessages[convertedMessages.length - 1];
      if (!lastMessage) {
        throw new Error('No message to process');
      }

      const result = await chat.sendMessageStream(lastMessage.parts);

      let fullText = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;

        yield {
          text: chunkText,
          isComplete: false,
          usage: undefined,
          finishReason: undefined,
        };
      }

      // Send final response
      yield {
        text: '',
        isComplete: true,
        usage: undefined, // Not available in current API
        finishReason: undefined, // Not available in current API
      };

      this.logger.debug('Stream completed', { totalLength: fullText.length });
    } catch (error) {
      this.logger.error('Error in stream', error);
      throw error;
    }
  }

  /**
   * Stream text with images response
   */
  async *streamTextWithImages(
    text: string, 
    images: ImageData[], 
    options?: Partial<GeminiRequest>
  ): AsyncGenerator<GeminiStreamResponse> {
    try {
      this.logger.debug('Starting text with images stream', { 
        textLength: text.length, 
        imageCount: images.length 
      });

      const parts: Part[] = [
        { text },
        ...images.map(img => ({
          inlineData: {
            data: typeof img.data === 'string' ? img.data : img.data.toString('base64'),
            mimeType: img.mimeType,
          },
        })),
      ];

      const result = await this.model.generateContentStream({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: options?.temperature || 0.7,
          maxOutputTokens: options?.maxTokens || 2048,
          topP: options?.topP || 0.8,
          topK: options?.topK || 40,
        },
      });

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();

        yield {
          text: chunkText,
          isComplete: false,
          usage: undefined,
          finishReason: undefined,
        };
      }

      // Send final response
      yield {
        text: '',
        isComplete: true,
        usage: undefined, // Not available in current API
        finishReason: undefined, // Not available in current API
      };

      this.logger.debug('Text with images stream completed');
    } catch (error) {
      this.logger.error('Error in text with images stream', error);
      throw error;
    }
  }

  /**
   * Convert messages with file attachments to Gemini format
   */
  private async convertMessagesWithFiles(messages: GeminiMessage[]): Promise<GeminiMessage[]> {
    const convertedMessages: GeminiMessage[] = [];
    
    for (const message of messages) {
      const convertedParts: Part[] = [];
      
      for (const part of message.parts) {
        if ('text' in part) {
          convertedParts.push({ text: part.text });
        } else if ('file' in part) {
          // Handle file attachment
          const fileData = await this.loadFile(part.file);
          convertedParts.push(fileData);
        } else if ('inlineData' in part) {
          // Already in correct format
          convertedParts.push(part);
        } else {
          // Unknown part type, add as-is
          convertedParts.push(part);
        }
      }
      
      convertedMessages.push({
        role: message.role,
        parts: convertedParts
      });
    }
    
    return convertedMessages;
  }

  /**
   * Load file and convert to appropriate format for Gemini
   */
  private async loadFile(fileInfo: any): Promise<Part> {
    try {
      const fs = require('fs');
      
      if (!fs.existsSync(fileInfo.path)) {
        throw new Error(`File not found: ${fileInfo.path}`);
      }
      
      const fileBuffer = fs.readFileSync(fileInfo.path);
      const base64Data = fileBuffer.toString('base64');
      
      // Determine if this is a supported media type
      if (fileInfo.type.startsWith('image/')) {
        return {
          inlineData: {
            data: base64Data,
            mimeType: fileInfo.type
          }
        };
      } else if (fileInfo.type.startsWith('video/')) {
        return {
          inlineData: {
            data: base64Data,
            mimeType: fileInfo.type
          }
        };
      } else if (fileInfo.type.startsWith('audio/')) {
        return {
          inlineData: {
            data: base64Data,
            mimeType: fileInfo.type
          }
        };
      } else if (fileInfo.type === 'application/pdf') {
        // For PDFs, we might need to extract text first
        // For now, treat as document and provide filename
        return {
          text: `[Document: ${fileInfo.name} (${fileInfo.type}, ${this.formatFileSize(fileInfo.size)})]`
        };
      } else if (fileInfo.type === 'text/plain' || fileInfo.type === 'application/json') {
        // For text files, include the content
        const textContent = fileBuffer.toString('utf-8');
        return {
          text: `[File: ${fileInfo.name}]\n${textContent}`
        };
      } else {
        // For other file types, just provide metadata
        return {
          text: `[File: ${fileInfo.name} (${fileInfo.type}, ${this.formatFileSize(fileInfo.size)})]`
        };
      }
    } catch (error) {
      this.logger.error('Error loading file', error);
      return {
        text: `[Error loading file: ${fileInfo.name}]`
      };
    }
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Validate API key by testing a simple request
   */
  async validateApiKey(): Promise<boolean> {
    try {
      const result = await this.model.generateContent('Hello');
      const response = await result.response;
      return response.text().length > 0;
    } catch (error) {
      this.logger.error('Invalid API key', error);
      return false;
    }
  }
}

export default GeminiAiPlugin;