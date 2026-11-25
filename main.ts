// Hearth & Ladle — the hand-in program (Node 22, standard library only).
// It copies game/ and screenshots/ from beside this file to /output (or
// MAKEFUN_OUTPUT_DIR outside the grader) and writes /output/dossier.json,
// the summary the judge reads. The dossier writer below is this entry's own
// implementation of the make.fun dossier format (makefun/dossier/v1): it
// walks game/, orders the sources the way the page loads them, and packs
// the text and screenshots into one canonical JSON document, capped the
// way the gate caps it. Run it:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { createHash } from 'node:crypto';
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ------------------------------------------------------------------ bytes

const DOSSIER_SCHEMA = 'makefun/dossier/v1';
const DOSSIER_MAX_BYTES = 4 * 1024 * 1024;
const DOSSIER_MAX_IMAGES = 8;
const INDEX_HTML = 'index.html';
const INDEX_HTML_MAX_BYTES = 1024 * 1024;
const GAME_PATH_MAX_BYTES = 1000;
const VENDORED_LISTED = 24;

const SOURCE_EXTENSIONS = ['html', 'js', 'mjs', 'css', 'glsl', 'vert', 'frag', 'wgsl', 'json'];
const GENERATED_NAME = /\.min\.(?:js|mjs|css)$/i;
const SOURCE_NAME = new RegExp(`\\.(?:${SOURCE_EXTENSIONS.join('|')})$`, 'i');
const MODULE_NAME = /\.(?:js|mjs)$/i;

const utf8 = new TextDecoder('utf-8');

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');
const byteLength = (s) => Buffer.byteLength(s, 'utf8');
const text = (bytes) => utf8.decode(bytes);

// Lines of a source: 0 when empty, else its newlines plus one for a last line with none.
function lineCount(bytes) {
  if (bytes.length === 0) return 0;
  let n = 0;
  for (const b of bytes) if (b === 0x0a) n++;
  return bytes[bytes.length - 1] === 0x0a ? n : n + 1;
}

// A Markdown fence one backtick longer than the longest run in `body`, three at least.
function fenceFor(body) {
  let longest = 0;
  for (const run of body.match(/`+/g) ?? []) longest = Math.max(longest, run.length);
  return '`'.repeat(Math.max(3, longest + 1));
}

// The fence's language tag for a source path.
function languageOf(path) {
  const ext = /\.([A-Za-z0-9]+)$/.exec(path)?.[1]?.toLowerCase() ?? '';
  if (ext === 'mjs' || ext === 'js') return 'js';
  if (ext === 'glsl' || ext === 'vert' || ext === 'frag') return 'glsl';
  if (ext === 'wgsl') return 'wgsl';
  if (ext === 'html') return 'html';
  if (ext === 'css') return 'css';
  if (ext === 'json') return 'json';
  return 'text';
}

class DossierError extends Error {
  constructor(message, limit = null) {
    super(message);
    this.name = 'DossierError';
    this.limit = limit;
  }
}

// ------------------------------------------------------------------ the game tree

// What a path under game/ is to the dossier: a source it shows, or a vendored
// file or an asset it only counts. A generated name (*.min.js, *.min.mjs,
// *.min.css) and any path under a directory named vendor are vendored, a
// source extension outside them is source, and everything else is an asset.
function classifyGamePath(path) {
  const segs = path.split('/');
  const base = segs[segs.length - 1] ?? '';
  const dirs = segs.slice(0, -1);
  if (dirs.includes('vendor') || GENERATED_NAME.test(base)) return 'vendored';
  return SOURCE_NAME.test(base) ? 'source' : 'asset';
}

function gameCapsOf(caps, who) {
  const out = { game_max_files: Infinity, game_max_bytes: Infinity, game_path_max_bytes: GAME_PATH_MAX_BYTES };
  for (const k of ['game_max_files', 'game_max_bytes', 'game_path_max_bytes']) {
    const v = caps[k];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new TypeError(`${who}: caps.${k} must be a whole number, not ${String(v)}`);
    out[k] = v;
  }
  return out;
}

// Every file and directory under game/, by path, with each file's bytes and
// class and the totals. Symbolic links and other special files are refused,
// as are more than caps.game_max_files entries, more than caps.game_max_bytes
// bytes in the files, and a path longer than caps.game_path_max_bytes.
function readGameTree(gameDir, caps = {}) {
  const c = gameCapsOf(caps, 'readGameTree');
  let root;
  try {
    root = lstatSync(gameDir);
  } catch {
    throw new DossierError('game/: no such directory: a game is a directory of static files, its index.html at its root');
  }
  if (!root.isDirectory()) throw new DossierError('game/: not a directory (a game is a directory of static files)');
  const files = [];
  const directories = [];
  const stack = [''];
  let count = 0;
  let totalBytes = 0;
  while (stack.length > 0) {
    const rel = stack.pop();
    let entries;
    try {
      entries = readdirSync(rel === '' ? gameDir : join(gameDir, rel), { withFileTypes: true });
    } catch (err) {
      throw new DossierError(`game/${rel === '' ? '' : `${rel}/`}: cannot be read (${err.message})`);
    }
    for (const e of entries) {
      const path = rel === '' ? e.name : `${rel}/${e.name}`;
      const pathBytes = byteLength(path);
      if (pathBytes > c.game_path_max_bytes) {
        throw new DossierError(`game/${path}: a path of ${pathBytes} bytes, over the ${c.game_path_max_bytes} allowed (game_path_max_bytes)`, 'game_path_max_bytes');
      }
      const shown = `game/${path}`;
      let st;
      try {
        st = lstatSync(join(gameDir, path));
      } catch {
        throw new DossierError(`${shown}: cannot be read`);
      }
      count++;
      if (count > c.game_max_files) {
        throw new DossierError(`game/: holds more than the ${c.game_max_files} files and directories allowed (game_max_files)`, 'game_max_files');
      }
      if (st.isDirectory()) {
        directories.push(path);
        stack.push(path);
      } else if (st.isFile()) {
        totalBytes += st.size;
        if (totalBytes > c.game_max_bytes) {
          throw new DossierError(`game/: its files come to more than the ${c.game_max_bytes} bytes allowed (game_max_bytes)`, 'game_max_bytes');
        }
        files.push({ path, bytes: st.size, cls: classifyGamePath(path) });
      } else {
        throw new DossierError(`${shown}: a symbolic link or special file (game/ holds plain files and directories only)`);
      }
    }
  }
  files.sort((a, b) => byCodeUnit(a.path, b.path));
  directories.sort(byCodeUnit);
  return { files, directories, count, totalBytes };
}

// game/index.html's bytes from the tree, or why there is none.
function readIndexHtml(gameDir, tree) {
  const file = tree.files.find((f) => f.path === INDEX_HTML);
  if (file === undefined) {
    if (tree.directories.includes(INDEX_HTML)) throw new DossierError('buildDossier: game/index.html: a directory, not the page');
    throw new DossierError('buildDossier: game/index.html: no such file: a game is a directory of static files, its index.html at its root');
  }
  if (file.bytes > INDEX_HTML_MAX_BYTES) throw new DossierError(`buildDossier: game/index.html: ${file.bytes} bytes, over the ${INDEX_HTML_MAX_BYTES} a page may be`);
  try {
    return new Uint8Array(readFileSync(join(gameDir, INDEX_HTML)));
  } catch (err) {
    throw new DossierError(`buildDossier: game/index.html: cannot be read (${err.message})`);
  }
}

// ------------------------------------------------------------------ the page

const RESOURCE_TAGS = ['img', 'source', 'video', 'audio', 'iframe'];

// The index of `>` ending a tag whose body starts at `from`, honoring quoted attribute values; -1 when there is none.
function tagEnd(html, from) {
  let quote = '';
  for (let i = from; i < html.length; i++) {
    const ch = html[i];
    if (quote !== '') {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '>') return i;
  }
  return -1;
}

// A tag body's attributes, names lowercased, values unquoted; a present attribute with no value is ''.
function attributesOf(body) {
  const out = new Map();
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /[\s/]/.test(body[i])) i++;
    if (i >= body.length) break;
    const start = i;
    while (i < body.length && !/[\s=/>]/.test(body[i])) i++;
    const name = body.slice(start, i).toLowerCase();
    while (i < body.length && /\s/.test(body[i])) i++;
    let value = '';
    if (body[i] === '=') {
      i++;
      while (i < body.length && /\s/.test(body[i])) i++;
      const quote = body[i];
      if (quote === '"' || quote === "'") {
        const end = body.indexOf(quote, i + 1);
        value = body.slice(i + 1, end < 0 ? body.length : end);
        i = end < 0 ? body.length : end + 1;
      } else {
        const s = i;
        while (i < body.length && !/[\s>]/.test(body[i])) i++;
        value = body.slice(s, i);
      }
    }
    if (name !== '') out.set(name, value);
  }
  return out;
}

// The index of `</name` at or after `from`, ASCII case-insensitively; -1 when there is none.
function closeIndexOf(html, from, name) {
  const needle = `</${name}`;
  for (let i = from; i + needle.length <= html.length; i++) {
    if (html[i] !== '<') continue;
    let hit = true;
    for (let j = 1; j < needle.length; j++) {
      const a = html[i + j].toLowerCase();
      if (a !== needle[j]) {
        hit = false;
        break;
      }
    }
    if (hit) return i;
  }
  return -1;
}

// Every <script>, <link href>, <img src>, <source src>, <video src>, <audio
// src> and <iframe src> and <script type="importmap"> of a page, in document
// order. Comments and the document type are skipped.
function htmlFacts(html) {
  const scripts = [];
  const links = [];
  const resources = [];
  const importMaps = [];
  let i = 0;
  while (i < html.length) {
    const at = html.indexOf('<', i);
    if (at < 0) break;
    if (html.startsWith('<!--', at)) {
      const end = html.indexOf('-->', at + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith('<!', at)) {
      const end = html.indexOf('>', at + 2);
      i = end < 0 ? html.length : end + 1;
      continue;
    }
    const rest = html.slice(at + 1, at + 8).toLowerCase();
    if (rest.startsWith('script') && !/[A-Za-z0-9]/.test(html[at + 7] ?? '')) {
      const end = tagEnd(html, at + 7);
      if (end < 0) break;
      const attrs = attributesOf(html.slice(at + 7, end));
      const type = (attrs.get('type') ?? '').trim().toLowerCase();
      const src = attrs.get('src') ?? null;
      let body = '';
      if (src === null) {
        const close = closeIndexOf(html, end + 1, 'script');
        body = html.slice(end + 1, close < 0 ? html.length : close);
        i = close < 0 ? html.length : close + 8;
      } else {
        const close = closeIndexOf(html, end + 1, 'script');
        i = close < 0 ? html.length : close + 8;
      }
      if (type === 'importmap') {
        let value = null;
        let error = null;
        try {
          value = JSON.parse(body);
        } catch (err) {
          error = err.message;
        }
        importMaps.push({ value, error });
      } else {
        scripts.push({ src, type, text: src === null ? body : '' });
      }
      continue;
    }
    if (rest.startsWith('link') && !/[A-Za-z0-9]/.test(html[at + 5] ?? '')) {
      const end = tagEnd(html, at + 5);
      if (end < 0) break;
      const attrs = attributesOf(html.slice(at + 5, end));
      const href = attrs.get('href');
      if (href !== undefined) links.push({ href, rel: (attrs.get('rel') ?? '').trim().toLowerCase() });
      i = end + 1;
      continue;
    }
    const tag = RESOURCE_TAGS.find((name) => rest.startsWith(name) && !/[A-Za-z0-9]/.test(html[at + 1 + name.length] ?? ''));
    if (tag !== undefined) {
      const end = tagEnd(html, at + 1 + tag.length);
      if (end < 0) break;
      const attrs = attributesOf(html.slice(at + 1 + tag.length, end));
      const src = attrs.get('src');
      if (src !== undefined) resources.push({ tag, src });
      i = end + 1;
      continue;
    }
    const end = tagEnd(html, at + 1);
    i = end < 0 ? html.length : end + 1;
  }
  return { scripts, links, resources, importMaps };
}

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

// An own enumerable property set whatever its key: a "__proto__" key stays a key, never the prototype.
function setOwn(o, key, value) {
  Object.defineProperty(o, key, { value, enumerable: true, writable: true, configurable: true });
}

// The page's import map, parsed: none (map and error null) when the page holds
// no <script type="importmap">, else its one map, or why it cannot be used.
function importMapOf(facts) {
  if (facts.importMaps.length === 0) return { map: null, error: null };
  if (facts.importMaps.length > 1) return { map: null, error: `index.html holds ${facts.importMaps.length} import maps: a page holds one at most` };
  const only = facts.importMaps[0];
  if (only.error !== null) return { map: null, error: `index.html's import map is not JSON (${only.error})` };
  if (!isObject(only.value)) return { map: null, error: 'index.html\'s import map is not a JSON object' };
  const importsRaw = only.value.imports ?? {};
  if (!isObject(importsRaw)) return { map: null, error: 'index.html\'s import map holds an "imports" that is not an object' };
  const imports = {};
  for (const [key, value] of Object.entries(importsRaw)) {
    if (value !== null && typeof value !== 'string') return { map: null, error: `index.html's import map maps ${JSON.stringify(key)} to no string` };
    setOwn(imports, key, value);
  }
  const scopes = {};
  const scopesRaw = only.value.scopes;
  if (scopesRaw !== undefined) {
    if (!isObject(scopesRaw)) return { map: null, error: 'index.html\'s import map holds a "scopes" that is not an object' };
    for (const [scope, entries] of Object.entries(scopesRaw)) {
      if (!isObject(entries)) return { map: null, error: `index.html's import map scope ${JSON.stringify(scope)} is not an object` };
      const inner = {};
      for (const [key, value] of Object.entries(entries)) {
        if (value !== null && typeof value !== 'string') return { map: null, error: `index.html's import map scope ${JSON.stringify(scope)} maps ${JSON.stringify(key)} to no string` };
        setOwn(inner, key, value);
      }
      setOwn(scopes, scope, inner);
    }
  }
  return { map: { imports, scopes }, error: null };
}

const URI_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

// Whether a reference is relative: not empty, no scheme, no leading // and no leading /.
function isRelativeRef(ref) {
  return ref.length > 0 && !URI_SCHEME.test(ref) && !ref.startsWith('//') && !ref.startsWith('/');
}

// Whether a module specifier is relative in JavaScript's sense (./ or ../, or . or ..).
function isRelativeSpecifier(specifier) {
  return specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../');
}

// The path under game/ that the relative reference `ref` names, resolved
// against the importing file's path (`from`, POSIX and relative to game/).
// Null when `ref` is not relative, names nothing, or climbs out of game/.
function resolveGamePath(ref, from) {
  if (!isRelativeRef(ref)) return null;
  const cut = ref.search(/[?#]/);
  const raw = cut < 0 ? ref : ref.slice(0, cut);
  if (raw === '') return null;
  const parts = from.split('/').slice(0, -1);
  for (const seg of raw.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (parts.length === 0) return null;
      parts.pop();
      continue;
    }
    parts.push(seg);
  }
  if (parts.length === 0) return null;
  return parts.join('/');
}

// The entry for a specifier in one map: an exact own key, else the longest own key ending in / that prefixes it.
function entryOf(entries, specifier) {
  if (Object.hasOwn(entries, specifier)) return { found: true, value: entries[specifier] };
  let best = null;
  for (const key of Object.keys(entries)) {
    if (key.endsWith('/') && specifier.startsWith(key) && (best === null || key.length > best.length)) best = key;
  }
  if (best === null) return { found: false, value: null };
  const base = entries[best];
  if (base === null) return { found: true, value: null };
  return { found: true, value: `${base}${specifier.slice(best.length)}` };
}

// The game path a scope key's URL prefix names, or null when it cannot name one.
function scopePath(scope) {
  const cut = scope.search(/[?#]/);
  const raw = cut < 0 ? scope : scope.slice(0, cut);
  if (raw === '.' || raw === './') return '';
  return resolveGamePath(scope, INDEX_HTML);
}

// What the page's import map says for `specifier` imported from `from`.
function importMapMatch(map, specifier, from = INDEX_HTML) {
  if (map === null) return { found: false, value: null };
  let best = null;
  for (const [scope, entries] of Object.entries(map.scopes)) {
    const prefix = scopePath(scope);
    if (prefix === null || !from.startsWith(prefix)) continue;
    if (best === null || prefix.length > best.prefix.length) best = { prefix, entries };
  }
  if (best !== null) {
    const scoped = entryOf(best.entries, specifier);
    if (scoped.found) return scoped;
  }
  return entryOf(map.imports, specifier);
}

// The path a specifier names from `from`: relative to the importer, or through the import map.
function resolveSpecifier(specifier, from, map) {
  if (isRelativeSpecifier(specifier)) return resolveGamePath(specifier, from);
  const match = importMapMatch(map, specifier, from);
  if (!match.found || match.value === null || !isRelativeRef(match.value)) return null;
  return resolveGamePath(match.value, INDEX_HTML);
}

// ------------------------------------------------------------------ static imports

const IDENT_START = /[A-Za-z_$]/;
const IDENT = /[A-Za-z0-9_$]/;

// A module's static import and export-from specifiers, in source order, by a
// lexical scan: comments, strings, template literals and regular-expression
// literals are skipped, so the words inside them are never read as imports.
function sourceImports(source) {
  const out = [];
  const n = source.length;
  let i = 0;
  const regexPosition = (prev) => prev === '' || '([{,;:=!&|?+-*%^~<>'.includes(prev);
  let prev = '';

  const skipSpace = () => {
    for (;;) {
      while (i < n && /\s/.test(source[i])) i++;
      if (source.startsWith('//', i)) {
        while (i < n && source[i] !== '\n') i++;
        continue;
      }
      if (source.startsWith('/*', i)) {
        const end = source.indexOf('*/', i + 2);
        i = end < 0 ? n : end + 2;
        continue;
      }
      return;
    }
  };
  const skipString = (quote) => {
    i++;
    let s = '';
    while (i < n) {
      const ch = source[i];
      if (ch === quote) {
        i++;
        return s;
      }
      if (ch === '\\') {
        const next = source[i + 1];
        if (next === undefined) return null;
        s += next === 'n' ? '\n' : next === 't' ? '\t' : next === 'r' ? '\r' : next;
        i += 2;
        continue;
      }
      if (ch === '\n') return null;
      s += ch;
      i++;
    }
    return null;
  };
  const skipTemplate = () => {
    i++;
    while (i < n) {
      const ch = source[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '`') {
        i++;
        return;
      }
      i++;
    }
  };
  const skipRegex = () => {
    i++;
    let inClass = false;
    while (i < n) {
      const ch = source[i];
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === '[') inClass = true;
      else if (ch === ']') inClass = false;
      else if (ch === '/' && !inClass) {
        i++;
        return;
      } else if (ch === '\n') return;
      i++;
    }
  };
  const readWord = () => {
    const start = i;
    while (i < n && IDENT.test(source[i])) i++;
    return source.slice(start, i);
  };
  const maybeString = () => {
    skipSpace();
    const ch = source[i];
    if (ch !== '"' && ch !== "'") return null;
    return skipString(ch);
  };
  // From just after `import`/`export`, reads a clause and its `from 'x'`; returns the specifier or null.
  const clause = (stopAt) => {
    for (;;) {
      skipSpace();
      if (i >= n) return null;
      const ch = source[i];
      if (stopAt.includes(ch)) return null;
      if (ch === '"' || ch === "'") return skipString(ch);
      if (ch === '{' || ch === '}') {
        i++;
        continue;
      }
      if (ch === ',' || ch === '*') {
        i++;
        continue;
      }
      if (IDENT_START.test(ch)) {
        const word = readWord();
        if (word === 'from') {
          const spec = maybeString();
          return spec;
        }
        if (word === 'as' || word === 'type') continue;
        continue;
      }
      return null;
    }
  };

  while (i < n) {
    skipSpace();
    if (i >= n) break;
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      skipString(ch);
      prev = ch;
      continue;
    }
    if (ch === '`') {
      skipTemplate();
      prev = '`';
      continue;
    }
    if (ch === '/') {
      if (regexPosition(prev)) skipRegex();
      else i++;
      prev = '/';
      continue;
    }
    if (IDENT_START.test(ch)) {
      const word = readWord();
      prev = 'a';
      if (word === 'import') {
        skipSpace();
        if (source[i] === '(' || source[i] === '.') continue;
        const spec = clause(['=', ';']);
        if (spec !== null) out.push(spec);
        continue;
      }
      if (word === 'export') {
        skipSpace();
        if (source[i] !== '*' && source[i] !== '{') continue;
        const spec = clause(['=', ';']);
        if (spec !== null) out.push(spec);
        continue;
      }
      continue;
    }
    prev = ch;
    i++;
  }
  return out;
}

// The JavaScript MIME types (the HTML standard's list, by essence) that make a <script> a classic script.
const CLASSIC_SCRIPT_TYPES = new Set([
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
]);

// Whether a <script>'s type makes it a classic script: none, or a JavaScript MIME type.
function isClassicScript(type) {
  return type === '' || CLASSIC_SCRIPT_TYPES.has(type.split(';')[0].trim());
}

// The source JS files of a game in the order the page loads them: index.html's
// scripts in document order, a classic script's src where it stands, and a
// module script followed by a depth-first walk of its static imports.
function importOrder(sources, facts) {
  const byPath = new Map(sources.map((s) => [s.path, s]));
  const map = importMapOf(facts).map;
  const textOf = (path) => {
    const file = byPath.get(path);
    return file === undefined ? '' : text(file.bytes);
  };
  const order = [];
  const seen = new Set();
  const visit = (path, walk = true) => {
    if (seen.has(path) || !MODULE_NAME.test(path) || !byPath.has(path)) return;
    seen.add(path);
    order.push(path);
    if (!walk) return;
    for (const specifier of sourceImports(textOf(path))) {
      const target = resolveSpecifier(specifier, path, map);
      if (target !== null) visit(target);
    }
  };
  for (const script of facts.scripts) {
    if (script.type !== 'module') {
      if (isClassicScript(script.type) && script.src !== null && isRelativeRef(script.src)) {
        const target = resolveGamePath(script.src, INDEX_HTML);
        if (target !== null) visit(target, false);
      }
      continue;
    }
    if (script.src !== null) {
      const target = isRelativeRef(script.src) ? resolveGamePath(script.src, INDEX_HTML) : resolveSpecifier(script.src, INDEX_HTML, map);
      if (target !== null) visit(target);
    } else {
      for (const specifier of sourceImports(script.text)) {
        const target = resolveSpecifier(specifier, INDEX_HTML, map);
        if (target !== null) visit(target);
      }
    }
  }
  return order;
}

// ------------------------------------------------------------------ canonical JSON

// JSON with every object's keys in code-unit order and no whitespace: one spelling per value.
function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`canonicalJson: ${value} is not a finite number`);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`;
  if (typeof value === 'object') {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) throw new TypeError('canonicalJson: only plain objects and arrays');
    const o = value;
    return `{${Object.keys(o)
      .sort(byCodeUnit)
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(',')}}`;
  }
  throw new TypeError(`canonicalJson: a ${typeof value} has no JSON form`);
}

// ------------------------------------------------------------------ the dossier

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

const opensWith = (bytes, magic, at = 0) => bytes.length >= at + magic.length && magic.every((b, i) => bytes[at + i] === b);

// A file's extension's group: a file's bytes grouped by the extension the Game block counts.
const extensionOf = (path) => {
  const base = path.split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : '(none)';
};

// The `## Game` block's lines: what game/ holds, by class, with the totals (no source text).
function gameBlockLines(tree) {
  const source = tree.files.filter((f) => f.cls === 'source');
  const vendored = tree.files.filter((f) => f.cls === 'vendored');
  const assets = tree.files.filter((f) => f.cls === 'asset');
  const sum = (list) => list.reduce((n, f) => n + f.bytes, 0);
  const lines = [
    '## Game',
    '',
    `Source files: ${source.length} (${sum(source)} bytes)`,
    `Vendored files: ${vendored.length} (${sum(vendored)} bytes)`,
  ];
  if (vendored.length > 0) {
    const listed = vendored.slice(0, VENDORED_LISTED).map((f) => `game/${f.path} (${f.bytes} bytes)`);
    const more = vendored.length > VENDORED_LISTED ? `, and ${vendored.length - VENDORED_LISTED} more` : '';
    lines.push(`  ${listed.join(', ')}${more}`);
  }
  const byExt = new Map();
  for (const f of assets) {
    const ext = extensionOf(f.path);
    const at = byExt.get(ext) ?? { n: 0, bytes: 0 };
    at.n++;
    at.bytes += f.bytes;
    byExt.set(ext, at);
  }
  const extText = [...byExt]
    .sort((a, b) => byCodeUnit(a[0], b[0]))
    .map(([ext, at]) => `${ext} ${at.n} (${at.bytes} bytes)`)
    .join(', ');
  lines.push(`Assets: ${extText === '' ? 'none' : extText}`);
  lines.push(`Totals: ${tree.count} files and directories (${tree.totalBytes} bytes)`);
  return lines;
}

// A source's section cut inside its text: its heading, its first k lines in its
// fence (closed), a line naming how many of its lines are not shown, then
// `tail(hidden)`; k the most lines whose whole fits in `room` UTF-8 bytes;
// null when not one line fits.
function sourceHead(heading, code, language, room, tail) {
  const total = lineCount(code.norm);
  const lines = code.text.split('\n');
  const open = `${code.fence}${language}\n`;
  const close = `${code.fence}\n\n`;
  const note = (k) => `[${total - k} of this file's ${total} lines not shown.]\n`;
  const fixed = byteLength(heading) + byteLength(open) + byteLength(close);
  let best = 0;
  let shown = 0;
  let raw = 0;
  for (let k = 1; k < total; k++) {
    shown += byteLength(lines[k - 1]) + 1;
    raw = code.norm.indexOf(0x0a, raw) + 1;
    if (fixed + shown + byteLength(note(k)) + byteLength(tail(code.norm.length - raw)) <= room) best = k;
  }
  if (best === 0) return null;
  let rawEnd = 0;
  for (let k = 0; k < best; k++) rawEnd = code.norm.indexOf(0x0a, rawEnd) + 1;
  const head = lines.slice(0, best).map((l) => `${l}\n`).join('');
  return `${heading}${open}${head}${close}${note(best)}${tail(code.norm.length - rawEnd)}`;
}

// The dossier (makefun/dossier/v1) of an entry directory, as canonical JSON
// bytes: `dir/game/`'s sources and `dir/screenshots/`'s PNG and JPEG files
// (names starting with '.' skipped). `images` are the screenshots in name
// order, the first the cover; `text` is a "## Game" block then "## Sources",
// index.html first, then the source JS files in importOrder's order, then the
// other source files by path. The text holds at most caps.text_max_bytes
// UTF-8 bytes.
function buildDossier(dir, caps) {
  const max = caps.text_max_bytes;
  if (!Number.isSafeInteger(max) || max <= 0) throw new DossierError(`buildDossier: caps.text_max_bytes must be a positive integer, not ${String(max)}`, 'text_max_bytes');
  let maxImages = { n: DOSSIER_MAX_IMAGES, whose: 'a dossier holds' };
  let maxImageBytes = { n: DOSSIER_MAX_BYTES, whose: 'a dossier holds' };
  if (caps.screenshots !== undefined) {
    const s = caps.screenshots;
    if (typeof s !== 'object' || s === null) throw new DossierError('buildDossier: caps.screenshots must be an object {max, max_bytes}');
    for (const k of ['max', 'max_bytes']) {
      const v = s[k];
      if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) throw new DossierError(`buildDossier: caps.screenshots.${k} must be a positive integer, not ${String(v)}`, `screenshots.${k}`);
    }
    if (s.max < maxImages.n) maxImages = { n: s.max, whose: 'caps.screenshots.max allows' };
    if (s.max_bytes < maxImageBytes.n) maxImageBytes = { n: s.max_bytes, whose: 'caps.screenshots.max_bytes allows' };
  }
  const gameCaps = {};
  for (const k of ['game_max_files', 'game_max_bytes', 'game_path_max_bytes']) {
    const v = caps[k];
    if (v === undefined) continue;
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0) throw new DossierError(`buildDossier: caps.${k} must be a whole number, not ${String(v)}`, k);
    gameCaps[k] = v;
  }

  const gameDir = join(dir, 'game');
  const tree = readGameTree(gameDir, gameCaps);
  const htmlBytes = readIndexHtml(gameDir, tree);
  const html = htmlFacts(text(htmlBytes));

  const sources = tree.files.filter((f) => f.cls === 'source').map((f) => ({ path: f.path, bytes: new Uint8Array(readFileSync(join(gameDir, f.path))) }));
  const byPath = new Map(sources.map((s) => [s.path, s]));
  const ordered = importOrder(sources, html).filter((p) => p !== INDEX_HTML);
  const seen = new Set([INDEX_HTML, ...ordered]);
  const rest = sources.map((s) => s.path).filter((p) => !seen.has(p)).sort(byCodeUnit);
  const order = [INDEX_HTML, ...ordered, ...rest];

  const codes = new Map();
  const codeOf = (path) => {
    let code = codes.get(path);
    if (code !== undefined) return code;
    const file = byPath.get(path);
    if (file === undefined) return null;
    const t = text(file.bytes);
    const fence = fenceFor(t);
    const block = `${fence}${languageOf(path)}\n${t}${t.endsWith('\n') ? '' : '\n'}${fence}\n\n`;
    code = { norm: file.bytes, text: t, fence, block, blockBytes: byteLength(block), lines: lineCount(file.bytes) };
    codes.set(path, code);
    return code;
  };

  const shotNames = (() => {
    const shotsDir = join(dir, 'screenshots');
    let shotDirStat;
    try {
      shotDirStat = lstatSync(shotsDir);
    } catch {
      throw new DossierError('buildDossier: no screenshots/ directory: an entry hands in 3 or 4 renders of its game, the first by name the cover');
    }
    if (!shotDirStat.isDirectory()) throw new DossierError('buildDossier: screenshots is not a directory: an entry hands in 3 or 4 renders of its game, the first by name the cover');
    let names;
    try {
      names = readdirSync(shotsDir, { withFileTypes: true })
        .filter((e) => e.isFile() && !e.name.startsWith('.'))
        .map((e) => e.name)
        .sort(byCodeUnit);
    } catch (err) {
      throw new DossierError(`buildDossier: screenshots/ cannot be read (${err.message})`);
    }
    return names;
  })();
  if (shotNames.length === 0) throw new DossierError('buildDossier: screenshots/ holds no image: the first is the cover');
  if (shotNames.length > maxImages.n) throw new DossierError(`buildDossier: screenshots/ holds ${shotNames.length} files, over the ${maxImages.n} ${maxImages.whose}`, 'screenshots.max');
  const images = shotNames.map((name) => {
    if (!IMAGE_NAME.test(name)) throw new DossierError(`buildDossier: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters, not starting with . or -`);
    const size = lstatSync(join(dir, 'screenshots', name)).size;
    if (size > maxImageBytes.n) throw new DossierError(`buildDossier: screenshots/${name} is ${size} bytes, over the ${maxImageBytes.n} ${maxImageBytes.whose}`, 'screenshots.max_bytes');
    const bytes = new Uint8Array(readFileSync(join(dir, 'screenshots', name)));
    if (bytes.length > maxImageBytes.n) throw new DossierError(`buildDossier: screenshots/${name} is ${bytes.length} bytes, over the ${maxImageBytes.n} ${maxImageBytes.whose}`, 'screenshots.max_bytes');
    const media_type = opensWith(bytes, PNG_MAGIC) ? 'image/png' : opensWith(bytes, JPEG_MAGIC) ? 'image/jpeg' : null;
    if (media_type === null) throw new DossierError(`buildDossier: screenshots/${name} is neither a PNG nor a JPEG`);
    return { name, media_type, sha256: sha256Hex(bytes), base64: Buffer.from(bytes).toString('base64') };
  });

  const head = [...gameBlockLines(tree), '', '## Sources', '', ''].join('\n');
  const sections = order.map((path) => {
    const code = codeOf(path);
    const lines = code === null ? 0 : code.lines;
    const bytes = code === null ? 0 : code.norm.length;
    const heading = `### game/${path} (${lines} ${lines === 1 ? 'line' : 'lines'}, ${bytes} bytes)\n\n`;
    const shown = lines === 0 ? null : code;
    return { heading, code: shown, size: byteLength(heading) + (shown === null ? 0 : shown.blockBytes), bytes };
  });
  // restBytes[k]: the source bytes of the files after section k.
  const restBytes = new Array(sections.length + 1).fill(0);
  for (let k = sections.length - 1; k >= 0; k--) restBytes[k] = restBytes[k + 1] + (k + 1 < sections.length ? sections[k + 1].bytes : 0);

  const cutLine = (files, bytes) => `[Cut at ${max} bytes: ${files} file${files === 1 ? '' : 's'} and ${bytes} bytes of source left out.]\n`;
  let out = head;
  let used = byteLength(head);
  let kept = 0;
  for (; kept < sections.length; kept++) {
    const section = sections[kept];
    const restCount = sections.length - kept - 1;
    const tail = restCount === 0 ? 0 : byteLength(cutLine(restCount, restBytes[kept]));
    if (used + section.size + tail > max) break;
    out += section.code === null ? section.heading : `${section.heading}${section.code.block}`;
    used += section.size;
  }
  if (kept < sections.length) {
    // The first source that does not fit whole: its head, up to its last complete line that fits, then nothing more.
    const first = sections[kept];
    const restCount = sections.length - kept - 1;
    const after = restBytes[kept];
    const part = first.code === null ? null : sourceHead(first.heading, first.code, languageOf(order[kept]), max - used, (hidden) => cutLine(restCount, after + hidden));
    out += part ?? cutLine(restCount + 1, after + first.bytes);
  }
  if (byteLength(out) > max) throw new DossierError(`buildDossier: caps.text_max_bytes ${max} cannot hold even the Game block and the cut line`, 'text_max_bytes');

  const doc = { schema: DOSSIER_SCHEMA, cover: 0, text: out.replace(/\n+$/, '\n'), images };
  const bytes = Buffer.from(canonicalJson(doc), 'utf8');
  if (bytes.length > DOSSIER_MAX_BYTES) throw new DossierError(`buildDossier: the dossier is ${bytes.length} bytes, over the ${DOSSIER_MAX_BYTES} one holds`);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length);
}

// ------------------------------------------------------------------ hand it in

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in all,
// or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
