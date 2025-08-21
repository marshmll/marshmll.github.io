import { astToLatex } from "./modules/converter.js";
import { tokenize } from "./modules/lexer.js";
import { parse } from "./modules/parser.js";
import { normalizeAssociative, toFNC, toFND } from "./modules/transformer.js";

const input = "(P \\leftrightarrow Q)";
const consumer = tokenize(input);

const ast = parse(consumer);
const norm = normalizeAssociative(ast);
const fnc = toFNC(norm);
const fnd = toFND(norm);

console.log("FNC:", astToLatex(fnc));
console.log("FND:", astToLatex(fnd));
