const COMMANDS = {
  exists: "∃",
  forall: "∀",
  neg: "¬",
  vee: "∨",
  wedge: "∧",
  lor: "∨",
  land: "∧",
  in: "∈",
  notin: "∉",
  leq: "≤",
  geq: "≥",
  neq: "≠",
  times: "×",
  cdot: "⋅",
  circ: "∘",
  sim: "∼",
  triangle: "△",
  to: "→",
  rightarrow: "→",
  leftarrow: "←",
  longrightarrow: "⟶",
  mapsto: "↦",
  longmapsto: "↦",
  iff: "⇔",
  Rightarrow: "⇒",
  subseteq: "⊆",
  subset: "⊂",
  cup: "∪",
  cap: "∩",
  emptyset: "∅",
  ldots: "…",
  dots: "…",
  sqcup: "⊔",
  bigvee: "⋁",
  sum: "∑",
  lnot: "¬",
  colon: ":",
  ge: "≥",
  le: "≤",
  lt: "<",
  gt: ">",
  approx: "≈",
  alpha: "α",
  kappa: "κ",
  sigma: "σ",
  pi: "π",
  mu: "μ",
  partial: "∂",
  int: "∫",
  lfloor: "⌊",
  rfloor: "⌋",
  Phi: "Φ",
  Sigma: "Σ",
};

const PREFIX_COMMANDS = new Set(["exists", "forall", "neg", "lnot"]);

function escapeXml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function mi(text) {
  return `<mi>${escapeXml(text)}</mi>`;
}

function mn(text) {
  return `<mn>${escapeXml(text)}</mn>`;
}

function mo(text) {
  return `<mo>${escapeXml(text)}</mo>`;
}

function mrow(inner) {
  return `<mrow>${inner}</mrow>`;
}

function tokenize(source) {
  const tokens = [];
  let index = 0;
  let absoluteBarOpen = false;
  while (index < source.length) {
    const character = source[index];
    if (source.startsWith("\\begin{cases}", index)) {
      tokens.push({ type: "cases_start" });
      index += "\\begin{cases}".length;
      continue;
    }
    if (source.startsWith("\\end{cases}", index)) {
      tokens.push({ type: "cases_end" });
      index += "\\end{cases}".length;
      continue;
    }
    if (character === "\\" && source[index + 1] === "\\") {
      tokens.push({ type: "row_separator" });
      index += 2;
      continue;
    }
    if (character === "\\" && source.startsWith("\\operatorname", index)) {
      const start = source.indexOf("{", index);
      const end = source.indexOf("}", start);
      tokens.push({ type: "operatorname", value: source.slice(start + 1, end).replace(/\\_/g, "_") });
      index = end + 1;
      continue;
    }
    if (character === "\\" && source.startsWith("\\text", index)) {
      const start = source.indexOf("{", index);
      const end = source.indexOf("}", start);
      tokens.push({ type: "text", value: source.slice(start + 1, end) });
      index = end + 1;
      continue;
    }
    if (character === "\\" && source.startsWith("\\mathrm", index)) {
      const start = source.indexOf("{", index);
      const end = source.indexOf("}", start);
      tokens.push({ type: "text", value: source.slice(start + 1, end) });
      index = end + 1;
      continue;
    }
    if (character === "\\" && source.startsWith("\\frac", index)) {
      tokens.push({ type: "frac" });
      index += 5;
      continue;
    }
    if (character === "\\" && source.startsWith("\\boxed", index)) {
      tokens.push({ type: "boxed" });
      index += 6;
      continue;
    }
    if (character === "\\" && source.startsWith("\\bar", index)) {
      tokens.push({ type: "bar" });
      index += 4;
      continue;
    }
    if (character === "\\" && source.startsWith("\\overline", index)) {
      tokens.push({ type: "bar" });
      index += 9;
      continue;
    }
    if (character === "\\" && source[index + 1] === ",") {
      tokens.push({ type: "space", width: "0.167em" });
      index += 2;
      continue;
    }
    if (character === "\\" && (source[index + 1] === "{" || source[index + 1] === "}")) {
      const brace = source[index + 1];
      tokens.push({ type: "fence", value: brace, form: brace === "{" ? "prefix" : "postfix" });
      index += 2;
      continue;
    }
    if (character === "\\") {
      index += 1;
      let name = "";
      while (index < source.length && /[A-Za-z]/.test(source[index])) {
        name += source[index];
        index += 1;
      }
      tokens.push({ type: "command", value: name });
      continue;
    }
    if (character === "{") {
      tokens.push({ type: "lbrace" });
      index += 1;
      continue;
    }
    if (character === "}") {
      tokens.push({ type: "rbrace" });
      index += 1;
      continue;
    }
    if (character === "^") {
      tokens.push({ type: "sup" });
      index += 1;
      continue;
    }
    if (character === "_") {
      tokens.push({ type: "sub" });
      index += 1;
      continue;
    }
    if (character === "(") {
      tokens.push({ type: "fence", value: "(", form: "prefix" });
      index += 1;
      continue;
    }
    if (character === ")") {
      tokens.push({ type: "fence", value: ")", form: "postfix" });
      index += 1;
      continue;
    }
    if (character === "|") {
      tokens.push({ type: "fence", value: "|", form: absoluteBarOpen ? "postfix" : "prefix" });
      absoluteBarOpen = !absoluteBarOpen;
      index += 1;
      continue;
    }
    if (character === "&") {
      tokens.push({ type: "column_separator" });
      index += 1;
      continue;
    }
    if ("=+-*/<>',.:;".includes(character)) {
      tokens.push({ type: "op", value: character === "*" ? "⋅" : character });
      index += 1;
      continue;
    }
    if (character === " ") {
      index += 1;
      continue;
    }
    if (/[0-9]/.test(character)) {
      let value = "";
      while (index < source.length && /[0-9.]/.test(source[index])) {
        value += source[index];
        index += 1;
      }
      tokens.push({ type: "number", value });
      continue;
    }
    tokens.push({ type: "letter", value: character });
    index += 1;
  }
  return tokens;
}

function parseGroup(tokens, cursor) {
  if (tokens[cursor.index]?.type === "lbrace") {
    cursor.index += 1;
    const inner = parseUntil(tokens, cursor, "rbrace");
    cursor.index += 1;
    return mrow(inner);
  }
  return parseAtom(tokens, cursor);
}

function parseCases(tokens, cursor) {
  const rows = [];
  while (tokens[cursor.index] && tokens[cursor.index].type !== "cases_end") {
    const cells = [parseUntilAny(tokens, cursor, new Set(["column_separator", "row_separator", "cases_end"]))];
    while (tokens[cursor.index]?.type === "column_separator") {
      cursor.index += 1;
      cells.push(parseUntilAny(tokens, cursor, new Set(["column_separator", "row_separator", "cases_end"])));
    }
    rows.push(`<mtr>${cells.map((cell) => `<mtd>${mrow(cell)}</mtd>`).join("")}</mtr>`);
    if (tokens[cursor.index]?.type === "row_separator") {
      cursor.index += 1;
    }
  }
  if (tokens[cursor.index]?.type === "cases_end") {
    cursor.index += 1;
  }
  return mrow(
    `<mo fence="true" stretchy="true" form="prefix">{</mo>` +
      `<mtable columnalign="left left" columnspacing="1em">${rows.join("")}</mtable>`,
  );
}

function parseAtom(tokens, cursor) {
  const token = tokens[cursor.index];
  if (!token) {
    return "";
  }
  cursor.index += 1;
  if (token.type === "letter") {
    return mi(token.value);
  }
  if (token.type === "number") {
    return mn(token.value);
  }
  if (token.type === "op") {
    return mo(token.value);
  }
  if (token.type === "fence") {
    return `<mo fence="true" stretchy="false" form="${token.form}">${escapeXml(token.value)}</mo>`;
  }
  if (token.type === "space") {
    return `<mspace width="${token.width}"></mspace>`;
  }
  if (token.type === "text" || token.type === "operatorname") {
    return `<mi mathvariant="normal">${escapeXml(token.value)}</mi>`;
  }
  if (token.type === "command") {
    if (token.value === "quad") {
      return `<mspace width="1em"></mspace>`;
    }
    if (token.value === "qquad") {
      return `<mspace width="2em"></mspace>`;
    }
    const symbol = COMMANDS[token.value];
    if (symbol) {
      if (/[A-Za-zα-ωΑ-Ω]/.test(symbol)) {
        return mi(symbol);
      }
      if (PREFIX_COMMANDS.has(token.value)) {
        return `<mo form="prefix" largeop="false" movablelimits="false">${escapeXml(symbol)}</mo>`;
      }
      return mo(symbol);
    }
    if (token.value === "left" || token.value === "right") {
      return "";
    }
    return mi(token.value);
  }
  if (token.type === "frac") {
    const numerator = parseGroup(tokens, cursor);
    const denominator = parseGroup(tokens, cursor);
    return `<mfrac>${numerator}${denominator}</mfrac>`;
  }
  if (token.type === "boxed") {
    const inner = parseGroup(tokens, cursor);
    return `<menclose notation="box">${inner}</menclose>`;
  }
  if (token.type === "bar") {
    const inner = parseGroup(tokens, cursor);
    return `<mover>${inner}<mo>¯</mo></mover>`;
  }
  if (token.type === "cases_start") {
    return parseCases(tokens, cursor);
  }
  if (token.type === "lbrace") {
    const inner = parseUntil(tokens, cursor, "rbrace");
    cursor.index += 1;
    return mrow(inner);
  }
  return "";
}

function parseUntil(tokens, cursor, stopType) {
  return parseUntilAny(tokens, cursor, new Set([stopType]));
}

function parseUntilAny(tokens, cursor, stopTypes) {
  let body = "";
  while (tokens[cursor.index] && !stopTypes.has(tokens[cursor.index].type)) {
    body += parseScripted(tokens, cursor);
  }
  return body;
}

function parseScripted(tokens, cursor) {
  let base = parseAtom(tokens, cursor);
  while (tokens[cursor.index] && (tokens[cursor.index].type === "sub" || tokens[cursor.index].type === "sup")) {
    const kind = tokens[cursor.index].type;
    cursor.index += 1;
    const script = parseGroup(tokens, cursor);
    base = kind === "sub" ? `<msub>${mrow(base)}${script}</msub>` : `<msup>${mrow(base)}${script}</msup>`;
  }
  return base;
}

export function latexToMathMl(source, display = false) {
  const tokens = tokenize(source);
  const cursor = { index: 0 };
  const inner = parseUntil(tokens, cursor, "end");
  const displayAttr = display ? ' display="block" overflow="scroll"' : "";
  return `<math xmlns="http://www.w3.org/1998/Math/MathML"${displayAttr}>${inner}</math>`;
}

export function splitLeadingMathPunctuation(text) {
  const match = text.match(/^([,;:.!?)»”’]+\s*)([\s\S]*)$/u);
  if (!match) {
    return { glued: "", rest: text };
  }
  return { glued: match[1], rest: match[2] };
}

function glueFollowingPunctuation(node) {
  const next = node.nextSibling;
  if (!next || next.nodeType !== 3) {
    return;
  }
  const { glued, rest } = splitLeadingMathPunctuation(next.textContent);
  if (!glued) {
    return;
  }
  node.append(glued);
  if (rest) {
    next.textContent = rest;
  } else {
    next.remove();
  }
}

export function renderLatexElements(root) {
  const nodes = root.querySelectorAll("[data-latex]");
  nodes.forEach((node) => {
    const source = node.getAttribute("data-latex");
    const display = node.tagName === "DIV" || node.getAttribute("data-display") === "block";
    node.innerHTML = latexToMathMl(source, display);
    if (!display) {
      glueFollowingPunctuation(node);
    }
  });
}
