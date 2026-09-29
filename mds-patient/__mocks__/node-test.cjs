/**
 * Shim for node:test — maps the Node built-in test runner API to Jest globals.
 *
 * __esModule: true tells Babel's _interopRequireDefault NOT to wrap this in
 * { default: module }, so `import test from 'node:test'` resolves directly
 * to module.exports.default (our lazy wrapper function).
 */
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// Default export — used by `import test from 'node:test'`
exports.default = function (...args) { return global.test(...args); };

// Named exports — used by `import { test, describe } from 'node:test'`
exports.test      = function (...args) { return global.test(...args); };
exports.describe  = function (...args) { return global.describe(...args); };
exports.it        = function (...args) { return global.it(...args); };
exports.beforeAll = function (...args) { return global.beforeAll(...args); };
exports.afterAll  = function (...args) { return global.afterAll(...args); };
exports.beforeEach = function (...args) { return global.beforeEach(...args); };
exports.afterEach  = function (...args) { return global.afterEach(...args); };
