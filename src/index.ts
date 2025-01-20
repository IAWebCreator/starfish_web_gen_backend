import dotenv from 'dotenv';
import { WebGeneratorService } from './services/WebGeneratorService';
import { Logger } from './utils/logger';

dotenv.config();

async function main() {
  try {
    Logger.info('Starting Web Generator Service');
    const webGenerator = new WebGeneratorService();
    
    // Keep the process running
    process.on('SIGINT', async () => {
      Logger.info('Shutting down...');
      process.exit(0);
    });
  } catch (error) {
    Logger.error('Failed to start Web Generator Service', error);
    process.exit(1);
  }
}

main(); 