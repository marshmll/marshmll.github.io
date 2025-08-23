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

export const LiteralTokenMap = {
  "\\land": TokenType.CONJUNCTION,
  "\\lor": TokenType.DISJUNCTION,
  "\\rightarrow": TokenType.IMPLIES,
  "\\leftrightarrow": TokenType.BICONDITIONAL,
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

export class TokenConsumer {
  constructor(tokens) {
    this.currentIndex = 0;
    this.tokens = tokens;
  }

  peek() {
    if (this.currentIndex >= this.tokens.length) return null;
    return this.tokens[this.currentIndex];
  }

  next() {
    if (this.currentIndex >= this.tokens.length) return null;
    return this.tokens[this.currentIndex++];
  }
}

function isPrefixOfAnyKey(buf) {
  return Object.keys(LiteralTokenMap).some((k) => k.startsWith(buf));
}

function createToken(type, literal, position = -1) {
  return { type, literal, position };
}

export function tokenize(input = "") {
  let buf = "";
  const chars = input.split("");
  const tokens = [];

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];

    // Handle single propositional variables (P, Q, R, x, y, z)
    if (
      /^[a-zA-Z]$/.test(c) &&
      !/^[a-zA-Z]$/.test(chars[i + 1]) &&
      !/^[a-zA-Z]$/.test(chars[i - 1])
    ) {
      if (buf.length > 0) {
        // Flush pending buffer first
        if (LiteralTokenMap[buf]) {
          tokens.push(createToken(LiteralTokenMap[buf], buf, i));
        } else {
          tokens.push(createToken(TokenType.UNKNOWN, buf.i));
        }
        buf = "";
      }

      // Handle predicates
      if (chars[i + 1] == "(") {
        while (i < chars.length) {
          buf += chars[i];
          if (chars[i] == ")") break;
          i++;
        }

        tokens.push(createToken(TokenType.PREDICATE, buf, i));
        buf = "";
      } else {
        tokens.push(createToken(TokenType.VAR, c, i));
      }

      continue;
    }

    if (c === " ") continue; // skip whitespace

    buf += c;

    // Exact match with known token
    if (LiteralTokenMap[buf]) {
      tokens.push(createToken(LiteralTokenMap[buf], buf, i));
      buf = "";
      continue;
    }

    // If buf is not a prefix of any token, flush as unknown
    if (!isPrefixOfAnyKey(buf)) {
      tokens.push(createToken(TokenType.UNKNOWN, buf, i));

      buf = "";
    }
  }

  // Flush leftover buffer at the end
  if (buf.length > 0) {
    if (LiteralTokenMap[buf]) {
      tokens.push(LiteralTokenMap[buf]);
    } else {
      tokens.push(createToken(TokenType.UNKNOWN, buf, i));
    }
  }

  return new TokenConsumer(tokens);
}
