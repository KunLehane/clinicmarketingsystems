// Zero-dependency static build. Wraps each page body in the shared layout,
// adds JSON-LD, writes dist/, sitemap.xml and robots.txt.
import fs from 'node:fs/promises';
import path from 'node:path';
import { SITE_URL, SITE_NAME, CONTACT_EMAIL, BOOK_CALL_URL, ARTICLE_DATE } from './src/config.mjs';

const pages = JSON.parse(await fs.readFile('src/pages.json', 'utf8'));
const header = await fs.readFile('src/partials/header.html', 'utf8');
const footer = await fs.readFile('src/partials/footer.html', 'utf8');
const formTpl = await fs.readFile('src/partials/form.html', 'utf8');
const ctaBand = await fs.readFile('src/partials/cta.html', 'utf8');
const esc = s => String(s).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
// Client results wall. Renders nothing until src/results.json has real, approved entries.
const results = JSON.parse(await fs.readFile('src/results.json', 'utf8'));
const resultsHtml = results.length === 0 ? '' : `<section class="section section-alt results-wall" aria-labelledby="results-heading">
  <div class="container">
    <div class="section-head"><h2 id="results-heading">Clinic results</h2><p>Real clinics, real numbers, shared with their permission.</p></div>
    <ul class="results-grid">${results.map(r => `
      <li class="result-card"><p class="result-type">${esc(r.type)}${r.place ? ` · ${esc(r.place)}` : ''}</p>
        <p class="result-figure">${esc(r.figure)}</p>
        <p class="result-label">${esc(r.label)}</p>
        <p class="result-work">${esc(r.work)}</p>${r.client ? `<p class="result-client">${esc(r.client)}</p>` : ''}</li>`).join('')}
    </ul>
  </div>
</section>`;

const ORG_ID = `${SITE_URL}/#organization`;
const FONTS = 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Outfit:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap';

const thumbs = {};
for (const f of await fs.readdir('src/partials/thumbs')) thumbs[f.replace('.svg', '')] = (await fs.readFile(path.join('src/partials/thumbs', f), 'utf8')).trim();

const tokens = html => html
  .replace(/\{\{thumb:([a-z-]+)\}\}/g, (_, name) => thumbs[name] ?? `{{missing-thumb-${name}}}`)
  .replace(/\{\{form:([a-z-]+)\}\}/g, (_, name) => formTpl.replaceAll('{{FORM_NAME}}', name))
  .replaceAll('{{CTA}}', ctaBand)
  .replaceAll('{{RESULTS}}', resultsHtml)
  .replaceAll('{{CONTACT_EMAIL}}', CONTACT_EMAIL)
  .replaceAll('{{BOOK_CALL_URL}}', BOOK_CALL_URL)
  .replaceAll('{{YEAR}}', String(new Date().getFullYear()));

function schemaFor(p) {
  const url = SITE_URL + p.path;
  const out = [];
  if (p.type === 'home') {
    out.push({
      '@context': 'https://schema.org', '@type': 'Organization', '@id': ORG_ID,
      name: SITE_NAME, url: SITE_URL + '/', logo: SITE_URL + '/logo.svg',
      description: p.description, areaServed: { '@type': 'Country', name: 'Ireland' },
      founder: { '@type': 'Person', name: 'Aidan Lehane' },
    });
    out.push({
      '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE_URL}/#website`,
      name: SITE_NAME, url: SITE_URL + '/', inLanguage: 'en-IE', publisher: { '@id': ORG_ID },
    });
  }
  if (p.service) {
    out.push({
      '@context': 'https://schema.org', '@type': 'Service', name: p.service.name,
      serviceType: p.service.serviceType, description: p.description, url,
      provider: { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME, url: SITE_URL + '/' },
      areaServed: { '@type': 'Country', name: 'Ireland' },
      audience: { '@type': 'BusinessAudience', audienceType: 'Healthcare clinics' },
    });
  }
  if (p.article) {
    out.push({
      '@context': 'https://schema.org', '@type': 'Article', headline: p.article.headline,
      description: p.description, inLanguage: 'en-IE', mainEntityOfPage: url,
      datePublished: ARTICLE_DATE, dateModified: ARTICLE_DATE,
      author: { '@type': 'Person', name: 'Aidan Lehane', url: SITE_URL + '/about/' },
      publisher: { '@type': 'Organization', '@id': ORG_ID, name: SITE_NAME, logo: { '@type': 'ImageObject', url: SITE_URL + '/logo.svg' } },
    });
  }
  if (p.crumbs) {
    const items = [['Home', '/'], ...p.crumbs, [p.crumbName ?? p.h1 ?? p.title, p.path]];
    out.push({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: items.map(([name, href], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE_URL + href })),
    });
  }
  return out;
}

function crumbsHtml(p) {
  if (!p.crumbs) return '';
  const items = [['Home', '/'], ...p.crumbs];
  return `<nav class="crumbs container" aria-label="Breadcrumb"><ol>${items.map(([n, h]) => `<li><a href="${h}">${esc(n)}</a></li>`).join('')}<li><span aria-current="page">${esc(p.crumbName ?? p.title)}</span></li></ol></nav>`;
}

function navState(html, p) {
  // Mark the current section in the main nav.
  return html.replace(/<a class="nav-link" href="([^"]+)">/g, (m, href) =>
    (href !== '/' && p.path.startsWith(href)) ? `<a class="nav-link" href="${href}" aria-current="page">` : m);
}

await fs.rm('dist', { recursive: true, force: true });
await fs.mkdir('dist', { recursive: true });
await fs.cp('public', 'dist', { recursive: true });

for (const p of pages) {
  const body = tokens(await fs.readFile(path.join('src/pages', p.file), 'utf8'));
  const url = SITE_URL + p.path;
  const ld = schemaFor(p).map(o => `<script type="application/ld+json">${JSON.stringify(o).replaceAll('<', '\\u003c')}</script>`).join('');
  const robots = p.noindex ? '<meta name="robots" content="noindex">' : '';
  const html = `<!doctype html>
<html lang="en-IE" class="no-js">
<head>
<meta charset="utf-8">
<script>document.documentElement.classList.remove("no-js")</script>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title>
<meta name="description" content="${esc(p.description)}">
<link rel="canonical" href="${url}">
${robots}<meta property="og:type" content="${p.article ? 'article' : 'website'}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.description)}">
<meta property="og:url" content="${url}">
<meta name="theme-color" content="#1e202d">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="/site.css">
<script src="/site.js" defer></script>
${ld}
</head>
<body class="page-${p.type}">
<a class="skip" href="#content">Skip to content</a>
${navState(tokens(header), p)}
<main id="content">
${crumbsHtml(p)}${body}
</main>
${tokens(footer)}
</body>
</html>
`;
  const target = p.path === '/' ? 'dist/index.html' : p.path === '/404/' ? 'dist/404.html' : path.join('dist', p.path, 'index.html');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, html);
}

const listed = pages.filter(p => !p.noindex);
await fs.writeFile('dist/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listed.map(p => `<url><loc>${SITE_URL}${p.path}</loc></url>`).join('\n')}
</urlset>
`);
await fs.writeFile('dist/robots.txt', `User-agent: *
Allow: /
Disallow: /thanks/
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`);
console.log(`Built ${pages.length} pages (${listed.length} in sitemap).`);
