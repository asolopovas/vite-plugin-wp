type Callback = () => void

const callbacks = new Set<Callback>()
let installed = false

function runAll(): void {
    for (const cb of callbacks) {
        try {
            cb()
        } catch {}
    }
    callbacks.clear()
}

/**
 * Register a cleanup callback that runs once when the process exits or
 * receives a termination signal. Process listeners are installed a single
 * time no matter how many callbacks register (Vite server restarts create
 * new plugin instances, which would otherwise pile up listeners).
 */
export function onProcessExit(callback: Callback): void {
    callbacks.add(callback)
    if (installed) return
    installed = true

    const onSignal = () => {
        runAll()
        process.exit(0)
    }
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)
    process.once('SIGHUP', onSignal)
    process.once('exit', runAll)
}
