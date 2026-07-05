// Rendert die kompletten Logo-Lockups (Icon + Schriftzug) als transparente PNGs.
// Lädt die Google-Fonts mit Node herunter und bettet sie als Base64 ein,
// damit der Browser komplett offline rendern kann.
// Aufruf: node render-logo.mjs

import puppeteer from 'puppeteer';

// ── Schriften holen & als data-URI einbetten ─────────────
async function fontDataUri(query) {
    const css = await (await fetch('https://fonts.googleapis.com/css2?' + query, {
        headers: { 'User-Agent': 'Mozilla/4.0' },
    })).text();
    const url = css.match(/url\((https:[^)]+\.ttf)\)/)[1];
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    return 'data:font/ttf;base64,' + buf.toString('base64');
}

const anton  = await fontDataUri('family=Anton');
const barlow = await fontDataUri('family=Barlow+Condensed:wght@600');

const marks = `
  <linearGradient id="tile" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff4438"/><stop offset=".55" stop-color="#e11d48"/><stop offset="1" stop-color="#9f1239"/>
  </linearGradient>
  <radialGradient id="glow" cx=".3" cy=".2" r=".95">
    <stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
    <feDropShadow dx="0" dy="9" stdDeviation="11" flood-color="#4c0519" flood-opacity="0.4"/>
  </filter>`;

const mark = `
  <g transform="translate(36,24) scale(0.72)">
    <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#tile)"/>
    <rect x="16" y="16" width="480" height="480" rx="116" fill="url(#glow)"/>
    <g filter="url(#soft)">
      <path d="M148 288 A108 108 0 0 1 364 288" fill="none" stroke="#fff5f5" stroke-width="34" stroke-linecap="round"/>
      <rect x="120" y="278" width="56" height="120" rx="28" fill="#fff5f5"/>
      <rect x="336" y="278" width="56" height="120" rx="28" fill="#fff5f5"/>
    </g>
  </g>`;

function svg(variant) {
    const dark = variant === 'dark';
    const word    = dark ? '#fff5f5' : '#1a0308';
    const fmColor = dark ? '#f6b83a' : '#c8860a';
    const tag     = dark ? '#e8c877' : '#b45309';
    return `<svg id="logo" viewBox="0 0 1480 420" xmlns="http://www.w3.org/2000/svg">
      <defs>${marks}</defs>
      ${mark}
      <text x="470" y="248" font-family="Anton" font-size="150" letter-spacing="3" fill="${word}">JOYSTREAM<tspan fill="${fmColor}"> FM</tspan></text>
      <text x="474" y="318" font-family="Barlow Condensed" font-weight="600" font-size="40" letter-spacing="14" fill="${tag}">DEIN SOUND · DEIN STREAM</text>
    </svg>`;
}

const html = variant => `<!doctype html><html><head><meta charset="utf-8"><style>
  @font-face{font-family:'Anton';src:url(${anton}) format('truetype');}
  @font-face{font-family:'Barlow Condensed';font-weight:600;src:url(${barlow}) format('truetype');}
  html,body{margin:0;background:transparent}#logo{width:1480px;height:420px;display:block}
  </style></head><body>${svg(variant)}</body></html>`;

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1480, height: 420, deviceScaleFactor: 3 });

for (const variant of ['dark', 'light']) {
    await page.setContent(html(variant), { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; });
    const el = await page.$('#logo');
    await el.screenshot({ path: `assets/joystream-logo-${variant}.png`, omitBackground: true });
    console.log(`geschrieben: assets/joystream-logo-${variant}.png`);
}

await browser.close();
