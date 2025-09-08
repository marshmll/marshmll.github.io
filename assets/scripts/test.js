import { tokenize, TokenType } from "./modules/lexer.js";
import { parse } from "./modules/parser.js";
import { executarTransformacoesCompletas } from "./modules/transformer.js";
import { prettify } from "./modules/printer.js";

// Enhanced equivalence checker that handles commutative operations
function areEquivalent(expr1, expr2) {
  // First try simple string comparison
  const clean1 = prettify(expr1).replace(/\s+/g, "");
  const clean2 = prettify(expr2).replace(/\s+/g, "");

  if (clean1 === clean2) return true;

  // If strings don't match, try structural comparison with commutativity
  return areStructurallyEquivalent(expr1, expr2);
}

function areStructurallyEquivalent(node1, node2) {
  // Handle null/undefined cases
  if (!node1 || !node2) return node1 === node2;

  // Different types are not equivalent
  if (node1.type !== node2.type) return false;

  switch (node1.type) {
    case TokenType.TRUE:
    case TokenType.FALSE:
      return true;

    case TokenType.VAR:
      return node1.name === node2.name;

    case TokenType.PREDICATE:
      return node1.name === node2.name && arraysEqual(node1.args, node2.args);

    case TokenType.NEGATION:
      return areStructurallyEquivalent(node1.child, node2.child);

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      // For commutative operations, check if children sets are equivalent
      const children1 = getChildren(node1);
      const children2 = getChildren(node2);

      if (children1.length !== children2.length) return false;

      // Check if each child in set1 has an equivalent in set2
      const matched = new Set();
      for (const child1 of children1) {
        let foundMatch = false;
        for (let j = 0; j < children2.length; j++) {
          if (
            !matched.has(j) &&
            areStructurallyEquivalent(child1, children2[j])
          ) {
            matched.add(j);
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) return false;
      }
      return true;

    default:
      // For other node types, use simple comparison
      return clean1 === clean2;
  }
}

function getChildren(node) {
  if (node.children) return node.children;
  if (node.left && node.right) return [node.left, node.right];
  return [];
}

function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((item, i) => item === arr2[i]);
}

// Test cases with expected results
const examples = [
  {
    input: "P \\lor \\neg P",
    description: "Tautology: P or not P",
    expectedFNC: "\\top", // Should simplify to true
    expectedFND: "\\top", // Should simplify to true
    expectedSteps: 9, // Number of transformation steps expected
  },
  {
    input: "P \\land \\neg P",
    description: "Contradiction: P and not P",
    expectedFNC: "\\bot", // Should simplify to false
    expectedFND: "\\bot", // Should simplify to false
    expectedSteps: 9,
  },
  {
    input: "(P \\land Q) \\rightarrow R",
    description: "Simple implication",
    expectedFNC: "(\\neg P \\lor \\neg Q \\lor R)", // Should be in CNF
    expectedFND: "(\\neg P \\lor \\neg Q \\lor R)", // Same as CNF for this case
    expectedSteps: 9,
  },
  {
    input: "\\neg (A \\land B)",
    description: "Negation of conjunction (De Morgan)",
    expectedFNC: "(\\neg A \\lor \\neg B)", // Should be in CNF
    expectedFND: "(\\neg A \\lor \\neg B)", // Same as CNF
    expectedSteps: 9,
  },
  {
    input: "\\neg (A \\lor B)",
    description: "Negation of disjunction (De Morgan)",
    expectedFNC: "(\\neg A \\land \\neg B)", // Should be in CNF
    expectedFND: "(\\neg A \\land \\neg B)", // Same as CNF
    expectedSteps: 9,
  },
  {
    input: "A \\leftrightarrow B",
    description: "Biconditional",
    expectedFNC: "(\\neg A \\lor B) \\land (\\neg B \\lor A)", // Should be in CNF
    expectedFND: "(A \\land B) \\lor (\\neg A \\land \\neg B)", // Should be in DNF
    expectedSteps: 9,
  },
  {
    input: "P \\land (Q \\lor R)",
    description: "Distribution test case 1",
    expectedFNC: "(P) \\land (Q \\lor R)", // Should remain as is
    expectedFND: "(P \\land Q) \\lor (P \\land R)", // Should distribute
    expectedSteps: 9,
  },
  {
    input: "(P \\land Q) \\lor (P \\land R)",
    description: "Distribution test case 2",
    expectedFNC: "(P) \\land (Q \\lor R)", // Should factor
    expectedFND: "(P \\land Q) \\lor (P \\land R)", // Should remain as is
    expectedSteps: 9,
  },
  {
    input:
      "(P \\leftrightarrow (Q \\leftrightarrow R)) \\lor \\neg(P \\land Q \\land R)",
    description: "Tautology with biconditionals",
    expectedFNC: "\\top", // Should simplify to true
    expectedFND:
      "(P \\land Q \\land R) \\lor \\neg P \\lor \\neg Q \\lor \\neg R",
    expectedSteps: 9,
  },
  {
    input:
      "((P \\land Q) \\rightarrow (R \\lor S)) \\land ((R \\rightarrow P) \\lor (S \\rightarrow Q))",
    description: "Complex formula",
    expectedFND:
      "(\\neg P \\land \\neg R) \\lor (\\neg P \\land \\neg S) \\lor (\\neg P \\land Q) \\lor (\\neg Q \\land \\neg R) \\lor (\\neg Q \\land P) \\lor (\\neg Q \\land \\neg S) \\lor (R \\land P) \\lor (R \\land \\neg S) \\lor (R \\land Q) \\lor (S \\land \\neg R) \\lor (S \\land P) \\lor (S \\land Q)",
    expectedSteps: 9,
  },
];

function runExample(example, index) {
  console.log("====================================");
  console.log(`Test ${index + 1}: ${example.description}`);
  console.log("Input:", example.input);

  try {
    const consumer = tokenize(example.input);
    const ast = parse(consumer);

    console.log("Parsed AST:", prettify(ast));

    const passos = executarTransformacoesCompletas(ast);

    // Check if we got the expected number of steps
    if (passos.length !== example.expectedSteps) {
      console.warn(
        `⚠️  Expected ${example.expectedSteps} steps, got ${passos.length}`
      );
    }

    // Extract FNC and FND from the transformation steps
    let actualFNC = null;
    let actualFND = null;

    for (const passo of passos) {
      if (passo.nome === "Forma Normal Conjuntiva Prenex") {
        actualFNC = passo.resultado;
      }
      if (passo.nome === "Forma Normal Disjuntiva Prenex") {
        actualFND = passo.resultado;
      }
    }

    console.log("FNC Result:", actualFNC);
    console.log("FND Result:", actualFND);

    // Check against expected results if provided
    if (example.expectedFNC) {
      const expectedFNCAST = parse(tokenize(example.expectedFNC));
      const actualFNCAST = parse(tokenize(actualFNC));

      if (areEquivalent(expectedFNCAST, actualFNCAST)) {
        console.log("✅ FNC matches expected result");
      } else {
        console.log("❌ FNC does NOT match expected result");
        console.log("Expected FNC:", example.expectedFNC);
      }
    }

    if (example.expectedFND) {
      const expectedFNDAST = parse(tokenize(example.expectedFND));
      const actualFNDAST = parse(tokenize(actualFND));

      if (areEquivalent(expectedFNDAST, actualFNDAST)) {
        console.log("✅ FND matches expected result");
      } else {
        console.log("❌ FND does NOT match expected result");
        console.log("Expected FND:", example.expectedFND);
      }
    }

    // Show all transformation steps
    console.log("\nTransformation steps:");
    passos.forEach((passo, i) => {
      console.log(`${i + 1}. ${passo.nome}: ${passo.resultado}`);
    });
  } catch (error) {
    console.error("❌ Error processing example:", error.message);
  }

  console.log("\n");
}

// Run all examples
console.log(
  "+++++++++++++++++++++ LOGIC TRANSFORMATION TESTS +++++++++++++++++++++"
);
examples.forEach((example, index) => runExample(example, index));
