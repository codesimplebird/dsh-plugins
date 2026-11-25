// Headless test for the session-header model badge (dsh-session-model).
//
// Loads the shipped bundle with a minimal React/ctx stub, drives the test
// seam, and reports the resolved badge state for:
//   - projection-only sessions (subagent path: no model directory)
//   - pending vs lastUsed selection precedence
//   - live updates through the projection subscription
//   - friendly names from the shared model directory
//   - a missing/blank projection hiding the badge
//
// Writes %TEMP%\dsm-badge.html; run:
//   chrome --headless=new --dump-dom file:///.../dsm-badge.html
import { readFileSync, writeFileSync } from 'node:fs'

const PLUGIN = new URL('../src/client.js', import.meta.url)
const bundle = readFileSync(PLUGIN, 'utf8')

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>pending</title></head>
<body>
<pre id="out">PENDING</pre>
<script>
  window.__DSM_TEST__ = {};
  window.__ModuleLoader__ = { load(registration) { window.__REG = registration; } };
  window.requestAnimationFrame = (fn) => { fn(); return 0; };
</script>
<script>
${bundle}
</script>
<script>
(() => {
  const results = {};
  try {
    const React = {
      createElement: () => null,
      useState: (value) => [value, () => {}],
      useEffect: () => {},
    };
    const requireStub = (name) => {
      if (name === 'react') return React;
      throw new Error('unexpected require ' + name);
    };

    // One switchable projection face: {lastUsed, pending} + listeners.
    const makeFace = (initial) => {
      const state = Object.assign({ lastUsed: null, pending: null }, initial);
      const listeners = new Set();
      return {
        state,
        face: {
          getSnapshot: () => JSON.parse(JSON.stringify(state)),
          subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
        },
        emit() { for (const fn of listeners) fn(); },
      };
    };

    const makeCtx = ({ face = null, directory = null } = {}) => {
      const captured = {};
      const ctx = {
        locale: { register: () => () => {} },
        effect: (fn) => { try { fn(); } catch (e) {} return () => {}; },
        slots: {
          inject: (name, factory) => {
            captured.slotName = name;
            captured.register = factory;
            try { captured.registered = factory(); } catch (e) { captured.error = String(e); }
          },
          register: (args, Component) => { captured.args = args; captured.Component = Component; return { name: args.name }; },
        },
        sessions: {
          binding: (sessionId) => {
            if (face === null) throw new Error('no binding');
            return { session: { projections: { faceOf: () => face } } };
          },
        },
        get: (name) => (name === 'modelDirectories' && directory !== null ? directory : undefined),
        captured,
      };
      return ctx;
    };

    const load = (ctx) => {
      const exportsObj = window.__REG.factory(requireStub);
      exportsObj.apply(ctx);
      return exportsObj;
    };

    const seam = window.__DSM_TEST__;

    // --- 1. registration ---
    const ctxA = makeCtx({ face: makeFace({}).face });
    load(ctxA);
    results.seam = ['pickSelection', 'modelLabel', 'badgeText', 'badgeTitle', 'createModelSource']
      .every((key) => typeof seam[key] === 'function');
    results.slotName = ctxA.captured.slotName;
    results.slotRegistered = results.slotName === 'conversation.session.header.utilities';
    results.slotId = ctxA.captured.args && ctxA.captured.args.id;
    results.slotOrder = ctxA.captured.args && ctxA.captured.args.order;
    results.slotLocale = ctxA.captured.args && ctxA.captured.args.locale;
    results.component = typeof ctxA.captured.Component;

    // --- 2. projection only (subagent-style session) ---
    const projA = makeFace({
      lastUsed: { provider: 'opencode-go', model: 'deepseek-v4.1-flash', reasoningEffort: 'max' },
    });
    const ctxB = makeCtx({ face: projA.face });
    load(ctxB);
    const injectedB = ctxB.captured.args.inject('sub-session-1');
    const sourceB = injectedB.model;
    const snapB = sourceB.getSnapshot();
    results.projectionOnly = JSON.stringify(snapB.selection)
      === JSON.stringify({ provider: 'opencode-go', model: 'deepseek-v4.1-flash', reasoningEffort: 'max' });
    results.projectionText = seam.badgeText(snapB.selection, snapB.groups, snapB.retainedEffort);
    results.projectionTextOk = results.projectionText === 'deepseek-v4.1-flash · max';
    results.projectionGroupsNull = snapB.groups === null;

    // --- 3. live switch: later selection replaces the text ---
    const updates = [];
    sourceB.subscribe(() => updates.push(sourceB.getSnapshot().selection));
    projA.state.lastUsed = { provider: 'deepseek-account', model: 'deepseek-flash' };
    projA.emit();
    results.liveUpdateCount = updates.length;
    results.liveSelection = updates.length > 0 ? updates[updates.length - 1] : null;

    // --- 4. pending wins over lastUsed ---
    projA.state.pending = { provider: 'opencode-go', model: 'hy4-preview', reasoningEffort: 'high' };
    results.pendingSelection = sourceB.getSnapshot().selection;
    results.pendingText = seam.badgeText(sourceB.getSnapshot().selection, null, null);
    results.pendingWins = results.pendingSelection.model === 'hy4-preview';

    // --- 5. friendly names from the shared model directory ---
    const directoryState = {
      current: { provider: 'opencode-go', model: 'deepseek-v4.1-flash', reasoningEffort: 'max' },
      groups: [{
        id: 'opencode-go',
        name: 'opencode Go',
        models: [{ id: 'deepseek-v4.1-flash', name: 'Deepseek-V4.1-Flash' }],
      }],
      retainedEffort: 'Max',
    };
    const storeListeners = new Set();
    const store = {
      getSnapshot: () => JSON.parse(JSON.stringify(directoryState)),
      subscribe: (fn) => { storeListeners.add(fn); return () => { storeListeners.delete(fn); }; },
    };
    const dirCtx = makeCtx({
      directory: { directoryFor: () => ({ store }) },
    });
    load(dirCtx);
    const injectedDir = dirCtx.captured.args.inject('main-session-1');
    const snapDir = injectedDir.model.getSnapshot();
    results.directorySelection = snapDir.selection;
    results.directoryText = seam.badgeText(snapDir.selection, snapDir.groups, snapDir.retainedEffort);
    results.directoryTitle = seam.badgeTitle(snapDir.selection, snapDir.groups, snapDir.retainedEffort, { title: '当前会话使用的模型' });
    results.directoryFriendly = results.directoryText === 'Deepseek-V4.1-Flash · max';
    results.directoryTitleOk = results.directoryTitle.includes('opencode Go / Deepseek-V4.1-Flash');
    directoryState.current = { provider: 'deepseek-account', model: 'deepseek-flash' };
    for (const fn of storeListeners) fn();
    results.directoryLiveUpdate = injectedDir.model.getSnapshot().selection.model === 'deepseek-flash';

    // --- 6. blank projection hides the badge ---
    const blankCtx = makeCtx({ face: makeFace({}).face });
    load(blankCtx);
    const blankSource = blankCtx.captured.args.inject('blank-session');
    const blankSnap = blankSource.model.getSnapshot();
    results.blankSelection = blankSnap.selection;
    results.blankHidden = blankSnap.selection === null && seam.badgeText(null, null, null) === null;

    // --- 7. malformed projection is ignored ---
    results.malformedIgnored = seam.pickSelection({ lastUsed: { provider: '', model: 42 }, pending: null }) === null;
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

const target = process.env.TEMP + '\\dsm-badge.html'
writeFileSync(target, html, 'utf8')
console.log(target)
