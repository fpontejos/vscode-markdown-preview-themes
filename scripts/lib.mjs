// Shared helpers for the build scripts and the smoke test.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import * as esbuild from 'esbuild';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';

/** Repository root (parent of scripts/ and test/). */
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/** Bundle src/theme-css.ts in memory and return its exports. No vscode import, so it runs under Node. */
export async function loadThemeCss() {
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src', 'theme-css.ts')],
    bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'silent',
  });
  const mod = { exports: {} };
  new Function('module', 'exports', 'require', result.outputFiles[0].text)(mod, mod.exports, createRequire(import.meta.url));
  return mod.exports;
}

/** Parsed themes/themes.json. */
export function readThemes() {
  return JSON.parse(fs.readFileSync(path.join(root, 'themes', 'themes.json'), 'utf8'));
}

/** media/sample.md split into front matter (raw text or null) and body. */
export function readSample() {
  const src = fs.readFileSync(path.join(root, 'media', 'sample.md'), 'utf8');
  const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return { frontMatter: fm ? fm[1] : null, body: fm ? src.slice(fm[0].length) : src };
}

/** markdown-it configured to emit the same code-block markup as VS Code's preview. */
export function createMarkdown() {
  const md = new MarkdownIt({ html: true, linkify: true, highlight(code, lang) {
    const inner = lang && hljs.getLanguage(lang) ? hljs.highlight(code, { language: lang, ignoreIllegals: true }).value : md.utils.escapeHtml(code);
    return `<pre class="hljs"><code><div>${inner}</div></code></pre>`;
  } });
  return md;
}
