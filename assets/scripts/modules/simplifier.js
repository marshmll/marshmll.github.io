import { TokenType } from "./lexer.js";
import { createNode } from "./parser.js";
import { TRUE, FALSE, NEG, OR, AND } from "./transformer.js";

const keyOf = (node) => JSON.stringify(node);

// Is node a literal? (VAR, TRUE/FALSE, or NEGATION of atomic)
function isLiteral(n) {
  if (!n) return false;
  if (n.type === TokenType.TRUE || n.type === TokenType.FALSE) return true;
  if (n.type === TokenType.VAR) return true;
  if (n.type === TokenType.PREDICATE) return true;
  if (n.type === TokenType.NEGATION) {
    const c = n.child;
    return (
      c.type === TokenType.VAR ||
      c.type === TokenType.TRUE ||
      c.type === TokenType.FALSE ||
      c.type === TokenType.PREDICATE
    );
  }
  return false;
}

function literalKey(n) {
  if (n.type === TokenType.NEGATION) return "!" + keyOf(n.child);
  return keyOf(n);
}

function areComplementary(a, b) {
  return (
    literalKey(a) === "!" + literalKey(b) ||
    literalKey(b) === "!" + literalKey(a)
  );
}

// Flatten nested same-type nodes (A ∧ (B ∧ C)) -> (A ∧ B ∧ C)
function flattenSame(opType, children) {
  const out = [];
  for (const c of children) {
    if (c.type === opType && c.children) out.push(...c.children);
    else out.push(c);
  }
  return out;
}

// Deduplicate array of nodes structurally
function uniqNodes(nodes) {
  const seen = new Set();
  const out = [];
  for (const n of nodes) {
    const k = keyOf(n);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(n);
    }
  }
  return out;
}

export function simplify(node) {
  if (!node) return null;

  switch (node.type) {
    case TokenType.TRUE:
    case TokenType.FALSE:
    case TokenType.VAR:
    case TokenType.PREDICATE:
      return node;

    case TokenType.NEGATION: {
      const c = simplify(node.child);
      // ~~A => A
      if (c.type === TokenType.NEGATION) return simplify(c.child);
      // ~TRUE = FALSE ; ~FALSE = TRUE
      if (c.type === TokenType.TRUE) return FALSE();
      if (c.type === TokenType.FALSE) return TRUE();
      return NEG(c);
    }

    case TokenType.CONJUNCTION: {
      // simplify children first
      let kids = (node.children ?? [node.left, node.right])
        .filter(Boolean)
        .map(simplify);

      // Flatten and dedup
      kids = flattenSame(TokenType.CONJUNCTION, kids);
      kids = uniqNodes(kids);

      // Identity & domination
      // A ∧ TRUE = A ; A ∧ FALSE = FALSE
      if (kids.some((k) => k.type === TokenType.FALSE)) return FALSE();
      kids = kids.filter((k) => k.type !== TokenType.TRUE);

      // Short-circuit: empty ∧ => TRUE
      if (kids.length === 0) return TRUE();
      if (kids.length === 1) return kids[0];

      // If any child is disjunction, we don't distribute here (that's transformer’s job).
      // But we CAN do literal-level contradiction inside pure-term conjunctions.
      // If all are literals, check L ∧ ~L => FALSE
      const allLits = kids.every(isLiteral);
      if (allLits) {
        for (let i = 0; i < kids.length; i++) {
          for (let j = i + 1; j < kids.length; j++) {
            if (areComplementary(kids[i], kids[j])) return FALSE();
          }
        }
      }

      // If this is a FND term (∧ of literals), we keep it as is.
      return AND(kids);
    }

    case TokenType.DISJUNCTION: {
      let kids = (node.children ?? [node.left, node.right])
        .filter(Boolean)
        .map(simplify);

      kids = flattenSame(TokenType.DISJUNCTION, kids);
      kids = uniqNodes(kids);

      // Identity & domination
      // A ∨ FALSE = A ; A ∨ TRUE = TRUE
      if (kids.some((k) => k.type === TokenType.TRUE)) return TRUE();
      kids = kids.filter((k) => k.type !== TokenType.FALSE);

      if (kids.length === 0) return FALSE();
      if (kids.length === 1) return kids[0];

      // If all literals, detect tautology L ∨ ~L => TRUE
      const allLits = kids.every(isLiteral);
      if (allLits) {
        for (let i = 0; i < kids.length; i++) {
          for (let j = i + 1; j < kids.length; j++) {
            if (areComplementary(kids[i], kids[j])) return TRUE();
          }
        }
      }

      return OR(kids);
    }

    // pass-through for quantifiers
    case TokenType.FORALL:
    case TokenType.EXISTS:
      return { ...node, child: simplify(node.child) };

    // Implications/biconditionals should be gone before simplify; just recurse defensively
    case TokenType.IMPLIES:
    case TokenType.BICONDITIONAL:
      return {
        ...node,
        left: simplify(node.left),
        right: simplify(node.right),
      };

    default:
      throw new Error("Unknown node type in simplify: " + node.type);
  }
}

export function simplifyFNC(root) {
  const n = simplify(root);
  if (n.type !== TokenType.CONJUNCTION) return n; // already a single clause or constant

  // Convert each clause to a normalized set of literals
  const clauses = n.children.map(simplifyClauseForFNC).filter(Boolean); // drop TRUE clauses

  // If any clause is FALSE => whole FNC is FALSE
  if (clauses.some((c) => c.kind === TokenType.FALSE)) return FALSE();

  // Subsumption: drop any clause that is a superset of another
  const kept = [];
  for (let i = 0; i < clauses.length; i++) {
    let isSubsumed = false;
    for (let j = 0; j < clauses.length; j++) {
      if (i === j) continue;

      // i ⊆ j means j is redundant (keep i, remove j). We'll handle by only dropping supersets.
      // Here we only mark i as subsumed if j ⊆ i (i is superset). So swap:

      if (isSubset(clauses[j].set, clauses[i].set)) {
        // j ⊆ i => i is superset => drop i
        isSubsumed = true;
        break;
      }
    }
    if (!isSubsumed) kept.push(clauses[i]);
  }

  if (kept.length === 0) return TRUE(); // all were TRUE or subsumed away

  // Rebuild AST
  const rebuilt = kept.map((c) => disjunctionFromSet(c.set));
  if (rebuilt.length === 1) return rebuilt[0];
  return AND(rebuilt);
}

export function simplifyFND(root) {
  const n = simplify(root);
  if (n.type !== TokenType.DISJUNCTION) return n; // already a single term or constant

  // Convert each term to normalized set of literals
  const terms = n.children.map(simplifyTermForFND).filter(Boolean); // drop FALSE terms

  // If any term is TRUE => whole FND is TRUE
  if (terms.some((t) => t.kind === TokenType.TRUE)) return TRUE();

  // Subsumption: in FND, drop supersets (A ∨ (A ∧ B) = A)
  const kept = [];
  for (let i = 0; i < terms.length; i++) {
    let isSubsumed = false;
    for (let j = 0; j < terms.length; j++) {
      if (i === j) continue;
      if (isSubset(terms[j].set, terms[i].set)) {
        // j ⊆ i => i is superset => drop i
        isSubsumed = true;
        break;
      }
    }
    if (!isSubsumed) kept.push(terms[i]);
  }

  if (kept.length === 0) return FALSE(); // all terms false or subsumed (rare after above)

  const rebuilt = kept.map((t) => conjunctionFromSet(t.set));
  if (rebuilt.length === 1) return rebuilt[0];
  return OR(rebuilt);
}

function simplifyClauseForFNC(node) {
  // A clause is a DISJUNCTION of literals (or a single literal).
  // Handle constants inside: L ∨ TRUE = TRUE, L ∨ FALSE drops FALSE.
  if (node.type === TokenType.TRUE) return { kind: TokenType.TRUE };
  if (node.type === TokenType.FALSE) return { kind: TokenType.FALSE };

  let lits = [];
  if (node.type === TokenType.DISJUNCTION && node.children)
    lits = node.children;
  else lits = [node];

  // Keep only literals; simplify() should have ensured this, but be safe.
  lits = lits.map(simplify).filter(isLiteral);

  // If clause contains complementary literals => clause is TRUE
  for (let i = 0; i < lits.length; i++) {
    for (let j = i + 1; j < lits.length; j++) {
      if (areComplementary(lits[i], lits[j])) return { kind: TokenType.TRUE };
    }
  }

  // Drop FALSE literals, dedup
  lits = lits.filter((l) => l.type !== TokenType.FALSE);
  const set = new Set(lits.map(literalKey));

  if (set.size === 0) return { kind: TokenType.FALSE }; // empty clause -> FALSE
  return { kind: "CLAUSE", set };
}

function simplifyTermForFND(node) {
  // A term is a CONJUNCTION of literals (or a single literal).
  if (node.type === TokenType.TRUE) return { kind: TokenType.TRUE };
  if (node.type === TokenType.FALSE) return { kind: TokenType.FALSE };

  let lits = [];
  if (node.type === TokenType.CONJUNCTION && node.children)
    lits = node.children;
  else lits = [node];

  lits = lits.map(simplify).filter(isLiteral);

  // If term contains complementary literals => FALSE
  for (let i = 0; i < lits.length; i++) {
    for (let j = i + 1; j < lits.length; j++) {
      if (areComplementary(lits[i], lits[j])) return { kind: TokenType.FALSE };
    }
  }

  // Drop TRUE literals, dedup
  lits = lits.filter((l) => l.type !== TokenType.TRUE);
  const set = new Set(lits.map(literalKey));

  if (set.size === 0) return { kind: TokenType.TRUE }; // empty conjunction -> TRUE
  return { kind: "TERM", set };
}

function isSubset(setA, setB) {
  // is A ⊆ B ? (sets are JS Set of literal keys)
  for (const a of setA) if (!setB.has(a)) return false;
  return true;
}

function disjunctionFromSet(set) {
  const nodes = [...set].map(fromLiteralKey);
  return nodes.length === 1 ? nodes[0] : OR(nodes);
}

function conjunctionFromSet(set) {
  const nodes = [...set].map(fromLiteralKey);
  return nodes.length === 1 ? nodes[0] : AND(nodes);
}

function fromLiteralKey(k) {
  if (k.startsWith("!")) return NEG(JSON.parse(k.slice(1)));
  return JSON.parse(k);
}
