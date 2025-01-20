"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
class Logger {
    static formatMessage(level, message, data) {
        const timestamp = new Date().toISOString();
        const dataString = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message}${dataString}`;
    }
    static info(message, data) {
        console.log(this.formatMessage('info', message, data));
    }
    static warn(message, data) {
        console.warn(this.formatMessage('warn', message, data));
    }
    static error(message, error) {
        console.error(this.formatMessage('error', message, error));
    }
}
exports.Logger = Logger;
