import fs from 'fs'
import path from 'path'

export const DEFAULT_CACHE_DIR = 'tests/.meta'
export const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type CacheData<T> = T & { createdAt: number }

type CacheOptions = {
    cacheDir?: string
    ttlMs?: number
}

function resolveCachePath(cacheDir: string, filename: string): string {
    return path.isAbsolute(cacheDir)
        ? path.join(cacheDir, filename)
        : path.join(process.cwd(), cacheDir, filename)
}

export function readCache<T>(filename: string, options: CacheOptions = {}): CacheData<T> | null {
    const { cacheDir = DEFAULT_CACHE_DIR, ttlMs = DEFAULT_CACHE_TTL_MS } = options
    const cachePath = resolveCachePath(cacheDir, filename)
    try {
        if (!fs.existsSync(cachePath)) return null
        const data = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as CacheData<T>
        if (Date.now() - data.createdAt > ttlMs) return null
        return data
    } catch {
        return null
    }
}

export function writeCache<T>(filename: string, data: T, options: CacheOptions = {}): void {
    const { cacheDir = DEFAULT_CACHE_DIR } = options
    const cachePath = resolveCachePath(cacheDir, filename)
    fs.mkdirSync(path.dirname(cachePath), { recursive: true })
    fs.writeFileSync(cachePath, JSON.stringify({ ...data, createdAt: Date.now() }))
}
