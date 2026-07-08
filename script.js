(function () {
  'use strict';

  const TOKEN_TYPES = {
    NUMBER: 'number',
    OPERATOR: 'operator',
    CONSTANT: 'constant',
    OPEN_PAREN: 'open',
    CLOSE_PAREN: 'close',
    FUNCTION: 'function',
    POSTFIX: 'postfix',
  };

  const ANGLE_MODES = { DEG: 'deg', RAD: 'rad' };

  let expressionTokens = [];
  let isShiftActive = false;
  let angleMode = ANGLE_MODES.DEG;
  let hasJustEvaluated = false;

  const padElement = document.getElementById('pad');
  const expressionLineElement = document.getElementById('exprLine');
  const resultLineElement = document.getElementById('resultLine');
  const shiftKeyElement = document.getElementById('shiftKey');
  const angleModeButton = document.getElementById('angleMode');
  const historyToggleButton = document.getElementById('historyToggle');
  const historyPanelElement = document.getElementById('historyPanel');
  const historyListElement = document.getElementById('historyList');
  const historyEmptyElement = document.getElementById('historyEmpty');
  const historyClearButton = document.getElementById('historyClear');
  const HISTORY_STORAGE_KEY = 'sci100_history';
  const HISTORY_MAX_ENTRIES = 50;
  let historyEntries = loadHistory();

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (error) {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyEntries));
    } catch (error) {
    }
  }

  function addHistoryEntry(expressionText, formattedResult) {
    historyEntries.push({ expression: expressionText, result: formattedResult });
    if (historyEntries.length > HISTORY_MAX_ENTRIES) {
      historyEntries = historyEntries.slice(historyEntries.length - HISTORY_MAX_ENTRIES);
    }
    saveHistory();
    renderHistory();
  }

  function clearHistory() {
    historyEntries = [];
    saveHistory();
    renderHistory();
  }

  function renderHistory() {
    historyListElement.querySelectorAll('.history-item').forEach((el) => el.remove());
    historyEmptyElement.style.display = historyEntries.length ? 'none' : '';

    for (let i = historyEntries.length - 1; i >= 0; i--) {
      const entry = historyEntries[i];
      const item = document.createElement('li');
      item.className = 'history-item';
      item.innerHTML = `
        <div class="history-expr">${entry.expression} =</div>
        <div class="history-result">${entry.result}</div>
      `;
      item.addEventListener('click', () => reuseHistoryEntry(entry));
      historyListElement.appendChild(item);
    }
  }

  function reuseHistoryEntry(entry) {
    expressionTokens = [{ type: TOKEN_TYPES.NUMBER, text: entry.result }];
    hasJustEvaluated = true;
    renderCurrentExpression();
    closeHistoryPanel();
  }

  function toggleHistoryPanel() {
    const isOpen = historyPanelElement.classList.toggle('open');
    historyToggleButton.classList.toggle('active', isOpen);
  }

  function closeHistoryPanel() {
    historyPanelElement.classList.remove('open');
    historyToggleButton.classList.remove('active');
  }

  historyToggleButton.addEventListener('click', toggleHistoryPanel);
  historyClearButton.addEventListener('click', clearHistory);

  function getLastToken() {
    return expressionTokens[expressionTokens.length - 1];
  }

  function resetIfJustEvaluated() {
    if (hasJustEvaluated) {
      expressionTokens = [];
      hasJustEvaluated = false;
    }
  }

  function addDigit(digit) {
    resetIfJustEvaluated();
    const lastToken = getLastToken();
    if (lastToken && lastToken.type === TOKEN_TYPES.NUMBER) {
      lastToken.text += digit;
    } else {
      expressionTokens.push({ type: TOKEN_TYPES.NUMBER, text: digit });
    }
  }

  function addDecimalPoint() {
    resetIfJustEvaluated();
    const lastToken = getLastToken();
    if (lastToken && lastToken.type === TOKEN_TYPES.NUMBER) {
      if (!lastToken.text.includes('.')) {
        lastToken.text += '.';
      }
    } else {
      expressionTokens.push({ type: TOKEN_TYPES.NUMBER, text: '0.' });
    }
  }

  function addToken(type, text) {
    if (hasJustEvaluated) {
      hasJustEvaluated = false;
      if (type !== TOKEN_TYPES.OPERATOR) {
        expressionTokens = [];
      }
    }
    if (type === TOKEN_TYPES.OPERATOR) {
      const lastToken = getLastToken();
      if (lastToken && lastToken.type === TOKEN_TYPES.OPERATOR) {
        lastToken.text = text;
        return;
      }
      if (!lastToken && text !== '−') {
        return;
      }
    }
    expressionTokens.push({ type, text });
  }

  function removeLastCharacterOrToken() {
    const lastToken = getLastToken();
    if (!lastToken) return;

    const isMultiDigitNumber = lastToken.type === TOKEN_TYPES.NUMBER && lastToken.text.length > 1;
    if (isMultiDigitNumber) {
      lastToken.text = lastToken.text.slice(0, -1);
    } else {
      expressionTokens.pop();
    }
    hasJustEvaluated = false;
  }

  function clearExpression() {
    expressionTokens = [];
    hasJustEvaluated = false;
  }

  function degreesToRadians(value) {
    return angleMode === ANGLE_MODES.DEG ? (value * Math.PI) / 180 : value;
  }

  function radiansToDegrees(value) {
    return angleMode === ANGLE_MODES.DEG ? (value * 180) / Math.PI : value;
  }

  const MATH_FUNCTIONS = {
    sin: (a) => Math.sin(degreesToRadians(a)),
    cos: (a) => Math.cos(degreesToRadians(a)),
    tan: (a) => Math.tan(degreesToRadians(a)),
    asin: (a) => radiansToDegrees(Math.asin(a)),
    acos: (a) => radiansToDegrees(Math.acos(a)),
    atan: (a) => radiansToDegrees(Math.atan(a)),
    ln: (a) => Math.log(a),
    log: (a) => Math.log10(a),
    exp: (a) => Math.exp(a),
    pow10: (a) => Math.pow(10, a),
    sqrt: (a) => Math.sqrt(a),
  };

  function factorial(n) {
    if (n < 0 || !Number.isInteger(n)) return NaN;
    let result = 1;
    for (let i = 2; i <= n; i++) result *= i;
    return result;
  }

  function evaluateExpression(tokens) {
    let position = 0;

    function peek() {
      return tokens[position];
    }

    function advance() {
      return tokens[position++];
    }

    function isOperator(token, symbol) {
      return !!token && token.type === TOKEN_TYPES.OPERATOR && token.text === symbol;
    }

    function canStartFactor(token) {
      if (!token) return false;
      return (
        token.type === TOKEN_TYPES.NUMBER ||
        token.type === TOKEN_TYPES.CONSTANT ||
        token.type === TOKEN_TYPES.FUNCTION ||
        token.type === TOKEN_TYPES.OPEN_PAREN
      );
    }

    function expectToken(type, errorMessage) {
      if (!peek() || peek().type !== type) throw new Error(errorMessage);
      advance();
    }

    function parseExpression() {
      let value = parseTerm();
      while (isOperator(peek(), '+') || isOperator(peek(), '−')) {
        const operator = advance().text;
        const rightSide = parseTerm();
        value = operator === '+' ? value + rightSide : value - rightSide;
      }
      return value;
    }

    function parseTerm() {
      let value = parseFactor();
      while (
        isOperator(peek(), '×') ||
        isOperator(peek(), '÷') ||
        isOperator(peek(), 'mod') ||
        canStartFactor(peek())
      ) {
        const operator = peek().type === TOKEN_TYPES.OPERATOR ? advance().text : '×';
        const rightSide = parseFactor();
        if (operator === '×') value *= rightSide;
        else if (operator === '÷') value /= rightSide;
        else value %= rightSide;
      }
      return value;
    }

    function parseFactor() {
      const value = parseUnary();
      if (isOperator(peek(), '^')) {
        advance();
        const exponent = parseFactor();
        return Math.pow(value, exponent);
      }
      return value;
    }

    function parseUnary() {
      if (isOperator(peek(), '−')) {
        advance();
        return -parseUnary();
      }
      return parsePostfix();
    }

    function parsePostfix() {
      let value = parsePrimary();
      while (peek() && peek().type === TOKEN_TYPES.POSTFIX) {
        advance();
        value = factorial(value);
      }
      return value;
    }

    function parsePrimary() {
      const token = peek();
      if (!token) throw new Error('Expresión incompleta');

      switch (token.type) {
        case TOKEN_TYPES.NUMBER:
          advance();
          return parseFloat(token.text);

        case TOKEN_TYPES.CONSTANT:
          advance();
          return token.text === 'π' ? Math.PI : Math.E;

        case TOKEN_TYPES.OPEN_PAREN: {
          advance();
          const value = parseExpression();
          expectToken(TOKEN_TYPES.CLOSE_PAREN, 'Falta un paréntesis de cierre ")"');
          return value;
        }

        case TOKEN_TYPES.FUNCTION: {
          advance();
          expectToken(TOKEN_TYPES.OPEN_PAREN, 'Falta un paréntesis de apertura "(" después de la función');
          const argument = parseExpression();
          expectToken(TOKEN_TYPES.CLOSE_PAREN, 'Falta un paréntesis de cierre ")"');
          return MATH_FUNCTIONS[token.text](argument);
        }

        default:
          throw new Error(`Token inesperado: "${token.text}"`);
      }
    }

    const result = parseExpression();
    if (position !== tokens.length) throw new Error('Sobran símbolos al final de la expresión');
    return result;
  }

  function formatNumber(value) {
    if (typeof value !== 'number' || !isFinite(value) || isNaN(value)) return 'Error';
    if (Object.is(value, -0)) value = 0;

    const absValue = Math.abs(value);
    const isTooSmallOrTooBig = absValue > 0 && (absValue < 1e-9 || absValue >= 1e15);
    if (isTooSmallOrTooBig) {
      return value.toExponential(6).replace(/e\+?/, 'e');
    }

    return parseFloat(value.toPrecision(12)).toString();
  }

  function renderCurrentExpression() {
    const text = expressionTokens.map((t) => t.text).join('') || '0';
    resultLineElement.textContent = text;
    resultLineElement.classList.toggle('long', text.length > 9);
    expressionLineElement.textContent = '\u00A0';
  }

  function showResult(expressionText, formattedResult) {
    expressionLineElement.textContent = `${expressionText} =`;
    resultLineElement.textContent = formattedResult;
    resultLineElement.classList.toggle('long', formattedResult.length > 9);
  }

  function showError(expressionText) {
    expressionLineElement.textContent = expressionText;
    resultLineElement.textContent = 'Error';
    resultLineElement.classList.remove('long');
    expressionTokens = [];
    hasJustEvaluated = false;
  }

  function evaluateAndShowResult() {
    if (!expressionTokens.length) return;

    const expressionText = expressionTokens.map((t) => t.text).join('');

    try {
      const value = evaluateExpression(expressionTokens);
      const formatted = formatNumber(value);

      if (formatted === 'Error') {
        showError(expressionText);
        return;
      }

      showResult(expressionText, formatted);
      addHistoryEntry(expressionText, formatted);
      expressionTokens = [{ type: TOKEN_TYPES.NUMBER, text: formatted }];
      hasJustEvaluated = true;
    } catch (error) {
      showError(expressionText);
    }
  }

  function applySquare() {
    addToken(TOKEN_TYPES.OPERATOR, '^');
    addDigit('2');
  }

  function applySquareRoot() {
    resetIfJustEvaluated();
    expressionTokens.push({ type: TOKEN_TYPES.FUNCTION, text: 'sqrt' });
    expressionTokens.push({ type: TOKEN_TYPES.OPEN_PAREN, text: '(' });
  }

  function applyReciprocal() {
    const lastToken = getLastToken();
    if (lastToken && lastToken.type === TOKEN_TYPES.NUMBER) {
      expressionTokens.pop();
      expressionTokens.push({ type: TOKEN_TYPES.NUMBER, text: '1' });
      expressionTokens.push({ type: TOKEN_TYPES.OPERATOR, text: '÷' });
      expressionTokens.push({ type: TOKEN_TYPES.NUMBER, text: lastToken.text });
    }
    hasJustEvaluated = false;
  }

  function applySignToggle() {
    const lastToken = getLastToken();
    if (lastToken && lastToken.type === TOKEN_TYPES.NUMBER) {
      lastToken.text = lastToken.text.startsWith('-') ? lastToken.text.slice(1) : `-${lastToken.text}`;
    } else {
      expressionTokens.push({ type: TOKEN_TYPES.NUMBER, text: '-' });
    }
    hasJustEvaluated = false;
  }

  function applyFunction(button) {
    resetIfJustEvaluated();
    const functionName = isShiftActive ? button.dataset.alt : button.dataset.value;
    expressionTokens.push({ type: TOKEN_TYPES.FUNCTION, text: functionName });
    expressionTokens.push({ type: TOKEN_TYPES.OPEN_PAREN, text: '(' });
  }

  function toggleShift() {
    isShiftActive = !isShiftActive;
    shiftKeyElement.classList.toggle('active', isShiftActive);
    padElement.classList.toggle('shifted', isShiftActive);
  }

  function toggleAngleMode() {
    angleMode = angleMode === ANGLE_MODES.DEG ? ANGLE_MODES.RAD : ANGLE_MODES.DEG;
    angleModeButton.textContent = angleMode.toUpperCase();
  }

  const BUTTON_ACTIONS = {
    digit: (button) => addDigit(button.dataset.value),
    dot: () => addDecimalPoint(),
    op: (button) => addToken(TOKEN_TYPES.OPERATOR, button.dataset.value),
    const: (button) => addToken(TOKEN_TYPES.CONSTANT, button.dataset.value),
    'paren-open': () => addToken(TOKEN_TYPES.OPEN_PAREN, '('),
    'paren-close': () => addToken(TOKEN_TYPES.CLOSE_PAREN, ')'),
    factorial: () => addToken(TOKEN_TYPES.POSTFIX, '!'),
    power: () => addToken(TOKEN_TYPES.OPERATOR, '^'),
    mod: () => addToken(TOKEN_TYPES.OPERATOR, 'mod'),
    square: () => applySquare(),
    sqrt: () => applySquareRoot(),
    reciprocal: () => applyReciprocal(),
    sign: () => applySignToggle(),
    func: (button) => applyFunction(button),
    backspace: () => removeLastCharacterOrToken(),
    clear: () => clearExpression(),
    shift: () => toggleShift(),
  };

  padElement.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    const action = button.dataset.action;

    try {
      if (action === 'equals') {
        evaluateAndShowResult();
        return;
      }

      const handler = BUTTON_ACTIONS[action];
      if (handler) {
        handler(button);
      }

      renderCurrentExpression();
    } catch (error) {
      console.error('Error al procesar el botón:', error);
      showError(expressionTokens.map((t) => t.text).join(''));
      renderCurrentExpression();
    }
  });

  angleModeButton.addEventListener('click', toggleAngleMode);

  const KEYBOARD_SHORTCUTS = {
    '.': () => addDecimalPoint(),
    '+': () => addToken(TOKEN_TYPES.OPERATOR, '+'),
    '-': () => addToken(TOKEN_TYPES.OPERATOR, '−'),
    '*': () => addToken(TOKEN_TYPES.OPERATOR, '×'),
    '^': () => addToken(TOKEN_TYPES.OPERATOR, '^'),
    '(': () => addToken(TOKEN_TYPES.OPEN_PAREN, '('),
    ')': () => addToken(TOKEN_TYPES.CLOSE_PAREN, ')'),
    Backspace: () => removeLastCharacterOrToken(),
    Escape: () => clearExpression(),
  };

  window.addEventListener('keydown', (event) => {
    try {
      const isDigit = event.key >= '0' && event.key <= '9';

      if (isDigit) {
        addDigit(event.key);
        renderCurrentExpression();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        addToken(TOKEN_TYPES.OPERATOR, '÷');
        renderCurrentExpression();
        return;
      }

      if (event.key === 'Enter' || event.key === '=') {
        event.preventDefault();
        evaluateAndShowResult();
        return;
      }

      const shortcut = KEYBOARD_SHORTCUTS[event.key];
      if (shortcut) {
        shortcut();
        renderCurrentExpression();
      }
    } catch (error) {
      console.error('Error al procesar la tecla:', error);
    }
  });

  renderCurrentExpression();
  renderHistory();
})();