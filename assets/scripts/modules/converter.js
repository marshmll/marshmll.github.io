import { TokenType } from "./lexer.js";

export function astToLatex(node) {
  switch (node.type) {
    case TokenType.VAR:
      return node.name;

    case TokenType.NEGATION:
      return `\\neg ${wrapIfNeeded(node.child, node)}`;

    case TokenType.CONJUNCTION:
      if (node.children && node.children.length > 0) {
        return node.children.map((c) => wrapIfNeeded(c, node)).join(" \\land ");
      }
      // fallback if not normalized
      return `${wrapIfNeeded(node.left, node)} \\land ${wrapIfNeeded(
        node.right,
        node
      )}`;

    case TokenType.DISJUNCTION:
      if (node.children && node.children.length > 0) {
        return node.children.map((c) => wrapIfNeeded(c, node)).join(" \\lor ");
      }
      return `${wrapIfNeeded(node.left, node)} \\lor ${wrapIfNeeded(
        node.right,
        node
      )}`;

    case TokenType.IMPLICATION:
      return `${wrapIfNeeded(node.left, node)} \\to ${wrapIfNeeded(
        node.right,
        node
      )}`;

    case TokenType.BICONDITIONAL:
      return `${wrapIfNeeded(node.left, node)} \\leftrightarrow ${wrapIfNeeded(
        node.right,
        node
      )}`;

    default:
      throw new Error("Unknown AST node type: " + node.type);
  }
}

function wrapIfNeeded(child, parent) {
  if (!child) return "";

  // precedence: NEGATION > CONJUNCTION > DISJUNCTION > IMPLICATION > BICONDITIONAL
  const prec = {
    VAR: 5,
    NEGATION: 5,
    CONJUNCTION: 4,
    DISJUNCTION: 3,
    IMPLICATION: 2,
    BICONDITIONAL: 1,
  };

  const childPrec = prec[child.type] || 0;
  const parentPrec = prec[parent.type] || 0;

  const childStr = astToLatex(child);

  // if child precedence is lower, we need parentheses
  if (childPrec < parentPrec) {
    return `(${childStr})`;
  }
  return childStr;
}
