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
