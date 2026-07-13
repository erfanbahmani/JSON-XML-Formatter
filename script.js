'use strict';

// ---------- tiny DOM builder (div/span only — trees never need more) ----------

const UNITLESS = new Set(['fontWeight', 'opacity', 'zIndex', 'lineHeight', 'flex']);

function el(tag, props, ...children) {
  const node = document.createElement(tag);
  if (props) {
    if (props.className) node.className = props.className;
    if (props.title) node.title = props.title;
    if (props.onClick) node.addEventListener('click', props.onClick);
    if (props.style) {
      for (const [k, v] of Object.entries(props.style)) {
        node.style[k] = typeof v === 'number' && !UNITLESS.has(k) ? v + 'px' : v;
      }
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : String(child));
  }
  return node;
}

function chevron(collapsed) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '12');
  svg.setAttribute('height', '12');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', 'chevron' + (collapsed ? ' collapsed' : ''));
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'm6 9 6 6 6-6');
  svg.append(path);
  return svg;
}

function chevronSpacer() {
  return el('span', { className: 'chevron-spacer' });
}

function countBadge(n, kind) {
  return el('span', { className: 'tree-badge' }, n + ' ' + kind);
}

// ---------- type detection ----------

function detectType(str) {
  const s = (str || '').trim();
  if (!s) return 'empty';
  if (s[0] === '<') return 'xml';
  if (s[0] === '{' || s[0] === '[' || /^-?[\d"tfn]/.test(s)) return 'json';
  return 'unknown';
}

// ---------- JSON ----------

function parseJson(str) {
  try {
    return { ok: true, value: JSON.parse(str) };
  } catch (e) {
    return { ok: false, error: 'JSON error: ' + e.message };
  }
}

function highlightJson(str) {
  const C = { key: '#9cdcfe', str: '#ce9178', num: '#b5cea8', kw: '#569cd6', nul: '#569cd6', punct: '#808080' };
  const escPunct = (t) =>
    t
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/([{}\[\],:])/g, '<span style="color:' + C.punct + '">$1</span>');
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const tokenRe = /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tokenRe.exec(str))) {
    out += escPunct(str.slice(last, m.index));
    const token = m[0];
    if (/^"/.test(token) && /:$/.test(token.trim())) {
      const idx = token.lastIndexOf(':');
      const keyPart = token.slice(0, idx);
      const tail = token.slice(idx);
      out += '<span style="color:' + C.key + '">' + esc(keyPart) + '</span>' + escPunct(tail);
    } else if (/^"/.test(token)) {
      out += '<span style="color:' + C.str + '">' + esc(token) + '</span>';
    } else if (/^(true|false)$/.test(token)) {
      out += '<span style="color:' + C.kw + '">' + esc(token) + '</span>';
    } else if (token === 'null') {
      out += '<span style="color:' + C.nul + '">' + esc(token) + '</span>';
    } else {
      out += '<span style="color:' + C.num + '">' + esc(token) + '</span>';
    }
    last = tokenRe.lastIndex;
  }
  out += escPunct(str.slice(last));
  return out;
}

// ---------- XML ----------

function parseXml(str) {
  const doc = new DOMParser().parseFromString(str, 'application/xml');
  const errNode = doc.getElementsByTagName('parsererror')[0];
  if (errNode) {
    return { ok: false, error: 'XML error: ' + errNode.textContent.split('\n')[0] };
  }
  return { ok: true, doc };
}

function formatXmlNode(node, depth, indentSize) {
  const pad = ' '.repeat(depth * indentSize);
  if (node.nodeType === 3) {
    const t = node.nodeValue.trim();
    return t ? [pad + t] : [];
  }
  if (node.nodeType === 8) return [pad + '<!--' + node.nodeValue + '-->'];
  if (node.nodeType === 4) return [pad + '<![CDATA[' + node.nodeValue + ']]>'];
  if (node.nodeType !== 1) return [];
  const attrs = Array.from(node.attributes || [])
    .map((a) => a.name + '="' + a.value + '"')
    .join(' ');
  const open = '<' + node.nodeName + (attrs ? ' ' + attrs : '');
  const children = Array.from(node.childNodes).filter(
    (n) => !(n.nodeType === 3 && !n.nodeValue.trim())
  );
  if (children.length === 0) return [pad + open + '/>'];
  if (children.length === 1 && children[0].nodeType === 3) {
    return [pad + open + '>' + children[0].nodeValue.trim() + '</' + node.nodeName + '>'];
  }
  const lines = [pad + open + '>'];
  children.forEach((c) => lines.push(...formatXmlNode(c, depth + 1, indentSize)));
  lines.push(pad + '</' + node.nodeName + '>');
  return lines;
}

function formatXml(str, indentSize) {
  const decl = /^\s*<\?xml[^?]*\?>/.exec(str);
  const parsed = parseXml(str);
  if (!parsed.ok) return parsed;
  const lines = formatXmlNode(parsed.doc.documentElement, 0, indentSize);
  const text = (decl ? decl[0] + '\n' : '') + lines.join('\n');
  return { ok: true, text };
}

function minifyXml(str) {
  const parsed = parseXml(str);
  if (!parsed.ok) return parsed;
  const serialized = new XMLSerializer().serializeToString(parsed.doc);
  return { ok: true, text: serialized.replace(/>\s+</g, '><').trim() };
}

function highlightXml(str) {
  const C = { tag: '#569cd6', bracket: '#808080', attr: '#9cdcfe', val: '#ce9178', comment: '#6a9955' };
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  let out = '';
  const re = /(<!--[\s\S]*?-->)|(<\/?)([\w:.-]+)|([\w:.-]+)(=)("[^"]*"|'[^']*')|(\/?>|\?>)/g;
  let last = 0;
  let m;
  while ((m = re.exec(str))) {
    out += esc(str.slice(last, m.index));
    if (m[1]) {
      out += '<span style="color:' + C.comment + '">' + esc(m[1]) + '</span>';
    } else if (m[3]) {
      out += '<span style="color:' + C.bracket + '">' + esc(m[2]) + '</span><span style="color:' + C.tag + '">' + esc(m[3]) + '</span>';
    } else if (m[4]) {
      out += '<span style="color:' + C.attr + '">' + esc(m[4]) + '</span><span style="color:' + C.bracket + '">=</span><span style="color:' + C.val + '">' + esc(m[6]) + '</span>';
    } else if (m[7]) {
      out += '<span style="color:' + C.bracket + '">' + esc(m[7]) + '</span>';
    }
    last = re.lastIndex;
  }
  out += esc(str.slice(last));
  return out;
}

// ---------- app state ----------

const state = {
  rawInput: '',
  indent: 2,
  mode: 'pretty', // pretty | tree | min
  copied: false,
  collapsed: {},
};

let copyTimer = null;

function toggleCollapse(path) {
  state.collapsed = { ...state.collapsed, [path]: !state.collapsed[path] };
  render();
}

function collectJsonPaths(value, path, acc) {
  if (value && typeof value === 'object') {
    acc.push(path);
    Object.keys(value).forEach((k) => collectJsonPaths(value[k], path + '.' + k, acc));
  }
  return acc;
}

function collectXmlPaths(node, path, acc) {
  if (node && node.nodeType === 1) {
    const kids = Array.from(node.childNodes).filter((n) => n.nodeType === 1);
    if (kids.length) acc.push(path);
    kids.forEach((c, i) => collectXmlPaths(c, path + '.' + i, acc));
  }
  return acc;
}

// ---------- tree building ----------

function buildJsonTree(value, label, path, depth) {
  const collapsed = !!state.collapsed[path];
  const isArr = Array.isArray(value);
  const isObj = value !== null && typeof value === 'object';
  const rowStyle = { paddingLeft: depth * 16, cursor: isObj ? 'pointer' : 'default' };
  const keySpan = label != null ? el('span', { style: { color: '#9cdcfe' } }, label + ': ') : null;

  if (isObj) {
    const keys = Object.keys(value);
    const open = isArr ? '[' : '{';
    const close = isArr ? ']' : '}';
    const header = el(
      'div',
      { className: 'tree-row', style: rowStyle, onClick: () => toggleCollapse(path) },
      chevron(collapsed),
      keySpan,
      el('span', { style: { color: 'var(--neutral-500)' } }, open),
      collapsed ? el('span', { style: { color: 'var(--neutral-500)' } }, ' … ' + close) : null,
      countBadge(keys.length, isArr ? (keys.length === 1 ? 'item' : 'items') : (keys.length === 1 ? 'key' : 'keys'))
    );
    const kids = collapsed
      ? []
      : keys.map((k) => buildJsonTree(value[k], isArr ? null : k, path + '.' + k, depth + 1));
    const closer = collapsed
      ? null
      : el('div', { style: { paddingLeft: depth * 16 + 16, color: 'var(--neutral-500)' } }, close);
    return el('div', null, header, ...kids, closer);
  }

  let valStr, color;
  if (typeof value === 'string') { valStr = JSON.stringify(value); color = '#ce9178'; }
  else if (typeof value === 'boolean') { valStr = String(value); color = '#569cd6'; }
  else if (value === null) { valStr = 'null'; color = '#569cd6'; }
  else { valStr = String(value); color = '#b5cea8'; }

  return el(
    'div',
    { className: 'tree-leaf', style: { paddingLeft: depth * 16 + 16 } },
    keySpan,
    el('span', { style: { color } }, valStr)
  );
}

function buildXmlTree(node, path, depth) {
  if (node.nodeType !== 1) return null;
  const collapsed = !!state.collapsed[path];
  const attrs = Array.from(node.attributes || []);
  const elChildren = Array.from(node.childNodes).filter((n) => n.nodeType === 1);
  const textContent = Array.from(node.childNodes)
    .filter((n) => n.nodeType === 3 && n.nodeValue.trim())
    .map((n) => n.nodeValue.trim())
    .join(' ');
  const hasKids = elChildren.length > 0;
  const rowStyle = { paddingLeft: depth * 16, cursor: hasKids ? 'pointer' : 'default' };

  const attrNodes = attrs.map((a) =>
    el(
      'span',
      null,
      ' ',
      el('span', { style: { color: '#9cdcfe' } }, a.name),
      '=',
      el('span', { style: { color: '#ce9178' } }, '"' + a.value + '"')
    )
  );

  const header = el(
    'div',
    { className: 'tree-row', style: rowStyle, onClick: hasKids ? () => toggleCollapse(path) : null },
    hasKids ? chevron(collapsed) : chevronSpacer(),
    el('span', { style: { color: '#569cd6' } }, '<' + node.nodeName),
    ...attrNodes,
    el('span', { style: { color: '#808080' } }, hasKids || textContent ? '>' : '/>'),
    !hasKids && textContent ? el('span', { style: { color: 'var(--neutral-100)' } }, ' ' + textContent) : null,
    !hasKids && textContent ? el('span', { style: { color: '#569cd6' } }, '</' + node.nodeName + '>') : null,
    hasKids ? countBadge(elChildren.length, elChildren.length === 1 ? 'child' : 'children') : null
  );

  if (!hasKids) return el('div', null, header);

  const kids = collapsed ? [] : elChildren.map((c, i) => buildXmlTree(c, path + '.' + i, depth + 1));
  const closer = collapsed
    ? null
    : el('div', { style: { paddingLeft: depth * 16, color: '#569cd6' } }, '</' + node.nodeName + '>');
  return el('div', null, header, ...kids, closer);
}

// ---------- core compute ----------

function computeResult() {
  const { rawInput, indent, mode } = state;
  const type = detectType(rawInput);
  if (type === 'empty') return { type, error: null, outputText: '', value: null };
  if (type === 'unknown') return { type, error: 'Could not detect JSON or XML — check the input starts with { [ or <', outputText: '' };

  if (type === 'json') {
    const parsed = parseJson(rawInput.trim());
    if (!parsed.ok) return { type, error: parsed.error, outputText: '' };
    const text = mode === 'min' ? JSON.stringify(parsed.value) : JSON.stringify(parsed.value, null, indent);
    return { type, error: null, outputText: text, value: parsed.value };
  }

  // xml
  if (mode === 'min') {
    const r = minifyXml(rawInput.trim());
    if (!r.ok) return { type, error: r.error, outputText: '' };
    return { type, error: null, outputText: r.text };
  }
  const r = formatXml(rawInput.trim(), indent);
  if (!r.ok) return { type, error: r.error, outputText: '' };
  const parsedDoc = parseXml(rawInput.trim());
  return { type, error: null, outputText: r.text, doc: parsedDoc.ok ? parsedDoc.doc : null };
}

// ---------- DOM refs ----------

const refs = {
  fileInput: document.getElementById('file-input'),
  importBtn: document.getElementById('import-btn'),
  clearBtn: document.getElementById('clear-btn'),
  inputGutter: document.getElementById('input-gutter'),
  inputOverlay: document.getElementById('input-overlay'),
  inputTextarea: document.getElementById('input-textarea'),
  inputGlyph: document.getElementById('input-glyph'),
  outputGlyph: document.getElementById('output-glyph'),
  modePrettyBtn: document.getElementById('mode-pretty-btn'),
  modeTreeBtn: document.getElementById('mode-tree-btn'),
  modeMinBtn: document.getElementById('mode-min-btn'),
  treeControls: document.getElementById('tree-controls'),
  expandAllBtn: document.getElementById('expand-all-btn'),
  collapseAllBtn: document.getElementById('collapse-all-btn'),
  copyBtn: document.getElementById('copy-btn'),
  copyIconCopy: document.getElementById('copy-icon-copy'),
  copyIconCheck: document.getElementById('copy-icon-check'),
  downloadBtn: document.getElementById('download-btn'),
  outputBody: document.getElementById('output-body'),
  errorBanner: document.getElementById('error-banner'),
  errorText: document.getElementById('error-text'),
  statusIcon: document.getElementById('status-icon'),
  statusText: document.getElementById('status-text'),
  statusLines: document.getElementById('status-lines'),
  indentToggleBtn: document.getElementById('indent-toggle-btn'),
  modeNameLabel: document.getElementById('mode-name-label'),
};

const ICON_INFO = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle></svg>';
const ICON_ERROR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m15 9-6 6"></path><path d="m9 9 6 6"></path></svg>';
const ICON_VALID = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>';

// ---------- actions ----------

function onInputChange(e) {
  state.rawInput = e.target.value;
  state.copied = false;
  render();
}

function clearInput() {
  state.rawInput = '';
  state.collapsed = {};
  render();
}

function toggleIndent() {
  state.indent = state.indent === 2 ? 4 : 2;
  render();
}

function setMode(mode) {
  state.mode = mode;
  render();
}

function onInputScroll(e) {
  refs.inputGutter.scrollTop = e.target.scrollTop;
  refs.inputOverlay.scrollTop = e.target.scrollTop;
  refs.inputOverlay.scrollLeft = e.target.scrollLeft;
}

function expandAll() {
  state.collapsed = {};
  render();
}

function collapseAll() {
  const result = computeResult();
  const acc = [];
  if (result.type === 'json') collectJsonPaths(result.value, 'root', acc);
  else if (result.type === 'xml' && result.doc) collectXmlPaths(result.doc.documentElement, 'root', acc);
  const collapsed = {};
  acc.forEach((p) => { if (p !== 'root') collapsed[p] = true; });
  state.collapsed = collapsed;
  render();
}

function importFromFile() {
  refs.fileInput.click();
}

function onFilePicked(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.rawInput = String(reader.result || '');
    state.collapsed = {};
    state.copied = false;
    render();
  };
  reader.readAsText(file);
  e.target.value = '';
}

function copyFallback(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try { document.execCommand('copy'); } catch (e) { /* clipboard unsupported */ }
  document.body.removeChild(ta);
}

function copyOutput() {
  const { outputText } = computeResult();
  if (!outputText) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(outputText).catch(() => copyFallback(outputText));
  } else {
    copyFallback(outputText);
  }
  clearTimeout(copyTimer);
  state.copied = true;
  render();
  copyTimer = setTimeout(() => { state.copied = false; render(); }, 1600);
}

function downloadOutput() {
  const { outputText, type } = computeResult();
  if (!outputText) return;
  const ext = type === 'xml' ? 'xml' : 'json';
  const blob = new Blob([outputText], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'formatted.' + ext;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------- render ----------

function render() {
  const { indent, mode, copied } = state;
  const result = computeResult();
  const hasOutput = !!result.outputText && !result.error;
  const hasInput = state.rawInput.length > 0;

  // input pane
  if (refs.inputTextarea.value !== state.rawInput) refs.inputTextarea.value = state.rawInput;
  refs.clearBtn.hidden = !hasInput;

  const inputLineCount = (state.rawInput.match(/\n/g) || []).length + 1;
  refs.inputGutter.textContent = Array.from({ length: inputLineCount }, (_, i) => i + 1).join('\n');

  if (state.rawInput) {
    const inHtml = result.type === 'xml' ? highlightXml(state.rawInput) : highlightJson(state.rawInput);
    refs.inputOverlay.innerHTML = '<pre>' + inHtml + '\n</pre>';
  } else {
    refs.inputOverlay.innerHTML = '';
  }

  const glyph = result.type === 'xml' ? '<>' : '{}';
  refs.inputGlyph.textContent = glyph;
  refs.outputGlyph.textContent = glyph;

  // mode buttons
  refs.modePrettyBtn.classList.toggle('active', mode === 'pretty');
  refs.modeTreeBtn.classList.toggle('active', mode === 'tree');
  refs.modeMinBtn.classList.toggle('active', mode === 'min');
  refs.treeControls.hidden = mode !== 'tree';

  // output pane
  refs.outputBody.replaceChildren();
  if (hasOutput && mode === 'tree') {
    const container = el('div', { className: 'output-tree' });
    let treeNode = null;
    if (result.type === 'json') treeNode = buildJsonTree(result.value, null, 'root', 0);
    else if (result.type === 'xml' && result.doc) treeNode = buildXmlTree(result.doc.documentElement, 'root', 0);
    if (treeNode) container.append(treeNode);
    refs.outputBody.append(container);
  } else if (hasOutput) {
    const outputLineCount = (result.outputText.match(/\n/g) || []).length + 1;
    const outputLineNumbers = Array.from({ length: outputLineCount }, (_, i) => i + 1).join('\n');
    const html = result.type === 'xml' ? highlightXml(result.outputText) : highlightJson(result.outputText);
    const gutter = el('div', { className: 'gutter' }, outputLineNumbers);
    const code = el('div', { className: 'code' });
    code.innerHTML = '<pre>' + html + '</pre>';
    refs.outputBody.append(el('div', { className: 'output-code' }, gutter, code));
  } else {
    refs.outputBody.append(el('div', { className: 'output-empty' }, 'Formatted output will appear here.'));
  }

  // copy / download buttons
  refs.copyBtn.disabled = !hasOutput;
  refs.downloadBtn.disabled = !hasOutput;
  refs.copyIconCopy.hidden = copied;
  refs.copyIconCheck.hidden = !copied;
  refs.copyBtn.classList.toggle('active', copied);

  // error banner
  refs.errorBanner.hidden = !result.error;
  refs.errorText.textContent = result.error || '';

  // status bar
  let statusText = 'No input';
  let statusIcon = ICON_INFO;
  if (result.error) {
    statusText = result.type === 'xml' ? 'Invalid XML' : result.type === 'json' ? 'Invalid JSON' : 'Unrecognized input';
    statusIcon = ICON_ERROR;
  } else if (hasOutput) {
    statusText = (result.type === 'xml' ? 'XML' : 'JSON') + ' — valid';
    statusIcon = ICON_VALID;
  }
  refs.statusIcon.innerHTML = statusIcon;
  refs.statusText.textContent = statusText;
  refs.statusLines.textContent = state.rawInput ? inputLineCount : 0;
  refs.indentToggleBtn.textContent = 'Spaces: ' + indent;
  refs.modeNameLabel.textContent = mode === 'min' ? 'minified' : mode;
}

// ---------- wire up events ----------

refs.inputTextarea.addEventListener('input', onInputChange);
refs.inputTextarea.addEventListener('scroll', onInputScroll);
refs.clearBtn.addEventListener('click', clearInput);
refs.importBtn.addEventListener('click', importFromFile);
refs.fileInput.addEventListener('change', onFilePicked);
refs.modePrettyBtn.addEventListener('click', () => setMode('pretty'));
refs.modeTreeBtn.addEventListener('click', () => setMode('tree'));
refs.modeMinBtn.addEventListener('click', () => setMode('min'));
refs.expandAllBtn.addEventListener('click', expandAll);
refs.collapseAllBtn.addEventListener('click', collapseAll);
refs.copyBtn.addEventListener('click', copyOutput);
refs.downloadBtn.addEventListener('click', downloadOutput);
refs.indentToggleBtn.addEventListener('click', toggleIndent);

render();
