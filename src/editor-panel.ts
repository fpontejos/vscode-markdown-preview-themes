import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js/lib/common';
import { Palette, ThemeSettings, buildCss, effectiveFor, COLOR_KEYS } from './theme-css';
import { readSettings, writeSettings } from './config';
import { readCustomCss } from './extension';

type Inbound =
  | { type: 'ready' }
  | { type: 'update'; patch: Partial<ThemeSettings> }
  | { type: 'reset' }
  | { type: 'source'; source: 'sample' | 'active' }
  | { type: 'export' }
  | { type: 'openSettings' }
  | { type: 'pickCssFile' };

const md = new MarkdownIt({
  html: true,
  linkify: true,
  highlight(code, lang) {
    let inner: string;
    if (lang && hljs.getLanguage(lang)) {
      inner = hljs.highlight(code, { language: lang, ignoreIllegals: true }).value;
    } else {
      inner = md.utils.escapeHtml(code);
    }
    // Mirrors the structure VS Code's preview emits: <pre class="hljs"><code><div>…</div></code></pre>
    return `<pre class="hljs"><code><div>${inner}</div></code></pre>`;
  },
});

/** Render markdown to HTML the way VS Code's preview does (frontmatter as a table). */
export function renderSample(text: string): string {
  let body = text;
  let fm = '';
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (m) {
    body = text.slice(m[0].length);
    const rows = m[1]
      .split(/\r?\n/)
      .map((l) => l.match(/^([^:]+):\s*(.*)$/))
      .filter((x): x is RegExpMatchArray => !!x)
      .map((x) => `<tr><th>${md.utils.escapeHtml(x[1].trim())}</th><td>${md.utils.escapeHtml(x[2].trim())}</td></tr>`)
      .join('');
    fm = `<table class="frontmatter"><tbody>${rows}</tbody></table>`;
  }
  return fm + md.render(body);
}

function nonce(): string {
  let s = '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class ThemeEditorPanel {
  static current: ThemeEditorPanel | undefined;

  static show(context: vscode.ExtensionContext, themes: Palette[]): void {
    if (ThemeEditorPanel.current) {
      ThemeEditorPanel.current.panel.reveal();
      return;
    }
    ThemeEditorPanel.current = new ThemeEditorPanel(context, themes);
  }

  private readonly panel: vscode.WebviewPanel;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly snapshot: ThemeSettings;
  private source: 'sample' | 'active' = 'sample';
  private lastMarkdownDoc: vscode.TextDocument | undefined;
  private pending: Partial<ThemeSettings> = {};
  private flushTimer: NodeJS.Timeout | undefined;
  private refreshTimer: NodeJS.Timeout | undefined;

  private constructor(private readonly context: vscode.ExtensionContext, private readonly themes: Palette[]) {
    this.snapshot = readSettings();
    this.lastMarkdownDoc = vscode.window.activeTextEditor?.document.languageId === 'markdown' ? vscode.window.activeTextEditor.document : undefined;
    const mediaRoot = vscode.Uri.file(path.join(context.extensionPath, 'media'));
    this.panel = vscode.window.createWebviewPanel('markdownPreviewThemes.editor', 'Markdown Preview Theme Editor', vscode.ViewColumn.Beside, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [mediaRoot],
    });
    this.panel.webview.html = this.html(mediaRoot);
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage((msg: Inbound) => void this.onMessage(msg), null, this.disposables);
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e?.document.languageId === 'markdown') {
        this.lastMarkdownDoc = e.document;
        if (this.source === 'active') this.scheduleRefresh();
      }
    }, null, this.disposables);
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (this.source === 'active' && e.document === this.lastMarkdownDoc) this.scheduleRefresh();
    }, null, this.disposables);
  }

  private dispose(): void {
    ThemeEditorPanel.current = undefined;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    for (const d of this.disposables) d.dispose();
  }

  private scheduleRefresh(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => this.refresh(), 150);
  }

  /** Recompute state and push it to the webview. */
  refresh(): void {
    const settings = readSettings();
    const css = buildCss(settings, this.themes, { scope: '.mpt-preview', customCssFromFile: readCustomCss(settings) });
    let sampleText: string;
    let sourceLabel: string;
    if (this.source === 'active' && this.lastMarkdownDoc) {
      sampleText = this.lastMarkdownDoc.getText();
      sourceLabel = path.basename(this.lastMarkdownDoc.fileName);
    } else {
      sampleText = fs.readFileSync(path.join(this.context.extensionPath, 'media', 'sample.md'), 'utf8');
      sourceLabel = 'sample.md';
    }
    void this.panel.webview.postMessage({
      type: 'state',
      settings,
      themes: this.themes.map((t) => ({ id: t.id, label: t.label, dark: t.dark })),
      css,
      effective: { light: effectiveFor(settings, this.themes, 'light'), dark: effectiveFor(settings, this.themes, 'dark') },
      html: renderSample(sampleText),
      source: this.source,
      sourceLabel,
      hasActiveDoc: !!this.lastMarkdownDoc,
      colorKeys: COLOR_KEYS,
    });
  }

  private queue(patch: Partial<ThemeSettings>): void {
    Object.assign(this.pending, patch);
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      const p = this.pending;
      this.pending = {};
      void writeSettings(p); // onDidChangeConfiguration triggers refresh()
    }, 120);
  }

  private async onMessage(msg: Inbound): Promise<void> {
    switch (msg.type) {
      case 'ready':
        this.refresh();
        break;
      case 'update':
        this.queue(msg.patch);
        break;
      case 'reset':
        await writeSettings(this.snapshot);
        break;
      case 'source':
        this.source = msg.source;
        this.refresh();
        break;
      case 'export':
        await vscode.commands.executeCommand('markdownPreviewThemes.exportCss');
        break;
      case 'openSettings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markdownPreviewThemes');
        break;
      case 'pickCssFile': {
        const picked = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { CSS: ['css'] }, title: 'Choose a custom CSS file' });
        if (picked?.[0]) this.queue({ customCssPath: picked[0].fsPath });
        break;
      }
    }
  }

  private html(mediaRoot: vscode.Uri): string {
    const w = this.panel.webview;
    const n = nonce();
    const uri = (f: string) => w.asWebviewUri(vscode.Uri.joinPath(mediaRoot, f));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${w.cspSource} 'unsafe-inline'; script-src 'nonce-${n}'; font-src ${w.cspSource} https: data:; img-src ${w.cspSource} https: data:;">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${uri('editor.css')}">
<link rel="stylesheet" href="${uri('preview-base.css')}">
<style id="theme-css"></style>
<title>Markdown Preview Theme Editor</title>
</head>
<body>
<aside id="controls" aria-label="Theme controls"></aside>
<main id="preview-wrap"><div id="preview" class="mpt-preview vscode-body vscode-light"></div></main>
<script nonce="${n}" src="${uri('editor.js')}"></script>
</body>
</html>`;
  }
}
