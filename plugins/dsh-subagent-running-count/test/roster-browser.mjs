// Browser test for dsh-subagent-running-count, roster part.
//
// Runs the SHIPPED bundle in real Chrome against the markup the shipped
// component actually produces, plus two variants that previously broke it:
//
//   A: every row wrapped in <div class="node">            <- REAL structure
//   B: rows as direct children of [role="tree"]           <- simplified
//   C: real structure with one row expanded (nested group)
//
// Catalog is fed in EVENT order (index 0 = oldest).
// Writes %TEMP%\roster.html; run:
//   chrome --headless=new --dump-dom file:///.../roster.html
import { readFileSync, writeFileSync } from 'node:fs';

const PLUGIN = process.env.USERPROFILE + '\\.dsh\\plugins\\dsh-subagent-running-count\\src\\client.js';
const bundle = readFileSync(PLUGIN, 'utf8');

const ROWS = 10;
const now = Date.now();
const entries = [];
for (let i = 0; i < ROWS; i += 1) {
  entries.push({
    id: 'sess-' + i,
    name: 'slug-' + i,
    label: 'Task number ' + i,
    mode: 'one-shot',
    activity: 'inactive',
    createdAt: now - (ROWS - i) * 60000,
  });
}

const rowHtml = (entry, extra = '') => `
  <div role="treeitem" aria-label="${entry.label}">
    <div></div>
    <span class="content"><span class="label">${entry.label}</span></span>
    <span class="metrics"><span>1M tok</span></span>
  </div>${extra}`;

const wrapped = (entry, extra = '') => `<div class="node">${rowHtml(entry, extra)}</div>`;

// A: real structure
const htmlA = entries.map((entry) => wrapped(entry)).join('');
// B: no wrapper
const htmlB = entries.map((entry) => rowHtml(entry)).join('');
// C: real structure, entry #9 expanded with two children
const childA = { id: 'c1', name: 'child-a', label: 'Child alpha', createdAt: now - 1000 };
const childB = { id: 'c2', name: 'child-b', label: 'Child beta', createdAt: now - 2000 };
const htmlC = entries.map((entry, index) => {
  if (index !== 9) return wrapped(entry);
  const children = `<div role="group">${wrapped(childA)}${wrapped(childB)}</div>`;
  return wrapped(entry, children);
}).join('');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>pending</title></head>
<body>
<div id="chipHost">
  <button type="button"><span data-subagent-count="true">${ROWS} 个子智能体</span></button>
  <span hidden="true">2 个子智能体，正在运行</span>
</div>
<div data-subagent-panel="A" role="dialog"><div role="tree">${htmlA}</div></div>
<div data-subagent-panel="B" role="dialog"><div role="tree">${htmlB}</div></div>
<div data-subagent-panel="C" role="dialog"><div role="tree">${htmlC}</div></div>
<pre id="out">PENDING</pre>
<script>
  window.__ModuleLoader__ = { load(registration) { window.__REG = registration; } };
  window.requestAnimationFrame = function (fn) { fn(); return 0; };
</script>
<script>
${bundle}
</script>
<script>
(async () => {
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const results = {};
  const labelOf = (node) => {
    if (!node) return null;
    const m = node.textContent.match(/Task number (\\d+)/);
    if (m) return m[1];
    const c = node.textContent.match(/Child (alpha|beta)/);
    return c ? c[1] : node.textContent.trim().slice(0, 12);
  };
  try {
    const catalogFiber = { memoizedProps: { catalog: { entries: __ENTRIES__ } }, return: null };
    document.querySelectorAll('[role="treeitem"]').forEach((row) => {
      row['__reactFiber$test'] = { memoizedProps: {}, return: catalogFiber };
    });

    const exportsObj = window.__REG.factory();
    exportsObj.apply({ effect(factory) { const d = factory(); return () => { if (typeof d === 'function') d(); }; } });

    results.chip = document.querySelector('[data-subagent-count]').textContent;

    for (const id of ['A', 'B', 'C']) {
      const panel = document.querySelector('[data-subagent-panel="' + id + '"]');
      const tree = panel.querySelector('[role="tree"]');
      // Top-level entries only: direct children of the tree container.
      const tops = [...tree.children];
      const order = tops.map((node) => labelOf(node)).filter((v) => v !== null);
      const visible = tops.filter((node) => node.style.display !== 'none')
        .map((node) => labelOf(node)).filter((v) => v !== null);
      const firstRow = panel.querySelector('[role="treeitem"]');
      const time = firstRow && firstRow.querySelector(':scope > .dsh-roster-time');
      const toggle = panel.querySelector('[data-dsh-roster-toggle]');
      results[id] = { order, visible, firstTime: time ? time.textContent : null, toggle: toggle ? toggle.textContent : null };
    }

    const toggleA = document.querySelector('[data-subagent-panel="A"] [data-dsh-roster-toggle]');
    if (toggleA) { toggleA.dispatchEvent(new MouseEvent('click', { bubbles: true })); await tick(); }
    const treeA = document.querySelector('[data-subagent-panel="A"] [role="tree"]');
    results.A_afterExpand = [...treeA.children].filter((n) => n.style.display !== 'none')
      .map((n) => labelOf(n)).filter((v) => v !== null);
    const toggleA2 = document.querySelector('[data-subagent-panel="A"] [data-dsh-roster-toggle]');
    results.A_toggleAfter = toggleA2 ? toggleA2.textContent : null;
  } catch (error) {
    results.error = String(error && error.stack ? error.stack : error);
  }
  document.getElementById('out').textContent = JSON.stringify(results);
  document.title = 'done';
})();
</script>
</body></html>`.replace('__ENTRIES__', JSON.stringify(entries));

const target = process.env.TEMP + '\\roster.html';
writeFileSync(target, html, 'utf8');
console.log(target);
