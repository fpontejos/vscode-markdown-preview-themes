import * as vscode from 'vscode';
import { ThemeSettings, DEFAULT_SETTINGS, ColorOverrides, COLOR_KEYS, isValidColor } from './theme-css';

export const SECTION = 'markdownPreviewThemes';

function str(cfg: vscode.WorkspaceConfiguration, key: string, def: string): string {
  const v = cfg.get<unknown>(key);
  return typeof v === 'string' ? v : def;
}

function num(cfg: vscode.WorkspaceConfiguration, key: string, def: number): number {
  const v = cfg.get<unknown>(key);
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : def;
}

export function readSettings(): ThemeSettings {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  const modeRaw = str(cfg, 'mode', DEFAULT_SETTINGS.mode);
  const colorsRaw = cfg.get<Record<string, unknown>>('colors') ?? {};
  const colors: ColorOverrides = {};
  for (const k of COLOR_KEYS) if (isValidColor(colorsRaw[k])) colors[k] = (colorsRaw[k] as string).trim();
  return {
    mode: modeRaw === 'auto' ? 'auto' : 'fixed',
    theme: str(cfg, 'theme', DEFAULT_SETTINGS.theme),
    lightTheme: str(cfg, 'lightTheme', DEFAULT_SETTINGS.lightTheme),
    darkTheme: str(cfg, 'darkTheme', DEFAULT_SETTINGS.darkTheme),
    fontFamily: str(cfg, 'fontFamily', ''),
    headingFontFamily: str(cfg, 'headingFontFamily', ''),
    codeFontFamily: str(cfg, 'codeFontFamily', ''),
    fontSize: num(cfg, 'fontSize', 0),
    codeFontSize: num(cfg, 'codeFontSize', 0),
    lineHeight: num(cfg, 'lineHeight', 0),
    maxWidth: num(cfg, 'maxWidth', 0),
    colors,
    customCss: str(cfg, 'customCss', ''),
    customCssPath: str(cfg, 'customCssPath', ''),
  };
}

/** Write one or more settings at the user (global) scope. */
export async function writeSettings(patch: Partial<ThemeSettings>): Promise<void> {
  const cfg = vscode.workspace.getConfiguration(SECTION);
  for (const [k, v] of Object.entries(patch)) {
    const current = cfg.get<unknown>(k);
    if (JSON.stringify(current) === JSON.stringify(v)) continue;
    await cfg.update(k, v, vscode.ConfigurationTarget.Global);
  }
}
