// AIDD evidence capture — Playwright, zero-config template.
// Usage: node playwright-capture.mjs <pre|post> <baseURL> <flows.json>
//   flows.json: [{ "id": "login", "path": "/login", "actions": [] }]
// Requires: npm i -D playwright && npx playwright install chromium
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';

const [, , stage, baseURL, flowsFile] = process.argv;
if (!stage || !baseURL || !flowsFile) {
  console.error('usage: node playwright-capture.mjs <pre|post> <baseURL> <flows.json>');
  process.exit(2);
}
const flows = JSON.parse(readFileSync(flowsFile, 'utf8'));
const outDir = `evidence/${stage}`;
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext();
for (const flow of flows) {
  const page = await context.newPage();
  await page.goto(new URL(flow.path, baseURL).toString(), { waitUntil: 'networkidle' });
  for (const action of flow.actions ?? []) {
    if (action.click) await page.click(action.click);
    if (action.fill) await page.fill(action.fill.selector, action.fill.value);
  }
  await page.screenshot({ path: `${outDir}/${flow.id}.png`, fullPage: true });
  console.log(`captured ${stage}/${flow.id}.png`);
  await page.close();
}
await browser.close();
