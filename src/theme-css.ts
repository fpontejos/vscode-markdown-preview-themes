// Pure CSS generation: palette + settings -> stylesheet text.
// Used both for the real Markdown preview (scope `body.vscode-body`) and for
// the theme editor webview (scope `.mpt-preview`).

export interface Palette {
  id: string;
  label: string;
  source: string;
  dark: boolean;
  bg: string;
  fg: string;
  gutterBg: string | null;
  lineNumber: string | null;
  selection: string | null;
  activeLine: string | null;
  cursor: string | null;
  tokens: Record<string, string>;
}

export interface ColorOverrides {
  background?: string;
  foreground?: string;
  heading?: string;
  link?: string;
  codeBackground?: string;
  codeForeground?: string;
  border?: string;
  blockquote?: string;
  selection?: string;
}

export const COLOR_KEYS: (keyof ColorOverrides)[] = [
  'background', 'foreground', 'heading', 'link', 'codeBackground', 'codeForeground', 'border', 'blockquote', 'selection',
];

export interface ThemeSettings {
  mode: 'auto' | 'fixed';
  theme: string;
  lightTheme: string;
  darkTheme: string;
  fontFamily: string;
  headingFontFamily: string;
  codeFontFamily: string;
  fontSize: number;
  codeFontSize: number;
  lineHeight: number;
  maxWidth: number;
  colors: ColorOverrides;
  customCss: string;
  customCssPath: string;
}

export const DEFAULT_SETTINGS: ThemeSettings = {
  mode: 'fixed',
  theme: 'none',
  lightTheme: 'none',
  darkTheme: 'none',
  fontFamily: '',
  headingFontFamily: '',
  codeFontFamily: '',
  fontSize: 0,
  codeFontSize: 0,
  lineHeight: 0,
  maxWidth: 0,
  colors: {},
  customCss: '',
  customCssPath: '',
};

/** Effective colours after derivation and overrides. Every value is a hex string. */
export interface EffectiveColors {
  background: string;
  foreground: string;
  heading: string;
  link: string;
  codeBackground: string;
  codeForeground: string;
  border: string;
  blockquote: string;
  selection: string;
  muted: string;
  tableHeaderBackground: string;
  tokens: Record<string, string>;
}

// ---- colour maths -----------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!m) {
    const s = hex.trim().match(/^#?([0-9a-f]{3})$/i);
    if (!s) return null;
    const h = s[1];
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  const h = m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix of two hex colours; t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return a;
  return rgbToHex(ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t);
}

export function isValidColor(v: unknown): v is string {
  return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());
}

// ---- palette derivation -----------------------------------------------------

export function deriveColors(p: Palette, overrides: ColorOverrides = {}): EffectiveColors {
  const t = p.tokens;
  const bg = p.bg;
  const fg = p.fg;
  const codeBg = p.gutterBg && p.gutterBg.toLowerCase() !== bg.toLowerCase() ? p.gutterBg : mix(bg, fg, p.dark ? 0.06 : 0.05);
  const base: EffectiveColors = {
    background: bg,
    foreground: fg,
    heading: t['header'] ?? t['def'] ?? fg,
    link: t['link'] ?? t['atom'] ?? t['keyword'] ?? fg,
    codeBackground: codeBg,
    codeForeground: fg,
    border: mix(bg, fg, 0.25),
    blockquote: t['quote'] ?? t['comment'] ?? mix(bg, fg, 0.5),
    selection: p.selection ?? mix(bg, fg, 0.2),
    muted: t['comment'] ?? p.lineNumber ?? mix(bg, fg, 0.5),
    tableHeaderBackground: mix(bg, fg, 0.04),
    tokens: t,
  };
  for (const k of COLOR_KEYS) {
    const v = overrides[k];
    if (isValidColor(v)) (base as unknown as Record<string, string>)[k] = v.trim();
  }
  return base;
}

/** A neutral palette used when the theme is "none" but colour overrides exist. */
function neutralPalette(dark: boolean): Palette {
  return {
    id: 'none', label: 'None', source: 'builtin', dark,
    bg: dark ? '#1e1e1e' : '#ffffff', fg: dark ? '#cccccc' : '#333333',
    gutterBg: null, lineNumber: null, selection: null, activeLine: null, cursor: null, tokens: {},
  };
}

// ---- CSS emission -----------------------------------------------------------

/** Map highlight.js classes (used by VS Code's preview) to CodeMirror token names, in priority order. */
const HLJS_MAP: [string[], string[]][] = [
  [['comment', 'quote'], ['comment']],
  [['keyword', 'selector-tag', 'meta-keyword', 'doctag', 'template-tag'], ['keyword']],
  [['string', 'regexp', 'meta-string'], ['string', 'string-2']],
  [['number', 'literal', 'symbol', 'bullet'], ['number', 'atom']],
  [['title', 'function', 'section'], ['def', 'variable-2', 'keyword']],
  [['attr', 'attribute', 'selector-attr'], ['attribute', 'property', 'variable-2']],
  [['tag', 'name', 'selector-id', 'selector-class', 'selector-pseudo'], ['tag', 'keyword']],
  [['built_in', 'builtin-name', 'type', 'class'], ['builtin', 'type', 'variable-3', 'def']],
  [['variable', 'template-variable', 'params'], ['variable', 'variable-2']],
  [['meta'], ['meta', 'qualifier', 'comment']],
  [['link'], ['link', 'string']],
  [['addition'], ['string']],
  [['deletion'], ['error', 'keyword']],
  [['subst', 'formula'], ['variable-2', 'operator']],
];

function esc(css: string): string {
  // Prevent a stray "</style>" in user CSS from terminating the inline block.
  return css.replace(/<\//g, '<\\/');
}

function fontDecl(prop: string, value: string): string {
  return value && value.trim() ? `${prop}: ${value.trim()};` : '';
}

/** Colour rules for one palette under a scope selector. */
function paletteRules(S: string, c: EffectiveColors): string {
  const lines: string[] = [];
  lines.push(`${S} { background-color: ${c.background}; color: ${c.foreground}; }`);
  // Other preview-styling extensions (e.g. Markdown Preview Github Styling) wrap the content in a div
  // that paints its own background and text colour. Make such wrappers transparent so the theme shows.
  lines.push(`${S} .github-markdown-body, ${S} .markdown-body > [data-color-mode] { background-color: transparent; color: inherit; }`);
  lines.push(`${S} h1, ${S} h2, ${S} h3, ${S} h4, ${S} h5, ${S} h6 { color: ${c.heading}; }`);
  lines.push(`${S} h1, ${S} h2, ${S} hr { border-color: ${c.border}; }`);
  lines.push(`${S} a { color: ${c.link}; }`);
  lines.push(`${S} a:hover { color: ${c.link}; }`);
  lines.push(`${S} blockquote { border-left-color: ${c.blockquote}; color: ${mix(c.foreground, c.blockquote, 0.45)}; background-color: ${mix(c.background, c.blockquote, 0.06)}; }`);
  lines.push(`${S} th { border-bottom-color: ${c.border}; background-color: ${c.tableHeaderBackground}; }`);
  lines.push(`${S} tr { background-color: transparent; }`);
  lines.push(`${S} td { border-color: ${c.border}; }`);
  lines.push(`${S} table > tbody > tr + tr > td { border-top-color: ${c.border}; }`);
  lines.push(`${S} table.frontmatter th, ${S} table.frontmatter td { border-color: ${c.border}; }`);
  lines.push(`${S} code { background-color: ${c.codeBackground}; color: ${c.codeForeground}; padding: 0.1em 0.3em; border-radius: 3px; }`);
  lines.push(`${S} pre { background-color: ${c.codeBackground}; border-color: ${c.border}; }`);
  lines.push(`${S} pre code { background: none; color: ${c.codeForeground}; padding: 0; }`);
  lines.push(`${S} .code-block-copy-button { background-color: ${c.codeBackground}; color: ${c.codeForeground}; border-color: ${c.border}; }`);
  lines.push(`${S} ::selection { background-color: ${c.selection}; }`);
  lines.push(`${S} kbd { background-color: ${c.codeBackground}; border: 1px solid ${c.border}; border-radius: 3px; padding: 0 0.3em; }`);
  lines.push(`${S} .hljs { color: ${c.codeForeground}; background: transparent; }`);
  for (const [hl, cm] of HLJS_MAP) {
    const color = cm.map((k) => c.tokens[k]).find(Boolean);
    if (!color) continue;
    lines.push(`${hl.map((h) => `${S} .hljs-${h}`).join(', ')} { color: ${color}; }`);
  }
  lines.push(`${S} .hljs-emphasis { font-style: italic; }`);
  lines.push(`${S} .hljs-strong { font-weight: bold; }`);
  return lines.join('\n');
}

export interface BuildOptions {
  /** Selector for the preview root. Default `body.vscode-body`. */
  scope?: string;
  /** Contents of the file at `customCssPath`, if any. */
  customCssFromFile?: string;
}

export function findPalette(themes: Palette[], id: string): Palette | undefined {
  return themes.find((t) => t.id === id);
}

/** Colours the preview will show for a given appearance ("light" or "dark"). */
export function effectiveFor(settings: ThemeSettings, themes: Palette[], appearance: 'light' | 'dark'): EffectiveColors | null {
  const id = settings.mode === 'auto' ? (appearance === 'dark' ? settings.darkTheme : settings.lightTheme) : settings.theme;
  const p = findPalette(themes, id);
  const hasOverrides = COLOR_KEYS.some((k) => isValidColor(settings.colors[k]));
  if (!p && !hasOverrides) return null;
  return deriveColors(p ?? neutralPalette(appearance === 'dark'), settings.colors);
}

/** Build the complete stylesheet for the preview. */
export function buildCss(settings: ThemeSettings, themes: Palette[], opts: BuildOptions = {}): string {
  const S = opts.scope ?? 'body.vscode-body';
  const out: string[] = ['/* Markdown Preview Themes */'];

  if (settings.mode === 'auto') {
    const light = effectiveFor(settings, themes, 'light');
    const dark = effectiveFor(settings, themes, 'dark');
    if (light) out.push(paletteRules(`${S}.vscode-light`, light), paletteRules(`${S}.vscode-high-contrast-light`, light));
    if (dark) out.push(paletteRules(`${S}.vscode-dark`, dark), paletteRules(`${S}.vscode-high-contrast:not(.vscode-high-contrast-light)`, dark));
  } else {
    const c = effectiveFor(settings, themes, 'light');
    if (c) out.push(paletteRules(S, c));
  }

  // Typography.
  const body = [
    fontDecl('font-family', settings.fontFamily),
    settings.fontSize > 0 ? `font-size: ${settings.fontSize}px;` : '',
    settings.lineHeight > 0 ? `line-height: ${settings.lineHeight};` : '',
    settings.maxWidth > 0 ? `max-width: ${settings.maxWidth}px; margin-left: auto; margin-right: auto;` : '',
  ].filter(Boolean);
  if (body.length) out.push(`${S} { ${body.join(' ')} }`);
  const heading = fontDecl('font-family', settings.headingFontFamily);
  if (heading) out.push(`${S} h1, ${S} h2, ${S} h3, ${S} h4, ${S} h5, ${S} h6 { ${heading} }`);
  const code = [fontDecl('font-family', settings.codeFontFamily), settings.codeFontSize > 0 ? `font-size: ${settings.codeFontSize}px;` : ''].filter(Boolean);
  if (code.length) out.push(`${S} code, ${S} pre, ${S} kbd, ${S} samp { ${code.join(' ')} }`);

  // User CSS, verbatim.
  if (opts.customCssFromFile && opts.customCssFromFile.trim()) out.push('/* customCssPath */', esc(opts.customCssFromFile));
  if (settings.customCss && settings.customCss.trim()) out.push('/* customCss */', esc(settings.customCss));

  return out.join('\n');
}
