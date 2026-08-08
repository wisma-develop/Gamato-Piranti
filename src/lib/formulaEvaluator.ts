// Safe arithmetic expression evaluator — tokenizer + recursive-descent parser.
// Deliberately avoids eval()/new Function() so arbitrary user input can never
// execute as JavaScript. Supports + - * / % ^ (), unary +/-, named variables,
// a small whitelist of math functions, and the constants pi/e.

type TokenType = "num" | "ident" | "op" | "lparen" | "rparen" | "comma";
interface Token {
  type: TokenType;
  value: string;
}

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  sqrt: Math.sqrt,
  abs: Math.abs,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  log: Math.log10,
  ln: Math.log,
  exp: Math.exp,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  min: (...a: number[]) => Math.min(...a),
  max: (...a: number[]) => Math.max(...a),
  pow: (a: number, b: number) => Math.pow(a, b),
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

/** Returns the list of free variable names used in an expression (functions/constants excluded). */
export function extractVariables(expr: string): string[] {
  const idents = expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) || [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of idents) {
    const lower = id.toLowerCase();
    if (FUNCTIONS[lower] || CONSTANTS[lower]) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let num = ch;
      i++;
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: "num", value: num });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let id = ch;
      i++;
      while (i < expr.length && /[A-Za-z0-9_]/.test(expr[i])) {
        id += expr[i];
        i++;
      }
      tokens.push({ type: "ident", value: id });
      continue;
    }
    if ("+-*/^%".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch });
      i++;
      continue;
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ch });
      i++;
      continue;
    }
    throw new Error(`Karakter tidak dikenali: "${ch}"`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private tokens: Token[], private vars: Record<string, number>) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }
  private next(): Token | undefined {
    return this.tokens[this.pos++];
  }

  parseExpression(): number {
    return this.parseAddSub();
  }

  private parseAddSub(): number {
    let left = this.parseMulDiv();
    while (this.peek()?.type === "op" && (this.peek()!.value === "+" || this.peek()!.value === "-")) {
      const op = this.next()!.value;
      const right = this.parseMulDiv();
      left = op === "+" ? left + right : left - right;
    }
    return left;
  }

  private parseMulDiv(): number {
    let left = this.parsePow();
    while (this.peek()?.type === "op" && ["*", "/", "%"].includes(this.peek()!.value)) {
      const op = this.next()!.value;
      const right = this.parsePow();
      if (op === "*") left = left * right;
      else if (op === "/") {
        if (right === 0) throw new Error("Pembagian dengan nol.");
        left = left / right;
      } else {
        left = left % right;
      }
    }
    return left;
  }

  private parsePow(): number {
    const base = this.parseUnary();
    if (this.peek()?.type === "op" && this.peek()!.value === "^") {
      this.next();
      const exp = this.parsePow(); // right-associative
      return Math.pow(base, exp);
    }
    return base;
  }

  private parseUnary(): number {
    if (this.peek()?.type === "op" && (this.peek()!.value === "-" || this.peek()!.value === "+")) {
      const op = this.next()!.value;
      const val = this.parseUnary();
      return op === "-" ? -val : val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.peek();
    if (!tok) throw new Error("Rumus tidak lengkap.");

    if (tok.type === "num") {
      this.next();
      return parseFloat(tok.value);
    }

    if (tok.type === "lparen") {
      this.next();
      const val = this.parseExpression();
      if (this.peek()?.type !== "rparen") throw new Error("Kurung tidak seimbang.");
      this.next();
      return val;
    }

    if (tok.type === "ident") {
      this.next();
      const name = tok.value;
      const lower = name.toLowerCase();

      if (this.peek()?.type === "lparen") {
        this.next();
        const args: number[] = [];
        if (this.peek()?.type !== "rparen") {
          args.push(this.parseExpression());
          while (this.peek()?.type === "comma") {
            this.next();
            args.push(this.parseExpression());
          }
        }
        if (this.peek()?.type !== "rparen") throw new Error("Kurung fungsi tidak seimbang.");
        this.next();
        const fn = FUNCTIONS[lower];
        if (!fn) throw new Error(`Fungsi "${name}" tidak dikenali.`);
        return fn(...args);
      }

      if (lower in CONSTANTS) return CONSTANTS[lower];
      if (name in this.vars) return this.vars[name];
      throw new Error(`Variabel "${name}" belum diisi.`);
    }

    throw new Error("Rumus tidak valid.");
  }

  get position() {
    return this.pos;
  }
  get length() {
    return this.tokens.length;
  }
}

/** Evaluates an arithmetic expression string with the given variable values. Throws on invalid syntax. */
export function evaluateFormula(expr: string, vars: Record<string, number> = {}): number {
  const trimmed = (expr || "").trim();
  if (!trimmed) throw new Error("Rumus kosong.");
  const tokens = tokenize(trimmed);
  if (!tokens.length) throw new Error("Rumus kosong.");
  const parser = new Parser(tokens, vars);
  const result = parser.parseExpression();
  if (parser.position < parser.length) throw new Error("Rumus tidak valid (karakter berlebih).");
  if (!isFinite(result)) throw new Error("Hasil tidak valid (kemungkinan pembagian dengan nol atau overflow).");
  return result;
}
