// Headless test for the "任务总用时" footer annotation in dsh-turn-tps.
//
// Builds a footer row that mirrors what @deepseek-ai/dsh-client-ui-chat emits
// (action buttons + usage trigger + clock), applies the shipped bundle with a
// minimal React/ctx stub, drives the test seam, and reports the DOM result.
//
// Writes %TEMP%\tps-footer.html; run:
//   chrome --headless=new --dump-dom file:///.../tps-footer.html
import { readFileSync, writeFileSync } from 'node:fs';

const PLUGIN = 'C:\\dev\\dsh-optimize\\plugins\\dsh-turn-tps\\src\\client.js';
const bundle = readFileSync(PLUGIN, 'utf8');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>pending</title></head>
<body>
<div id="message">
  <div class="BI5uFG_footer" id="row">
    <button type="button" aria-haspopup="dialog">复制</button>
    <button type="button" aria-haspopup="dialog">赞</button>
    <span class="BI5uFG_root">
      <button type="button" aria-haspopup="dialog" aria-expanded="false">
        <svg width="15" height="15"></svg>
        <span class="BI5uFG_label">用量 1.4M tok</span>
      </button>
    </span>
    <span class="clock">11月20日 23:24</span>
  </div>
</div>
<pre id="out">PENDING</pre>
<script>
  window.__DTT_TEST__ = {};
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
  try {
    const noop = () => {};
    const React = {
      createElement: () => null, useState: () => [false, noop], useRef: () => ({ current: null }),
      useEffect: noop, useCallback: (fn) => fn, useLayoutEffect: noop, useMemo: (fn) => fn(),
    };
    const requireStub = (name) => {
      if (name === 'react') return React;
      if (name === 'react-dom') return { createPortal: (node) => node };
      throw new Error('unexpected require ' + name);
    };
    const ctx = {
      locale: { register: () => () => {} },
      slots: { inject: () => {}, register: () => ({}) },
      effect: (fn) => { const d = fn(); return () => { if (typeof d === 'function') d(); }; },
      uiConversation: undefined,
    };
    const exportsObj = window.__REG.factory(requireStub);
    exportsObj.apply(ctx);

    const api = window.__DTT_TEST__;
    results.seam = typeof api.setTaskTime;
    results.before = document.querySelector('[data-dtt-task-time]')?.textContent ?? null;

    // 1h 2m 3s of summed turn wall time
    api.setTaskTime(3723000);
    await tick();
    const node = document.querySelector('[data-dtt-task-time]');
    results.after = node ? node.textContent : null;
    results.parentIsMessage = node ? node.parentElement === document.getElementById('row').parentElement : false;
    results.afterRow = node && node.previousElementSibling
      ? node.previousElementSibling.id || node.previousElementSibling.className
      : null;
    results.styleDisplay = node ? getComputedStyle(node).display : null;

    // React re-render wipes it: the observer path must put it back.
    if (node) node.remove();
    api.syncTaskTime();
    await tick();
    results.restored = document.querySelector('[data-dtt-task-time]')?.textContent ?? null;

    // A second footer appears; only the newest one is annotated.
    const clone = document.getElementById('message').cloneNode(true);
    clone.id = 'message2';
    clone.querySelector('[data-dtt-task-time]')?.remove();
    document.body.appendChild(clone);
    api.syncTaskTime();
    await tick();
    results.countAfterSecondFooter = document.querySelectorAll('[data-dtt-task-time]').length;
    const all = [...document.querySelectorAll('[data-dtt-task-time]')];
    results.attachedToNewest = all.length === 1
      ? all[0].closest('#message2') !== null
      : null;

    // No data clears the annotation.
    api.setTaskTime(null);
    await tick();
    results.afterNull = document.querySelectorAll('[data-dtt-task-time]').length;
  } catch (error) {
    results.error = String(error && error.stack ? error.stack : error);
  }
  document.getElementById('out').textContent = JSON.stringify(results);
  document.title = 'done';
})();
</script>
</body></html>`;

const target = process.env.TEMP + '\\tps-footer.html';
writeFileSync(target, html, 'utf8');
console.log(target);
