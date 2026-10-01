import { useCallback, useEffect, useRef, useState } from 'react';
import { nameSize } from './Person.jsx';
import { DndContext, DragOverlay, MouseSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core';

const OPEN = ['scheduled', 'checkin_open', 'in_progress'];
const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" draggable={false} /> : <span className="avatar">{p.name[0]}</span>);

function Player({ p, disabled, onPick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: p.id, disabled });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onContextMenu={(e) => e.preventDefault()} onClick={disabled ? undefined : () => onPick?.(p)} className={`player pick${p.left ? ' gone' : ''}${isDragging ? ' lift' : ''}`}>
      <Face p={p} /><span className="nm" style={{ fontSize: nameSize(p.name) }}>{p.name}</span>{p.left && <small className="muted">saiu</small>}
    </div>
  );
}

function Zone({ id, className, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return <div ref={setNodeRef} className={`${className}${isOver ? ' over' : ''}`}>{children}</div>;
}

function Team({ t, size, ops, canRename, onRename, onPick, children }) {
  const [name, setName] = useState(null);
  const filled = t.members.filter((m) => !m.left).length;
  return (
    <Zone id={t.id} className="team">
      <div className="qhead">
        {name === null ? (
          <>
            <strong className="grow">{t.name}</strong>
            {canRename && <button className="chip" aria-label={`Renomear ${t.name}`} onClick={() => setName(t.name)}>Nomear</button>}
          </>
        ) : (
          <>
            <input className="grow" value={name} maxLength={30} autoFocus aria-label="Nome do time" onChange={(e) => setName(e.target.value)} />
            <button className="chip" disabled={!name.trim()} onClick={() => { onRename(t.id, name); setName(null); }}>Salvar</button>
          </>
        )}
        <span className="pill">{filled}/{size}</span>
      </div>
      <div className="members">
        {t.members.map((m) => <Player key={m.id} p={m} disabled={!ops} onPick={onPick} />)}
        {!t.members.length && <p className="muted">Time vazio. Solte jogadores aqui.</p>}
      </div>
      {children}
    </Zone>
  );
}

const Step = ({ v, set }) => (
  <div className="stepper">
    <button className="btn" aria-label="Menos um" onClick={() => set(Math.max(0, v - 1))}>−</button>
    <strong>{v}</strong>
    <button className="btn" aria-label="Mais um" onClick={() => set(v + 1)}>+</button>
  </div>
);

// Alternativa ao arrastar: toque no jogador e escolha o destino.
function MoveSheet({ p, teams, size, onMove, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const current = teams.find((t) => t.members.some((m) => m.id === p.id));
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Mover ${p.name}`} onClick={(e) => e.stopPropagation()}>
        <h3>Mover {p.name}</h3>
        <div className="stack">
          {teams.map((t) => {
            const filled = t.members.filter((m) => !m.left).length;
            const here = current?.id === t.id;
            const full = filled >= size && !here;
            return (
              <button key={t.id} className="btn" disabled={here || full} onClick={() => onMove(t.id)}>
                {t.name} ({filled}/{size}){here ? ' (atual)' : full ? ' (completo)' : ''}
              </button>
            );
          })}
          <button className="btn primary" onClick={() => onMove('new')}>Novo time com {p.name.split(' ')[0]}</button>
          {current && <button className="btn ghost" onClick={() => onMove(null)}>Tirar do time (sem time)</button>}
        </div>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

export default function Court({ api, user }) {
  const ops = user.role === 'admin' || user.role === 'operator';
  const [eid, setEid] = useState(null);
  const [data, setData] = useState(null);
  const [idle, setIdle] = useState('');
  const [err, setErr] = useState('');
  const [active, setActive] = useState(null);
  const [fin, setFin] = useState(null);
  const [moving, setMoving] = useState(null);
  const lastDrag = useRef(0); // evita tratar o fim de um arrasto como toque
  const busy = useRef(false); // pausa a atualização automática enquanto arrasta ou digita o placar final
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const load = useCallback(async () => {
    if (busy.current) return;
    const list = await api('/events');
    const live = list.find((e) => e.status === 'in_progress');
    const cur = live ?? list.find((e) => OPEN.includes(e.status));
    if (!live) {
      setData(null);
      setIdle(cur ? 'Inicie o evento na tela Início para montar os times.' : 'Não há evento aberto.');
      return;
    }
    setIdle(''); setEid(cur.id);
    setData(await api(`/events/${cur.id}/court/state`));
  }, [api]);

  useEffect(() => {
    load().catch((e) => setErr(e.message));
    const t = setInterval(() => load().catch(() => {}), 6000); // vários celulares na quadra
    return () => clearInterval(t);
  }, [load]);

  const run = async (action, body) => {
    setErr('');
    try { await api(`/events/${eid}/court/${action}`, { body: body || {} }); setFin(null); }
    catch (e) { setErr(e.message); }
    busy.current = false;
    await load().catch(() => {});
  };
  const rename = (team_id, name) => run('team-rename', { team_id, name });
  const closeMove = () => { busy.current = false; setMoving(null); };
  const openMove = (p) => { if (Date.now() - lastDrag.current < 400) return; busy.current = true; setMoving(p); };
  const moveTo = async (dest) => {
    const p = moving;
    closeMove(); setErr('');
    if (dest !== 'new') { await run('assign', { player_id: p.id, team_id: dest }); return; }
    try {
      const r = await api(`/events/${eid}/court/team-create`, { body: {} });
      await api(`/events/${eid}/court/assign`, { body: { player_id: p.id, team_id: r.id } });
    } catch (e) { setErr(e.message); }
    await load().catch(() => {});
  };

  if (idle) return <main className="screen"><h2>Quadra</h2><p className="muted">{idle}</p></main>;
  if (!data) return <main className="screen"><p className="muted">Carregando…</p>{err && <p className="err">{err}</p>}</main>;

  const { event, teams, free, match, recent } = data;
  const size = event.team_size;
  const byId = Object.fromEntries(teams.map((t) => [t.id, t]));
  const queue = teams.filter((t) => t.queue_pos != null);
  const sides = match ? [byId[match.team_a_id], byId[match.team_b_id]] : [];
  const next = queue.slice(0, 2);
  const canStart = next.length === 2 && next.every((t) => t.status === 'active');
  const dragged = [...free, ...teams.flatMap((t) => t.members)].find((p) => p.id === active);
  const short = next.filter((t) => t.members.filter((m) => !m.left).length < size);

  return (
    <main className="screen">
      <h2>Quadra</h2>
      {err && <p className="err" role="alert">{err}</p>}
      <DndContext
        sensors={sensors}
        onDragStart={({ active: a }) => { busy.current = true; setActive(a.id); }}
        onDragCancel={() => { lastDrag.current = Date.now(); busy.current = false; setActive(null); }}
        onDragEnd={({ active: a, over }) => {
          lastDrag.current = Date.now();
          setActive(null);
          if (over) run('assign', { player_id: a.id, team_id: over.id === 'free' ? null : over.id });
          else busy.current = false;
        }}
      >
        <section>
          <h3>Em quadra</h3>
          {match ? (
            <div className="versus">
              {sides.map((t, i) => {
                const key = i ? 'b' : 'a';
                return (
                  <Team key={t.id} t={t} size={size} ops={false} canRename={ops} onRename={rename}>
                    <div className="score">
                      {ops ? <button className="btn" aria-label="Menos um ponto" onClick={() => run('match-score', { side: key, delta: -1 })}>−</button> : <span />}
                      <strong>{match[`score_${key}`]}</strong>
                      {ops ? <button className="btn primary" aria-label="Mais um ponto" onClick={() => run('match-score', { side: key, delta: 1 })}>+1</button> : <span />}
                    </div>
                  </Team>
                );
              })}
              <p className="muted">Meta de {match.points_target} pontos. O placar ponto a ponto é opcional; o resultado final você confirma ao encerrar.</p>
              {ops && !fin && (
                <button className="btn primary" onClick={() => { busy.current = true; setFin({ a: match.score_a, b: match.score_b }); }}>Encerrar partida</button>
              )}
              {ops && fin && (
                <div className="card stack">
                  <p className="big">Placar final</p>
                  <small>{sides[0].name}</small><Step v={fin.a} set={(a) => setFin({ ...fin, a })} />
                  <small>{sides[1].name}</small><Step v={fin.b} set={(b) => setFin({ ...fin, b })} />
                  <button className="btn primary" disabled={fin.a === fin.b} onClick={() => run('match-finish', { score_a: fin.a, score_b: fin.b })}>Confirmar resultado</button>
                  <button className="btn ghost" onClick={() => { busy.current = false; setFin(null); }}>Voltar</button>
                </div>
              )}
            </div>
          ) : (
            <div className="card stack">
              {next.length === 2
                ? <p className="big">{next[0].name} x {next[1].name}</p>
                : <p className="muted">Monte pelo menos 2 times para começar.</p>}
              {!!short.length && <p className="muted">{short.map((t) => `${t.name} está incompleto`).join('. ')}. Dá para começar assim mesmo.</p>}
              {ops && <button className="btn primary" disabled={!canStart} onClick={() => run('match-start')}>Começar partida</button>}
            </div>
          )}
        </section>

        <section>
          <h3>Fila (linha-fora)</h3>
          <div className="stack">
            {queue.map((t, i) => (
              <Team key={t.id} t={t} size={size} ops={ops} canRename={ops} onRename={rename} onPick={openMove}>
                <div className="qhead">
                  <span className="pill">{i + 1}º na fila</span>
                  <small className="muted grow">{!match && i < 2 ? 'joga a seguir' : ''}</small>
                  {ops && (
                    <div className="arrows">
                      {!t.members.length && <button className="btn ghost small" onClick={() => run('team-remove', { team_id: t.id })}>Remover</button>}
                      <button className="btn ghost" disabled={i === 0} aria-label="Subir na fila" onClick={() => run('move', { team_id: t.id, dir: -1 })}>↑</button>
                      <button className="btn ghost" disabled={i === queue.length - 1} aria-label="Descer na fila" onClick={() => run('move', { team_id: t.id, dir: 1 })}>↓</button>
                    </div>
                  )}
                </div>
              </Team>
            ))}
            {!queue.length && <p className="muted">Nenhum time na fila. Toque em “Novo time”.</p>}
            {ops && <button className="btn" onClick={() => run('team-create')}>Novo time</button>}
          </div>
        </section>

        <section>
          <h3>Sem time</h3>
          <Zone id="free" className="free">
            {free.map((p) => <Player key={p.id} p={p} disabled={!ops} onPick={openMove} />)}
            {!free.length && <p className="muted">Todo mundo com check-in já está em um time.</p>}
          </Zone>
        </section>

        <DragOverlay>{dragged ? <div className="player pick lift" style={{ width: '7rem' }}><Face p={dragged} /><span className="nm" style={{ fontSize: nameSize(dragged.name) }}>{dragged.name}</span></div> : null}</DragOverlay>
      </DndContext>

      {!!recent.length && (
        <section>
          <h3>Últimas partidas</h3>
          <div className="stack">
            {recent.map((r) => (
              <div key={r.seq} className="card">
                <strong>{r.a_won ? r.a : r.b}</strong> venceu {r.a_won ? r.b : r.a} por {Math.max(r.score_a, r.score_b)} a {Math.min(r.score_a, r.score_b)}
              </div>
            ))}
          </div>
        </section>
      )}
      {moving && <MoveSheet p={moving} teams={queue} size={size} onMove={moveTo} onClose={closeMove} />}
    </main>
  );
}
