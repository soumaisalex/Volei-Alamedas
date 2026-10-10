import { AUTHOR } from './credits.js';

// Cards compartilháveis em 9:16 (PNG 1080x1920: status do WhatsApp, stories e reels),
// desenhados no navegador com a identidade da logo. O conteúdo fica longe das bordas
// superior e inferior, que os aplicativos cobrem com a interface.
const W = 1080, H = 1920;
const C = { teal: '#0e7050', leaf: '#2fa84a', forest: '#2a6832', deep: '#14301c', muted: '#4c6b55', tint: '#d9f0de', soft: '#f1f7f2' };
const DISPLAY = '"Bowlby One", "Arial Black", sans-serif';
const BODY = 'Nunito, system-ui, sans-serif';
const day = (d, opts) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', opts);
const loadImg = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = src; });

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Texto que reduz a fonte para caber em maxW e, no limite, corta com reticências.
function txt(ctx, str, x, y, { size = 30, family = BODY, weight = '', color = '#000', align = 'center', maxW = 880, base = 'alphabetic' } = {}) {
  let s = size, text = String(str);
  const set = () => { ctx.font = `${weight} ${s}px ${family}`.trim(); };
  set();
  while (ctx.measureText(text).width > maxW && s > 22) { s -= 2; set(); }
  if (ctx.measureText(text).width > maxW) {
    while (text.length > 1 && ctx.measureText(`${text}…`).width > maxW) text = text.slice(0, -1);
    text += '…';
  }
  ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = base;
  ctx.fillText(text, x, y);
}

function wrap(ctx, text, maxW) {
  const lines = [];
  let line = '';
  for (const w of String(text).split(/\s+/)) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

async function base(subtitle) {
  await Promise.all([
    document.fonts.load(`64px ${DISPLAY}`), document.fonts.load(`800 30px ${BODY}`), document.fonts.load(`400 30px ${BODY}`),
  ]).catch(() => {});
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C.teal); g.addColorStop(1, C.deep);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.07; ctx.fillStyle = '#fff'; // círculos suaves, lembrando as pétalas da flor
  [[960, 240, 240], [70, 1560, 280], [1010, 1250, 150]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;

  const logo = await loadImg('/logo.png');
  ctx.fillStyle = '#fff'; rr(ctx, 60, 170, 180, 210, 34); ctx.fill();
  if (logo) { const h = 186, w = (h * logo.width) / logo.height; ctx.drawImage(logo, 60 + (180 - w) / 2, 182, w, h); }
  txt(ctx, 'Vôlei Alamedas', 270, 250, { size: 50, family: DISPLAY, color: '#fff', align: 'left', maxW: 750 });
  txt(ctx, 'Jardins · desde 2025', 270, 302, { size: 34, weight: '800', color: C.tint, align: 'left', maxW: 750 });
  txt(ctx, subtitle, 270, 354, { size: 30, weight: '800', color: '#fff', align: 'left', maxW: 750 });

  ctx.fillStyle = '#fff'; rr(ctx, 60, 420, 960, 1280, 48); ctx.fill();
  return { canvas, ctx };
}

async function avatar(ctx, p, cx, cy, r, ring = 12) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
  const im = p.photo_url ? await loadImg(p.photo_url) : null;
  if (im) {
    const s = Math.min(im.width, im.height);
    ctx.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, cx - r, cy - r, 2 * r, 2 * r);
  } else {
    ctx.fillStyle = C.teal; ctx.fillRect(cx - r, cy - r, 2 * r, 2 * r);
    txt(ctx, p.name[0], cx, cy, { size: r, family: DISPLAY, color: '#fff', base: 'middle', maxW: r * 2 });
  }
  ctx.restore();
  ctx.lineWidth = ring; ctx.strokeStyle = C.leaf;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

function finish(canvas, ctx) {
  txt(ctx, 'Vôlei Alamedas Jardins', 540, 1790, { size: 30, weight: '800', color: C.tint });
  txt(ctx, `Desenvolvido por ${AUTHOR}`, 540, 1832, { size: 24, color: 'rgba(217, 240, 218, .75)' });
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('Falha ao gerar a imagem.'))), 'image/png'));
}

export async function playerCard({ player: p, stats: s, trophies }) {
  const { canvas, ctx } = await base('Card do jogador');
  await avatar(ctx, p, 540, 650, 180);
  txt(ctx, p.name, 540, 940, { size: 70, family: DISPLAY, color: C.deep });
  const tiles = [
    ['Partidas', s.matches], ['Vitórias', s.wins], ['Derrotas', s.losses],
    ['Aproveitamento', s.pct == null ? '—' : `${s.pct}%`], ['Maior sequência', s.best_streak], ['Eventos', s.events],
  ];
  tiles.forEach(([label, v], i) => {
    const x = 100 + (i % 2) * 450, y = 1010 + Math.floor(i / 2) * 175;
    ctx.fillStyle = C.soft; rr(ctx, x, y, 430, 150, 30); ctx.fill();
    txt(ctx, v, x + 215, y + 84, { size: 62, family: DISPLAY, color: C.teal, maxW: 390 });
    txt(ctx, label, x + 215, y + 126, { size: 26, weight: '800', color: C.muted, maxW: 390 });
  });
  if (trophies.length) {
    txt(ctx, 'Troféus', 540, 1585, { size: 28, weight: '800', color: C.muted });
    txt(ctx, trophies.slice(0, 5).map((t) => `${t.emoji || '🏆'} ${t.n}`).join('    '), 540, 1655, { size: 54, weight: '800', color: C.deep });
  } else txt(ctx, 'Ainda sem troféus.', 540, 1610, { size: 32, weight: '800', color: C.muted });
  return finish(canvas, ctx);
}

export async function trophyCard(p, t) {
  const { canvas, ctx } = await base('Troféu');
  ctx.fillStyle = C.tint; ctx.beginPath(); ctx.arc(540, 700, 190, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = C.leaf; ctx.stroke();
  txt(ctx, t.emoji || '🏆', 540, 700, { size: 190, base: 'middle', maxW: 320 });
  txt(ctx, 'TROFÉU', 540, 1010, { size: 32, weight: '800', color: C.forest });
  ctx.font = `72px ${DISPLAY}`;
  const lines = wrap(ctx, t.name, 860).slice(0, 2);
  lines.forEach((l, i) => txt(ctx, l, 540, 1110 + i * 84, { size: 72, family: DISPLAY, color: C.deep }));
  if (t.description) {
    ctx.font = `400 30px ${BODY}`;
    wrap(ctx, t.description, 820).slice(0, 3).forEach((l, i) => txt(ctx, l, 540, 1110 + (lines.length - 1) * 84 + 66 + i * 40, { size: 30, color: C.muted, maxW: 820 }));
  }
  await avatar(ctx, p, 540, 1470, 84);
  txt(ctx, p.name, 540, 1615, { size: 50, family: DISPLAY, color: C.teal });
  const meta = [t.last_date && day(t.last_date, { day: '2-digit', month: 'long', year: 'numeric' }), t.last_votes && `${t.last_votes} ${t.last_votes === 1 ? 'voto' : 'votos'}`, t.n > 1 && `${t.n} vezes`].filter(Boolean);
  if (meta.length) txt(ctx, meta.join(' · '), 540, 1668, { size: 28, weight: '800', color: C.muted });
  return finish(canvas, ctx);
}

export async function eventCard(s) {
  const { canvas, ctx } = await base('Resumo do evento');
  const title = day(s.event_date, { weekday: 'long', day: '2-digit', month: 'long' });
  txt(ctx, title.charAt(0).toUpperCase() + title.slice(1), 540, 520, { size: 58, family: DISPLAY, color: C.deep });
  txt(ctx, `${s.players} ${s.players === 1 ? 'jogador' : 'jogadores'} · ${s.matches.length} ${s.matches.length === 1 ? 'partida' : 'partidas'}`, 540, 572, { size: 30, weight: '800', color: C.muted });
  let y = 620;
  if (s.champion) {
    ctx.fillStyle = C.tint; rr(ctx, 100, y, 880, 230, 34); ctx.fill();
    txt(ctx, 'Time campeão', 540, y + 54, { size: 28, weight: '800', color: C.forest });
    txt(ctx, `${s.champion.name}: ${s.champion.wins} ${s.champion.wins === 1 ? 'vitória' : 'vitórias'}`, 540, y + 130, { size: 56, family: DISPLAY, color: C.deep, maxW: 820 });
    txt(ctx, s.champion.players.join(', '), 540, y + 192, { size: 28, color: C.muted, maxW: 820 });
    y += 280;
  }
  if (s.matches.length) {
    txt(ctx, 'Partidas', 540, y + 20, { size: 28, weight: '800', color: C.muted });
    y += 50;
    const win = { size: 32, weight: '800', color: C.forest, maxW: 330 };
    const lose = { size: 32, color: C.muted, maxW: 330 };
    const shown = s.matches.slice(0, 7);
    shown.forEach((m, i) => {
      const yy = y + i * 56 + 30;
      txt(ctx, m.a, 100, yy, { ...(m.a_won ? win : lose), align: 'left' });
      txt(ctx, `${m.score_a} x ${m.score_b}`, 540, yy, { size: 34, family: DISPLAY, color: C.deep, maxW: 160 });
      txt(ctx, m.b, 980, yy, { ...(m.a_won ? lose : win), align: 'right' });
    });
    y += shown.length * 56 + 30;
    if (s.matches.length > 7) { txt(ctx, `e mais ${s.matches.length - 7}`, 540, y, { size: 26, color: C.muted }); y += 30; }
  }
  const aw = s.awards.slice(0, 4);
  if (aw.length) {
    txt(ctx, 'Premiações', 540, y + 30, { size: 28, weight: '800', color: C.muted });
    aw.forEach((a, i) => txt(ctx, `${a.emoji || '🏆'} ${a.category}: ${a.winners.join(', ')}`, 540, y + 80 + i * 46, { size: 30, weight: '800', color: C.deep }));
  }
  return finish(canvas, ctx);
}

// Resultados das enquetes de um evento: foto, nome e troféu de cada categoria no mesmo card.
// items: [{ emoji, title, winners: [{ label, photo_url }] }]
export async function pollsCard({ date, items }) {
  const { canvas, ctx } = await base('Resultados das enquetes');
  const title = day(date, { weekday: 'long', day: '2-digit', month: 'long' });
  txt(ctx, title.charAt(0).toUpperCase() + title.slice(1), 540, 520, { size: 58, family: DISPLAY, color: C.deep });

  const shown = items.slice(0, 10);
  const top = 575, rh = Math.min(150, Math.floor((1690 - top) / Math.max(1, shown.length)));
  const r = Math.min(44, Math.floor((rh - 24) / 2));
  for (let i = 0; i < shown.length; i++) {
    const it = shown[i];
    const y = top + i * rh, cy = y + rh / 2;
    ctx.fillStyle = i % 2 ? '#fff' : C.soft; rr(ctx, 90, y + 4, 900, rh - 8, 24); ctx.fill();
    const ws = it.winners.slice(0, 2); // empate: mostra até 2 fotos
    for (let k = 0; k < ws.length; k++) {
      await avatar(ctx, { name: ws[k].label, photo_url: ws[k].photo_url }, 125 + r + k * (2 * r + 10), cy, r, 6);
    }
    const tx = 125 + ws.length * (2 * r + 10) + 14, maxW = 895 - tx;
    txt(ctx, `${it.emoji || '🏆'} ${it.title}`, tx, cy - 8, { size: 24, weight: '800', color: C.muted, align: 'left', maxW });
    txt(ctx, ws.map((w) => w.label).join(' e ') + (it.winners.length > 2 ? ' e mais' : ''), tx, cy + 32, { size: 38, family: DISPLAY, color: C.deep, align: 'left', maxW });
    txt(ctx, '🏆', 958, cy, { size: 44, align: 'right', base: 'middle', maxW: 60 });
  }
  return finish(canvas, ctx);
}

// Abre o compartilhamento do celular (WhatsApp, Instagram...) ou baixa a imagem.
export async function shareBlob(blob, name) {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w]+/g, '-').toLowerCase();
  const file = new File([blob], `volei-${slug}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: 'Vôlei Alamedas Jardins' }); return 'shared'; }
    catch (e) { if (e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file.name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}
