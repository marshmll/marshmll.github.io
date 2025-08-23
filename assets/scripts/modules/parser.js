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

  while (consumer.peek()?.type === TokenType.IMPLIES) {
    consumer.next();
    const right = parseDisjunction(consumer);
    left = createNode(TokenType.IMPLIES, { left, right });
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

  return parseQuantifiers(consumer);
}

function parseQuantifiers(consumer) {
  const type = consumer.peek()?.type;

  if ([TokenType.FORALL, TokenType.EXISTS].includes(type)) {
    consumer.next(); // consume ∀ or ∃

    // expect a variable right after
    const variableToken = consumer.peek();
    if (!variableToken || variableToken.type !== TokenType.VAR) {
      throw new Error(
        `Expected variable after quantifier, got ${variableToken?.literal}`
      );
    }

    // Check if is a lowercase variable
    if (variableToken.literal !== variableToken.literal.toLowerCase()) {
      throw new Error(
        `Variáveis depois de quantificadores devem ser letras minúsculas (variável ${variableToken?.literal})`
      );
    }

    consumer.next(); // consume variable

    // parse the formula scope of the quantifier
    const child = parseQuantifiers(consumer) || parsePrimary(consumer);

    return createNode(type, { variable: variableToken.literal, child });
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

  if (token.type === TokenType.PREDICATE) {
    const literal = token.literal;

    // Get string inside the parenthesis
    const regex = /\(([^)]+)\)/;
    const match = literal.match(regex);

    if (!match || !match[1] || match[1].length === 0) {
      throw new Error(
        `Nenhum argumento pôde ser extraído do predicado: ${token.literal}`
      );
    }

    // split args: P(x, y) => ["x", "y"];
    const args = match[1]
      .split(",")
      .map((c) => c.trim())
      .filter((c) => {
        if (c.length === 0) {
          throw new Error(
            `Erro de sintaxe para o predicado ${literal}: ${c}. Verifique vírgulas.`
          );
        }

        if (/^\\s*$/.test(c)) return false;

        if (c.length > 1) {
          throw new Error(
            `Argumento inválido para o predicado ${literal}: ${c}. Argumentos dever ser apenas letras únicas.`
          );
        }

        if (c !== c.toLowerCase()) {
          throw new Error(
            `Argumento inválido para o predicado ${literal}: ${c}. Argumentos dever letras minúsculas.`
          );
        }

        return true;
      });

    if (args.length === 0) {
      throw new Error(`Predicado não forneceu argumentos: ${token.literal}`);
    }

    consumer.next();
    return createNode(TokenType.PREDICATE, { name: literal[0], args });
  }

  if (token.type === TokenType.TRUE || token.type === TokenType.FALSE) {
    consumer.next();
    return createNode(token.type);
  }

  if (token.type === TokenType.UNKNOWN) {
    throw new Error(`Erro de sintaxe: ${token.literal}`);
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
