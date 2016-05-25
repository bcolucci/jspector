'use strict';

/*global describe*/
/*global it*/

const R = require('ramda');
const assert = require('assert');

const jspector = require('./jspector');
const parser = require('./parser');
const utils = require('./utils');

const proxify2Code = R.compose(utils.node2Code, parser);

describe('jspector', () => {

  it('DECLARE VAR: var a;', () => {
    assert.strictEqual(proxify2Code('var a;'), 'var a = new jspector.Variable();\n');
  });

  it('DECLARE VAR WITH LITERAL: var a = 42;', () => {
    assert.strictEqual(proxify2Code('var a = 42;'), 'var a = new jspector.Variable(42);\n');
  });

  it('DECLARE VAR WITH FUNCTION: var a = x => x;', () => {
    assert.strictEqual(proxify2Code('var a = x => x;'), 'var a = new jspector.Function(x => x);\n');
  });

  it('APPLY FUNCTION: users.fn(function(u) { return u.name; });', () => {
    assert.strictEqual(
      proxify2Code('users.fn(function(u) { return u.name; });'),
      'users.fn(new jspector.Function(function (u) {\n  return u.name;\n}));\n'
    );
  });

  it('APPLY ANONYMOUS FUNCTION: users.fn(u => u.name, z => z + 1);', () => {
    assert.strictEqual(
      proxify2Code('users.fn(u => u.name, z => z + 1);'),
      'users.fn(new jspector.Function(u => u.name), new jspector.Function(z => z + 1));\n'
    );
  });

  it('CALL FUNCTION: (function(x) { return x + 1; })(0);', () => {
    assert.strictEqual(
      proxify2Code('(function(x) { return x + 1; })(0);'),
      'new jspector.Function(function (x) {\n  return x + 1;\n})(0);\n'
    );
  });

  it('CALL ANONYMOUS FUNCTION: (x => x + 1)(0);', () => {
    assert.strictEqual(proxify2Code('(x => x + 1)(0);'), 'new jspector.Function(x => x + 1)(0);\n');
  });

  it('DECLARE FUNCTION: function sum(x, y) { return x + y; }', () => {
    assert.strictEqual(
      proxify2Code('function sum(x, y) { return x + y; }'),
      'const sum = new jspector.Function(function sum(x, y) {\n  return x + y;\n});\n\n' //TODO why to new lines?
    );
  });

  it('AFFECT VARIABLE WITH NEW VALUE: var x = 42; x = 0;', () => {
    assert.strictEqual(proxify2Code('var x = 42; x = 0;'), 'var x = new jspector.Variable(42);\nx.set(0);\n');
  });

  it('RETRIEVE VARIABLE VALUE: var x = 42; var y = x;', () => {
    assert.strictEqual(
      proxify2Code('var x = 42; var y = x;'),
      'var x = new jspector.Variable(42);\nvar y = new jspector.Variable(x.get());\n'
    );
  });

  it('RETRIEVE VARIABLE VALUE (FROM EXPRESSION): var x = 42; [].push(x);', () => {
    assert.strictEqual(
      proxify2Code('var x = 42; [].push(x);'),
      'var x = new jspector.Variable(42);\n[].push(x.get());\n'
    );
  });

  it('RETRIEVE VARIABLE VALUE (UPDATE EXPRESSION ONE-TERM): var x = 0; ++x;', () => {
    assert.strictEqual(proxify2Code('var x = 0; ++x;'), 'var x = new jspector.Variable(0);\nx.set(x.get() + 1);\n');
    assert.strictEqual(proxify2Code('var x = 0; x++;'), 'var x = new jspector.Variable(0);\nx.set(x.get() + 1);\n');
    assert.strictEqual(proxify2Code('var x = 0; --x;'), 'var x = new jspector.Variable(0);\nx.set(x.get() - 1);\n');
    assert.strictEqual(proxify2Code('var x = 0; x--;'), 'var x = new jspector.Variable(0);\nx.set(x.get() - 1);\n');
  });

  it('RETRIEVE VARIABLE VALUE (UPDATE EXPRESSION TWO-TERM): var x = 0; x += 2;', () => {
    assert.strictEqual(proxify2Code('var x = 0; x += 2;'), 'var x = new jspector.Variable(0);\nx.set(x.get() + 2);\n');
    assert.strictEqual(proxify2Code('var x = 0; x -= 3;'), 'var x = new jspector.Variable(0);\nx.set(x.get() - 3);\n');
    assert.strictEqual(proxify2Code('var x = 0; x /= 4;'), 'var x = new jspector.Variable(0);\nx.set(x.get() / 4);\n');
    assert.strictEqual(proxify2Code('var x = 0; x *= 5;'), 'var x = new jspector.Variable(0);\nx.set(x.get() * 5);\n');
  });

  it('INSERT THE CLIENT', () => {

    let result1 = new jspector.Variable();
    let result2 = new jspector.Variable();

    function myFunction() {
      const generateNumbers = x => {
        const acc = [];
        let i = 0;
        while (++i <= x)
          acc.push(i);
        return acc;
      };
      function isEven(x) { return (x % 2) === 0 }
      let numbers = generateNumbers(5);
      result1 = numbers.filter(isEven);
    }

    function myExpectedFunc() {
      const jspector = require('jspector');
      const generateNumbers = new jspector.Function(x => {
        const acc = new jspector.Variable([]);
        let i = new jspector.Variable(0);
        while (++i <= x) acc.push(i.get());
        return acc;
      });
      const isEven = new jspector.Function(function isEven(x) {return x % 2 === 0;});
      let numbers = new jspector.Variable(generateNumbers(5));
      result2 = numbers.filter(isEven);
    }

    const functionCode = fn => {
      const fnLines = fn.toString().split('\n');
      return fnLines.slice(1, fnLines.length - 1).join('\n').trim();
    };

    const myFunctionCode = functionCode(myFunction);
    const myExpectedFunctionCode = functionCode(myExpectedFunc);

    //console.log(myFunctionCode, '\n\n', myExpectedFunctionCode);

    //assert.deepEqual(getFunctionReturn(myFunction(), [2, 4]);

    const proxifiedCode = proxify2Code(myFunctionCode, true);

    console.log(proxifiedCode);

    //assert.strictEqual(proxifiedCode, myExpectedFunctionCode);
  });

});
