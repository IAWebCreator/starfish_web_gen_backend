"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const WebGeneratorService_1 = require("./services/WebGeneratorService");
const logger_1 = require("./utils/logger");
dotenv_1.default.config();
async function main() {
    try {
        logger_1.Logger.info('Starting Web Generator Service');
        const webGenerator = new WebGeneratorService_1.WebGeneratorService();
        // Keep the process running
        process.on('SIGINT', async () => {
            logger_1.Logger.info('Shutting down...');
            process.exit(0);
        });
    }
    catch (error) {
        logger_1.Logger.error('Failed to start Web Generator Service', error);
        process.exit(1);
    }
}
main();
