import { tokenize } from "./modules/lexer.js";
import { parse } from "./modules/parser.js";
import { executarTransformacoesCompletas } from "./modules/transformer.js";

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

// Highlighted steps
const HIGHLIGHTED_STEPS = [
  "Forma Normal Conjuntiva Prenex",
  "Forma Normal Disjuntiva Prenex",
  "Forma Clausal",
  "Cláusula de Horn",
];

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const newTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const themeIcon = document.getElementById("theme-icon");
  if (theme === "dark") {
    themeIcon.className = "fas fa-sun";
  } else {
    themeIcon.className = "fas fa-moon";
  }
}

// ================= Render LaTeX Function =================
function renderLatex(latexText, element) {
  try {
    element.innerHTML = ""; // clear previous
    if (!latexText.trim()) {
      element.innerHTML = `<span style="color: var(--text-light);">Sua fórmula aparecerá aqui</span>`;
      element.classList.remove("has-content");
      return;
    }

    const container = document.createElement("div");
    container.className = "katex-container";

    // Use KaTeX to render the LaTeX
    katex.render(latexText, container, {
      displayMode: true,
      throwOnError: false,
      macros: customMacros,
    });

    element.appendChild(container);
    element.classList.add("has-content");
  } catch (error) {
    element.innerHTML = `<div class="text-center p-4" style="color: var(--accent);"><i class="fas fa-exclamation-circle mr-2"></i>Erro: ${error.message}</div>`;
    element.classList.remove("has-content");
  }
}

// ================= Display Steps =================
function displaySteps(steps) {
  const stepsContainer = document.getElementById("steps-content");

  // Clear previous content
  stepsContainer.innerHTML = "";

  // Create grid for steps
  const grid = document.createElement("div");
  grid.className = "steps-grid";
  stepsContainer.appendChild(grid);

  // Create cards for each step
  steps.forEach((step, index) => {
    const isHighlighted = HIGHLIGHTED_STEPS.includes(step.nome);

    const stepCard = document.createElement("div");
    stepCard.className = `step-card ${isHighlighted ? "highlighted" : ""}`;

    // Set animation delay for staggered effect
    stepCard.style.animationDelay = `${index * 0.1}s`;

    stepCard.innerHTML = `
      <div class="flex items-center mb-2">
        <span class="step-number">${index + 1}</span>
        <h3 class="text-md font-semibold">${step.nome}</h3>
      </div>
      <div class="step-content">
        <button class="copy-btn" data-formula="${step.resultado.replace(
          /"/g,
          "&quot;"
        )}">
          <i class="fas fa-copy"></i>
        </button>
        <div class="step-result" id="step-${index}"></div>
      </div>
    `;

    grid.appendChild(stepCard);

    // Render the LaTeX for this step with a slight delay
    setTimeout(() => {
      renderLatex(step.resultado, document.getElementById(`step-${index}`));
    }, 100 + index * 100);
  });

  // Add copy event listeners after a delay to ensure elements are rendered
  setTimeout(() => {
    document.querySelectorAll(".copy-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const formula = btn.getAttribute("data-formula");
        copyToClipboard(formula);
      });
    });
  }, 500);
}

// ================= Copy to Clipboard =================
function copyToClipboard(text) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      // Show toast notification
      const toast = document.getElementById("toast");
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2000);
    })
    .catch((err) => {
      console.error("Falha ao copiar texto: ", err);
    });
}

// ================= Event Listeners =================
const latexInput = document.getElementById("latex-input");
const latexOutput = document.getElementById("latex-output");
const calculateBtn = document.getElementById("calculate-btn");
const exampleChips = document.querySelectorAll(".example-chip");
const themeToggle = document.getElementById("theme-toggle");

// Initialize theme
initTheme();

// Theme toggle
themeToggle.addEventListener("click", toggleTheme);

// Live LaTeX preview
latexInput.addEventListener("input", () => {
  renderLatex(latexInput.value, latexOutput);
});

// Example chips
exampleChips.forEach((chip) => {
  chip.addEventListener("click", () => {
    latexInput.value = chip.dataset.formula;
    renderLatex(latexInput.value, latexOutput);
  });
});

// Calculate button
calculateBtn.addEventListener("click", () => {
  const formula = latexInput.value.trim();
  if (!formula) return;

  // Show loading state
  const stepsContainer = document.getElementById("steps-content");
  stepsContainer.innerHTML = `
    <div class="text-center p-8" style="color: var(--text-light);">
      <i class="fas fa-spinner fa-spin text-xl mb-3" style="color: var(--primary);"></i>
      <p>Processando transformações<span class="loading-dots"><span></span><span></span><span></span></span></p>
    </div>`;

  try {
    const consumer = tokenize(formula);
    const ast = parse(consumer);
    const steps = executarTransformacoesCompletas(ast);

    console.log(steps);

    displaySteps(steps);
  } catch (error) {
    stepsContainer.innerHTML = `
      <div class="text-center p-4" style="color: var(--accent);">
        <i class="fas fa-exclamation-circle mr-2"></i>
        Erro: ${error.message}
      </div>`;
  }
});

// Initial render
document.addEventListener("DOMContentLoaded", () => {
  renderLatex(latexInput.value, latexOutput);
});
