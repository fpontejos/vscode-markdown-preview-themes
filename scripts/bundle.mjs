// Bundles src/extension.ts into dist/extension.js with esbuild.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: [path.join(root, 'src', 'extension.ts')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: path.join(root, 'dist', 'extension.js'),
  external: ['vscode'],
  sourcemap: true,
  minify: !watch,
  logLevel: 'info',
});

// Static assets: themes.json is read at runtime from dist/.
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.copyFileSync(path.join(root, 'themes', 'themes.json'), path.join(root, 'dist', 'themes.json'));

if (watch) await ctx.watch();
else { await ctx.rebuild(); await ctx.dispose(); }
