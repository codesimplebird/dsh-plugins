// Offline smoke test for dsh-subagent-running-count.
//
// Runs the SHIPPED bundle file against a hand-rolled DOM that mirrors the
// markup emitted by @deepseek-ai/dsh-client-ui-subagent in DSH 0.2.2-rc.5:
//
//   <div>                                  <- component root (fragment parent)
//     <button>                             <- trigger
//       <span aria-hidden>icon</span>
//       <span data-subagent-count>3 个子智能体</span>
//     </button>
//     <span hidden>2 个子智能体，正在运行</span>   <- only while runningCount > 0
//   </div>
//
// Covered cases: running > 0, running == 0 (hidden span absent), English UI,
// and React writing the original label back (observer re-applies).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Resolved relative to this file, so the test also works from the installed
// copy under <profile>/node_modules/<plugin>/test/.
const PLUGIN = fileURLToPath(new URL('../src/client.js', import.meta.url));
let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { pass += 1; console.log('  PASS  ' + name); }
  else { fail += 1; console.log('  FAIL  ' + name + '\n         expected: ' + JSON.stringify(expected) + '\n         actual  : ' + JSON.stringify(actual)); }
}

// ---------------------------------------------------------------- DOM shim
class El {
  constructor(tag, attrs = {}) {
    this.tagName = tag;
    this.attrs = { ...attrs };
    this.children = [];
    this.parentElement = null;
    this._text = '';
  }
  append(...nodes) {
    for (const node of nodes) {
      if (typeof node === 'string') { this._text += node; continue; }
      node.parentElement = this;
      this.children.push(node);
    }
    return this;
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((c) => c !== this);
    this.parentElement = null;
  }
  getAttribute(name) { return name in this.attrs ? this.attrs[name] : null; }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  get textContent() {
    return this.children.length === 0
      ? this._text
      : this.children.map((c) => c.textContent).join('') + this._text;
  }
  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }
  descendants() {
    const out = [];
    const walk = (node) => { for (const c of node.children) { out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  querySelectorAll(selector) {
    const scoped = selector.startsWith(':scope > ');
    const rest = scoped ? selector.slice(':scope > '.length) : selector;
    const pool = scoped ? this.children : this.descendants();
    return pool.filter((el) => matches(el, rest));
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

function matches(el, selector) {
  if (selector === '[data-subagent-count]') return 'data-subagent-count' in el.attrs;
  if (selector === 'span[hidden]') return el.tagName === 'span' && 'hidden' in el.attrs;
  return false;
}

const head = new El('head');
head.appendChild = function (node) { node.parentElement = this; this.children.push(node); return node; };

const globals = {
  document: {
    documentElement: { lang: 'zh-CN' },
    head,
    body: null,
    getElementById: () => null,
    querySelectorAll: (sel) => globals.document.body.querySelectorAll(sel),
  },
  requestAnimationFrame: (fn) => { fn(); return 1; },
  setTimeout: (fn) => { fn(); return 1; },
  MutationObserver: class {
    constructor(cb) { this.cb = cb; globals.lastObserver = this; }
    observe() {}
    disconnect() {}
  },
};

let captured = null;
globals.window = {
  __ModuleLoader__: {
    load(registration) { captured = registration; },
  },
};

// ------------------------------------------------------------- load bundle
const source = readFileSync(PLUGIN, 'utf8');
const run = new Function('window', 'document', 'requestAnimationFrame', 'setTimeout', 'MutationObserver', source);
run(globals.window, globals.document, globals.requestAnimationFrame, globals.setTimeout, globals.MutationObserver);

check('bundle registers one factory', captured !== null, true);
check('bundle id', captured && captured.id, 'dsh-subagent-running-count');

const exportsObj = captured.factory();
check('factory exports apply', typeof exportsObj.apply, 'function');

// ------------------------------------------------------------- build markup
function buildDom(lang, runningText) {
  const root = new El('div');
  const button = new El('button');
  const iconSlot = new El('span', { 'aria-hidden': 'true' });
  const chip = new El('span', { 'data-subagent-count': 'true' });
  chip.textContent = '3 个子智能体';
  button.append(iconSlot, chip);
  root.append(button);
  let hidden = null;
  if (runningText !== null) {
    hidden = new El('span', { hidden: 'true' });
    hidden.textContent = runningText;
    root.append(hidden);
  }
  globals.document.documentElement.lang = lang;
  globals.document.body = root;
  return { root, button, chip, hidden };
}

// ctx stub: effect() must run the factory and expose a disposer
const ctx = {
  effect(factory) {
    const disposer = factory();
    return () => { if (typeof disposer === 'function') disposer(); };
  },
};

function flush() {
  // apply() schedules one pass; the observer stub can force another.
  if (globals.lastObserver) globals.lastObserver.cb();
}

// ------------------------------------------------------------ case 1: zh, 2 running
console.log('\nCase 1: zh UI, 2 running (hidden span "2 个子智能体，正在运行")');
let dom = buildDom('zh-CN', '2 个子智能体，正在运行');
exportsObj.apply(ctx);
check('chip rewritten to running count', dom.chip.textContent, '2 个子智能体运行中');
check('chip attribute untouched', dom.chip.getAttribute('data-subagent-count'), 'true');
check('original total replaced', dom.chip.textContent.includes('3 个子智能体'), false);

// ------------------------------------------------------------ case 2: React writes back
console.log('\nCase 2: React re-renders the original label, observer restores ours');
dom.chip.textContent = '3 个子智能体';
flush();
check('rewrite re-applied after re-render', dom.chip.textContent, '2 个子智能体运行中');

// ------------------------------------------------------------ case 3: zh, 0 running
console.log('\nCase 3: zh UI, nothing running (hidden span absent)');
dom = buildDom('zh-CN', null);
exportsObj.apply(ctx);
check('label cleared when nothing runs', dom.chip.textContent, '');
check('no "0" shown', dom.chip.textContent.includes('0'), false);

// ------------------------------------------------------------ case 4: re-render at zero
console.log('\nCase 4: React re-renders total while nothing runs');
dom.chip.textContent = '3 个子智能体';
flush();
check('label cleared again', dom.chip.textContent, '');

// ------------------------------------------------------------ case 5: en UI
console.log('\nCase 5: en UI, 1 running');
dom = buildDom('en-US', '1 subagent, running');
exportsObj.apply(ctx);
check('english singular', dom.chip.textContent, '1 subagent running');

// ------------------------------------------------------------ case 6: unrelated DOM
console.log('\nCase 6: no chip on the page does not throw');
globals.document.body = new El('div');
let threw = null;
try { exportsObj.apply(ctx); } catch (error) { threw = error; }
check('apply is safe with no chip', threw, null);

console.log('\n=== ' + pass + ' passed, ' + fail + ' failed ===');
process.exit(fail === 0 ? 0 : 1);

