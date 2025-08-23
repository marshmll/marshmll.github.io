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
    input: "(P \\land Q) \\to R",
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
    input: "\\forall x \\exists y ((P(x) \\land Q(x)) \\to R(x, y))",
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
  console.log("Descrição:", example.description);
  console.log("Expressão:", example.input);

  // Tokenize and parse
  const consumer = tokenize(example.input);
  const ast = parse(consumer);

  const norm = normalizeAssociative(ast);
  console.log("Normalizando por associatividade:", prettify(norm));

  const phase1 = eliminateImplicationAndBiconditional(norm);
  console.log("Eliminando cláusulas compostas:", prettify(phase1));

  const phase2 = pushNegationsInwards(phase1);
  console.log("Aplicando negações/De Morgan:", prettify(phase2));

  const phase3 = toPrenex(phase2);
  console.log("Forma Normal Prenexa:", prettify(phase3));

  // FNC
  const fnc = simplifyFNC(distributeFNC(phase3));
  console.log("Forna Normal Conjuntiva:", prettify(fnc));

  // FND
  const fnd = simplifyFND(distributeFND(phase3));
  console.log("Forma Normal Disjuntiva:", prettify(fnd));

  console.log("\n");
}

// Run all examples
console.log("+++++++++++++++++++++ TESTES +++++++++++++++++++++");
examples.forEach(runExample);
