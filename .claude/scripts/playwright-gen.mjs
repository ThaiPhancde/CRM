#!/usr/bin/env node
// playwright-gen.mjs — codegen Playwright E2E specs từ test-case plan (JSON) + selector map.
// Node thuần, KHÔNG cần node_modules để chạy (chỉ project sinh ra mới cần @playwright/test để RUN spec).
//
// Dùng:
//   node playwright-gen.mjs --dir docs/{feature}/test/e2e [--base-url http://localhost:3000]
//
// Đọc trong <dir>:
//   *.plan.json     — kế hoạch spec (do /playwright-gen sinh từ test cases). Schema xem references/example-plan.json.
//   selectors.json  — map { "selector-key": "css hoặc [data-testid=...] hoặc text=..." } (dev điền; thiếu key → test.fixme).
// Sinh trong <dir>:
//   specs/{scope}.spec.ts        — spec Playwright (AUTO-GEN, KHÔNG sửa tay).
//   {feature}-e2e-index.md       — master metadata (spec/scenario/fixme).
//   playwright.config.ts         — chỉ tạo nếu CHƯA có (không đè).
//   .env.example                 — chỉ tạo nếu CHƯA có.
//
// Nguyên tắc: scenario có bước dùng selector-key CHƯA map → wrap `test.fixme` + comment TODO
// (KHÔNG để test giả-pass). Sửa test case → chạy lại, KHÔNG sửa tay .spec.ts.

import fs from 'node:fs';
import path from 'node:path';

// ---------- args ----------
const args = process.argv.slice(2);
function opt(name, def = null) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
}
const dir = opt('--dir');
if (!dir) {
  console.error('PWGEN-ERROR: thiếu --dir <e2e-dir>');
  process.exit(2);
}
const baseUrlArg = opt('--base-url');
if (!fs.existsSync(dir)) {
  console.error(`PWGEN-ERROR: dir không tồn tại: ${dir}`);
  process.exit(2);
}

// ---------- helpers ----------
const q = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
const selectorActions = new Set([
  'click', 'fill', 'check', 'uncheck', 'select', 'press',
  'expectText', 'expectVisible', 'expectHidden', 'expectDisabled', 'expectEnabled',
]);

function stepToLine(step, selectors, unmapped) {
  const { action, target, value } = step;
  const needSel = selectorActions.has(action) && !(action === 'press' && !target);
  let sel = null;
  if (needSel) {
    if (Object.prototype.hasOwnProperty.call(selectors, target)) {
      sel = selectors[target];
    } else {
      unmapped.add(target);
      sel = `TODO-SELECTOR:${target}`;
    }
  }
  const loc = () => `page.locator('${q(sel)}')`;
  switch (action) {
    case 'goto': return `    await page.goto('${q(target)}');`;
    case 'click': return `    await ${loc()}.click();`;
    case 'fill': return `    await ${loc()}.fill('${q(value)}');`;
    case 'check': return `    await ${loc()}.check();`;
    case 'uncheck': return `    await ${loc()}.uncheck();`;
    case 'select': return `    await ${loc()}.selectOption('${q(value)}');`;
    case 'press':
      return target
        ? `    await ${loc()}.press('${q(value)}');`
        : `    await page.keyboard.press('${q(value)}');`;
    case 'expectText': return `    await expect(${loc()}).toContainText('${q(value)}');`;
    case 'expectVisible': return `    await expect(${loc()}).toBeVisible();`;
    case 'expectHidden': return `    await expect(${loc()}).toBeHidden();`;
    case 'expectDisabled': return `    await expect(${loc()}).toBeDisabled();`;
    case 'expectEnabled': return `    await expect(${loc()}).toBeEnabled();`;
    case 'expectURL': return `    await expect(page).toHaveURL('${q(value)}');`;
    case 'note': return `    // ${String(value ?? '').replace(/\n/g, ' ')}`;
    default:
      return `    // PWGEN: action không nhận diện "${action}" — bổ sung vào engine hoặc sửa plan.`;
  }
}

function scenarioToBlock(sc, selectors) {
  const unmapped = new Set();
  const lines = (sc.steps || []).map((s) => stepToLine(s, selectors, unmapped));
  const tags = (sc.tags || []).join(' ');
  const title = `${sc.id ? sc.id + ' ' : ''}${sc.title || ''}${tags ? ' ' + tags : ''}`.trim();
  const fixme = unmapped.size > 0;
  const head = [];
  if (fixme) {
    head.push(`    // TODO: selector chưa map — điền vào selectors.json rồi chạy lại /playwright-gen:`);
    for (const k of unmapped) head.push(`    //   - ${k}`);
    head.push(`    test.fixme();`);
  }
  const body = [`  test('${q(title)}', async ({ page }) => {`, ...head, ...lines, `  });`];
  return { block: body.join('\n'), fixme, unmapped: [...unmapped] };
}

function renderSpec(spec, selectors) {
  const scen = (spec.scenarios || []).map((sc) => scenarioToBlock(sc, selectors));
  const header = [
    `// AUTO-GENERATED bởi playwright-gen.mjs — KHÔNG sửa tay.`,
    `// Sửa test case rồi chạy lại: /playwright-gen (hoặc node playwright-gen.mjs --dir ...).`,
    `import { test, expect } from '@playwright/test';`,
    ``,
    `test.describe('${q(spec.title || spec.scope)}', () => {`,
  ];
  const footer = [`});`, ``];
  const text = [...header, scen.map((s) => s.block).join('\n\n'), ...footer].join('\n');
  const fixmeCount = scen.filter((s) => s.fixme).length;
  return { text, fixmeCount, total: scen.length };
}

const CONFIG_TS = (baseURL) => `import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || '${baseURL}',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
`;

const ENV_EXAMPLE = (baseURL) => `# Sao chép thành .env rồi điền giá trị thật.
BASE_URL=${baseURL}
`;

// ---------- run ----------
const planFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.plan.json'));
if (planFiles.length === 0) {
  console.error(`PWGEN-ERROR: không tìm thấy *.plan.json trong ${dir}`);
  process.exit(2);
}

let selectors = {};
const selPath = path.join(dir, 'selectors.json');
if (fs.existsSync(selPath)) {
  try { selectors = JSON.parse(fs.readFileSync(selPath, 'utf8')); }
  catch (e) { console.error(`PWGEN-ERROR: selectors.json không parse được: ${e.message}`); process.exit(2); }
} else {
  console.warn(`PWGEN-WARN: chưa có selectors.json — mọi selector coi như chưa map (test.fixme).`);
}

const specsDir = path.join(dir, 'specs');
fs.mkdirSync(specsDir, { recursive: true });

let feature = 'feature';
let baseURL = baseUrlArg || 'http://localhost:3000';
const indexRows = [];
let totalScen = 0, totalFixme = 0, totalSpecs = 0;

for (const pf of planFiles) {
  let plan;
  try { plan = JSON.parse(fs.readFileSync(path.join(dir, pf), 'utf8')); }
  catch (e) { console.error(`PWGEN-ERROR: ${pf} không parse được: ${e.message}`); process.exit(2); }
  if (plan.feature) feature = plan.feature;
  if (plan.baseURL && !baseUrlArg) baseURL = plan.baseURL;

  for (const spec of plan.specs || []) {
    const { text, fixmeCount, total } = renderSpec(spec, selectors);
    const file = path.join(specsDir, `${spec.scope}.spec.ts`);
    fs.writeFileSync(file, text, 'utf8');
    totalSpecs++; totalScen += total; totalFixme += fixmeCount;
    indexRows.push(`| ${spec.scope} | ${(spec.title || '').replace(/\|/g, '/')} | ${total} | ${fixmeCount} | \`specs/${spec.scope}.spec.ts\` |`);
  }
}

// index md
const today = new Date().toISOString().slice(0, 10);
const indexMd = `---
type: e2e-index
feature: ${feature}
status: draft
updated: ${today}
links:
  - docs/${feature}/test/testcases/${feature}-testcase-index.md
---

# ${feature} — E2E (Playwright) Index

> Spec sinh tự động bởi \`playwright-gen.mjs\` từ test case. **KHÔNG sửa tay \`.spec.ts\`** — sửa test case rồi chạy lại \`/playwright-gen\`. Cột "Fixme" = số scenario còn selector chưa map trong \`selectors.json\`.

## Specs

| Scope | Tiêu đề | Scenarios | Fixme | File |
|---|---|---|---|---|
${indexRows.join('\n')}

## Cách chạy

\`\`\`bash
cd docs/${feature}/test/e2e
npm i -D @playwright/test && npx playwright install
cp .env.example .env    # điền BASE_URL
npx playwright test
\`\`\`

## Selector map

\`selectors.json\` map { "selector-key": "css / [data-testid=...] / text=..." }. Scenario còn key chưa map → \`test.fixme()\` (không giả-pass) — điền selector rồi chạy lại.
`;
fs.writeFileSync(path.join(dir, `${feature}-e2e-index.md`), indexMd, 'utf8');

// config + env (chỉ tạo nếu chưa có)
const cfgPath = path.join(dir, 'playwright.config.ts');
if (!fs.existsSync(cfgPath)) fs.writeFileSync(cfgPath, CONFIG_TS(baseURL), 'utf8');
const envPath = path.join(dir, '.env.example');
if (!fs.existsSync(envPath)) fs.writeFileSync(envPath, ENV_EXAMPLE(baseURL), 'utf8');

console.log(`PWGEN-OK: feature=${feature} | specs=${totalSpecs} scenarios=${totalScen} fixme=${totalFixme} | out=${specsDir}`);
