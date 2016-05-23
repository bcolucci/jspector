'use strict';

/*global describe*/
/*global it*/

const R = require('ramda');
const assert = require('assert');

const jspector = require('./jspector');
const utils = require('./utils');

const proxify2Code = R.compose(utils.node2Code, jspector);
const assertProxify = (code, expected) => assert.strictEqual(proxify2Code(code), expected);

describe('jspector', () => {

  const testCases = [
    [
      'var a;',
      'var a = new zikjs.proxy.Variable();'
    ],
    [
      'var a = 42;',
      'var a = new zikjs.proxy.Variable(42);'
    ],
    [
      'var a = x => x;',
      'var a = new zikjs.proxy.Function(x => x);'
    ],
    [
      'users.fn(function(u) { return u.name; });',
      'users.fn(new zikjs.proxy.Function(function (u) {return u.name;}));'
    ],
    [
      'users.fn(u => u.name, z => z + 1);',
      'users.fn(new zikjs.proxy.Function(u => u.name), new zikjs.proxy.Function(z => z + 1));'
    ],
    [
      '(x => x + 1)(0);',
      'new zikjs.proxy.Function(x => x + 1)(0);'
    ],
    [
      '(function(x) { return x + 1; })(0);',
      'new zikjs.proxy.Function(function (x) {return x + 1;})(0);'
    ],
    [
      'function sum(x, y) { return x + y; }',
      'const sum = new zikjs.proxy.Function(function sum(x, y) {return x + y;});'
    ],
    [
      'var x = 42; x = 0;',
      'var x = new zikjs.proxy.Variable(42);x.set(0);;' //TODO remove the last ';'
    ]
  ];

  it('should proxify', () => testCases.forEach(args => assertProxify.apply(null, args)));

});
