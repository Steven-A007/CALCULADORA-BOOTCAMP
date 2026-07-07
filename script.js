(function(){
  let tokens = [];
  let shiftOn = false;
  let angleMode = 'deg';
  let justEvaluated = false;

  const pad = document.getElementById('pad');
  const exprLine = document.getElementById('exprLine');
  const resultLine = document.getElementById('resultLine');
  const shiftKey = document.getElementById('shiftKey');
  const angleBtn = document.getElementById('angleMode');

  function last(){ return tokens[tokens.length-1]; }

  function pushNumber(d){
    const l = last();
    if (justEvaluated){ tokens = []; justEvaluated = false; }
    if (l && l.type === 'number'){ l.text += d; }
    else tokens.push({type:'number', text:d});
  }

  function pushDot(){
    const l = last();
    if (justEvaluated){ tokens = []; justEvaluated = false; }
    if (l && l.type === 'number'){
      if (!l.text.includes('.')) l.text += '.';
    } else {
      tokens.push({type:'number', text:'0.'});
    }
  }

  function pushToken(type, text){
    if (justEvaluated){
      justEvaluated = false;
      if (type === 'operator'){}
      else tokens = [];
    }
    tokens.push({type, text});
  }

  function backspace(){
    const l = last();
    if (!l) return;
    if (l.type === 'number' && l.text.length > 1){
      l.text = l.text.slice(0, -1);
    } else {
      tokens.pop();
    }
    justEvaluated = false;
  }

  function clearAll(){
    tokens = [];
    justEvaluated = false;
  }

  function toRad(x){ return angleMode === 'deg' ? x * Math.PI / 180 : x; }
  function fromRad(x){ return angleMode === 'deg' ? x * 180 / Math.PI : x; }

  const FUNCS = {
    sin:  a => Math.sin(toRad(a)),
    cos:  a => Math.cos(toRad(a)),
    tan:  a => Math.tan(toRad(a)),
    asin: a => fromRad(Math.asin(a)),
    acos: a => fromRad(Math.acos(a)),
    atan: a => fromRad(Math.atan(a)),
    ln:   a => Math.log(a),
    log:  a => Math.log10(a),
    exp:  a => Math.exp(a),
    pow10:a => Math.pow(10, a),
    sqrt: a => Math.sqrt(a)
  };

  function factorial(n){
    if (n < 0 || !Number.isInteger(n)) return NaN;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  function evaluate(toks){
    let pos = 0;
    function peek(){ return toks[pos]; }
    function advance(){ return toks[pos++]; }

    function parseExpression(){
      let v = parseTerm();
      while (peek() && peek().type === 'operator' && (peek().text === '+' || peek().text === '−')){
        const op = advance().text;
        const rhs = parseTerm();
        v = op === '+' ? v + rhs : v - rhs;
      }
      return v;
    }

    function startsFactor(t){
      return t && (t.type === 'number' || t.type === 'constant' || t.type === 'function' || t.type === 'open');
    }

    function parseTerm(){
      let v = parseFactor();
      while (peek() && (
        (peek().type === 'operator' && (peek().text === '×' || peek().text === '÷' || peek().text === 'mod')) ||
        startsFactor(peek())
      )){
        let op = '×';
        if (peek().type === 'operator'){ op = advance().text; }
        const rhs = parseFactor();
        if (op === '×') v = v * rhs;
        else if (op === '÷') v = v / rhs;
        else v = v % rhs;
      }
      return v;
    }

    function parseFactor(){
      let v = parseUnary();
      if (peek() && peek().type === 'operator' && peek().text === '^'){
        advance();
        const rhs = parseFactor();
        v = Math.pow(v, rhs);
      }
      return v;
    }

    function parseUnary(){
      if (peek() && peek().type === 'operator' && peek().text === '−'){
        advance();
        return -parseUnary();
      }
      return parsePostfix();
    }

    function parsePostfix(){
      let v = parsePrimary();
      while (peek() && peek().type === 'postfix'){
        advance();
        v = factorial(v);
      }
      return v;
    }

    function parsePrimary(){
      const t = peek();
      if (!t) throw new Error('unexpected end');
      if (t.type === 'number'){
        advance();
        return parseFloat(t.text);
      }
      if (t.type === 'constant'){
        advance();
        return t.text === 'π' ? Math.PI : Math.E;
      }
      if (t.type === 'open'){
        advance();
        const v = parseExpression();
        if (!peek() || peek().type !== 'close') throw new Error('missing )');
        advance();
        return v;
      }
      if (t.type === 'function'){
        advance();
        if (!peek() || peek().type !== 'open') throw new Error('missing (');
        advance();
        const v = parseExpression();
        if (!peek() || peek().type !== 'close') throw new Error('missing )');
        advance();
        return FUNCS[t.text](v);
      }
      throw new Error('unexpected token');
    }

    const result = parseExpression();
    if (pos !== toks.length) throw new Error('trailing tokens');
    return result;
  }

  function formatNumber(x){
    if (typeof x !== 'number' || !isFinite(x) || isNaN(x)) return 'Error';
    if (Object.is(x, -0)) x = 0;
    if (Math.abs(x) > 0 && (Math.abs(x) < 1e-9 || Math.abs(x) >= 1e15)){
      return x.toExponential(6).replace(/e\+?/, 'e');
    }
    let s = parseFloat(x.toPrecision(12)).toString();
    return s;
  }


  function render(){
    const text = tokens.map(t => t.text).join('') || '0';
    resultLine.textContent = text;
    resultLine.classList.toggle('long', text.length > 9);
    exprLine.textContent = '\u00A0';
  }

  function doEquals(){
    if (!tokens.length) return;
    const exprText = tokens.map(t => t.text).join('');
    try {
      const v = evaluate(tokens);
      const formatted = formatNumber(v);
      if (formatted === 'Error'){
        exprLine.textContent = exprText;
        resultLine.textContent = 'Error';
        resultLine.classList.remove('long');
        tokens = [];
        justEvaluated = false;
        return;
      }
      exprLine.textContent = exprText + ' =';
      resultLine.textContent = formatted;
      resultLine.classList.toggle('long', formatted.length > 9);
      tokens = [{type:'number', text: formatted}];
      justEvaluated = true;
    } catch(e){
      exprLine.textContent = exprText;
      resultLine.textContent = 'Error';
      resultLine.classList.remove('long');
      tokens = [];
      justEvaluated = false;
    }
  }

  function toggleShift(){
    shiftOn = !shiftOn;
    shiftKey.classList.toggle('active', shiftOn);
    pad.classList.toggle('shifted', shiftOn);
  }

  function toggleAngleMode(){
    angleMode = angleMode === 'deg' ? 'rad' : 'deg';
    angleBtn.textContent = angleMode.toUpperCase();
  }

  pad.addEventListener('click', (e) => {
    const btn = e.target.closest('button.key');
    if (!btn) return;
    const action = btn.dataset.action;

    switch(action){
      case 'digit': pushNumber(btn.dataset.value); break;
      case 'dot': pushDot(); break;
      case 'op': pushToken('operator', btn.dataset.value); break;
      case 'const': pushToken('constant', btn.dataset.value); break;
      case 'paren-open': pushToken('open', '('); break;
      case 'paren-close': pushToken('close', ')'); break;
      case 'factorial': pushToken('postfix', '!'); break;
      case 'power': pushToken('operator', '^'); break;
      case 'mod': pushToken('operator', 'mod'); break;
      case 'square':
        pushToken('operator', '^');
        pushNumber('2');
        break;
      case 'sqrt':
        if (justEvaluated){ tokens = []; justEvaluated = false; }
        tokens.push({type:'function', text:'sqrt'});
        tokens.push({type:'open', text:'('});
        break;
      case 'reciprocal': {
        const l = last();
        if (l && l.type === 'number'){
          tokens.pop();
          tokens.push({type:'number', text:'1'});
          tokens.push({type:'operator', text:'÷'});
          tokens.push({type:'number', text:l.text});
        }
        justEvaluated = false;
        break;
      }
      case 'sign': {
        const l = last();
        if (l && l.type === 'number'){
          l.text = l.text.startsWith('-') ? l.text.slice(1) : '-' + l.text;
        } else {
          tokens.push({type:'number', text:'-'});
        }
        justEvaluated = false;
        break;
      }
      case 'func': {
        if (justEvaluated){ tokens = []; justEvaluated = false; }
        const fname = shiftOn ? btn.dataset.alt : btn.dataset.value;
        tokens.push({type:'function', text: fname});
        tokens.push({type:'open', text:'('});
        break;
      }
      case 'backspace': backspace(); break;
      case 'clear': clearAll(); break;
      case 'shift': toggleShift(); break;
      case 'equals': doEquals(); return;
    }
    render();
  });

  angleBtn.addEventListener('click', toggleAngleMode);

  window.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9'){ pushNumber(e.key); render(); }
    else if (e.key === '.'){ pushDot(); render(); }
    else if (e.key === '+'){ pushToken('operator','+'); render(); }
    else if (e.key === '-'){ pushToken('operator','−'); render(); }
    else if (e.key === '*'){ pushToken('operator','×'); render(); }
    else if (e.key === '/'){ e.preventDefault(); pushToken('operator','÷'); render(); }
    else if (e.key === '^'){ pushToken('operator','^'); render(); }
    else if (e.key === '('){ pushToken('open','('); render(); }
    else if (e.key === ')'){ pushToken('close',')'); render(); }
    else if (e.key === 'Enter' || e.key === '='){ e.preventDefault(); doEquals(); }
    else if (e.key === 'Backspace'){ backspace(); render(); }
    else if (e.key === 'Escape'){ clearAll(); render(); }
  });

  render();
})();
