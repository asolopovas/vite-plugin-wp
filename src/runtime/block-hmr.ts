type BlockModule = {
    meta?: { name?: string }
    edit?: unknown
    save?: unknown
}

type BlockTypeRegistration = {
    edit?: unknown
    save?: unknown
    attributes?: Record<string, unknown>
    [key: string]: unknown
}

type WpBlocksApi = {
    getBlockType: (name: string) => BlockTypeRegistration | undefined
    registerBlockType: (name: string, settings: Record<string, unknown>) => unknown
    unregisterBlockType: (name: string) => unknown
}

type WpDataApi = {
    select: (store: string) => { getBlocks?: () => Array<{ name: string; clientId: string }> } | null
    dispatch: (store: string) => { updateBlockAttributes?: (clientId: string, attrs: Record<string, unknown>) => void } | null
}

type RecentApplyEntry = { edit: unknown; save: unknown; time: number }

const DEBOUNCE_WINDOW_MS = 200
const BLOCK_EDITOR_STORE = 'core/block-editor'
const HMR_TIMESTAMP_ATTR = '__hmrTimestamp'

const recentApply = new Map<string, RecentApplyEntry>()

function getWpApis(): { blocks: WpBlocksApi; data: WpDataApi } | null {
    const wpGlobal = (globalThis as { wp?: { blocks?: WpBlocksApi; data?: WpDataApi } }).wp
    if (!wpGlobal) return null

    const blocks = wpGlobal.blocks
    const data = wpGlobal.data

    if (!blocks?.getBlockType || !blocks?.registerBlockType || !blocks?.unregisterBlockType) {
        return null
    }
    if (!data?.select || !data?.dispatch) {
        return null
    }

    return { blocks, data }
}

function triggerBlockRerender(data: WpDataApi, blockName: string): void {
    const api = data.select(BLOCK_EDITOR_STORE)
    const dispatch = data.dispatch(BLOCK_EDITOR_STORE)
    if (!api?.getBlocks || !dispatch?.updateBlockAttributes) return

    const allBlocks = api.getBlocks()
    const matchingBlocks = allBlocks.filter((block) => block.name === blockName)

    matchingBlocks.forEach((block) => {
        dispatch.updateBlockAttributes!(block.clientId, { [HMR_TIMESTAMP_ATTR]: Date.now() })
    })
}

function shouldSkipDuplicateApply(blockName: string, nextEdit: unknown, nextSave: unknown): boolean {
    const now = Date.now()
    const last = recentApply.get(blockName)

    if (last && last.edit === nextEdit && last.save === nextSave && now - last.time < DEBOUNCE_WINDOW_MS) {
        return true
    }

    recentApply.set(blockName, { edit: nextEdit, save: nextSave, time: now })
    return false
}

function reRegisterBlock(
    blocks: WpBlocksApi,
    current: BlockTypeRegistration,
    blockName: string,
    nextEdit: unknown,
    nextSave: unknown,
): boolean {
    const nextAttributes = {
        ...(current.attributes || {}),
        [HMR_TIMESTAMP_ATTR]: { type: 'number', default: 0 },
    }

    try {
        blocks.unregisterBlockType(blockName)
    } catch {
    }

    if (blocks.getBlockType(blockName)) {
        return false
    }

    blocks.registerBlockType(blockName, {
        ...current,
        edit: nextEdit,
        save: nextSave,
        attributes: nextAttributes,
    })

    return true
}

export function applyBlockHmr(
    block: BlockModule,
    mod?: Partial<BlockModule> & Record<string, unknown>,
): void {
    try {
        const apis = getWpApis()
        if (!apis) return

        const { blocks, data } = apis
        const blockName = block?.meta?.name
        if (!blockName) return

        const current = blocks.getBlockType(blockName)
        if (!current) return

        const nextEdit = mod?.edit ?? block.edit
        const nextSave = mod?.save ?? block.save

        if (shouldSkipDuplicateApply(blockName, nextEdit, nextSave)) {
            return
        }

        if (current.edit === nextEdit && current.save === nextSave) {
            triggerBlockRerender(data, blockName)
            console.debug('[wp-vite] HMR: updated block', blockName)
            return
        }

        const success = reRegisterBlock(blocks, current, blockName, nextEdit, nextSave)
        if (!success) return

        triggerBlockRerender(data, blockName)
        console.debug('[wp-vite] HMR: updated block', blockName)
    } catch (err) {
        console.warn('[wp-vite] HMR update failed', err)
    }
}
