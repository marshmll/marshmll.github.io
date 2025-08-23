import { TokenType } from "./lexer.js";

export function prettify(node) {
  switch (node.type) {
    case TokenType.VAR:
      return node.name;

    case TokenType.PREDICATE:
      return `${node.name}(${node.args.join(", ")})`;

    case TokenType.NEGATION:
      return `\\neg ${wrapIfNeeded(node.child, node)}`;

    case TokenType.FORALL:
      return `\\forall ${node.variable} ${wrapIfNeeded(node.child, node)}`;

    case TokenType.EXISTS:
      return `\\exists ${node.variable} ${wrapIfNeeded(node.child, node)}`;

    case TokenType.CONJUNCTION:
      return node.children && node.children.length > 0
        ? node.children.map((c) => wrapIfNeeded(c, node)).join(" \\land ")
        : `${wrapIfNeeded(node.left, node)} \\land ${wrapIfNeeded(
            node.right,
            node
          )}`;

    case TokenType.DISJUNCTION:
      return node.children && node.children.length > 0
        ? node.children.map((c) => wrapIfNeeded(c, node)).join(" \\lor ")
        : `${wrapIfNeeded(node.left, node)} \\lor ${wrapIfNeeded(
            node.right,
            node
          )}`;

    case TokenType.IMPLIES:
      return `${wrapIfNeeded(node.left, node)} \\to ${wrapIfNeeded(
        node.right,
        node
      )}`;

    case TokenType.BICONDITIONAL:
      return `${wrapIfNeeded(node.left, node)} \\leftrightarrow ${wrapIfNeeded(
        node.right,
        node
      )}`;

    case TokenType.TRUE:
      return "\\top";

    case TokenType.FALSE:
      return "\\bot";

    default:
      throw new Error("Unknown AST node type: " + node.type);
  }
}

function wrapIfNeeded(child, parent) {
  if (!child) return "";

  // precedence: higher = binds tighter
  const prec = {
    EXISTS: 7,
    FORALL: 7,
    PREDICATE: 6,
    VAR: 5,
    NEGATION: 5,
    CONJUNCTION: 4,
    DISJUNCTION: 3,
    IMPLICATION: 2,
    BICONDITIONAL: 1,
  };

  const childPrec = prec[child.type] || 0;
  const parentPrec = prec[parent.type] || 0;

  const childStr = prettify(child);

  // if child precedence is strictly lower, wrap
  if (childPrec < parentPrec) {
    return `(${childStr})`;
  }

  // ensure (A ∧ B) inside ∨ gets wrapped
  if (
    parent.type === TokenType.DISJUNCTION &&
    child.type === TokenType.CONJUNCTION
  ) {
    return `(${childStr})`;
  }

  return childStr;
}
