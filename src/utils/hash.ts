export function generateContentHash(content: string): string {
    let hash = 0
    for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash) + content.charCodeAt(i)
        hash = hash & hash
    }
    return Math.abs(hash).toString(16).substring(0, 8)
}
