// Cards compartilháveis (PNG 1080x1350), desenhados no navegador com a identidade da logo.
const W = 1080, H = 1350;
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
  [[960, 110, 220], [70, 1190, 260], [1010, 1010, 140]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1;

  const logo = await loadImg('/logo.png');
  ctx.fillStyle = '#fff'; rr(ctx, 60, 56, 190, 220, 36); ctx.fill();
  if (logo) { const h = 196, w = (h * logo.width) / logo.height; ctx.drawImage(logo, 60 + (190 - w) / 2, 68, w, h); }
  txt(ctx, 'Vôlei Alamedas', 285, 140, { size: 50, family: DISPLAY, color: '#fff', align: 'left', maxW: 740 });
  txt(ctx, 'Jardins · desde 2025', 285, 192, { size: 34, weight: '800', color: C.tint, align: 'left', maxW: 740 });
  txt(ctx, subtitle, 285, 246, { size: 30, weight: '800', color: '#fff', align: 'left', maxW: 740 });

  ctx.fillStyle = '#fff'; rr(ctx, 60, 320, 960, 930, 48); ctx.fill();
  return { canvas, ctx };
}

async function avatar(ctx, p, cx, cy, r) {
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
  ctx.lineWidth = 12; ctx.strokeStyle = C.leaf;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

function finish(canvas, ctx) {
  txt(ctx, 'Vôlei Alamedas Jardins', 540, 1305, { size: 28, weight: '800', color: C.tint });
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('Falha ao gerar a imagem.'))), 'image/png'));
}

export async function playerCard({ player: p, stats: s, trophies }) {
  const { canvas, ctx } = await base('Card do jogador');
  await avatar(ctx, p, 540, 505, 150);
  txt(ctx, p.name, 540, 748, { size: 64, family: DISPLAY, color: C.deep });
  const tiles = [
    ['Partidas', s.matches], ['Vitórias', s.wins], ['Derrotas', s.losses],
    ['Aproveitamento', s.pct == null ? '—' : `${s.pct}%`], ['Maior sequência', s.best_streak], ['Eventos', s.events],
  ];
  tiles.forEach(([label, v], i) => {
    const x = 100 + (i % 3) * 300, y = 800 + Math.floor(i / 3) * 135;
    ctx.fillStyle = C.soft; rr(ctx, x, y, 280, 118, 26); ctx.fill();
    txt(ctx, v, x + 140, y + 66, { size: 52, family: DISPLAY, color: C.teal, maxW: 250 });
    txt(ctx, label, x + 140, y + 102, { size: 24, weight: '800', color: C.muted, maxW: 250 });
  });
  if (trophies.length) {
    txt(ctx, 'Troféus', 540, 1108, { size: 26, weight: '800', color: C.muted });
    txt(ctx, trophies.slice(0, 5).map((t) => `${t.emoji || '🏆'} ${t.n}`).join('    '), 540, 1172, { size: 50, weight: '800', color: C.deep });
  } else txt(ctx, 'Ainda sem troféus.', 540, 1150, { size: 30, weight: '800', color: C.muted });
  return finish(canvas, ctx);
}

export async function trophyCard(p, t) {
  const { canvas, ctx } = await base('Troféu');
  ctx.fillStyle = C.tint; ctx.beginPath(); ctx.arc(540, 480, 150, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 12; ctx.strokeStyle = C.leaf; ctx.stroke();
  txt(ctx, t.emoji || '🏆', 540, 480, { size: 150, base: 'middle', maxW: 260 });
  txt(ctx, 'TROFÉU', 540, 690, { size: 30, weight: '800', color: C.forest });
  ctx.font = `66px ${DISPLAY}`;
  const lines = wrap(ctx, t.name, 860).slice(0, 2);
  lines.forEach((l, i) => txt(ctx, l, 540, 775 + i * 76, { size: 66, family: DISPLAY, color: C.deep }));
  if (t.description) {
    ctx.font = `400 28px ${BODY}`;
    wrap(ctx, t.description, 820).slice(0, 2).forEach((l, i) => txt(ctx, l, 540, 775 + (lines.length - 1) * 76 + 58 + i * 36, { size: 28, color: C.muted, maxW: 820 }));
  }
  await avatar(ctx, p, 540, 1058, 66);
  txt(ctx, p.name, 540, 1182, { size: 46, family: DISPLAY, color: C.teal });
  const meta = [t.last_date && day(t.last_date, { day: '2-digit', month: 'long', year: 'numeric' }), t.last_votes && `${t.last_votes} ${t.last_votes === 1 ? 'voto' : 'votos'}`, t.n > 1 && `${t.n} vezes`].filter(Boolean);
  if (meta.length) txt(ctx, meta.join(' · '), 540, 1226, { size: 26, weight: '800', color: C.muted });
  return finish(canvas, ctx);
}

export async function eventCard(s) {
  const { canvas, ctx } = await base('Resumo do evento');
  const title = day(s.event_date, { weekday: 'long', day: '2-digit', month: 'long' });
  txt(ctx, title.charAt(0).toUpperCase() + title.slice(1), 540, 405, { size: 54, family: DISPLAY, color: C.deep });
  txt(ctx, `${s.players} ${s.players === 1 ? 'jogador' : 'jogadores'} · ${s.matches.length} ${s.matches.length === 1 ? 'partida' : 'partidas'}`, 540, 452, { size: 28, weight: '800', color: C.muted });
  let y = 490;
  if (s.champion) {
    ctx.fillStyle = C.tint; rr(ctx, 100, y, 880, 190, 30); ctx.fill();
    txt(ctx, 'Time campeão', 540, y + 46, { size: 26, weight: '800', color: C.forest });
    txt(ctx, `${s.champion.name}: ${s.champion.wins} ${s.champion.wins === 1 ? 'vitória' : 'vitórias'}`, 540, y + 108, { size: 52, family: DISPLAY, color: C.deep, maxW: 840 });
    txt(ctx, s.champion.players.join(', '), 540, y + 158, { size: 28, color: C.muted, maxW: 840 });
    y += 230;
  }
  if (s.matches.length) {
    txt(ctx, 'Partidas', 540, y + 20, { size: 26, weight: '800', color: C.muted });
    y += 50;
    const win = { size: 30, weight: '800', color: C.forest, maxW: 330 };
    const lose = { size: 30, color: C.muted, maxW: 330 };
    s.matches.slice(0, 5).forEach((m, i) => {
      const yy = y + i * 50 + 30;
      txt(ctx, m.a, 100, yy, { ...(m.a_won ? win : lose), align: 'left' });
      txt(ctx, `${m.score_a} x ${m.score_b}`, 540, yy, { size: 32, family: DISPLAY, color: C.deep, maxW: 160 });
      txt(ctx, m.b, 980, yy, { ...(m.a_won ? lose : win), align: 'right' });
    });
    y += Math.min(5, s.matches.length) * 50 + 30;
    if (s.matches.length > 5) { txt(ctx, `e mais ${s.matches.length - 5}`, 540, y, { size: 24, color: C.muted }); y += 30; }
  }
  s.awards.slice(0, 3).forEach((a, i) =>
    txt(ctx, `${a.emoji || '🏆'} ${a.category}: ${a.winners.join(', ')}`, 540, y + 40 + i * 42, { size: 28, weight: '800', color: C.deep }));
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
