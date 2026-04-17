
var __wpvHmrLogger = __wpvHmrLogger ?? __WPV_HMR_LOGGER__;
/*__WPV_HMR_EXPORT_LINE__*/
import { applyBlockHmr as __wpvApplyBlockHmr } from 'virtual:vite-plugin-wp/block-hmr';
if (import.meta.hot && typeof window !== 'undefined') {
    try {
        const __wpvBlockUrl = String(import.meta.url || '')
        const __wpvBlockMatch = __wpvBlockUrl.match(/\/src\/blocks\/([^/]+)\//)
        if (__wpvBlockMatch) {
            const __wpvBlockDir = __wpvBlockMatch[1]
            const __wpvBlockMetaByDir = window.__wpvBlockMetaByDir || {}
            __wpvBlockMetaByDir[__wpvBlockDir] = meta
            window.__wpvBlockMetaByDir = __wpvBlockMetaByDir
        }
    } catch {}
}
if (import.meta.hot) {
    try {
        import.meta.hot.accept((mod) => {
            try {
                const nextMeta = mod?.meta ?? meta
                const nextEdit = mod?.edit ?? edit
                const nextSave = mod?.save ?? save
                __wpvApplyBlockHmr({ meta: nextMeta, edit: nextEdit, save: nextSave }, mod)
            } catch (e) { __wpvHmrLogger.warn?.('[wp-vite] HMR apply failed', e) }
        })
/*__WPV_HMR_DEP_ACCEPT__*/
        import.meta.hot.dispose(() => {
            try {
                const wpAny = (window)?.wp
                wpAny?.blocks?.unregisterBlockType?.(meta?.name)
            } catch {}
        })
    } catch (e) { __wpvHmrLogger.debug?.('[wp-vite] HMR: setup skipped', e) }
}
