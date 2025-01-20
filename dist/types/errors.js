"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebGeneratorError = void 0;
class WebGeneratorError extends Error {
    constructor(message, step, originalError) {
        super(message);
        this.step = step;
        this.originalError = originalError;
        this.name = 'WebGeneratorError';
    }
}
exports.WebGeneratorError = WebGeneratorError;
