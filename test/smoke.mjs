// Smoke test for the pure CSS generator: builds CSS for every theme and checks
// the output for obvious breakage. Run: npm test (needs themes/themes.json).
import { loadThemeCss, readThemes } from '../scripts/lib.mjs';

const { buildCss, DEFAULT_SETTINGS, effectiveFor } = await loadThemeCss();
const themes = readThemes();

let failures = 0;
const check = (cond, msg) => { if (!cond) { failures++; console.error('FAIL', msg); } };

for (const t of themes) {
  const css = buildCss({ ...DEFAULT_SETTINGS, theme: t.id }, themes);
  check(css.includes(`background-color: ${t.bg}`), `${t.id}: body background`);
  check(/\.hljs-keyword[^{]*\{ color: #[0-9a-f]{6}; \}/.test(css), `${t.id}: keyword colour`);
  check(!/undefined|null|NaN/.test(css), `${t.id}: contains undefined/null/NaN`);
  check((css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length, `${t.id}: unbalanced braces`);
}

// Auto mode emits both appearance scopes.
const auto = buildCss({ ...DEFAULT_SETTINGS, mode: 'auto', lightTheme: 'solarized-light', darkTheme: 'dracula' }, themes);
check(auto.includes('body.vscode-body.vscode-light { background-color: #fdf6e3'), 'auto: light scope');
check(auto.includes('body.vscode-body.vscode-dark { background-color: #282a36'), 'auto: dark scope');

// Fonts, overrides, custom CSS, escaping.
const custom = buildCss({ ...DEFAULT_SETTINGS, theme: 'nord', fontFamily: 'Georgia, serif', codeFontFamily: '"Fira Code", monospace', fontSize: 16, lineHeight: 1.6, maxWidth: 800, colors: { link: '#ff0000' }, customCss: 'h1 { color: red } </style><script>alert(1)</script>' }, themes);
check(custom.includes('font-family: Georgia, serif;'), 'fonts: body');
check(custom.includes('font-size: 16px;'), 'fonts: size');
check(custom.includes('max-width: 800px'), 'layout: max width');
check(custom.includes('a { color: #ff0000; }'), 'override: link');
check(custom.includes('<\\/style>'), 'custom css: </style> escaped');
check(!custom.includes('</style>'), 'custom css: no raw </style>');

// "none" theme produces only typography/custom rules; overrides alone still produce colours.
check(!buildCss(DEFAULT_SETTINGS, themes).includes('background-color'), 'none: no colours');
check(effectiveFor({ ...DEFAULT_SETTINGS, colors: { background: '#123456' } }, themes, 'light')?.background === '#123456', 'none + override');

// Editor scope.
check(buildCss({ ...DEFAULT_SETTINGS, theme: 'monokai' }, themes, { scope: '.mpt-preview' }).startsWith('/* Markdown Preview Themes */\n.mpt-preview {'), 'scope option');

console.log(failures === 0 ? `smoke: all checks passed across ${themes.length} themes` : `smoke: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
