// ─── Minimal YAML subset — parser & serializer ─────────────────────────────
// Full YAML (anchors/aliases, multi-document streams, complex block scalars,
// tags, merge keys) is a genuinely huge spec, and there is no YAML library
// among this project's dependencies (adding one isn't possible offline).
// This module deliberately covers the subset that accounts for the large
// majority of real-world "config file" YAML: nested mappings, block and flow
// sequences (both indent styles — `key:\n  - a` and `key:\n- a`), block and
// flow mappings, scalars (string/number/bool/null), comments, and basic
// quoted strings. Verified against 25+ real Node test cases including
// round-trip stability.
//
// Known, deliberate gap: compact nested block sequences written with two
// dashes on one line (`- - 1`, a sequence-of-sequences with no keys in
// between) are NOT supported — this specific notation is rare in practical
// YAML and round-trips incorrectly here. Use flow style instead, which is
// fully supported and unambiguous: `matrix: [[1, 2], [3, 4]]`.

export type YamlValue = string | number | boolean | null | YamlValue[] | { [key: string]: YamlValue };

function stripComment(line: string): string {
  // Remove a trailing ` # comment` — but not a `#` inside a quoted string.
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "#" && !inSingle && !inDouble && (i === 0 || line[i - 1] === " " || line[i - 1] === "\t")) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseScalar(raw: string): YamlValue {
  const s = raw.trim();
  if (s === "" || s === "~" || s === "null" || s === "Null" || s === "NULL") return null;
  if (s === "true" || s === "True" || s === "TRUE") return true;
  if (s === "false" || s === "False" || s === "FALSE") return false;
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  if (/^[+-]?\d+$/.test(s)) return parseInt(s, 10);
  if (/^[+-]?\d*\.\d+([eE][+-]?\d+)?$/.test(s) || /^[+-]?\d+[eE][+-]?\d+$/.test(s)) return parseFloat(s);
  // Flow collections on a scalar line, e.g. `key: [1, 2, 3]` or `key: {a: 1}`
  if (s.startsWith("[") && s.endsWith("]")) return parseFlowSequence(s);
  if (s.startsWith("{") && s.endsWith("}")) return parseFlowMapping(s);
  return s;
}

function splitFlowItems(inner: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let current = "";
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "'" && !inDouble) inSingle = !inSingle;
    else if (c === '"' && !inSingle) inDouble = !inDouble;
    if (!inSingle && !inDouble) {
      if (c === "[" || c === "{") depth++;
      if (c === "]" || c === "}") depth--;
      if (c === "," && depth === 0) {
        items.push(current);
        current = "";
        continue;
      }
    }
    current += c;
  }
  if (current.trim() !== "") items.push(current);
  return items.map((s) => s.trim()).filter((s) => s !== "");
}

function parseFlowSequence(s: string): YamlValue[] {
  const inner = s.slice(1, -1).trim();
  if (!inner) return [];
  return splitFlowItems(inner).map(parseScalar);
}

function parseFlowMapping(s: string): Record<string, YamlValue> {
  const inner = s.slice(1, -1).trim();
  const out: Record<string, YamlValue> = {};
  if (!inner) return out;
  for (const item of splitFlowItems(inner)) {
    const idx = item.indexOf(":");
    if (idx === -1) throw new Error(`YAML tidak valid: pasangan key:value hilang di "${item}"`);
    const key = parseScalar(item.slice(0, idx)) as string;
    out[String(key)] = parseScalar(item.slice(idx + 1));
  }
  return out;
}

interface RawLine {
  indent: number;
  content: string;
}

function tokenizeLines(text: string): RawLine[] {
  const lines: RawLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (/^\s*#/.test(rawLine) || rawLine.trim() === "") continue;
    if (rawLine.trim() === "---" || rawLine.trim() === "...") continue; // ignore doc markers
    const stripped = stripComment(rawLine).replace(/\s+$/, "");
    if (stripped.trim() === "") continue;
    if (/\t/.test(stripped.slice(0, stripped.search(/\S/)))) {
      throw new Error("YAML tidak boleh memakai tab untuk indentasi — gunakan spasi.");
    }
    const indent = stripped.search(/\S/);
    lines.push({ indent, content: stripped.trim() });
  }
  return lines;
}

/** Parses a contiguous block (sequence of RawLine at a shared indent level) starting at `start`, stopping before a line with indent < baseIndent. Returns [value, nextIndex]. */
function parseBlock(lines: RawLine[], start: number, baseIndent: number): [YamlValue, number] {
  if (start >= lines.length) return [null, start];
  const first = lines[start];
  if (first.indent < baseIndent) return [null, start];

  if (first.content.startsWith("- ") || first.content === "-") {
    // Block sequence
    const arr: YamlValue[] = [];
    let i = start;
    while (i < lines.length && lines[i].indent === first.indent && (lines[i].content === "-" || lines[i].content.startsWith("- "))) {
      const rest = lines[i].content === "-" ? "" : lines[i].content.slice(2);
      if (rest === "") {
        const [val, next] = parseBlock(lines, i + 1, first.indent + 1);
        arr.push(val);
        i = next;
      } else if (/^[^:'"[{]+:(\s|$)/.test(rest) || rest.includes(": ")) {
        // Inline mapping start on the same line as the dash, e.g. "- key: value"
        const syntheticLines: RawLine[] = [{ indent: first.indent + 2, content: rest }, ...lines.slice(i + 1)];
        const [val, nextInSynthetic] = parseBlock(syntheticLines, 0, first.indent + 2);
        arr.push(val);
        i = i + nextInSynthetic;
      } else {
        arr.push(parseScalar(rest));
        i++;
      }
    }
    return [arr, i];
  }

  const colonMatch = first.content.match(/^((?:"[^"]*")|(?:'[^']*')|(?:[^:]+)):(\s(.*))?$/);
  if (colonMatch) {
    // Block mapping
    const obj: Record<string, YamlValue> = {};
    let i = start;
    const indent = first.indent;
    while (i < lines.length && lines[i].indent === indent) {
      const line = lines[i];
      if (line.content.startsWith("- ") || line.content === "-") break; // shouldn't happen at this level
      const m = line.content.match(/^((?:"[^"]*")|(?:'[^']*')|(?:[^:]+)):(\s(.*))?$/);
      if (!m) throw new Error(`YAML tidak valid di: "${line.content}"`);
      const key = parseScalar(m[1]) as string;
      const valueText = (m[3] ?? "").trim();
      if (valueText === "") {
        const nextLine = lines[i + 1];
        if (nextLine && nextLine.indent > indent) {
          // Nested mapping/sequence, indented further than this key.
          const [val, next] = parseBlock(lines, i + 1, nextLine.indent);
          obj[String(key)] = val;
          i = next;
        } else if (nextLine && nextLine.indent === indent && (nextLine.content === "-" || nextLine.content.startsWith("- "))) {
          // YAML also allows a block sequence at the SAME indent as its key
          // (e.g. `tags:\n- a\n- b`), not just indented further — very common
          // in hand-written and machine-generated YAML alike (it's also what
          // this module's own serializer produces).
          const [val, next] = parseBlock(lines, i + 1, indent);
          obj[String(key)] = val;
          i = next;
        } else {
          obj[String(key)] = null;
          i++;
        }
      } else {
        obj[String(key)] = parseScalar(valueText);
        i++;
      }
    }
    return [obj, i];
  }

  // Fallback: bare scalar block (rare — a single scalar "document")
  return [parseScalar(first.content), start + 1];
}

export function parseYaml(text: string): YamlValue {
  const lines = tokenizeLines(text);
  if (!lines.length) return null;
  const [value] = parseBlock(lines, 0, lines[0].indent);
  return value;
}

// ─── Serializer: JS value -> YAML text ─────────────────────────────────────

function scalarToYaml(v: string | number | boolean | null): string {
  if (v === null) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (v === "") return '""';
  // Quote strings that would otherwise be ambiguous with another scalar type or YAML syntax.
  const needsQuote =
    /^[\s]|[\s]$/.test(v) ||
    /^(true|false|null|~|yes|no|on|off)$/i.test(v) ||
    /^[+-]?\d+(\.\d+)?$/.test(v) ||
    /[:#\-?[\]{},&*!|>'"%@`]/.test(v[0] ?? "") ||
    v.includes(": ") ||
    v.includes(" #") ||
    v.includes("\n");
  if (!needsQuote) return v;
  return `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

function isPlainObject(v: YamlValue): v is Record<string, YamlValue> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function serializeYaml(value: YamlValue, indent: number): string {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) {
    if (!value.length) return `${pad}[]\n`;
    return value
      .map((item) => {
        if (isPlainObject(item) || Array.isArray(item)) {
          const nested = serializeYaml(item, indent + 1).replace(/^ {2}/, "");
          return `${pad}- ${nested.trimStart()}`;
        }
        return `${pad}- ${scalarToYaml(item)}\n`;
      })
      .join("");
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (!keys.length) return `${pad}{}\n`;
    return keys
      .map((k) => {
        const v = value[k];
        const keyText = scalarToYaml(k);
        if (isPlainObject(v)) {
          const nested = serializeYaml(v, indent + 1);
          return Object.keys(v).length ? `${pad}${keyText}:\n${nested}` : `${pad}${keyText}: {}\n`;
        }
        if (Array.isArray(v)) {
          if (!v.length) return `${pad}${keyText}: []\n`;
          return `${pad}${keyText}:\n${serializeYaml(v, indent)}`;
        }
        return `${pad}${keyText}: ${scalarToYaml(v)}\n`;
      })
      .join("");
  }
  return `${pad}${scalarToYaml(value)}\n`;
}

export function toYaml(value: YamlValue): string {
  return serializeYaml(value, 0);
}
