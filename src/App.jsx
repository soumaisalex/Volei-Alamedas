import { useCallback, useEffect, useState } from 'react';
import Court from './Court.jsx';
import Admin from './Admin.jsx';

const OPEN = ['scheduled', 'checkin_open', 'in_progress'];
const STATUS = { finished: 'Encerrado', cancelled: 'Cancelado', in_progress: 'Em andamento', scheduled: 'Agendado', checkin_open: 'Check-in aberto' };

async function api(path, { body, method } = {}) {
  const res = await fetch('/api' + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Algo deu errado.');
  return data;
}

const maskPhone = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length > 6) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length > 2) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return d ? `(${d}` : '';
};
const fmtDate = (d) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

function Avatar({ p }) {
  return p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>;
}

function Auth({ onDone }) {
  const [mode, setMode] = useState('entrar');
  const [players, setPlayers] = useState([]);
  const [q, setQ] = useState('');
  const [pick, setPick] = useState(null);
  const [last4, setLast4] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { api('/players').then(setPlayers).catch((e) => setErr(e.message)); }, []);
  const run = async (fn) => { setErr(''); try { await fn(); onDone(); } catch (e) { setErr(e.message); } };
  const shown = players.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <main className="screen">
      <img className="logo" src="/logo.png" alt="Vôlei Alamedas Jardins" />
      <div className="tabs">
        <button className={mode === 'entrar' ? 'on' : ''} onClick={() => setMode('entrar')}>Já tenho cadastro</button>
        <button className={mode === 'cadastrar' ? 'on' : ''} onClick={() => setMode('cadastrar')}>Primeira vez</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}

      {mode === 'entrar' && !pick && (
        <>
          <input placeholder="Buscar seu nome" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="stack">
            {shown.map((p) => (
              <button key={p.id} className="card row" onClick={() => setPick(p)}><Avatar p={p} />{p.name}</button>
            ))}
            {!shown.length && <p className="muted">Ninguém com esse nome. Toque em “Primeira vez” para se cadastrar.</p>}
          </div>
        </>
      )}
      {mode === 'entrar' && pick && (
        <div className="stack">
          <div className="card row"><Avatar p={pick} />{pick.name}</div>
          <input inputMode="numeric" maxLength={4} placeholder="4 últimos dígitos do celular" value={last4}
                 onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} />
          <button className="btn primary" disabled={last4.length !== 4}
                  onClick={() => run(() => api('/auth/login', { body: { player_id: pick.id, last4 } }))}>Entrar</button>
          <button className="btn ghost" onClick={() => { setPick(null); setLast4(''); }}>Não sou eu</button>
        </div>
      )}
      {mode === 'cadastrar' && (
        <div className="stack">
          <input placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} />
          <input inputMode="tel" placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
          <p className="muted">O celular é pedido para votar nas enquetes e editar seu perfil.</p>
          <button className="btn primary" disabled={name.trim().length < 2 || phone.length < 15}
                  onClick={() => run(() => api('/players', { body: { name, phone } }))}>Criar meu cadastro</button>
        </div>
      )}
    </main>
  );
}

function Home({ user, onLogout }) {
  const [events, setEvents] = useState(null);
  const [here, setHere] = useState([]);
  const [players, setPlayers] = useState([]);
  const [panel, setPanel] = useState(null);
  const [size, setSize] = useState(4);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const ops = user.role === 'admin' || user.role === 'operator';
  const cur = events?.find((e) => OPEN.includes(e.status));

  const load = useCallback(async () => {
    const list = await api('/events');
    setEvents(list);
    const c = list.find((e) => OPEN.includes(e.status));
    setHere(c ? await api(`/events/${c.id}/checkins`) : []);
  }, []);
  useEffect(() => { load().catch((e) => setErr(e.message)); api('/players').then(setPlayers).catch(() => {}); }, [load]);

  const act = async (action, body) => {
    setErr('');
    try { await api(`/events/${cur.id}/${action}`, { body: body || {} }); setPanel(null); await load(); }
    catch (e) { setErr(e.message); }
  };
  const logout = async () => { await api('/auth/logout', { method: 'POST', body: {} }); onLogout(); };

  const present = here.filter((p) => !p.left_at);
  const presentIds = new Set(present.map((p) => p.id));
  const past = (events || []).filter((e) => !OPEN.includes(e.status));

  return (
    <main className="screen">
      <header className="top">
        <div className="row"><img className="logo mini" src="/logo.png" alt="Vôlei Alamedas Jardins" /><div><small className="muted">Olá,</small><h2>{user.name.split(' ')[0]}</h2></div></div>
        <button className="btn ghost small" onClick={logout}>Sair</button>
      </header>
      {err && <p className="err" role="alert">{err}</p>}
      {!events && <p className="muted">Carregando…</p>}

      {cur && (
        <section className="card hero">
          <p className="pill">{STATUS[cur.status]}</p>
          <h1>{fmtDate(cur.event_date)}</h1>
          <p className="big">{cur.present} {cur.present === 1 ? 'pessoa aqui' : 'pessoas aqui'}{cur.team_size ? ` · times de ${cur.team_size}` : ''}</p>
          {cur.me_in
            ? <button className="btn ghost" onClick={() => act('leave')}>Saí da quadra</button>
            : <button className="btn primary" onClick={() => act('checkin')}>Estou aqui</button>}
          <button className="btn" onClick={() => setPanel(panel === 'others' ? null : 'others')}>Marcar outra pessoa</button>
          {ops && cur.status !== 'in_progress' && <button className="btn" onClick={() => setPanel(panel === 'start' ? null : 'start')}>Iniciar evento</button>}
          {ops && cur.status === 'in_progress' && <button className="btn" onClick={() => act('finish')}>Encerrar evento</button>}
          {user.role === 'admin' && <button className="btn danger" onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}>Cancelar evento</button>}
        </section>
      )}

      {panel === 'others' && (
        <div className="stack">
          {players.filter((p) => !presentIds.has(p.id)).map((p) => (
            <button key={p.id} className="card row" onClick={() => act('checkin', { player_id: p.id })}><Avatar p={p} />{p.name}</button>
          ))}
        </div>
      )}
      {panel === 'start' && (
        <div className="card stack">
          <p>Quantos jogadores por time?</p>
          <div className="stepper">
            <button className="btn" onClick={() => setSize(Math.max(2, size - 1))}>−</button>
            <strong>{size}</strong>
            <button className="btn" onClick={() => setSize(Math.min(6, size + 1))}>+</button>
          </div>
          <button className="btn primary" onClick={() => act('start', { team_size: size })}>Começar</button>
        </div>
      )}
      {panel === 'cancel' && (
        <div className="card stack">
          <p>Por que o evento foi cancelado?</p>
          <div className="chips">
            {['Chuva', 'Quadra ocupada', 'Poucas pessoas'].map((r) => <button key={r} className="chip" onClick={() => setReason(r)}>{r}</button>)}
          </div>
          <input placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
          <button className="btn danger" disabled={reason.trim().length < 3} onClick={() => act('cancel', { reason })}>Confirmar cancelamento</button>
        </div>
      )}

      {cur && (
        <section>
          <h3>Na quadra agora</h3>
          {!present.length && <p className="muted">Ninguém fez check-in ainda. Toque em “Estou aqui”.</p>}
          <div className="stack">
            {present.map((p) => (
              <div key={p.id} className="card row"><Avatar p={p} /><span className="grow">{p.name}</span>
                <button className="btn ghost small" onClick={() => act('leave', { player_id: p.id })}>Saiu</button></div>
            ))}
          </div>
        </section>
      )}

      {!!past.length && (
        <section>
          <h3>Eventos passados</h3>
          <div className="stack">
            {past.map((e) => (
              <div key={e.id} className="card">
                <strong>{fmtDate(e.event_date)}</strong>
                <p className="muted">{STATUS[e.status]}{e.status === 'cancelled' ? ` — ${e.cancel_reason}` : ` · ${e.present} presentes`}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('inicio');
  const refresh = useCallback(() => api('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)), []);
  useEffect(() => { refresh(); }, [refresh]);
  if (user === undefined) return <main className="screen"><p className="muted">Carregando…</p></main>;
  if (!user) return <Auth onDone={refresh} />;
  const tabs = [['inicio', 'Início'], ['quadra', 'Quadra'], ...(user.role === 'admin' ? [['admin', 'Operadores']] : [])];
  return (
    <>
      {tab === 'inicio' && <Home user={user} onLogout={() => setUser(null)} />}
      {tab === 'quadra' && <Court api={api} user={user} />}
      {tab === 'admin' && <Admin api={api} />}
      <nav className="nav" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>
        ))}
      </nav>
    </>
  );
}
