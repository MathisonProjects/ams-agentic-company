export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG',
}

export interface LogMessage {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string | undefined;
  data?: unknown | undefined;
}

export class Logger {
  private context: string | undefined;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): LogMessage {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      context: this.context || undefined,
      data: data || undefined,
    };
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const logMessage = this.formatMessage(level, message, data);
    
    if (process.env['NODE_ENV'] === 'production') {
      console.log(JSON.stringify(logMessage));
    } else {
      const prefix = this.context ? `[${this.context}]` : '';
      console.log(`${logMessage.timestamp} ${level} ${prefix} ${message}`, data || '');
    }
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: unknown): void {
    if (process.env['NODE_ENV'] === 'development') {
      this.log(LogLevel.DEBUG, message, data);
    }
  }
}

export const logger = new Logger();
