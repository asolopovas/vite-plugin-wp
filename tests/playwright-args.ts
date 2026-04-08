type ViteMode = 'development' | 'production'

function resolveGrepValue(argv: string[]): string {
    const grepIdx = argv.findIndex(arg => arg === '--grep' || arg === '-g')
    if (grepIdx === -1) return ''
    return argv[grepIdx + 1] ?? ''
}

export function resolvePlaywrightArgs(
    env: NodeJS.ProcessEnv = process.env,
    argv: string[] = process.argv
): {
    isDevRun: boolean
    isProdRun: boolean
    viteMode: ViteMode
} {
    const grepValue = resolveGrepValue(argv)
    const isDevRun = grepValue.includes('@dev')
    const isProdRun = grepValue.includes('@prod')
    let viteMode = env.VITE_MODE as ViteMode | undefined

    if (isDevRun) {
        viteMode = 'development'
    } else if (isProdRun) {
        viteMode = 'production'
    } else if (!viteMode) {
        viteMode = 'production'
    }

    env.VITE_MODE = viteMode

    return { isDevRun, isProdRun, viteMode }
}
