'use strict';

/*global describe*/
/*global it*/

const R = require('ramda');
const assert = require('assert');

const jspector = require('./jspector');
const utils = require('./utils');

const proxify2Code = R.compose(utils.node2Code, jspector);

describe('jspector', () => {

  it('DECLARE VAR: var a;', () => {
    assert.strictEqual(proxify2Code('var a;'), 'var a = new zikjs.proxy.Variable();');
  });

  it('DECLARE VAR WITH LITERAL: var a = 42;', () => {
    assert.strictEqual(proxify2Code('var a = 42;'), 'var a = new zikjs.proxy.Variable(42);');
  });

  it('DECLARE VAR WITH FUNCTION: var a = x => x;', () => {
    assert.strictEqual(proxify2Code('var a = x => x;'), 'var a = new zikjs.proxy.Function(x => x);');
  });

  it('APPLY FUNCTION: users.fn(function(u) { return u.name; });', () => {
    assert.strictEqual(
      proxify2Code('users.fn(function(u) { return u.name; });'),
      'users.fn(new zikjs.proxy.Function(function (u) {return u.name;}));'
    );
  });

  it('APPLY ANONYMOUS FUNCTION: users.fn(u => u.name, z => z + 1);', () => {
    assert.strictEqual(
      proxify2Code('users.fn(u => u.name, z => z + 1);'),
      'users.fn(new zikjs.proxy.Function(u => u.name), new zikjs.proxy.Function(z => z + 1));'
    );
  });

  it('CALL FUNCTION: (function(x) { return x + 1; })(0);', () => {
    assert.strictEqual(
      proxify2Code('(function(x) { return x + 1; })(0);'),
      'new zikjs.proxy.Function(function (x) {return x + 1;})(0);'
    );
  });

  it('CALL ANONYMOUS FUNCTION: (x => x + 1)(0);', () => {
    assert.strictEqual(proxify2Code('(x => x + 1)(0);'), 'new zikjs.proxy.Function(x => x + 1)(0);');
  });

  it('DECLARE FUNCTION: function sum(x, y) { return x + y; }', () => {
    assert.strictEqual(
      proxify2Code('function sum(x, y) { return x + y; }'),
      'const sum = new zikjs.proxy.Function(function sum(x, y) {return x + y;});'
    );
  });

  it('AFFECT VARIABLE WITH NEW VALUE: var x = 42; x = 0;', () => {
    assert.strictEqual(proxify2Code('var x = 42; x = 0;'), 'var x = new zikjs.proxy.Variable(42);x.set(0);');
  });

  it('RETRIEVE VARIABLE VALUE: var x = 42; var y = x;', () => {
    assert.strictEqual(
      proxify2Code('var x = 42; var y = x;'),
      'var x = new zikjs.proxy.Variable(42);var y = new zikjs.proxy.Variable(x.get());'
    );
  });

});
