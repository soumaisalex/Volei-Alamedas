// Sorteio equilibrado de jogadores entre os times que já existem na fila (sem criar nem apagar times).
// Cada time cheio recebe 1 forte, 2 fracos e o resto do meio (times de 4: 2 fracos + 2 fortes; de 5: 2 fracos + 3 fortes).
// O time incompleto recebe 1 forte e o restante do meio. Quem sobra da capacidade fica sem time.

// Força no sorteio: parte da avaliação em estrelas e vai cedendo ao desempenho real conforme a pessoa joga.
// A estrela vale WEIGHT partidas "virtuais" (1★ = 20% ... 5★ = 80%); sem avaliação, 50%.
// A quadra livre não usa isto: ela segue só os dados do sistema (src/lab.js).
const WEIGHT = 12;
const PRIOR = [0.5, 0.2, 0.35, 0.5, 0.65, 0.8];
export const strength = (p) => (p.wins + WEIGHT * (PRIOR[p.rating] ?? 0.5)) / (p.matches + WEIGHT);

const shuffle = (a) => { const l = [...a]; for (let i = l.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]; } return l; };
const byPower = (a) => shuffle(a).sort((x, y) => strength(y) - strength(x)); // empates saem variados

// Tamanho de time mais comum entre os times montados (empate: o maior). 0 se não há time montado.
export function commonSize(counts) {
  const n = new Map();
  for (const c of counts.filter((x) => x > 0)) n.set(c, (n.get(c) ?? 0) + 1);
  let best = 0, times = 0;
  for (const [size, k] of n) if (k > times || (k === times && size > best)) { best = size; times = k; }
  return best;
}

// players: [{ id, wins, matches, free }]; teamIds: ids dos times na ordem da fila; size: jogadores por time.
// Retorna { teams: [{ team_id, player_ids }], leftover: [player_id] }.
export function planDraw(players, teamIds, size) {
  const cap = teamIds.length * size;
  // Se faltar vaga, ficam de fora primeiro os que já estavam sem time; depois, sorteados.
  const order = [...shuffle(players.filter((p) => p.free)), ...shuffle(players.filter((p) => !p.free))];
  const out = Math.max(0, players.length - cap);
  const leftover = order.slice(0, out).map((p) => p.id);
  const placed = order.slice(out);

  const P = placed.length, F = Math.floor(P / size), r = P % size, K = F + (r ? 1 : 0);
  const sorted = byPower(placed);
  const top = sorted.slice(0, K), rest = sorted.slice(K);
  const weakN = size >= 4 ? 2 * F : 0;
  const weak = weakN ? rest.slice(rest.length - weakN) : [];
  const mid = rest.slice(0, rest.length - weakN);

  // Vagas por time: [faixa, quantidade]. Time cheio: 1 forte, 2 fracos (se size >= 4) e o meio. Incompleto: 1 forte e o meio.
  const tiers = { top, weak, mid };
  const slots = [];
  for (let t = 0; t < K; t++) {
    const full = t < F;
    slots.push({ top: 1, weak: full && weakN ? 2 : 0, mid: full ? size - 1 - (weakN ? 2 : 0) : r - 1 });
  }
  const build = () => {
    const pools = Object.fromEntries(Object.entries(tiers).map(([k, v]) => [k, shuffle(v)]));
    return slots.map((s) => ({ top: pools.top.splice(0, s.top), weak: pools.weak.splice(0, s.weak), mid: pools.mid.splice(0, s.mid) }));
  };
  const sum = (t) => [...t.top, ...t.weak, ...t.mid].reduce((a, p) => a + strength(p), 0);
  const spread = (asg) => {
    const s = asg.slice(0, F).map(sum);
    return s.length > 1 ? Math.max(...s) - Math.min(...s) : 0;
  };

  let best = null;
  for (let run = 0; run < 12 && K > 1; run++) {
    const asg = build();
    let cur = spread(asg);
    for (let it = 0; it < 600; it++) {
      const tier = ['top', 'weak', 'mid'][Math.floor(Math.random() * 3)];
      const a = Math.floor(Math.random() * K), b = Math.floor(Math.random() * K);
      if (a === b || !asg[a][tier].length || !asg[b][tier].length) continue;
      const i = Math.floor(Math.random() * asg[a][tier].length), j = Math.floor(Math.random() * asg[b][tier].length);
      [asg[a][tier][i], asg[b][tier][j]] = [asg[b][tier][j], asg[a][tier][i]];
      const next = spread(asg);
      if (next <= cur) cur = next; else [asg[a][tier][i], asg[b][tier][j]] = [asg[b][tier][j], asg[a][tier][i]];
    }
    if (!best || cur < best.cur) best = { cur, asg };
  }
  const asg = best ? best.asg : build();
  const teams = teamIds.map((id, t) => ({ team_id: id, player_ids: asg[t] ? [...asg[t].top, ...asg[t].weak, ...asg[t].mid].map((p) => p.id) : [] }));
  return { teams, leftover };
}
