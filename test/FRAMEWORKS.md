# Test Framework Configuration

This project uses **two test frameworks** for different purposes:

## Jest (Default) - Unit & Integration Tests

**Location:** `test/unit/` and `test/integration/`

**Purpose:**
- Unit tests for isolated functions
- Integration tests for API endpoints with LocalStack

**Run with:**
```bash
npm test                  # All Jest tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:coverage     # With coverage
```

**Configuration:** `jest.config.js`

## Vitest - E2E Tests with Mock Data

**Location:** `test/` root directory (api.test.ts, server.test.ts, integration.test.ts)

**Purpose:**
- End-to-end tests with generated mock CV photos
- Full application workflow testing
- Image processing validation

**Run with:**
```bash
npm run test:vitest       # Run Vitest tests
npm run test:localstack   # Full E2E with LocalStack setup
```

**Configuration:** `vitest.config.ts`

## Important Notes

⚠️ **Jest ignores Vitest test files** in the root test/ directory to prevent conflicts.

✅ **Both frameworks work side-by-side** - use whichever is appropriate for your test needs.

📋 **In CI/CD**: Jest tests run in the main "Tests" workflow, Vitest tests can be run with `test:localstack` script.

## Test File Patterns

**Jest looks for:**
- `test/unit/**/*.test.ts`
- `test/integration/**/*.test.ts`

**Vitest looks for:**
- `test/*.test.ts` (root level only)

**Ignored by Jest:**
- `test/api.test.ts`
- `test/server.test.ts`
- `test/integration.test.ts`

## Why Two Frameworks?

- **Jest**: Traditional, well-supported, excellent for unit/integration tests
- **Vitest**: Modern, faster, better for E2E tests with generated test data

Both are valuable and serve different testing needs!
