import { TokenConsumer, TokenType } from "./lexer.js";

export function createNode(type, props = {}) {
  return { type, ...props };
}

export function parse(consumer = new TokenConsumer([])) {
  const ast = parseExpression(consumer);

  if (consumer.peek() !== null) {
    throw new Error(`Token inesperado: ${JSON.stringify(consumer.peek())}`);
  }

  return ast;
}

function parseExpression(consumer) {
  return parseBiconditional(consumer);
}

function parseBiconditional(consumer) {
  let left = parseImplication(consumer);

  while (consumer.peek()?.type === TokenType.BICONDITIONAL) {
    consumer.next();
    const right = parseImplication(consumer);
    left = createNode(TokenType.BICONDITIONAL, { left, right });
  }

  return left;
}

function parseImplication(consumer) {
  let left = parseDisjunction(consumer);

  while (consumer.peek()?.type === TokenType.IMPLICATION) {
    consumer.next();
    const right = parseDisjunction(consumer);
    left = createNode(TokenType.IMPLICATION, { left, right });
  }

  return left;
}

function parseDisjunction(consumer) {
  let left = parseConjunction(consumer);

  while (consumer.peek()?.type === TokenType.DISJUNCTION) {
    consumer.next();
    const right = parseConjunction(consumer);
    left = createNode(TokenType.DISJUNCTION, { left, right });
  }

  return left;
}

function parseConjunction(consumer) {
  let left = parseUnary(consumer);

  while (consumer.peek()?.type === TokenType.CONJUNCTION) {
    consumer.next();
    const right = parseDisjunction(consumer);
    left = createNode(TokenType.CONJUNCTION, { left, right });
  }

  return left;
}

function parseUnary(consumer) {
  if (consumer.peek()?.type === TokenType.NEGATION) {
    consumer.next();
    const child = parseUnary(consumer);
    return createNode(TokenType.NEGATION, { child });
  }

  return parsePrimary(consumer);
}

function parsePrimary(consumer) {
  const token = consumer.peek();

  if (!token) throw new Error("Fim de input inesperado");

  if (token.type === TokenType.VAR) {
    consumer.next();
    return createNode(TokenType.VAR, { name: token.literal });
  }

  if (token.type === TokenType.TRUE || token.type === TokenType.FALSE) {
    consumer.next();
    return createNode(token.type);
  }

  if (
    token.type === TokenType.LPAREN ||
    token.type === TokenType.LBRACE ||
    token.type === TokenType.LBRACKET
  ) {
    consumer.next();

    const expr = parseExpression(consumer);

    const closingSymbol = consumer.peek();

    const expected = {
      LPAREN: TokenType.RPAREN,
      LBRACE: TokenType.RBRACE,
      LBRACKET: TokenType.RBRACKET,
    };

    if (!closingSymbol || closingSymbol.type !== expected[token.type]) {
      throw new Error(
        `Parênteses/colchetes/chaves não foi fechado (esperado: "${
          expected[token.type]
        }", encontrado "${closingSymbol?.literal}")`
      );
    }

    consumer.next();
    return expr;
  }

  throw new Error(`Token inesperado: ${token.literal}`);
}
