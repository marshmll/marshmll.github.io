import { tokenize } from "./modules/lexer.js";
import { parse } from "./modules/parser.js";
import { normalizeAssociative, toFNC, toFND } from "./modules/transformer.js";
import { prettify } from "./modules/printer.js";
import { simplifyFNC, simplifyFND } from "./modules/simplifier.js";

// DOM elements
const latexInput = document.getElementById("latex-input");
const latexOutput = document.getElementById("latex-output");
const calculateBtn = document.getElementById("calculate-btn");
const cnfOutput = document.getElementById("fnc-output");
const dnfOutput = document.getElementById("fnd-output");
const exampleChips = document.querySelectorAll(".example-chip");
const symbolContainer = document.getElementById("symbol-bg");

// Custom macro definitions for KaTeX
const customMacros = {
  "\\neg": "\\mathord{\\sim}",
  "\\land": "\\wedge",
  "\\lor": "\\vee",
  "\\rightarrow": "\\to",
  "\\leftrightarrow": "\\Leftrightarrow",
  "\\lnot": "\\mathord{\\sim}",
  "\\iff": "\\Leftrightarrow",
  "\\implies": "\\to",
};

// ================= Floating Background Symbols =================
const symbols = ["∧", "∨", "¬"];
for (let i = 0; i < 25; i++) {
  const sym = document.createElement("div");
  sym.className = "symbol";
  sym.innerText = symbols[Math.floor(Math.random() * symbols.length)];
  sym.style.left = `${Math.random() * 100}vw`;
  sym.style.fontSize = `${Math.random() * 24 + 12}px`;
  sym.style.animationDuration = `${Math.random() * 15 + 10}s`;
  symbolContainer.appendChild(sym);
}

// ================= Render LaTeX Function =================
function renderLatex(latexText, element) {
  try {
    element.innerHTML = ""; // clear previous
    if (!latexText.trim()) {
      element.innerHTML =
        '<span class="text-gray-400">Sua fórmula aparecerá aqui</span>';
      element.classList.remove("has-content");
      return;
    }

    const container = document.createElement("div");
    container.className = "katex-container";

    katex.render(latexText, container, {
      displayMode: true,
      throwOnError: false,
      macros: customMacros,
    });

    element.appendChild(container);
    element.classList.add("has-content");
  } catch (error) {
    element.innerHTML = `<div class="text-red-500 text-center p-4"><i class="fas fa-exclamation-circle mr-2"></i>Erro: ${error.message}</div>`;
    element.classList.remove("has-content");
  }
}

// ================= Calculate Normal Forms =================
function calculateNormalForms(formula) {
  const consumer = tokenize(formula);
  const node = parse(consumer);
  const norm = normalizeAssociative(node);
  const fncAst = toFNC(norm);
  const fndAst = toFND(norm);
  const simplifiedFnc = simplifyFNC(fncAst);
  const simplifiedFnd = simplifyFND(fndAst);

  return {
    fnc: prettify(simplifiedFnc),
    fnd: prettify(simplifiedFnd),
  };
}

// ================= Event Listeners =================
// Live LaTeX preview
latexInput.addEventListener("input", () =>
  renderLatex(latexInput.value, latexOutput)
);

// Example chips
exampleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    latexInput.value = chip.dataset.formula;
    renderLatex(latexInput.value, latexOutput);
  });
});

// Calculate button with smooth loading
calculateBtn.addEventListener("click", () => {
  const formula = latexInput.value.trim();
  if (!formula) return;

  // Show loading placeholders
  cnfOutput.innerHTML =
    '<div class="text-center text-gray-500 p-4 animate-pulse"><i class="fas fa-spinner fa-spin mr-2"></i>Calculando...</div>';
  dnfOutput.innerHTML =
    '<div class="text-center text-gray-500 p-4 animate-pulse"><i class="fas fa-spinner fa-spin mr-2"></i>Calculando...</div>';

  setTimeout(() => {
    try {
      const results = calculateNormalForms(formula);
      renderLatex(results.fnc, cnfOutput);
      renderLatex(results.fnd, dnfOutput);
    } catch (error) {
      const errMsg = `<div class="text-red-400 text-center p-4"><i class="fas fa-exclamation-circle mr-2"></i>Erro: ${error.message}</div>`;
      cnfOutput.innerHTML = errMsg;
      dnfOutput.innerHTML = errMsg;
    }
  }, 200); // small delay for smoothness
});

// Initial render
document.addEventListener("DOMContentLoaded", () =>
  renderLatex(latexInput.value, latexOutput)
);
