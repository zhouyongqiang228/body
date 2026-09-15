import { test, expect } from '@playwright/test';

test('vascular supplements render, remain searchable, and disclose incomplete pathways', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 60_000 });
  for (const [query, text, screenshot] of [
    ['头颈主要动脉', '主干缺段已补充', 'vascular-arteries'],
    ['头颈主要静脉', '下矢状窦的后续回流未连接', 'vascular-veins'],
    ['胸部奇静脉系统', '连续连接尚未补齐', 'vascular-azygos'],
  ]) {
    await page.getByRole('button', { name: '搜索解剖结构', exact: true }).click();
    await page.getByRole('combobox').fill(query);
    await page.getByRole('option').first().click();
    await expect(page.locator('.structure-description')).toContainText(text);
    await page.getByRole('button', { name: '孤立显示此结构', exact: true }).click();
    await expect(page.getByRole('button', { name: '显示周围结构', exact: true })).toBeVisible();
    // Wait for the viewer's isolate camera transition before visual QA capture.
    await page.waitForTimeout(800);
    await page.screenshot({ path: `test-results/${screenshot}.png` });
  }
  expect(errors).toEqual([]);
});

test('extended vertebral artery is available on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 60_000 });
  await page.getByRole('button', { name: '搜索解剖结构', exact: true }).click();
  await page.getByRole('combobox').fill('左椎动脉');
  await page.getByRole('option').first().click();
  await expect(page.locator('.structure-description')).toContainText('来源血管片段补齐主干缺段');
  await page.getByRole('button', { name: '孤立显示此结构', exact: true }).click();
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'test-results/vascular-mobile.png' });
});
