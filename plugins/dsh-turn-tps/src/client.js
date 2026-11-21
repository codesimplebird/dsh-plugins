// dsh-turn-tps: CLIENT half.
//
// One composer-dock pill for the CURRENT TURN, mirroring how other agent
// clients summarise a turn in their status line: a headline speed plus the
// turn's token count, with the detail behind a click instead of crowding the
// composer.
//
//   resting :  ⚡ 本轮 159 tok/s · 1.2K tok
//   clicked :  panel titled 本轮用量 with output tokens, generation time,
//              time-to-first-token, tool time, wall time, cache hit, retries
//              and tool errors for that turn.
//
// Data source: the stats conversation-view target
//   ctx.uiConversation.binding(sessionId).target('stats')
// snapshot { turns: StatsTurnMetrics[], stepCount }; `.target()` is activated
// by its first subscriber, so the stats tab need not be open. The target only
// exists while `@deepseek-ai/dsh-experimental-client-ui-stats` is loaded;
// without it the pill renders nothing (a silent no-op, never an error).
//
// The detail panel is portaled to document.body via react-dom createPortal —
// the slot contract for 'conversation.composer.dock' mandates this: the docked
// composer card contains dock entries and its backdrop layer traps and clips
// position:fixed descendants, so a fixed overlay rendered inline never shows.
// The built-in DialogPill in dsh-client-ui-chat does exactly the same.
//
// Styling follows docs/web-styling.zh.md: only --dsw-alias-* semantic tokens,
// no colour literals in the feature styles. The accent is
// --dsw-alias-state-business-primary (--dsw-static-deepseek-500, #4176e6);
// --dsw-alias-brand-primary is NOT an accent — in dark theme it resolves to
// the near-white ink colour.
//
// Every read is defensive: a malformed snapshot, a missing binding or a
// missing service must never break the composer.
window.__ModuleLoader__.load({
  id: 'dsh-turn-tps',
  factory: (require) => {
    const React = require('react')
    const { useCallback, useEffect, useLayoutEffect, useRef, useState } = React

    // react-dom is a module-table entry (dsh-client-ui-chat requires it the
    // same way for its own dialogs). Guarded so a missing entry degrades to
    // inline rendering instead of failing the whole plugin at materialization.
    let createPortal = null
    try {
      createPortal = require('react-dom').createPortal
    } catch (error) {
      createPortal = null
    }

    const NS = 'turn-tps'
    const SLOT = 'conversation.composer.dock'
    const SLOT_ID = 'turn-tps'
    const STYLE_ID = 'dsh-turn-tps-style'

    const CLS = {
      anchor: 'dtt-anchor',
      pill: 'dtt-pill',
      label: 'dtt-label',
      sub: 'dtt-sub',
      panel: 'dtt-panel',
      head: 'dtt-head',
      headValue: 'dtt-head-value',
      rule: 'dtt-rule',
      grid: 'dtt-grid',
      foot: 'dtt-foot',
      taskTime: 'dtt-task-time',
      taskText: 'dtt-task-text',
      taskReset: 'dtt-task-reset',
      taskModel: 'dtt-task-model',
    }

    // Feature stylesheet. Colours come from semantic aliases only; the panel
    // mirrors the built-in stat dialog surface (menu fill + prominent
    // elevation) so it reads as the same family of popovers.
    const CSS = `
.${CLS.anchor} {
  display: inline-flex;
  min-width: 0;
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 1px);
  line-height: calc(20px + var(--dsh-content-font-delta-secondary, 0px));
}
.${CLS.pill} {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  max-width: 100%;
  padding: 1px 8px;
  border: 1px solid color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 32%, transparent);
  border-radius: var(--dsw-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 12%, transparent);
  color: var(--dsw-alias-state-business-primary, #4176e6);
  font: inherit;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  line-height: inherit;
  white-space: nowrap;
  cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.${CLS.pill} svg {
  width: 14px;
  height: 14px;
  flex: none;
  opacity: 0.9;
}
.${CLS.pill}[aria-expanded='true'] {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 20%, transparent);
  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 48%, transparent);
}
@media (hover: hover) {
  .${CLS.pill}:hover {
    background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 20%, transparent);
    border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4176e6) 48%, transparent);
  }
}
.${CLS.label} {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.${CLS.sub} {
  color: var(--dsw-alias-label-tertiary);
  font-weight: 400;
}
/* Class is only the no-JS fallback: the live font size, line height and colour
   are copied from the row's clock element into inline styles at insertion time,
   because the node is a sibling of the icon row (not a child), so it inherits
   the wrong typography otherwise. */
.${CLS.taskTime} {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin: 2px 0 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: calc(var(--dsh-content-font-size-secondary, 13px) - 2px);
  line-height: calc(18px + var(--dsh-content-font-delta-secondary, 0px));
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
/* Reset/restore control: reads as a quiet inline link, not a second button in
   the footer row. It lives inside the annotation, after the time text.
   Themes (e.g. Driftglass) restyle every <button> with higher specificity than
   this class, so the live styles are also written inline with !important by
   styleTaskButton(); this rule is the no-JS baseline. */
.${CLS.taskReset} {
  margin-left: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  opacity: 0.7;
  cursor: pointer;
  text-decoration: none;
}
.${CLS.taskReset}:hover {
  opacity: 1;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.${CLS.panel} {
  position: fixed;
  z-index: 1100;
  box-sizing: border-box;
  min-width: min(280px, calc(100vw - 24px));
  padding: 14px 16px;
  border: 0;
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-specific-menu);
  backdrop-filter: var(--dsw-menu-backdrop-filter);
  --dsw-elevation-stroke-color: var(--dsw-alias-border-l1);
  box-shadow: var(--dsw-elevation-prominent);
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  cursor: default;
  overflow-x: hidden;
  overflow-y: auto;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.${CLS.head} {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  color: var(--dsw-alias-label-primary);
  font-weight: 500;
}
.${CLS.head} svg {
  width: 14px;
  height: 14px;
  flex: none;
}
.${CLS.headValue} {
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-state-business-primary, #4176e6);
}
.${CLS.rule} {
  margin: 8px 0 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.${CLS.grid} {
  display: grid;
  grid-template-columns: minmax(76px, auto) minmax(0, 1fr);
  gap: 6px 16px;
  margin: 0;
  color: var(--dsw-alias-label-tertiary);
}
.${CLS.grid} dt, .${CLS.grid} dd {
  min-width: 0;
  margin: 0;
}
.${CLS.grid} dd {
  color: var(--dsw-alias-label-secondary);
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.${CLS.foot} {
  margin-top: 12px;
  color: var(--dsw-alias-label-tertiary);
}

/* ---------------------------------------------------------------------------
   Colour the neighbour stats in the same dock. They are shipped components, so
   they cannot be edited; their markup is stable, though: every entry carries
   data-composer-stat, and the context meter is the only thing in the dock that
   renders an svg circle. Re-tinting them by selector keeps the bar legible
   without touching the app bundle. Scoping everything to [data-composer-dock]
   so the same classes elsewhere in the app are untouched.

   Hue assignment: 累计(activity) 紫 · 用量(usage) 绿 · 上下文环 琥珀 · 本轮 蓝.
   All colours are semantic aliases, per docs/web-styling.zh.md.
--------------------------------------------------------------------------- */
[data-composer-dock] [data-composer-stat='activity'] span,
[data-composer-dock] [data-composer-stat='activity'] button,
[data-composer-dock] [data-composer-stat='activity'] svg {
  color: var(--dsw-alias-state-done-primary, #7c3aed) !important;
}
[data-composer-dock] [data-composer-stat='usage'] span,
[data-composer-dock] [data-composer-stat='usage'] button,
[data-composer-dock] [data-composer-stat='usage'] svg {
  color: var(--dsw-alias-state-success-primary, #22c55e) !important;
}
[data-composer-dock] [data-composer-stat='activity'] [class*='_pill'],
[data-composer-dock] [data-composer-stat='usage'] [class*='_pill'] {
  background: transparent;
}
[data-composer-dock] [data-composer-stat='activity'] button:hover,
[data-composer-dock] [data-composer-stat='activity'] button[aria-expanded='true'],
[data-composer-dock] [data-composer-stat='usage'] button:hover,
[data-composer-dock] [data-composer-stat='usage'] button[aria-expanded='true'] {
  background: var(--dsw-alias-interactive-bg-hover);
}
/* Context meter: the only svg-circle renderer in the dock. */
[data-composer-dock] svg circle:last-of-type {
  stroke: var(--dsw-alias-state-warn-primary, #f59e0b) !important;
}
[data-composer-dock] button:has(> svg circle),
[data-composer-dock] button:has(> svg circle) span {
  color: var(--dsw-alias-state-warn-primary, #f59e0b) !important;
}
`

    const zh = {
      'pill.label': '本轮 {tps} tok/s',
      'pill.output': '· {output} tok',
      'panel.title': '本轮用量',
      'panel.turn': '第 {turn} 轮',
      'row.output': '输出 Token',
      'row.decode': '生成用时',
      'row.ttft': '首 Token',
      'row.tool': '工具用时',
      'row.wall': '本轮用时',
      'row.cache': '缓存命中',
      'row.retries': '重试',
      'row.toolErrors': '工具错误',
      'row.steps': '步骤数',
      'state.running': '生成中…',
      'state.interrupted': '已中断',
      'state.aborted': '已中止',
      'state.done': '已完成',
      'empty': '暂无可测量的数据',
      'task.total': '任务总用时 {duration}',
      'task.suffix': '· 自本轮起',
      'task.reset': '重置',
      'task.restore': '恢复',
      'task.resetTitle': '从当前这一轮开始累计',
      'task.restoreTitle': '恢复为整个会话累计',
      'task.model': '模型',
    }
    const en = {
      'pill.label': 'turn {tps} tok/s',
      'pill.output': '· {output} tok',
      'panel.title': 'Turn usage',
      'panel.turn': 'Turn {turn}',
      'row.output': 'Output tokens',
      'row.decode': 'Generation',
      'row.ttft': 'Time to first token',
      'row.tool': 'Tool time',
      'row.wall': 'Turn wall time',
      'row.cache': 'Cache hit',
      'row.retries': 'Retries',
      'row.toolErrors': 'Tool errors',
      'row.steps': 'Steps',
      'state.running': 'Generating…',
      'state.interrupted': 'Interrupted',
      'state.aborted': 'Aborted',
      'state.done': 'Done',
      'empty': 'No measurable data yet',
      'task.total': 'Total task time {duration}',
      'task.suffix': '· from this turn',
      'task.reset': 'Reset',
      'task.restore': 'Restore',
      'task.resetTitle': 'Count from the current turn',
      'task.restoreTitle': 'Count the whole session again',
      'task.model': 'Model',
    }

    function fill(template, params) {
      return Object.entries(params ?? {}).reduce(
        (text, [name, value]) => text.split('{' + name + '}').join(String(value)),
        template,
      )
    }

    /** Resolve through the locale seat, falling back to the local dictionary. */
    function translate(t, key, params) {
      try {
        const seat = typeof t === 'function' ? t(key, params) : undefined
        if (typeof seat === 'string' && seat.length > 0 && seat !== key && !seat.includes('{')) return seat
      } catch (error) {
        // Fall through to the local dictionary.
      }
      return fill(zh[key] ?? en[key] ?? key, params)
    }

    function ensureStyle() {
      try {
        if (typeof document === 'undefined') return
        if (document.getElementById(STYLE_ID)) return
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        document.head.appendChild(style)
      } catch (error) {
        // Styling is cosmetic; the pill still renders without it.
      }
    }

    const isNum = (value) => typeof value === 'number' && Number.isFinite(value)

    /** One-decimal under 100, integer above, so the pill stays narrow. */
    function formatTps(value) {
      if (!isNum(value) || value <= 0) return null
      return value >= 100 ? String(Math.round(value)) : value.toFixed(1)
    }

    function formatMs(value) {
      if (!isNum(value) || value < 0) return null
      if (value >= 60_000) return (value / 60_000).toFixed(1) + ' min'
      return value >= 1_000 ? (value / 1_000).toFixed(1) + ' s' : Math.round(value) + ' ms'
    }

    function formatTokens(value) {
      if (!isNum(value)) return null
      if (value >= 10_000_000) return (value / 1_000_000).toFixed(1) + 'M'
      if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K'
      return String(Math.round(value))
    }

    function formatPercent(value) {
      if (!isNum(value)) return null
      return (value * 100).toFixed(value >= 0.995 ? 0 : 1) + '%'
    }

    /** Two units at most, so the line stays one row tall. */
    function formatTaskDuration(ms, chinese) {
      if (!isNum(ms) || ms < 0) return null
      const totalSeconds = Math.round(ms / 1000)
      const hours = Math.floor(totalSeconds / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      if (chinese) {
        if (hours > 0) return hours + ' 小时 ' + minutes + ' 分'
        if (minutes > 0) return minutes + ' 分 ' + seconds + ' 秒'
        return seconds + ' 秒'
      }
      if (hours > 0) return hours + 'h ' + minutes + 'm'
      if (minutes > 0) return minutes + 'm ' + seconds + 's'
      return seconds + 's'
    }

    // ---- task total under the newest message footer ------------------------
    //
    // The footer row ("用量 … tok · 15:05") belongs to
    // @deepseek-ai/dsh-client-ui-chat. The shipped markup nests the usage
    // trigger two flex rows deep:
    //
    //   <div class="TurnTailNodeView_root" data-turn-tail="N">   column, gap 16
    //     <div class="MessageIconActions_actions …" data-clock="end">  row, 28px
    //       <button copy/> … <button branch/>
    //       <span class="MessageIconActions_endInfo">          inline-flex
    //         <span class="TurnUsagePanel_root"><button aria-haspopup="dialog">用量 …</button></span>
    //         <span class="MessageIconActions_timeEnd">15:05</span>
    //       </span>
    //     </div>
    //   </div>
    //
    // Climbing to the first element that has a clock sibling therefore lands on
    // `endInfo` and leaves the annotation inside the icon row. The official row
    // carries the stable `data-clock` attribute, which is the primary anchor;
    // the textual walk is only a fallback for older/foreign markup.
    //
    // The annotation is placed directly after that row inside the column that
    // stacks chat rows, then verified with layout rects. The column's flex gap
    // (16px in the shipped stylesheet) is cancelled with a one-off negative
    // margin so the line reads ~4px under the actions row.
    const TASK_TIME_ATTR = 'data-dtt-task-time'
    const TASK_TIME_GAP = 4
    const TASK_BASELINE_PREFIX = 'dsh-turn-tps:task-baseline:'
    const CLOCKISH_TEXT = /(\d{1,2}:\d{2})|(\d{1,2}月\d{1,2}日)|(\d{1,2}\/\d{1,2})/u
    const CLOCK_ONLY_TEXT = /^\d{1,2}:\d{2}$/u
    const CLOCK_DATE_TEXT = /^(\d{1,2}月\d{1,2}日|\d{1,2}\/\d{1,2})\s+\d{1,2}:\d{2}$/u
    const FOOTER_HINTS = '[data-clock],[data-turn-tail]'
    const FOOTER_TRIGGER = 'button[aria-haspopup="dialog"]'
    /** Session the annotation currently reflects; null until the slot injects one. */
    let taskSessionId = null
    /** { baseIndex, baseWall } while counting from a reset point; null = whole session. */
    let taskBaseline = null
    /** Newest turns array seen, kept so the reset button can act without a snapshot. */
    let lastTurns = null
    /** Published annotation: text (null removes the line) plus the button mode. */
    let taskTimeText = null
    let taskTimeAction = 'reset'
    let taskSyncScheduled = false
    let lastTaskText = null
    let lastTaskAction = null
    /** What the mounted node currently shows, so the observer can skip unchanged syncs. */
    let renderedTaskText = null
    let renderedTaskAction = null
    /** Cached { node, row } of the last placement; lets the observer skip a scan. */
    let taskAnchor = null

    function currentDict() {
      try {
        return /^zh/i.test(document.documentElement.lang || '') ? zh : en
      } catch (error) {
        return zh
      }
    }

    // ---- per-session reset baseline ---------------------------------------
    //
    // "重置" remembers the last turn index and that turn's wall time at the
    // moment of the click. From then on the line counts
    //   Σ turns after the reset point  +  (current turn's wall - the wall it
    //                                     already had at reset time)
    // which is 0 right at the click, grows with the current turn, and later
    // turns count in full. The point is stored per Session:
    //   dsh-turn-tps:task-baseline:<sessionId> = {"baseIndex":N,"baseWall":ms}
    // and every localStorage touch is guarded: file:// pages and private
    // windows can throw on the getter itself, not only on read/write.
    function localStorageStore() {
      try {
        if (typeof window === 'undefined') return null
        const storage = window.localStorage
        return storage && typeof storage.getItem === 'function' ? storage : null
      } catch (error) {
        return null
      }
    }

    function baselineStorageKey(sessionId) {
      return sessionId === null ? null : TASK_BASELINE_PREFIX + sessionId
    }

    /** Stored baseline for one Session; a corrupt value is dropped, not reused. */
    function readStoredBaseline(sessionId) {
      let key = null
      try {
        if (sessionId === null) return null
        const storage = localStorageStore()
        key = baselineStorageKey(sessionId)
        if (storage === null || key === null) return null
        const raw = storage.getItem(key)
        if (raw === null || raw === '') return null
        const parsed = JSON.parse(raw)
        const baseIndex = parsed && parsed.baseIndex
        const baseWall = parsed && parsed.baseWall
        if (!Number.isInteger(baseIndex) || baseIndex < -1 || !isNum(baseWall) || baseWall < 0) {
          throw new Error('malformed task baseline')
        }
        return { baseIndex, baseWall }
      } catch (error) {
        try {
          const storage = localStorageStore()
          if (storage !== null && key !== null) storage.removeItem(key)
        } catch (removeError) {
          // Storage unavailable: stay memory-only.
        }
        return null
      }
    }

    /** Persist the active baseline, or delete the key when counting the session. */
    function persistBaseline() {
      try {
        const storage = localStorageStore()
        const key = baselineStorageKey(taskSessionId)
        if (storage === null || key === null) return
        if (taskBaseline === null) {
          storage.removeItem(key)
        } else {
          storage.setItem(key, JSON.stringify({
            baseIndex: taskBaseline.baseIndex,
            baseWall: taskBaseline.baseWall,
          }))
        }
      } catch (error) {
        // Private mode/quota: the reset point still works in memory.
      }
    }

    /**
     * Adopt the Session id handed to `inject`; a switch loads that Session's
     * stored baseline and drops the previous Session's published figures (the
     * next snapshot render refills them). Without an id the baseline stays
     * memory-only instead of leaking through a global key.
     */
    function captureSession(sessionId) {
      const next = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null
      if (next === taskSessionId) return
      taskSessionId = next
      taskBaseline = readStoredBaseline(next)
      lastTurns = null
      lastTaskText = null
      lastTaskAction = null
      taskTimeText = null
      taskTimeAction = 'reset'
      scheduleTaskSync()
    }

    /** Baseline index clamped to the live turns; null when the record is unusable. */
    function effectiveBaselineIndex(turns) {
      if (taskBaseline === null) return null
      const index = taskBaseline.baseIndex
      const wall = taskBaseline.baseWall
      if (!Number.isInteger(index) || index < -1 || !isNum(wall) || wall < 0) return null
      const length = Array.isArray(turns) ? turns.length : 0
      if (length === 0) return -1
      // Turns reloaded/shrank: measure from the last turn that still exists.
      return index >= length ? length - 1 : index
    }

    function rawTurnsTotal(turns) {
      let sum = 0
      for (const turn of turns) if (isNum(turn && turn.wall)) sum += turn.wall
      return sum > 0 ? sum : null
    }

    /**
     * Total task wall time by the active baseline rule; null while nothing is
     * measurable (the caller then removes the whole annotation row).
     */
    function computeTaskTotal(turns) {
      try {
        const list = Array.isArray(turns) ? turns : []
        if (list.length === 0) return null
        let measurable = false
        for (const turn of list) {
          if (isNum(turn && turn.wall)) {
            measurable = true
            break
          }
        }
        if (!measurable) return null
        if (taskBaseline === null) return rawTurnsTotal(list)
        const index = effectiveBaselineIndex(list)
        if (index === null) {
          // Unreadable reset record: fall back to the whole session and forget it.
          taskBaseline = null
          persistBaseline()
          return rawTurnsTotal(list)
        }
        const wallAt = (position) => (
          position >= 0 && position < list.length && isNum(list[position] && list[position].wall)
            ? list[position].wall
            : 0
        )
        let total = Math.max(0, wallAt(index) - taskBaseline.baseWall)
        for (let i = index + 1; i < list.length; i += 1) total += wallAt(i)
        return total
      } catch (error) {
        return null
      }
    }

    /** The published line; a baseline appends "· 自本轮起" / "· from this turn". */
    function buildTaskText(ms) {
      const dict = currentDict()
      const duration = formatTaskDuration(ms, dict === zh)
      if (duration === null) return null
      const line = fill(dict['task.total'], { duration })
      return taskBaseline === null ? line : line + ' ' + dict['task.suffix']
    }

    /**
     * Publish text and button mode. The cache compares both: the suffix makes a
     * reset to 0 s a visible change, and the mode keeps the button in step even
     * if a future locale renders the same words for both states.
     */
    function publishTaskTotal(ms) {
      const action = taskBaseline === null ? 'reset' : 'restore'
      const next = buildTaskText(ms)
      if (next === lastTaskText && action === lastTaskAction) return
      lastTaskText = next
      lastTaskAction = action
      taskTimeText = next
      taskTimeAction = action
      scheduleTaskSync()
    }

    /** Snapshot path: remember the turns, then publish under the baseline rule. */
    function publishSnapshotTurns(turns) {
      lastTurns = Array.isArray(turns) ? turns : null
      publishTaskTotal(computeTaskTotal(lastTurns))
    }

    /** Reset/restore click: never let it bubble into the copy/share handlers. */
    function onTaskToggleClick(event) {
      try {
        event.preventDefault()
        event.stopPropagation()
      } catch (error) {
        // Exotic event object: the state change below is what matters.
      }
      try {
        const turns = Array.isArray(lastTurns) ? lastTurns : []
        if (taskBaseline === null) {
          const baseIndex = turns.length > 0 ? turns.length - 1 : -1
          taskBaseline = {
            baseIndex,
            baseWall: baseIndex >= 0 && isNum(turns[baseIndex] && turns[baseIndex].wall)
              ? turns[baseIndex].wall
              : 0,
          }
        } else {
          taskBaseline = null
        }
        persistBaseline()
        publishTaskTotal(computeTaskTotal(turns))
        // The click must update the row in this frame, not on the next mutation.
        syncTaskTime()
      } catch (error) {
        // Cosmetic control: never throw into the transcript.
      }
    }

    /** Test seam turns use seconds; the stats snapshot uses milliseconds. */
    function normalizeSeamTurns(turns) {
      if (!Array.isArray(turns)) return null
      const list = []
      for (const turn of turns) {
        if (isNum(turn)) {
          list.push({ wall: Math.max(0, turn) * 1000 })
        } else if (turn && typeof turn === 'object') {
          list.push({ ...turn, wall: isNum(turn.wall) ? Math.max(0, turn.wall) * 1000 : undefined })
        } else {
          list.push({})
        }
      }
      return list
    }

    function usageTriggers() {
      const found = []
      try {
        for (const button of document.querySelectorAll('button[aria-haspopup="dialog"]')) {
          const text = (button.textContent || '').trim()
          if (/^(用量|Usage)\s/u.test(text)) found.push(button)
        }
      } catch (error) {
        // No document to annotate.
      }
      return found
    }

    /** True when the element lays its children out top to bottom. */
    function isStackingContainer(element) {
      try {
        const style = getComputedStyle(element)
        const display = style.display
        if (display === 'flex' || display === 'inline-flex') return /^column/u.test(style.flexDirection || '')
        return display === 'block' || display === 'flow-root' || display === 'list-item'
      } catch (error) {
        return false
      }
    }

    /** True when a direct child's text carries a clock or date stamp. */
    function hasClockChild(element) {
      try {
        for (const child of element.children) {
          const text = (child.textContent || '').trim()
          if (text !== '' && CLOCKISH_TEXT.test(text)) return true
        }
      } catch (error) {
        // Detached or exotic node.
      }
      return false
    }

    /** The row's clock span: the one whose entire text is a time (or date + time). */
    function clockElementOf(row) {
      try {
        for (const pattern of [CLOCK_ONLY_TEXT, CLOCK_DATE_TEXT]) {
          for (const element of row.querySelectorAll('span')) {
            const text = (element.textContent || '').trim()
            if (text !== '' && pattern.test(text)) return element
          }
        }
      } catch (error) {
        // Fall through to the default typography.
      }
      return null
    }

    /** Pre-data-clock placement: the parent whose children carry the clock. */
    function legacyFooterRowOf(trigger) {
      let node = trigger
      for (let depth = 0; depth < 4 && node !== null; depth += 1) {
        const parent = node.parentElement
        if (parent === null) break
        const hasClock = Array.from(parent.children).some((child) => {
          if (child === node) return false
          const text = (child.textContent || '').trim()
          return text !== '' && CLOCKISH_TEXT.test(text)
        })
        if (hasClock) return parent
        node = parent
      }
      return trigger.parentElement
    }

    /** The real icon/clock row for a usage trigger. */
    function footerRowOf(trigger) {
      // Official builds stamp the row with data-clock; it is the only stable
      // hook, because component class names are hashed per build.
      try {
        const official = trigger.closest('[data-clock]')
        if (official !== null && official !== document.body && official !== document.documentElement) return official
      } catch (error) {
        // Fall through to the textual walk.
      }
      // Older/foreign markup: the first ancestor that carries a clock child and
      // sits inside a column, i.e. a line of the transcript rather than a
      // nested icon cluster.
      try {
        let node = trigger
        for (let depth = 0; depth < 6 && node !== null; depth += 1) {
          const parent = node.parentElement
          if (parent !== null && parent !== document.body && parent !== document.documentElement
            && hasClockChild(node) && isStackingContainer(parent)) {
            return node
          }
          node = parent
        }
      } catch (error) {
        // Fall through to the legacy heuristic.
      }
      return legacyFooterRowOf(trigger)
    }

    /** True when the container keeps its children on one horizontal line. */
    function stacksHorizontally(element) {
      try {
        const style = getComputedStyle(element)
        const isFlex = style.display === 'flex' || style.display === 'inline-flex'
        return isFlex && !/^column/u.test(style.flexDirection || '')
      } catch (error) {
        return false
      }
    }

    // ---- per-turn model label ---------------------------------------------
    //
    // Every assistant Turn footer ("… 用量 9.4M tok · 22:12") belongs to that
    // Turn only, and a Session can switch models between TurnS. The model of
    // the Turn is not a DOM attribute: the official TurnTailNodeView holds
    // `node.data.tokenUsage.routes` in React props, and TurnUsagePanel receives
    // the same usage object. React internals are the only place the per-Turn
    // identity is reachable from the client, so the label walks up from the
    // row to the nearest fiber carrying `routes` (same technique as the
    // subagent-roster plugin). A failure only hides the label.
    const TURN_MODEL_ATTR = 'data-dtt-turn-model'
    let turnModelSyncedAt = 0

    function fiberOf(element) {
      try {
        const key = Object.keys(element).find((name) => name.startsWith('__reactFiber$'))
        return key === undefined ? null : element[key]
      } catch (error) {
        return null
      }
    }

    /** routes from a fiber's props: TurnUsagePanel.usage or TurnTailNodeView.node. */
    function routesFromProps(props) {
      if (props === null || typeof props !== 'object') return null
      const usage = props.usage
      if (usage !== null && typeof usage === 'object' && Array.isArray(usage.routes) && usage.routes.length > 0) {
        return usage.routes
      }
      const node = props.node
      const data = node !== null && typeof node === 'object' ? node.data : null
      const tokenUsage = data !== null && typeof data === 'object' ? data.tokenUsage : null
      if (tokenUsage !== null && typeof tokenUsage === 'object'
        && Array.isArray(tokenUsage.routes) && tokenUsage.routes.length > 0) {
        return tokenUsage.routes
      }
      return null
    }

    /** Walk up from the footer row to the nearest component carrying that Turn's routes. */
    function turnRoutesOf(element) {
      let fiber = fiberOf(element)
      for (let depth = 0; fiber !== null && depth < 60; depth += 1) {
        try {
          const routes = routesFromProps(fiber.memoizedProps)
          if (routes !== null) return routes
        } catch (error) {
          // Keep walking.
        }
        fiber = fiber.return
      }
      return null
    }

    /** `provider/model` list, de-duplicated, in request order. */
    function formatTurnRoutes(routes) {
      if (!Array.isArray(routes)) return null
      const seen = new Set()
      const parts = []
      for (const route of routes) {
        if (route === null || typeof route !== 'object') continue
        if (typeof route.provider !== 'string' || route.provider === '') continue
        if (typeof route.model !== 'string' || route.model === '') continue
        const id = `${route.provider}/${route.model}`
        if (seen.has(id)) continue
        seen.add(id)
        parts.push(id)
      }
      return parts.length === 0 ? null : parts.join(', ')
    }

    function removeTurnModelLabels(row) {
      try {
        for (const label of row.querySelectorAll('[' + TURN_MODEL_ATTR + ']')) label.remove()
      } catch (error) {
        // Detached row.
      }
    }

    /**
     * Stamp every assistant Turn footer with its own model, inline after the
     * clock so it shares the row's hover reveal. Cheap by construction: rows
     * whose label already matches are skipped, and the whole pass is throttled
     * because it is triggered by the same mutation stream as the task line.
     */
    function syncTurnModels(force) {
      try {
        if (typeof document === 'undefined') return
        const now = Date.now()
        if (force !== true && now - turnModelSyncedAt < 800) return
        turnModelSyncedAt = now
        ensureStyle()
        for (const row of document.querySelectorAll('[data-clock="end"]')) {
          let text = null
          try {
            text = formatTurnRoutes(turnRoutesOf(row))
          } catch (error) {
            text = null
          }
          const clock = clockElementOf(row)
          if (text === null || clock === null || clock.parentElement === null) {
            removeTurnModelLabels(row)
            continue
          }
          let label = row.querySelector('[' + TURN_MODEL_ATTR + ']')
          if (label !== null && label.getAttribute(TURN_MODEL_ATTR) === text) continue
          removeTurnModelLabels(row)
          label = document.createElement('span')
          label.setAttribute(TURN_MODEL_ATTR, text)
          label.className = CLS.taskModel
          const style = label.style
          style.display = 'inline-block'
          style.marginLeft = '4px'
          style.fontSize = 'inherit'
          style.lineHeight = 'inherit'
          style.color = 'var(--dsw-alias-label-tertiary)'
          style.whiteSpace = 'nowrap'
          style.fontVariantNumeric = 'tabular-nums'
          label.textContent = text
          label.title = `${currentDict()['task.model']}: ${text}`
          clock.parentElement.insertBefore(label, clock.nextSibling)
        }
      } catch (error) {
        // Cosmetic: never surface a failure.
      }
    }

    /**
     * Copy the clock's computed typography onto the annotation inline. Classes
     * alone are not enough: the annotation is a sibling of the icon row, not a
     * child of it, so it inherits the wrong size/colour.
     */
    function styleTaskNode(node, row) {
      node.className = CLS.taskTime
      const style = node.style
      style.display = 'block'
      style.width = '100%'
      style.boxSizing = 'border-box'
      style.whiteSpace = 'nowrap'
      style.fontVariantNumeric = 'tabular-nums'
      style.margin = '2px 0 0'
      style.fontSize = ''
      style.lineHeight = ''
      style.color = ''
      const clock = clockElementOf(row)
      if (clock !== null) {
        try {
          const computed = getComputedStyle(clock)
          if (computed.fontSize) style.fontSize = computed.fontSize
          if (computed.lineHeight && computed.lineHeight !== 'normal') style.lineHeight = computed.lineHeight
          if (computed.color) style.color = computed.color
        } catch (error) {
          // Defaults below still render a legible line.
        }
      }
      if (style.fontSize === '') style.fontSize = '12px'
      if (style.lineHeight === '') style.lineHeight = '18px'
      if (style.color === '') style.color = 'var(--dsw-alias-label-tertiary, #9b9da3)'
    }

    /** Vertical distance between the row's bottom and the node's top, if laid out. */
    function measureTaskGap(node, row) {
      try {
        const rowRect = row.getBoundingClientRect()
        const nodeRect = node.getBoundingClientRect()
        if (rowRect.height === 0 || nodeRect.height === 0) return null
        return nodeRect.top - rowRect.bottom
      } catch (error) {
        return null
      }
    }

    /**
     * The column stacks its children with a flex gap (16px in the shipped
     * stylesheet). Measure the live gap once after insertion, then cancel all
     * but ~TASK_TIME_GAP px with a negative margin. Insertion-time only.
     */
    function calibrateTaskGap(node, row) {
      const gap = measureTaskGap(node, row)
      if (gap === null || gap <= 8) return
      const current = Number.parseFloat(node.style.marginTop) || 0
      const next = Math.round((current + TASK_TIME_GAP - gap) * 100) / 100
      if (Number.isFinite(next)) node.style.marginTop = next + 'px'
    }

    /**
     * Put the annotation directly after the row, climbing one level at a time
     * while the container still keeps both on one line (max 3 attempts). The
     * layout rect is the acceptance test: the node must start on a later line.
     */
    function insertTaskNode(node, row) {
      let container = row.parentElement
      let anchor = row
      let measured = null
      for (let depth = 0; depth < 3 && container !== null; depth += 1) {
        if (container === document.body || container === document.documentElement) break
        try {
          container.insertBefore(node, anchor.nextSibling)
        } catch (error) {
          break
        }
        styleTaskNode(node, row)
        const gap = measureTaskGap(node, row)
        if (gap !== null) measured = gap
        if (gap !== null && gap >= -1) {
          calibrateTaskGap(node, row)
          taskAnchor = { node, row }
          return true
        }
        // Still level with the icon row: only a flex row can cause that, so
        // retry one level higher.
        const parent = container.parentElement
        if (parent === null || !stacksHorizontally(container)) break
        anchor = container
        container = parent
      }
      // Measured but never below the row: that is the reported bug (annotation
      // glued to the clock). Drop it rather than leave it in the wrong place.
      if (measured !== null) {
        node.remove()
        return false
      }
      // Layout unavailable (hidden/detached): keep the best-effort position.
      if (node.isConnected) {
        taskAnchor = { node, row }
        return true
      }
      return false
    }

    /** True when a mutation batch attaches markup that may contain a footer row. */
    function mutationAddsFooter(records) {
      try {
        for (const record of records) {
          if (record.type !== 'childList') continue
          for (const added of record.addedNodes) {
            if (added.nodeType !== 1) continue
            // The current official row (data-clock), the turn-tail wrapper, or
            // the textual-fallback shape (a usage dialog trigger) all mean the
            // newest annotation target may have changed.
            if (added.matches(FOOTER_HINTS) || added.querySelector(FOOTER_HINTS) !== null) return true
            if (added.matches(FOOTER_TRIGGER) || added.querySelector(FOOTER_TRIGGER) !== null) return true
          }
        }
        return false
      } catch (error) {
        return true // Conservative: let the next sync rescan.
      }
    }

    /** Remove every annotation, including a detached-but-cached one. */
    function removeTaskNodes() {
      try {
        for (const node of document.querySelectorAll('[' + TASK_TIME_ATTR + ']')) node.remove()
      } catch (error) {
        // No document to clean.
      }
      taskAnchor = null
      renderedTaskText = null
      renderedTaskAction = null
    }

    // Inline !important beats every author rule (themes restyle all buttons),
    // so the control keeps the quiet-link look inside any theme.
    const TASK_BUTTON_STYLES = {
      'background': 'transparent',
      'background-color': 'transparent',
      'background-image': 'none',
      'border': '0',
      'border-radius': '0',
      'box-shadow': 'none',
      'padding': '0',
      'margin': '0 0 0 8px',
      'color': 'inherit',
      'font': 'inherit',
      'font-family': 'inherit',
      'font-size': 'inherit',
      'font-weight': 'inherit',
      'line-height': 'inherit',
      'height': 'auto',
      'width': 'auto',
      'min-width': '0',
      'min-height': '0',
      'display': 'inline',
      'cursor': 'pointer',
      'opacity': '0.7',
      'text-decoration': 'none',
      'white-space': 'nowrap',
      'transform': 'none',
      'backdrop-filter': 'none',
      '-webkit-backdrop-filter': 'none',
    }

    /** Write the theme-proof base styles; cheap enough to repeat on every sync. */
    function styleTaskButton(button) {
      try {
        for (const key of Object.keys(TASK_BUTTON_STYLES)) {
          button.style.setProperty(key, TASK_BUTTON_STYLES[key], 'important')
        }
      } catch (error) {
        // Styling is cosmetic; the click still works.
      }
    }

    /** Hover emphasis without a stylesheet (inline keeps winning over themes). */
    function hoverTaskButton(button, hovered) {
      try {
        button.style.setProperty('opacity', hovered ? '1' : '0.7', 'important')
        button.style.setProperty('text-decoration', hovered ? 'underline' : 'none', 'important')
        button.style.setProperty('text-underline-offset', hovered ? '2px' : '0px', 'important')
      } catch (error) {
        // Ignore.
      }
    }

    /**
     * Reuse the annotation's children: a text span followed by the reset
     * button. The button is created once per node and keeps its click handler
     * across text updates.
     */
    function ensureTaskChildren(node) {
      let text = null
      let button = null
      for (const child of node.children) {
        if (child.classList && child.classList.contains(CLS.taskText)) text = child
        else if (child.classList && child.classList.contains(CLS.taskReset)) button = child
      }
      if (text === null) {
        text = document.createElement('span')
        text.className = CLS.taskText
        node.appendChild(text)
      }
      if (button === null) {
        button = document.createElement('button')
        button.type = 'button'
        button.className = CLS.taskReset
        styleTaskButton(button)
        button.addEventListener('click', onTaskToggleClick)
        button.addEventListener('mouseenter', () => hoverTaskButton(button, true))
        button.addEventListener('mouseleave', () => hoverTaskButton(button, false))
        node.appendChild(button)
      }
      return { text, button }
    }

    /** Write the current text/mode into the node and remember what it shows. */
    function applyTaskContent(node) {
      const { text, button } = ensureTaskChildren(node)
      styleTaskButton(button)
      if (text.textContent !== taskTimeText) text.textContent = taskTimeText
      const dict = currentDict()
      const restore = taskTimeAction === 'restore'
      const label = restore ? dict['task.restore'] : dict['task.reset']
      const title = restore ? dict['task.restoreTitle'] : dict['task.resetTitle']
      if (button.textContent !== label) button.textContent = label
      if (button.getAttribute('title') !== title) button.setAttribute('title', title)
      if (button.getAttribute('data-dtt-action') !== taskTimeAction) {
        button.setAttribute('data-dtt-action', taskTimeAction)
      }
      renderedTaskText = taskTimeText
      renderedTaskAction = taskTimeAction
    }

    function syncTaskTime() {
      try {
        if (typeof document === 'undefined') return
        // The annotation's own classes style the reset button; make sure the
        // feature stylesheet exists even on a render path that only annotates.
        ensureStyle()
        // Cheap path: the observer fires on every streamed token, and while the
        // annotation already sits directly after the newest row with unchanged
        // text nothing needs a document-wide scan. A newly attached footer
        // invalidates taskAnchor in the observer callback.
        const cached = taskAnchor
        if (cached !== null && taskTimeText !== null
          && cached.node.isConnected && cached.row.isConnected
          && cached.node.previousElementSibling === cached.row
          && renderedTaskText === taskTimeText && renderedTaskAction === taskTimeAction) {
          return
        }
        if (taskTimeText === null) {
          removeTaskNodes()
          return
        }
        const triggers = usageTriggers()
        if (triggers.length === 0) {
          removeTaskNodes()
          return
        }
        const row = footerRowOf(triggers[triggers.length - 1])
        if (row === null || row.parentElement === null) {
          removeTaskNodes()
          return
        }
        const existing = Array.from(document.querySelectorAll('[' + TASK_TIME_ATTR + ']'))
        let node = existing[existing.length - 1] ?? null
        for (const stale of existing) if (stale !== node) stale.remove()
        if (node === null) {
          node = document.createElement('div')
          node.setAttribute(TASK_TIME_ATTR, '')
        }
        applyTaskContent(node)
        if (node.isConnected && node.previousElementSibling === row) {
          taskAnchor = { node, row }
          return
        }
        if (!insertTaskNode(node, row)) {
          node.remove()
          taskAnchor = null
        }
      } catch (error) {
        // Annotation is cosmetic; never surface a failure.
      }
    }

    function scheduleTaskSync() {
      if (taskSyncScheduled) return
      taskSyncScheduled = true
      const run = () => {
        taskSyncScheduled = false
        syncTaskTime()
        syncTurnModels(false)
      }
      try {
        requestAnimationFrame(run)
      } catch (error) {
        setTimeout(run, 16)
      }
    }

    /**
     * Publish an explicit millisecond total. Kept as the `__DTT_TEST__`
     * seam; the live path goes through publishSnapshotTurns() so the baseline
     * rule sees the turns array.
     */
    function setTaskTime(ms) {
      publishTaskTotal(ms)
    }

    /** The newest turn, or null. */
    function pickTurn(snapshot) {
      try {
        const turns = snapshot && snapshot.turns
        if (!Array.isArray(turns) || turns.length === 0) return null
        return turns[turns.length - 1] ?? null
      } catch (error) {
        return null
      }
    }

    /** The turn's own tps, else the newest step of that turn that reported one. */
    function turnTps(turn) {
      if (!turn) return null
      if (isNum(turn.tps) && turn.tps > 0) return turn.tps
      const steps = turn.steps
      if (Array.isArray(steps)) {
        for (let i = steps.length - 1; i >= 0; i -= 1) {
          const step = steps[i]
          if (step && isNum(step.tps) && step.tps > 0) return step.tps
        }
      }
      return null
    }

    function turnState(turn, t) {
      if (!turn) return null
      if (turn.running) return t('state.running')
      if (turn.interrupted) return t('state.interrupted')
      if (turn.aborted) return t('state.aborted')
      return t('state.done')
    }

    /** Detail rows; a pending figure reads as an ellipsis rather than a dash. */
    function buildRows(turn, t) {
      if (!turn) return []
      const rows = []
      const push = (labelKey, value) => {
        if (value !== null && value !== undefined && value !== '') rows.push([t(labelKey), value])
      }
      const stepCount = Array.isArray(turn.steps) ? turn.steps.length : null
      push('row.steps', stepCount !== null ? String(stepCount) : null)
      push('row.output', formatTokens(turn.output))
      push('row.decode', formatMs(turn.decode) ?? (isNum(turn.modelPending) && turn.modelPending > 0 ? '…' : null))
      push('row.ttft', formatMs(turn.ttft) ?? (isNum(turn.ttftPending) && turn.ttftPending > 0 ? '…' : null))
      push('row.tool', formatMs(turn.tool) ?? (isNum(turn.toolPending) && turn.toolPending > 0 ? '…' : null))
      push('row.wall', formatMs(turn.wall))
      push('row.cache', formatPercent(turn.cacheHit))
      if (isNum(turn.retries) && turn.retries > 0) push('row.retries', String(turn.retries))
      if (isNum(turn.toolErrors) && turn.toolErrors > 0) push('row.toolErrors', String(turn.toolErrors))
      return rows
    }

    function BoltIcon() {
      return React.createElement(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: 14,
          height: 14,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.25,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
          'aria-hidden': 'true',
          style: { flex: 'none' },
        },
        React.createElement('path', { d: 'M8.9 1.8 4.1 8.6h3.1l-1 5.6 5-7h-3.2z' }),
      )
    }

    /** Viewport position for the body-portaled panel, clamped to the window. */
    function useAnchoredPosition(open, triggerRef) {
      const [style, setStyle] = useState(null)
      useLayoutEffect(() => {
        if (!open) {
          setStyle(null)
          return undefined
        }
        const place = () => {
          const node = triggerRef.current
          if (!node || typeof window === 'undefined') return
          const rect = node.getBoundingClientRect()
          const width = Math.min(340, Math.max(240, window.innerWidth - 24))
          const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
          setStyle({
            left: left + 'px',
            width: width + 'px',
            bottom: Math.max(12, window.innerHeight - rect.top + 8) + 'px',
            maxHeight: Math.max(160, rect.top - 24) + 'px',
          })
        }
        place()
        window.addEventListener('resize', place)
        window.addEventListener('scroll', place, true)
        return () => {
          window.removeEventListener('resize', place)
          window.removeEventListener('scroll', place, true)
        }
      }, [open, triggerRef])
      return style
    }

    function TurnTpsPill(props) {
      const useTurnStats = props.useTurnStats
      const t = (key, params) => translate(props.t, key, params)

      ensureStyle()

      const [open, setOpen] = useState(false)
      const rootRef = useRef(null)
      const triggerRef = useRef(null)
      const panelRef = useRef(null)
      const position = useAnchoredPosition(open, triggerRef)

      const close = useCallback(() => setOpen(false), [])

      useEffect(() => {
        if (!open) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape') close()
        }
        const onPointer = (event) => {
          const target = event.target
          if (rootRef.current && rootRef.current.contains(target)) return
          if (panelRef.current && panelRef.current.contains(target)) return
          close()
        }
        document.addEventListener('keydown', onKey)
        document.addEventListener('pointerdown', onPointer, true)
        return () => {
          document.removeEventListener('keydown', onKey)
          document.removeEventListener('pointerdown', onPointer, true)
        }
      }, [open, close])

      let snapshot = null
      try {
        snapshot = useTurnStats ? useTurnStats((value) => value) : null
      } catch (error) {
        snapshot = null
      }

      // Derived data is fully guarded: an unexpected snapshot shape degrades
      // to the simple pill, never to a render error that drops the entry.
      let turn = null
      let tps = null
      let output = null
      let state = null
      let rows = []
      try {
        turn = pickTurn(snapshot)
        tps = formatTps(turnTps(turn))
        output = turn ? formatTokens(turn.output) : null
        state = turnState(turn, t)
        rows = buildRows(turn, t)
      } catch (error) {
        tps = null
      }
      // Published even when the pill itself degrades: the footer line does not
      // depend on tps being measurable.
      try {
        publishSnapshotTurns(snapshot && Array.isArray(snapshot.turns) ? snapshot.turns : null)
      } catch (error) {
        // Optional annotation only.
      }
      if (tps === null) return null

      const pillChildren = [
        React.createElement(BoltIcon, { key: 'icon' }),
        React.createElement('span', { className: CLS.label, key: 'label' }, t('pill.label', { tps })),
      ]
      if (output !== null) {
        pillChildren.push(
          React.createElement('span', { className: CLS.sub, key: 'sub' }, t('pill.output', { output })),
        )
      }

      const panelNode = open && position && typeof document !== 'undefined'
        ? React.createElement(
          'div',
          {
            key: 'panel',
            ref: panelRef,
            className: CLS.panel,
            style: position,
            role: 'dialog',
            'aria-label': t('panel.title'),
          },
          React.createElement(
            'div',
            { className: CLS.head },
            React.createElement(
              'span',
              { style: { display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
              React.createElement(BoltIcon),
              t('panel.title'),
            ),
            React.createElement('span', { className: CLS.headValue }, t('pill.label', { tps })),
          ),
          React.createElement('div', { className: CLS.rule, 'aria-hidden': true }),
          rows.length > 0
            ? React.createElement(
              'dl',
              { className: CLS.grid },
              rows.flatMap(([label, value], index) => [
                React.createElement('dt', { key: 'dt' + index }, label),
                React.createElement('dd', { key: 'dd' + index }, value),
              ]),
            )
            : React.createElement('div', { className: CLS.foot }, t('empty')),
          React.createElement(
            'div',
            { className: CLS.foot },
            [turn ? t('panel.turn', { turn: turn.turn }) : null, state].filter(Boolean).join(' · '),
          ),
        )
        : null

      // The panel MUST live in document.body: the docked composer card
      // contains this slot and its backdrop layer clips fixed descendants.
      // createPortal is available (react-dom is a module-table entry); the
      // inline fallback only exists for a degraded environment.
      const panel = panelNode === null
        ? null
        : (createPortal !== null ? createPortal(panelNode, document.body) : panelNode)

      return React.createElement(
        'span',
        { className: CLS.anchor, 'data-composer-stat': SLOT_ID, ref: rootRef },
        React.createElement(
          'button',
          {
            type: 'button',
            ref: triggerRef,
            className: CLS.pill,
            'aria-haspopup': 'dialog',
            'aria-expanded': open,
            onClick: () => setOpen(!open),
          },
          pillChildren,
        ),
        panel,
      )
    }

    /**
     * Observable adapter over the stats conversation-view target. Both
     * callbacks resolve the binding lazily, so a Session that opens after the
     * pill mounts still starts reporting.
     */
    function createTurnStatsSource(ctx, sessionId) {
      const target = () => {
        try {
          const service = ctx.uiConversation
          if (!service) return undefined
          const binding = service.binding(sessionId)
          return binding ? binding.target('stats') : undefined
        } catch (error) {
          return undefined
        }
      }
      return {
        getSnapshot: () => {
          try {
            const view = target()
            return view ? (view.getSnapshot() ?? null) : null
          } catch (error) {
            return null
          }
        },
        subscribe: (listener) => {
          try {
            const view = target()
            return view ? view.subscribe(listener) : () => {}
          } catch (error) {
            return () => {}
          }
        },
      }
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'turn-tps: dictionaries')

      // session-scoped list slot: the renderer hands `inject` the Session id.
      ctx.slots.inject(SLOT, () => ctx.slots.register({
        name: SLOT,
        id: SLOT_ID,
        order: 2,
        locale: NS,
        inject: (sessionId) => {
          // Remember which Session this dock belongs to so the reset point is
          // stored under that Session's own key. No id means memory-only.
          try {
            captureSession(sessionId)
          } catch (error) {
            // Keep the pill working; the baseline just stays in memory.
          }
          return {
            hooks: { turnStats: createTurnStatsSource(ctx, sessionId) },
          }
        },
      }, TurnTpsPill))

      // The footer row is re-rendered by chat on every message update, so the
      // annotation is re-applied whenever the document changes underneath it.
      if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver((records) => {
          // A footer attached later in flow becomes the newest annotation
          // target; invalidating the cached placement makes the next sync
          // rescan. Every other (streamed) mutation keeps the cheap path.
          if (taskAnchor !== null && mutationAddsFooter(records)) taskAnchor = null
          scheduleTaskSync()
        })
        observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        ctx.effect(() => () => {
          observer.disconnect()
          taskAnchor = null
          for (const node of document.querySelectorAll('[' + TASK_TIME_ATTR + ']')) node.remove()
          for (const label of document.querySelectorAll('[' + TURN_MODEL_ATTR + ']')) label.remove()
        }, 'turn-tps: footer observer')
      }
      scheduleTaskSync()
      syncTurnModels(true)
    }

    // Test seam: headless pages set window.__DTT_TEST__ to drive the footer
    // annotation without a full React render.
    if (typeof window !== 'undefined' && window.__DTT_TEST__ !== undefined) {
      window.__DTT_TEST__.setTaskTime = setTaskTime
      window.__DTT_TEST__.syncTaskTime = syncTaskTime
      window.__DTT_TEST__.syncTurnModels = syncTurnModels
      window.__DTT_TEST__.formatTurnRoutes = formatTurnRoutes
      // Simulate one stats snapshot update: turns carry wall seconds here, so
      // the page can write [60, 60, 60] instead of [60000, 60000, 60000].
      window.__DTT_TEST__.setTurns = (turns) => {
        try {
          lastTurns = normalizeSeamTurns(turns)
          publishTaskTotal(computeTaskTotal(lastTurns))
          syncTaskTime()
        } catch (error) {
          // Seam only.
        }
      }
      // Simulate the renderer handing a Session id to the slot injector.
      window.__DTT_TEST__.setSession = (sessionId) => {
        try {
          captureSession(typeof sessionId === 'string' ? sessionId : null)
          syncTaskTime()
        } catch (error) {
          // Seam only.
        }
      }
      // Current reset point; wall is reported in seconds to match setTurns().
      window.__DTT_TEST__.getBaseline = () => (
        taskBaseline === null
          ? null
          : {
            baseIndex: taskBaseline.baseIndex,
            baseWall: Math.round(taskBaseline.baseWall) / 1000,
          }
      )
    }

    return { apply, inject: ['slots', 'uiConversation', 'locale'] }
  },
})
