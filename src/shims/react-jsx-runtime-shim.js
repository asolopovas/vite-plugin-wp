// React JSX runtime shim that uses WordPress' bundled React runtime.
const reactJsxRuntime = window.ReactJSXRuntime

if (!reactJsxRuntime) {
    throw new Error('React JSX runtime not found. Make sure react-jsx-runtime is loaded.')
}

export default reactJsxRuntime
export const { Fragment, jsx, jsxs } = reactJsxRuntime

