// ─── Sheet Studio — Formula Engine ──────────────────────────────────────────
// A small, dependency-free spreadsheet formula engine: tokenizer → recursive-
// descent parser → AST evaluator. Supports cell references (A1), ranges
// (A1:B10), arithmetic (+ - * / ^ %), comparisons (= <> < > <= >=), string
// concatenation (&), and a practical set of built-in functions.
//
// This module is pure (no DOM/React) and safe to unit-test with plain Node.

export type CellValue = string | number | boolean | null;
export type FormulaError =
  | "#DIV/0!"
  | "#REF!"
  | "#VALUE!"
  | "#NAME?"
  | "#CIRCULAR!"
  | "#N/A"
  | "#NUM!"
  | "#ERROR!";
export interface CellErrorValue {
  error: FormulaError;
}
export type EvalResult = CellValue | CellErrorValue;

export function isErrorValue(v: unknown): v is CellErrorValue {
  return typeof v === "object" && v !== null && "error" in v;
}

// ─── Address helpers ─────────────────────────────────────────────────────
// Columns are 0-based internally (0 = A, 25 = Z, 26 = AA, ...); rows are
// 0-based internally but 1-based in formula/display text (row 0 = "1").

export function colIndexToLabel(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function colLabelToIndex(label: string): number {
  let n = 0;
  for (let i = 0; i < label.length; i++) {
    n = n * 26 + (label.charCodeAt(i) - 64);
  }
  return n - 1;
}

export interface CellAddr {
  col: number;
  row: number;
}

const CELL_REF_RE = /^\$?([A-Za-z]{1,3})\$?(\d+)$/;

export function parseCellAddr(text: string): CellAddr | null {
  const m = CELL_REF_RE.exec(text);
  if (!m) return null;
  return { col: colLabelToIndex(m[1].toUpperCase()), row: parseInt(m[2], 10) - 1 };
}

export function addrToLabel(addr: CellAddr): string {
  return `${colIndexToLabel(addr.col)}${addr.row + 1}`;
}

// ─── Tokenizer ───────────────────────────────────────────────────────────

type TokenType =
  | "number"
  | "string"
  | "ref"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "colon"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === " " || c === "\t") {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "lparen", value: c });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", value: c });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ type: "comma", value: c });
      i++;
      continue;
    }
    if (c === ":") {
      tokens.push({ type: "colon", value: c });
      i++;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let out = "";
      while (j < n && src[j] !== '"') {
        if (src[j] === "\\" && j + 1 < n) {
          out += src[j + 1];
          j += 2;
        } else {
          out += src[j];
          j++;
        }
      }
      tokens.push({ type: "string", value: out });
      i = j + 1;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] || ""))) {
      let j = i;
      while (j < n && /[0-9.]/.test(src[j])) j++;
      // scientific notation, e.g. 1.5e10
      if (src[j] === "e" || src[j] === "E") {
        let k = j + 1;
        if (src[k] === "+" || src[k] === "-") k++;
        if (/[0-9]/.test(src[k] || "")) {
          k++;
          while (/[0-9]/.test(src[k] || "")) k++;
          j = k;
        }
      }
      tokens.push({ type: "number", value: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < n && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      tokens.push({ type: /^\$?[A-Za-z]{1,3}\$?[0-9]+$/.test(word) ? "ref" : "ident", value: word });
      i = j;
      continue;
    }
    if (c === "<" || c === ">" || c === "=") {
      let op = c;
      if ((c === "<" && src[i + 1] === ">") || (c === "<" && src[i + 1] === "=") || (c === ">" && src[i + 1] === "=")) {
        op = c + src[i + 1];
        i += 2;
      } else {
        i += 1;
      }
      tokens.push({ type: "op", value: op });
      continue;
    }
    if ("+-*/^%&".includes(c)) {
      tokens.push({ type: "op", value: c });
      i++;
      continue;
    }
    // Unknown character — skip it defensively rather than throwing, the
    // parser will surface a #VALUE!/#NAME? error if the resulting token
    // stream doesn't make sense.
    i++;
  }
  tokens.push({ type: "eof", value: "" });
  return tokens;
}

// ─── AST ─────────────────────────────────────────────────────────────────

type Node =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "bool"; value: boolean }
  | { kind: "ref"; addr: CellAddr }
  | { kind: "range"; from: CellAddr; to: CellAddr }
  | { kind: "unary"; op: "-" | "+"; arg: Node }
  | { kind: "percent"; arg: Node }
  | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] };

class ParseError extends Error {}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }
  private expect(type: TokenType): Token {
    const t = this.next();
    if (t.type !== type) throw new ParseError(`Expected ${type}, got ${t.type}`);
    return t;
  }

  parse(): Node {
    const node = this.parseComparison();
    if (this.peek().type !== "eof") throw new ParseError("Unexpected trailing tokens");
    return node;
  }

  private parseComparison(): Node {
    let left = this.parseConcat();
    while (this.peek().type === "op" && ["=", "<>", "<", ">", "<=", ">="].includes(this.peek().value)) {
      const op = this.next().value;
      const right = this.parseConcat();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseConcat(): Node {
    let left = this.parseAdditive();
    while (this.peek().type === "op" && this.peek().value === "&") {
      this.next();
      const right = this.parseAdditive();
      left = { kind: "binary", op: "&", left, right };
    }
    return left;
  }

  private parseAdditive(): Node {
    let left = this.parseMultiplicative();
    while (this.peek().type === "op" && (this.peek().value === "+" || this.peek().value === "-")) {
      const op = this.next().value;
      const right = this.parseMultiplicative();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): Node {
    let left = this.parseUnary();
    while (this.peek().type === "op" && (this.peek().value === "*" || this.peek().value === "/")) {
      const op = this.next().value;
      const right = this.parseUnary();
      left = { kind: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): Node {
    if (this.peek().type === "op" && (this.peek().value === "-" || this.peek().value === "+")) {
      const op = this.next().value as "-" | "+";
      return { kind: "unary", op, arg: this.parseUnary() };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    let left = this.parsePostfix();
    if (this.peek().type === "op" && this.peek().value === "^") {
      this.next();
      const right = this.parseUnary(); // right-associative, allows unary after ^
      left = { kind: "binary", op: "^", left, right };
    }
    return left;
  }

  private parsePostfix(): Node {
    let node = this.parsePrimary();
    while (this.peek().type === "op" && this.peek().value === "%") {
      this.next();
      node = { kind: "percent", arg: node };
    }
    return node;
  }

  private parsePrimary(): Node {
    const t = this.peek();
    if (t.type === "number") {
      this.next();
      return { kind: "num", value: parseFloat(t.value) };
    }
    if (t.type === "string") {
      this.next();
      return { kind: "str", value: t.value };
    }
    if (t.type === "lparen") {
      this.next();
      const inner = this.parseComparison();
      this.expect("rparen");
      return inner;
    }
    if (t.type === "ref") {
      this.next();
      const addr = parseCellAddr(t.value);
      if (!addr) throw new ParseError(`Invalid cell reference: ${t.value}`);
      if (this.peek().type === "colon") {
        this.next();
        const t2 = this.expect("ref");
        const addr2 = parseCellAddr(t2.value);
        if (!addr2) throw new ParseError(`Invalid cell reference: ${t2.value}`);
        return { kind: "range", from: addr, to: addr2 };
      }
      return { kind: "ref", addr };
    }
    if (t.type === "ident") {
      this.next();
      const upper = t.value.toUpperCase();
      if (upper === "TRUE") return { kind: "bool", value: true };
      if (upper === "FALSE") return { kind: "bool", value: false };
      if (this.peek().type === "lparen") {
        this.next();
        const args: Node[] = [];
        if (this.peek().type !== "rparen") {
          args.push(this.parseComparison());
          while (this.peek().type === "comma") {
            this.next();
            args.push(this.parseComparison());
          }
        }
        this.expect("rparen");
        return { kind: "call", name: upper, args };
      }
      // Bare identifier with no call — treat as a #NAME? error at eval time.
      return { kind: "call", name: `__NAME__${t.value}`, args: [] };
    }
    throw new ParseError(`Unexpected token: ${t.type} ${t.value}`);
  }
}

export function parseFormula(src: string): Node {
  return new Parser(tokenize(src)).parse();
}

// ─── Evaluator ───────────────────────────────────────────────────────────

export type CellResolver = (addr: CellAddr) => EvalResult;

const ERR = (error: FormulaError): CellErrorValue => ({ error });

function toNumber(v: EvalResult): number | CellErrorValue {
  if (isErrorValue(v)) return v;
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = parseFloat(v);
  return Number.isNaN(n) ? ERR("#VALUE!") : n;
}

function toStr(v: EvalResult): string {
  if (isErrorValue(v)) return v.error;
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return String(v);
}

function truthy(v: EvalResult): boolean {
  if (isErrorValue(v)) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "";
  return false;
}

function flattenRange(node: Extract<Node, { kind: "range" }>, resolve: CellResolver): EvalResult[] {
  const r1 = Math.min(node.from.row, node.to.row);
  const r2 = Math.max(node.from.row, node.to.row);
  const c1 = Math.min(node.from.col, node.to.col);
  const c2 = Math.max(node.from.col, node.to.col);
  const out: EvalResult[] = [];
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      out.push(resolve({ col: c, row: r }));
    }
  }
  return out;
}

function collectArgValues(nodes: Node[], resolve: CellResolver): EvalResult[] {
  const out: EvalResult[] = [];
  for (const n of nodes) {
    if (n.kind === "range") out.push(...flattenRange(n, resolve));
    else out.push(evalNode(n, resolve));
  }
  return out;
}

function numericArgs(values: EvalResult[]): number[] | CellErrorValue {
  const nums: number[] = [];
  for (const v of values) {
    if (v === null || v === "") continue; // blank cells are ignored by aggregate fns
    const n = toNumber(v);
    if (isErrorValue(n)) {
      if (typeof v === "string") continue; // non-numeric text ignored (matches common spreadsheet SUM behavior)
      return n;
    }
    nums.push(n);
  }
  return nums;
}

/** Type guard for the `number[] | CellErrorValue` shape returned by `numericArgs` — distinct from `isErrorValue` (which only accepts a scalar `EvalResult`, and an array isn't one). */
function isNumericArgsError(v: number[] | CellErrorValue): v is CellErrorValue {
  return !Array.isArray(v);
}

const FUNCTIONS: Record<string, (args: Node[], resolve: CellResolver) => EvalResult> = {
  SUM: (args, resolve) => {
    const nums = numericArgs(collectArgValues(args, resolve));
    if (isNumericArgsError(nums)) return nums;
    return nums.reduce((a, b) => a + b, 0);
  },
  AVERAGE: (args, resolve) => {
    const nums = numericArgs(collectArgValues(args, resolve));
    if (isNumericArgsError(nums)) return nums;
    if (!nums.length) return ERR("#DIV/0!");
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  },
  MIN: (args, resolve) => {
    const nums = numericArgs(collectArgValues(args, resolve));
    if (isNumericArgsError(nums)) return nums;
    return nums.length ? Math.min(...nums) : 0;
  },
  MAX: (args, resolve) => {
    const nums = numericArgs(collectArgValues(args, resolve));
    if (isNumericArgsError(nums)) return nums;
    return nums.length ? Math.max(...nums) : 0;
  },
  MEDIAN: (args, resolve) => {
    const nums = numericArgs(collectArgValues(args, resolve));
    if (isNumericArgsError(nums)) return nums;
    if (!nums.length) return ERR("#DIV/0!");
    const sorted = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  },
  COUNT: (args, resolve) => {
    const values = collectArgValues(args, resolve);
    return values.filter((v) => typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(parseFloat(v)))).length;
  },
  COUNTA: (args, resolve) => {
    const values = collectArgValues(args, resolve);
    return values.filter((v) => v !== null && v !== "").length;
  },
  PRODUCT: (args, resolve) => {
    const nums = numericArgs(collectArgValues(args, resolve));
    if (isNumericArgsError(nums)) return nums;
    return nums.reduce((a, b) => a * b, 1);
  },
  IF: (args, resolve) => {
    if (args.length < 2) return ERR("#VALUE!");
    const cond = evalNode(args[0], resolve);
    if (isErrorValue(cond)) return cond;
    if (truthy(cond)) return evalNode(args[1], resolve);
    return args.length > 2 ? evalNode(args[2], resolve) : false;
  },
  AND: (args, resolve) => {
    for (const a of args) {
      const v = evalNode(a, resolve);
      if (isErrorValue(v)) return v;
      if (!truthy(v)) return false;
    }
    return true;
  },
  OR: (args, resolve) => {
    for (const a of args) {
      const v = evalNode(a, resolve);
      if (isErrorValue(v)) return v;
      if (truthy(v)) return true;
    }
    return false;
  },
  NOT: (args, resolve) => {
    if (!args.length) return ERR("#VALUE!");
    const v = evalNode(args[0], resolve);
    if (isErrorValue(v)) return v;
    return !truthy(v);
  },
  ROUND: (args, resolve) => {
    const v = toNumber(evalNode(args[0], resolve));
    if (isErrorValue(v)) return v;
    const d = args[1] ? toNumber(evalNode(args[1], resolve)) : 0;
    if (isErrorValue(d)) return d;
    const f = Math.pow(10, d);
    return Math.round(v * f) / f;
  },
  ABS: (args, resolve) => {
    const v = toNumber(evalNode(args[0], resolve));
    return isErrorValue(v) ? v : Math.abs(v);
  },
  SQRT: (args, resolve) => {
    const v = toNumber(evalNode(args[0], resolve));
    if (isErrorValue(v)) return v;
    return v < 0 ? ERR("#NUM!") : Math.sqrt(v);
  },
  POWER: (args, resolve) => {
    const base = toNumber(evalNode(args[0], resolve));
    const exp = toNumber(evalNode(args[1], resolve));
    if (isErrorValue(base)) return base;
    if (isErrorValue(exp)) return exp;
    return Math.pow(base, exp);
  },
  INT: (args, resolve) => {
    const v = toNumber(evalNode(args[0], resolve));
    return isErrorValue(v) ? v : Math.floor(v);
  },
  MOD: (args, resolve) => {
    const a = toNumber(evalNode(args[0], resolve));
    const b = toNumber(evalNode(args[1], resolve));
    if (isErrorValue(a)) return a;
    if (isErrorValue(b)) return b;
    if (b === 0) return ERR("#DIV/0!");
    return a - Math.floor(a / b) * b;
  },
  PI: () => Math.PI,
  CONCAT: (args, resolve) => args.map((a) => toStr(evalNode(a, resolve))).join(""),
  CONCATENATE: (args, resolve) => args.map((a) => toStr(evalNode(a, resolve))).join(""),
  LEN: (args, resolve) => toStr(evalNode(args[0], resolve)).length,
  UPPER: (args, resolve) => toStr(evalNode(args[0], resolve)).toUpperCase(),
  LOWER: (args, resolve) => toStr(evalNode(args[0], resolve)).toLowerCase(),
  TRIM: (args, resolve) => toStr(evalNode(args[0], resolve)).trim(),
  LEFT: (args, resolve) => {
    const s = toStr(evalNode(args[0], resolve));
    const n = args[1] ? toNumber(evalNode(args[1], resolve)) : 1;
    if (isErrorValue(n)) return n;
    return s.slice(0, Math.max(0, n));
  },
  RIGHT: (args, resolve) => {
    const s = toStr(evalNode(args[0], resolve));
    const n = args[1] ? toNumber(evalNode(args[1], resolve)) : 1;
    if (isErrorValue(n)) return n;
    return n <= 0 ? "" : s.slice(-n);
  },
  MID: (args, resolve) => {
    const s = toStr(evalNode(args[0], resolve));
    const start = toNumber(evalNode(args[1], resolve));
    const len = toNumber(evalNode(args[2], resolve));
    if (isErrorValue(start)) return start;
    if (isErrorValue(len)) return len;
    return s.slice(Math.max(0, start - 1), Math.max(0, start - 1) + Math.max(0, len));
  },
  TODAY: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  },
};

function evalNode(node: Node, resolve: CellResolver): EvalResult {
  switch (node.kind) {
    case "num":
      return node.value;
    case "str":
      return node.value;
    case "bool":
      return node.value;
    case "ref":
      return resolve(node.addr);
    case "range": {
      // A bare range used where a scalar is expected: fall back to its first cell (matches common spreadsheet leniency).
      const values = flattenRange(node, resolve);
      return values.length ? values[0] : null;
    }
    case "unary": {
      const v = toNumber(evalNode(node.arg, resolve));
      if (isErrorValue(v)) return v;
      return node.op === "-" ? -v : v;
    }
    case "percent": {
      const v = toNumber(evalNode(node.arg, resolve));
      if (isErrorValue(v)) return v;
      return v / 100;
    }
    case "binary": {
      if (node.op === "&") {
        const l = evalNode(node.left, resolve);
        if (isErrorValue(l)) return l;
        const r = evalNode(node.right, resolve);
        if (isErrorValue(r)) return r;
        return toStr(l) + toStr(r);
      }
      if (["=", "<>", "<", ">", "<=", ">="].includes(node.op)) {
        const l = evalNode(node.left, resolve);
        if (isErrorValue(l)) return l;
        const r = evalNode(node.right, resolve);
        if (isErrorValue(r)) return r;
        let cmp: number;
        if (typeof l === "number" && typeof r === "number") cmp = l - r;
        else cmp = toStr(l).localeCompare(toStr(r));
        switch (node.op) {
          case "=":
            return cmp === 0;
          case "<>":
            return cmp !== 0;
          case "<":
            return cmp < 0;
          case ">":
            return cmp > 0;
          case "<=":
            return cmp <= 0;
          case ">=":
            return cmp >= 0;
        }
      }
      const l = toNumber(evalNode(node.left, resolve));
      if (isErrorValue(l)) return l;
      const r = toNumber(evalNode(node.right, resolve));
      if (isErrorValue(r)) return r;
      switch (node.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? ERR("#DIV/0!") : l / r;
        case "^":
          return Math.pow(l, r);
      }
      return ERR("#VALUE!");
    }
    case "call": {
      if (node.name.startsWith("__NAME__")) return ERR("#NAME?");
      const fn = FUNCTIONS[node.name];
      if (!fn) return ERR("#NAME?");
      try {
        return fn(node.args, resolve);
      } catch {
        return ERR("#VALUE!");
      }
    }
  }
}

/** Parse + evaluate a formula string (without the leading "="). */
export function evaluateFormula(formulaBody: string, resolve: CellResolver): EvalResult {
  try {
    const ast = parseFormula(formulaBody);
    return evalNode(ast, resolve);
  } catch {
    return ERR("#ERROR!");
  }
}

/** Extract every distinct cell address a formula depends on (single refs + range bounds expanded). Used for dependency-graph / cycle detection. */
export function extractDependencies(formulaBody: string): CellAddr[] {
  let ast: Node;
  try {
    ast = parseFormula(formulaBody);
  } catch {
    return [];
  }
  const deps: CellAddr[] = [];
  const walk = (node: Node) => {
    switch (node.kind) {
      case "ref":
        deps.push(node.addr);
        return;
      case "range": {
        const r1 = Math.min(node.from.row, node.to.row);
        const r2 = Math.max(node.from.row, node.to.row);
        const c1 = Math.min(node.from.col, node.to.col);
        const c2 = Math.max(node.from.col, node.to.col);
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) deps.push({ col: c, row: r });
        return;
      }
      case "unary":
      case "percent":
        walk(node.arg);
        return;
      case "binary":
        walk(node.left);
        walk(node.right);
        return;
      case "call":
        node.args.forEach(walk);
        return;
      default:
        return;
    }
  };
  walk(ast);
  return deps;
}
