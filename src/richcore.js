// Texto simples -> blocos. "1. " vira numeração, "- " vira marcador, "Texto"[link] vira link;
// o resto é parágrafo. Aceita aspas curvas (o teclado do celular troca " por “ ”).
const Q = '["\u201C\u201D]';
const LINK_SRC = `${Q}([^"\u201C\u201D\\n]+)${Q}\\[([^\\]\\n]+)\\]`;
const OL = /^\s*(\d+)[.)]\s+(.*)$/;
const UL = /^\s*[-\u2022*]\s+(.*)$/;

// Corrige "http://https://site", completa "site.com" e bloqueia esquemas perigosos (javascript:, data:...).
export function cleanUrl(raw) {
  let u = String(raw).trim().replace(/\s+/g, '');
  u = u.replace(/^(?:https?:\/\/)+/i, (m) => `${m.split('://').filter(Boolean).pop().toLowerCase()}://`);
  if (/^(mailto|tel):/i.test(u)) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;
  return u ? `https://${u}` : null;
}

// *negrito* e _itálico_ (como no WhatsApp): o marcador não pode estar colado em letra/número
// e não pode ter espaço logo depois de abrir ou antes de fechar. Pode aninhar.
const BOLD = /(^|[^\p{L}\p{N}_*])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}*])/u;
const ITAL = /(^|[^\p{L}\p{N}_])_(?=\S)([^_\n]*?\S)_(?![\p{L}\p{N}_])/u;

function emphasis(text) {
  const out = [];
  let rest = text;
  while (rest) {
    const found = [['b', BOLD.exec(rest)], ['i', ITAL.exec(rest)]]
      .filter(([, m]) => m)
      .sort((a, b) => a[1].index + a[1][1].length - (b[1].index + b[1][1].length))[0];
    if (!found) { out.push({ t: 'text', v: rest }); break; }
    const [t, m] = found;
    const start = m.index + m[1].length;
    if (start > 0) out.push({ t: 'text', v: rest.slice(0, start) });
    out.push({ t, children: emphasis(m[2]) });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function splitInline(text) {
  const re = new RegExp(LINK_SRC, 'g');
  const out = [];
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(...emphasis(text.slice(last, m.index)));
    const href = cleanUrl(m[2]);
    out.push(href ? { t: 'link', label: m[1], href } : { t: 'text', v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(...emphasis(text.slice(last)));
  return out;
}

export function parseBlocks(text) {
  const blocks = [];
  for (const raw of String(text || '').split('\n')) {
    if (!raw.trim()) continue;
    const prev = blocks[blocks.length - 1];
    let m;
    if ((m = OL.exec(raw))) {
      if (prev?.type === 'ol') prev.items.push(m[2]);
      else blocks.push({ type: 'ol', start: Number(m[1]), items: [m[2]] });
    } else if ((m = UL.exec(raw))) {
      if (prev?.type === 'ul') prev.items.push(m[1]);
      else blocks.push({ type: 'ul', items: [m[1]] });
    } else blocks.push({ type: 'p', items: [raw.trim()] });
  }
  return blocks;
}

// Linha que é só um link (usada na seção "Links" para virar botão)
export function soloLink(text) {
  const parts = splitInline(text.trim());
  return parts.length === 1 && parts[0].t === 'link' ? parts[0] : null;
}
