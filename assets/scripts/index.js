import { tokenize } from "./modules/lexer.js";
import { parse } from "./modules/parser.js";
import { normalizeAssociative } from "./modules/transformer.js";
import { toFNC, toFND } from "./modules/transformer.js";
import { astToLatex } from "./modules/converter.js";

// DOM elements
const latexInput = document.getElementById("latex-input");
const latexOutput = document.getElementById("latex-output");
const calculateBtn = document.getElementById("calculate-btn");
const cnfOutput = document.getElementById("fnc-output");
const dnfOutput = document.getElementById("fnd-output");
const exampleChips = document.querySelectorAll(".example-chip");

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

// Function to render LaTeX using KaTeX
function renderLatex(latexText, element) {
  try {
    // Clear previous content
    element.innerHTML = "";

    // Create a container for the KaTeX rendering
    const container = document.createElement("div");
    container.className = "katex-container";

    // Render using KaTeX with custom macros
    katex.render(latexText, container, {
      displayMode: true,
      throwOnError: false,
      macros: customMacros,
    });

    // Add to the output element
    element.appendChild(container);
    element.classList.add("has-content");
  } catch (error) {
    element.innerHTML = `<div class="text-red-500 text-center p-4"><i class="fas fa-exclamation-circle mr-2"></i>Erro ao renderizar fórmula: ${error.message}</div>`;
    element.classList.remove("has-content");
  }
}

// Function to calculate FNC and FND
function calculateNormalForms(formula) {
  const consumer = tokenize(formula);
  const node = parse(consumer);
  const norm = normalizeAssociative(node);
  const fncAst = toFNC(norm);
  const fndAst = toFND(norm);

  let fnc = astToLatex(fncAst);
  let fnd = astToLatex(fndAst);

  return { fnc, fnd };
}

// Event listener for input changes
latexInput.addEventListener("input", () => {
  const formula = latexInput.value;
  renderLatex(formula, latexOutput);
});

// Event listener for example chips
exampleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    latexInput.value = chip.getAttribute("data-formula");
    renderLatex(latexInput.value, latexOutput);
  });
});

// Event listener for calculate button
calculateBtn.addEventListener("click", () => {
  const formula = latexInput.value;

  // Show loading state
  cnfOutput.innerHTML =
    '<div class="text-center text-gray-500 p-4"><i class="fas fa-spinner fa-spin mr-2"></i>Calculando...</div>';
  dnfOutput.innerHTML =
    '<div class="text-center text-gray-500 p-4"><i class="fas fa-spinner fa-spin mr-2"></i>Calculando...</div>';

  try {
    const results = calculateNormalForms(formula);

    // Render FNC
    renderLatex(results.fnc, cnfOutput);

    // Render FND
    renderLatex(results.fnd, dnfOutput);
  } catch (error) {
    cnfOutput.innerHTML = `<div class="text-red-500 text-center p-4"><i class="fas fa-exclamation-circle mr-2"></i>Erro: ${error.message}</div>`;
    dnfOutput.innerHTML = `<div class="text-red-500 text-center p-4"><i class="fas fa-exclamation-circle mr-2"></i>Erro: ${error.message}</div>`;
  }
});

// Initial render
document.addEventListener("DOMContentLoaded", function () {
  renderLatex(latexInput.value, latexOutput);
});
