// Isolated acceptance of GitHub Pages' repository subpath and lazy resource loading.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium, expect } from '@playwright/test';
const root = resolve('dist');
const prefix = '/EGuitarOmitrix/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (!pathname.startsWith(prefix)) throw Error('Outside deployment');
    const file = resolve(root, pathname.slice(prefix.length) || 'index.html');
    if (!file.startsWith(root + '/')) throw Error('Outside distribution');
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  const requests = [], failures = [];
  page.on('request', r => requests.push(r.url()));
  page.on('pageerror', e => failures.push(e.message));
  page.on('response', r => { if (r.status() >= 400) failures.push(r.url()); });
  await page.goto(`http://127.0.0.1:${server.address().port}${prefix}`);
  await expect(page.locator('.brand')).toContainText('帅帅练琴屋');
  await expect(page.locator('[data-start]')).toBeEnabled();
  if (requests.some(url => /\.(gp|musicxml|sf2)(\?|$)/.test(url))) throw Error('Course files eagerly loaded on startup');
  await page.locator('[data-start]').click();
  await page.locator('[data-score]').click();
  await expect(page.locator('#score-render svg').first()).toBeVisible({ timeout: 20000 });
  if (failures.length) throw Error(failures.join('\n'));
  if (!await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)) throw Error('Mobile overflow');
  console.log('Repository-prefix routing, Chinese brand, lazy score loading and mobile score rendering passed.');
} finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
