import { useCallback, useEffect, useState } from 'react';
import ThemeButton from './ThemeButton.jsx';
import { EventCards } from './Events.jsx';
import { OPEN, STATUS, fmtDate, today, Face, pickCurrent } from './shared.jsx';

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
  const ops = user.role === 'admin' || user.role === 'operator';
  const cur = events ? pickCurrent(events) : null;
  const later = (events || []).filter((e) => OPEN.includes(e.status) && e !== cur).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = (events || []).filter((e) => !OPEN.includes(e.status));

  const load = useCallback(async () => {
    const list = await api('/events');
    setEvents(list);
    const c = pickCurrent(list);
    setHere(c && c.status === 'in_progress' ? await api(`/events/${c.id}/checkins`) : []);
  }, [api]);
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
                ? <button className="btn ghost" onClick={() => act('leave')}>Saí da quadra</button>
                : <button className="btn primary" onClick={() => act('checkin')}>Estou aqui</button>}
              <button className="btn" onClick={() => setPanel(panel === 'others' ? null : 'others')}>Marcar outra pessoa</button>
            </>
          ) : <p className="muted">O check-in abre quando um operador iniciar o evento.</p>}
          {ops && !live && <button className="btn" onClick={() => setPanel(panel === 'start' ? null : 'start')}>Iniciar evento e abrir check-in</button>}
          {ops && live && <button className="btn" onClick={() => act('finish')}>Encerrar evento</button>}
          {user.role === 'admin' && <button className="btn danger" onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}>Cancelar evento</button>}
        </section>
      )}

      {panel === 'others' && (
        <div className="stack">
          {players.filter((p) => !presentIds.has(p.id)).map((p) => (
            <button key={p.id} className="card row" onClick={() => act('checkin', { player_id: p.id })}><Face p={p} /><span className="grow">{p.name}</span></button>
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
          <button className="btn primary" onClick={() => act('start', { team_size: size })}>Começar</button>
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
          <div className="stack">
            {present.map((p) => (
              <div key={p.id} className="card row"><Face p={p} /><span className="grow">{p.name}</span>
                <button className="btn ghost small" onClick={() => act('leave', { player_id: p.id })}>Saiu</button></div>
            ))}
          </div>
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
    </main>
  );
}
