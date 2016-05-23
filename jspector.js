'use strict';

const R = require('ramda');
const estraverse = require('estraverse');
const acorn = require('acorn');
const utils = require('./utils');

const PROXY_VAR_CLASS = 'zikjs.proxy.Variable';
const PROXY_FUN_CLASS = 'zikjs.proxy.Function';

const NEW_FUN_STM_PATTERN = 'new _TYPE_(_BODY_)';
const NEW_FUN_DECL_PATTERN = 'const _VAR_ = new _TYPE_(_BODY_)';
const SET_PATTERN = '_VAR_.set(_BODY_)';
const GET_PATTERN = '_VAR_.get()';

const defaultValue = obj => R.always(obj);
const emptyArray = defaultValue([]);
const emptyObject = defaultValue({});

const isNil = obj => R.isNil(obj);
const defaultObject = obj => R.ifElse(isNil, emptyObject, R.identity)(obj ||emptyObject());

const replaceToken = regexp => str => R.replace(regexp, str);
const replaceType = replaceToken(/_TYPE_/);
const replaceBody = replaceToken(/_BODY_/);
const replaceVar = replaceToken(/_VAR_/);

const oneValueArray = obj => isNil(obj) ? emptyArray() : R.concat(emptyArray(), obj);
const pushInitToArgs = R.compose(R.ifElse(isNil, emptyArray, oneValueArray), R.prop('init'));

const nodeFunctionName = R.path([ 'id', 'name' ]);
//const nodeAssignmentName = side => R.path([ side, 'name' ]);

const setNewExpression = R.assoc('type', 'NewExpression');

const setCalleeType = name => R.assoc('callee', { type: 'Identifier', name: name });
const variableCalleeType = setCalleeType(PROXY_VAR_CLASS);
const functionCalleeType = setCalleeType(PROXY_FUN_CLASS);

const createVariableInit = R.compose(variableCalleeType, setNewExpression, emptyObject);
const createFunctionInit = R.compose(functionCalleeType, setNewExpression, emptyObject);

const pushInitToNode = initGenerator => node => R.assoc('arguments', pushInitToArgs(node), initGenerator());
const pushVariableInitToNode = pushInitToNode(createVariableInit);
const pushFunctionInitToNode = pushInitToNode(createFunctionInit);

//TODO make this Functional
const variableProxy = node => R.assoc('init', pushVariableInitToNode(node), node);
const functionProxy = node => R.assoc('init', pushFunctionInitToNode(node), node);

const propTypeEq = type => R.propEq('type', type);
const isVariableDeclarator = propTypeEq('VariableDeclarator');
const isFunctionExpression = propTypeEq('FunctionExpression');
const isArrowFunctionExpression = propTypeEq('ArrowFunctionExpression');
const isCallExpression = propTypeEq('CallExpression');
const isFunctionDeclaration = propTypeEq('FunctionDeclaration');
const isAssignmentExpression = propTypeEq('AssignmentExpression');
const isIdentifier = propTypeEq('Identifier');
const isFunctionExpressionNode = node => R.or(isFunctionExpression(node), isArrowFunctionExpression(node));

//TODO make this Functional
const replaceVarAndBody = str => (variable, body) => replaceBody(body)(replaceVar(variable)(str));
const replaceTypeAndBody = str => (type, body) => replaceBody(body)(replaceType(type)(str));
const replaceTypeAndBodyAndVar = str => (type, body, variable) => replaceVar(variable)(replaceBody(body)(replaceType(type)(str)));

const fillNewFunctionStatementPattern = type => body => replaceTypeAndBody(NEW_FUN_STM_PATTERN)(type, body);
const fillNewFunctionDeclarationPattern = variable => type => body => replaceTypeAndBodyAndVar(NEW_FUN_DECL_PATTERN)(type, body, variable);

const newFunctionStatement = R.compose(fillNewFunctionStatementPattern(PROXY_FUN_CLASS), utils.node2Code);

//TODO make this Functional
const newFunctionDeclaration = node => fillNewFunctionDeclarationPattern(nodeFunctionName(node))(PROXY_FUN_CLASS)(utils.node2Code(node));

const newFunctionStatementForNode = R.compose(utils.code2Node, newFunctionStatement);
const newFunctionDeclarationForNode = R.compose(utils.code2Node, newFunctionDeclaration);

const expressionBody = R.compose(R.prop('expression'), R.head, R.prop('body'));
const newFunctionProxyStatementNode = R.compose(expressionBody, newFunctionStatementForNode);

const nodeInit = R.compose(defaultObject, R.propOr(emptyObject, 'init'));
const initIsFunctionExpression = R.compose(isFunctionExpressionNode, nodeInit);

const processIfIsFunctionExpression = R.ifElse(isFunctionExpressionNode, newFunctionProxyStatementNode, R.identity);
const mapArgsToFunctionStatement = R.compose(R.map(processIfIsFunctionExpression), R.prop('arguments'));

//TODO make this Functional
const mapCallExpressionArgs = node => R.assoc('arguments', mapArgsToFunctionStatement(node), node);
const mapCallExpressionCallee = node => R.assoc('callee', processIfIsFunctionExpression(node.callee), node);

const processCallExpression = R.compose(mapCallExpressionCallee, mapCallExpressionArgs);
const procesVariableDeclarator = R.ifElse(initIsFunctionExpression, functionProxy, variableProxy);

const nodeLeftName = R.path([ 'left', 'name' ]);

//TODO make this Functional
const mapAssignmentExpression = node => {
  const body = utils.node2Code(R.prop('right')(node));
  return expressionBody(utils.code2Node(replaceVarAndBody(SET_PATTERN)(nodeLeftName(node), body)));
};

const initArgsPath = [ 'init', 'arguments' ];
const nodeInitArgs = R.path(initArgsPath);

//TODO make this Functional
const processVariableDeclaratorNodeArg = argNode => expressionBody(utils.code2Node(replaceVar(R.prop('name')(argNode))(GET_PATTERN)));
const mapArgNode = R.ifElse(isIdentifier, processVariableDeclaratorNodeArg, R.identity);
const processVariableDeclaratorNodeArgs = node => R.assocPath(initArgsPath, nodeInitArgs(node).map(mapArgNode), node);

const step1Visitor = R.cond([
  [ isCallExpression, processCallExpression ],
  [ isVariableDeclarator, procesVariableDeclarator ],
  [ R.T, R.identity ]
]);

const step2Visitor = R.ifElse(isFunctionDeclaration, newFunctionDeclarationForNode, R.identity);
const step3Visitor = R.ifElse(isAssignmentExpression, mapAssignmentExpression, R.identity);
const step4Visitor = R.ifElse(isVariableDeclarator, processVariableDeclaratorNodeArgs, R.identity);

const traverseWithVisitor = visitor => node => estraverse.replace(node, { enter: visitor });
const traverseWithStep1Visitor = traverseWithVisitor(step1Visitor);
const traverseWithStep2Visitor = traverseWithVisitor(step2Visitor);
const traverseWithStep3Visitor = traverseWithVisitor(step3Visitor);
const traverseWithStep4Visitor = traverseWithVisitor(step4Visitor);

const proxify = R.compose(
  traverseWithStep4Visitor,
  traverseWithStep3Visitor,
  traverseWithStep2Visitor,
  traverseWithStep1Visitor,
  utils.code2Node
);

module.exports = proxify;
