// @ts-check
(function () {
  const vscode = acquireVsCodeApi();
  const controls = document.getElementById('controls');
  const preview = document.getElementById('preview');
  const themeStyle = document.getElementById('theme-css');

  /** @type {any} */ let state = null;
  /** Local-only: which appearance to preview in auto mode. */
  let previewAppearance = 'light';

  const FONTS = [
    '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', 'Georgia, serif', 'Charter, "Iowan Old Style", serif',
    '"Helvetica Neue", Helvetica, Arial, sans-serif', 'Inter, sans-serif', '"IBM Plex Sans", sans-serif', '"IBM Plex Serif", serif',
    '"Source Serif 4", serif', '"Source Sans 3", sans-serif', 'Merriweather, serif', '"Noto Serif", serif', 'Palatino, "Palatino Linotype", serif',
    '"Atkinson Hyperlegible", sans-serif', 'Lora, serif', 'Literata, serif', '"Libre Baskerville", serif',
  ];
  const CODE_FONTS = [
    '"SF Mono", Menlo, Monaco, monospace', '"JetBrains Mono", monospace', '"Fira Code", monospace', 'Iosevka, monospace', '"Cascadia Code", monospace',
    '"IBM Plex Mono", monospace', '"Source Code Pro", monospace', 'Hack, monospace', '"Victor Mono", monospace', '"Berkeley Mono", monospace',
    'Monaspace Neon, monospace', '"Roboto Mono", monospace', '"Ubuntu Mono", monospace', 'Consolas, monospace', '"DejaVu Sans Mono", monospace',
    '"Input Mono", monospace', 'Recursive, monospace', '"Comic Mono", monospace', '"Courier Prime", monospace', 'Inconsolata, monospace',
  ];
  const COLOR_LABELS = {
    background: 'Background', foreground: 'Text', heading: 'Headings', link: 'Links', codeBackground: 'Code background',
    codeForeground: 'Code text', border: 'Borders', blockquote: 'Blockquote', selection: 'Selection',
  };

  function send(patch) { vscode.postMessage({ type: 'update', patch }); }
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) e.setAttribute(k, v);
    }
    for (const c of children) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    return e;
  }
  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  function themeOptions(selected) {
    const opts = [el('option', { value: 'none', text: 'none (inherit VS Code)' })];
    for (const t of state.themes) opts.push(el('option', { value: t.id, text: `${t.label} · ${t.dark ? 'dark' : 'light'}` }));
    for (const o of opts) if (o.value === selected) o.selected = true;
    return opts;
  }
  function cycle(key, delta) {
    const ids = ['none', ...state.themes.map((t) => t.id)];
    const i = Math.max(0, ids.indexOf(state.settings[key]));
    send({ [key]: ids[(i + delta + ids.length) % ids.length] });
  }
  function themeSelectRow(label, key) {
    const sel = el('select', { onchange: (e) => send({ [key]: e.target.value }) }, themeOptions(state.settings[key]));
    const nav = el('span', {}, [
      el('button', { class: 'icon', title: 'Previous theme', onclick: () => cycle(key, -1), text: '↑' }),
      ' ',
      el('button', { class: 'icon', title: 'Next theme', onclick: () => cycle(key, 1), text: '↓' }),
    ]);
    return el('div', { class: 'row' }, [el('label', { text: label }), sel, nav]);
  }
  function textRow(label, key, listId, placeholder) {
    const input = el('input', { type: 'text', list: listId, placeholder: placeholder || '', value: state.settings[key] || '' });
    input.addEventListener('input', debounce(() => send({ [key]: input.value }), 250));
    return el('div', { class: 'row' }, [el('label', { text: label }), input, el('button', { class: 'icon', title: 'Clear', text: '×', onclick: () => send({ [key]: '' }) })]);
  }
  function numberRow(label, key, step, placeholder) {
    const v = state.settings[key];
    const input = el('input', { type: 'number', min: '0', step: String(step), value: v > 0 ? String(v) : '', placeholder });
    input.addEventListener('input', debounce(() => send({ [key]: input.value === '' ? 0 : Math.max(0, Number(input.value)) }), 250));
    return el('div', { class: 'row' }, [el('label', { text: label }), input, el('span', { class: 'hint', text: v > 0 ? '' : 'inherit' })]);
  }
  function currentAppearance() {
    if (state.settings.mode === 'auto') return previewAppearance;
    const t = state.themes.find((x) => x.id === state.settings.theme);
    return t ? (t.dark ? 'dark' : 'light') : previewAppearance;
  }
  function colorRow(key) {
    const eff = state.effective[currentAppearance()];
    const overridden = typeof state.settings.colors[key] === 'string';
    const value = overridden ? state.settings.colors[key] : (eff ? eff[key] : (currentAppearance() === 'dark' ? '#1e1e1e' : '#ffffff'));
    const check = el('input', { type: 'checkbox', title: 'Override this colour' });
    check.checked = overridden;
    const picker = el('input', { type: 'color', value });
    const setColor = () => send({ colors: { ...state.settings.colors, [key]: picker.value } });
    picker.addEventListener('input', debounce(setColor, 80));
    check.addEventListener('change', () => {
      if (check.checked) setColor();
      else { const c = { ...state.settings.colors }; delete c[key]; send({ colors: c }); }
    });
    return el('div', { class: 'row color-row' }, [check, el('label', { text: COLOR_LABELS[key] }), el('span', { class: 'swatch-val', text: value }), picker]);
  }

  function build() {
    const s = state.settings;
    const frag = document.createDocumentFragment();
    frag.appendChild(el('h1', { class: 'title', text: 'Markdown Preview Theme Editor' }));
    frag.appendChild(el('p', { class: 'hint', text: 'Changes apply immediately to your user settings and to open Markdown previews.' }));

    // Theme
    const modeSel = el('select', { onchange: (e) => send({ mode: e.target.value }) }, [
      el('option', { value: 'fixed', text: 'One theme' }), el('option', { value: 'auto', text: 'Follow VS Code light / dark' }),
    ]);
    modeSel.value = s.mode;
    const themeFs = el('fieldset', {}, [el('legend', { text: 'Theme' }), el('div', { class: 'row' }, [el('label', { text: 'Mode' }), modeSel, el('span')])]);
    if (s.mode === 'auto') {
      themeFs.appendChild(themeSelectRow('Light theme', 'lightTheme'));
      themeFs.appendChild(themeSelectRow('Dark theme', 'darkTheme'));
      const tog = el('select', { onchange: (e) => { previewAppearance = e.target.value; build(); applyPreview(); } }, [
        el('option', { value: 'light', text: 'light' }), el('option', { value: 'dark', text: 'dark' }),
      ]);
      tog.value = previewAppearance;
      themeFs.appendChild(el('div', { class: 'row' }, [el('label', { text: 'Preview as' }), tog, el('span')]));
    } else {
      themeFs.appendChild(themeSelectRow('Theme', 'theme'));
    }
    frag.appendChild(themeFs);

    // Fonts
    frag.appendChild(el('datalist', { id: 'fonts' }, FONTS.map((f) => el('option', { value: f }))));
    frag.appendChild(el('datalist', { id: 'code-fonts' }, CODE_FONTS.map((f) => el('option', { value: f }))));
    frag.appendChild(el('fieldset', {}, [
      el('legend', { text: 'Fonts' }),
      textRow('Body', 'fontFamily', 'fonts', 'inherit (markdown.preview.fontFamily)'),
      textRow('Headings', 'headingFontFamily', 'fonts', 'same as body'),
      textRow('Code', 'codeFontFamily', 'code-fonts', 'inherit (editor.fontFamily)'),
      numberRow('Font size (px)', 'fontSize', 1, '14'),
      numberRow('Code size (px)', 'codeFontSize', 1, '= body'),
      numberRow('Line height', 'lineHeight', 0.05, '1.57'),
      numberRow('Max width (px)', 'maxWidth', 10, 'none'),
      el('p', { class: 'hint', text: 'Any font installed on this machine can be typed in; the lists are suggestions.' }),
    ]));

    // Colours
    frag.appendChild(el('fieldset', {}, [
      el('legend', { text: `Colour overrides (${currentAppearance()})` }),
      ...state.colorKeys.map(colorRow),
      el('div', { class: 'actions' }, [el('button', { text: 'Clear all overrides', onclick: () => send({ colors: {} }) })]),
      el('p', { class: 'hint', text: 'Unchecked rows show the colour the theme supplies. Overrides apply to both light and dark.' }),
    ]));

    // Custom CSS
    const ta = el('textarea', { spellcheck: 'false', placeholder: '.vscode-body h1 { letter-spacing: -0.02em; }' });
    ta.value = s.customCss || '';
    ta.addEventListener('input', debounce(() => send({ customCss: ta.value }), 300));
    const pathInput = el('input', { type: 'text', value: s.customCssPath || '', placeholder: '~/path/to/preview.css (optional)' });
    pathInput.addEventListener('change', () => send({ customCssPath: pathInput.value }));
    frag.appendChild(el('fieldset', {}, [
      el('legend', { text: 'Custom CSS' }),
      el('p', { class: 'hint', text: 'Target body.vscode-body (the preview root). Applied after the theme.' }),
      el('div', { class: 'row wide' }, [ta]),
      el('div', { class: 'row stack' }, [pathInput, el('button', { text: 'Browse…', onclick: () => vscode.postMessage({ type: 'pickCssFile' }) }), el('button', { class: 'icon', text: '×', title: 'Clear path', onclick: () => send({ customCssPath: '' }) })]),
      el('p', { class: 'hint', text: 'A CSS file is watched for changes and applied before the inline CSS above.' }),
    ]));

    // Preview source + actions
    const srcSel = el('select', { onchange: (e) => vscode.postMessage({ type: 'source', source: e.target.value }) }, [
      el('option', { value: 'sample', text: 'Built-in sample' }),
      el('option', { value: 'active', text: state.hasActiveDoc ? `Active Markdown file (${state.sourceLabel === 'sample.md' ? 'open one' : state.sourceLabel})` : 'Active Markdown file (none open)' }),
    ]);
    srcSel.value = state.source;
    frag.appendChild(el('fieldset', {}, [
      el('legend', { text: 'Preview' }),
      el('div', { class: 'row' }, [el('label', { text: 'Document' }), srcSel, el('span')]),
      el('div', { class: 'actions' }, [
        el('button', { class: 'primary', text: 'Export CSS…', onclick: () => vscode.postMessage({ type: 'export' }) }),
        el('button', { text: 'Open settings', onclick: () => vscode.postMessage({ type: 'openSettings' }) }),
        el('button', { text: 'Revert to opening state', onclick: () => vscode.postMessage({ type: 'reset' }) }),
      ]),
    ]));

    // Preserve scroll + focus across rebuilds.
    const scroll = controls.scrollTop;
    controls.replaceChildren(frag);
    controls.scrollTop = scroll;
  }

  function applyPreview() {
    themeStyle.textContent = state.css;
    preview.className = `mpt-preview vscode-body vscode-${currentAppearance()}`;
    preview.innerHTML = state.html;
  }

  window.addEventListener('message', (ev) => {
    const msg = ev.data;
    if (msg.type !== 'state') return;
    state = msg;
    // Do not clobber a field the user is typing in.
    const active = document.activeElement;
    const typing = active && (active.tagName === 'TEXTAREA' || (active.tagName === 'INPUT' && ['text', 'number', 'color'].includes(active.type)));
    if (!typing) build();
    applyPreview();
  });

  vscode.postMessage({ type: 'ready' });
})();
