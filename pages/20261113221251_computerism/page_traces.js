import { createTraceStore } from './trace_store.js';
import { planFall, showFracture, animateFall } from './cat_falls.js';
import { renderScratch } from './scratch_marks.js';
const excluded = '[data-cat-world], [data-repair-progress], dialog, .skip, script, style, noscript';
const allowed = element => element instanceof Element && !element.closest(excluded);
const selectorFor = element => {
  if (element.id) return `#${CSS.escape(element.id)}`;
  const parts = [];
  while (element && element !== document.body) {
    const siblings = [...element.parentElement.children].filter(item => item.tagName === element.tagName);
    parts.unshift(`${element.localName}:nth-of-type(${siblings.indexOf(element) + 1})`);
    element = element.parentElement;
  }
  return `body > ${parts.join(' > ')}`;
};
const find = selector => { try { return document.querySelector(selector); } catch { return null; } };
const segmenter = new Intl.Segmenter(document.documentElement.lang, { granularity: 'grapheme' });
const between = (minimum, maximum) => minimum + Math.random() * (maximum - minimum);

export function createTraces(layer, world) {
  function render(record) {
    if (record.kind === 'scratch') return renderScratch(record, layer);
    let element = find(record.selector);
    if (!allowed(element) || element === document.body || element === document.documentElement) return false;
    if (record.kind === 'letter') {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      let node, offset = record.offset;
      while ((node = walker.nextNode())) {
        if (offset < node.length) break;
        offset -= node.length;
      }
      if (!node || node.data.slice(offset, offset + record.character.length) !== record.character) return false;
      element = node.parentElement.closest('[data-cat-letter]');
      if (!element) {
        const range = document.createRange();
        range.setStart(node, offset); range.setEnd(node, offset + record.character.length);
        element = document.createElement('span');
        element.className = 'cat-letter'; element.dataset.catLetter = '';
        range.surroundContents(element);
      }
    } else {
      element.dataset.catShifted = '';
      if (getComputedStyle(element).display === 'inline') {
        element.dataset.catInline = element.style.display;
        element.style.display = 'inline-block';
      }
    }
    element.style.translate = `${record.x}px ${record.y}px`;
    element.style.rotate = `${record.angle}deg`;
    showFracture(element, record);
    return element;
  }

  function restore(element, record) {
    element.getAnimations().forEach(animation => animation.cancel());
    if (record.kind === 'scratch') { element.remove(); return; }
    showFracture(element, {});
    if (record.kind === 'letter') {
      const parent = element.parentElement;
      if (parent) { element.replaceWith(element.textContent); parent.normalize(); }
      return;
    }
    element.style.removeProperty('translate'); element.style.removeProperty('rotate');
    if ('catInline' in element.dataset) {
      if (element.dataset.catInline) element.style.display = element.dataset.catInline;
      else element.style.removeProperty('display');
      delete element.dataset.catInline;
    }
    delete element.dataset.catShifted;
  }
  const store = createTraceStore(render, restore, world?.random);

  function prepare(x, y) {
    const element = document.elementFromPoint(x, y);
    const base = { x: between(-18, 24), y: between(24, 80), angle: between(-30, 30) };
    if (!element || element.matches('body, html, [data-desktop]')) return {
      ...base, kind: 'scratch', x: x / innerWidth, y: (y + scrollY) / document.documentElement.scrollHeight,
    };
    const component = element.closest('button, a, svg, img, input');
    if (component) {
      const target = component.closest('button, a') || component;
      return allowed(target) ? { ...base, x: between(-16, 16), y: between(10, 28),
        angle: between(-8, 8), kind: 'element', selector: selectorFor(target) } : null;
    }
    const caret = document.caretPositionFromPoint?.(x, y);
    const range = !caret && document.caretRangeFromPoint?.(x, y);
    const node = caret?.offsetNode || range?.startContainer;
    const position = caret?.offset ?? range?.startOffset;
    if (node?.nodeType === Node.TEXT_NODE && node.parentElement instanceof HTMLElement && allowed(node.parentElement)) {
      const owner = node.parentElement.closest('[data-cat-letter]')?.parentElement || node.parentElement;
      const glyphs = [...segmenter.segment(node.data)];
      const nearest = glyphs.find(item => item.index + item.segment.length > position) || glyphs.at(-1);
      const previous = glyphs.findLast(item => item.index < position);
      const glyph = [previous, nearest].filter(Boolean).find(item => {
        const range = document.createRange();
        range.setStart(node, item.index); range.setEnd(node, item.index + item.segment.length);
        const box = range.getBoundingClientRect();
        return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
      });
      if (glyph && glyph.segment.trim()) {
        const walker = document.createTreeWalker(owner, NodeFilter.SHOW_TEXT);
        let preceding = 0, current;
        while ((current = walker.nextNode()) && current !== node) preceding += current.length;
        return { ...base, kind: 'letter', selector: selectorFor(owner),
          offset: preceding + glyph.index, character: glyph.segment };
      }
    }
    if (element.children.length) return { ...base, kind: 'scratch', x: x / innerWidth,
      y: (y + scrollY) / document.documentElement.scrollHeight };
    return allowed(element) ? { ...base, x: between(-12, 12), y: between(8, 24),
      angle: between(-4, 4), kind: 'element', selector: selectorFor(element) } : null;
  }

  return {
    prepare,
    apply(record) {
      const plan = planFall(record, world);
      const entry = store.add(plan.record);
      if (!entry) return;
      animateFall(entry.element, { ...plan, record: entry.record, wasBroken: entry.previouslyBroken });
      return entry;
    },
    clear: store.clear,
    entries: store.entries,
    mend: store.mend,
    save: store.save,
    randomPoint() {
      if (Math.random() < .25) return { x: Math.random() < .5 ? 4 : innerWidth - 4, y: between(100, innerHeight - 200) };
      const candidates = [...document.querySelectorAll('body *')].filter(element => {
        if (!allowed(element) || element.matches('body, main, article, [data-desktop], .essay, .essay-window')) return false;
        const box = element.getBoundingClientRect();
        return box.width > 5 && box.height > 5 && box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth;
      });
      const box = candidates[Math.floor(Math.random() * candidates.length)]?.getBoundingClientRect();
      return box ? { x: Math.max(4, Math.min(innerWidth - 4, box.x + Math.min(box.width / 2, 80))),
        y: Math.max(4, Math.min(innerHeight - 4, box.y + Math.min(box.height / 2, 20))) } : null;
    },
  };
}
