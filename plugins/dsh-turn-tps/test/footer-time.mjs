// Headless test for the "任务总用时" footer annotation in dsh-turn-tps.
//
// The DOM mirrors the real @deepseek-ai/dsh-client-ui-chat markup
// (src/client/chat/MessageIconActions.tsx + TurnTailNodeView.tsx):
//
//   .TurnTailNodeView_root            flex column, gap 16px, data-turn-tail
//     [turnTail slot content]
//     .MessageIconActions_actions     flex row, height 28px, data-clock="end"
//       <button copy/> <button branch/>
//       .MessageIconActions_endInfo   inline-flex
//         .TurnUsagePanel_root > button[aria-haspopup="dialog"]  用量 1.4M tok
//         .MessageIconActions_timeEnd                            15:05
//
// A second, legacy fixture without data-clock verifies the textual fallback
// still inserts on its own line.
//
// The baseline suite (v0.4.2) drives setTurns()/setSession()/getBaseline():
// reset counts from the current turn, later turns count in full, restore goes
// back to the whole session, and the reset point is persisted per Session.
//
// Writes %TEMP%\tps-footer.html; run:
//   node plugins\dsh-turn-tps\test\footer-time.mjs
//   chrome --headless=new --dump-dom --virtual-time-budget=3000 file:///.../tps-footer.html
import { readFileSync, writeFileSync } from 'node:fs';

const PLUGIN = 'C:\\dev\\dsh-optimize\\plugins\\dsh-turn-tps\\src\\client.js';
const bundle = readFileSync(PLUGIN, 'utf8');

const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>pending</title>
<style>
  /* Values mirror docs/web-styling tokens; the font-size variable is
     deliberately unlike the plugin's 12px fallback so a copy of the clock
     typography is distinguishable from the fallback. */
  :root {
    --dsh-content-font-size-secondary: 14px;
    --dsh-content-font-delta: 0px;
    --dsw-alias-label-tertiary: #8a8d93;
  }
  body { margin: 8px; font-family: sans-serif; font-size: 14px; }
  #message { display: flex; flex-direction: column; }
  .TurnTailNodeView_root { display: flex; flex-direction: column; gap: 16px; width: 640px; }
  .TurnTailNodeView_tail { height: 20px; }
  .MessageIconActions_actions {
    display: flex; align-items: center; gap: 8px;
    height: calc(28px + var(--dsh-content-font-delta, 0px));
    margin-top: 4px; margin-left: -6px;
  }
  .MessageIconActions_endInfo {
    display: inline-flex; align-items: center; gap: 8px; min-width: 0;
    margin-left: 8px; color: var(--dsw-alias-label-tertiary);
  }
  .MessageIconActions_timeEnd {
    font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
    line-height: calc(24px + var(--dsh-content-font-delta, 0px));
    color: inherit; white-space: nowrap;
  }
  .TurnUsagePanel_root { display: inline-flex; min-width: 0; }
  .TurnUsagePanel_trigger {
    display: inline-flex; align-items: center; gap: 4px; height: 28px;
    padding: 6px 8px; border: 0; background: transparent;
    color: var(--dsw-alias-label-tertiary);
    font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
    line-height: 24px; font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  #message3 { display: flex; flex-direction: column; }
  .legacyRow { display: flex; align-items: center; gap: 8px; height: 28px; }
  .legacyClock { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
</style>
</head>
<body>
<div id="message">
  <div id="root" class="TurnTailNodeView_root" data-turn-tail="7" data-actions-reveal="always">
    <div class="TurnTailNodeView_tail">工具调用摘要</div>
    <div id="actions" class="MessageIconActions_actions TurnTailNodeView_actions" data-clock="end">
      <button type="button" aria-label="复制">复制</button>
      <button type="button" aria-label="分支">分支</button>
      <span class="MessageIconActions_endInfo">
        <span class="TurnUsagePanel_root">
          <button type="button" class="TurnUsagePanel_trigger" aria-haspopup="dialog" aria-expanded="false">
            <svg width="15" height="15"></svg>
            <span class="TurnUsagePanel_label">用量 1.4M tok</span>
          </button>
        </span>
        <span class="MessageIconActions_timeEnd" id="clock">15:05</span>
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
(async () => {
  const tick = () => new Promise((r) => setTimeout(r, 5));
  const results = {};
  const byId = (id) => document.getElementById(id);
  const rectTop = (el) => el.getBoundingClientRect().top;
  const rectBottom = (el) => el.getBoundingClientRect().bottom;
  const PREFIX = 'dsh-turn-tps:task-baseline:';
  // The real annotation is <div data-dtt-task-time><span.dtt-task-text/><button.dtt-task-reset/></div>;
  // these helpers read the text part, not the button label.
  const taskNode = () => document.querySelector('[data-dtt-task-time]');
  const taskTextOf = (node) => (node ? (node.querySelector('.dtt-task-text')?.textContent ?? null) : null);
  const taskButton = () => (taskNode() ? taskNode().querySelector('.dtt-task-reset') : null);
  const readBaseline = () => {
    try { return window.__DTT_TEST__.getBaseline(); } catch (e) { return 'threw:' + e; }
  };
  let storage = null;
  try {
    storage = window.localStorage;
    storage.clear();
  } catch (error) {
    storage = null;
  }
  try {
    let bubbleClicks = 0;
    const noop = () => {};
    const slotRegistrations = [];
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
      slots: {
        inject: (name, factory) => { slotRegistrations.push({ name, value: factory() }); },
        register: (options) => options,
      },
      effect: (fn) => { const d = fn(); return () => { if (typeof d === 'function') d(); }; },
      uiConversation: undefined,
    };
    const exportsObj = window.__REG.factory(requireStub);
    exportsObj.apply(ctx);

    const api = window.__DTT_TEST__;
    results.seam = typeof api.setTaskTime;
    results.baselineSeams = ['setTurns', 'setSession', 'getBaseline']
      .every((key) => typeof api[key] === 'function');
    results.storageAvailable = storage !== null;

    // ---- production inject path: the slot hands the Session id over ----
    // Seed a stored reset point first, then let the registered inject callback
    // reveal that Session; the annotation must adopt it.
    if (storage) storage.setItem(PREFIX + 'inject-session', JSON.stringify({ baseIndex: 0, baseWall: 60000 }));
    const registration = slotRegistrations[0];
    results.slotRegistered = !!(registration && registration.value && typeof registration.value.inject === 'function');
    let injected = null;
    try { injected = registration.value.inject('inject-session'); } catch (e) { injected = null; }
    results.injectHooks = !!(injected && injected.hooks && injected.hooks.turnStats);
    results.injectLoadsBaseline = JSON.stringify(readBaseline()) === JSON.stringify({ baseIndex: 0, baseWall: 60 });
    api.setSession(null);
    if (storage) storage.removeItem(PREFIX + 'inject-session');

    results.before = taskTextOf(taskNode());

    // ---- real structure: annotation must go under the actions row ----
    // 1h 2m 3s of summed turn wall time
    api.setTaskTime(3723000);
    await tick();
    const node = taskNode();
    const actionsRow = byId('actions');
    const clock = byId('clock');
    results.after = taskTextOf(node);
    results.insertParentIsRoot = node ? (node.parentElement.id === 'root'
      || /TurnTailNodeView_root/.test(node.parentElement.className)) : false;
    results.notInsideActions = node ? node.closest('[data-clock]') === null : false;
    results.afterActionsRow = node ? node.previousElementSibling === actionsRow : false;
    results.belowRow = node && actionsRow
      ? rectTop(node) >= rectBottom(actionsRow) - 1
      : false;
    results.fontMatchesClock = node && clock
      ? getComputedStyle(node).fontSize === getComputedStyle(clock).fontSize
      : false;
    results.nodeFontSize = node ? getComputedStyle(node).fontSize : null;
    results.clockFontSize = clock ? getComputedStyle(clock).fontSize : null;
    results.gapPx = node && actionsRow
      ? Math.round((rectTop(node) - rectBottom(actionsRow)) * 100) / 100
      : null;
    results.display = node ? getComputedStyle(node).display : null;

    // React re-render wipes it: the observer path must put it back.
    if (node) node.remove();
    api.syncTaskTime();
    await tick();
    const restored = taskNode();
    results.restored = taskTextOf(restored);
    results.restoredBelowRow = restored && actionsRow
      ? rectTop(restored) >= rectBottom(actionsRow) - 1
      : false;

    // A second footer appears; only the newest one is annotated. The tick lets
    // the MutationObserver invalidate the cached placement first, so this also
    // covers the observer-driven path.
    const clone = document.getElementById('message').cloneNode(true);
    clone.id = 'message2';
    clone.querySelector('[data-dtt-task-time]')?.remove();
    document.body.appendChild(clone);
    await tick();
    api.syncTaskTime();
    results.countAfterSecondFooter = document.querySelectorAll('[data-dtt-task-time]').length;
    const all = [...document.querySelectorAll('[data-dtt-task-time]')];
    results.attachedToNewest = all.length === 1
      ? all[0].closest('#message2') !== null
      : null;

    // ---- legacy fallback: no data-clock, row's parent is a flex column ----
    const legacy = document.createElement('div');
    legacy.id = 'message3';
    legacy.innerHTML = [
      '<div id="legacyRow" class="legacyRow">',
      '  <button type="button" aria-label="复制">复制</button>',
      '  <span class="legacyUsage"><button type="button" aria-haspopup="dialog" aria-expanded="false">用量 1.4M tok</button></span>',
      '  <span class="legacyClock" id="legacyClock">11月20日 23:24</span>',
      '</div>',
    ].join('');
    document.body.appendChild(legacy);
    await tick();
    api.syncTaskTime();
    const legacyNode = taskNode();
    const legacyRow = byId('legacyRow');
    const legacyClock = byId('legacyClock');
    results.fallbackInsertParentIsMessage = legacyNode ? legacyNode.parentElement === legacy : false;
    results.fallbackAfterRow = legacyNode ? legacyNode.previousElementSibling === legacyRow : false;
    results.fallbackBelowRow = legacyNode && legacyRow
      ? rectTop(legacyNode) >= rectBottom(legacyRow) - 1
      : false;
    results.fallbackAttachedToNewest = legacyNode ? legacyNode.closest('#message3') !== null : false;
    results.fallbackFontMatchesClock = legacyNode && legacyClock
      ? getComputedStyle(legacyNode).fontSize === getComputedStyle(legacyClock).fontSize
      : false;

    // No data clears the annotation.
    api.setTaskTime(null);
    await tick();
    results.afterNull = document.querySelectorAll('[data-dtt-task-time]').length;

    // ---- baseline suite: reset / increment / later turns / restore ----
    api.setSession('dtt-session-a');
    api.setTurns([60, 60, 60]);
    await tick();
    const initialNode = taskNode();
    const initialText = taskTextOf(initialNode);
    const initialButton = taskButton();
    results.initialStructure = !!(initialNode
      && initialNode.firstElementChild?.classList.contains('dtt-task-text')
      && initialNode.lastElementChild?.classList.contains('dtt-task-reset'));
    results.initialText = initialText;
    results.initialTextIsThreeMinutes = typeof initialText === 'string' && initialText.includes('3 分 0 秒');
    results.initialTextHasNoSuffix = typeof initialText === 'string' && !initialText.includes('自本轮起');
    results.initialButtonReset = !!initialButton && initialButton.textContent === '重置';
    results.initialButtonTitle = !!initialButton && initialButton.getAttribute('title') === '从当前这一轮开始累计';
    results.initialButtonType = !!initialButton && initialButton.getAttribute('type') === 'button';
    const featureStyle = document.getElementById('dsh-turn-tps-style');
    results.resetHoverRule = !!featureStyle && featureStyle.textContent.includes('dtt-task-reset:hover');
    const buttonStyle = initialButton ? getComputedStyle(initialButton) : null;
    results.resetButtonStyle = !!buttonStyle
      && buttonStyle.cursor === 'pointer'
      && (buttonStyle.backgroundColor === 'rgba(0, 0, 0, 0)' || buttonStyle.backgroundColor === 'transparent')
      && buttonStyle.borderTopWidth === '0px'
      && buttonStyle.borderLeftWidth === '0px'
      && buttonStyle.marginLeft === '8px'
      && buttonStyle.paddingLeft === '0px'
      && buttonStyle.textDecorationLine === 'none'
      && Number.parseFloat(buttonStyle.opacity) === 0.7;
    // Themes restyle every <button>; the live look rides on inline !important.
    results.resetButtonInlineImportant = !!initialButton
      && initialButton.style.getPropertyPriority('background-color') === 'important'
      && initialButton.style.getPropertyPriority('font-size') === 'important'
      && initialButton.style.getPropertyPriority('border') === 'important'
      && initialButton.style.getPropertyPriority('box-shadow') === 'important';
    const textSpan = initialNode ? initialNode.querySelector('.dtt-task-text') : null;
    results.resetButtonFontInherits = !!buttonStyle && !!textSpan
      && getComputedStyle(textSpan).fontSize === buttonStyle.fontSize
      && getComputedStyle(textSpan).lineHeight === buttonStyle.lineHeight;
    initialButton.dispatchEvent(new MouseEvent('mouseenter'));
    results.resetHoverOn = Number.parseFloat(getComputedStyle(initialButton).opacity) === 1
      && getComputedStyle(initialButton).textDecorationLine.includes('underline');
    initialButton.dispatchEvent(new MouseEvent('mouseleave'));
    results.resetHoverOff = Number.parseFloat(getComputedStyle(initialButton).opacity) === 0.7;

    // Click "重置": the row must not also trigger copy/share handlers.
    const countBubbleClick = () => { bubbleClicks += 1; };
    document.addEventListener('click', countBubbleClick);
    initialButton.click();
    document.removeEventListener('click', countBubbleClick);
    await tick();
    const resetText = taskTextOf(taskNode());
    const resetButton = taskButton();
    const resetBaseline = readBaseline();
    results.resetClickIsolated = bubbleClicks === 0;
    results.resetText = resetText;
    results.resetTextIsZero = typeof resetText === 'string' && resetText.includes('0 秒');
    results.resetHasSuffix = typeof resetText === 'string' && resetText.includes('· 自本轮起');
    results.resetButtonRestore = !!resetButton && resetButton.textContent === '恢复';
    results.resetButtonTitle = !!resetButton && resetButton.getAttribute('title') === '恢复为整个会话累计';
    results.resetBaselineState = JSON.stringify(resetBaseline) === JSON.stringify({ baseIndex: 2, baseWall: 60 });
    results.resetStoredKey = !!(storage && storage.getItem(PREFIX + 'dtt-session-a') !== null);
    let storedBaseline = null;
    try { storedBaseline = JSON.parse(storage.getItem(PREFIX + 'dtt-session-a')); } catch (e) { storedBaseline = null; }
    results.resetStoredShape = !!storedBaseline
      && storedBaseline.baseIndex === 2
      && storedBaseline.baseWall === 60000;
    results.resetStillUnderRow = !!taskNode() && taskNode().previousElementSibling === byId('legacyRow');

    // Current turn grows 60s -> 120s: only the +60s delta counts.
    api.setTurns([60, 60, 120]);
    await tick();
    const incrementText = taskTextOf(taskNode());
    results.incrementText = incrementText;
    results.incrementIsOneMinute = typeof incrementText === 'string' && incrementText.includes('1 分 0 秒');

    // A later turn counts in full: 60 (delta) + 180 (new turn).
    api.setTurns([60, 60, 120, 180]);
    await tick();
    const laterText = taskTextOf(taskNode());
    results.laterTurnsText = laterText;
    results.laterTurnsIsFourMinutes = typeof laterText === 'string' && laterText.includes('4 分 0 秒');

    // Baseline is per Session: another Session starts clean and counts all.
    api.setSession('dtt-session-b');
    results.otherSessionBaseline = readBaseline();
    results.otherSessionIsClean = readBaseline() === null;
    api.setTurns([60, 60, 120, 180]);
    await tick();
    const otherSessionText = taskTextOf(taskNode());
    results.otherSessionText = otherSessionText;
    results.otherSessionFullTotal = typeof otherSessionText === 'string'
      && otherSessionText.includes('7 分 0 秒')
      && !otherSessionText.includes('自本轮起');

    // Switching back reloads the stored reset point.
    api.setSession('dtt-session-a');
    results.sessionReloadedBaseline = JSON.stringify(readBaseline()) === JSON.stringify({ baseIndex: 2, baseWall: 60 });
    api.setTurns([60, 60, 120, 180]);
    await tick();
    const reloadedText = taskTextOf(taskNode());
    results.sessionReloadedText = reloadedText;
    results.sessionReloadedIsFourMinutes = typeof reloadedText === 'string' && reloadedText.includes('4 分 0 秒');

    // Click "恢复": whole-session total (60+60+120+180 = 420s = 7 min) and
    // the stored key disappears.
    taskButton().click();
    await tick();
    const restoreText = taskTextOf(taskNode());
    const restoreButton = taskButton();
    results.restoreText = restoreText;
    results.restoreIsFullSession = typeof restoreText === 'string'
      && restoreText.includes('7 分 0 秒')
      && !restoreText.includes('自本轮起');
    results.restoreButtonReset = !!restoreButton && restoreButton.textContent === '重置';
    results.restoreHasNoSuffix = typeof restoreText === 'string' && !restoreText.includes('自本轮起');
    results.restoreBaselineNull = readBaseline() === null;
    results.restoreStoredKeyRemoved = !!(storage && storage.getItem(PREFIX + 'dtt-session-a') === null);

    // A corrupt stored record is ignored and removed instead of breaking the line.
    if (storage) storage.setItem(PREFIX + 'dtt-session-corrupt', 'not-json');
    api.setSession('dtt-session-corrupt');
    results.corruptBaselineIgnored = readBaseline() === null;
    results.corruptBaselineCleared = !!(storage && storage.getItem(PREFIX + 'dtt-session-corrupt') === null);
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
