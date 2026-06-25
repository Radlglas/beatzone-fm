import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'temporary screenshots');
if (!existsSync(outDir)) await mkdir(outDir, { recursive: true });

const browser = await puppeteer.launch({
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required'],
  headless: true,
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.goto('http://localhost:3000/wm-scenes/main.html', { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 800));

// trigger TOR!
await page.evaluate(() => { if (window.torFlash) window.torFlash(); });
await new Promise(r => setTimeout(r, 600));

const path = join(outDir, 'screenshot-tor-active.png');
await page.screenshot({ path });
console.log('Saved:', path);
await browser.close();
