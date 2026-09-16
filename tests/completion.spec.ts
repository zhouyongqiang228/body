import {test,expect} from '@playwright/test';

test('completion structures can be found and isolated on desktop and mobile',async({page})=>{
  test.setTimeout(180_000);
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.loading')).toHaveCount(0,{timeout:60_000});
  // One representative per new category; detailed inventory coverage is checked separately.
  for(const query of ['腹直肌','主要关节囊','坐骨神经','臂丛','淋巴结','甲状腺']){
    await page.getByRole('button',{name:'搜索解剖结构',exact:true}).click();
    await page.getByRole('combobox').fill(query);
    await page.getByRole('option').first().click();
    await expect(page.locator('.structure-description')).not.toBeEmpty();
    await page.getByRole('button',{name:'孤立显示此结构'}).click();
    await expect(page.getByRole('button',{name:'显示周围结构'})).toBeVisible();
    if(query==='腹直肌')await page.screenshot({path:'test-results/completion-rectus.png'});
  }
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'搜索解剖结构',exact:true}).click();
  await page.getByRole('combobox').fill('胫骨前肌');
  const option=page.getByRole('option').first();
  await expect(option).toContainText('肌肉');
  await option.click();
  await expect(page.locator('.structure-description')).toContainText('背屈');
  await page.getByRole('button',{name:'孤立显示此结构'}).click();
  await page.screenshot({path:'test-results/completion-mobile.png'});
  expect(errors).toEqual([]);
});
