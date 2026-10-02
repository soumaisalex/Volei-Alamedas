import { useCallback, useEffect, useState } from 'react';
import Court from './Court.jsx';
import Ranking from './Ranking.jsx';
import Home from './Home.jsx';
import Person from './Person.jsx';
import Footer from './Footer.jsx';
import { Icon } from './icons.jsx';
import EventDetail from './EventDetail.jsx';
import { PublicHome } from './Events.jsx';
import LoginPick from './Login.jsx';
import { SetupForm } from './Setup.jsx';
import Enquetes from './Enquetes.jsx';
import ThemeButton from './ThemeButton.jsx';
import Profile from './Profile.jsx';

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

function Auth({ onDone, onBack }) {
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
      <div className="theme-row">{onBack && <button className="btn ghost small" onClick={onBack}>Voltar</button>}<ThemeButton /></div>
      <img className="logo" src="/logo.png" alt="Vôlei Alamedas Jardins" />
      <div className="tabs">
        <button className={mode === 'entrar' ? 'on' : ''} onClick={() => setMode('entrar')}>Já tenho cadastro</button>
        <button className={mode === 'cadastrar' ? 'on' : ''} onClick={() => setMode('cadastrar')}>Primeira vez</button>
      </div>
      {err && <p className="err" role="alert">{err}</p>}

      {mode === 'entrar' && !pick && (
        <>
          <input placeholder="Buscar seu nome" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pick-grid">
            {shown.map((p) => <Person key={p.id} name={p.name} photo_url={p.photo_url} onClick={() => setPick(p)} />)}
          </div>
          {!shown.length && <p className="muted">Ninguém com esse nome. Toque em “Primeira vez” para se cadastrar.</p>}
        </>
      )}
      {mode === 'entrar' && pick && (
        <LoginPick api={api} pick={pick} onDone={onDone} onBack={() => { setPick(null); setLast4(''); }} />
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

export default function App() {
  const [user, setUser] = useState(undefined);
  const [tab, setTab] = useState('inicio');
  const [viewId, setViewId] = useState(null);
  const [eventId, setEventId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const refresh = useCallback(() => api('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null)), []);
  useEffect(() => { refresh(); }, [refresh]);

  if (user === undefined) return <main className="screen"><p className="muted">Carregando…</p></main>;
  if (!user && showLogin) return <><Auth onDone={() => { setShowLogin(false); refresh(); }} onBack={() => setShowLogin(false)} /><Footer /></>;
  if (user?.needs_password) {
    return (
      <main className="screen">
        <img className="logo" src="/logo.png" alt="Vôlei Alamedas Jardins" />
        <h2>Crie sua senha</h2>
        <p className="muted">Contas de admin e operador agora entram com senha própria. Até criar a sua, os recursos de gestão ficam bloqueados.</p>
        <SetupForm api={api} playerId={user.id} onDone={refresh} />
        <button className="btn ghost" onClick={() => api('/auth/logout', { body: {} }).then(() => setUser(null))}>Sair</button>
        <Footer />
      </main>
    );
  }

  // Visitantes (sem login) veem eventos, ranking e perfis; o resto exige entrar.
  const tabs = user
    ? [['inicio', 'Início'], ['quadra', 'Quadra'], ['ranking', 'Ranking'], ['enquetes', 'Enquetes'], ['perfil', 'Perfil']]
    : [['inicio', 'Eventos'], ['ranking', 'Ranking'], ['entrar', 'Entrar']];
  const go = (k) => { setViewId(null); setEventId(null); if (k === 'entrar') setShowLogin(true); else setTab(k); };
  const openPlayer = (id) => { setEventId(null); setViewId(id); setTab('perfil'); };
  const logout = () => { setUser(null); setTab('inicio'); };

  let page;
  if (eventId) page = <EventDetail api={api} user={user} id={eventId} onBack={() => setEventId(null)} />;
  else if (tab === 'ranking') page = <Ranking api={api} user={user} onOpen={openPlayer} />;
  else if (tab === 'perfil' && (user || viewId)) page = <Profile api={api} user={user} playerId={viewId} onBack={() => { setViewId(null); setTab('ranking'); }} onSaved={refresh} />;
  else if (user && tab === 'quadra') page = <Court api={api} user={user} />;
  else if (user && tab === 'enquetes') page = <Enquetes api={api} user={user} />;
  else page = user
    ? <Home api={api} user={user} onLogout={logout} onOpenEvent={setEventId} />
    : <PublicHome api={api} onOpenEvent={setEventId} onLogin={() => setShowLogin(true)} />;

  return (
    <>
      {page}
      <Footer />
      <nav className="nav" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map(([k, label]) => (
          <button key={k} className={tab === k && !eventId ? 'on' : ''} aria-label={label} title={label} aria-current={tab === k && !eventId ? 'page' : undefined} onClick={() => go(k)}><Icon name={k === 'inicio' && !user ? 'calendar' : k} /></button>
        ))}
      </nav>
    </>
  );
}
