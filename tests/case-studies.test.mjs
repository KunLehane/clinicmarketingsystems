import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const read = file => fs.readFile(file, 'utf8');
const route = '/case-studies/physio-rooms-cork/';

test('existing clinic case studies retain their routes and verified identities', async () => {
  const magic = await read('dist/case-studies/magic-hands-jimmy/index.html');
  assert.match(magic, /Case study · Dublin 15/);
  assert.match(magic, /href="https:\/\/magichands\.ie\/"/);
  assert.doesNotMatch(magic, /Cork/);
  const neuro = await read('dist/case-studies/neuro-pain-clinic/index.html');
  assert.match(neuro, /href="https:\/\/neuropainclinic\.ie\/"/);
  assert.match(neuro, /Neuro Muscular Pain and Injury Clinic/);
  const listing = await read('dist/case-studies/index.html');
  assert.match(listing, /Manual therapy · Dublin 15/);
  const pages = JSON.parse(await read('src/pages.json'));
  const clinicRoutes = pages.filter(page => page.path.startsWith('/case-studies/') && page.path !== '/case-studies/');
  assert.equal(clinicRoutes.length, 3, 'Keep the existing studies without creating duplicate identities');
});

test('Physio Rooms Cork has a complete, discoverable case study', async () => {
  const pages = JSON.parse(await read('src/pages.json'));
  const page = pages.find(page => page.path === route);
  assert.ok(page, 'Dedicated Physio Rooms Cork route must exist');
  const html = await read(`dist${route}index.html`);
  assert.match(html, /<h1>Physio Rooms Cork:/);
  assert.match(html, /James/);
  assert.match(html, /Douglas/);
  assert.match(html, /A few months later/);
  assert.match(html, /Cliniko/);
  assert.match(html, /getting ready/);
  assert.match(html, /href="https:\/\/physioroomscork\.com\/"[^>]*rel="noopener"/);
  assert.match(html, /class="case-panel"/);
  assert.match(html, /class="check-list"/);
  assert.match(html, /BreadcrumbList/);
  assert.match(html, /rel="canonical" href="https:\/\/clinicmarketingsystems\.com\/case-studies\/physio-rooms-cork\/"/);
  assert.doesNotMatch(html, /\{\{|\[(?:TODO|TBC|insert)[^\]]*\]|\u2014|physioroomscork\.ie/i);
  for (const file of ['dist/index.html', 'dist/case-studies/index.html']) {
    assert.ok((await read(file)).includes(`href="${route}"`), `${file} must link to the case study`);
  }
  assert.ok((await read('dist/sitemap.xml')).includes(route));
});
