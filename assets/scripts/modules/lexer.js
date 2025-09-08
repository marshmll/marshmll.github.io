// Mapeamento de tipos de tokens para lógica proposicional e de predicados
export const TokenType = {
  UNKNOWN: "UNKNOWN",
  CONJUNCTION: "CONJUNCTION",
  DISJUNCTION: "DISJUNCTION",
  IMPLIES: "IMPLIES",
  BICONDITIONAL: "BICONDITIONAL",
  NEGATION: "NEGATION",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  LBRACKET: "LBRACKET",
  RBRACKET: "RBRACKET",
  LBRACE: "LBRACE",
  RBRACE: "RBRACE",
  TRUE: "TRUE",
  FALSE: "FALSE",
  VAR: "VAR",
  PREDICATE: "PREDICATE",
  FORALL: "FORALL",
  EXISTS: "EXISTS",
};

// Mapeamento de literais para seus respectivos tipos de token
export const LiteralTokenMap = {
  "\\land": TokenType.CONJUNCTION,
  "\\wedge": TokenType.CONJUNCTION,
  "\\lor": TokenType.DISJUNCTION,
  "\\vee": TokenType.DISJUNCTION,
  "\\rightarrow": TokenType.IMPLIES,
  "\\leftrightarrow": TokenType.BICONDITIONAL,
  "\\iff": TokenType.BICONDITIONAL,
  "\\neg": TokenType.NEGATION,
  "\\lnot": TokenType.NEGATION,
  "(": TokenType.LPAREN,
  ")": TokenType.RPAREN,
  "[": TokenType.LBRACKET,
  "]": TokenType.RBRACKET,
  "{": TokenType.LBRACE,
  "}": TokenType.RBRACE,
  "\\top": TokenType.TRUE,
  "\\bot": TokenType.FALSE,
  "\\forall": TokenType.FORALL,
  "\\exists": TokenType.EXISTS,
};

// Consumidor de tokens para navegar pela lista de tokens
export class TokenConsumer {
  constructor(tokens) {
    this.currentIndex = 0;
    this.tokens = tokens;
  }

  // Retorna o próximo token sem consumi-lo (lookahead)
  peek() {
    if (this.currentIndex >= this.tokens.length) return null;
    return this.tokens[this.currentIndex];
  }

  // Retorna o próximo token e avança o índice
  next() {
    if (this.currentIndex >= this.tokens.length) return null;
    return this.tokens[this.currentIndex++];
  }
}

// Verifica se o buffer é prefixo de alguma chave no mapa de tokens
function isPrefixOfAnyKey(buffer) {
  return Object.keys(LiteralTokenMap).some((key) => key.startsWith(buffer));
}

// Função auxiliar para criar objetos token
function createToken(type, literal, position = -1) {
  return { type, literal, position };
}

// Função principal de tokenização - converte string em tokens
export function tokenize(input = "") {
  let buffer = "";
  const characters = input.split("");
  const tokens = [];

  for (let currentIndex = 0; currentIndex < characters.length; currentIndex++) {
    const currentCharacter = characters[currentIndex];

    // Manipula variáveis proposicionais únicas (P, Q, R, x, y, z)
    if (
      /^[a-zA-Z]$/.test(currentCharacter) &&
      !/^[a-zA-Z]$/.test(characters[currentIndex + 1]) &&
      !/^[a-zA-Z]$/.test(characters[currentIndex - 1])
    ) {
      if (buffer.length > 0) {
        // Processa buffer pendente primeiro
        if (LiteralTokenMap[buffer]) {
          tokens.push(
            createToken(LiteralTokenMap[buffer], buffer, currentIndex)
          );
        } else {
          tokens.push(createToken(TokenType.UNKNOWN, buffer, currentIndex));
        }
        buffer = "";
      }

      // Manipula predicados (ex: P(x))
      if (characters[currentIndex + 1] == "(") {
        while (currentIndex < characters.length) {
          buffer += characters[currentIndex];
          if (characters[currentIndex] == ")") break;
          currentIndex++;
        }

        tokens.push(createToken(TokenType.PREDICATE, buffer, currentIndex));
        buffer = "";
      } else {
        tokens.push(createToken(TokenType.VAR, currentCharacter, currentIndex));
      }

      continue;
    }

    if (currentCharacter === " ") continue; // ignora espaços em branco

    buffer += currentCharacter;

    // Caso de correspondência exata com token conhecido
    if (LiteralTokenMap[buffer]) {
      tokens.push(createToken(LiteralTokenMap[buffer], buffer, currentIndex));
      buffer = "";
      continue;
    }

    // Se o buffer não é prefixo de nenhum token, trata como desconhecido
    if (!isPrefixOfAnyKey(buffer)) {
      tokens.push(createToken(TokenType.UNKNOWN, buffer, currentIndex));
      buffer = "";
    }
  }

  // Processa qualquer conteúdo restante no buffer ao final
  if (buffer.length > 0) {
    if (LiteralTokenMap[buffer]) {
      tokens.push(createToken(LiteralTokenMap[buffer], buffer, currentIndex));
    } else {
      tokens.push(createToken(TokenType.UNKNOWN, buffer, currentIndex));
    }
  }

  return new TokenConsumer(tokens);
}
