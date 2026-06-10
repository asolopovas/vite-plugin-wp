// Runs on install. In a git-dependency checkout (no dist committed) it
// builds the package, then removes the devDependency tree it pulled in so
// consumers don't ship ~900MB of build tooling inside node_modules.
import { execSync } from 'child_process'
import { existsSync, rmSync } from 'fs'
import path from 'path'

const root = process.cwd()
if (existsSync(path.join(root, 'dist/index.js'))) process.exit(0)

execSync('bun install --ignore-scripts', { stdio: 'inherit' })
execSync('bun run build', { stdio: 'inherit' })

const installedAsDependency = root.split(path.sep).includes('node_modules')
if (installedAsDependency) {
    rmSync(path.join(root, 'node_modules'), { recursive: true, force: true })
}
