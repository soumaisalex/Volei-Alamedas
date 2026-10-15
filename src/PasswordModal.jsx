import { useEffect, useState } from 'react';

// Criar ou alterar a própria senha. Quem ainda usa os 4 últimos dígitos confirma com eles (a "senha atual").
export default function PasswordModal({ api, hasPassword, onDone, onClose }) {
  const [cur, setCur] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && (done ? onDone() : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done, onClose, onDone]);

  const okCur = hasPassword ? cur.length > 0 : cur.length === 4;
  const ok = okCur && pwd.length >= 8 && pwd === pwd2;
  const submit = async () => {
    setBusy(true); setErr('');
    try { await api('/auth/password', { body: { current: cur, next: pwd } }); setDone(true); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={hasPassword ? 'Alterar minha senha' : 'Criar minha senha'}>
        <h3>{hasPassword ? 'Alterar minha senha' : 'Criar minha senha'}</h3>
        {done ? (
          <>
            <p><strong>Senha {hasPassword ? 'alterada' : 'criada'}!</strong></p>
            <p className="muted">Nos outros aparelhos você será desconectado(a). Na próxima vez, entre com a sua senha.</p>
            <button className="btn primary" onClick={onDone}>Fechar</button>
          </>
        ) : (
          <>
            <p className="muted">
              {hasPassword
                ? 'Digite a senha atual e escolha a nova (mínimo de 8 caracteres).'
                : 'Confirme com os 4 últimos dígitos do celular (a sua senha de hoje) e escolha uma senha nova, com 8 caracteres ou mais. Depois disso, o login passa a pedir essa senha.'}
            </p>
            {err && <p className="err" role="alert">{err}</p>}
            {hasPassword
              ? <input type="password" placeholder="Senha atual" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} />
              : <input inputMode="numeric" maxLength={4} placeholder="4 últimos dígitos do celular" autoComplete="off" value={cur} onChange={(e) => setCur(e.target.value.replace(/\D/g, ''))} />}
            <input type="password" placeholder="Nova senha (mínimo 8)" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
            <input type="password" placeholder="Repita a nova senha" autoComplete="new-password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} />
            {pwd2 && pwd !== pwd2 && <p className="muted">As senhas não são iguais.</p>}
            <button className="btn primary" disabled={!ok || busy} onClick={submit}>{busy ? 'Salvando…' : 'Salvar senha'}</button>
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
          </>
        )}
      </div>
    </div>
  );
}

// Sugestão logo após entrar, para quem ainda usa só os 4 últimos dígitos.
export function PasswordSuggest({ onCreate, onLater, onNever }) {
  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Proteger sua conta">
        <h3>Proteger sua conta?</h3>
        <p>Hoje o seu acesso usa os 4 últimos dígitos do celular. Quem souber esses números pode entrar como você, inclusive ver o seu voto nas enquetes.</p>
        <p className="muted">Uma senha própria evita isso. Se preferir, você pode continuar entrando com os 4 dígitos.</p>
        <button className="btn primary" onClick={onCreate}>Criar uma senha</button>
        <button className="btn ghost" onClick={onLater}>Agora não</button>
        <button className="btn ghost small" onClick={onNever}>Não perguntar de novo neste aparelho</button>
      </div>
    </div>
  );
}
