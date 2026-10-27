// Generates docs/site/index.html: a self-contained static page to browse every
// theme against the sample document, in the spirit of programmingfonts.org but
// with themes as the primary control. No server, no network.
// Usage: node scripts/site.mjs [outFile]
import fs from 'node:fs';
import path from 'node:path';
import { root, loadThemeCss, readThemes, readSample, createMarkdown } from './lib.mjs';

const outFile = path.resolve(process.argv[2] ?? path.join(root, 'docs', 'site', 'index.html'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const { buildCss, DEFAULT_SETTINGS, deriveColors } = await loadThemeCss();
const themes = readThemes();
const md = createMarkdown();
const { frontMatter, body } = readSample();
const fmRows = frontMatter ? frontMatter.split('\n').map((l) => l.match(/^([^:]+):\s*(.*)$/)).filter(Boolean).map((x) => `<tr><th>${md.utils.escapeHtml(x[1])}</th><td>${md.utils.escapeHtml(x[2])}</td></tr>`).join('') : '';
const sampleHtml = (fmRows ? `<table class="frontmatter"><tbody>${fmRows}</tbody></table>` : '') + md.render(body);

const data = themes.map((t) => {
  const c = deriveColors(t);
  return {
    id: t.id, label: t.label, dark: t.dark, source: t.source,
    swatches: [c.background, c.foreground, c.heading, c.link, c.codeBackground, c.tokens.keyword, c.tokens.string, c.tokens.comment].filter(Boolean),
    css: buildCss({ ...DEFAULT_SETTINGS, theme: t.id }, themes, { scope: '.mpt-preview' }),
  };
});

const previewBase = fs.readFileSync(path.join(root, 'media', 'preview-base.css'), 'utf8');

const FONTS = [
  'system-ui, sans-serif', 'Georgia, serif', 'Charter, "Iowan Old Style", serif', '"Helvetica Neue", Helvetica, Arial, sans-serif',
  'Inter, sans-serif', '"IBM Plex Sans", sans-serif', '"IBM Plex Serif", serif', '"Source Serif 4", serif', '"Source Sans 3", sans-serif',
  'Merriweather, serif', '"Noto Serif", serif', 'Palatino, "Palatino Linotype", serif', '"Atkinson Hyperlegible", sans-serif', 'Lora, serif',
  'Literata, serif', '"Libre Baskerville", serif', 'Verdana, sans-serif', '"Trebuchet MS", sans-serif',
];
const CODE_FONTS = [
  '"SF Mono", Menlo, Monaco, monospace', '"JetBrains Mono", monospace', '"Fira Code", monospace', 'Iosevka, monospace', '"Cascadia Code", monospace',
  '"IBM Plex Mono", monospace', '"Source Code Pro", monospace', 'Hack, monospace', '"Victor Mono", monospace', '"Berkeley Mono", monospace',
  '"Monaspace Neon", monospace', '"Roboto Mono", monospace', '"Ubuntu Mono", monospace', 'Consolas, monospace', '"DejaVu Sans Mono", monospace',
  '"Input Mono", monospace', 'Recursive, monospace', '"Comic Mono", monospace', '"Courier Prime", monospace', 'Inconsolata, monospace', 'Menlo, monospace',
];

const pageCss = `
:root { --ui-bg: #1b1d23; --ui-fg: #d6d8de; --ui-muted: #8b8f9a; --ui-border: #2c2f38; --ui-accent: #7aa2f7; --ui-hover: #242731; --ui-active: #2e3444; }
* { box-sizing: border-box; }
html, body { height: 100%; margin: 0; }
body { display: grid; grid-template-columns: 300px 1fr; grid-template-rows: auto 1fr; font: 13px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: var(--ui-fg); background: var(--ui-bg); }
header { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; padding: 8px 14px; border-bottom: 1px solid var(--ui-border); }
header h1 { font-size: 15px; margin: 0 8px 0 0; font-weight: 600; }
header label { display: inline-flex; align-items: center; gap: 6px; color: var(--ui-muted); white-space: nowrap; }
header input[type=text], header select, aside input[type=search], header input[type=number] { background: #11131a; color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 4px; padding: 4px 6px; font: inherit; }
header input[type=text] { width: 210px; }
header input[type=number] { width: 60px; }
header .spacer { flex: 1; }
header a { color: var(--ui-accent); text-decoration: none; }
aside { border-right: 1px solid var(--ui-border); display: flex; flex-direction: column; min-height: 0; }
aside .tools { padding: 8px 10px; display: grid; grid-template-columns: 1fr auto; gap: 6px; border-bottom: 1px solid var(--ui-border); }
aside .tools input[type=search] { width: 100%; }
aside .tools select { background: #11131a; color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 4px; font: inherit; }
aside .count { grid-column: 1 / -1; color: var(--ui-muted); font-size: 12px; }
ul#themes { list-style: none; margin: 0; padding: 4px 0; overflow-y: auto; flex: 1; }
ul#themes li { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer; border-left: 3px solid transparent; }
ul#themes li:hover { background: var(--ui-hover); }
ul#themes li.active { background: var(--ui-active); border-left-color: var(--ui-accent); }
ul#themes li .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
ul#themes li .name small { color: var(--ui-muted); margin-left: 6px; }
ul#themes li .sw { display: flex; gap: 2px; }
ul#themes li .sw i { display: block; width: 10px; height: 14px; border-radius: 2px; border: 1px solid rgba(0,0,0,0.35); }
ul#themes li.hidden { display: none; }
main { position: relative; min-height: 0; overflow: auto; }
.mpt-preview { min-height: 100%; font-family: var(--pf-body, system-ui, sans-serif); font-size: var(--pf-size, 15px); line-height: var(--pf-lh, 1.6); }
.mpt-preview h1, .mpt-preview h2, .mpt-preview h3, .mpt-preview h4, .mpt-preview h5, .mpt-preview h6 { font-family: var(--pf-heading, var(--pf-body, inherit)); }
.mpt-preview code, .mpt-preview pre, .mpt-preview kbd { font-family: var(--pf-code, Menlo, monospace) !important; }
.mpt-preview .inner { max-width: var(--pf-width, 820px); margin: 0 auto; }
#snippet { position: sticky; bottom: 0; margin: 0; padding: 8px 12px; font: 11px/1.4 Menlo, monospace; background: rgba(20,22,28,0.92); color: #cfd3dc; border-top: 1px solid var(--ui-border); white-space: pre-wrap; cursor: pointer; }
#snippet:hover { color: #fff; }
.nav { display: inline-flex; gap: 4px; }
.nav button { background: #11131a; color: var(--ui-fg); border: 1px solid var(--ui-border); border-radius: 4px; padding: 2px 8px; cursor: pointer; font: inherit; }
.nav button:hover { background: var(--ui-hover); }
kbd.key { font: 11px Menlo, monospace; border: 1px solid var(--ui-border); border-radius: 3px; padding: 0 4px; color: var(--ui-muted); }
`;

const pageJs = `
const THEMES = ${JSON.stringify(data)};
const $ = (s) => document.querySelector(s);
const list = $('#themes'), styleEl = $('#theme-css'), doc = $('#doc'), snippet = $('#snippet');
const state = { theme: 'catppuccin-macchiato', body: '', heading: '', code: '', size: 15, lh: 1.6, width: 820, q: '', filter: 'all' };

function readHash() {
  const p = new URLSearchParams(location.hash.slice(1));
  for (const k of Object.keys(state)) if (p.has(k)) state[k] = typeof state[k] === 'number' ? Number(p.get(k)) : p.get(k);
  if (!THEMES.some((t) => t.id === state.theme)) state.theme = THEMES[0].id;
}
function writeHash() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(state)) if (v !== '' && k !== 'q' && k !== 'filter') p.set(k, String(v));
  history.replaceState(null, '', '#' + p.toString());
}
function visible() { return THEMES.filter((t) => (state.filter === 'all' || (state.filter === 'dark') === t.dark) && (!state.q || (t.id + ' ' + t.label).toLowerCase().includes(state.q.toLowerCase()))); }

function renderList() {
  list.innerHTML = '';
  for (const t of THEMES) {
    const li = document.createElement('li');
    li.dataset.id = t.id;
    li.innerHTML = '<span class="name">' + t.label + '<small>' + (t.dark ? 'dark' : 'light') + '</small></span><span class="sw">' + t.swatches.map((c) => '<i style="background:' + c + '"></i>').join('') + '</span>';
    li.addEventListener('click', () => select(t.id));
    list.appendChild(li);
  }
  applyFilter();
}
function applyFilter() {
  const vis = new Set(visible().map((t) => t.id));
  for (const li of list.children) li.classList.toggle('hidden', !vis.has(li.dataset.id));
  $('#count').textContent = vis.size + ' of ' + THEMES.length + ' themes';
}
function select(id) {
  state.theme = id;
  const t = THEMES.find((x) => x.id === id);
  styleEl.textContent = t.css;
  doc.className = 'mpt-preview vscode-body ' + (t.dark ? 'vscode-dark' : 'vscode-light');
  for (const li of list.children) li.classList.toggle('active', li.dataset.id === id);
  const active = list.querySelector('li.active');
  if (active) active.scrollIntoView({ block: 'nearest' });
  document.title = t.label + ' · Markdown Preview Themes';
  updateSnippet(); writeHash();
}
function step(delta) {
  const vis = visible();
  if (!vis.length) return;
  const i = vis.findIndex((t) => t.id === state.theme);
  select(vis[(i + delta + vis.length) % vis.length].id);
}
function applyFonts() {
  const r = doc.style;
  r.setProperty('--pf-body', state.body || 'system-ui, sans-serif');
  r.setProperty('--pf-heading', state.heading || state.body || 'system-ui, sans-serif');
  r.setProperty('--pf-code', state.code || 'Menlo, monospace');
  r.setProperty('--pf-size', state.size + 'px');
  r.setProperty('--pf-lh', String(state.lh));
  r.setProperty('--pf-width', (state.width || 10000) + 'px');
  updateSnippet(); writeHash();
}
function updateSnippet() {
  const s = { 'markdownPreviewThemes.mode': 'fixed', 'markdownPreviewThemes.theme': state.theme };
  if (state.body) s['markdownPreviewThemes.fontFamily'] = state.body;
  if (state.heading) s['markdownPreviewThemes.headingFontFamily'] = state.heading;
  if (state.code) s['markdownPreviewThemes.codeFontFamily'] = state.code;
  if (state.size !== 15) s['markdownPreviewThemes.fontSize'] = state.size;
  if (state.lh !== 1.6) s['markdownPreviewThemes.lineHeight'] = state.lh;
  if (state.width !== 820) s['markdownPreviewThemes.maxWidth'] = state.width;
  snippet.textContent = JSON.stringify(s, null, 2).replace(/^\\{\\n|\\n\\}$/g, '') + (typeof acquireVsCodeApi === 'function' ? '\\n// click to apply to VS Code user settings' : '\\n// click to copy into settings.json');
}
function bind(id, key, parse) {
  const el = $(id);
  el.value = state[key];
  el.addEventListener('input', () => { state[key] = parse ? parse(el.value) : el.value; applyFonts(); });
}

readHash();
renderList();
bind('#f-body', 'body'); bind('#f-heading', 'heading'); bind('#f-code', 'code');
bind('#f-size', 'size', Number); bind('#f-lh', 'lh', Number); bind('#f-width', 'width', Number);
$('#q').addEventListener('input', (e) => { state.q = e.target.value; applyFilter(); });
$('#filter').addEventListener('change', (e) => { state.filter = e.target.value; applyFilter(); });
$('#prev').addEventListener('click', () => step(-1));
$('#next').addEventListener('click', () => step(1));
const vsapi = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : null;
snippet.addEventListener('click', () => {
  const text = snippet.textContent.split('\\n//')[0];
  if (vsapi) { vsapi.postMessage({ type: 'apply', settings: JSON.parse('{' + text + '}') }); snippet.textContent = text + '\\n// applied to VS Code user settings'; return; }
  navigator.clipboard?.writeText(text); snippet.textContent = text + '\\n// copied';
});
document.addEventListener('keydown', (e) => {
  if (e.target instanceof Element && e.target.matches('input, select, textarea')) return;
  if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); step(1); }
  if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); step(-1); }
});
applyFonts();
select(state.theme);
`;

const datalist = (id, items) => `<datalist id="${id}">${items.map((f) => `<option value='${f.replace(/'/g, '&#39;')}'>`).join('')}</datalist>`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Markdown Preview Themes</title>
<style>${pageCss}</style>
<style>${previewBase}</style>
<style id="theme-css"></style>
</head>
<body>
<header>
  <h1>Markdown Preview Themes</h1>
  <span class="nav"><button id="prev" title="Previous theme (↑ / k)">↑</button><button id="next" title="Next theme (↓ / j)">↓</button></span>
  <label>Body <input type="text" id="f-body" list="fonts" placeholder="system-ui, sans-serif"></label>
  <label>Headings <input type="text" id="f-heading" list="fonts" placeholder="same as body"></label>
  <label>Code <input type="text" id="f-code" list="code-fonts" placeholder="Menlo, monospace"></label>
  <label>Size <input type="number" id="f-size" min="10" max="32" step="1"></label>
  <label>Line height <input type="number" id="f-lh" min="1" max="2.5" step="0.05"></label>
  <label>Width <input type="number" id="f-width" min="0" max="2000" step="10"></label>
  <span class="spacer"></span>
  <span><kbd class="key">↑</kbd> <kbd class="key">↓</kbd> change theme · v${pkg.version} · <a href="https://www.programmingfonts.org" target="_blank" rel="noopener">programmingfonts</a></span>
  ${datalist('fonts', FONTS)}${datalist('code-fonts', CODE_FONTS)}
</header>
<aside>
  <div class="tools">
    <input type="search" id="q" placeholder="Filter themes…">
    <select id="filter"><option value="all">all</option><option value="light">light</option><option value="dark">dark</option></select>
    <span class="count" id="count"></span>
  </div>
  <ul id="themes"></ul>
</aside>
<main>
  <div id="doc" class="mpt-preview vscode-body vscode-dark"><div class="inner">${sampleHtml}</div></div>
  <pre id="snippet"></pre>
</main>
<script nonce="__NONCE__">${pageJs}</script>
</body>
</html>
`;

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, html);
const bundled = path.join(root, 'dist', 'themes.html');
fs.mkdirSync(path.dirname(bundled), { recursive: true });
fs.writeFileSync(bundled, html);
console.log(`wrote ${path.relative(root, bundled)} (bundled copy opened by the Open Theme Browser command)`);
console.log(`wrote ${path.relative(root, outFile)} (${(html.length / 1024).toFixed(0)} KB, ${themes.length} themes)`);
