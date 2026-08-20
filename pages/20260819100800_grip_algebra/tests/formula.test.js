import assert from "node:assert/strict";
import test from "node:test";
import { latexToMathMl, splitLeadingMathPunctuation } from "../formula.js";

test("renders the freeze pair as existence of akrateia and hold", () => {
  const math = latexToMathMl("S(t)=(\\exists i\\,\\neg b_i(t),\\exists i\\,b_i(t))");
  assert.match(math, /<math/);
  assert.match(math, /∃/);
  assert.match(math, />S</);
  assert.match(math, /¬/);
  assert.match(math, />b</);
  assert.equal(math.includes(">H<"), false);
  assert.equal(math.includes(">F<"), false);
});

test("renders held-count sum and composition join", () => {
  const sum = latexToMathMl("h=\\sum_i b_i");
  assert.match(sum, /∑/);
  assert.match(sum, />h</);
  assert.match(sum, />b</);
  const join = latexToMathMl("S(A\\cup B)=S(A)\\lor S(B)");
  assert.match(join, /∪/);
  assert.match(join, /∨/);
});

test("combined reading pair is T with S, not sigma", () => {
  const math = latexToMathMl("(T,S)");
  assert.match(math, />T</);
  assert.match(math, />S</);
  assert.equal(math.includes("σ"), false);
});

test("renders Shannon fraction", () => {
  const math = latexToMathMl("\\frac{F+D}{V+D}=\\frac{B}{H}");
  assert.match(math, /<mfrac/);
  assert.match(math, />F</);
  assert.match(math, />B</);
});

test("display formulas scroll as one equation instead of breaking into lines", () => {
  const displayMath = latexToMathMl("A\\to B\\to C", true);
  const inlineMath = latexToMathMl("A\\to B\\to C");

  assert.match(displayMath, /<math[^>]* display="block"[^>]* overflow="scroll"/);
  assert.equal(inlineMath.includes('overflow="scroll"'), false);
});

test("renders a cases environment as a braced two-column table", () => {
  const math = latexToMathMl(
    "(p_0,p_1,p_2,p_3)=\\begin{cases}(1-2r,2r,0,0),&0\\le r\\le\\frac{1}{2}\\\\(0,2-2r,2r-1,0),&\\frac{1}{2}\\le r\\le1.\\end{cases}",
    true,
  );

  assert.match(math, /<mo fence="true" stretchy="true" form="prefix">\{<\/mo>/);
  assert.equal((math.match(/<mtr>/g) || []).length, 2);
  assert.equal((math.match(/<mtd>/g) || []).length, 4);
  assert.match(math, /<mfrac>/);
  assert.equal(math.includes("begin"), false);
  assert.equal(math.includes("cases"), false);
  assert.equal(math.includes("end"), false);
});

test("renders holding-topology map, boundary, floor, and time integral", () => {
  const projection = latexToMathMl("P\\longmapsto(\\mathrm{S}(P),H_P(t))");
  assert.match(projection, /↦/);
  assert.equal(projection.includes("longmapsto"), false);

  const boundary = latexToMathMl("d_{\\partial}(H)=\\operatorname{min}(q,n-q)");
  assert.match(boundary, /∂/);
  assert.match(boundary, /mathvariant="normal">min/);
  assert.equal(boundary.includes(">partial<"), false);

  const robustness = latexToMathMl("\\lfloor n\/2\\rfloor");
  assert.match(robustness, /⌊/);
  assert.match(robustness, /⌋/);

  const average = latexToMathMl("\\bar g=\\frac{1}{nT}\\int_0^T q(t)\\,dt");
  assert.match(average, /∫/);
  assert.equal(average.includes(">int<"), false);

  const adjacency = latexToMathMl("H\\sim H'\\iff |H\\triangle H'|=1");
  assert.match(adjacency, /∼/);
  assert.match(adjacency, /⇔/);
  assert.match(adjacency, /△/);
});

test("renders boxed universal no-grip invariant", () => {
  const math = latexToMathMl("\\boxed{\\forall t\\in I,\\quad \\exists x:\\neg\\operatorname{gripped}(x,t)}");
  assert.match(math, /∀/);
  assert.match(math, /∃/);
});

test("freeze sign path arrows render as arrows, not the command name", () => {
  const math = latexToMathMl("\\kappa\\rightarrow\\alpha\\rightarrow\\kappa");
  assert.match(math, /→/);
  assert.equal(math.includes("rightarrow"), false);
  assert.match(math, /κ/);
});

test("mixed holding cycle set braces render as braces around object numbers", () => {
  const math = latexToMathMl("\\{1\\}\\to\\{1,2\\}\\to\\{2\\}\\to\\{2,3\\}\\to\\{3\\}\\to\\{3,1\\}");
  assert.match(math, /<mo fence="true" stretchy="false" form="prefix">\{<\/mo>/);
  assert.match(math, /<mn>1<\/mn>/);
  assert.match(math, /<mn>2<\/mn>/);
  assert.match(math, /→/);
});

test("thin space is a short mspace, not an em-quad operator", () => {
  const math = latexToMathMl("\\exists i\\,\\neg b_i");
  assert.match(math, /<mspace width="0.167em"><\/mspace>/);
  assert.equal(math.includes(" "), false);
  assert.match(math, /form="prefix"[^>]*>∃/);
});

test("existence stays beside its variable in display style", () => {
  const math = latexToMathMl("\\exists i\\,b_i", true);
  assert.match(math, /largeop="false"/);
  assert.match(math, /movablelimits="false"/);
  assert.match(math, /form="prefix"[^>]*>∃/);
  assert.match(math, /<mi>i<\/mi>/);
});

test("simultaneous hold and release is a conjunction", () => {
  const math = latexToMathMl("\\exists i\\,b_i \\land \\exists i\\,\\neg b_i");
  assert.match(math, /∧/);
  assert.match(math, /¬/);
  assert.equal(math.includes("and"), false);
});

test("quad and qquad are mspace, not operator glyphs", () => {
  const math = latexToMathMl("A,\\quad B,\\qquad C");
  assert.match(math, /width="1em"/);
  assert.match(math, /width="2em"/);
  assert.equal(math.includes(" "), false);
});

test("absolute bars pair as prefix and postfix fences", () => {
  const math = latexToMathMl("|O|");
  assert.match(math, /form="prefix">\|<\/mo>/);
  assert.match(math, /form="postfix">\|<\/mo>/);
});

test("lt command renders less-than without a raw angle in the source", () => {
  const math = latexToMathMl("0\\lt h\\lt n");
  assert.match(math, /&lt;/);
  assert.match(math, />n</);
});

test("object count n is a Latin letter, freeze kappa is Greek", () => {
  const count = latexToMathMl("n=|O|");
  assert.match(count, />n</);
  assert.equal(count.includes("κ"), false);
  const freeze = latexToMathMl("\\kappa");
  assert.match(freeze, /κ/);
  assert.equal(freeze.includes(">n<"), false);
});

test("punctuation after inline math stays with the formula so a line cannot open on a comma", () => {
  assert.deepEqual(splitLeadingMathPunctuation(", K"), { glued: ", ", rest: "K" });
  assert.deepEqual(splitLeadingMathPunctuation(", когда"), { glued: ", ", rest: "когда" });
  assert.deepEqual(splitLeadingMathPunctuation("; "), { glued: "; ", rest: "" });
  assert.deepEqual(splitLeadingMathPunctuation(": предметная"), { glued: ": ", rest: "предметная" });
  assert.deepEqual(splitLeadingMathPunctuation(". "), { glued: ". ", rest: "" });
  assert.deepEqual(splitLeadingMathPunctuation(" когда"), { glued: "", rest: " когда" });
  assert.deepEqual(splitLeadingMathPunctuation("— единица"), { glued: "", rest: "— единица" });
});
