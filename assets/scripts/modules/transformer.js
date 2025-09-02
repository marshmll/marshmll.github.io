import { TokenType } from "./lexer.js";
import { createNode } from "./parser.js";
import { prettify } from "./printer.js";
import { simplify, simplifyFNC, simplifyFND } from "./simplifier.js";

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
    nome: "Eliminar Implicações",
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

  // Passo 5: Skolemização
  const skolem = skolemizacao(prenex);
  passos.push({
    nome: "Skolemização",
    resultado: prettify(skolem),
  });

  // Passo 6: Eliminar Quantificadores Universais
  const semQuantificadores = eliminarQuantificadoresUniversais(skolem);
  passos.push({
    nome: "Eliminar Quantificadores Universais",
    resultado: prettify(semQuantificadores),
  });

  // Passo 7: Converter para FNC
  const fnc = converterFNC(semQuantificadores);
  passos.push({
    nome: "Forma Normal Conjuntiva",
    resultado: prettify(fnc),
  });

  // Passo 8: Forma Clausal
  const formaClausal = obterFormaClausal(fnc);
  passos.push({
    nome: "Forma Clausal",
    resultado: formaClausal,
  });

  // Passo 9: Identificar Cláusulas de Horn
  const hornClauses = identificarClausulasDeHorn(formaClausal);
  passos.push({
    nome: "Cláusulas de Horn",
    resultado: hornClauses,
  });

  return passos;
}

// Implementação das funções de transformação
function eliminarImplicacoes(ast) {
  if (!ast) return ast;

  switch (ast.type) {
    case TokenType.IMPLIES:
      // A → B ≡ ¬A ∨ B
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
          ? child.children.map((c) => NEG(moverNegacoesParaDentro(c)))
          : [
              NEG(moverNegacoesParaDentro(child.left)),
              NEG(moverNegacoesParaDentro(child.right)),
            ];
        return OR(children);
      }

      if (child.type === TokenType.DISJUNCTION) {
        const children = child.children
          ? child.children.map((c) => NEG(moverNegacoesParaDentro(c)))
          : [
              NEG(moverNegacoesParaDentro(child.left)),
              NEG(moverNegacoesParaDentro(child.right)),
            ];
        return AND(children);
      }

      // Negação de quantificadores
      if (child.type === TokenType.FORALL) {
        return {
          type: TokenType.EXISTS,
          variable: child.variable,
          child: NEG(moverNegacoesParaDentro(child.child)),
        };
      }

      if (child.type === TokenType.EXISTS) {
        return {
          type: TokenType.FORALL,
          variable: child.variable,
          child: NEG(moverNegacoesParaDentro(child.child)),
        };
      }

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
      const novaVariavel = `x_${contador.value++}`;
      const novoMapa = new Map(mapaVariaveis);
      novoMapa.set(ast.variable, novaVariavel);

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

  // Extrai quantificadores recursivamente
  function extrairQuantificadores(node, quantificadores = []) {
    if (node.type === TokenType.FORALL || node.type === TokenType.EXISTS) {
      quantificadores.push({
        type: node.type,
        variable: node.variable,
      });
      return extrairQuantificadores(node.child, quantificadores);
    }

    return { matriz: node, quantificadores };
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
  return aplicarQuantificadores(matriz, quantificadores);
}

function skolemizacao(ast) {
  if (!ast) return ast;

  function skolemizarRecursivamente(
    node,
    quantificadoresUniversais = [],
    funcoesSkolem = new Map()
  ) {
    switch (node.type) {
      case TokenType.EXISTS:
        // Cria função de Skolem para variável existencial
        const nomeFuncao = `f_${funcoesSkolem.size + 1}`;
        const argsSkolem = quantificadoresUniversais.map((q) => q.variable);

        // Substitui variável existencial por função de Skolem
        function substituirVariavel(subNode) {
          if (
            subNode.type === TokenType.VAR &&
            subNode.name === node.variable
          ) {
            return {
              type: TokenType.PREDICATE,
              name: nomeFuncao,
              args: argsSkolem,
            };
          }

          if (subNode.type === TokenType.PREDICATE) {
            return {
              ...subNode,
              args: subNode.args.map((arg) =>
                arg === node.variable
                  ? nomeFuncao + "(" + argsSkolem.join(",") + ")"
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

function converterFNC(ast) {
  // Usa o simplificador existente para FNC
  return simplifyFNC(ast);
}

function obterFormaClausal(ast) {
  if (ast.type === TokenType.TRUE) return "⊤";
  if (ast.type === TokenType.FALSE) return "⊥";

  // Extrai cláusulas da FNC
  function extrairClausulas(node) {
    if (node.type === TokenType.CONJUNCTION) {
      const clausulas = [];

      if (node.children) {
        for (const child of node.children) {
          clausulas.push(...extrairClausulas(child));
        }
      } else {
        clausulas.push(...extrairClausulas(node.left));
        clausulas.push(...extrairClausulas(node.right));
      }

      return clausulas;
    }

    if (node.type === TokenType.DISJUNCTION) {
      const literais = [];

      if (node.children) {
        for (const child of node.children) {
          literais.push(...extrairClausulas(child));
        }
      } else {
        literais.push(...extrairClausulas(node.left));
        literais.push(...extrairClausulas(node.right));
      }

      return [{ tipo: "disjunção", literais }];
    }

    if (node.type === TokenType.NEGATION) {
      const childStr = extrairClausulas(node.child)[0];
      return [`¬${childStr}`];
    }

    return [
      node.type === TokenType.PREDICATE
        ? `${node.name}(${node.args.join(", ")})`
        : node.name,
    ];
  }

  const clausulas = extrairClausulas(ast);
  return clausulas
    .map((c) => {
      if (typeof c === "string") return c;
      return c.literais.join(" ∨ ");
    })
    .join(" ∧ ");
}

function identificarClausulasDeHorn(formaClausal) {
  if (formaClausal === "⊤" || formaClausal === "⊥") {
    return formaClausal;
  }

  const clausulas = formaClausal.split(" ∧ ");
  const hornClauses = [];

  for (const clausula of clausulas) {
    const literais = clausula.split(" ∨ ");
    let positivos = 0;

    for (const literal of literais) {
      if (!literal.startsWith("¬")) {
        positivos++;
      }
    }

    if (positivos <= 1) {
      hornClauses.push(clausula);
    }
  }

  return hornClauses.join(" ∧ ") || "Nenhuma cláusula de Horn encontrada";
}

// Função principal para executar todas as transformações
export function executarTransformacoesCompletas(ast) {
  return transformarFormula(ast);
}
