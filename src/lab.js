// Quadra de vôlei vertical (9 m x 18 m, 40 px por metro). Linha A em cima, linha B embaixo.
export const COURT = { w: 360, h: 720 };
const FRONT = 290, BACK = 130; // fileira da frente (zona de ataque, a 3 m da rede) e de trás
const FORMATIONS = {
  3: [[110, FRONT], [250, FRONT], [180, BACK]],
  4: [[110, FRONT], [250, FRONT], [110, BACK], [250, BACK]],
  5: [[110, FRONT], [250, FRONT], [60, BACK], [180, BACK], [300, BACK]],
  6: [[60, FRONT], [180, FRONT], [300, FRONT], [60, BACK], [180, BACK], [300, BACK]],
};
// Posições (x, y) de cada vaga: primeiro a fileira da frente (esquerda para a direita), depois a de trás.
// Na linha B o nome fica abaixo da foto (longe da rede), então a fileira da frente sobe um pouco
// para o nome não encostar na linha de ataque a 3 m.
const B_FRONT = 408;
export const positions = (size, side) =>
  FORMATIONS[size].map(([x, y]) => [x, side === 'a' ? y : y === FRONT ? B_FRONT : COURT.h - y]);

// Força suavizada: puxa para 50% quem jogou pouco, para poucas partidas não decidirem sozinhas.
export const strength = (p) => (p.wins + 1.5) / (p.matches + 3);

// Divide os jogadores (quantidade par) em duas linhas com a menor diferença de força somada.
export function balance(players) {
  const list = [...players].sort(() => Math.random() - 0.5); // empates saem variados a cada toque
  const k = list.length, n = k / 2;
  const total = list.reduce((t, p) => t + strength(p), 0);
  let best = null;
  const pick = (start, chosen, sum) => {
    if (chosen.length === n) {
      const diff = Math.abs(total - 2 * sum);
      if (!best || diff < best.diff - 1e-9) best = { diff, set: [...chosen] };
      return;
    }
    for (let i = start; i < k; i++) {
      if (!chosen.length && i > 0) break; // o 1º jogador sempre fica na linha A (evita repetir a mesma divisão)
      chosen.push(i); pick(i + 1, chosen, sum + strength(list[i])); chosen.pop();
    }
  };
  pick(0, [], 0);
  const inA = new Set(best.set);
  const byStrength = (x, y) => strength(y) - strength(x);
  return [list.filter((_, i) => inA.has(i)).sort(byStrength), list.filter((_, i) => !inA.has(i)).sort(byStrength)];
}

// Números de uma linha para a comparação.
export function lineStats(list) {
  const sum = (k) => list.reduce((t, p) => t + p[k], 0);
  const played = list.filter((p) => p.matches > 0);
  return {
    count: list.length,
    pct: played.length ? Math.round(played.reduce((t, p) => t + p.pct, 0) / played.length) : null,
    wins: sum('wins'),
    matches: sum('matches'),
    events: list.length ? Math.round((sum('events') / list.length) * 10) / 10 : 0,
    streak: list.reduce((m, p) => Math.max(m, p.best_streak), 0),
    trophies: sum('trophy_total'),
  };
}
