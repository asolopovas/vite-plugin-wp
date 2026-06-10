const wpElement = window.wp?.element

if (!wpElement) {
    throw new Error('WordPress element library not found. Make sure wp-element is enqueued.')
}

export default wpElement
export const {
    render,
    hydrate,
    createPortal,
    findDOMNode,
    unmountComponentAtNode,
    flushSync,
    createRoot,
    hydrateRoot,
} = wpElement
