var __wpvHmrLogger = __wpvHmrLogger ?? __WPV_HMR_LOGGER__
var __wpvHmrDebounceMs = __WPV_HMR_DEBOUNCE_MS__
var __wpvHmrEntryStylesheet = '/src/styles/vite-blocks-editor.css'

if (import.meta.hot) {
    __wpvHmrLogger.log('HMR enabled for WordPress block')

    setupRegisterGuard()

    import.meta.hot.accept(() => {
        __wpvHmrLogger.log('JS/TS module updated via HMR')
        dispatchHmrEvent(window, 'wp-vite-block-hmr-update', {source: 'js-update'})
    })

    import.meta.hot.on('vite:beforeUpdate', ({updates}) => {
        storeLastUpdates(updates)
        const {jsUpdates, cssUpdates} = categorizeUpdates(updates)
        const hasJsUpdate = jsUpdates.length > 0

        removeDuplicateAndDeferredCssUpdates(updates, cssUpdates, hasJsUpdate)
        __wpvHmrLogger.log('HMR update detected:', updates.length, 'files')

        const editor = getEditorDocument()
        if (!editor) {
            __wpvHmrLogger.warn('WordPress editor iframe not found, falling back to main document')
            processHmrUpdates(document, updates)
            return
        }

        processJsUpdates(editor, jsUpdates)
    })

    import.meta.hot.on('vite:afterUpdate', ({updates}) => {
        const queuedCssUpdates = consumeQueuedCssUpdates()
        const {jsUpdates} = categorizeUpdates(updates)
        if (jsUpdates.length > 0) return

        const cssUpdates = queuedCssUpdates.length > 0 ? queuedCssUpdates : updates
        const cssPaths = extractUniqueCssPaths(cssUpdates)
        if (cssPaths.length === 0) return

        const editor = getEditorDocument() || document
        void processCssHmrUpdates(editor, cssPaths, Date.now())
    })
}

function setupRegisterGuard() {
    const wpBlocks = typeof window !== 'undefined' ? window.wp?.blocks : null
    if (!wpBlocks?.registerBlockType || !wpBlocks?.getBlockType || wpBlocks.__wpvHmrRegisterGuard) return

    try {
        const descriptor = Object.getOwnPropertyDescriptor(wpBlocks, 'registerBlockType')
        if (descriptor && !descriptor.writable && !descriptor.set && !descriptor.configurable) return

        const originalRegister = wpBlocks.registerBlockType
        const getBlockType = wpBlocks.getBlockType
        wpBlocks.registerBlockType = (name, settings) => getBlockType(name) || originalRegister(name, settings)
        wpBlocks.__wpvHmrRegisterGuard = true
    } catch {}
}

function applyBlockHmrFromPath(path, batchTimestamp) {
    if (typeof window === 'undefined') return

    const cleanPath = stripQuery(path)
    const match = cleanPath.match(/\/src\/blocks\/([^/]+)\/(edit|save)\.(tsx?|jsx?)$/)
    if (!match) return

    const now = Date.now()
    const inFlightRequests = window.__wpvInFlightRequests || (window.__wpvInFlightRequests = new Map())
    const existing = inFlightRequests.get(cleanPath)

    if (existing && (now - existing.time) < __wpvHmrDebounceMs) {
        __wpvHmrLogger.debug?.('[wp-vite] HMR: skipping duplicate request for', cleanPath)
        return existing.promise
    }

    inFlightRequests.set(cleanPath, {promise: null, time: now})
    const timestamp = batchTimestamp || now
    const [, blockDir, componentType] = match

    const wpBlocks = window.wp?.blocks
    const metaByDir = window.__wpvBlockMetaByDir
    const mappedMeta = metaByDir?.[blockDir]
    const mappedName = mappedMeta?.name
    const current = mappedName ? wpBlocks?.getBlockType?.(mappedName) : null

    const origin = getViteOrigin()
    const withOrigin = (modulePath) => resolveWithOrigin(modulePath, origin)

    const loader = typeof window.__wpvBlockHmrLoader === 'function'
        ? window.__wpvBlockHmrLoader
        : (modulePath) => import(/* @vite-ignore */ modulePath)

    const applyLoaderPromise = typeof window.__wpvBlockHmrApply === 'function'
        ? Promise.resolve(window.__wpvBlockHmrApply)
        : import(/* @vite-ignore */ '/@id/virtual:vite-plugin-wp/block-hmr').then((mod) => mod.applyBlockHmr)

    const loadModule = () => loader(`${withOrigin(cleanPath)}?t=${timestamp}`)

    const trackPromise = (promise) => {
        const entry = inFlightRequests.get(cleanPath)
        if (entry) entry.promise = promise
        promise.catch(() => inFlightRequests.delete(cleanPath)).finally(() => {
            setTimeout(() => {
                const currentEntry = inFlightRequests.get(cleanPath)
                if (currentEntry && currentEntry.time === now) inFlightRequests.delete(cleanPath)
            }, __wpvHmrDebounceMs)
        })
        return promise
    }

    if (current && mappedMeta) {
        const promise = Promise.all([loadModule(), applyLoaderPromise]).then(([mod, applyBlockHmr]) => {
            if (typeof applyBlockHmr !== 'function') return
            const nextEdit = componentType === 'edit' ? (mod?.default ?? mod?.edit ?? mod) : current.edit
            const nextSave = componentType === 'save' ? (mod?.default ?? mod?.save ?? mod) : current.save
            applyBlockHmr({meta: mappedMeta, edit: nextEdit, save: nextSave}, {meta: mappedMeta, edit: nextEdit, save: nextSave})
        })
        return trackPromise(promise)
    }

    const indexPath = `/src/blocks/${blockDir}/index`
    const loadIndexModule = () => loader(`${withOrigin(indexPath)}?t=${timestamp}`)
    const getBlockType = wpBlocks?.getBlockType
    const registerBlockType = wpBlocks?.registerBlockType

    const guardedLoad = (getBlockType && registerBlockType)
        ? Promise.resolve().then(() => {
            let restored = false
            const descriptor = Object.getOwnPropertyDescriptor(wpBlocks, 'registerBlockType')
            if (!descriptor || descriptor.writable || descriptor.set || descriptor.configurable) {
                wpBlocks.registerBlockType = (name, settings) => getBlockType(name) || registerBlockType(name, settings)
                restored = true
            }
            return loadIndexModule().finally(() => {
                if (restored) wpBlocks.registerBlockType = registerBlockType
            })
        })
        : loadIndexModule()

    const promise = Promise.all([guardedLoad, applyLoaderPromise]).then(([mod, applyBlockHmr]) => {
        if (mod?.meta && typeof applyBlockHmr === 'function') {
            applyBlockHmr({meta: mod.meta, edit: mod.edit, save: mod.save}, mod)
        }
    })
    return trackPromise(promise)
}

async function applyCssModuleUpdates(doc, updatePaths, origin, timestampStr) {
    const entryNormalized = normalizeCssPath(__wpvHmrEntryStylesheet)
    const existingLinks = getStylesheetLinks(doc)

    for (const path of updatePaths) {
        try {
            const raw = stripQuery(path)
            const normalized = normalizeCssPath(raw)
            if (!normalized || normalized === entryNormalized) continue

            const hasExisting = existingLinks.some((link) => {
                const href = link.getAttribute('href')
                return href && !link.hasAttribute('data-wpv-hmr-path') && href.includes(normalized)
            })
            if (hasExisting) continue

            const url = buildUrl(raw, origin, timestampStr)
            const existing = doc.querySelector(`link[data-wpv-hmr-path="${raw}"]`)
            const link = existing || doc.createElement('link')
            link.setAttribute('rel', 'stylesheet')
            link.setAttribute('data-wpv-hmr-path', raw)
            link.setAttribute('href', url.toString())
            if (!existing) doc.head?.appendChild(link)

            doc.querySelectorAll(`link[data-wpv-hmr-path="${raw}"]`).forEach((item) => {
                if (item !== link) item.remove()
            })
        } catch {}
    }
}

function buildUrl(path, origin, timestampStr) {
    const resolvedOrigin = getResolvedOrigin(origin)
    const raw = stripQuery(path)
    const url = raw.startsWith('http')
        ? new URL(raw)
        : new URL(raw.startsWith('/') ? raw : `/${raw}`, resolvedOrigin)
    url.searchParams.set('direct', '')
    if (timestampStr) url.searchParams.set('t', timestampStr)
    return url
}

function categorizeUpdates(updates) {
    const jsUpdates = []
    const cssUpdates = []

    for (const update of updates) {
        if (isCssUpdate(update)) {
            cssUpdates.push(update)
        } else if (update.type === 'js-update') {
            jsUpdates.push(update)
        }
    }
    return {jsUpdates, cssUpdates}
}

function consumeQueuedCssUpdates() {
    if (typeof window === 'undefined') return []
    const queued = window.__wpvQueuedCssUpdates || []
    window.__wpvQueuedCssUpdates = null
    return queued
}

function copyLinksFromParent(doc, predicate) {
    const sourceLinks = getStylesheetLinks(document)
    for (const link of sourceLinks) {
        const href = link.getAttribute('href')
        if (predicate(href)) doc.head?.appendChild(link.cloneNode(true))
    }
}

function deduplicateLinks(links, origin, entryNormalized, matchesUpdatePath) {
    const dedupedLinks = new Map()
    const resolvedOrigin = getResolvedOrigin(origin)

    for (const link of links) {
        const href = link.getAttribute('href')
        if (!href || !isViteAsset(href, origin)) continue

        try {
            const normalized = normalizeCssPath(new URL(href, resolvedOrigin).pathname)
            if (!normalized || !matchesUpdatePath(normalized)) continue

            if (dedupedLinks.has(normalized)) {
                link.remove()
                continue
            }
            dedupedLinks.set(normalized, link)
        } catch {}
    }
    return Array.from(dedupedLinks.values())
}

function dispatchHmrEvent(target, eventName, detail = {}) {
    if (typeof target?.dispatchEvent !== 'function') return
    target.dispatchEvent(new CustomEvent(eventName, {
        detail: {timestamp: Date.now(), ...detail}
    }))
}

async function expandCssUpdatePaths(doc, updatePaths, origin) {
    const normalizedUpdates = new Set(updatePaths.map(normalizeCssPath).filter(Boolean))
    if (normalizedUpdates.size === 0) return {effectivePaths: updatePaths, importPaths: []}

    const links = getStylesheetLinks(doc)
    if (links.length === 0) return {effectivePaths: updatePaths, importPaths: []}

    const importRegex = /@import\s+(?:url\()?['"]?([^'"\)\s]+)['"]?\)?/g
    const resolvedOrigin = getResolvedOrigin(origin)

    const entries = await Promise.all(links.map(async (link) => {
        const href = link.getAttribute('href')
        if (!href) return null

        try {
            const url = new URL(href, resolvedOrigin)
            const res = await fetch(url.toString(), {cache: 'no-store'})
            if (!res.ok) return null

            const text = await res.text()
            const imports = []
            let match
            while ((match = importRegex.exec(text)) !== null) {
                const importHref = match[1]
                if (importHref && !importHref.startsWith('data:')) {
                    try {
                        imports.push(normalizeCssPath(new URL(importHref, url).pathname))
                    } catch {}
                }
            }
            return {stylesheetPath: url.pathname, imports: imports.filter(Boolean)}
        } catch {
            return null
        }
    }))

    const validEntries = entries.filter(Boolean)
    const effectivePaths = new Set(updatePaths)
    const importPaths = new Set()

    for (const entry of validEntries) {
        const normalized = normalizeCssPath(entry.stylesheetPath)
        if ([...normalizedUpdates].some((p) => pathMatches(normalized, p))) {
            entry.imports.forEach((p) => importPaths.add(p))
        }
    }

    let changed = true
    while (changed) {
        changed = false
        for (const entry of validEntries) {
            if (!entry.imports?.length) continue

            const normalized = normalizeCssPath(entry.stylesheetPath)
            if (!normalized || normalizedUpdates.has(normalized)) continue

            const hasMatchingImport = entry.imports.some((importPath) =>
                [...normalizedUpdates].some((p) => pathMatches(importPath, p))
            )
            if (hasMatchingImport) {
                normalizedUpdates.add(normalized)
                effectivePaths.add(entry.stylesheetPath)
                changed = true
            }
        }
    }

    return {effectivePaths: [...effectivePaths], importPaths: [...importPaths]}
}

function extractUniqueCssPaths(updates) {
    const paths = updates.filter(isCssUpdate).map((u) => stripQuery(u.path)).filter(Boolean)
    return uniquePaths(paths)
}

function getEditorDocument() {
    const iframe = document.querySelector('iframe[name="editor-canvas"]') ||
        document.querySelector('.edit-post-visual-editor iframe') ||
        document.querySelector('.block-editor iframe')
    return iframe?.contentDocument || null
}

function getResolvedOrigin(origin) {
    if (origin) return origin
    if (typeof window !== 'undefined') return window.location.origin
    return ''
}

function getStylesheetLinks(doc) {
    return Array.from(doc.querySelectorAll('link[rel="stylesheet"]'))
}

function getViteOrigin() {
    try {
        return new URL(import.meta.url).origin
    } catch {
        return ''
    }
}

async function handleEntryStylesheetUpdate(doc, origin, timestampStr, entryNormalized) {
    const isEntryLink = (href) => isNormalizedPath(href, origin, entryNormalized)

    let links = getStylesheetLinks(doc)
    if (links.length === 0 && doc !== document) {
        copyLinksFromParent(doc, isEntryLink)
        links = getStylesheetLinks(doc)
    }

    const entryLinks = links.filter((link) => isEntryLink(link.getAttribute('href')))

    if (entryLinks.length > 0) {
        const [primary, ...duplicates] = entryLinks
        duplicates.forEach((link) => link.remove())
        const newHref = updateUrlTimestamp(primary.getAttribute('href'), origin, timestampStr)
        if (newHref) primary.setAttribute('href', newHref)
        return
    }

    await injectCssFallback(doc, [__wpvHmrEntryStylesheet], origin, parseInt(timestampStr, 10))
}

async function injectCssFallback(doc, updates, origin, batchTimestamp) {
    const styleId = 'wpv-hmr-css-fallback'
    let style = doc.getElementById(styleId)
    if (!style) {
        style = doc.createElement('style')
        style.id = styleId
        doc.head?.appendChild(style)
    }

    const paths = updates.map((u) => (typeof u === 'string' ? u : u?.path)).filter(Boolean)
    const timestamp = String(batchTimestamp || Date.now())

    const contents = await Promise.all(paths.map(async (path) => {
        try {
            const url = buildUrl(path, origin, timestamp)
            const res = await fetch(url.toString(), {cache: 'no-store'})
            return res.ok ? await res.text() : ''
        } catch {
            return ''
        }
    }))

    const cssText = contents.filter(Boolean).join('\n')
    if (cssText) {
        style.textContent = cssText
        __wpvHmrLogger.debug?.('CSS fallback injected in editor iframe', updates.length)
    }
}

async function inlineCssUpdates(doc, updatePaths, origin, timestampStr) {
    await Promise.all(updatePaths.map(async (path) => {
        try {
            const url = buildUrl(path, origin, timestampStr)
            const res = await fetch(url.toString(), {cache: 'no-store'})
            if (!res.ok) return
            const cssText = await res.text()
            if (!cssText) return

            const raw = stripQuery(path)
            const existing = doc.querySelector(`style[data-wpv-hmr-inline="${raw}"]`)
            const style = existing || doc.createElement('style')
            style.setAttribute('data-wpv-hmr-inline', raw)
            style.textContent = cssText
            if (!existing) doc.head?.appendChild(style)
        } catch {}
    }))
}

function isCssUpdate(update) {
    const type = update.type
    if (type === 'css-update' || type === 'style-update') return true
    return type === 'js-update' && stripQuery(update.path).endsWith('.css')
}

function isNormalizedPath(href, origin, normalizedPath) {
    if (!href) return false
    try {
        const url = new URL(href, getResolvedOrigin(origin))
        return normalizeCssPath(url.pathname) === normalizedPath
    } catch {
        return false
    }
}

function isViteAsset(href, origin) {
    return (origin && href.startsWith(origin)) || href.includes('/src/') || href.includes('/@fs/')
}

function normalizeCssPath(path) {
    const clean = stripQuery(path)
    if (!clean) return ''
    return clean.startsWith('/@fs') ? clean.slice(4) : clean
}

function pathMatches(pathA, pathB) {
    if (!pathA || !pathB) return false
    return pathA === pathB || pathA.endsWith(pathB) || pathB.endsWith(pathA)
}

async function processCssHmrUpdates(doc, updatePaths, batchTimestamp) {
    const timestamp = batchTimestamp || Date.now()

    const ignoreUntil = typeof window !== 'undefined' ? window.__wpvCssIgnoreUntil : 0
    if (ignoreUntil && timestamp <= ignoreUntil) return

    const uniquePathsList = uniquePaths(updatePaths.map((p) => stripQuery(typeof p === 'string' ? p : p?.path)))
    if (uniquePathsList.length === 0) return

    const origin = getViteOrigin()
    const timestampStr = String(timestamp)
    const entryNormalized = normalizeCssPath(__wpvHmrEntryStylesheet)

    const hasEntryUpdate = entryNormalized && uniquePathsList.some((p) => normalizeCssPath(p) === entryNormalized)
    if (hasEntryUpdate) {
        await handleEntryStylesheetUpdate(doc, origin, timestampStr, entryNormalized)
        return
    }

    const {effectivePaths, importPaths} = await expandCssUpdatePaths(doc, uniquePathsList, origin)
    const moduleUpdatePaths = uniquePaths([...uniquePathsList, ...importPaths])

    await applyCssModuleUpdates(doc, moduleUpdatePaths, origin, timestampStr)
    await inlineCssUpdates(doc, moduleUpdatePaths, origin, timestampStr)

    const cssTracker = typeof window !== 'undefined'
        ? (window.__wpvCssHmrTracker || (window.__wpvCssHmrTracker = {lastUpdate: 0}))
        : {lastUpdate: 0}
    if ((timestamp - cssTracker.lastUpdate) < __wpvHmrDebounceMs) {
        __wpvHmrLogger.debug?.('[wp-vite] HMR: skipping duplicate CSS update')
        return
    }
    cssTracker.lastUpdate = timestamp

    await refreshStylesheetLinks(doc, effectivePaths, moduleUpdatePaths, importPaths, origin, timestampStr, entryNormalized)
}

function processHmrUpdates(doc, updates) {
    const batchTimestamp = Date.now()
    const {jsUpdates, cssUpdates} = categorizeUpdates(updates)

    if (jsUpdates.length > 0) {
        const jsPaths = uniquePaths(jsUpdates.map((u) => stripQuery(u.path)))
        jsPaths.forEach((path) => processJsHmrUpdate(doc, path, batchTimestamp))
        return
    }

    const cssPaths = extractUniqueCssPaths(cssUpdates)
    if (cssPaths.length > 0) {
        void processCssHmrUpdates(doc, cssPaths, batchTimestamp)
    }
}

function processJsHmrUpdate(doc, path, batchTimestamp) {
    __wpvHmrLogger.log('React component updated, triggering re-render for:', path)

    const timestamp = batchTimestamp || Date.now()
    if (typeof window !== 'undefined') {
        window.__wpvCssIgnoreUntil = timestamp + (__wpvHmrDebounceMs * 2)
    }

    dispatchHmrEvent(doc, 'wp-block-hmr-update', {path, timestamp, source: 'vite-hmr'})
    if (typeof window !== 'undefined' && window !== doc.defaultView) {
        dispatchHmrEvent(window, 'wp-block-hmr-update', {path, timestamp, source: 'vite-hmr'})
    }

    applyBlockHmrFromPath(path, batchTimestamp)
}

function processJsUpdates(doc, jsUpdates) {
    const pathMap = new Map()
    for (const update of jsUpdates) {
        const cleanPath = stripQuery(update.path)
        if (!pathMap.has(cleanPath)) {
            pathMap.set(cleanPath, update.timestamp || Date.now())
        }
    }

    for (const [path, timestamp] of pathMap) {
        processJsHmrUpdate(doc, path, timestamp)
    }
    __wpvHmrLogger.log(`Processed ${pathMap.size}/${jsUpdates.length} HMR updates (deduped)`)
}

async function refreshStylesheetLinks(doc, effectivePaths, updatePaths, importPaths, origin, timestampStr, entryNormalized) {
    const normalizedEffectivePaths = effectivePaths.map(normalizeCssPath).filter(Boolean)
    const matchesUpdatePath = (href) => {
        const normalized = normalizeCssPath(stripQuery(href))
        return normalizedEffectivePaths.some((p) => pathMatches(normalized, p))
    }

    let links = getStylesheetLinks(doc)
    if (links.length === 0 && doc !== document) {
        copyLinksFromParent(doc, (href) => href && isViteAsset(href, origin) && matchesUpdatePath(href))
        links = getStylesheetLinks(doc)
    }

    if (links.length === 0) {
        if (effectivePaths.length > 0) {
            await injectCssFallback(doc, effectivePaths, origin, parseInt(timestampStr, 10))
        }
        return
    }

    let refreshed = refreshStyleImports(doc, uniquePaths([...effectivePaths, ...updatePaths]), origin, timestampStr)
    links = deduplicateLinks(links, origin, entryNormalized, matchesUpdatePath)

    const unmatchedUpdates = updatePaths.filter((path) => {
        const normalized = normalizeCssPath(path)
        return normalized && !links.some((link) => (link.getAttribute('href') || '').includes(normalized))
    })
    const fallbackUpdates = uniquePaths([...unmatchedUpdates, ...importPaths])

    let entryRefreshed = false
    for (const link of links) {
        const href = link.getAttribute('href')
        if (!href || !isViteAsset(href, origin) || !matchesUpdatePath(href)) continue

        const normalized = normalizeCssPath(new URL(href, getResolvedOrigin(origin)).pathname)
        if (entryNormalized && normalized === entryNormalized) {
            if (entryRefreshed) continue
            entryRefreshed = true
        }

        const newHref = updateUrlTimestamp(href, origin, timestampStr)
        if (newHref) {
            link.setAttribute('href', newHref)
            refreshed++
        }
    }

    if (refreshed > 0) {
        __wpvHmrLogger.debug?.('CSS refreshed in editor iframe', refreshed, updatePaths.length)
        if (fallbackUpdates.length > 0) {
            await injectCssFallback(doc, fallbackUpdates, origin, parseInt(timestampStr, 10))
        }
    } else if (effectivePaths.length > 0) {
        await injectCssFallback(doc, fallbackUpdates.length > 0 ? fallbackUpdates : effectivePaths, origin, parseInt(timestampStr, 10))
    }
}

function refreshStyleImports(doc, updatePaths, origin, timestampStr) {
    const normalizedUpdates = updatePaths.map(normalizeCssPath).filter(Boolean)
    if (normalizedUpdates.length === 0) return 0

    const styles = Array.from(doc.querySelectorAll('style'))
    if (styles.length === 0) return 0

    let refreshed = 0
    const importRegex = /(@import\s+(?:url\()?['"]?)([^'"\)]+)(['"]?\)?)/g

    for (const style of styles) {
        const text = style.textContent || ''
        if (!text.includes('@import')) continue

        const nextText = text.replace(importRegex, (match, prefix, importPath, suffix) => {
            const normalizedImport = normalizeCssPath(importPath)
            if (!normalizedImport) return match

            const shouldUpdate = normalizedUpdates.some((updatePath) => pathMatches(updatePath, normalizedImport))
            if (!shouldUpdate) return match

            const newUrl = updateUrlTimestamp(importPath, origin, timestampStr)
            if (!newUrl) return match
            refreshed++
            return `${prefix}${newUrl}${suffix}`
        })

        if (nextText !== text) style.textContent = nextText
    }

    return refreshed
}

function removeDuplicateAndDeferredCssUpdates(updates, cssUpdates, hasJsUpdate) {
    const seenCss = new Set()
    const queuedCssUpdates = []
    const entryNormalized = normalizeCssPath(__wpvHmrEntryStylesheet)

    for (let i = updates.length - 1; i >= 0; i--) {
        const update = updates[i]
        if (!isCssUpdate(update)) continue

        const normalized = normalizeCssPath(update.path)

        if (hasJsUpdate && normalized === entryNormalized) {
            updates.splice(i, 1)
            continue
        }

        if (!normalized || seenCss.has(normalized)) {
            updates.splice(i, 1)
            continue
        }

        seenCss.add(normalized)
        queuedCssUpdates.push(update)
        updates.splice(i, 1)
    }

    if (queuedCssUpdates.length > 0 && typeof window !== 'undefined') {
        window.__wpvQueuedCssUpdates = queuedCssUpdates
    }
}

function resolveWithOrigin(modulePath, origin) {
    if (!origin || /^https?:\/\//.test(modulePath)) return modulePath
    return modulePath.startsWith('/') ? `${origin}${modulePath}` : `${origin}/${modulePath}`
}

function storeLastUpdates(updates) {
    if (typeof window === 'undefined') return
    window.__wpvLastHmrUpdates = updates
    window.__wpvLastHmrUpdatesAt = Date.now()
}

function stripQuery(path) {
    return (path || '').split('?')[0]
}

function uniquePaths(paths) {
    return [...new Set(paths.filter(Boolean))]
}

function updateUrlTimestamp(href, origin, timestampStr) {
    try {
        const url = new URL(href, getResolvedOrigin(origin))
        url.searchParams.set('direct', '')
        if (timestampStr) url.searchParams.set('t', timestampStr)
        return url.toString()
    } catch {
        return null
    }
}
