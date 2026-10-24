// Checks the built site and the source tree. Exits 1 on any issue.
import fs from 'node:fs/promises';
import path from 'node:path';
import { SITE_URL } from './src/config.mjs';

const pages = JSON.parse(await fs.readFile('src/pages.json', 'utf8'));
const issues = [];
const add = (where, msg) => issues.push(`${where}: ${msg}`);
const DASHES = new RegExp("[\\u2012-\\u2015]");
const decode = s => s.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p)); else out.push(p);
  }
  return out;
}

// 1. No em or en dashes and no CRLF anywhere in source or output.
const textExt = /\.(html|css|js|mjs|ts|json|xml|txt|svg|md)$|_headers$|_redirects$/;
for (const f of (await walk('.')).filter(f => textExt.test(f))) {
  const t = await fs.readFile(f, 'utf8');
  if (DASHES.test(t)) add(f, 'contains an em or en dash');
  if (t.includes('\r')) add(f, 'contains CRLF line endings');
}

// 2. Per-page checks on the built HTML.
const routes = new Set(pages.map(p => p.path));
const titles = new Map(), descs = new Map();
let jsonLdBlocks = 0, forms = 0;
for (const p of pages) {
  const file = p.path === '/' ? 'dist/index.html' : p.path === '/404/' ? 'dist/404.html' : path.join('dist', p.path, 'index.html');
  let h;
  try { h = await fs.readFile(file, 'utf8'); } catch { add(p.path, 'not built'); continue; }

  const title = decode(h.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  if (!title) add(p.path, 'missing title');
  else if (title.length > 60) add(p.path, `title is ${title.length} chars (max 60)`);
  if (titles.has(title)) add(p.path, `duplicate title with ${titles.get(title)}`); titles.set(title, p.path);

  const desc = decode(h.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '');
  if (!desc) add(p.path, 'missing meta description');
  else if (desc.length >= 158) add(p.path, `description is ${desc.length} chars (must be under 158)`);
  if (descs.has(desc)) add(p.path, `duplicate description with ${descs.get(desc)}`); descs.set(desc, p.path);

  const canon = h.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canon !== SITE_URL + p.path) add(p.path, `canonical is ${canon}`);

  const h1s = (h.match(/<h1[\s>]/g) || []).length;
  if (h1s !== 1) add(p.path, `${h1s} h1 elements`);
  if (!/<html lang="en-IE"/.test(h)) add(p.path, 'missing lang');

  const blocks = [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const types = [];
  for (const [, json] of blocks) {
    jsonLdBlocks++;
    try {
      const o = JSON.parse(json);
      if (o['@context'] !== 'https://schema.org' || !o['@type']) add(p.path, 'JSON-LD missing @context or @type');
      types.push(o['@type']);
    } catch (e) { add(p.path, `invalid JSON-LD: ${e.message}`); }
  }
  const need = [];
  if (p.type === 'home') need.push('Organization', 'WebSite');
  if (p.service) need.push('Service');
  if (p.article) need.push('Article');
  if (p.path !== '/' && !p.noindex) need.push('BreadcrumbList');
  for (const t of need) if (!types.includes(t)) add(p.path, `missing ${t} JSON-LD`);

  // Internal links and assets resolve.
  for (const [, ref] of h.matchAll(/(?:src|href|action)="(\/[^"#?]*)[^"]*"/g)) {
    if (ref.startsWith('//') || ref === '/api/submit') continue;
    if (/\.[a-z0-9]+$/i.test(ref)) { try { await fs.access(path.join('dist', ref)); } catch { add(p.path, `missing asset ${ref}`); } }
    else if (!routes.has(ref)) add(p.path, `broken internal link ${ref}`);
  }

  // Outbound links open safely.
  for (const [a] of h.matchAll(/<a [^>]*href="https?:\/\/[^"]*"[^>]*>/g)) {
    if (!/rel="[^"]*noopener/.test(a) || !/target="_blank"/.test(a)) add(p.path, `outbound link without rel noopener/target: ${a}`);
  }

  // Forms post to the function and carry the honeypot and required fields.
  for (const [f] of h.matchAll(/<form[\s\S]*?<\/form>/g)) {
    forms++;
    // The fields the function requires must be present...
    for (const field of ['name', 'clinic', 'email', 'company-website', 'form-name'])
      if (!f.includes(`name="${field}"`)) add(p.path, `form missing field ${field}`);
    // ...and every other field must be one the function accepts, or it is silently dropped.
    const allowed = new Set(['form-name', 'company-website', 'name', 'clinic', 'email', 'phone', 'website', 'clinic_type', 'problem', 'message']);
    for (const [, n] of f.matchAll(/\sname="([^"]+)"/g))
      if (!allowed.has(n)) add(p.path, `form field not accepted by /api/submit: ${n}`);
    if (!f.includes('action="/api/submit"')) add(p.path, 'form does not post to /api/submit');
  }
  if (/\{\{[^}]+\}\}/.test(h)) add(p.path, 'unreplaced template token');
}

for (const f of ['dist/sitemap.xml', 'dist/robots.txt']) { try { await fs.access(f); } catch { add(f, 'missing'); } }

console.log(JSON.stringify({ pages: pages.length, jsonLdBlocks, forms, issues }, null, 2));
if (issues.length) process.exitCode = 1;
