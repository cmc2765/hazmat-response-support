import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
const check=async (label,fn)=>{await fn();console.log('PASS:',label);};
try {
  await page.goto('http://127.0.0.1:4177/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('.app-primary-nav [data-view="monitor"]').click();
  await page.waitForSelector('#monitor .monitor-unit-card',{timeout:15000});
  await check('Starter inventory 17 units',async()=>{
    assert.equal(await page.locator('#monitor .monitor-unit-card').count(),17);
    assert.equal((await page.locator('#monitor-total-count').textContent()).trim(),'17');
  });
  await check('Initial map and manual readings empty',async()=>{
    assert.equal((await page.locator('#monitor-mapped-count').textContent()).trim(),'0 LOCATED');
    assert.equal((await page.locator('#monitor-alarm-count').textContent()).trim(),'0');
    assert.equal(await page.locator('#monitor-recent-body tr').count(),0);
  });
  await mkdir('artifacts',{recursive:true});
  await page.screenshot({path:'artifacts/monitoring-v2-initial-desktop.png',fullPage:false});
  const first=page.locator('#monitor .monitor-unit-card').first();
  await first.getByRole('button',{name:'DEPLOY UNIT'}).click();
  await page.locator('#monitor-deploy-team').fill('TEST Entry Team');
  await page.locator('#monitor-deploy-role').fill('Test Downwind');
  await page.locator('#monitor-deploy-location').fill('TEST Monitoring Point');
  await page.locator('#monitor-deploy-lat').fill('33.2900');
  await page.locator('#monitor-deploy-lon').fill('-86.8100');
  await page.locator('#monitor-deployment-form button[type="submit"]').click();
  await check('Deployment updates correct unit and coordinates',async()=>{
    assert.equal((await page.locator('#monitor-deployed-count').textContent()).trim(),'1');
    assert.equal((await page.locator('#monitor-location-count').textContent()).trim(),'1');
    const markers=await page.evaluate(()=>window.getHazMatIQMonitorMarkers?.());
    assert.equal(markers.length,1);
    assert.equal(markers[0].latitude,33.29);
  });
  await first.getByRole('button',{name:'ENTER READING'}).click();
  await page.locator('#monitor-entry-sensor').selectOption('NH3');
  await page.locator('#monitor-entry-value').fill('18');
  await page.locator('#monitor-entry-reporter').fill('TEST Entry Team');
  await page.locator('#monitor-manual-form button[type="submit"]').click();
  await check('Manual reading updates status and recent readings',async()=>{
    assert.equal((await page.locator('#monitor-readings-count').textContent()).trim(),'1');
    assert.equal(await page.locator('#monitor-recent-body tr').count(),1);
    assert.match(await page.locator('#monitor-recent-body').textContent(),/18/);
    assert.match(await page.locator('#monitor-recent-body').textContent(),/Manual/);
    assert.match(await page.locator('#monitor-console-units').textContent(),/MANUAL DATA/);
  });
  await page.screenshot({path:'artifacts/monitoring-v2-qa-sample-data.png',fullPage:true});
  console.log('Browser page errors (nonfatal; may include offline backend API):',errors.slice(0,6));
} finally {await browser.close();}
