# Changelog

## 0.1.1 (2026-10-27)

- Packaging: the `.vsix` no longer includes the source map; the bundled theme browser page moves from `media/themes.html` to `dist/themes.html`.
- Repository: build scripts move to `scripts/`, the smoke test to `test/`; vendored CodeMirror trimmed to the theme stylesheets; ESLint, EditorConfig and a GitHub Actions workflow added.

## 0.1.0 (2026-10-26)

Initial release.

- 60 colour themes for the built-in Markdown preview, extracted from the CodeMirror 5 themes used by programmingfonts.org (all 49 listed there, plus 11 more that ship with CodeMirror).
- Fixed theme or follow VS Code light/dark with separate light and dark picks.
- Body, heading and code font families; font sizes; line height; max content width.
- Nine colour overrides (background, text, headings, links, code background and text, borders, blockquote, selection).
- Inline custom CSS and a watched custom CSS file.
- Live theme editor webview with the built-in sample or the active Markdown file.
- Static browser page (`docs/site/index.html`, `npm run site`) to browse all themes with font controls and a settings snippet.
- Commands: select, next and previous theme; export the current stylesheet; open a Quarto or other text file in the Markdown preview.
