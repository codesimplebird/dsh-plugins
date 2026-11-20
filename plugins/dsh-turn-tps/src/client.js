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
        inject: (sessionId) => ({
          hooks: { turnStats: createTurnStatsSource(ctx, sessionId) },
        }),
      }, TurnTpsPill))
    }

    return { apply, inject: ['slots', 'uiConversation', 'locale'] }
  },
})
