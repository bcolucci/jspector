'use strict';

const R = require('ramda');
const util = require('util');
const acorn = require('acorn');
const astring = require('astring');

const inspect = obj => util.inspect(obj, { depth: null });

const printDepth = obj => {
  R.compose(console.log, inspect)(obj);
  return obj;
};

const jsonClone = R.compose(JSON.parse, JSON.stringify);

const code2Node = acorn.parse;
const node2Code = node => astring(node, { indent: '  ', lineEnd: '\n' });

module.exports = {
  inspect,
  printDepth,
  jsonClone,
  code2Node,
  node2Code
};
