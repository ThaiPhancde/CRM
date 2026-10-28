// capture.mjs — engine chụp + annotate ảnh cho /userguide (dùng chung mọi feature).
//
// Chạy: node capture.mjs <job.json> [--out <dir>] [--headed]
//
// Job spec (JSON): {
//   "device": "desktop|tablet|mobile" | {"width":1440,"height":960},   // mặc định desktop 1440
//   "outDir": "docs/userguide/images",                                  // ghi PNG vào đây (override bằng --out)
//   "login": {                          // (tùy chọn) đăng nhập site live trước khi chụp
//     "url": "https://.../",
//     "steps": [ {"fill":"#email","value":"..."}, {"fill":"#password","value":"..."},
//                {"click":"button:has-text('Sign in')"}, {"waitUrl":"**/dashboard"} ]
//   },
//   "shots": [ {
//     "slug": "lesson-open",            // tên file PNG (không đuôi)
//     "html": "docs/.../screen.html",   // NGUỒN 1: file HTML local (file://)  — HOẶC
//     "url":  "https://.../material/..",// NGUỒN 2: URL live (đã login ở trên)
//     "frame": "materials.enrichenglish",// (tùy chọn) chụp/định vị trong iframe khớp url-substring
//     "waitMs": 6000,                   // chờ SPA render
//     "waitFor": "text=Agenda",         // (tùy chọn) chờ selector xuất hiện
//     "steps": [ ... ],                 // (tùy chọn) thao tác trước khi chụp (click/fill/scrollTo)
//     "callouts": [                     // annotation trên ảnh — mỗi cái 1 kiểu:
//        {"selector":"...","n":1},                              // badge SỐ (default) ở góc element
//        {"selector":"...","type":"arrow","dir":"left","n":2},  // MŨI TÊN chỉ vào element (dir=phía đặt tên)
//        {"selector":"...","type":"label","text":"Bấm đây","dir":"top"}, // NHÃN CHỮ + mũi tên
//        {"selector":"...","type":"box","color":"#2563eb"}      // chỉ KHUNG highlight (đổi màu tùy chọn)
//     ],                                 // mọi kiểu đều kèm khung highlight quanh element
//     "mask": ["text=danial@enrichenglish.net", ".user-name"],  // PII: bôi hộp che TRƯỚC khi chụp
//     "fullPage": false
//   } ]
// }
//
// Kỹ thuật (research-backed): inject SVG overlay TRƯỚC page.screenshot() — toạ độ lấy thẳng từ
// getBoundingClientRect() cùng hệ toạ độ ảnh → deterministic, không remap. Iframe-aware.
// Chống lỗi-thời: ghi <slug>.png.sha1 (hash job-entry) cạnh PNG; skill so sánh để regen chọn lọc.

import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, join, dirname, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEVICES = { mobile: { width: 375, height: 812 }, tablet: { width: 768, height: 1024 }, desktop: { width: 1440, height: 960 } };
const args = process.argv.slice(2);
const jobPath = args.find(a => !a.startsWith('--'));
const outOverride = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const headed = args.includes('--headed');
if (!jobPath) { console.error('Usage: node capture.mjs <job.json> [--out <dir>] [--headed]'); process.exit(1); }

const job = JSON.parse(readFileSync(jobPath, 'utf8'));
const repoRoot = process.cwd();
const device = typeof job.device === 'object' ? job.device : (DEVICES[job.device] || DEVICES.desktop);
const outDir = resolve(repoRoot, outOverride || job.outDir || 'docs/userguide/images');
mkdirSync(outDir, { recursive: true });

const hashEntry = (shot) => createHash('sha1').update(JSON.stringify(shot)).digest('hex').slice(0, 12);

// Overlay + mask logic. Selectors may use Playwright pseudo (:has-text, text=) → resolve via
// LOCATORS (ctx.locator) to get bounding boxes, then inject SVG by coordinates. Native
// querySelector can't parse those pseudo-selectors, so we never pass selectors into evaluate().
async function annotate(ctx, callouts, masks, warnings) {
  // Resolve boxes on the Node side using Playwright locators.
  const maskBoxes = [];
  for (const sel of (masks || [])) {
    const loc = ctx.locator(sel);
    const cnt = await loc.count().catch(() => 0);
    for (let i = 0; i < cnt; i++) {
      const b = await loc.nth(i).boundingBox().catch(() => null);
      if (b) maskBoxes.push(b);
    }
  }
  const calloutBoxes = [];
  for (const co of (callouts || [])) {
    const loc = ctx.locator(co.selector);
    const b = await loc.first().boundingBox().catch(() => null);
    // type: 'number' (badge số, default) | 'arrow' (mũi tên chỉ vào) | 'label' (nhãn chữ) | 'box' (chỉ khung).
    // dir (cho arrow/label): 'left'|'right'|'top'|'bottom' — phía đặt mũi tên/nhãn (default 'left').
    // text: chữ cho label; n: số cho badge; color: mã màu (default đỏ #e11d48).
    if (b) calloutBoxes.push({ ...b, n: co.n, type: co.type || (co.text ? 'label' : 'number'), dir: co.dir || 'left', text: co.text, color: co.color || '#e11d48' });
    else warnings.push(`callout selector no match: ${co.selector}`);
  }
  // Playwright's boundingBox() is ALWAYS relative to the top-level viewport — even for elements
  // inside an iframe — so no frame offset is needed. (Adding one double-counts and shifts the box.)
  const offset = { x: 0, y: 0 };
  // Inject overlay into the TOP page (covers full screenshot area), using absolute coordinates.
  const page = ctx.page ? ctx.page() : ctx;
  await page.evaluate(({ maskBoxes, calloutBoxes, offset }) => {
    const NS = 'http://www.w3.org/2000/svg';
    for (const b of maskBoxes) {
      const d = document.createElement('div');
      Object.assign(d.style, { position: 'fixed', left: (b.x + offset.x) + 'px', top: (b.y + offset.y) + 'px',
        width: b.width + 'px', height: b.height + 'px', background: '#334155', borderRadius: '4px',
        zIndex: 2147483646, pointerEvents: 'none' });
      document.body.appendChild(d);
    }
    if (!calloutBoxes.length) return;
    const svg = document.createElementNS(NS, 'svg');
    Object.assign(svg.style, { position: 'fixed', inset: '0', zIndex: 2147483647, pointerEvents: 'none' });
    svg.setAttribute('width', innerWidth); svg.setAttribute('height', innerHeight);
    // one shared arrowhead marker
    const defs = document.createElementNS(NS, 'defs');
    defs.innerHTML = '<marker id="ugArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z"/></marker>';
    svg.appendChild(defs);
    const mk = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
    for (const b of calloutBoxes) {
      const x = b.x + offset.x, y = b.y + offset.y, col = b.color;
      // Highlight box quanh element cho MỌI loại (nhấn mạnh vùng).
      svg.appendChild(mk('rect', { x: x - 4, y: y - 4, width: b.width + 8, height: b.height + 8, rx: 7, fill: 'none', stroke: col, 'stroke-width': 2.5 }));
      // Điểm neo trên cạnh element theo hướng dir.
      const anchor = { left: [x - 6, y + b.height / 2], right: [x + b.width + 6, y + b.height / 2],
                       top: [x + b.width / 2, y - 6], bottom: [x + b.width / 2, y + b.height + 6] }[b.dir];
      // Khoảng lùi ra xa element: nhãn cần xa hơn (chừa chỗ cho hộp chữ), mũi tên/badge gần hơn.
      const fs = 15, pad = 8;
      const labelW = b.text ? (b.text.length * fs * 0.62 + pad * 2) : 0, labelH = fs + pad * 2;
      const G = b.text ? 34 + (b.dir === 'left' || b.dir === 'right' ? labelW : labelH) : 50;
      const away = { left: [anchor[0] - G, anchor[1]], right: [anchor[0] + G, anchor[1]],
                     top: [anchor[0], anchor[1] - G], bottom: [anchor[0], anchor[1] + G] }[b.dir];

      const hasText = !!b.text;
      if (b.type === 'arrow' || b.type === 'label' || hasText) {
        // Mũi tên từ điểm 'away' chỉ vào element (marker ở đầu x2/anchor).
        const line = mk('line', { x1: away[0], y1: away[1], x2: anchor[0], y2: anchor[1], stroke: col, 'stroke-width': 3, 'marker-end': 'url(#ugArrow)' });
        svg.appendChild(line);
      }
      if (hasText) {
        // Hộp nhãn CĂN GIỮA quanh điểm 'away' (đầu đuôi mũi tên), luôn nằm trong khung.
        const w = labelW, h = labelH;
        let lx = away[0] - w / 2, ly = away[1] - h / 2;
        lx = Math.max(4, Math.min(lx, innerWidth - w - 4));
        ly = Math.max(4, Math.min(ly, innerHeight - h - 4));
        svg.appendChild(mk('rect', { x: lx, y: ly, width: w, height: h, rx: 6, fill: col }));
        const t = mk('text', { x: lx + w / 2, y: ly + h / 2 + fs / 3, 'text-anchor': 'middle', fill: '#fff', 'font-size': fs, 'font-family': 'system-ui, sans-serif', 'font-weight': '700' });
        t.textContent = b.text; svg.appendChild(t);
      } else if (b.type === 'number' || (b.type === 'arrow' && b.n != null)) {
        // Badge số ở góc trên-phải element (number) hoặc tại 'away' (arrow kèm số).
        const [bx, by] = b.type === 'number' ? [x + b.width + 2, y - 2] : away;
        svg.appendChild(mk('circle', { cx: bx, cy: by, r: 13, fill: col, stroke: '#fff', 'stroke-width': 2 }));
        const t = mk('text', { x: bx, y: by + 5, 'text-anchor': 'middle', fill: '#fff', 'font-size': 15, 'font-family': 'system-ui, sans-serif', 'font-weight': '700' });
        t.textContent = b.n; svg.appendChild(t);
      }
    }
    // arrowhead fill = màu callout đầu tiên (đơn giản: đỏ mặc định; per-color marker phức tạp hơn, đủ dùng)
    defs.querySelector('#ugArrow path').setAttribute('fill', calloutBoxes[0].color);
    document.body.appendChild(svg);
  }, { maskBoxes, calloutBoxes, offset });
}

async function runSteps(target, steps) {
  for (const s of (steps || [])) {
    if (s.fill) await target.fill(s.fill, s.value ?? '');
    else if (s.click) await target.click(s.click);
    else if (s.waitUrl) await target.page?.().waitForURL?.(s.waitUrl, { timeout: 30000 }).catch(() => {});
    else if (s.waitFor) await target.waitForSelector(s.waitFor, { timeout: 30000 }).catch(() => {});
    else if (s.scrollTo != null) await target.evaluate(y => window.scrollTo(0, y), s.scrollTo);
    else if (s.waitMs) await target.waitForTimeout?.(s.waitMs);
    if (s.thenWaitMs) await (target.waitForTimeout ? target.waitForTimeout(s.thenWaitMs) : new Promise(r => setTimeout(r, s.thenWaitMs)));
  }
}

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ viewport: device, deviceScaleFactor: 2 });
const page = await context.newPage();
const report = { captured: [], skipped: [], errors: [] };

try {
  // Optional login for live sites
  if (job.login) {
    await page.goto(job.login.url, { waitUntil: 'networkidle', timeout: 45000 });
    for (const s of (job.login.steps || [])) {
      if (s.fill) await page.fill(s.fill, s.value ?? '');
      else if (s.click) await page.click(s.click);
      else if (s.waitUrl) await page.waitForURL(s.waitUrl, { timeout: 30000 }).catch(() => {});
      else if (s.waitMs) await page.waitForTimeout(s.waitMs);
    }
    await page.waitForTimeout(1500);
  }

  for (const shot of job.shots) {
    const png = join(outDir, shot.slug + '.png');
    const sha = join(outDir, shot.slug + '.png.sha1');
    const digest = hashEntry(shot);
    // staleness skip (unless --force via env)
    if (!process.env.UG_FORCE && existsSync(png) && existsSync(sha) && readFileSync(sha, 'utf8').trim() === digest) {
      report.skipped.push({ slug: shot.slug, reason: 'unchanged (sha1 match)' });
      continue;
    }
    try {
      const navUrl = shot.url || pathToFileURL(isAbsolute(shot.html) ? shot.html : resolve(repoRoot, shot.html)).href;
      await page.goto(navUrl, { waitUntil: 'networkidle', timeout: 45000 });
      // font readiness + freeze animation (top document)
      await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      await page.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important}' }).catch(() => {});
      if (shot.waitMs) await page.waitForTimeout(shot.waitMs);
      if (shot.waitFor) await page.waitForSelector(shot.waitFor, { timeout: 30000 }).catch(() => {});

      // Resolve target context: iframe or top page
      let target = page;
      if (shot.frame) {
        await page.waitForTimeout(1000);
        const fr = page.frames().find(f => f.url().includes(shot.frame));
        if (!fr) throw new Error('frame not found: ' + shot.frame);
        target = fr;
        await fr.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
      }

      await runSteps(target, shot.steps);
      const warnings = [];
      await annotate(target, shot.callouts, shot.mask, warnings);
      await page.screenshot({ path: png, fullPage: !!shot.fullPage });
      writeFileSync(sha, digest);
      report.captured.push({ slug: shot.slug, png, ...(warnings.length ? { warnings } : {}) });
    } catch (e) {
      report.errors.push({ slug: shot.slug, error: e.message });
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
process.exit(report.errors.length ? 1 : 0);
