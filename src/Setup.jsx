import { useState } from 'react';

// Primeiro acesso / redefinição: código + nova senha.
export function SetupForm({ api, playerId, onDone }) {
  const [code, setCode] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const ok = code.trim().length >= 4 && pwd.length >= 8 && pwd === pwd2;

  const submit = async () => {
    setErr('');
    try { await api('/auth/setup', { body: { player_id: playerId, code, password: pwd } }); onDone(); }
    catch (e) { setErr(e.message); }
  };
  return (
    <div className="stack">
      <p className="muted">Digite o código de acesso e crie a sua senha (mínimo de 8 caracteres). Operadores recebem o código do admin; o admin usa o ADMIN_SETUP_CODE do Cloudflare.</p>
      {err && <p className="err" role="alert">{err}</p>}
      <input placeholder="Código de acesso" autoCapitalize="characters" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />
      <input type="password" placeholder="Nova senha" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
      <input type="password" placeholder="Repita a nova senha" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
      {pwd2 && pwd !== pwd2 && <p className="muted">As senhas não são iguais.</p>}
      <button className="btn primary" disabled={!ok} onClick={submit}>Criar senha e entrar</button>
    </div>
  );
}

// Troca de senha dentro do perfil (admin/operador).
export function ChangePassword({ api }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [bad, setBad] = useState(false);

  const submit = async () => {
    setMsg('');
    try { await api('/auth/password', { body: { current: cur, next } }); setBad(false); setMsg('Senha alterada. As outras sessões foram encerradas.'); setCur(''); setNext(''); }
    catch (e) { setBad(true); setMsg(e.message); }
  };
  return (
    <details className="card">
      <summary><span className="grow">Alterar minha senha</span></summary>
      <div className="stack">
        {msg && <p className={bad ? 'err' : 'muted'} role="status">{msg}</p>}
        <input type="password" placeholder="Senha atual" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
        <input type="password" placeholder="Nova senha (mínimo 8)" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <button className="btn primary" disabled={!cur || next.length < 8} onClick={submit}>Salvar nova senha</button>
      </div>
    </details>
  );
}
