// ReactDOM shim that uses WordPress element library
// WordPress provides ReactDOM functions through wp.element
const wpElement = window.wp?.element;

if (!wpElement) {
  throw new Error('WordPress element library not found. Make sure wp-element is enqueued.');
}

// WordPress element provides ReactDOM-compatible exports
export default wpElement;
export const {
  render,
  createPortal,
  findDOMNode,
  unmountComponentAtNode,
  flushSync
} = wpElement;