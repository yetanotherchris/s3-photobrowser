import { config } from 'dotenv';
import path from 'path';

// Load test environment variables
config({ path: path.resolve(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Set AWS credentials for LocalStack
process.env.AWS_ACCESS_KEY_ID = 'test';
process.env.AWS_SECRET_ACCESS_KEY = 'test';

// Increase timeout for integration tests (Jest-specific)
if (typeof jest !== 'undefined') {
  jest.setTimeout(30000);
}

// Mock console.log and console.error in tests to reduce noise
// global.console = {
//   ...console,
//   log: jest.fn(),
//   error: jest.fn(),
// };
