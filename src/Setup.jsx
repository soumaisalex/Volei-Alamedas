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

