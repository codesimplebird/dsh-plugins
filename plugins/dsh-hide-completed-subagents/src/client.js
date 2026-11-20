// dsh-hide-completed-subagents: CLIENT half.
//
// The built-in subagent roster (`@deepseek-ai/dsh-client-ui-subagent`) keeps
// every finished child session so its transcript stays reachable, and 0.2.2
// ships no setting to change that: the `ui-subagent` row in the web-app patch
// carries no config, and its client bundle contains no Schema/settings code.
// This plugin adds the missing behaviour for user choice "A": finished rows
// are removed from the roster, while running / idle / external rows stay.
//
// Why the DOM and not the data: the roster is rendered by a shipped component
// from a projection this plugin cannot re-register, and the only stable,
// documented hooks are DOM attributes emitted by that component:
//   [data-subagent-panel]        the roster popover (portaled to <body>)
//   [role="treeitem"]            one subagent row
//   aria-label                   "[label] [name] [mode · activity] [metrics]"
// The activity word is NOT rendered as visible text — it only exists inside
// aria-label, which makes aria-label the reliable carrier of the state.
//
// Matched states: activity.completed ("已完成" / "completed"). Running
// ("正在运行"), idle ("当前未运行") and external rows are left untouched.
//
// Everything is defensive: no panel, no rows or a missing document simply
// means nothing to do. Unloading the plugin removes both the observer and the
// stylesheet, and the rows come back on the next render.
window.__ModuleLoader__.load({
  id: 'dsh-hide-completed-subagents',
  factory: () => {
    const STYLE_ID = 'dsh-hide-completed-subagents-style'
    const ROW_CLASS = 'dsh-hide-completed-subagent-row'
    const PANEL_SELECTOR = '[data-subagent-panel]'
    const ROW_SELECTOR = '[role="treeitem"]'

    // activity.completed as localised by the shipped dictionaries; the plugin
    // follows the active UI language, so both are matched.
    const COMPLETED_PATTERN = /已完成|\bcompleted\b/i

    const CSS = '.' + ROW_CLASS + ' { display: none !important; }\n'

    function ensureStyle() {
      try {
        if (typeof document === 'undefined') return
        if (document.getElementById(STYLE_ID)) return
        const style = document.createElement('style')
        style.id = STYLE_ID
        style.textContent = CSS
        document.head.appendChild(style)
      } catch (error) {
        // Styling is the whole mechanism here, but a failure must stay silent.
      }
    }

    /** Re-mark every row of every open roster panel. */
    function applyFilter() {
      try {
        if (typeof document === 'undefined') return
        const panels = document.querySelectorAll(PANEL_SELECTOR)
        for (const panel of panels) {
          const rows = panel.querySelectorAll(ROW_SELECTOR)
          for (const row of rows) {
            const label = row.getAttribute('aria-label') || ''
            row.classList.toggle(ROW_CLASS, COMPLETED_PATTERN.test(label))
          }
        }
      } catch (error) {
        // A detached node mid-render is not a failure worth surfacing.
      }
    }

    /** Coalesce bursts of DOM mutations into one pass per frame. */
    function createScheduler() {
      let scheduled = false
      return () => {
        if (scheduled) return
        scheduled = true
        const run = () => {
          scheduled = false
          applyFilter()
        }
        try {
          requestAnimationFrame(run)
        } catch (error) {
          setTimeout(run, 16)
        }
      }
    }

    function apply(ctx) {
      ensureStyle()
      const schedule = createScheduler()

      if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(schedule)
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['aria-label'],
        })
        try {
          ctx.effect(() => () => observer.disconnect(), 'hide-completed-subagents: observer')
        } catch (error) {
          // Without a disposer the observer simply lives with the page.
        }
        schedule()
      }

      try {
        ctx.effect(() => () => {
          try {
            const style = document.getElementById(STYLE_ID)
            if (style) style.remove()
            for (const row of document.querySelectorAll('.' + ROW_CLASS)) {
              row.classList.remove(ROW_CLASS)
            }
          } catch (error) {
            // Best-effort cleanup only.
          }
        }, 'hide-completed-subagents: stylesheet')
      } catch (error) {
        // Same as above.
      }
    }

    return { apply, inject: [] }
  },
})
