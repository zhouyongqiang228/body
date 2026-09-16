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

test('muscles use shared search, hide history and toolbar reset', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.loading')).toHaveCount(0, { timeout: 60_000 });
  const count = () => page.locator('.panel-foot').innerText();
  const initialCount = await count();
  for (const query of ['腹外斜肌', '腹内斜肌']) {
    await page.getByRole('button', { name: '搜索解剖结构', exact: true }).click();
    await page.getByRole('combobox').fill(query);
    await page.getByRole('option').first().click();
    await page.getByRole('button', { name: '隐藏此结构', exact: true }).click();
  }
  const hiddenCount = await count();
  expect(hiddenCount).not.toBe(initialCount);
  await page.getByRole('button', { name: '撤销隐藏', exact: true }).click();
  expect(await count()).not.toBe(hiddenCount);
  await page.getByRole('button', { name: '重做隐藏', exact: true }).click();
  expect(await count()).toBe(hiddenCount);
  await page.getByRole('button', { name: '重置模型', exact: true }).click();
  expect(await count()).toBe(initialCount);
  await expect(page.getByRole('button', { name: '撤销隐藏', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '重做隐藏', exact: true })).toBeDisabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '打开系统图层' }).click();
  await expect(page.getByRole('switch', { name: '显示肌肉', exact: true })).toBeVisible();
  await expect(page.locator('.abdominal-layers')).toHaveCount(0);
  await page.getByRole('button', { name: '全部显示', exact: true }).click();
  await expect(page.getByRole('switch', { name: '显示体表', exact: true })).toBeChecked();
  await page.getByRole('button', { name: '全部隐藏', exact: true }).click();
  await expect(page.locator('.panel-foot')).toHaveText('当前显示 0 个结构');
  await page.getByRole('button', { name: '全部显示', exact: true }).click();
  await expect(page.getByRole('switch', { name: '显示肌肉', exact: true })).toBeChecked();
});
