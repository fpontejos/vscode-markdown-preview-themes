// Writes static HTML pages that emulate (a) VS Code's Markdown preview with the
// extension's injected <style>, and (b) the theme editor webview with a mocked
// VS Code API. Used for visual verification with a headless browser.
// Usage: node scripts/harness.mjs <outDir> [themeId ...]
// Set VSCODE_MARKDOWN_CSS to the path of markdown.css from VS Code's markdown-language-features
// extension when VS Code is not installed at the default macOS location.
import fs from 'node:fs';
import path from 'node:path';
import { root, loadThemeCss, readThemes, readSample, createMarkdown } from './lib.mjs';

const outDir = path.resolve(process.argv[2] ?? '/tmp/mpt-harness');
const ids = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });

const { buildCss, DEFAULT_SETTINGS, effectiveFor, COLOR_KEYS } = await loadThemeCss();
const themes = readThemes();
const html = createMarkdown().render(readSample().body);
const vscodeCssPath = process.env.VSCODE_MARKDOWN_CSS ?? '/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/markdown-language-features/media/markdown.css';
const vscodeCss = fs.readFileSync(vscodeCssPath, 'utf8');

// (a) real-preview emulation, one page per theme
for (const id of ids.length ? ids : themes.slice(0, 6).map((t) => t.id)) {
  const t = themes.find((x) => x.id === id);
  const settings = { ...DEFAULT_SETTINGS, theme: id, fontFamily: 'Charter, Georgia, serif', codeFontFamily: '"JetBrains Mono", Menlo, monospace', fontSize: 15, lineHeight: 1.6, maxWidth: 760 };
  const css = buildCss(settings, themes);
  const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${vscodeCss}</style></head>
<body class="vscode-body ${t?.dark ? 'vscode-dark' : 'vscode-light'} showEditorSelection wordWrap" style="${t?.dark ? 'background:#1e1e1e;color:#ccc' : ''}">
<style data-markdown-preview-themes>\n${css}\n</style>\n${html}</body></html>`;
  fs.writeFileSync(path.join(outDir, `preview-${id}.html`), page);
}

// (b) editor webview emulation
const settings = { ...DEFAULT_SETTINGS, mode: 'auto', lightTheme: 'solarized-light', darkTheme: 'catppuccin-macchiato', fontFamily: 'Charter, Georgia, serif', colors: { link: '#d33682' }, customCss: 'body.vscode-body h1 { letter-spacing: -0.02em; }' };
const state = {
  type: 'state', settings,
  themes: themes.map((t) => ({ id: t.id, label: t.label, dark: t.dark })),
  css: buildCss(settings, themes, { scope: '.mpt-preview' }),
  effective: { light: effectiveFor(settings, themes, 'light'), dark: effectiveFor(settings, themes, 'dark') },
  html, source: 'sample', sourceLabel: 'sample.md', hasActiveDoc: false, colorKeys: COLOR_KEYS,
};
const editorPage = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>:root{--vscode-font-family:system-ui;--vscode-font-size:13px;--vscode-foreground:#ccc;--vscode-editor-background:#1e1e1e;--vscode-input-background:#3c3c3c;--vscode-input-foreground:#ccc;--vscode-dropdown-background:#3c3c3c;--vscode-dropdown-foreground:#ccc;--vscode-button-background:#0e639c;--vscode-button-foreground:#fff;--vscode-editor-font-family:Menlo,monospace}</style>
<style>${fs.readFileSync(path.join(root, 'media', 'editor.css'), 'utf8')}</style>
<style>${fs.readFileSync(path.join(root, 'media', 'preview-base.css'), 'utf8')}</style>
<style id="theme-css"></style></head><body>
<aside id="controls"></aside><main id="preview-wrap"><div id="preview" class="mpt-preview vscode-body vscode-light"></div></main>
<script>
window.__posted = [];
window.acquireVsCodeApi = () => ({ postMessage: (m) => { window.__posted.push(m); if (m.type === 'ready') setTimeout(() => window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(state)} })), 0); } });
</script>
<script>${fs.readFileSync(path.join(root, 'media', 'editor.js'), 'utf8')}</script>
</body></html>`;
fs.writeFileSync(path.join(outDir, 'editor.html'), editorPage);
console.log('harness written to', outDir, fs.readdirSync(outDir).join(' '));
