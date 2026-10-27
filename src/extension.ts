import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import MarkdownIt from 'markdown-it';
type MarkdownItInstance = MarkdownIt.MarkdownIt;
import { Palette, ThemeSettings, buildCss } from './theme-css';
import { SECTION, readSettings, writeSettings } from './config';
import { ThemeEditorPanel } from './editor-panel';

let themes: Palette[] = [];
let customCssCache: { path: string; text: string } | null = null;
let cssWatcher: vscode.FileSystemWatcher | undefined;

export function expandHome(p: string): string {
  if (!p) return p;
  if (p === '~') return os.homedir();
  if (p.startsWith('~/')) return path.join(os.homedir(), p.slice(2));
  return p;
}

/** Resolve customCssPath: absolute, ~-prefixed, or relative to the first workspace folder. */
export function resolveCustomCssPath(settings: ThemeSettings): string {
  const raw = expandHome(settings.customCssPath.trim());
  if (!raw) return '';
  if (path.isAbsolute(raw)) return raw;
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  return folder ? path.join(folder, raw) : raw;
}

export function readCustomCss(settings: ThemeSettings): string {
  const file = resolveCustomCssPath(settings);
  if (!file) return '';
  if (customCssCache && customCssCache.path === file) return customCssCache.text;
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (err) {
    text = `/* markdownPreviewThemes.customCssPath: could not read ${file}: ${(err as Error).message} */`;
  }
  customCssCache = { path: file, text };
  return text;
}

function refreshPreview(): void {
  void vscode.commands.executeCommand('markdown.preview.refresh');
}

function rearmCssWatcher(context: vscode.ExtensionContext): void {
  cssWatcher?.dispose();
  cssWatcher = undefined;
  customCssCache = null;
  const file = resolveCustomCssPath(readSettings());
  if (!file) return;
  cssWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(path.dirname(file), path.basename(file)));
  const onChange = () => {
    customCssCache = null;
    refreshPreview();
    ThemeEditorPanel.current?.refresh();
  };
  cssWatcher.onDidChange(onChange);
  cssWatcher.onDidCreate(onChange);
  cssWatcher.onDidDelete(onChange);
  context.subscriptions.push(cssWatcher);
}

export function currentCss(scope?: string): string {
  const settings = readSettings();
  return buildCss(settings, themes, { scope, customCssFromFile: readCustomCss(settings) });
}

function markdownItPlugin(md: MarkdownItInstance): void {
  const render = md.renderer.render.bind(md.renderer);
  md.renderer.render = (tokens, options, env) => {
    const css = currentCss();
    return `<style data-markdown-preview-themes>\n${css}\n</style>\n${render(tokens, options, env)}`;
  };
}

function themeQuickPick(current: string): vscode.QuickPickItem[] {
  const items: vscode.QuickPickItem[] = [{ label: 'none', description: 'Inherit VS Code colours', picked: current === 'none' }];
  for (const t of themes) {
    items.push({ label: t.id, description: `${t.label} · ${t.dark ? 'dark' : 'light'}`, picked: t.id === current });
  }
  return items;
}

async function selectTheme(key: 'theme' | 'lightTheme' | 'darkTheme'): Promise<void> {
  const settings = readSettings();
  const pick = await vscode.window.showQuickPick(themeQuickPick(settings[key]), {
    placeHolder: `Markdown preview ${key === 'theme' ? 'theme' : key === 'lightTheme' ? 'theme for light appearance' : 'theme for dark appearance'}`,
    matchOnDescription: true,
  });
  if (!pick) return;
  await writeSettings({ [key]: pick.label } as Partial<ThemeSettings>);
}

async function cycleTheme(delta: 1 | -1): Promise<void> {
  const settings = readSettings();
  const ids = ['none', ...themes.map((t) => t.id)];
  let key: 'theme' | 'lightTheme' | 'darkTheme' = 'theme';
  if (settings.mode === 'auto') {
    const kind = vscode.window.activeColorTheme.kind;
    const dark = kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
    key = dark ? 'darkTheme' : 'lightTheme';
  }
  const idx = Math.max(0, ids.indexOf(settings[key]));
  const next = ids[(idx + delta + ids.length) % ids.length];
  await writeSettings({ [key]: next } as Partial<ThemeSettings>);
  void vscode.window.setStatusBarMessage(`Markdown preview theme: ${next}`, 2500);
}

async function exportCss(): Promise<void> {
  const target = await vscode.window.showSaveDialog({
    filters: { CSS: ['css'] },
    defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? os.homedir(), 'markdown-preview-theme.css')),
    title: 'Export Markdown preview theme CSS',
  });
  if (!target) return;
  await vscode.workspace.fs.writeFile(target, Buffer.from(currentCss(), 'utf8'));
  void vscode.window.showInformationMessage(`Markdown Preview Themes: exported ${target.fsPath}`);
}

/** Open the built-in Markdown preview for a Quarto (or any text) document by switching its language mode. */
async function previewAsMarkdown(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showWarningMessage('Markdown Preview Themes: no active editor.');
    return;
  }
  if (editor.document.languageId !== 'markdown') {
    await vscode.languages.setTextDocumentLanguage(editor.document, 'markdown');
  }
  await vscode.commands.executeCommand('markdown.showPreviewToSide', editor.document.uri);
}

let browserPanel: vscode.WebviewPanel | undefined;

/** Show the bundled theme browser page inside a VS Code webview panel. */
function openThemeBrowserInEditor(context: vscode.ExtensionContext): void {
  if (browserPanel) {
    browserPanel.reveal();
    return;
  }
  const panel = vscode.window.createWebviewPanel('markdownPreviewThemes.browser', 'Markdown Preview Themes', vscode.ViewColumn.Active, {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [],
  });
  browserPanel = panel;
  const nonce = Array.from({ length: 32 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 62)]).join('');
  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src data:; img-src data:;">`;
  const html = fs.readFileSync(path.join(context.extensionPath, 'dist', 'themes.html'), 'utf8')
    .replace(/__NONCE__/g, nonce)
    .replace('<meta charset="utf-8">', `<meta charset="utf-8">${csp}`);
  panel.webview.html = html;
  panel.webview.onDidReceiveMessage((msg: { type: string; settings?: Record<string, unknown> }) => {
    if (msg.type !== 'apply' || !msg.settings) return;
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(msg.settings)) if (k.startsWith(`${SECTION}.`)) patch[k.slice(SECTION.length + 1)] = v;
    // A theme picked in the browser is a fixed choice; clear fonts/sizes the snippet omits only if the user set them here before.
    void writeSettings(patch as Partial<ThemeSettings>).then(() => vscode.window.setStatusBarMessage(`Markdown preview theme: ${patch.theme ?? ''}`, 2500));
  });
  panel.onDidDispose(() => { browserPanel = undefined; });
}

function openThemeBrowser(context: vscode.ExtensionContext): Thenable<boolean> {
  return vscode.env.openExternal(vscode.Uri.file(path.join(context.extensionPath, 'dist', 'themes.html')));
}

export function activate(context: vscode.ExtensionContext): { extendMarkdownIt(md: MarkdownItInstance): MarkdownItInstance } {
  themes = JSON.parse(fs.readFileSync(path.join(context.extensionPath, 'dist', 'themes.json'), 'utf8')) as Palette[];
  rearmCssWatcher(context);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (!e.affectsConfiguration(SECTION)) return;
      if (e.affectsConfiguration(`${SECTION}.customCssPath`)) rearmCssWatcher(context);
      refreshPreview();
      ThemeEditorPanel.current?.refresh();
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => rearmCssWatcher(context)),
    vscode.commands.registerCommand('markdownPreviewThemes.openEditor', () => ThemeEditorPanel.show(context, themes)),
    vscode.commands.registerCommand('markdownPreviewThemes.openThemeBrowser', () => openThemeBrowser(context)),
    vscode.commands.registerCommand('markdownPreviewThemes.openThemeBrowserInEditor', () => openThemeBrowserInEditor(context)),
    // vscode://fpontejos.markdown-preview-themes/browse  -> theme browser in the web browser
    // vscode://fpontejos.markdown-preview-themes/editor  -> theme editor panel
    // Used by links in README.md (rendered untrusted in the Extensions view, where command: links are dropped).
    vscode.window.registerUriHandler({
      handleUri(uri) {
        if (uri.path === '/editor') ThemeEditorPanel.show(context, themes);
        else openThemeBrowserInEditor(context);
      },
    }),
    vscode.commands.registerCommand('markdownPreviewThemes.selectTheme', () => selectTheme('theme')),
    vscode.commands.registerCommand('markdownPreviewThemes.selectLightTheme', () => selectTheme('lightTheme')),
    vscode.commands.registerCommand('markdownPreviewThemes.selectDarkTheme', () => selectTheme('darkTheme')),
    vscode.commands.registerCommand('markdownPreviewThemes.nextTheme', () => cycleTheme(1)),
    vscode.commands.registerCommand('markdownPreviewThemes.previousTheme', () => cycleTheme(-1)),
    vscode.commands.registerCommand('markdownPreviewThemes.exportCss', () => exportCss()),
    vscode.commands.registerCommand('markdownPreviewThemes.previewAsMarkdown', () => previewAsMarkdown()),
  );

  return {
    extendMarkdownIt(md: MarkdownItInstance) {
      return md.use(markdownItPlugin);
    },
  };
}

export function deactivate(): void {
  cssWatcher?.dispose();
}
