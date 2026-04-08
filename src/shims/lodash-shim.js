// Lodash shim to map lodash-es imports to WordPress underscore/lodash global
// Use lazy evaluation to ensure globals are available when accessed
const getLodash = () => {
  if (window.lodash) {
    return window.lodash;
  }

  if (window._) {
    return window._;
  }

  if (window.wp && window.wp.lodash) {
    return window.wp.lodash;
  }

  console.error('Lodash/Underscore not found. Available globals:', {
    _: !!window._,
    lodash: !!window.lodash,
    'wp.lodash': !!(window.wp && window.wp.lodash),
    wp: !!window.wp,
    'wp object keys': window.wp ? Object.keys(window.wp) : 'no wp object',
    'window keys': Object.keys(window).filter(k => k.includes('_') || k.includes('lodash') || k.includes('underscore'))
  });

  throw new Error('Lodash/Underscore not available. Make sure underscore or lodash script is enqueued.');
};

export const startCase = (...args) => getLodash().startCase(...args);
export const lowerCase = (...args) => getLodash().lowerCase(...args);
export const kebabCase = (...args) => getLodash().kebabCase(...args);
export const merge = (...args) => getLodash().merge(...args);
export const cloneDeep = (...args) => getLodash().cloneDeep(...args);
export const get = (...args) => getLodash().get(...args);
export const set = (...args) => getLodash().set(...args);
export const has = (...args) => getLodash().has(...args);
export const omit = (...args) => getLodash().omit(...args);
export const pick = (...args) => getLodash().pick(...args);
export const isEqual = (...args) => getLodash().isEqual(...args);
export const debounce = (...args) => getLodash().debounce(...args);
export const throttle = (...args) => getLodash().throttle(...args);
export const forEach = (...args) => getLodash().forEach(...args);
export const map = (...args) => getLodash().map(...args);
export const mapValues = (...args) => getLodash().mapValues(...args);
export const filter = (...args) => getLodash().filter(...args);
export const find = (...args) => getLodash().find(...args);
export const pickBy = (...args) => getLodash().pickBy(...args);
export const isEmpty = (...args) => getLodash().isEmpty(...args);
export const isArray = (...args) => getLodash().isArray(...args);
export const isObject = (...args) => getLodash().isObject(...args);
export const isString = (...args) => getLodash().isString(...args);
export const isNumber = (...args) => getLodash().isNumber(...args);
export const isFunction = (...args) => getLodash().isFunction(...args);

// Export default as a proxy that gets lodash when accessed
export default new Proxy({}, {
  get(target, prop) {
    const _ = getLodash();
    return _[prop];
  }
});
