import { test, expect } from '@playwright/test';

test('main page elements are visible', async ({ page }) => {
  await page.goto('/');

  // Header
  await expect(page.locator('h1.app-title')).toHaveText('Tomato Master');

  // Timer card
  await expect(page.locator('#timer-display')).toHaveText('25:00');
  await expect(page.locator('#btn-work')).toBeVisible();
  await expect(page.locator('#btn-short-break')).toBeVisible();
  await expect(page.locator('#btn-long-break')).toBeVisible();

  // Tasks card
  await expect(page.locator('.tasks-card')).toBeVisible();
  await expect(page.locator('#task-input')).toBeVisible();

  // Side Quests card
  await expect(page.locator('#side-quest-card')).toBeVisible();
  await expect(page.locator('#side-quest-input')).toBeVisible();

  // YouTube card
  await expect(page.locator('#youtube-card')).toBeVisible();
  await expect(page.locator('#youtube-url-input')).toBeVisible();
});
