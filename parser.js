'use strict';

const R = require('ramda');
const estraverse = require('estraverse');
const acorn = require('acorn');
const utils = require('./utils');
const lib = require('.');

const REQUIRE_CLIENT = 'const jspector = require(\'jspector\')';
const clientNode = () => R.compose(R.head, R.prop('body'))(utils.code2Node(REQUIRE_CLIENT));

const NEW_FUN_STM_PATTERN = 'new _TYPE_(_BODY_)';
const NEW_FUN_DECL_PATTERN = 'const _VAR_ = new _TYPE_(_BODY_)';
const UPDATE_PATTERN = '_VAR_.set(_VAR_.get() _OP_ _VAL_)';
const SET_PATTERN = '_VAR_.set(_BODY_)';
const GET_PATTERN = '_VAR_.get()';

const replaceToken = token => str => R.replace(new RegExp(`_${token}_`, 'gi'), str);
const replaceType = replaceToken('TYPE');
const replaceBody = replaceToken('BODY');
const replaceVar = replaceToken('VAR');
const replaceOp = replaceToken('OP');
const replaceVal = replaceToken('VAL');

const defaultValue = obj => R.always(obj);
const emptyArray = defaultValue([]);
const emptyObject = defaultValue({});

const isNil = obj => R.isNil(obj);
const defaultObject = obj => R.ifElse(isNil, emptyObject, R.identity)(obj ||emptyObject());

const oneValueArray = obj => isNil(obj) ? emptyArray() : R.concat(emptyArray(), obj);
const pushInitToArgs = R.compose(R.ifElse(isNil, emptyArray, oneValueArray), R.prop('init'));

const nodeFunctionName = R.path([ 'id', 'name' ]);
//const nodeAssignmentName = side => R.path([ side, 'name' ]);

const setNewExpression = R.assoc('type', 'NewExpression');

const setCalleeType = name => R.assoc('callee', { type: 'Identifier', name: name });
const variableCalleeType = setCalleeType(lib.PROXY_VAR_CLASS);
const functionCalleeType = setCalleeType(lib.PROXY_FUN_CLASS);

const createVariableInit = R.compose(variableCalleeType, setNewExpression, emptyObject);
const createFunctionInit = R.compose(functionCalleeType, setNewExpression, emptyObject);

const pushInitToNode = initGenerator => node => R.assoc('arguments', pushInitToArgs(node), initGenerator());
const pushVariableInitToNode = pushInitToNode(createVariableInit);
const pushFunctionInitToNode = pushInitToNode(createFunctionInit);

const variableProxy = node => R.assoc('init', pushVariableInitToNode(node), node);
const functionProxy = node => R.assoc('init', pushFunctionInitToNode(node), node);

const propTypeEq = type => R.propEq('type', type);
const isProgram = propTypeEq('Program');
const isVariableDeclarator = propTypeEq('VariableDeclarator');
const isFunctionExpression = propTypeEq('FunctionExpression');
const isArrowFunctionExpression = propTypeEq('ArrowFunctionExpression');
const isCallExpression = propTypeEq('CallExpression');
const isFunctionDeclaration = propTypeEq('FunctionDeclaration');
const isAssignmentExpression = propTypeEq('AssignmentExpression');
const isIdentifier = propTypeEq('Identifier');
const isUpdateExpression = propTypeEq('UpdateExpression');
const isFunctionExpressionNode = node => R.or(isFunctionExpression(node), isArrowFunctionExpression(node));

const replaceVarBody = str => (variable, body) => replaceBody(body)(replaceVar(variable)(str));
const replaceTypeBody = str => (type, body) => replaceBody(body)(replaceType(type)(str));
const replaceTypeBodyVar = str => (type, body, variable) => replaceVar(variable)(replaceBody(body)(replaceType(type)(str)));
const replaceVarOpVal = str => (variable, op, value) => replaceVar(variable)(replaceOp(op)(replaceVal(value)(str)));

const fillNewFunctionStatementPattern = type => body => replaceTypeBody(NEW_FUN_STM_PATTERN)(type, body);
const fillNewFunctionDeclarationPattern = variable => type => body => replaceTypeBodyVar(NEW_FUN_DECL_PATTERN)(type, body, variable);

const newFunctionStatement = R.compose(fillNewFunctionStatementPattern(lib.PROXY_FUN_CLASS), utils.node2Code);

const newFunctionDeclaration = node => fillNewFunctionDeclarationPattern(nodeFunctionName(node))(lib.PROXY_FUN_CLASS)(utils.node2Code(node));

const mapArgs = path => node => R.assocPath(path, (R.path(path)(node) || []).map(mapArgNode), node);

const newFunctionStatementForNode = R.compose(utils.code2Node, newFunctionStatement);
const newFunctionDeclarationForNode = R.compose(utils.code2Node, newFunctionDeclaration);

const expressionBody = R.compose(R.prop('expression'), R.head, R.prop('body'));
const newFunctionProxyStatementNode = R.compose(expressionBody, newFunctionStatementForNode);

const nodeInit = R.compose(defaultObject, R.propOr(emptyObject, 'init'));
const initIsFunctionExpression = R.compose(isFunctionExpressionNode, nodeInit);

const processIfIsFunctionExpression = R.ifElse(isFunctionExpressionNode, newFunctionProxyStatementNode, R.identity);
const mapArgsToFunctionStatement = R.compose(R.map(processIfIsFunctionExpression), R.prop('arguments'));

const mapCallExpressionArgs = node => R.assoc('arguments', mapArgsToFunctionStatement(node), node);
const mapCallExpressionCallee = node => R.assoc('callee', processIfIsFunctionExpression(node.callee), node);

const processCallExpression = R.compose(mapCallExpressionCallee, mapCallExpressionArgs, mapArgs([ 'arguments' ]));

const procesVariableDeclarator = R.ifElse(initIsFunctionExpression, functionProxy, variableProxy);

const nodeLeftName = R.path([ 'left', 'name' ]);

const mapAssignmentExpression = node => {
  const body = utils.node2Code(R.prop('right')(node));
  const code = replaceVarBody(SET_PATTERN)(nodeLeftName(node), body);
  if (node.operator.length > 1) {
    const updateCode = replaceVarOpVal(UPDATE_PATTERN)(node.left.name, node.operator[0], node.right.raw);
    //console.log(node.operator, code, node.right.raw, updateCode);
    return utils.code2Node(updateCode).body.shift().expression;
  }
  return expressionBody(utils.code2Node(code));
};

const processNodeArg = argNode => expressionBody(utils.code2Node(replaceVar(R.prop('name')(argNode))(GET_PATTERN)));
const mapArgNode = R.ifElse(isIdentifier, processNodeArg, R.identity);

const processVariableDeclaratorNodeArgs = mapArgs([ 'init', 'arguments' ]);

const processUpdateExpression = node => {
  const variable = node.argument.name;
  const operator = node.operator;
  let value = [ '++', '--' ].indexOf(operator) > -1 ? 1 : 0;
  let simpleOperator = operator === '++' ? '+' : '-';
  const updateCode = replaceVarOpVal(UPDATE_PATTERN)(variable, simpleOperator, value);
  return utils.code2Node(updateCode).body.shift().expression;
};

const printNode = node => {
  utils.printDepth(node);
};

const step1Visitor = R.cond([
  [ isCallExpression, processCallExpression ],
  [ isVariableDeclarator, procesVariableDeclarator ],
  [ R.T, /*printNode*/ R.identity ]
]);

const step2Visitor = R.ifElse(isFunctionDeclaration, newFunctionDeclarationForNode, R.identity);
const step3Visitor = R.ifElse(isAssignmentExpression, mapAssignmentExpression, R.identity);
const step4Visitor = R.ifElse(isUpdateExpression, processUpdateExpression, R.identity);
const step5Visitor = R.ifElse(isVariableDeclarator, processVariableDeclaratorNodeArgs, R.identity);

const traverseWithVisitor = visitor => node => estraverse.replace(node, { enter: visitor });

const traverser1 = traverseWithVisitor(step1Visitor);
const traverser2 = traverseWithVisitor(step2Visitor);
const traverser3 = traverseWithVisitor(step3Visitor);
const traverser4 = traverseWithVisitor(step4Visitor);
const traverser5 = traverseWithVisitor(step5Visitor);

const commonTraversers = [ traverser1, traverser2, traverser3, traverser4, traverser5 ];

const traverseWithVisitors = traversers => R.compose.apply(null, traversers.reverse());

const traverseToIncludeClient = traverseWithVisitor((node, parent) => {
  if (isProgram(node) && parent && isProgram(parent)) {
    node.body = [ clientNode() ].concat(node.body);
    return node;
  }
});

module.exports = (code, requireClient) => {
  const traversers = R.clone(commonTraversers);
  if (requireClient)
    traversers.push(traverseToIncludeClient);
  const operations = [ utils.code2Node, traverseWithVisitors(traversers) ];
  return R.compose.apply(null, operations.reverse())(code);
};
