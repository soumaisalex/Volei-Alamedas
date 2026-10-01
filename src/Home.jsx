import { useCallback, useEffect, useState } from 'react';
import ThemeButton from './ThemeButton.jsx';
import { EventCards } from './Events.jsx';
import Confirm from './Confirm.jsx';
import Person from './Person.jsx';
import { OPEN, STATUS, fmtDate, today, Face, pickCurrent } from './shared.jsx';

// Ações sobre uma pessoa que está na quadra.
function PresentSheet({ p, ops, onLeave, onRemove, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={p.name} onClick={(e) => e.stopPropagation()}>
        <div className="row"><Face p={p} /><strong className="grow">{p.name}</strong></div>
        <button className="btn" onClick={onLeave}>Marcar saída</button>
        {ops && (
          <>
            <p className="muted">Para quem fez check-in sem estar na quadra: apaga o check-in e impede um novo neste evento. Quem já entrou em partidas não pode ser removido.</p>
            <button className="btn danger" onClick={onRemove}>Remover do evento</button>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
    </div>
  );
}

export default function Home({ api, user, onLogout, onOpenEvent }) {
  const [events, setEvents] = useState(null);
  const [here, setHere] = useState([]);
  const [players, setPlayers] = useState([]);
  const [panel, setPanel] = useState(null);
  const [size, setSize] = useState(4);
  const [reason, setReason] = useState('');
  const [newEv, setNewEv] = useState({ date: '', title: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [ask, setAsk] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [blocked, setBlocked] = useState([]);
  const askOk = (title, text, label, run, danger) => setAsk({ title, text, label, run, danger });
  const ops = user.role === 'admin' || user.role === 'operator';
  const cur = events ? pickCurrent(events) : null;
  const later = (events || []).filter((e) => OPEN.includes(e.status) && e !== cur).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = (events || []).filter((e) => !OPEN.includes(e.status));

  const load = useCallback(async () => {
    const list = await api('/events');
    setEvents(list);
    const c = pickCurrent(list);
    const liveNow = c && c.status === 'in_progress';
    setHere(liveNow ? await api(`/events/${c.id}/checkins`) : []);
    setBlocked(liveNow && ops ? await api(`/events/${c.id}/blocks`) : []);
  }, [api, ops]);
  useEffect(() => { load().catch((e) => setErr(e.message)); api('/players').then(setPlayers).catch(() => {}); }, [load, api]);

  const act = async (action, body) => {
    setErr(''); setOk('');
    try { await api(`/events/${cur.id}/${action}`, { body: body || {} }); setPanel(null); await load(); }
    catch (e) { setErr(e.message); }
  };
  const createEvent = async () => {
    setErr(''); setOk('');
    try {
      await api('/events', { body: { event_date: newEv.date, title: newEv.title.trim() || null } });
      setNewEv({ date: '', title: '' }); setOk('Evento criado.'); await load();
    } catch (e) { setErr(e.message); }
  };
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }); onLogout(); };

  const present = here.filter((p) => !p.left_at);
  const presentIds = new Set(present.map((p) => p.id));
  const blockedIds = new Set(blocked.map((p) => p.id));
  const live = cur?.status === 'in_progress';

  return (
    <main className="screen">
      <header className="top">
        <div className="row"><img className="logo mini" src="/logo.png" alt="Vôlei Alamedas Jardins" /><div><small className="muted">Olá,</small><h2>{user.name.split(' ')[0]}</h2></div></div>
        <div className="row"><ThemeButton /><button className="btn ghost small" onClick={logout}>Sair</button></div>
      </header>
      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p className="muted" role="status">{ok}</p>}
      {!events && <p className="muted">Carregando…</p>}
      {events && !cur && <p className="muted">Nenhum evento agendado.{user.role === 'admin' ? ' Crie um abaixo.' : ''}</p>}

      {cur && (
        <section className="card hero">
          <p className="pill">{STATUS[cur.status]}</p>
          <h1>{fmtDate(cur.event_date)}</h1>
          {cur.title && <p className="big">{cur.title}</p>}
          {live && <p className="big">{cur.present} {cur.present === 1 ? 'pessoa aqui' : 'pessoas aqui'}{cur.team_size ? ` · times de ${cur.team_size}` : ''}</p>}
          {live ? (
            <>
              {cur.me_in
                ? <button className="btn ghost" onClick={() => askOk('Sair da quadra?', 'Você será marcado como fora da quadra. Se estiver em um time, ele pode ser desfeito quando 2 ou mais pessoas saírem.', 'Sim, saí', () => act('leave'), true)}>Saí da quadra</button>
                : <button className="btn primary" onClick={() => askOk('Fazer check-in?', 'Você será marcado como presente neste evento.', 'Fazer check-in', () => act('checkin'))}>Estou aqui</button>}
              <button className="btn" onClick={() => setPanel(panel === 'others' ? null : 'others')}>Marcar outra pessoa</button>
            </>
          ) : <p className="muted">O check-in abre quando um operador iniciar o evento.</p>}
          {ops && !live && <button className="btn" onClick={() => setPanel(panel === 'start' ? null : 'start')}>Iniciar evento e abrir check-in</button>}
          {ops && live && <button className="btn" onClick={() => askOk('Encerrar o evento?', 'O evento termina e as votações das enquetes abrem por 24 horas. Não será possível continuar as partidas.', 'Encerrar evento', () => act('finish'), true)}>Encerrar evento</button>}
          {user.role === 'admin' && <button className="btn danger" onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}>Cancelar evento</button>}
        </section>
      )}

      {panel === 'others' && (
        <div className="pick-grid">
          {players.filter((p) => !presentIds.has(p.id) && !blockedIds.has(p.id)).map((p) => (
            <Person key={p.id} name={p.name} photo_url={p.photo_url} onClick={() => askOk(`Fazer check-in de ${p.name}?`, 'Use só para quem está na quadra e está sem o celular.', 'Fazer check-in', () => act('checkin', { player_id: p.id }))} />
          ))}
        </div>
      )}
      {panel === 'start' && (
        <div className="card stack">
          <p>Quantos jogadores por time?</p>
          <div className="stepper">
            <button className="btn" aria-label="Menos um" onClick={() => setSize(Math.max(2, size - 1))}>−</button>
            <strong>{size}</strong>
            <button className="btn" aria-label="Mais um" onClick={() => setSize(Math.min(6, size + 1))}>+</button>
          </div>
          <button className="btn primary" onClick={() => askOk('Iniciar o evento?', `Os times serão de ${size} jogadores e o check-in será aberto para todos.`, 'Iniciar evento', () => act('start', { team_size: size }))}>Começar</button>
        </div>
      )}
      {panel === 'cancel' && (
        <div className="card stack">
          <p>Por que o evento foi cancelado?</p>
          <div className="chips">{['Chuva', 'Quadra ocupada', 'Poucas pessoas'].map((r) => <button key={r} className="chip" onClick={() => setReason(r)}>{r}</button>)}</div>
          <input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn danger" disabled={reason.trim().length < 3} onClick={() => act('cancel', { reason })}>Confirmar cancelamento</button>
        </div>
      )}

      {live && (
        <section>
          <h3>Na quadra agora</h3>
          {!present.length && <p className="muted">Ninguém fez check-in ainda. Toque em “Estou aqui”.</p>}
          <div className="pick-grid">
            {present.map((p) => <Person key={p.id} name={p.name} photo_url={p.photo_url} onClick={() => setSheet(p)} />)}
          </div>
          {!!present.length && <p className="muted">Toque numa pessoa para marcar a saída{ops ? ' ou removê-la do evento' : ''}.</p>}
          {ops && !!blocked.length && (
            <>
              <h3>Bloqueados neste evento</h3>
              <div className="stack">
                {blocked.map((p) => (
                  <div key={p.id} className="card row"><Face p={p} /><span className="grow">{p.name}</span>
                    <button className="btn ghost small" onClick={() => askOk(`Liberar o check-in de ${p.name}?`, 'A pessoa poderá fazer check-in de novo neste evento.', 'Liberar', () => act('unblock', { player_id: p.id }))}>Liberar</button></div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <EventCards title="Próximos eventos" events={later} onOpen={onOpenEvent} />

      {user.role === 'admin' && (
        <details className="card">
          <summary><span className="grow">Novo evento</span></summary>
          <div className="stack">
            <input type="date" min={today()} aria-label="Data do evento" value={newEv.date} onChange={(e) => setNewEv({ ...newEv, date: e.target.value })} />
            <input placeholder="Nome (opcional). Ex.: Sábado extra" maxLength={60} value={newEv.title} onChange={(e) => setNewEv({ ...newEv, title: e.target.value })} />
            <button className="btn primary" disabled={!newEv.date} onClick={createEvent}>Criar evento</button>
          </div>
        </details>
      )}

      <EventCards title="Eventos anteriores" events={past} onOpen={onOpenEvent} />
      {sheet && (
        <PresentSheet p={sheet} ops={ops} onClose={() => setSheet(null)}
          onLeave={() => { const p = sheet; setSheet(null); askOk(`Marcar a saída de ${p.name}?`, 'A pessoa será marcada como fora da quadra. Se estiver em um time, ele pode ser desfeito quando 2 ou mais pessoas saírem.', 'Marcar saída', () => act('leave', { player_id: p.id }), true); }}
          onRemove={() => { const p = sheet; setSheet(null); askOk(`Remover ${p.name} do evento?`, 'O check-in será apagado e a pessoa não poderá fazer check-in de novo neste evento.', 'Remover e bloquear', () => act('block', { player_id: p.id }), true); }} />
      )}
      {ask && <Confirm {...ask} onCancel={() => setAsk(null)} onOk={async () => { const run = ask.run; setAsk(null); await run(); }} />}
    </main>
  );
}
