# E2E Tests for S3 Photo Browser

This directory contains end-to-end (E2E) tests for the S3 Photo Browser application using Playwright.

## Overview

The E2E tests verify the functionality of the application from a user's perspective by automating browser interactions. These tests run in **headless mode by default** for faster execution and CI/CD compatibility.

## Test Files

### `timeline.spec.ts`

Tests for the Timeline (date scrollbar) component that appears on the right side of the application.

**Test Coverage:**
- ✅ Timeline visibility and positioning
- ✅ Year rendering in the timeline
- ✅ Years with photos are highlighted and clickable
- ✅ Years without photos are disabled (not clickable)
- ✅ Clicking a year scrolls to the correct date in the photo gallery
- ✅ Timeline alignment with actual photo dates
- ✅ Current year indicator updates when scrolling through photos
- ✅ Active year highlighting with visual indicator
- ✅ Scroll position maintains after clicking timeline

## Running the Tests

### Prerequisites

1. **Docker and Docker Compose** - Required for LocalStack
2. **Node.js 18+** - For running the application
3. **Playwright browsers** - Automatically installed with Playwright

### Quick Start

Run all E2E tests with LocalStack in headless mode:

```bash
npm run test:e2e:localstack
```

This command will:
1. Start LocalStack S3 service
2. Generate test photos
3. Upload photos to S3
4. Start the application dev server
5. Run Playwright tests in headless mode
6. Clean up resources

### Alternative Test Commands

**Run tests in headless mode (without LocalStack setup):**
```bash
npm run test:e2e
```

**Run tests with UI (Playwright's interactive mode):**
```bash
npm run test:e2e:ui
```

**Run tests in headed mode (see the browser):**
```bash
npm run test:e2e:headed
```

**Debug tests (step through with Playwright inspector):**
```bash
npm run test:e2e:debug
```

## Test Environment

The tests use the following configuration:

- **Browser:** Chromium (headless by default)
- **Base URL:** http://localhost:5173
- **Backend:** Uses LocalStack for S3 operations
- **Test Data:** Generated CV photos with various dates

## Configuration

The Playwright configuration is in `playwright.config.ts` at the project root.

Key settings:
- Tests run in **headless mode** by default
- Screenshots captured on failure
- Videos recorded on failure
- Retries: 2 on CI, 0 locally
- Test directory: `./e2e`

## Writing New Tests

When adding new E2E tests:

1. Create a new `.spec.ts` file in the `e2e` directory
2. Import Playwright test utilities:
   ```typescript
   import { test, expect } from '@playwright/test';
   ```
3. Use descriptive test names
4. Add proper `beforeEach` setup
5. Test user interactions, not implementation details
6. Verify visual elements and user-visible behavior

### Example Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Setup code
  });

  test('should do something specific', async ({ page }) => {
    // Test implementation
  });
});
```

## Test Data

The E2E tests use the same test data as integration tests:

- **Location:** `test/fixtures/photos/`
- **Type:** Generated CV photos (mock resume photos)
- **Count:** 10 photos
- **Format:** JPEG (800x1000)
- **Dates:** Various creation dates for testing timeline

To regenerate test photos:
```bash
npm run test:generate-photos
```

## Debugging Failed Tests

If tests fail:

1. **Check screenshots** in `test-results/` directory
2. **Review videos** in `test-results/` directory
3. **Run in headed mode** to see what's happening:
   ```bash
   npm run test:e2e:headed
   ```
4. **Use debug mode** for step-by-step execution:
   ```bash
   npm run test:e2e:debug
   ```
5. **Check LocalStack logs** if S3 operations fail:
   ```bash
   docker compose -f docker-compose.test.yml logs localstack
   ```

## Known Issues

### Timeline Alignment Issues

The current tests document two known issues with the Timeline component:

1. **Timeline doesn't line up with photo dates**
   - The active year indicator may not accurately reflect the currently visible photos
   - Tests verify this behavior to catch regressions

2. **Timeline years may not be clickable**
   - Some years with photos may not respond to clicks
   - Tests verify clickability to ensure this works correctly

These tests serve as regression tests for these features and will help validate fixes.

## CI/CD Integration

To integrate these tests into your CI/CD pipeline:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install chromium

- name: Start LocalStack
  run: docker compose -f docker-compose.test.yml up -d localstack

- name: Setup test data
  run: |
    npm run test:generate-photos
    npm run test:setup

- name: Run E2E tests
  run: npm run test:e2e

- name: Upload test results
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: playwright-report/
```

## Test Maintenance

- **Review tests** when UI changes significantly
- **Update selectors** if component structure changes
- **Add new tests** for new features
- **Remove obsolete tests** for removed features
- **Keep tests fast** - aim for < 30 seconds per test

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Guide](https://playwright.dev/docs/ci)

## Support

For issues or questions about E2E tests:
1. Check the Playwright documentation
2. Review test output and screenshots
3. Run tests in debug mode
4. Check the main project README.md
