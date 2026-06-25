import puppeteer from 'puppeteer';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const base  = 'http://localhost:3001';
const label = process.argv[2] || 'dashboard';
// Map label → route to avoid git-bash path conversion on Windows
const ROUTES = {
  dashboard: '/dashboard', sendeplan: '/sendeplan',
  dokumente: '/dokumente', regeln: '/regeln',
  jingles: '/jingles', team: '/team',
  profil: '/profil', admin: '/admin',
  discord: '/discord',
  onair: '/onair',
};
const route = ROUTES[label] || '/dashboard';

const dir = join(__dirname, 'temporary screenshots');
if (!existsSync(dir)) await mkdir(dir, { recursive: true });

let n = 1, filename;
do {
  filename = join(dir, `screenshot-${n}-rp-${label}.png`);
  n++;
} while (existsSync(filename));

const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1.5 });

// 1. Login
await page.goto(`${base}/login`, { waitUntil: 'networkidle2', timeout: 30000 });
await new Promise(r => setTimeout(r, 800));
await page.type('input[type="text"]', 'Marius');
await page.type('input[type="password"]', 'owner123');
await page.click('button[type="submit"]');
// Wait for auth to settle (NextAuth redirect chain)
await new Promise(r => setTimeout(r, 4000));

// 2. Navigate to target route using full URL to avoid git-bash path conversion
const targetUrl = `http://localhost:3001${route}`;
const currentUrl = page.url();
console.log('Current URL after login:', currentUrl);
if (!currentUrl.startsWith(targetUrl) && !currentUrl.includes(route.replace(/^\//, ''))) {
  console.log('Navigating to:', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 25000 });
  await new Promise(r => setTimeout(r, 1200));
} else {
  console.log('Already on target page, skipping navigation');
}

// 3. Screenshot
await page.screenshot({ path: filename, fullPage: true });
await browser.close();
console.log('Saved:', filename);
