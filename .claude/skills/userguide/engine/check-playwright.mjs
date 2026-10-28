// check-playwright.mjs — kiểm tra Playwright module + chromium browser đã sẵn sàng chưa.
// /userguide gọi trước Pha D.5 (auto-screenshot). Thiếu → in hướng dẫn cài, skill HỎI user (H+I) rồi
// mới chạy `npm install` + `npx playwright install chromium`. KHÔNG tự cài im lặng.
// Exit 0 = sẵn sàng; exit 2 = thiếu module; exit 3 = thiếu browser. Skill đọc exit code + stdout JSON.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const out = (o) => console.log(JSON.stringify(o));

// 1. module resolvable?
let pw;
try {
  pw = await import('playwright');
} catch {
  out({ ok: false, stage: 'module', hint: `cd ${here} && npm install` });
  process.exit(2);
}

// 2. browser executable present for THIS playwright version?
try {
  const exe = pw.chromium.executablePath();
  if (!exe || !existsSync(exe)) {
    out({ ok: false, stage: 'browser', hint: `cd ${here} && npx playwright install chromium` });
    process.exit(3);
  }
} catch {
  out({ ok: false, stage: 'browser', hint: `cd ${here} && npx playwright install chromium` });
  process.exit(3);
}

out({ ok: true, engine: here });
process.exit(0);
