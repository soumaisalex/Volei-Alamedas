import { ChevronLeft, ChevronRight, CreditCard, LogOut, Moon, Plus, SlidersHorizontal, Sun, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, monthLabel, monthNow, shiftMonth } from './api.js';
import { TxForm } from './forms.jsx';
import Cards from './screens/Cards.jsx';
import Overview from './screens/Overview.jsx';
import Settings from './screens/Settings.jsx';
import { applyTheme, getTheme, saveTheme } from './theme.js';

const APP_NAME = 'Controle Financeiro';

function Login() {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isLogin = mode === 'login';

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    try {
      await api(`/api/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body: form });
      location.href = '/';
    } catch (err) {
      setMsg(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="panel login-box">
        <h1>{APP_NAME}</h1>
        <div className="tabs" role="tablist">
          <button type="button" className={isLogin ? 'on' : ''} onClick={() => setMode('login')}>Entrar</button>
          <button type="button" className={!isLogin ? 'on' : ''} onClick={() => setMode('register')}>Criar conta</button>
        </div>
        <form onSubmit={submit} className="form">
          {!isLogin && (
            <label className="field">Nome
              <input value={form.name} onChange={set('name')} autoComplete="name" required maxLength={80} />
            </label>
          )}
          <label className="field">Email
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" required />
          </label>
          <label className="field">Senha
            <input type="password" value={form.password} onChange={set('password')}
              autoComplete={isLogin ? 'current-password' : 'new-password'} required
              minLength={isLogin ? undefined : 8} maxLength={128} />
          </label>
          {msg && <p className="error">{msg}</p>}
          <button className="btn" disabled={busy}>{isLogin ? 'Entrar' : 'Criar conta'}</button>
        </form>
      </div>
    </main>
  );
}

function Shell({ user }) {
  const first = user.name.split(' ')[0];
  const [tab, setTab] = useState('home');
  const [month, setMonth] = useState(monthNow());
  const [rev, setRev] = useState(0);
  const [adding, setAdding] = useState(false);
  const [dark, setDark] = useState(() => {
    const t = getTheme();
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const bump = () => setRev((r) => r + 1);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    saveTheme(next ? 'dark' : 'light');
    applyTheme(next ? 'dark' : 'light');
  }
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/';
  }

  const NAV = [
    { id: 'home', label: first, Icon: User },
    { id: 'cards', label: 'Cartões', Icon: CreditCard },
  ];
  const screen = {
    home: <Overview user={user} month={month} rev={rev} bump={bump} go={setTab} />,
    cards: <Cards month={month} key={rev} />,
    settings: <Settings user={user} />,
  }[tab];

  return (
    <div className="shell">
      <aside className="side panel">
        <div className="brandrow">
          <span className="avatar">{first[0].toUpperCase()}</span>
          <strong>{APP_NAME}</strong>
        </div>
        <small className="menu-l">Menu</small>
        <nav>
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon size={17} /> {label}
            </button>
          ))}
        </nav>
        <div className="side-bottom">
          <button onClick={toggleTheme}>{dark ? <Sun size={17} /> : <Moon size={17} />} {dark ? 'Modo diurno' : 'Modo noturno'}</button>
          <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}><SlidersHorizontal size={17} /> Ajustes</button>
          <div className="userchip"><span className="avatar sm">{first[0].toUpperCase()}</span>{first}</div>
          <button onClick={logout}><LogOut size={17} /> Sair</button>
        </div>
      </aside>

      <div className="content">
        {tab !== 'settings' && (
          <header className="topbar panel">
            <button className="sq" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={16} /></button>
            <h2>{monthLabel(month)}</h2>
            <button className="sq" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={16} /></button>
            <span className="grow" />
            <button className="btn sm" onClick={() => setAdding(true)}><Plus size={16} /> Adicionar gasto</button>
          </header>
        )}
        {screen}
      </div>

      <nav className="bottom">
        {NAV.map(({ id, label, Icon }) => (
          <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={20} />{label}</button>
        ))}
        <button className={tab === 'settings' ? 'on' : ''} onClick={() => setTab('settings')}><SlidersHorizontal size={20} />Ajustes</button>
      </nav>
      {adding && <TxForm month={month} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); bump(); }} />}
    </div>
  );
}

export default function App() {
  const [state, setState] = useState({ status: 'loading', user: null });

  useEffect(() => {
    api('/api/me')
      .then((user) => setState({ status: 'in', user }))
      .catch((e) => setState({ status: e.status === 401 ? 'out' : 'error', user: null }));
  }, []);

  if (state.status === 'loading') return null;
  if (state.status === 'error') return <p className="error pad">Erro ao carregar. Recarregue a página.</p>;
  if (state.status === 'out') return <Login />;
  return <Shell user={state.user} />;
}
