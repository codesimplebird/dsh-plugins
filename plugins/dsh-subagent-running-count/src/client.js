// dsh-subagent-running-count: CLIENT half.
//
// Display-only tweaks to the built-in subagent roster and its chip. No data is
// written, nothing is clicked, no DSH service is called.
//
// 1) CHIP — renders the TOTAL roster size, so finished children keep being
//    advertised. Rewrite it to the RUNNING count, reusing the hidden
//    accessibility span the component already emits while runningCount > 0:
//
//      {variant === 'count' && runningCount > 0 && (
//        <span id={activityId} hidden>{t(runningCountKey, {count: runningCount})}</span>
//      )}
//      <span data-subagent-count>{t(totalCountKey, {count: directCount})}</span>
//
//    Absence of that span means zero, and zero renders no label at all.
//
// 2) ORDER + TIMES — the catalog arrives in EVENT order (oldest first) and no
//    per-row wall clock is rendered. Each catalog entry carries `createdAt`
//    (epoch ms) in its schema, consumed by the component but never rendered,
//    so it is read off React's fiber tree: walk up from a row to the nearest
//    component whose props hold `catalog.entries`, map label/name/id ->
//    createdAt, then match each row by its own text.
//
//    Rows are re-ordered NEWEST FIRST and stamped with HH:MM (MM/DD HH:MM
//    when not today). Both steps are per-row and independent of any container
//    role, so neither can be disabled by an unexpected wrapper element.
//
// 3) COLLAPSE — past COLLAPSE_AFTER rows the OLDEST fold away behind a
//    "显示其余 N 条" control; the newest always stay visible.
//
// Every step is isolated in its own try/catch: a failure in one never
// disables the others.
window.__ModuleLoader__.load({
  id: 'dsh-subagent-running-count',
  factory: () => {
    const CHIP_SELECTOR = '[data-subagent-count]'
    const PANEL_SELECTOR = '[data-subagent-panel]'
    const ROW_SELECTOR = '[role="treeitem"]'

    const RUNNING_PATTERN = /正在运行|\brunning\b/i
    const ZH_PATTERN = /^zh/i

    const TIME_CLASS = 'dsh-roster-time'
    const HIDDEN_CLASS = 'dsh-roster-row-collapsed'
    const TOGGLE_ATTR = 'data-dsh-roster-toggle'
    const COLLAPSE_AFTER = 8

    /** Per-panel expansion state; panels are recreated on every open. */
    const expandedPanels = new WeakSet()

    // ------------------------------------------------------------------ utils
    function isChinese() {
      try {
        return ZH_PATTERN.test(document.documentElement.lang || '')
      } catch (error) {
        return true
      }
    }

    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    function formatCreatedAt(ms) {
      try {
        const date = new Date(ms)
        if (Number.isNaN(date.getTime())) return ''
        const now = new Date()
        const sameDay = date.getFullYear() === now.getFullYear()
          && date.getMonth() === now.getMonth()
          && date.getDate() === now.getDate()
        const clock = pad2(date.getHours()) + ':' + pad2(date.getMinutes())
        return sameDay ? clock : pad2(date.getMonth() + 1) + '/' + pad2(date.getDate()) + ' ' + clock
      } catch (error) {
        return ''
      }
    }

    // ------------------------------------------------------- chip: running count
    function readRunningCount(chip) {
      let node = chip
      for (let depth = 0; depth < 5 && node; depth += 1) {
        const parent = node.parentElement
        if (!parent) break
        for (const candidate of parent.querySelectorAll(':scope > span[hidden]')) {
          const text = (candidate.textContent || '').trim()
          if (!text || !RUNNING_PATTERN.test(text)) continue
          const match = text.match(/(\d+)/)
          if (match) return Number(match[1])
        }
        node = parent
      }
      return null
    }

    function rewriteChip(chip) {
      const running = readRunningCount(chip)
      const zh = isChinese()
      const desired = running === null || running <= 0
        ? ''
        : (zh
          ? `${running} 个子智能体运行中`
          : `${running} subagent${running === 1 ? '' : 's'} running`)
      if (chip.textContent === desired) return
      chip.textContent = desired
    }

    // ------------------------------------------------- fiber: createdAt lookup
    function fiberOf(element) {
      try {
        const key = Object.keys(element).find((name) => name.startsWith('__reactFiber$'))
        return key === undefined ? null : element[key]
      } catch (error) {
        return null
      }
    }

    /** Map label/name/id -> createdAt for every catalog reachable from element. */
    function collectCreatedAt(element) {
      const map = new Map()
      let fiber = fiberOf(element)
      for (let depth = 0; fiber && depth < 40; depth += 1) {
        const props = fiber.memoizedProps
        const catalog = props && props.catalog
        if (catalog && Array.isArray(catalog.entries)) {
          for (const entry of catalog.entries) {
            if (typeof entry?.createdAt !== 'number') continue
            for (const key of [entry.label, entry.name, entry.id]) {
              if (typeof key === 'string' && key !== '' && !map.has(key)) map.set(key, entry.createdAt)
            }
          }
        }
        fiber = fiber.return
      }
      return map
    }

    function lookupCreatedAt(row, map) {
      if (map.size === 0) return undefined
      const text = (row.textContent || '').trim()
      if (!text) return undefined
      let best
      for (const [key, value] of map) {
        if (!text.includes(key)) continue
        if (best === undefined || key.length > best.key.length) best = { key, value }
      }
      return best === undefined ? undefined : best.value
    }

    // --------------------------------------------------------- time stamping
    function stampRow(row, createdAt) {
      const existing = row.querySelector(':scope > .' + TIME_CLASS)
      if (createdAt === undefined) {
        if (existing) existing.remove()
        return
      }
      const formatted = formatCreatedAt(createdAt)
      if (formatted === '') return
      if (existing !== null) {
        if (existing.textContent !== formatted) existing.textContent = formatted
        return
      }
      const span = document.createElement('span')
      span.className = TIME_CLASS
      span.textContent = formatted
      try { span.title = new Date(createdAt).toLocaleString() } catch (error) { /* ignore */ }
      span.style.cssText = 'flex:none;margin-left:8px;font-variant-numeric:tabular-nums;'
        + 'font-size:11px;opacity:.65;color:var(--dsw-alias-label-tertiary,inherit);'
      try { row.appendChild(span) } catch (error) { /* best effort */ }
    }

    // ------------------------------------------------------- order + collapse
    //
    // The shipped component wraps every row in an outer element:
    //
    //   <div class="node">                 <- wrapper, one per entry
    //     <div role="treeitem"> … </div>   <- the row
    //     <div role="group"> …children… </div>   (only while expanded)
    //   </div>
    //
    // so a row's parentElement holds exactly one row and is useless as a list
    // container. The list is the deepest ancestor that contains every row; each
    // of its direct children is then one movable block (wrapper + nested group).

    /** Deepest element that contains every given row. */
    function commonContainer(rows) {
      if (rows.length === 0) return null
      let node = rows[0].parentElement
      while (node !== null) {
        let holdsAll = true
        for (const row of rows) {
          if (!node.contains(row)) { holdsAll = false; break }
        }
        if (holdsAll) return node
        node = node.parentElement
      }
      return null
    }

    /**
     * Turn a container's direct children into blocks. A block starts at the
     * child holding a row (the row itself, or a wrapper around it) and absorbs
     * the siblings that follow it until the next row-bearing child.
     */
    function collectBlocks(container) {
      const blocks = []
      let current = null
      for (const child of Array.from(container.children)) {
        let row = null
        try {
          row = child.matches(ROW_SELECTOR) ? child : child.querySelector(ROW_SELECTOR)
        } catch (error) {
          row = null
        }
        if (row !== null) {
          current = { anchor: child, row }
          blocks.push(current)
        } else if (current !== null) {
          current.trailing = (current.trailing || []).concat(child)
        }
      }
      return blocks
    }

    /** Newest first; rows without createdAt keep their relative position last. */
    function sortBlocks(blocks, createdAtOf) {
      return blocks
        .map((block, index) => ({ block, index, createdAt: createdAtOf(block.row) }))
        .sort((a, b) => {
          if (a.createdAt === undefined && b.createdAt === undefined) return a.index - b.index
          if (a.createdAt === undefined) return 1
          if (b.createdAt === undefined) return -1
          if (b.createdAt === a.createdAt) return a.index - b.index
          return b.createdAt - a.createdAt
        })
        .map((item) => item.block)
    }

    function reorderContainer(container, blocks, createdAtOf) {
      if (blocks.length < 2) return blocks
      const ordered = sortBlocks(blocks, createdAtOf)
      const changed = ordered.some((block, index) => block !== blocks[index])
      if (!changed) return blocks
      try {
        const fragment = document.createDocumentFragment()
        for (const block of ordered) {
          fragment.appendChild(block.anchor)
          for (const extra of block.trailing || []) fragment.appendChild(extra)
        }
        container.appendChild(fragment)
      } catch (error) {
        return blocks
      }
      return ordered
    }

    function setBlockHidden(block, hidden) {
      const nodes = [block.anchor, ...(block.trailing || [])]
      for (const node of nodes) {
        if (hidden) {
          node.classList.add(HIDDEN_CLASS)
          node.style.display = 'none'
        } else if (node.classList.contains(HIDDEN_CLASS)) {
          node.classList.remove(HIDDEN_CLASS)
          node.style.removeProperty('display')
        }
      }
    }

    function ensureToggle(panel, overflowCount, expanded) {
      const existing = panel.querySelector('[' + TOGGLE_ATTR + ']')
      const zh = isChinese()
      if (overflowCount <= 0) {
        if (existing) existing.remove()
        return
      }
      const label = expanded
        ? (zh ? '收起较长列表' : 'Collapse list')
        : (zh ? `显示其余 ${overflowCount} 条` : `Show ${overflowCount} more`)
      let button = existing
      if (!button) {
        button = document.createElement('button')
        button.setAttribute(TOGGLE_ATTR, 'true')
        button.type = 'button'
        button.style.cssText = 'display:block;width:100%;padding:6px 10px;margin:2px 0 0;'
          + 'border:0;border-radius:6px;background:transparent;cursor:pointer;text-align:left;'
          + 'font:inherit;font-size:12px;color:var(--dsw-alias-label-secondary,inherit);'
        button.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          const owner = button.closest(PANEL_SELECTOR)
          if (!owner) return
          if (expandedPanels.has(owner)) expandedPanels.delete(owner)
          else expandedPanels.add(owner)
          applyRewrite()
        })
        panel.appendChild(button)
      }
      if (button.textContent !== label) button.textContent = label
    }

    function decoratePanel(panel) {
      const rows = Array.from(panel.querySelectorAll(ROW_SELECTOR))
      if (rows.length === 0) {
        ensureToggle(panel, 0, false)
        return
      }

      // 1) creation times, per row, independent of the list structure.
      const createdAt = new Map()
      for (const row of rows) {
        try {
          const value = lookupCreatedAt(row, collectCreatedAt(row))
          if (value !== undefined) createdAt.set(row, value)
          stampRow(row, value)
        } catch (error) {
          // One bad row must not stop the rest.
        }
      }

      // 2) newest first, at the level that holds every row.
      const container = commonContainer(rows)
      if (container === null) {
        ensureToggle(panel, 0, false)
        return
      }
      const createdAtOf = (row) => createdAt.get(row)
      let blocks
      try {
        blocks = reorderContainer(container, collectBlocks(container), createdAtOf)
      } catch (error) {
        blocks = collectBlocks(container)
      }

      // 3) collapse the OLDEST; the newest stay visible.
      const expanded = expandedPanels.has(panel)
      const overflow = blocks.length > COLLAPSE_AFTER ? blocks.length - COLLAPSE_AFTER : 0
      const hiddenFrom = expanded || overflow === 0 ? Number.POSITIVE_INFINITY : COLLAPSE_AFTER
      blocks.forEach((block, index) => {
        try { setBlockHidden(block, index >= hiddenFrom) } catch (error) { /* ignore */ }
      })

      ensureToggle(panel, overflow, expanded)
    }

    // ----------------------------------------------------------------- passes
    function applyRewrite() {
      try {
        if (typeof document === 'undefined') return
        for (const chip of document.querySelectorAll(CHIP_SELECTOR)) {
          try { rewriteChip(chip) } catch (error) { /* ignore */ }
        }
        for (const panel of document.querySelectorAll(PANEL_SELECTOR)) {
          try { decoratePanel(panel) } catch (error) { /* ignore */ }
        }
      } catch (error) {
        // A detached node mid-render is not a failure worth surfacing.
      }
    }

    function createScheduler() {
      let scheduled = false
      return () => {
        if (scheduled) return
        scheduled = true
        const run = () => {
          scheduled = false
          applyRewrite()
        }
        try {
          requestAnimationFrame(run)
        } catch (error) {
          setTimeout(run, 16)
        }
      }
    }

    function apply(ctx) {
      const schedule = createScheduler()

      if (typeof document !== 'undefined' && typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(schedule)
        observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        try {
          ctx.effect(() => () => observer.disconnect(), 'subagent-running-count: observer')
        } catch (error) {
          // Without a disposer the observer simply lives with the page.
        }
      }

      schedule()
    }

    return { apply, inject: [] }
  },
})
