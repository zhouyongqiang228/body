import { test, expect } from '@playwright/test';

test('visible temporalis surfaces can be selected directly from either side', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 60_000 });
  const canvas = page.locator('canvas');
  const expectTemporalis = async (side: string, x: number, y: number) => {
    await canvas.click({ position: { x, y } });
    await expect(page.locator('.structure-title')).toHaveText(`颞肌${side}`);
    await expect(page.locator('.structure-description')).toContainText('咀嚼肌');
    await page.getByRole('button', { name: '清除选择', exact: true }).click();
  };

  // These points lie on the visible muscle surface in the shipped atlas.
  // Single-sided picking incorrectly selects skull bones behind the left muscle.
  await expectTemporalis('左', 740, 94);
  await page.getByRole('button', { name: '从侧面查看人体', exact: true }).click();
  await expectTemporalis('左', 728, 89);

  // Turn half a revolution to expose the right temple, using the actual canvas controls.
  await page.mouse.move(300, 450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(1020, 450, { steps: 12 });
  await page.mouse.up({ button: 'right' });
  await expectTemporalis('右', 712, 89);
});

test('supplemental muscles and TFCC are searchable, rendered, and describe partial coverage', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 60_000 });
  for (const query of ['颞肌', '咬肌', '腹横肌', '半月板', 'TFCC']) {
    await page.getByRole('button', { name: '搜索解剖结构', exact: true }).click();
    await page.getByRole('combobox').fill(query);
    await page.getByRole('option').first().click();
    await expect(page.locator('.detail-sheet')).toBeVisible();
    await expect(page.locator('.structure-description')).not.toBeEmpty();
    await page.getByRole('button', { name: '孤立显示此结构' }).click();
    await expect(page.getByRole('button', { name: '显示周围结构' })).toBeVisible();
    if (query === 'TFCC') await expect(page.locator('.structure-description')).toContainText('不代表完整TFCC');
  }
  await page.screenshot({ path: 'test-results/supplemental-tfcc.png' });
  expect(errors).toEqual([]);
});

test('abdominal layers can be peeled and restored with hide history', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 60_000 });
  await page.locator('.abdominal-layers summary').click();
  const outer = page.getByRole('switch', { name: '显示腹外斜肌', exact: true });
  const inner = page.getByRole('switch', { name: '显示腹内斜肌', exact: true });
  const deep = page.getByRole('switch', { name: '显示腹横肌', exact: true });
  await expect(outer).toBeChecked();
  await outer.click();
  await inner.click();
  await expect(outer).not.toBeChecked();
  await expect(inner).not.toBeChecked();
  await expect(deep).toBeChecked();
  await page.getByRole('button', { name: '撤销隐藏', exact: true }).click();
  await expect(inner).toBeChecked();
  await page.getByRole('button', { name: '组合并重置', exact: true }).click();
  await expect(outer).toBeChecked();
  await expect(inner).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开系统图层' }).click();
  await expect(outer).toBeVisible();
  await outer.click();
  await expect(outer).not.toBeChecked();
});
