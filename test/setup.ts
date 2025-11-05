import dotenv from 'dotenv';
import { resolve } from 'path';

// Load test environment variables
dotenv.config({ path: resolve(process.cwd(), '.env.test') });

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console.log and console.error in tests to reduce noise
// global.console = {
//   ...console,
//   log: jest.fn(),
//   error: jest.fn(),
// };
