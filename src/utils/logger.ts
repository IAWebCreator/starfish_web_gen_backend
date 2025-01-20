type LogLevel = 'info' | 'warn' | 'error';

export class Logger {
  private static formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const dataString = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataString}`;
  }

  static info(message: string, data?: any) {
    console.log(this.formatMessage('info', message, data));
  }

  static warn(message: string, data?: any) {
    console.warn(this.formatMessage('warn', message, data));
  }

  static error(message: string, error?: any) {
    console.error(this.formatMessage('error', message, error));
  }
} 