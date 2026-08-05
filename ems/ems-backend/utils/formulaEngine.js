/**
 * Safe arithmetic formula evaluator for ingest-time transforms.
 * Supports: numbers, + - * /, parentheses, optional leading '='.
 * Control formulas (DIRECT vars) use `s` as the raw reading, e.g. =s/100.
 * Equation formulas may contain SlaveName$$VariableName tokens (replaced before eval).
 * No eval() / Function() — recursive-descent parser only.
 */

const MAX_EXPR_LEN = 500

const tokenize = (input) => {
  const src = String(input || '').trim().replace(/^=/, '').replace(/\s+/g, '')
  if (!src) throw new Error('Empty formula')
  if (src.length > MAX_EXPR_LEN) throw new Error('Formula too long')

  const tokens = []
  let i = 0
  while (i < src.length) {
    const ch = src[i]
    if (/[+\-*/()]/.test(ch)) {
      tokens.push({ type: ch })
      i += 1
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let j = i + 1
      while (j < src.length && /[0-9.]/.test(src[j])) j += 1
      const num = Number(src.slice(i, j))
      if (Number.isNaN(num)) throw new Error(`Invalid number near "${src.slice(i, j)}"`)
      tokens.push({ type: 'num', value: num })
      i = j
      continue
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j += 1
      const name = src.slice(i, j)
      if (name !== 's') throw new Error(`Unknown identifier "${name}"`)
      tokens.push({ type: 'ident', value: 's' })
      i = j
      continue
    }
    throw new Error(`Unexpected character "${ch}"`)
  }
  return tokens
}

const parseExpr = (tokens) => {
  let pos = 0
  const peek = () => tokens[pos]
  const consume = (type) => {
    const t = peek()
    if (!t || (type && t.type !== type)) throw new Error('Unexpected end of formula')
    pos += 1
    return t
  }

  const parsePrimary = () => {
    const t = peek()
    if (!t) throw new Error('Unexpected end of formula')
    if (t.type === 'num') {
      consume()
      return t.value
    }
    if (t.type === 'ident') {
      consume()
      return { __ident: t.value }
    }
    if (t.type === '(') {
      consume('(')
      const v = parseAdd()
      consume(')')
      return v
    }
    if (t.type === '+' || t.type === '-') {
      const op = consume().type
      const v = parsePrimary()
      return op === '-' ? { __unary: '-', arg: v } : v
    }
    throw new Error(`Unexpected token "${t.type}"`)
  }

  const parseMul = () => {
    let left = parsePrimary()
    while (peek() && (peek().type === '*' || peek().type === '/')) {
      const op = consume().type
      const right = parsePrimary()
      left = { __bin: op, left, right }
    }
    return left
  }

  const parseAdd = () => {
    let left = parseMul()
    while (peek() && (peek().type === '+' || peek().type === '-')) {
      const op = consume().type
      const right = parseMul()
      left = { __bin: op, left, right }
    }
    return left
  }

  const tree = parseAdd()
  if (pos !== tokens.length) throw new Error('Trailing tokens in formula')
  return tree
}

const evalTree = (node, env) => {
  if (typeof node === 'number') return node
  if (node && node.__ident) {
    if (!(node.__ident in env) || env[node.__ident] == null) throw new Error(`Missing value for ${node.__ident}`)
    const n = Number(env[node.__ident])
    if (Number.isNaN(n)) throw new Error(`Non-numeric value for ${node.__ident}`)
    return n
  }
  if (node && node.__unary === '-') return -evalTree(node.arg, env)
  if (node && node.__bin) {
    const a = evalTree(node.left, env)
    const b = evalTree(node.right, env)
    switch (node.__bin) {
      case '+': return a + b
      case '-': return a - b
      case '*': return a * b
      case '/': return b === 0 ? NaN : a / b
      default: throw new Error(`Unknown operator ${node.__bin}`)
    }
  }
  throw new Error('Invalid formula AST')
}

/** Evaluate a numeric expression. `env.s` is the raw acquisition value when present. */
const evaluate = (formula, env = {}) => {
  if (formula == null || String(formula).trim() === '') {
    return env.s != null ? Number(env.s) : NaN
  }
  const tokens = tokenize(formula)
  const tree = parseExpr(tokens)
  return evalTree(tree, env)
}

/**
 * Apply a control/acquisition formula (`s` = raw) to a reading.
 * Empty formula → returns raw as number (or NaN).
 */
const applyAcquisitionFormula = (formula, rawValue) => {
  const raw = Number(rawValue)
  if (formula == null || String(formula).trim() === '') {
    return Number.isNaN(raw) ? rawValue : raw
  }
  try {
    const result = evaluate(formula, { s: raw })
    return Number.isFinite(result) ? result : raw
  } catch (_) {
    return Number.isNaN(raw) ? rawValue : raw
  }
}

const SLAVE_VAR_RE = /([A-Za-z0-9_]+)\$\$([A-Za-z0-9_]+)/g

/**
 * Evaluate an equation controlFormula.
 * `lookup(slaveName, variableName)` must return a number (or null).
 */
const applyEquationFormula = (formula, lookup) => {
  if (formula == null || String(formula).trim() === '') return null
  let expr = String(formula).trim().replace(/^=/, '')
  let missing = false
  expr = expr.replace(SLAVE_VAR_RE, (_, slave, variable) => {
    const v = lookup(slave, variable)
    if (v == null || Number.isNaN(Number(v))) {
      missing = true
      return '0'
    }
    return String(Number(v))
  })
  if (missing) return null
  try {
    const result = evaluate(expr, {})
    return Number.isFinite(result) ? result : null
  } catch (_) {
    return null
  }
}

module.exports = {
  evaluate,
  applyAcquisitionFormula,
  applyEquationFormula,
}
