// React shim that uses WordPress element library
const wpElement = window.wp?.element;

if (!wpElement) {
  console.error('WordPress globals available:', {
    wp: !!window.wp,
    wpData: !!window.wp?.data,
    wpElement: !!window.wp?.element,
    React: !!window.React,
    ReactDOM: !!window.ReactDOM
  });
  throw new Error('WordPress element library not found. Make sure wp-element is enqueued.');
}

// WordPress element provides React-compatible exports
export default wpElement;
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
  // WordPress specific
  render,
  createPortal,
  findDOMNode,
  unmountComponentAtNode,
  flushSync,
  useId
} = wpElement;
