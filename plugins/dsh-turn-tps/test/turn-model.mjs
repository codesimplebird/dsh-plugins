// Headless test for the per-Turn model label added by dsh-turn-tps (v0.4.4).
//
// Mirrors the real assistant footer structure:
//   <div class="root">                          flex column
//     <div class="actions" data-clock="end">    the official actions row
//       <button copy> …
//       <span class="endInfo">
//         <span class="usage"><button aria-haspopup="dialog">用量 9.4M tok</button></span>
//         <span class="timeEnd">22:12</span>
//       </span>
//     </div>
//   </div>
// and fakes the React fiber chain the official TurnTailNodeView / TurnUsagePanel
// carry (`node.data.tokenUsage.routes` / `usage.routes`), which is the only
// reachable source for the per-Turn model on the client.
//
// Writes %TEMP%\tps-turn-model.html; run:
//   chrome --headless=new --dump-dom file:///.../tps-turn-model.html
import { readFileSync, writeFileSync } from 'node:fs'

const PLUGIN = new URL('../src/client.js', import.meta.url)
const bundle = readFileSync(PLUGIN, 'utf8')

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>pending</title></head>
<body>
<div id="msg">
  <div class="root">
    <div class="actions" id="row" data-clock="end">
      <button type="button" aria-haspopup="dialog" aria-label="复制">复制</button>
      <span class="endInfo">
        <span class="usage"><button type="button" aria-haspopup="dialog"><span>用量 9.4M tok</span></button></span>
        <span class="timeEnd" id="clock">22:12</span>
      </span>
    </div>
  </div>
</div>
<div id="msg2">
  <div class="root">
    <div class="actions" id="row2" data-clock="end">
      <button type="button" aria-haspopup="dialog" aria-label="复制">复制</button>
      <span class="endInfo">
        <span class="usage"><button type="button" aria-haspopup="dialog"><span>用量 1 tok</span></button></span>
        <span class="timeEnd" id="clock2">22:13</span>
      </span>
    </div>
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
(function () {
  const results = {};
  try {
    const noop = () => {};
    const React = {
      createElement: () => null,
      useState: (value) => [value, noop],
      useEffect: noop,
      useCallback: (fn) => fn,
      useLayoutEffect: noop,
      useRef: () => ({ current: null }),
      useMemo: (fn) => fn(),
    };
    const requireStub = (name) => {
      if (name === 'react') return React;
      if (name === 'react-dom') return { createPortal: (node) => node };
      throw new Error('unexpected require ' + name);
    };
    const ctx = {
      locale: { register: () => noop },
      slots: { inject: () => {}, register: () => ({}) },
      effect: (fn) => { try { fn(); } catch (e) {} return noop; },
      uiConversation: undefined,
    };
    const exportsObj = window.__REG.factory(requireStub);
    exportsObj.apply(ctx);

    // Fake fiber chain: host fiber → TurnTailNodeView fiber carrying node.data.tokenUsage.
    let turnTailFiber = null;
    function installFiber(element, routesRef) {
      turnTailFiber = {
        memoizedProps: {
          node: { kind: 'turn-tail', data: { tokenUsage: routesRef() } },
        },
        return: null,
      };
      element['__reactFiber$dttTest'] = { memoizedProps: {}, return: turnTailFiber };
    }
    function refreshFiber() {
      turnTailFiber.memoizedProps.node.data.tokenUsage = currentRoutes();
    }

    const routesA = () => ({
      routes: [{ provider: 'opencode-go', model: 'deepseek-v4.1-flash' }],
    });
    const routesB = () => ({
      routes: [
        { provider: 'deepseek-account', model: 'deepseek-flash' },
        { provider: 'opencode-go', model: 'deepseek-v4.1-flash' },
      ],
    });
    let currentRoutes = routesA;
    installFiber(document.getElementById('row'), () => currentRoutes());

    const api = window.__DTT_TEST__;
    api.syncTurnModels(true);
    results.seam = ['syncTurnModels', 'formatTurnRoutes'].every((key) => typeof api[key] === 'function');
    results.formatDedup = api.formatTurnRoutes([
      { provider: 'p', model: 'm' },
      { provider: 'p', model: 'm' },
      { provider: 'p2', model: 'm2' },
    ]) === 'p/m, p2/m2';
    results.formatEmpty = api.formatTurnRoutes([]) === null;

    // The initial apply() already stamped row 1 (force pass).
    const labelOf = (row) => row.querySelector('[data-dtt-turn-model]');
    const label1 = labelOf(document.getElementById('row'));
    results.labelInserted = !!label1;
    results.labelText = label1 ? label1.textContent : null;
    results.labelTextOk = results.labelText === 'opencode-go/deepseek-v4.1-flash';
    results.labelAfterClock = !!label1
      && label1.previousElementSibling === document.getElementById('clock')
      && label1.parentElement.className === 'endInfo';
    results.labelTitle = label1 ? label1.title : null;
    results.labelTitleOk = !!label1 && label1.title.startsWith('模型: ');

    // Second footer with no fiber: must stay untouched.
    results.secondRowClean = labelOf(document.getElementById('row2')) === null;

    // A different Turn (multi-route) replaces the text on the next pass.
    currentRoutes = routesB;
    refreshFiber();
    api.syncTurnModels(true);
    const label2 = labelOf(document.getElementById('row'));
    results.updatedText = label2 ? label2.textContent : null;
    results.updatedOk = results.updatedText === 'deepseek-account/deepseek-flash, opencode-go/deepseek-v4.1-flash';
    results.singleLabel = document.querySelectorAll('#row [data-dtt-turn-model]').length === 1;

    // No routes for this Turn: the label disappears.
    currentRoutes = () => undefined;
    refreshFiber();
    api.syncTurnModels(true);
    results.removedWhenMissing = labelOf(document.getElementById('row')) === null;
  } catch (error) {
    results.error = String(error && error.stack ? error.stack : error);
  }
  const flags = Object.entries(results).filter(([, value]) => typeof value === 'boolean');
  results.ALL_PASS = flags.every(([, value]) => value === true);
  document.getElementById('out').textContent = JSON.stringify(results, null, 1);
  document.title = 'done';
})();
</script>
</body></html>`

const target = process.env.TEMP + '\\tps-turn-model.html'
writeFileSync(target, html, 'utf8')
console.log(target)
