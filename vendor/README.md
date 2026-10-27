# Vendored sources

Third-party stylesheets that `scripts/extract-themes.mjs` reads to produce `themes/themes.json`.
Nothing in this directory is shipped in the `.vsix`; only the extracted palettes are.

| Path | Origin | Version | Licence |
|---|---|---|---|
| `codemirror/theme/*.css` | [CodeMirror 5](https://github.com/codemirror/codemirror5), `theme/` directory of the `codemirror` npm package | 5.65.21 | MIT, `codemirror/LICENSE` |
| `codemirror-catppuccin.css` | [programmingfonts](https://github.com/braver/programmingfonts), Catppuccin theme for CodeMirror | retrieved 2026-10-26 | MIT, `LICENSE.programmingfonts` |

Only the theme stylesheets are kept from the CodeMirror package. The editor library, modes, addons
and keymaps are not used.

## Updating

```sh
npm pack codemirror@5 --pack-destination /tmp
tar -xzf /tmp/codemirror-5.*.tgz -C /tmp
rm -rf vendor/codemirror/theme
cp -R /tmp/package/theme vendor/codemirror/theme
cp /tmp/package/LICENSE vendor/codemirror/LICENSE
npm run themes      # regenerates themes/themes.json and the enums in package.json
```

Record the new version in the table above.
