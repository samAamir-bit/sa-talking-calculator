console.log("SA Talking Calculator is connected!");
// ===== VOICE FEEDBACK =====

// 1. Button names
const spokenNames = {
  "0": "Zero",
  "1": "One",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  ".": "Point",
  "+": "Plus",
  "-": "Minus",
  "*": "Times",
  "/": "Divided by",
  "%": "Percent",
  "clear": "All Clear",
  "delete": "Delete",
  "equals": "Equals"
};

// 2. Speak function
function speak(text) {
  if (!("speechSynthesis" in window)) {
    console.log("Speech is not supported.");
    return;
  }

  window.speechSynthesis.cancel();

  const message = new SpeechSynthesisUtterance(text);
  message.lang = "en-US";
  message.rate = 1;
  message.pitch = 1;
  message.volume = 1;

  window.speechSynthesis.speak(message);
}

// 3. Button click listener
const keypadForVoice = document.querySelector(".keypad");

keypadForVoice.addEventListener("click", function (event) {
  const button = event.target.closest(".btn");
  if (!button) return;

  const key = button.dataset.value || button.dataset.action;
  const word = spokenNames[key];

  if (word) {
    speak(word);
  }
});
// ===== CALCULATOR CONTROLS =====

const expressionEl = document.getElementById("expression");
const resultEl = document.getElementById("result");
const keypadEl = document.querySelector(".keypad");

const MAX_LENGTH = 15;        // longest input allowed
let currentInput = "";        // what the user has typed
let justCalculated = false;   // true right after pressing =
let hasError = false;         // true while an error message is shown
let errorTimer;               // used to speak the error after "Equals"

// ---------- Helpers ----------

function isOperator(char) {
  return ["+", "-", "*", "/"].includes(char);
}

// Show nice symbols on screen (internally we still use * / -)
function prettify(text) {
  return text.replace(/\*/g, "×").replace(/\//g, "÷").replace(/-/g, "−");
}

function updateDisplay() {
  if (hasError) return;                 // keep the error message visible
  resultEl.style.fontSize = "";         // back to the normal size from CSS
  resultEl.textContent = currentInput === "" ? "0" : prettify(currentInput);
}

function showError(message, spokenMessage) {
  hasError = true;
  currentInput = "";
  justCalculated = false;
  resultEl.style.fontSize = "1.4rem";   // smaller text so the message fits
  resultEl.textContent = message;
  // Wait a moment so the voice can finish saying "Equals" first
  errorTimer = setTimeout(function () {
    speak(spokenMessage);
  }, 800);
}

// Start a fresh calculation if the last one just finished
function startFreshIfNeeded() {
  if (justCalculated) {
    currentInput = "";
    expressionEl.textContent = "";
    justCalculated = false;
  }
}

// ---------- Controls ----------

function clearAll() {
  currentInput = "";
  justCalculated = false;
  hasError = false;
  expressionEl.textContent = "";
}

function deleteLast() {
  if (justCalculated) {            // nothing to edit after an answer
    clearAll();
    return;
  }
  currentInput = currentInput.slice(0, -1);   // remove the last character
}

// ---------- Entering numbers and operators ----------

function appendNumber(digit) {
  startFreshIfNeeded();
  if (currentInput.length >= MAX_LENGTH) return;
  if (currentInput.endsWith("%")) return;     // "5%3" is not valid

  // Avoid numbers like 007: replace a lone 0 with the new digit
  const lastNumber = currentInput.match(/[\d.]*$/)[0];
  if (lastNumber === "0") {
    currentInput = currentInput.slice(0, -1);
  }
  currentInput += digit;
}

function appendDecimal() {
  startFreshIfNeeded();
  if (currentInput.length >= MAX_LENGTH) return;
  if (currentInput.endsWith("%")) return;

  const lastNumber = currentInput.match(/[\d.]*$/)[0];
  if (lastNumber.includes(".")) return;       // only one dot per number
  if (lastNumber === "") currentInput += "0"; // "." becomes "0."
  currentInput += ".";
}

function appendOperator(op) {
  justCalculated = false;           // keep the answer and continue with it
  expressionEl.textContent = "";

  if (currentInput === "") {        // at the start, only a minus is allowed
    if (op === "-") currentInput = "-";
    return;
  }
  if (currentInput === "-") return; // a lone minus can't take an operator

  if (currentInput.endsWith(".")) { // "5." + operator becomes "5+"
    currentInput = currentInput.slice(0, -1);
  }

  const last = currentInput.slice(-1);
  if (isOperator(last)) {           // two operators in a row: replace the old one
    currentInput = currentInput.slice(0, -1) + op;
    return;
  }
  if (currentInput.length >= MAX_LENGTH) return;
  currentInput += op;
}

function appendPercent() {
  justCalculated = false;
  expressionEl.textContent = "";

  if (currentInput === "") return;
  if (!/\d/.test(currentInput.slice(-1))) return;  // only allowed after a digit
  if (currentInput.length >= MAX_LENGTH) return;
  currentInput += "%";
}

// ---------- Equals ----------

function calculate() {
  if (currentInput === "" || justCalculated) return;

  // Remove a trailing operator or dot, e.g. "5+" becomes "5"
  let expr = currentInput;
  while (expr.length > 0 && (expr.endsWith(".") || isOperator(expr.slice(-1)))) {
    expr = expr.slice(0, -1);
  }
  if (expr === "") return;

  // Percent means "divide by 100"
  const mathExpr = expr.replace(/%/g, "/100");

  let answer;
  try {
    // Safe here because our buttons only allow digits and + - * / . %
    answer = Function('"use strict"; return (' + mathExpr + ")")();
  } catch (error) {
    showError("Invalid calculation", "Invalid calculation");
    return;
  }

  expressionEl.textContent = prettify(expr) + " =";

  // Dividing by zero gives Infinity (or NaN for 0 ÷ 0)
  if (!isFinite(answer)) {
    showError("Can't divide by zero", "Oops, you can't divide by zero");
    return;
  }

  // Fix tiny rounding errors like 0.1 + 0.2 = 0.30000000000000004
  answer = parseFloat(answer.toFixed(10));

  // Very big or very small numbers turn into "1e+21", which we can't type with
  if (String(answer).includes("e")) {
    showError("Number out of range", "That number is out of range");
    return;
  }

  currentInput = String(answer);
  justCalculated = true;
}

// ---------- One click listener for the whole keypad ----------

keypadEl.addEventListener("click", function (event) {
  const button = event.target.closest(".btn");
  if (!button) return;

  clearTimeout(errorTimer);         // cancel a pending error announcement
  if (hasError) clearAll();         // any key dismisses the error

  const value = button.dataset.value;
  const action = button.dataset.action;

  if (action === "clear") {
    clearAll();
  } else if (action === "delete") {
    deleteLast();
  } else if (action === "equals") {
    calculate();
  } else if (value === ".") {
    appendDecimal();
  } else if (value === "%") {
    appendPercent();
  } else if (isOperator(value)) {
    appendOperator(value);
  } else {
    appendNumber(value);
  }

  updateDisplay();
});
