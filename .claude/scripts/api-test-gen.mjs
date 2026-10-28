#!/usr/bin/env node
/**
 * api-test-gen.mjs — Bruno collection generator cho /api-test (BA-KIT).
 *
 * Thuần Node ESM, KHÔNG cần node_modules để chạy. Sinh deterministic từ plan.
 *   node api-test-gen.mjs --dir docs/{feature}/test/api
 *
 * Đọc:  <dir>/bruno/plan.json  +  <dir>/bruno/vars.json
 * Sinh: <dir>/bruno/bruno.json
 *       <dir>/bruno/environments/<env>.bru
 *       <dir>/bruno/<seq>-<slug>.bru        (request map đủ → chạy được)
 *       <dir>/bruno/<seq>-<slug>.bru.todo   (chưa map đủ → Bruno KHÔNG chạy → không false-pass)
 *
 * Quy tắc "no false-pass": request chỉ sinh .bru CHẠY ĐƯỢC khi có url thật (không rỗng, không chứa
 * TODO/<...>) VÀ ≥1 assert. Ngược lại → .bru.todo (stub, non-executable).
 *
 * In: APIGEN-OK: requests=N bru=N todo=M   (hoặc APIGEN-ERROR: ... + exit 1)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

function fail(msg) { console.error('APIGEN-ERROR: ' + msg); process.exit(1); }

function parseArgs(argv) {
  const a = { dir: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--dir') a.dir = argv[++i];
  }
  return a;
}

function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'request';
}

function isMapped(req) {
  const url = (req.url || '').trim();
  if (!url) return false;
  if (/TODO|<[^>]+>/i.test(url)) return false;
  const asserts = Array.isArray(req.asserts) ? req.asserts.filter(x => String(x).trim()) : [];
  if (asserts.length === 0) return false;
  return true;
}

function indent(text, pad) {
  return String(text).split('\n').map(l => (l.length ? pad + l : l)).join('\n');
}

function renderBru(req, seq, mapped) {
  const method = (req.method || 'get').toLowerCase();
  const bodyType = req.body && Object.keys(req.body).length ? 'json' : 'none';
  const name = mapped ? req.name : `[TODO] ${req.name}`;
  let out = '';
  out += `meta {\n  name: ${name}\n  type: http\n  seq: ${seq}\n}\n\n`;
  out += `${method} {\n  url: ${req.url || ''}\n  body: ${bodyType}\n  auth: none\n}\n`;

  if (req.headers && Object.keys(req.headers).length) {
    out += `\nheaders {\n`;
    for (const [k, v] of Object.entries(req.headers)) out += `  ${k}: ${v}\n`;
    out += `}\n`;
  }
  if (bodyType === 'json') {
    out += `\nbody:json {\n${indent(JSON.stringify(req.body, null, 2), '  ')}\n}\n`;
  }
  if (mapped) {
    out += `\nassert {\n`;
    for (const a of req.asserts) out += `  ${a}\n`;
    out += `}\n`;
  }
  // metadata nghiệp vụ (BA đọc) — layer/direction/nguồn
  const meta = [];
  if (req.layer) meta.push(`layer: ${req.layer}`);
  if (req.direction) meta.push(`direction: ${req.direction}`);
  if (req.source) meta.push(`source: ${req.source}`);
  if (!mapped) meta.push(`todo: ${req.todo_reason || 'chưa có url thật / assert — chưa chạy được'}`);
  if (meta.length) out += `\ndocs {\n${indent(meta.join('\n'), '  ')}\n}\n`;
  return out;
}

function renderEnv(vars) {
  let out = `vars {\n`;
  for (const [k, v] of Object.entries(vars.vars || {})) out += `  ${k}: ${v == null ? '' : v}\n`;
  out += `}\n`;
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.dir) fail('thiếu --dir <docs/{feature}/test/api>');
  const dir = resolve(args.dir);
  const brunoDir = join(dir, 'bruno');
  const planPath = join(brunoDir, 'plan.json');
  const varsPath = join(brunoDir, 'vars.json');
  if (!existsSync(planPath)) fail('không thấy ' + planPath);

  let plan, vars;
  try { plan = JSON.parse(readFileSync(planPath, 'utf8')); }
  catch (e) { return fail('plan.json không parse được: ' + e.message); }
  try { vars = existsSync(varsPath) ? JSON.parse(readFileSync(varsPath, 'utf8')) : { name: 'sandbox', vars: {} }; }
  catch (e) { return fail('vars.json không parse được: ' + e.message); }

  const requests = Array.isArray(plan.requests) ? plan.requests : [];
  if (!requests.length) fail('plan.requests rỗng');

  mkdirSync(brunoDir, { recursive: true });
  mkdirSync(join(brunoDir, 'environments'), { recursive: true });

  // dọn output gen cũ (giữ plan.json/vars.json) — idempotent
  for (const f of readdirSync(brunoDir)) {
    if (f.endsWith('.bru') || f.endsWith('.bru.todo')) rmSync(join(brunoDir, f));
  }

  // bruno.json (collection manifest)
  const coll = { version: '1', name: plan.collection || 'api-tests', type: 'collection', ignore: ['node_modules', '.git'] };
  writeFileSync(join(brunoDir, 'bruno.json'), JSON.stringify(coll, null, 2) + '\n');

  // environment
  const envName = slugify(vars.name || 'sandbox');
  writeFileSync(join(brunoDir, 'environments', envName + '.bru'), renderEnv(vars));

  let nBru = 0, nTodo = 0;
  requests.forEach((req, i) => {
    const seq = req.seq || (i + 1);
    const mapped = isMapped(req);
    const fname = `${String(seq).padStart(2, '0')}-${slugify(req.name)}` + (mapped ? '.bru' : '.bru.todo');
    writeFileSync(join(brunoDir, fname), renderBru(req, seq, mapped));
    if (mapped) nBru++; else nTodo++;
  });

  console.log(`APIGEN-OK: requests=${requests.length} bru=${nBru} todo=${nTodo}`);
}

main();
