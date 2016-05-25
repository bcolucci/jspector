'use strict';

const R = require('ramda');

const PROXY_VAR_CLASS = 'jspector.Variable';
const PROXY_FUN_CLASS = 'jspector.Function';

const Variable = function (initialValue) {
  let value = R.clone(initialValue);
  return {
    get: function() {
      console.log('get', value);
      return value;
    },
    set: function (v) {
      console.log('set', value, v);
      value = v;
    }
  }
};

const Function = function (initialFunction) {
  const fn = initialFunction;
  return function () {
    console.log('call fn ' + fn.toString());
    return fn.apply(null, Array.from(arguments));
  };
};

module.exports = {
  PROXY_VAR_CLASS,
  PROXY_FUN_CLASS,
  Variable,
  Function
};
