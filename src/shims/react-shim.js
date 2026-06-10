const wpElement = window.wp?.element

if (!wpElement) {
    console.error('WordPress globals available:', {
        wp: !!window.wp,
        wpData: !!window.wp?.data,
        wpElement: !!window.wp?.element,
        React: !!window.React,
        ReactDOM: !!window.ReactDOM,
    })
    throw new Error('WordPress element library not found. Make sure wp-element is enqueued.')
}

export default wpElement
export const {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    useContext,
    useReducer,
    useLayoutEffect,
    useImperativeHandle,
    createElement,
    Fragment,
    Component,
    PureComponent,
    forwardRef,
    memo,
    createContext,
    createRef,
    isValidElement,
    cloneElement,
    Children,
    StrictMode,
    Suspense,
    lazy,
    startTransition,
    useTransition,
    useDeferredValue,
    useSyncExternalStore,
    useInsertionEffect,
    useDebugValue,
    render,
    createPortal,
    findDOMNode,
    unmountComponentAtNode,
    flushSync,
    useId,
} = wpElement
