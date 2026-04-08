import { defineConfig, devices } from '@playwright/test'
import { resolvePlaywrightArgs } from './tests/playwright-args'
import { getAuthStatePath, resolveWpHost } from './tests/test-utils'

const isCI = !!process.env.CI
const { viteMode } = resolvePlaywrightArgs()
const isDev = viteMode === 'development'

const baseURL = resolveWpHost()
const storageState = getAuthStatePath()

const expectTimeout = 10000
const actionTimeout = isDev ? 30000 : 15000
const navigationTimeout = isDev ? 60000 : 30000

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: '**/*.e2e.ts',
    fullyParallel: true,
    forbidOnly: isCI,
    retries: isCI ? 2 : 0,
    workers: isCI ? 2 : 8,
    reporter: 'list',
    timeout: 60000,
    expect: { timeout: expectTimeout },
    globalSetup: './tests/playwright-setup.ts',
    globalTeardown: './tests/playwright-teardown.ts',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        video: 'retain-on-failure',
        ignoreHTTPSErrors: true,
        actionTimeout,
        navigationTimeout,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState,
            },
        },
    ],
})
