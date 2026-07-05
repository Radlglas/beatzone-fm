import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const url    = process.argv[2] || 'http://localhost:3000';
const label  = process.argv[3] || 'section';
const scrollY = parseInt(process.argv[4] || '0');

const dir = join(__dirname, 'temporary screenshots');
if (!existsSync(dir)) await mkdir(dir, { recursive: true });

let n = 1;
let filename;
do {
  filename = join(dir, `screenshot-${n}-${label}.png`);
  n++;
} while (existsSync(filename));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });
await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
await page.evaluate(() => document.querySelectorAll('.reveal').forEach(el => el.classList.add('in')));
await new Promise(r => setTimeout(r, 600));
if (scrollY > 0) await page.evaluate(y => window.scrollTo(0, y), scrollY);
await new Promise(r => setTimeout(r, 300));
await page.screenshot({ path: filename });
await browser.close();
console.log('Saved:', filename);
