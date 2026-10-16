import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto('http://localhost:5175', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.assistant-bubble', { timeout: 90000 });
await page.screenshot({ path: '/tmp/bubble-wide.png', clip: { x: 975, y: 40, width: 300, height: 200 } });
console.log('done');
