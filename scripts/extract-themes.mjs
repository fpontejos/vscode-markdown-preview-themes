// Extracts colour palettes from the vendored CodeMirror 5 theme stylesheets
// (vendor/codemirror/theme/*.css, vendor/codemirror-catppuccin.css) and writes
// themes/themes.json. Also refreshes the theme enums in package.json.
//
// Run: node scripts/extract-themes.mjs (npm run themes)
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const themeDir = path.join(root, 'vendor', 'codemirror', 'theme');
const extraFiles = [path.join(root, 'vendor', 'codemirror-catppuccin.css')];
const outFile = path.join(root, 'themes', 'themes.json');

// ---- colour helpers ---------------------------------------------------------
const NAMED = {
  white: '#ffffff', black: '#000000', red: '#ff0000', green: '#008000', blue: '#0000ff',
  yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff', gray: '#808080', grey: '#808080',
  silver: '#c0c0c0', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a',
  navy: '#000080', teal: '#008080', olive: '#808000', maroon: '#800000', lime: '#00ff00',
  aqua: '#00ffff', fuchsia: '#ff00ff', gold: '#ffd700', violet: '#ee82ee', indigo: '#4b0082',
  khaki: '#f0e68c', salmon: '#fa8072', tan: '#d2b48c', coral: '#ff7f50', crimson: '#dc143c',
  darkgray: '#a9a9a9', darkgrey: '#a9a9a9', lightgray: '#d3d3d3', lightgrey: '#d3d3d3',
  dimgray: '#696969', lightblue: '#add8e6', lightgreen: '#90ee90', darkred: '#8b0000',
  darkgreen: '#006400', darkblue: '#00008b', skyblue: '#87ceeb', steelblue: '#4682b4',
  tomato: '#ff6347', wheat: '#f5deb3', plum: '#dda0dd', orchid: '#da70d6', chocolate: '#d2691e',
  firebrick: '#b22222', goldenrod: '#daa520', ivory: '#fffff0', beige: '#f5f5dc',
  whitesmoke: '#f5f5f5', snow: '#fffafa', gainsboro: '#dcdcdc', darkgoldenrod: '#b8860b',
  darkorange: '#ff8c00', darkcyan: '#008b8b', darkmagenta: '#8b008b', lightyellow: '#ffffe0',
  lightcyan: '#e0ffff', lavender: '#e6e6fa', seagreen: '#2e8b57', slategray: '#708090', transparent: null,
  inherit: null, none: null, currentcolor: null,
};

function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }
function hex2(n) { return clamp(n).toString(16).padStart(2, '0'); }

/** Normalise a CSS colour value to #rrggbb (alpha dropped) or null. */
function normaliseColor(raw) {
  if (!raw) return null;
  let v = raw.trim().replace(/!important/g, '').trim().toLowerCase();
  if (v in NAMED) return NAMED[v];
  let m = v.match(/^#([0-9a-f]{3,4})$/);
  if (m) {
    const h = m[1];
    return '#' + h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  m = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (m) return '#' + m[1];
  m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (m) {
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (a < 0.2) return null; // effectively transparent; not useful as a flat colour
    return '#' + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]);
  }
  m = v.match(/^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/);
  if (m) {
    const h = (+m[1]) / 360, s = (+m[2]) / 100, l = (+m[3]) / 100;
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    return '#' + hex2(f(0) * 255) + hex2(f(8) * 255) + hex2(f(4) * 255);
  }
  return null;
}

function luminance(hex) {
  const c = hex.slice(1).match(/../g).map((x) => parseInt(x, 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

// ---- parsing ----------------------------------------------------------------
/** @type {Map<string, any>} */
const themes = new Map();

function getTheme(key) {
  if (!themes.has(key)) themes.set(key, { id: key, vars: {}, tokens: {}, tokenBg: {} });
  return themes.get(key);
}

/** Resolve var(--x) references against the theme's collected variables. */
function resolveVars(value, theme) {
  let out = value;
  for (let i = 0; i < 5 && /var\(/.test(out); i++) {
    out = out.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)/g, (_, name, fallback) => theme.vars[name] ?? fallback ?? '');
  }
  return out;
}

function parseFile(file) {
  const css = fs.readFileSync(file, 'utf8');
  const ast = postcss.parse(css, { from: file });
  const source = path.basename(file, '.css');
  ast.walkRules((rule) => {
    const decls = {};
    rule.each((node) => {
      if (node.type === 'decl') decls[node.prop.toLowerCase()] = node.value;
    });
    for (const rawSel of rule.selectors) {
      const sel = rawSel.trim();
      const m = sel.match(/\.cm-s-([a-z0-9-]+)/i);
      if (!m) continue;
      let key = m[1].toLowerCase();
      const variant = sel.match(/\.cm-s-(dark|light)\b/);
      if (variant && variant[1] !== key) key = `${key}-${variant[1]}`;
      const theme = getTheme(key);
      theme.source = source;

      // Custom properties declared on the theme root (catppuccin).
      for (const [prop, val] of Object.entries(decls)) if (prop.startsWith('--')) theme.vars[prop] = val;

      const color = normaliseColor(resolveVars(decls['color'] ?? '', theme));
      const bg = normaliseColor(resolveVars(decls['background-color'] ?? decls['background'] ?? '', theme));

      const afterTheme = sel.slice(sel.indexOf(m[0]) + m[0].length).replace(/\.cm-s-(dark|light)\b/, '');
      const isRoot = afterTheme === '' || /^\.CodeMirror$/.test(afterTheme) || /^\.CodeMirror\s*$/.test(afterTheme);
      if (isRoot) {
        if (color) theme.fg = color;
        if (bg) theme.bg = bg;
        continue;
      }
      if (/CodeMirror-gutters\b/.test(afterTheme)) { if (bg) theme.gutterBg = bg; if (color) theme.gutterFg = color; continue; }
      if (/CodeMirror-linenumber\b/.test(afterTheme)) { if (color) theme.lineNumber = color; continue; }
      if (/CodeMirror-selected\b|::selection/.test(afterTheme)) { if (bg) theme.selection = bg; continue; }
      if (/CodeMirror-activeline-background\b/.test(afterTheme)) { if (bg) theme.activeLine = bg; continue; }
      if (/CodeMirror-cursor\b/.test(afterTheme)) {
        const c = normaliseColor((resolveVars(decls['border-left'] ?? decls['border-left-color'] ?? decls['background'] ?? '', theme)).split(/\s+/).pop());
        if (c) theme.cursor = c;
        continue;
      }
      const tok = afterTheme.match(/\.cm-([a-z0-9-]+)\s*$/i);
      if (tok) {
        const name = tok[1].toLowerCase();
        if (color) theme.tokens[name] = color;
        if (bg) theme.tokenBg[name] = bg;
      }
    }
  });
}

const files = fs.readdirSync(themeDir).filter((f) => f.endsWith('.css')).map((f) => path.join(themeDir, f)).concat(extraFiles);
for (const f of files) parseFile(f);

// Merge base themes into their light/dark variants (solarized).
for (const [key, t] of [...themes]) {
  const variants = [...themes.keys()].filter((k) => k === `${key}-dark` || k === `${key}-light`);
  if (variants.length === 0) continue;
  for (const v of variants) {
    const vt = themes.get(v);
    for (const [prop, val] of Object.entries(t)) {
      if (prop === 'id') continue;
      if (typeof val === 'object') vt[prop] = { ...val, ...vt[prop] };
      else if (vt[prop] === undefined) vt[prop] = val;
    }
  }
  themes.delete(key);
}

// Drop CodeMirror's internal/default-looking entries and anything without a usable base.
const skip = new Set(['default', 'dark', 'light', 'duotone-light-light']);
const out = [];
for (const t of themes.values()) {
  if (skip.has(t.id)) continue;
  if (!t.bg || !t.fg) { console.warn(`skip ${t.id}: missing bg/fg (bg=${t.bg} fg=${t.fg})`); continue; }
  const label = t.id.split('-').map((w) => (w.length <= 3 && /^\d/.test(w) ? w : w[0].toUpperCase() + w.slice(1))).join(' ');
  out.push({
    id: t.id,
    label,
    source: t.source,
    dark: luminance(t.bg) < 0.4,
    bg: t.bg,
    fg: t.fg,
    gutterBg: t.gutterBg ?? null,
    lineNumber: t.lineNumber ?? null,
    selection: t.selection ?? null,
    activeLine: t.activeLine ?? null,
    cursor: t.cursor ?? null,
    tokens: t.tokens,
  });
}
out.sort((a, b) => a.id.localeCompare(b.id));
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${out.length} themes to ${path.relative(root, outFile)}`);

// Refresh enums in package.json.
const pkgFile = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
const props = pkg.contributes?.configuration?.properties ?? {};
const ids = out.map((t) => t.id);
const labels = out.map((t) => `${t.label} (${t.dark ? 'dark' : 'light'})`);
for (const key of ['markdownPreviewThemes.theme', 'markdownPreviewThemes.lightTheme', 'markdownPreviewThemes.darkTheme']) {
  if (!props[key]) continue;
  props[key].enum = ['none', ...ids];
  props[key].enumItemLabels = ['None (inherit VS Code colours)', ...labels];
}
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2) + '\n');
console.log('updated package.json enums');
