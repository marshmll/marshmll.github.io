import { TokenType } from "./lexer.js";
import { createNode } from "./parser.js";

const NEG = (child = {}) => createNode(TokenType.NEGATION, { child });
const AND = (children = []) => createNode(TokenType.CONJUNCTION, { children });
const OR = (children = []) => createNode(TokenType.DISJUNCTION, { children });

export function normalizeAssociative(node) {
  if (!node) return null;

  // Leaf nodes (variables, negations, etc.) are already normalized
  if (node.type === TokenType.VAR) {
    return node;
  }

  if (node.type === TokenType.NEGATION) {
    return {
      type: TokenType.NEGATION,
      child: normalizeAssociative(node.child),
    };
  }

  // Handle binary operators
  if ([TokenType.CONJUNCTION, TokenType.DISJUNCTION].includes(node.type)) {
    const children = [];

    // Helper to collect children recursively
    function collect(n) {
      const norm = normalizeAssociative(n);
      if (norm.type === node.type && norm.children) {
        // flatten same-type nodes
        children.push(...norm.children);
      } else {
        children.push(norm);
      }
    }

    collect(node.left);
    collect(node.right);

    return {
      type: node.type,
      children,
    };
  }

  // Non-associative binary operators remain binary
  if ([TokenType.IMPLICATION, TokenType.BICONDITIONAL].includes(node.type)) {
    return {
      type: node.type,
      left: normalizeAssociative(node.left),
      right: normalizeAssociative(node.right),
    };
  }

  throw new Error("Tipo de nó desconhecido: " + node.type);
}

export function eliminateImplicationAndBiconditional(node) {
  if (!node) return null;

  switch (node.type) {
    case TokenType.VAR: {
      return node;
    }

    case TokenType.NEGATION: {
      const C = eliminateImplicationAndBiconditional(node.child);
      return NEG(C);
    }

    case TokenType.IMPLICATION: {
      // A -> B === ~A v B
      const A = eliminateImplicationAndBiconditional(node.left);
      const B = eliminateImplicationAndBiconditional(node.right);

      return OR([NEG(A), eliminateImplicationAndBiconditional(B)]);
    }

    case TokenType.BICONDITIONAL: {
      // A <-> B === (A ^ B) v (~A ^ ~B)
      const A = eliminateImplicationAndBiconditional(node.left);
      const B = eliminateImplicationAndBiconditional(node.right);

      return OR([AND([A, B]), AND([NEG(A), NEG(B)])]);
    }

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      return createNode(node.type, {
        children: node.children.map(eliminateImplicationAndBiconditional),
      });
  }
}

export function pushNegationsInwards(node) {
  if (!node) return null;

  switch (node.type) {
    case TokenType.VAR:
      return node;

    case TokenType.NEGATION: {
      const child = node.child;

      if (child.type === TokenType.VAR) return node;

      // ~~A
      if (child.type === TokenType.NEGATION) {
        return pushNegationsInwards(child.child);
      }

      // ~(A ^ B) === (~A v ~B) De Morgan
      if (child.type === TokenType.CONJUNCTION) {
        return pushNegationsInwards(OR(child.children.map((c) => NEG(c))));
      }

      // ~(A v B) === (~A ^ ~B) De Morgan
      if (child.type === TokenType.DISJUNCTION) {
        return pushNegationsInwards(AND(child.children.map((c) => NEG(c))));
      }
    }

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      return createNode(node.type, {
        children: node.children.map(pushNegationsInwards),
      });
  }
}

export function distributeFNC(node) {
  if (!node) return null;

  if (node.type === TokenType.DISJUNCTION) {
    let andChild = node.children.find((c) => c.type === TokenType.CONJUNCTION);

    if (andChild) {
      const rest = node.children.filter((c) => c !== andChild);

      // map returns array, spread it directly into AND
      return AND(andChild.children.map((c) => distributeFNC(OR([c, ...rest]))));
    }
  }

  if (
    node.type === TokenType.CONJUNCTION ||
    node.type === TokenType.DISJUNCTION
  ) {
    return {
      type: node.type,
      children: node.children.map(distributeFNC),
    };
  }

  return node;
}

export function distributeFND(node) {
  if (!node) return null;

  if (node.type === TokenType.CONJUNCTION) {
    let orChild = node.children.find((c) => c.type === TokenType.DISJUNCTION);

    if (orChild) {
      const rest = node.children.filter((c) => c !== orChild);

      return OR(orChild.children.map((c) => distributeFND(AND([c, ...rest]))));
    }
  }

  if (
    node.type === TokenType.CONJUNCTION ||
    node.type === TokenType.DISJUNCTION
  ) {
    return {
      type: node.type,
      children: node.children.map(distributeFND),
    };
  }

  return node;
}

export function toFNC(ast) {
  return distributeFNC(
    pushNegationsInwards(eliminateImplicationAndBiconditional(ast))
  );
}

export function toFND(ast) {
  return distributeFND(
    pushNegationsInwards(eliminateImplicationAndBiconditional(ast))
  );
}
