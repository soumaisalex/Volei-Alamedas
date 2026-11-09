import { useCallback, useEffect, useState } from 'react';
import Person from './Person.jsx';
import { maskPhone } from './shared.jsx';
import { toJpeg } from './photo.js';

const ROLE = { admin: 'Admin', operator: 'Operador', player: '' };

// Edição de nome, celular e foto de uma pessoa (só admin).
function EditForm({ p, onSave, onPhoto, onCancel }) {
  const [name, setName] = useState(p.name);
  const [phone, setPhone] = useState(maskPhone(p.phone || ''));
  const [busy, setBusy] = useState(false);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    await onPhoto(file);
    setBusy(false);
  };
  const ok = name.trim().length >= 2 && phone.length === 15;
  return (
    <div className="stack">
      <label className="btn" style={{ justifySelf: 'start' }}>
        {busy ? 'Enviando…' : 'Trocar foto'}
        <input type="file" accept="image/*" hidden disabled={busy} onChange={pick} />
      </label>
      <input placeholder="Nome" autoComplete="off" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
      <input inputMode="tel" placeholder="(00) 00000-0000" autoComplete="off" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} />
      <p className="muted">O celular é usado no login (4 últimos dígitos) e não pode repetir o de outra pessoa.</p>
      <button className="btn primary" disabled={busy || !ok} onClick={() => onSave({ name: name.trim(), phone })}>Salvar</button>
      <button className="btn ghost" onClick={onCancel}>Cancelar</button>
    </div>
  );
}

// Opções de uma pessoa, em janela: editar dados, tornar operador, novo código de acesso, remover.
function PersonSheet({ p, issued, err, onChange, onPhoto, onClose }) {
  const [editing, setEditing] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [sure, setSure] = useState(false);
  const [sureOff, setSureOff] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && (zoom ? setZoom(false) : onClose());
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, zoom]);

  const status = !p.active ? 'Inativo, fora do login e do check-in'
    : p.role === 'admin' ? 'Administrador'
    : p.role === 'operator' ? (p.has_password ? 'Operador, com senha criada' : 'Operador, aguardando o primeiro acesso')
    : p.has_password ? 'Jogador, com senha própria' : 'Jogador, entra com os 4 últimos dígitos do celular';

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Opções de ${p.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          {p.photo_url ? (
            <button type="button" aria-label={`Ampliar a foto de ${p.name}`} onClick={() => setZoom(true)}
              style={{ background: 'none', border: 0, padding: 0, borderRadius: '50%', flex: 'none', display: 'grid', cursor: 'zoom-in' }}>
              <img className="avatar" src={p.photo_url} alt="" />
            </button>
          ) : <span className="avatar">{p.name[0]}</span>}
          <div className="grow"><strong>{p.name}</strong><br />{p.phone && <><span className="phone">{maskPhone(p.phone)}</span><br /></>}<span className="muted">{status}</span></div>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        {issued && (
          <div className="card code" role="status">
            <p>Código de acesso</p>
            <strong className="code-text">{issued}</strong>
            <p className="muted">Vale por 24 horas e só aparece agora. Envie para a pessoa usar em “Primeiro acesso”.</p>
          </div>
        )}

        {p.role !== 'admin' && !editing && <button className="btn" onClick={() => setEditing(true)}>Editar nome, celular e foto</button>}
        {editing && <EditForm p={p} onPhoto={onPhoto} onCancel={() => setEditing(false)} onSave={(d) => onChange(d).then((ok) => ok && setEditing(false))} />}

        {!editing && p.active && p.role === 'player' && (
          <>
            <p className="muted">Operadores montam times, controlam a fila e o placar. Ao promover, a pessoa passa a entrar com senha própria e recebe um código de acesso de 24 horas.</p>
            <button className="btn primary" onClick={() => onChange({ role: 'operator' })}>Tornar operador</button>
            {p.has_password && (
              <>
                <p className="muted">Se a pessoa esqueceu a senha, redefinir faz ela voltar a entrar com os 4 últimos dígitos do celular (e desconecta os aparelhos dela).</p>
                <button className="btn danger" onClick={() => onChange({ clearPassword: true })}>Redefinir senha</button>
              </>
            )}
          </>
        )}
        {!editing && p.active && p.role === 'operator' && (
          <>
            <p className="muted">Gerar um novo código apaga a senha atual e desconecta a pessoa. Use se ela esqueceu a senha ou ainda não conseguiu entrar.</p>
            <button className="btn danger" onClick={() => onChange({ reset: true })}>Novo código de acesso</button>
            <button className="btn danger" onClick={() => (sure ? onChange({ role: 'player' }, true) : setSure(true))}>
              {sure ? 'Toque de novo para confirmar' : 'Remover operador'}
            </button>
          </>
        )}
        {p.role === 'admin' && <p className="muted">O administrador não pode ser alterado por aqui.</p>}
        {!editing && !p.active && (
          <>
            <p className="muted">Este jogador não aparece no login nem no check-in, mas continua no ranking, nas estatísticas e nos resultados.</p>
            <button className="btn primary" onClick={() => onChange({ active: true }, true)}>Reativar jogador</button>
          </>
        )}
        {!editing && p.active && p.role !== 'admin' && (
          <>
            <p className="muted">Inativar tira a pessoa do login e do check-in. Ela continua no ranking, nas estatísticas e nos resultados, e pode ser reativada depois.</p>
            <button className="btn danger" onClick={() => (sureOff ? onChange({ active: false }, true) : setSureOff(true))}>
              {sureOff ? 'Toque de novo para confirmar' : 'Inativar jogador'}
            </button>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
      {zoom && (
        <div className="overlay" role="presentation" style={{ zIndex: 60 }} onClick={(e) => { e.stopPropagation(); setZoom(false); }}>
          <img src={p.photo_url} alt={`Foto de ${p.name}`}
            style={{ width: 'min(92vw, 80vh)', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: '1rem', background: '#000' }} />
        </div>
      )}
    </div>
  );
}

export default function Admin({ api }) {
  const [list, setList] = useState([]);
  const [err, setErr] = useState('');
  const [issued, setIssued] = useState(null);
  const [sel, setSel] = useState(null);
  const load = useCallback(() => api('/players?all=1').then(setList).catch((e) => setErr(e.message)), [api]);
  useEffect(() => { load(); }, [load]);
  const picked = list.find((p) => p.id === sel);
  const active = list.filter((p) => p.active);
  const inactive = list.filter((p) => !p.active);

  const open = (id) => { setErr(''); setIssued(null); setSel(id); };
  const change = async (body, closeAfter) => {
    setErr(''); setIssued(null);
    try {
      const r = await api(`/players/${picked.id}`, { body });
      if (r.code) setIssued(r.code);
      await load();
      if (closeAfter) setSel(null);
      return true;
    } catch (e) { setErr(e.message); return false; }
  };
  const photo = async (file) => {
    setErr('');
    try {
      const res = await fetch(`/api/profile/${picked.id}/photo`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: await toJpeg(file) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Não foi possível enviar a foto.');
      await load();
    } catch (e) { setErr(e.message); }
  };

  return (
    <details className="card">
      <summary><span className="grow">Operadores</span></summary>
      <p className="muted">Toque numa pessoa para ver as opções e editar nome, celular e foto. Operadores entram com senha própria.</p>
      {err && !picked && <p className="err" role="alert">{err}</p>}
      <div className="pick-grid">
        {active.map((p) => (
          <Person key={p.id} name={p.name} photo_url={p.photo_url} onClick={() => open(p.id)}>
            <small className="muted">{(p.role === 'operator' && !p.has_password ? 'Aguardando' : ROLE[p.role]) || '\u00A0'}</small>
          </Person>
        ))}
      </div>
      {!!inactive.length && (
        <>
          <h3 className="spaced">Inativos ({inactive.length})</h3>
          <div className="pick-grid">
            {inactive.map((p) => (
              <Person key={p.id} name={p.name} photo_url={p.photo_url} className="off" onClick={() => open(p.id)}>
                <small className="muted">Inativo</small>
              </Person>
            ))}
          </div>
        </>
      )}
      {picked && <PersonSheet key={picked.id} p={picked} issued={issued} err={err} onChange={change} onPhoto={photo} onClose={() => setSel(null)} />}
    </details>
  );
}
