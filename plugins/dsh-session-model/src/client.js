// dsh-session-model: CLIENT half.
//
// Shows which model a Conversation is using, right in the Session header.
// Main conversations and subagent conversations share the same header slot
// (`conversation.session.header.utilities`, session scope), so both get the
// badge; switching the model via the composer seat or /model updates it live.
//
// Data sources, in order:
//   1. `ctx.sessions.binding(sessionId).session.projections.faceOf('modelSelection')`
//      → ModelSelectionProjectionState { lastUsed, pending } — the same durable
//      projection the official model-selection plugin renders from. `pending`
//      wins over `lastUsed`: a selection recorded but not yet used by a request.
//   2. `ctx.get('modelDirectories').directoryFor(sessionId).store` — optional;
//      supplies friendly provider/model names and the retained effort caption.
//      Addressed subagent sessions cannot load the catalog, but their projection
//      is enough for the badge; the directory is best-effort only.
//
// Defensive by construction: a missing binding, a missing service, a malformed
// projection or an unloaded catalog must hide the badge, never break the header.
window.__ModuleLoader__.load({
  id: 'dsh-session-model',
  factory: (require) => {
    const React = require('react')
    const { useEffect, useState } = React

    const NS = 'session-model'
    const SLOT = 'conversation.session.header.utilities'
    const SLOT_ID = 'session-model-badge'
    const CLS = 'dsm-badge'

    const zh = {
      model: '模型',
      title: '当前会话使用的模型',
    }
    const en = {
      model: 'Model',
      title: 'Model used by this session',
    }

    /** Read a ModelSelection from either projection shape, defensively. */
    function pickSelection(state) {
      if (state === null || typeof state !== 'object') return null
      const pending = state.pending
      const lastUsed = state.lastUsed
      const candidate = (pending !== null && typeof pending === 'object' ? pending : null)
        ?? (lastUsed !== null && typeof lastUsed === 'object' ? lastUsed : null)
      if (candidate === null) return null
      if (typeof candidate.provider !== 'string' || candidate.provider === '') return null
      if (typeof candidate.model !== 'string' || candidate.model === '') return null
      return {
        provider: candidate.provider,
        model: candidate.model,
        ...(typeof candidate.reasoningEffort === 'string' && candidate.reasoningEffort !== ''
          ? { reasoningEffort: candidate.reasoningEffort }
          : {}),
      }
    }

    /** Resolve provider/model display names from the catalog groups when present. */
    function modelLabel(selection, groups) {
      const label = { providerName: selection.provider, modelName: selection.model }
      if (!Array.isArray(groups)) return label
      for (const group of groups) {
        if (group === null || typeof group !== 'object' || group.id !== selection.provider) continue
        if (typeof group.name === 'string' && group.name !== '') label.providerName = group.name
        const models = Array.isArray(group.models) ? group.models : []
        for (const model of models) {
          if (model === null || typeof model !== 'object' || model.id !== selection.model) continue
          if (typeof model.name === 'string' && model.name !== '') label.modelName = model.name
          break
        }
        break
      }
      return label
    }

    /** Visible chip text: model name, plus `· effort` when the session pinned one. */
    function badgeText(selection, groups, retainedEffort) {
      if (selection === null) return null
      const label = modelLabel(selection, groups)
      const effort = typeof selection.reasoningEffort === 'string' && selection.reasoningEffort !== ''
        ? selection.reasoningEffort
        : (typeof retainedEffort === 'string' && retainedEffort !== '' ? retainedEffort : null)
      return effort === null ? label.modelName : `${label.modelName} · ${effort}`
    }

    /** Full tooltip: provider + model + effort, so same-named models stay distinguishable. */
    function badgeTitle(selection, groups, retainedEffort, dict) {
      const label = modelLabel(selection, groups)
      const effort = typeof selection.reasoningEffort === 'string' && selection.reasoningEffort !== ''
        ? selection.reasoningEffort
        : (typeof retainedEffort === 'string' && retainedEffort !== '' ? retainedEffort : null)
      const head = (dict && dict.title) || zh.title
      return `${head}: ${label.providerName} / ${label.modelName}${effort === null ? '' : ` · ${effort}`}`
    }

    /**
     * One Session's live model source. Subscribes once to the durable
     * projection and (when available) the shared model directory; listeners
     * only receive a "something changed" ping and re-read getSnapshot().
     */
    function createModelSource(ctx, sessionId) {
      let projectionFace = null
      let directoryStore = null
      let directoryState = null

      try {
        const sessions = ctx && ctx.sessions
        if (sessions && typeof sessions.binding === 'function') {
          const binding = sessions.binding(sessionId)
          const session = binding && binding.session
          const projections = session && session.projections
          if (projections && typeof projections.faceOf === 'function') {
            const face = projections.faceOf('modelSelection')
            if (face && typeof face.getSnapshot === 'function' && typeof face.subscribe === 'function') {
              projectionFace = face
            }
          }
        }
      } catch (error) {
        // No binding yet (header rendered before the session materialised).
      }

      try {
        const directories = typeof ctx.get === 'function' ? ctx.get('modelDirectories') : null
        if (directories && typeof directories.directoryFor === 'function') {
          const directory = directories.directoryFor(sessionId)
          if (directory && directory.store && typeof directory.store.getSnapshot === 'function'
            && typeof directory.store.subscribe === 'function') {
            directoryStore = directory.store
          }
        }
      } catch (error) {
        // Addressed subagent sessions resolve no directory: projection only.
      }

      const listeners = new Set()
      const emit = () => {
        for (const listener of Array.from(listeners)) {
          try { listener() } catch (error) { /* One broken listener must not stop the rest. */ }
        }
      }
      const unsubscribers = []
      if (projectionFace !== null) {
        try { unsubscribers.push(projectionFace.subscribe(emit)) } catch (error) { /* Ignore. */ }
      }
      if (directoryStore !== null) {
        try { unsubscribers.push(directoryStore.subscribe(emit)) } catch (error) { /* Ignore. */ }
      }

      function snapshot() {
        try {
          if (directoryStore !== null) directoryState = directoryStore.getSnapshot()
        } catch (error) {
          directoryState = null
        }
        let projected = null
        try {
          if (projectionFace !== null) projected = pickSelection(projectionFace.getSnapshot())
        } catch (error) {
          projected = null
        }
        const current = directoryState && directoryState.current !== undefined ? directoryState.current : null
        const groups = directoryState && Array.isArray(directoryState.groups) ? directoryState.groups : null
        const retainedEffort = directoryState && typeof directoryState.retainedEffort === 'string'
          ? directoryState.retainedEffort
          : null
        return { selection: projected ?? current, groups, retainedEffort }
      }

      function subscribe(listener) {
        if (typeof listener === 'function') listeners.add(listener)
        return () => { listeners.delete(listener) }
      }

      function dispose() {
        for (const off of unsubscribers.splice(0)) {
          try { if (typeof off === 'function') off() } catch (error) { /* Ignore. */ }
        }
        listeners.clear()
      }

      return { getSnapshot: snapshot, subscribe, dispose }
    }

    /** One header chip: model name (+effort), full identity in the tooltip. */
    function ModelBadge(props) {
      const { model, t } = props
      const [view, setView] = useState(() => model.getSnapshot())

      useEffect(() => {
        setView(model.getSnapshot())
        return model.subscribe(() => setView(model.getSnapshot()))
      }, [model])

      const selection = view && view.selection ? view.selection : null
      if (selection === null) return null
      const dict = typeof t === 'function'
        ? { model: t('model') || zh.model, title: t('title') || zh.title }
        : zh
      const text = badgeText(selection, view.groups, view.retainedEffort)
      if (text === null) return null
      return React.createElement('span', {
        className: CLS,
        'data-session-model': `${selection.provider}/${selection.model}`,
        title: badgeTitle(selection, view.groups, view.retainedEffort, dict),
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          maxWidth: '240px',
          minWidth: '0',
          padding: '1px 8px',
          marginRight: '2px',
          font: 'inherit',
          fontSize: 'calc(var(--dsh-content-font-size-secondary, 13px) - 2px)',
          lineHeight: '18px',
          color: 'var(--dsw-alias-label-secondary, #8a8f98)',
          background: 'color-mix(in srgb, var(--dsw-alias-label-secondary, #8a8f98) 8%, transparent)',
          border: '1px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.25))',
          borderRadius: '999px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }, text)
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-model: dictionaries')

      const sources = new Map()
      function sourceFor(sessionId) {
        const key = String(sessionId)
        let source = sources.get(key)
        if (source === undefined) {
          source = createModelSource(ctx, sessionId)
          sources.set(key, source)
        }
        return source
      }

      ctx.slots.inject(SLOT, () => ctx.slots.register({
        name: SLOT,
        id: SLOT_ID,
        order: 20,
        locale: NS,
        inject: (sessionId) => ({ model: sourceFor(sessionId) }),
      }, ModelBadge))

      ctx.effect(() => () => {
        for (const source of sources.values()) {
          try { source.dispose() } catch (error) { /* Ignore. */ }
        }
        sources.clear()
      }, 'session-model: sources')
    }

    // Test seam: headless pages set window.__DSM_TEST__ before the bundle runs.
    if (typeof window !== 'undefined' && window.__DSM_TEST__ !== undefined) {
      window.__DSM_TEST__.pickSelection = pickSelection
      window.__DSM_TEST__.modelLabel = modelLabel
      window.__DSM_TEST__.badgeText = badgeText
      window.__DSM_TEST__.badgeTitle = badgeTitle
      window.__DSM_TEST__.createModelSource = createModelSource
    }

    return { apply, inject: ['slots', 'locale', 'sessions'] }
  },
})
