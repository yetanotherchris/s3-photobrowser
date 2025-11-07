import { test, expect, Page } from '@playwright/test';

/**
 * E2E tests for the Timeline (date scrollbar) component
 *
 * These tests verify:
 * 1. Timeline visibility and rendering
 * 2. Year clickability for years with photos
 * 3. Timeline alignment with photo dates
 * 4. Current year highlighting based on scroll position
 * 5. Years without photos are disabled/non-clickable
 */

test.describe('Timeline Date Scrollbar', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');

    // Wait for the photo gallery to load
    await page.waitForSelector('[id^="date-"]', { timeout: 30000 });

    // Wait for timeline to be visible
    await page.waitForSelector('.fixed.right-0', { timeout: 10000 });
  });

  test('should display the timeline scrollbar on the right side', async ({ page }) => {
    // Verify timeline is visible
    const timeline = page.locator('.fixed.right-0.top-0');
    await expect(timeline).toBeVisible();

    // Verify it's positioned on the right
    const boundingBox = await timeline.boundingBox();
    expect(boundingBox).toBeTruthy();
    if (boundingBox) {
      const viewportSize = page.viewportSize();
      expect(viewportSize).toBeTruthy();
      if (viewportSize) {
        // Timeline should be near the right edge
        expect(boundingBox.x + boundingBox.width).toBeGreaterThan(viewportSize.width * 0.9);
      }
    }
  });

  test('should render years in the timeline', async ({ page }) => {
    // Find all year buttons in the timeline
    const yearButtons = page.locator('.fixed.right-0 button');
    const count = await yearButtons.count();

    // Should have multiple years (at least current year down to 1970)
    const currentYear = new Date().getFullYear();
    const expectedYears = currentYear - 1970 + 1;
    expect(count).toBeGreaterThanOrEqual(10); // At least 10 years
    expect(count).toBeLessThanOrEqual(expectedYears);
  });

  test('should highlight years that have photos', async ({ page }) => {
    // Get all year buttons
    const yearButtons = page.locator('.fixed.right-0 button');
    const count = await yearButtons.count();

    let foundEnabledYear = false;
    let foundDisabledYear = false;

    // Check each year button
    for (let i = 0; i < count; i++) {
      const button = yearButtons.nth(i);
      const isDisabled = await button.getAttribute('disabled');

      if (isDisabled !== null) {
        foundDisabledYear = true;
        // Disabled years should have opacity-30 class
        await expect(button).toHaveClass(/opacity-30/);
      } else {
        foundEnabledYear = true;
        // Enabled years should be clickable
        await expect(button).toBeEnabled();
      }
    }

    // We should have at least some enabled years with photos
    expect(foundEnabledYear).toBe(true);
  });

  test('should make years with photos clickable', async ({ page }) => {
    // Find a year button that is not disabled
    const enabledYearButton = page.locator('.fixed.right-0 button:not([disabled])').first();

    // Verify it exists and is visible
    await expect(enabledYearButton).toBeVisible();

    // Verify it's clickable (not disabled)
    await expect(enabledYearButton).toBeEnabled();

    // Get the year text
    const yearText = await enabledYearButton.textContent();
    expect(yearText).toBeTruthy();

    // Click the year
    await enabledYearButton.click();

    // Wait for scroll animation
    await page.waitForTimeout(1000);

    // Verify that a date group with that year is now visible in viewport
    const scrollableDiv = page.locator('#scrollableDiv');
    const dateGroups = page.locator('[id^="date-"]');

    // Get the first visible date group
    const firstVisibleGroup = await getFirstVisibleDateGroup(page);

    if (firstVisibleGroup && yearText) {
      const dateId = await firstVisibleGroup.getAttribute('id');
      expect(dateId).toBeTruthy();

      if (dateId) {
        // Extract date from id (format: date-YYYY-MM-DD)
        const dateStr = dateId.replace('date-', '');
        const year = new Date(dateStr).getFullYear();

        // The visible date should match the clicked year
        expect(year.toString()).toBe(yearText.trim());
      }
    }
  });

  test('should not allow clicking years without photos', async ({ page }) => {
    // Find a disabled year button (if any exist)
    const disabledYearButton = page.locator('.fixed.right-0 button[disabled]').first();

    // Check if any disabled years exist
    const count = await disabledYearButton.count();

    if (count > 0) {
      // Verify it's disabled
      await expect(disabledYearButton).toBeDisabled();

      // Verify it has the disabled styling
      await expect(disabledYearButton).toHaveClass(/opacity-30/);
    }
  });

  test('should update current year indicator when scrolling through photos', async ({ page }) => {
    // Get the scrollable container
    const scrollableDiv = page.locator('#scrollableDiv');

    // Find all date groups
    const dateGroups = page.locator('[id^="date-"]');
    const dateGroupCount = await dateGroups.count();

    if (dateGroupCount > 1) {
      // Get the first date group's year
      const firstDateId = await dateGroups.first().getAttribute('id');
      expect(firstDateId).toBeTruthy();

      if (firstDateId) {
        const firstYear = new Date(firstDateId.replace('date-', '')).getFullYear();

        // Scroll down significantly
        await scrollableDiv.evaluate((el) => {
          el.scrollTop = el.scrollHeight / 2;
        });

        // Wait for scroll event to propagate
        await page.waitForTimeout(500);

        // Find the active year in timeline (should have scale-125 or text-blue-600)
        const activeYear = page.locator('.fixed.right-0 button.text-blue-600').first();

        // Check if an active year is highlighted
        const activeCount = await activeYear.count();
        if (activeCount > 0) {
          const activeYearText = await activeYear.textContent();
          expect(activeYearText).toBeTruthy();

          // The active year should exist
          if (activeYearText) {
            const yearNum = parseInt(activeYearText.trim());
            expect(yearNum).toBeGreaterThanOrEqual(1970);
            expect(yearNum).toBeLessThanOrEqual(new Date().getFullYear());
          }
        }
      }
    }
  });

  test('should align timeline years with photo dates', async ({ page }) => {
    // Get all date groups
    const dateGroups = page.locator('[id^="date-"]');
    const dateGroupCount = await dateGroups.count();

    if (dateGroupCount > 0) {
      // Extract years from all date groups
      const photoYears = new Set<number>();

      for (let i = 0; i < Math.min(dateGroupCount, 20); i++) {
        const dateGroup = dateGroups.nth(i);
        const dateId = await dateGroup.getAttribute('id');

        if (dateId) {
          const dateStr = dateId.replace('date-', '');
          const year = new Date(dateStr).getFullYear();
          photoYears.add(year);
        }
      }

      // Get enabled years from timeline
      const enabledYearButtons = page.locator('.fixed.right-0 button:not([disabled])');
      const enabledCount = await enabledYearButtons.count();

      const timelineYears = new Set<number>();

      for (let i = 0; i < enabledCount; i++) {
        const button = enabledYearButtons.nth(i);
        const yearText = await button.textContent();

        if (yearText) {
          const year = parseInt(yearText.trim());
          timelineYears.add(year);
        }
      }

      // Every photo year should be represented in the timeline as enabled
      for (const photoYear of photoYears) {
        expect(timelineYears.has(photoYear)).toBe(true);
      }
    }
  });

  test('should scroll to correct date when clicking a year', async ({ page }) => {
    // Find an enabled year button
    const enabledYearButton = page.locator('.fixed.right-0 button:not([disabled])').first();
    await expect(enabledYearButton).toBeVisible();

    // Get the year text
    const yearText = await enabledYearButton.textContent();
    expect(yearText).toBeTruthy();

    if (yearText) {
      const clickedYear = parseInt(yearText.trim());

      // Click the year
      await enabledYearButton.click();

      // Wait for smooth scroll animation
      await page.waitForTimeout(1500);

      // Get the first visible date group after scroll
      const firstVisibleGroup = await getFirstVisibleDateGroup(page);
      expect(firstVisibleGroup).toBeTruthy();

      if (firstVisibleGroup) {
        const dateId = await firstVisibleGroup.getAttribute('id');
        expect(dateId).toBeTruthy();

        if (dateId) {
          const dateStr = dateId.replace('date-', '');
          const visibleYear = new Date(dateStr).getFullYear();

          // The visible year should match the clicked year
          expect(visibleYear).toBe(clickedYear);
        }
      }
    }
  });

  test('should maintain scroll position after clicking timeline', async ({ page }) => {
    // Get the scrollable container
    const scrollableDiv = page.locator('#scrollableDiv');

    // Find an enabled year button
    const enabledYearButton = page.locator('.fixed.right-0 button:not([disabled])').first();
    await expect(enabledYearButton).toBeVisible();

    // Click the year
    await enabledYearButton.click();

    // Wait for scroll to complete
    await page.waitForTimeout(1500);

    // Get scroll position after click
    const scrollTopAfterClick = await scrollableDiv.evaluate((el) => el.scrollTop);

    // Wait a bit more
    await page.waitForTimeout(500);

    // Verify scroll position hasn't changed (no drift)
    const scrollTopAfterWait = await scrollableDiv.evaluate((el) => el.scrollTop);

    // Allow for minor differences (within 5px)
    expect(Math.abs(scrollTopAfterClick - scrollTopAfterWait)).toBeLessThan(5);
  });

  test('should show active indicator on current year', async ({ page }) => {
    // Wait for photos to load
    await page.waitForSelector('[id^="date-"]');

    // Get the scrollable container
    const scrollableDiv = page.locator('#scrollableDiv');

    // Scroll to top
    await scrollableDiv.evaluate((el) => {
      el.scrollTop = 0;
    });

    // Wait for scroll event
    await page.waitForTimeout(500);

    // Find the active year indicator (pulsing dot or highlighted year)
    const activeIndicator = page.locator('.fixed.right-0 .animate-pulse').first();

    // Check if an active indicator exists
    const count = await activeIndicator.count();

    if (count > 0) {
      // Verify the active indicator is visible
      await expect(activeIndicator).toBeVisible();
    }
  });
});

/**
 * Helper function to get the first visible date group in the viewport
 */
async function getFirstVisibleDateGroup(page: Page) {
  const dateGroups = page.locator('[id^="date-"]');
  const count = await dateGroups.count();

  for (let i = 0; i < count; i++) {
    const group = dateGroups.nth(i);
    const box = await group.boundingBox();

    if (box && box.y >= 0 && box.y < 300) {
      return group;
    }
  }

  return null;
}
