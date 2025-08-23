import { TokenType } from "./lexer.js";
import { createNode } from "./parser.js";

export const NEG = (child = {}) => createNode(TokenType.NEGATION, { child });
export const AND = (children = []) =>
  createNode(TokenType.CONJUNCTION, { children });
export const OR = (children = []) =>
  createNode(TokenType.DISJUNCTION, { children });
export const TRUE = () => createNode(TokenType.TRUE);
export const FALSE = () => createNode(TokenType.FALSE);
export const FORALL = (variable, child = {}) =>
  createNode(TokenType.FORALL, { variable, child });
export const EXISTS = (variable, child = {}) =>
  createNode(TokenType.EXISTS, { variable, child });

export function normalizeAssociative(node) {
  if (!node) return null;

  // Leaf nodes: variable or predicate
  if (
    [
      TokenType.VAR,
      TokenType.PREDICATE,
      TokenType.TRUE,
      TokenType.FALSE,
    ].includes(node.type)
  )
    return node;

  if (node.type === TokenType.NEGATION) {
    return NEG(normalizeAssociative(node.child));
  }

  if ([TokenType.CONJUNCTION, TokenType.DISJUNCTION].includes(node.type)) {
    const children = [];

    // Collect left/right recursively
    if (node.left) children.push(normalizeAssociative(node.left));
    if (node.right) children.push(normalizeAssociative(node.right));
    if (node.children)
      children.push(...node.children.map(normalizeAssociative));

    return createNode(node.type, {
      children: flattenAndDeduplicate(node.type, children),
    });
  }

  if ([TokenType.IMPLIES, TokenType.BICONDITIONAL].includes(node.type)) {
    return createNode(node.type, {
      left: normalizeAssociative(node.left),
      right: normalizeAssociative(node.right),
    });
  }

  if ([TokenType.FORALL, TokenType.EXISTS].includes(node.type)) {
    return createNode(node.type, {
      variable: node.variable,
      child: normalizeAssociative(node.child),
    });
  }

  console.log(node);

  throw new Error("Unknown node type: " + node.type);
}

export function flattenChildren(children) {
  const flat = [];
  for (const c of children) {
    if (!c) continue;
    if (Array.isArray(c)) flat.push(...flattenChildren(c));
    else if (
      c.type === TokenType.CONJUNCTION ||
      c.type === TokenType.DISJUNCTION
    ) {
      flat.push(c);
    } else flat.push(c);
  }
  return flat;
}

function flattenAndDeduplicate(nodeType, children) {
  const flat = [];

  for (const c of children) {
    if (!c) continue;

    // Flatten same-type children
    if (c.type === nodeType && c.children) {
      flat.push(...flattenAndDeduplicate(nodeType, c.children));
    } else {
      flat.push(c);
    }
  }

  // Deduplicate based on JSON string (simplest way for AST)
  const seen = new Set();
  const unique = [];
  for (const c of flat) {
    const str = JSON.stringify(c);
    if (!seen.has(str)) {
      seen.add(str);
      unique.push(c);
    }
  }

  return unique;
}

// Collect free variables of a node
export function freeVars(node) {
  switch (node.type) {
    case TokenType.VAR:
      return new Set([node.name]);

    case TokenType.TRUE:
    case TokenType.FALSE:
      return new Set();

    case TokenType.NEGATION:
      return freeVars(node.child);

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      return node.children.reduce((acc, c) => {
        for (let v of freeVars(c)) acc.add(v);
        return acc;
      }, new Set());

    case TokenType.IMPLICATION:
    case TokenType.BICONDITIONAL: {
      let fvLeft = freeVars(node.left);
      let fvRight = freeVars(node.right);
      return new Set([...fvLeft, ...fvRight]);
    }

    case TokenType.FORALL:
    case TokenType.EXISTS: {
      let childFv = freeVars(node.child);
      childFv.delete(node.variable.literal);
      return childFv;
    }

    default:
      return new Set();
  }
}

// Generate fresh variable name if conflict
let varCounter = 0;
function freshVar(base = "x") {
  return `${base}_${varCounter++}`;
}

// Deep clone with variable substitution
function substituteVar(node, oldName, newName) {
  if (!node) return null;

  switch (node.type) {
    case TokenType.VAR:
      if (node.name === oldName) {
        return { ...node, name: newName };
      }
      return node;

    case TokenType.NEGATION:
      return { ...node, child: substituteVar(node.child, oldName, newName) };

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      return {
        ...node,
        children: node.children.map((c) => substituteVar(c, oldName, newName)),
      };

    case TokenType.IMPLICATION:
    case TokenType.BICONDITIONAL:
      return {
        ...node,
        left: substituteVar(node.left, oldName, newName),
        right: substituteVar(node.right, oldName, newName),
      };

    case TokenType.FORALL:
    case TokenType.EXISTS: {
      let variable = node.variable.literal;
      if (variable === oldName) return node; // bound variable, shadowed
      return {
        ...node,
        child: substituteVar(node.child, oldName, newName),
      };
    }

    default:
      return node;
  }
}

export function transform(node) {
  return eliminateImplicationAndBiconditional(node);
}

export function eliminateImplicationAndBiconditional(node) {
  if (!node) return null;

  switch (node.type) {
    case TokenType.VAR:
    case TokenType.PREDICATE:
    case TokenType.TRUE:
    case TokenType.FALSE: {
      return node;
    }

    case TokenType.NEGATION: {
      const C = eliminateImplicationAndBiconditional(node.child);
      return NEG(C);
    }

    case TokenType.IMPLIES: {
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
    case TokenType.DISJUNCTION: {
      return createNode(node.type, {
        children: node.children.map(eliminateImplicationAndBiconditional),
      });
    }

    case TokenType.FORALL:
    case TokenType.EXISTS: {
      return createNode(node.type, {
        variable: node.variable,
        child: eliminateImplicationAndBiconditional(node.child),
      });
    }
  }
}

export function pushNegationsInwards(node) {
  if (!node) return null;

  switch (node.type) {
    case TokenType.VAR:
    case TokenType.PREDICATE:
    case TokenType.TRUE:
    case TokenType.FALSE:
      return node;

    case TokenType.NEGATION: {
      const child = node.child;

      if ([TokenType.VAR, TokenType.PREDICATE].includes(child.type))
        return node;

      // Double negation
      if (child.type === TokenType.NEGATION)
        return pushNegationsInwards(child.child);

      // Quantifiers
      if (child.type === TokenType.FORALL)
        return pushNegationsInwards(EXISTS(child.variable, NEG(child.child)));
      if (child.type === TokenType.EXISTS)
        return pushNegationsInwards(FORALL(child.variable, NEG(child.child)));

      // De Morgan
      if (child.type === TokenType.CONJUNCTION)
        return pushNegationsInwards(OR(child.children.map((c) => NEG(c))));
      if (child.type === TokenType.DISJUNCTION)
        return pushNegationsInwards(AND(child.children.map((c) => NEG(c))));
    }

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      return createNode(node.type, {
        children: node.children.map(pushNegationsInwards),
      });

    case TokenType.FORALL:
    case TokenType.EXISTS:
      return createNode(node.type, {
        variable: node.variable,
        child: pushNegationsInwards(node.child),
      });

    default:
      throw new Error("Unknown node type: " + node.type);
  }
}

export function distributeFNC(node) {
  if (!node) return null;

  // Handle quantifiers: just push inside
  if ([TokenType.FORALL, TokenType.EXISTS].includes(node.type)) {
    return createNode(node.type, {
      variable: node.variable,
      child: distributeFNC(node.child),
    });
  }

  if (node.type === TokenType.DISJUNCTION) {
    // Find AND child to distribute
    const andChild = node.children.find(
      (c) => c.type === TokenType.CONJUNCTION
    );

    if (andChild) {
      const rest = node.children.filter((c) => c !== andChild);
      const distributed = andChild.children.map((c) =>
        distributeFNC(OR([c, ...rest]))
      );
      return AND(flattenChildren(distributed));
    }
  }

  if ([TokenType.CONJUNCTION, TokenType.DISJUNCTION].includes(node.type)) {
    const newChildren = node.children.map(distributeFNC);
    return createNode(node.type, { children: flattenChildren(newChildren) });
  }

  return node;
}

export function distributeFND(node) {
  if (!node) return null;

  if ([TokenType.FORALL, TokenType.EXISTS].includes(node.type)) {
    return createNode(node.type, {
      variable: node.variable,
      child: distributeFND(node.child),
    });
  }

  if (node.type === TokenType.CONJUNCTION) {
    const orChild = node.children.find((c) => c.type === TokenType.DISJUNCTION);

    if (orChild) {
      const rest = node.children.filter((c) => c !== orChild);
      const distributed = orChild.children.map((c) =>
        distributeFND(AND([c, ...rest]))
      );
      return OR(flattenChildren(distributed));
    }
  }

  if ([TokenType.CONJUNCTION, TokenType.DISJUNCTION].includes(node.type)) {
    const newChildren = node.children.map(distributeFND);
    return createNode(node.type, { children: flattenChildren(newChildren) });
  }

  return node;
}

export function toPrenex(node) {
  if (!node) return null;

  switch (node.type) {
    case TokenType.VAR:
    case TokenType.TRUE:
    case TokenType.FALSE:
      return node;

    case TokenType.NEGATION: {
      const child = toPrenex(node.child);
      return { ...node, child };
    }

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION: {
      const children = node.children.map(toPrenex);

      // Collect quantifiers from children
      let quantifiers = [];
      let processed = [];

      for (let c of children) {
        if ([TokenType.FORALL, TokenType.EXISTS].includes(c.type)) {
          let inner = c;

          while ([TokenType.FORALL, TokenType.EXISTS].includes(inner.type)) {
            let qVar = inner.variable.literal;

            // Check for capture risk
            for (let other of children) {
              if (other !== inner) {
                const fv = freeVars(other);
                if (fv.has(qVar)) {
                  // conflict → rename
                  let fresh = freshVar(qVar);
                  inner = {
                    ...inner,
                    variable: { ...inner.variable, literal: fresh },
                    child: substituteVar(inner.child, qVar, fresh),
                  };
                  qVar = fresh;
                }
              }
            }

            quantifiers.push({
              type: inner.type,
              variable: inner.variable,
            });
            inner = inner.child;
          }
          processed.push(inner);
        } else {
          processed.push(c);
        }
      }

      // Rebuild connective
      let base = { ...node, children: processed };

      // Wrap quantifiers outward in order
      for (let q of quantifiers.reverse()) {
        base = {
          type: q.type,
          variable: q.variable,
          child: base,
        };
      }

      return base;
    }

    case TokenType.IMPLICATION:
    case TokenType.BICONDITIONAL: {
      const left = toPrenex(node.left);
      const right = toPrenex(node.right);

      // Pull quantifiers from both sides
      let quantifiers = [];
      let l = left;
      let r = right;

      function extractQuantifiers(n) {
        let qs = [];
        let inner = n;
        while ([TokenType.FORALL, TokenType.EXISTS].includes(inner.type)) {
          qs.push({ type: inner.type, variable: inner.variable });
          inner = inner.child;
        }
        return { qs, inner };
      }

      const lq = extractQuantifiers(l);
      const rq = extractQuantifiers(r);

      l = lq.inner;
      r = rq.inner;

      quantifiers = [...lq.qs, ...rq.qs];

      let base = { ...node, left: l, right: r };

      for (let q of quantifiers.reverse()) {
        base = {
          type: q.type,
          variable: q.variable,
          child: base,
        };
      }

      return base;
    }

    case TokenType.FORALL:
    case TokenType.EXISTS: {
      const child = toPrenex(node.child);
      return { ...node, child };
    }

    default:
      return node;
  }
}

export function transformationPipeline(ast) {
  let transformed = eliminateImplicationAndBiconditional(ast);
  transformed = pushNegationsInwards(transformed);
  transformed = toPrenex(transformed);
  return transformed;
}

export function toFNC(ast) {
  return distributeFNC(transformationPipeline(ast));
}

export function toFND(ast) {
  return distributeFND(transformationPipeline(ast));
}
