import { TokenType } from "./lexer.js";
import { createNode } from "./parser.js";
import { prettify } from "./printer.js";
import { simplifyFNC, simplifyFND } from "./simplifier.js";

// Funções auxiliares para criar nós AST
export function AND(children) {
  return createNode(TokenType.CONJUNCTION, { children });
}

export function OR(children) {
  return createNode(TokenType.DISJUNCTION, { children });
}

export function NEG(child) {
  return createNode(TokenType.NEGATION, { child });
}

export function TRUE() {
  return createNode(TokenType.TRUE);
}

export function FALSE() {
  return createNode(TokenType.FALSE);
}

// Transformação principal
export function transformarFormula(ast) {
  const passos = [];

  // Passo 1: Eliminar Implicações
  const semImplicacoes = eliminarImplicacoes(ast);
  passos.push({
    nome: "Eliminar Implicações e Bicondicionais",
    resultado: prettify(semImplicacoes),
  });

  // Passo 2: Mover Negações para Dentro (Forma Normal Negativa)
  const fnn = moverNegacoesParaDentro(semImplicacoes);
  passos.push({
    nome: "Forma Normal Negativa",
    resultado: prettify(fnn),
  });

  // Passo 3: Padronizar Variáveis
  const padronizado = padronizarVariaveis(fnn);
  passos.push({
    nome: "Padronizar Variáveis",
    resultado: prettify(padronizado),
  });

  // Passo 4: Forma Normal Prenex
  const prenex = formaPrenex(padronizado);
  passos.push({
    nome: "Forma Normal Prenex",
    resultado: prettify(prenex),
  });

  // Passo 5: Forma Normal Conjuntiva Prenex
  const fncPrenex = converterFNC(prenex);
  passos.push({
    nome: "Forma Normal Conjuntiva Prenex",
    resultado: prettify(fncPrenex),
  });

  // Passo 6: Forma Normal Disjuntiva Prenex
  const fndPrenex = converterFND(prenex);
  passos.push({
    nome: "Forma Normal Disjuntiva Prenex",
    resultado: prettify(fndPrenex),
  });

  // Passo 7: Skolemização
  const skolem = skolemizacao(prenex);
  passos.push({
    nome: "Skolemização",
    resultado: prettify(skolem),
  });

  // Passo 8: Eliminar Quantificadores Universais
  const semQuantificadores = eliminarQuantificadoresUniversais(skolem);
  passos.push({
    nome: "Eliminar Quantificadores Universais",
    resultado: prettify(semQuantificadores),
  });

  // Passo 9: Obter Forma Clausal
  const formaClausal = obterFormaClausal(converterFNC(semQuantificadores));
  passos.push({
    nome: "Forma Clausal",
    resultado: formaClausal,
  });

  // // Passo 10: Identificar Cláusulas de Horn
  // const hornClauses = identificarClausulasDeHorn(formaClausal);
  // passos.push({
  //   nome: "Cláusulas de Horn",
  //   resultado: hornClauses,
  // });

  return passos;
}

// Implementação das funções de transformação
function eliminarImplicacoes(ast) {
  if (!ast) return ast;

  switch (ast.type) {
    case TokenType.IMPLIES:
      // A → B ≡ ¬A \\lor B
      return OR([
        NEG(eliminarImplicacoes(ast.left)),
        eliminarImplicacoes(ast.right),
      ]);

    case TokenType.BICONDITIONAL:
      // A ↔ B ≡ (A → B) ∧ (B → A)
      return AND([
        OR([
          NEG(eliminarImplicacoes(ast.left)),
          eliminarImplicacoes(ast.right),
        ]),
        OR([
          NEG(eliminarImplicacoes(ast.right)),
          eliminarImplicacoes(ast.left),
        ]),
      ]);

    case TokenType.NEGATION:
      return NEG(eliminarImplicacoes(ast.child));

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      const children = ast.children
        ? ast.children.map(eliminarImplicacoes)
        : [eliminarImplicacoes(ast.left), eliminarImplicacoes(ast.right)];
      return { ...ast, children };

    case TokenType.FORALL:
    case TokenType.EXISTS:
      return {
        ...ast,
        child: eliminarImplicacoes(ast.child),
      };

    default:
      return ast;
  }
}

function moverNegacoesParaDentro(ast) {
  if (!ast) return ast;

  switch (ast.type) {
    case TokenType.NEGATION:
      const child = ast.child;

      // Dupla negação
      if (child.type === TokenType.NEGATION) {
        return moverNegacoesParaDentro(child.child);
      }

      // Leis de De Morgan
      if (child.type === TokenType.CONJUNCTION) {
        const children = child.children
          ? child.children.map((c) => moverNegacoesParaDentro(NEG(c)))
          : [
              moverNegacoesParaDentro(NEG(child.left)),
              moverNegacoesParaDentro(NEG(child.right)),
            ];
        return OR(children);
      }

      if (child.type === TokenType.DISJUNCTION) {
        const children = child.children
          ? child.children.map((c) => moverNegacoesParaDentro(NEG(c)))
          : [
              moverNegacoesParaDentro(NEG(child.left)),
              moverNegacoesParaDentro(NEG(child.right)),
            ];
        return AND(children);
      }

      // Negação de quantificadores - FIXED to handle recursive negation
      if (child.type === TokenType.FORALL) {
        return {
          type: TokenType.EXISTS,
          variable: child.variable,
          child: moverNegacoesParaDentro(NEG(child.child)),
        };
      }
      if (child.type === TokenType.EXISTS) {
        return {
          type: TokenType.FORALL,
          variable: child.variable,
          child: moverNegacoesParaDentro(NEG(child.child)),
        };
      }

      // Base case: atomic formula
      return NEG(moverNegacoesParaDentro(child));

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      const children = ast.children
        ? ast.children.map(moverNegacoesParaDentro)
        : [
            moverNegacoesParaDentro(ast.left),
            moverNegacoesParaDentro(ast.right),
          ];
      return { ...ast, children };

    case TokenType.FORALL:
    case TokenType.EXISTS:
      return {
        ...ast,
        child: moverNegacoesParaDentro(ast.child),
      };

    default:
      return ast;
  }
}

const variableSequence = ["x", "y", "z", "u", "v", "w"];

function padronizarVariaveis(
  ast,
  mapaVariaveis = new Map(),
  contador = { value: 0 }
) {
  if (!ast) return ast;

  switch (ast.type) {
    case TokenType.VAR:
      if (mapaVariaveis.has(ast.name)) {
        return { ...ast, name: mapaVariaveis.get(ast.name) };
      }
      return ast;

    case TokenType.PREDICATE:
      const novosArgs = ast.args.map((arg) => {
        if (mapaVariaveis.has(arg)) {
          return mapaVariaveis.get(arg);
        }
        return arg;
      });
      return { ...ast, args: novosArgs };

    case TokenType.FORALL:
    case TokenType.EXISTS:
      // Create a NEW map for this scope to avoid polluting parent scope
      const novoMapa = new Map(mapaVariaveis);
      const variavelOriginal = ast.variable;

      // Always create a new variable name for this quantifier, even if it exists in parent scope
      let novaVariavel;
      if (contador.value < variableSequence.length) {
        novaVariavel = variableSequence[contador.value];
      } else {
        novaVariavel = `x_${contador.value - variableSequence.length}`;
      }
      contador.value++;

      novoMapa.set(variavelOriginal, novaVariavel);

      return {
        ...ast,
        variable: novaVariavel,
        child: padronizarVariaveis(ast.child, novoMapa, contador),
      };

    case TokenType.NEGATION:
      return NEG(padronizarVariaveis(ast.child, mapaVariaveis, contador));

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      const children = ast.children
        ? ast.children.map((child) =>
            padronizarVariaveis(child, mapaVariaveis, contador)
          )
        : [
            padronizarVariaveis(ast.left, mapaVariaveis, contador),
            padronizarVariaveis(ast.right, mapaVariaveis, contador),
          ];
      return { ...ast, children };

    default:
      return ast;
  }
}

function formaPrenex(ast) {
  if (!ast) return ast;

  // Função para extrair quantificadores recursivamente de qualquer parte da fórmula
  function extrairQuantificadores(node) {
    if (node.type === TokenType.FORALL || node.type === TokenType.EXISTS) {
      const { quantificadores: quantChild, matriz: matrizChild } =
        extrairQuantificadores(node.child);
      return {
        quantificadores: [
          { type: node.type, variable: node.variable },
          ...quantChild,
        ],
        matriz: matrizChild,
      };
    }

    if (node.type === TokenType.NEGATION) {
      const { quantificadores, matriz } = extrairQuantificadores(node.child);
      return { quantificadores, matriz: NEG(matriz) };
    }

    if (
      node.type === TokenType.CONJUNCTION ||
      node.type === TokenType.DISJUNCTION
    ) {
      const children = node.children || [node.left, node.right];
      let allQuantificadores = [];
      let newChildren = [];

      for (const child of children) {
        const { quantificadores: childQuant, matriz: childMatriz } =
          extrairQuantificadores(child);
        allQuantificadores = [...allQuantificadores, ...childQuant];
        newChildren.push(childMatriz);
      }

      return {
        quantificadores: allQuantificadores,
        matriz: { ...node, children: newChildren },
      };
    }

    // Para outros tipos (VAR, PREDICATE, TRUE, FALSE), não há quantificadores
    return { quantificadores: [], matriz: node };
  }

  // Aplica quantificadores à matriz
  function aplicarQuantificadores(matriz, quantificadores) {
    if (quantificadores.length === 0) return matriz;

    const [primeiro, ...resto] = quantificadores;
    const child = aplicarQuantificadores(matriz, resto);

    return {
      type: primeiro.type,
      variable: primeiro.variable,
      child,
    };
  }

  const { matriz, quantificadores } = extrairQuantificadores(ast);

  // Manter a ordem dos quantificadores, pois mudar altera a semântica completamente!
  return aplicarQuantificadores(matriz, quantificadores);
}

function skolemizacao(ast) {
  if (!ast) return ast;

  let skolemCounter = { value: 0 };

  function skolemizarRecursivamente(
    node,
    quantificadoresUniversais = [],
    funcoesSkolem = new Map()
  ) {
    switch (node.type) {
      case TokenType.EXISTS:
        // Cria função de Skolem para variável existencial
        const nomeFuncao =
          quantificadoresUniversais.length > 0
            ? `f_${skolemCounter.value++}`
            : `c_${skolemCounter.value++ + 1}`;
        const argsSkolem = quantificadoresUniversais.map((q) => q.variable);

        // Substitui variável existencial por função de Skolem
        function substituirVariavel(subNode) {
          if (!subNode) return subNode;

          if (
            subNode.type === TokenType.VAR &&
            subNode.name === node.variable
          ) {
            if (quantificadoresUniversais.length === 0) {
              return {
                type: TokenType.VAR,
                name: nomeFuncao,
              };
            } else {
              return {
                type: TokenType.PREDICATE,
                name: nomeFuncao,
                args: argsSkolem,
              };
            }
          }

          if (subNode.type === TokenType.PREDICATE) {
            return {
              ...subNode,
              args: subNode.args.map((arg) =>
                arg === node.variable
                  ? quantificadoresUniversais.length > 0
                    ? `${nomeFuncao}(${argsSkolem.join(",")})`
                    : nomeFuncao
                  : arg
              ),
            };
          }

          if (subNode.type === TokenType.NEGATION) {
            return NEG(substituirVariavel(subNode.child));
          }

          if (
            subNode.type === TokenType.CONJUNCTION ||
            subNode.type === TokenType.DISJUNCTION
          ) {
            const children = subNode.children
              ? subNode.children.map(substituirVariavel)
              : [
                  substituirVariavel(subNode.left),
                  substituirVariavel(subNode.right),
                ];
            return { ...subNode, children };
          }

          if (
            subNode.type === TokenType.FORALL ||
            subNode.type === TokenType.EXISTS
          ) {
            return {
              ...subNode,
              child: substituirVariavel(subNode.child),
            };
          }

          return subNode;
        }

        return skolemizarRecursivamente(
          substituirVariavel(node.child),
          quantificadoresUniversais,
          funcoesSkolem
        );

      case TokenType.FORALL:
        return {
          ...node,
          child: skolemizarRecursivamente(
            node.child,
            [...quantificadoresUniversais, node],
            funcoesSkolem
          ),
        };

      case TokenType.NEGATION:
        return NEG(
          skolemizarRecursivamente(
            node.child,
            quantificadoresUniversais,
            funcoesSkolem
          )
        );

      case TokenType.CONJUNCTION:
      case TokenType.DISJUNCTION:
        const children = node.children
          ? node.children.map((child) =>
              skolemizarRecursivamente(
                child,
                quantificadoresUniversais,
                funcoesSkolem
              )
            )
          : [
              skolemizarRecursivamente(
                node.left,
                quantificadoresUniversais,
                funcoesSkolem
              ),
              skolemizarRecursivamente(
                node.right,
                quantificadoresUniversais,
                funcoesSkolem
              ),
            ];
        return { ...node, children };

      default:
        return node;
    }
  }

  return skolemizarRecursivamente(ast);
}

function eliminarQuantificadoresUniversais(ast) {
  if (!ast) return ast;

  switch (ast.type) {
    case TokenType.FORALL:
      return eliminarQuantificadoresUniversais(ast.child);

    case TokenType.NEGATION:
      return NEG(eliminarQuantificadoresUniversais(ast.child));

    case TokenType.CONJUNCTION:
    case TokenType.DISJUNCTION:
      const children = ast.children
        ? ast.children.map(eliminarQuantificadoresUniversais)
        : [
            eliminarQuantificadoresUniversais(ast.left),
            eliminarQuantificadoresUniversais(ast.right),
          ];
      return { ...ast, children };

    default:
      return ast;
  }
}

export function normalizarChildren(children) {
  const flat = [];
  for (const c of children) {
    if (!c) continue;
    if (Array.isArray(c)) flat.push(...normalizarChildren(c));
    else if (
      c.type === TokenType.CONJUNCTION ||
      c.type === TokenType.DISJUNCTION
    ) {
      flat.push(c);
    } else flat.push(c);
  }
  return flat;
}

function distribuirFNC(node) {
  if (!node) return null;

  // Handle quantifiers: just push inside
  if ([TokenType.FORALL, TokenType.EXISTS].includes(node.type)) {
    return createNode(node.type, {
      variable: node.variable,
      child: distribuirFNC(node.child),
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
        distribuirFNC(OR([c, ...rest]))
      );
      return AND(normalizarChildren(distributed));
    }
  }

  if ([TokenType.CONJUNCTION, TokenType.DISJUNCTION].includes(node.type)) {
    const newChildren = node.children.map(distribuirFNC);
    return createNode(node.type, { children: normalizarChildren(newChildren) });
  }

  return node;
}

function distribuirFND(node) {
  if (!node) return null;

  if ([TokenType.FORALL, TokenType.EXISTS].includes(node.type)) {
    return createNode(node.type, {
      variable: node.variable,
      child: distribuirFND(node.child),
    });
  }

  if (node.type === TokenType.CONJUNCTION) {
    const orChild = node.children.find((c) => c.type === TokenType.DISJUNCTION);

    if (orChild) {
      const rest = node.children.filter((c) => c !== orChild);
      const distributed = orChild.children.map((c) =>
        distribuirFND(AND([c, ...rest]))
      );
      return OR(normalizarChildren(distributed));
    }
  }

  if ([TokenType.CONJUNCTION, TokenType.DISJUNCTION].includes(node.type)) {
    const newChildren = node.children.map(distribuirFND);
    return createNode(node.type, { children: normalizarChildren(newChildren) });
  }

  return node;
}

function converterFNC(ast) {
  return simplifyFNC(distribuirFNC(ast));
}

function converterFND(ast) {
  return simplifyFND(distribuirFND(ast));
}

function normalizarArvoreBinariaParaNAria(ast) {
  if (!ast) return ast;

  if (
    ast.type === TokenType.CONJUNCTION ||
    ast.type === TokenType.DISJUNCTION
  ) {
    const children = [];

    function coletarFilhos(node) {
      if (node.type === ast.type) {
        node.children.forEach(coletarFilhos);
      } else {
        children.push(normalizarArvoreBinariaParaNAria(node));
      }
    }

    coletarFilhos(ast);
    return { ...ast, children };
  }

  if (ast.type === TokenType.NEGATION) {
    return NEG(normalizarArvoreBinariaParaNAria(ast.child));
  }

  if (ast.type === TokenType.FORALL || ast.type === TokenType.EXISTS) {
    return {
      ...ast,
      child: normalizarArvoreBinariaParaNAria(ast.child),
    };
  }

  return ast;
}

function obterFormaClausal(ast) {
  if (!ast) return "";

  const arvoreNormalizada = normalizarArvoreBinariaParaNAria(ast);

  if (arvoreNormalizada.type === TokenType.CONJUNCTION) {
    const clausulas = arvoreNormalizada.children.map(
      (clause, index) => `C_{${index + 1}}: ${prettify(clause)}`
    );

    return clausulas.join("\\\\");
  }

  return `C_{1}: ${prettify(arvoreNormalizada)}`;
}

// Função principal para executar todas as transformações
export function executarTransformacoesCompletas(ast) {
  return transformarFormula(ast);
}
