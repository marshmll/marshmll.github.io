import { tokenize, TokenType } from "./modules/lexer.js";
import { parse } from "./modules/parser.js";
import { executeCompleteTransformations } from "./modules/transformer.js";
import { prettify } from "./modules/printer.js";

// Verificador de equivalência aprimorado que trata operações comutativas
function areEquivalent(expression1, expression2) {
  // Primeiro tenta comparação simples de strings
  const cleanedExpression1 = prettify(expression1).replace(/\s+/g, "");
  const cleanedExpression2 = prettify(expression2).replace(/\s+/g, "");

  if (cleanedExpression1 === cleanedExpression2) return true;

  // Se strings não coincidem, tenta comparação estrutural com comutatividade
  return areStructurallyEquivalent(expression1, expression2);
}

function areStructurallyEquivalent(node1, node2) {
  // Manipula casos null/undefined
  if (!node1 || !node2) return node1 === node2;

  // Tipos diferentes não são equivalentes
  if (node1.type !== node2.type) return false;

  switch (node1.type) {
    case TokenType.TRUE:
    case TokenType.FALSE:
      return true;

    case TokenType.VAR:
      return node1.name === node2.name;

    case TokenType.PREDICATE:
      return (
        node1.name === node2.name && areArraysEqual(node1.args, node2.args)
      );

    case TokenType.NEGATION:
      return areStructurallyEquivalent(node1.child, node2.child);

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      // Para operações comutativas, verifica se os conjuntos de children são equivalentes
      const children1 = getAllChildren(node1);
      const children2 = getAllChildren(node2);

      if (children1.length !== children2.length) return false;

      // Verifica se cada child no conjunto1 tem um equivalente no conjunto2
      const matchedIndices = new Set();
      for (const child1 of children1) {
        let foundMatch = false;
        for (let index = 0; index < children2.length; index++) {
          if (
            !matchedIndices.has(index) &&
            areStructurallyEquivalent(child1, children2[index])
          ) {
            matchedIndices.add(index);
            foundMatch = true;
            break;
          }
        }
        if (!foundMatch) return false;
      }
      return true;

    default:
      // Para outros tipos de nó, usa comparação simples
      return cleanedExpression1 === cleanedExpression2;
  }
}

function getAllChildren(node) {
  if (node.children) return node.children;
  if (node.left && node.right) return [node.left, node.right];
  return [];
}

function areArraysEqual(array1, array2) {
  if (array1.length !== array2.length) return false;
  return array1.every((item, index) => item === array2[index]);
}

// Casos de teste com resultados esperados
const testExamples = [
  {
    input: "P \\lor \\neg P",
    description: "Tautologia: P ou não P",
    expectedCNF: "\\top", // Deve simplificar para verdadeiro
    expectedDNF: "\\top", // Deve simplificar para verdadeiro
    expectedStepsCount: 9, // Número esperado de passos de transformação
  },
  {
    input: "P \\land \\neg P",
    description: "Contradição: P e não P",
    expectedCNF: "\\bot", // Deve simplificar para falso
    expectedDNF: "\\bot", // Deve simplificar para falso
    expectedStepsCount: 9,
  },
  {
    input: "(P \\land Q) \\rightarrow R",
    description: "Implicação simples",
    expectedCNF: "(\\neg P \\lor \\neg Q \\lor R)", // Deve estar em FNC
    expectedDNF: "(\\neg P \\lor \\neg Q \\lor R)", // Mesmo que FNC para este caso
    expectedStepsCount: 9,
  },
  {
    input: "\\neg (A \\land B)",
    description: "Negação de conjunção (De Morgan)",
    expectedCNF: "(\\neg A \\lor \\neg B)", // Deve estar em FNC
    expectedDNF: "(\\neg A \\lor \\neg B)", // Mesmo que FNC
    expectedStepsCount: 9,
  },
  {
    input: "\\neg (A \\lor B)",
    description: "Negação de disjunção (De Morgan)",
    expectedCNF: "(\\neg A \\land \\neg B)", // Deve estar em FNC
    expectedDNF: "(\\neg A \\land \\neg B)", // Mesmo que FNC
    expectedStepsCount: 9,
  },
  {
    input: "A \\leftrightarrow B",
    description: "Bicondicional",
    expectedCNF: "(\\neg A \\lor B) \\land (\\neg B \\lor A)", // Deve estar em FNC
    expectedDNF: "(A \\land B) \\lor (\\neg A \\land \\neg B)", // Deve estar em FND
    expectedStepsCount: 9,
  },
  {
    input: "P \\land (Q \\lor R)",
    description: "Caso de teste de distribuição 1",
    expectedCNF: "(P) \\land (Q \\lor R)", // Deve permanecer como está
    expectedDNF: "(P \\land Q) \\lor (P \\land R)", // Deve distribuir
    expectedStepsCount: 9,
  },
  {
    input: "(P \\land Q) \\lor (P \\land R)",
    description: "Caso de teste de distribuição 2",
    expectedCNF: "(P) \\land (Q \\lor R)", // Deve fatorar
    expectedDNF: "(P \\land Q) \\lor (P \\land R)", // Deve permanecer como está
    expectedStepsCount: 9,
  },
  {
    input:
      "(P \\leftrightarrow (Q \\leftrightarrow R)) \\lor \\neg(P \\land Q \\land R)",
    description: "Tautologia com bicondicionais",
    expectedCNF: "\\top", // Deve simplificar para verdadeiro
    expectedDNF:
      "(P \\land Q \\land R) \\lor \\neg P \\lor \\neg Q \\lor \\neg R",
    expectedStepsCount: 9,
  },
  {
    input:
      "((P \\land Q) \\rightarrow (R \\lor S)) \\land ((R \\rightarrow P) \\lor (S \\rightarrow Q))",
    description: "Fórmula complexa",
    expectedDNF:
      "(\\neg P \\land \\neg R) \\lor (\\neg P \\land \\neg S) \\lor (\\neg P \\land Q) \\lor (\\neg Q \\land \\neg R) \\lor (\\neg Q \\land P) \\lor (\\neg Q \\land \\neg S) \\lor (R \\land P) \\lor (R \\land \\neg S) \\lor (R \\land Q) \\lor (S \\land \\neg R) \\lor (S \\land P) \\lor (S \\land Q)",
    expectedStepsCount: 9,
  },
];

function runTestExample(testExample, index) {
  console.log("====================================");
  console.log(`Teste ${index + 1}: ${testExample.description}`);
  console.log("Entrada:", testExample.input);

  try {
    const tokenConsumer = tokenize(testExample.input);
    const abstractSyntaxTree = parse(tokenConsumer);

    console.log("AST Parseado:", prettify(abstractSyntaxTree));

    const transformationSteps =
      executeCompleteTransformations(abstractSyntaxTree);

    // Verifica se obtivemos o número esperado de passos
    if (transformationSteps.length !== testExample.expectedStepsCount) {
      console.warn(
        `⚠️  Esperado ${testExample.expectedStepsCount} passos, obtido ${transformationSteps.length}`
      );
    }

    // Extrai FNC e FND dos passos de transformação
    let actualCNF = null;
    let actualDNF = null;

    for (const step of transformationSteps) {
      if (step.name === "Forma Normal Conjuntiva Prenex") {
        actualCNF = step.result;
      }
      if (step.name === "Forma Normal Disjuntiva Prenex") {
        actualDNF = step.result;
      }
    }

    console.log("Resultado FNC:", actualCNF);
    console.log("Resultado FND:", actualDNF);

    // Verifica contra resultados esperados se fornecidos
    if (testExample.expectedCNF) {
      const expectedCNFAST = parse(tokenize(testExample.expectedCNF));
      const actualCNFAST = parse(tokenize(actualCNF));

      if (areEquivalent(expectedCNFAST, actualCNFAST)) {
        console.log("✅ FNC corresponde ao resultado esperado");
      } else {
        console.log("❌ FNC NÃO corresponde ao resultado esperado");
        console.log("FNC Esperado:", testExample.expectedCNF);
      }
    }

    if (testExample.expectedDNF) {
      const expectedDNF_AST = parse(tokenize(testExample.expectedDNF));
      const actualDNF_AST = parse(tokenize(actualDNF));

      if (areEquivalent(expectedDNF_AST, actualDNF_AST)) {
        console.log("✅ FND corresponde ao resultado esperado");
      } else {
        console.log("❌ FND NÃO corresponde ao resultado esperado");
        console.log("FND Esperado:", testExample.expectedDNF);
      }
    }

    // Mostra todos os passos de transformação
    console.log("\nPassos de transformação:");
    transformationSteps.forEach((step, stepIndex) => {
      console.log(`${stepIndex + 1}. ${step.name}: ${step.result}`);
    });
  } catch (error) {
    console.error("❌ Erro processando exemplo:", error.message);
  }

  console.log("\n");
}

// Executa todos os exemplos de teste
console.log(
  "+++++++++++++++++++++ TESTES DE TRANSFORMAÇÃO LÓGICA +++++++++++++++++++++"
);
testExamples.forEach((testExample, index) =>
  runTestExample(testExample, index)
);
