import { TokenConsumer, TokenType } from "./lexer.js";

// Função auxiliar para criar nós da AST
export function createNode(type, properties = {}) {
  return { type, ...properties };
}

// Função principal de parsing - converte tokens em AST
export function parse(consumer = new TokenConsumer([])) {
  const abstractSyntaxTree = parseExpression(consumer);

  // Verifica se há tokens restantes não processados
  if (consumer.peek() !== null) {
    throw new Error(`Token inesperado: ${JSON.stringify(consumer.peek())}`);
  }

  return abstractSyntaxTree;
}

// Inicia o parsing a partir do nível de expressão
function parseExpression(consumer) {
  return parseBiconditional(consumer);
}

// Parsing de bicondicionais (↔)
function parseBiconditional(consumer) {
  let leftNode = parseImplication(consumer);

  while (consumer.peek()?.type === TokenType.BICONDITIONAL) {
    consumer.next();
    const rightNode = parseImplication(consumer);
    leftNode = createNode(TokenType.BICONDITIONAL, {
      left: leftNode,
      right: rightNode,
    });
  }

  return leftNode;
}

// Parsing de implicações (→)
function parseImplication(consumer) {
  let leftNode = parseDisjunction(consumer);

  while (consumer.peek()?.type === TokenType.IMPLIES) {
    consumer.next();
    const rightNode = parseDisjunction(consumer);
    leftNode = createNode(TokenType.IMPLIES, {
      left: leftNode,
      right: rightNode,
    });
  }

  return leftNode;
}

// Parsing de disjunções (∨)
function parseDisjunction(consumer) {
  let leftNode = parseConjunction(consumer);

  while (consumer.peek()?.type === TokenType.DISJUNCTION) {
    consumer.next();
    const rightNode = parseConjunction(consumer);
    leftNode = createNode(TokenType.DISJUNCTION, {
      left: leftNode,
      right: rightNode,
    });
  }

  return leftNode;
}

// Parsing de conjunções (∧)
function parseConjunction(consumer) {
  let leftNode = parseUnary(consumer);

  while (consumer.peek()?.type === TokenType.CONJUNCTION) {
    consumer.next();
    const rightNode = parseDisjunction(consumer);
    leftNode = createNode(TokenType.CONJUNCTION, {
      left: leftNode,
      right: rightNode,
    });
  }

  return leftNode;
}

// Parsing de operadores unários (¬)
function parseUnary(consumer) {
  if (consumer.peek()?.type === TokenType.NEGATION) {
    consumer.next();
    const childNode = parseUnary(consumer);
    return createNode(TokenType.NEGATION, { child: childNode });
  }

  return parseQuantifiers(consumer);
}

// Parsing de quantificadores (∀, ∃)
function parseQuantifiers(consumer) {
  const tokenType = consumer.peek()?.type;

  if ([TokenType.FORALL, TokenType.EXISTS].includes(tokenType)) {
    consumer.next(); // consome ∀ ou ∃

    // Espera uma variável logo após o quantificador
    const variableToken = consumer.peek();
    if (!variableToken || variableToken.type !== TokenType.VAR) {
      throw new Error(
        `Esperava variável após quantificador, obteve ${variableToken?.literal}`
      );
    }

    // Verifica se é uma variável minúscula
    if (variableToken.literal !== variableToken.literal.toLowerCase()) {
      throw new Error(
        `Variáveis após quantificadores devem ser letras minúsculas (variável ${variableToken?.literal})`
      );
    }

    consumer.next(); // consome a variável

    // Parseia o escopo da fórmula do quantificador
    const childNode = parseQuantifiers(consumer) || parsePrimary(consumer);

    return createNode(tokenType, {
      variable: variableToken.literal,
      child: childNode,
    });
  }

  return parsePrimary(consumer);
}

// Parsing de elementos primários (variáveis, predicados, constantes, parênteses)
function parsePrimary(consumer) {
  const currentToken = consumer.peek();

  if (!currentToken) throw new Error("Fim de input inesperado");

  if (currentToken.type === TokenType.VAR) {
    consumer.next();
    return createNode(TokenType.VAR, { name: currentToken.literal });
  }

  if (currentToken.type === TokenType.PREDICATE) {
    const literal = currentToken.literal;

    // Extrai string dentro dos parênteses
    const regex = /\(([^)]+)\)/;
    const matchResult = literal.match(regex);

    if (!matchResult || !matchResult[1] || matchResult[1].length === 0) {
      throw new Error(
        `Nenhum argumento pôde ser extraído do predicado: ${currentToken.literal}`
      );
    }

    // Divide argumentos: P(x, y) => ["x", "y"]
    const argumentsList = matchResult[1]
      .split(",")
      .map((argument) => argument.trim())
      .filter((argument) => {
        if (argument.length === 0) {
          throw new Error(
            `Erro de sintaxe para o predicado ${literal}: ${argument}. Verifique vírgulas.`
          );
        }

        if (/^\\s*$/.test(argument)) return false;

        if (argument.length > 1) {
          throw new Error(
            `Argumento inválido para o predicado ${literal}: ${argument}. Argumentos devem ser apenas letras únicas.`
          );
        }

        if (argument !== argument.toLowerCase()) {
          throw new Error(
            `Argumento inválido para o predicado ${literal}: ${argument}. Argumentos devem ser letras minúsculas.`
          );
        }

        return true;
      });

    if (argumentsList.length === 0) {
      throw new Error(
        `Predicado não forneceu argumentos: ${currentToken.literal}`
      );
    }

    consumer.next();
    return createNode(TokenType.PREDICATE, {
      name: literal[0],
      args: argumentsList,
    });
  }

  if (
    currentToken.type === TokenType.TRUE ||
    currentToken.type === TokenType.FALSE
  ) {
    consumer.next();
    return createNode(currentToken.type);
  }

  if (currentToken.type === TokenType.NEGATION) {
    consumer.next();
    const childNode = parseUnary(consumer);
    return createNode(TokenType.NEGATION, { child: childNode });
  }

  if (currentToken.type === TokenType.UNKNOWN) {
    throw new Error(`Erro de sintaxe: ${currentToken.literal}`);
  }

  // Parsing de expressões entre parênteses/colchetes/chaves
  if (
    currentToken.type === TokenType.LPAREN ||
    currentToken.type === TokenType.LBRACE ||
    currentToken.type === TokenType.LBRACKET
  ) {
    consumer.next();

    const expressionNode = parseExpression(consumer);

    const closingToken = consumer.peek();

    const expectedClosingToken = {
      LPAREN: TokenType.RPAREN,
      LBRACE: TokenType.RBRACE,
      LBRACKET: TokenType.RBRACKET,
    };

    if (
      !closingToken ||
      closingToken.type !== expectedClosingToken[currentToken.type]
    ) {
      throw new Error(
        `Parênteses/colchetes/chaves não foi fechado (esperado: "${
          expectedClosingToken[currentToken.type]
        }", encontrado "${closingToken?.literal}")`
      );
    }

    consumer.next();
    return expressionNode;
  }

  throw new Error(`Token inesperado: ${currentToken.literal}`);
}
