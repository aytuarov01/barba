import { addPriority } from './utils';

/**
 * Store and sort transitions
 *
 * @namespace @barba/core/transitions/store
 * @type {object}
 */
export default {
  /**
   * Rules for prioritazing transitions
   *
   * @memberof @barba/core/transitions/store
   * @type {array}
   * @private
   */
  _rules: [
    {
      name: 'namespace',
      type: 'strings',
    },
    {
      name: 'custom',
      type: 'function',
    },
  ],

  /**
   * All transitions
   *
   * @memberof @barba/core/transitions/store
   * @type {array}
   * @private
   */
  _all: [],

  /**
   * Appear transitions
   *
   * @memberof @barba/core/transitions/store
   * @type {array}
   * @private
   */
  _appear: [],

  /**
   * Page transitions
   *
   * @memberof @barba/core/transitions/store
   * @type {array}
   * @private
   */
  _page: [],

  /**
   * Debug mode, log matchong criteria for active transition
   *
   * @memberof @barba/core/transitions/store
   * @type {boolean}
   * @private
   */
  _debug: false,

  /**
   * To know if we should wait for next container before getting transition
   *
   * @memberof @barba/core/transitions/store
   * @type {boolean}
   */
  wait: false,

  /**
   * Check if appear transitions
   *
   * @memberof @barba/core/transitions/store
   * @returns {boolean} yes or not
   */
  get hasAppear() {
    return this._appear.length > 0;
  },

  /**
   * Init store
   *
   * @memberof @barba/core/transitions/store
   * @param {array} transitions array of transitions
   * @param {boolean} debug debug mode
   * @returns {store} this instance
   */
  init(transitions, debug) {
    this._debug = debug;

    if (transitions) {
      // TODO: add check for valid transitions? criteria? (appear || enter && leave)
      this._all = this._all.concat(transitions);
    }

    this._update();

    return this;
  },

  /**
   * Destroy store
   *
   * @memberof @barba/core/transitions/store
   * @returns {store} this instance
   */
  destroy() {
    this._active = undefined;
    this._debug = false;
    this._all = [];
    this._appear = [];
    this._page = [];
    this.wait = false;

    this._update();

    return this;
  },

  /**
   * Add rule or transition
   *
   * @memberof @barba/core/transitions/store
   * @param {string} type rule or transition
   * @param {object} data data
   * @returns {undefined}
   */
  add(type, data) {
    switch (type) {
      case 'rule':
        // TODO: check for valid rule
        this._rules.splice(data.position || 0, 0, data.value);
        break;
      case 'transition':
        // TODO: check for valid transition
        this._all.push(data);
        break;
      default:
    }

    this._update();
  },

  /**
   * Get active/matching transition
   *
   * @memberof @barba/core/transitions/store
   * @param {object} data transition data
   * @param {object} data.current current page
   * @param {object} data.next next page
   * @param {object} data.trigger transition trigger
   * @param {boolean} [appear=false] for appear transition
   * @returns {object} active transition
   */
  get(data, appear = false) {
    const transitions = appear ? this._appear : this._page;

    // All matching transition infos
    const matching = new Map();

    // Active = first of valid transitions
    // sorted by directions (from/to, from || to, …)
    const active = transitions.find(t => {
      let valid = true;
      const match = {};

      // Check rules
      this._rules.reverse().forEach(rule => {
        if (valid) {
          valid = this._check(t, rule, data, match);
          // From/to check, only for page transitions
          if (!appear) {
            if (t.from && t.to) {
              valid =
                this._check(t, rule, data, match, 'from') &&
                this._check(t, rule, data, match, 'to');
            }
            if (t.from && !t.to) {
              valid = this._check(t, rule, data, match, 'from');
            }
            if (!t.from && t.to) {
              valid = this._check(t, rule, data, match, 'to');
            }
          }
        }
      });

      matching.set(t, match);

      return valid;
    });
    // DEV transitions are now correctly sorted
    // .sort(byDirections);

    if (this._debug) {
      // Debug info to known criteria applied for matching transition
      // TODO: error/warn/info handler
      console.info('DEBUG', matching.get(active));
    }

    return active;
  },

  /**
   * Update store
   *
   * Reorder transition by priorities
   * Get wait transitions
   * Get appear transitions
   *
   * @memberof @barba/core/transitions/store
   * @returns {undefined}
   * @private
   */
  _update() {
    // Reorder by priorities
    this._all = this._all
      .map(addPriority(this._rules))
      .sort((a, b) => a.priority - b.priority)
      .reverse()
      .map(t => {
        delete t.priority;

        return t;
      });
    this._page = this._all.filter(t => t.enter || t.leave);
    this._appear = this._all.filter(t => t.appear);
    // If some "to" property, except if based on "route"
    // TODO: how to manage "t.to.route" from @barba/router ???
    this.wait = this._all.some(t => t.to && !t.to.route);
  },

  /**
   * Check if transition apply,
   * based on rule, page data and optional direction
   *
   * 1. transition has no rule "property":
   *    - always returns true
   * 2. transition has rule "property":
   *     - "strings" should be present on both side (transition + view) and match
   *     - "function" should return true
   *
   * @memberof @barba/core/transitions/store
   * @param {object} transition transition
   * @param {object} rule rule
   * @param {object} data transition data
   * @param {object} data.current current page
   * @param {object} data.next next page
   * @param {object} data.trigger transition trigger
   * @param {object} match debug object
   * @param {string} direction from | to
   * @returns {boolean} valid check or not
   * @private
   */
  _check(transition, rule, data, match, direction) {
    let isValid = true;
    let hasMatch = false;
    const t = transition;
    const { name, type } = rule;
    const base = direction ? t[direction] : t; // = t || t.from || t.to
    const page = direction === 'to' ? data.next : data.current; // = current || next
    const exist = direction ? base && base[name] : base[name];

    // If transition rule exists
    if (exist) {
      switch (type) {
        case 'strings':
        default: {
          // Array support
          const names = Array.isArray(base[name]) ? base[name] : [base[name]];

          // For matching, prop should be present on both sides and match
          if (page[name] && names.includes(page[name])) {
            hasMatch = true;
          }
          // If transition prop is different from current, not valid
          if (!names.includes(page[name])) {
            isValid = false;
          }
          break;
        }

        case 'function':
          if (base[name](data)) {
            hasMatch = true;
          } else {
            isValid = false;
          }
          break;
      }

      if (hasMatch) {
        if (direction) {
          match[direction] = match[direction] || {};
          match[direction][name] = t[direction][name];
        } else {
          match[name] = t[name];
        }
      }
    }

    return isValid;
  },
};
