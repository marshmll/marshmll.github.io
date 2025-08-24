import { tokenize } from "./modules/lexer.js";
import { parse } from "./modules/parser.js";
import {
  distributeFNC,
  distributeFND,
  eliminateImplicationAndBiconditional,
  normalizeAssociative,
  pushNegationsInwards,
  toPrenex,
} from "./modules/transformer.js";
import { prettify } from "./modules/printer.js";
import { simplifyFNC, simplifyFND } from "./modules/simplifier.js";

// Test cases
const examples = [
  {
    input: "(P \\land Q) \\rightarrow R",
    description: "Simple implication",
  },
  {
    input: "\\neg (A \\land B)",
    description: "Negation of conjunction",
  },
  {
    input: "(A \\lor B) \\land C",
    description: "Nested disjunctions",
  },
  {
    input: "\\forall x \\exists y ((P(x) \\land Q(x)) \\rightarrow R(x, y))",
    description: "Quantifiers with implication",
  },
  {
    input: "\\neg \\forall x \\exists y P(x, y)",
    description: "Negated quantifiers",
  },
  {
    input: "A \\leftrightarrow B",
    description: "Biconditional",
  },
];

function runExample(example) {
  console.log("====================================");
  console.log("Description:", example.description);
  console.log("Expression:", example.input);

  const consumer = tokenize(example.input);
  const ast = parse(consumer);

  const norm = normalizeAssociative(ast);
  console.log("Normalizing by associativity:", prettify(norm));

  const phase1 = eliminateImplicationAndBiconditional(norm);
  console.log("Eliminating compound clauses:", prettify(phase1));

  const phase2 = pushNegationsInwards(phase1);
  console.log("Applying negations/De Morgan:", prettify(phase2));

  const phase3 = toPrenex(phase2);
  console.log("Prexen Normal Form:", prettify(phase3));

  const fnc = simplifyFNC(distributeFNC(phase3));
  console.log("Conjunctive Normal Form:", prettify(fnc));

  const fnd = simplifyFND(distributeFND(phase3));
  console.log("Disjunctive Normal Form:", prettify(fnd));

  console.log("\n");
}

// Run all examples
console.log("+++++++++++++++++++++ TESTS +++++++++++++++++++++");
examples.forEach(runExample);
