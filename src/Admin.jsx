import { useCallback, useEffect, useState } from 'react';
import Person from './Person.jsx';
import { maskPhone } from './shared.jsx';

const ROLE = { admin: 'Admin', operator: 'Operador', player: '' };

// Opções de uma pessoa, em janela: tornar operador, novo código de acesso, remover.
function PersonSheet({ p, issued, err, onChange, onClose }) {
  const [sure, setSure] = useState(false);
  const [sureOff, setSureOff] = useState(false);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const status = !p.active ? 'Inativo, fora do login e do check-in'
    : p.role === 'admin' ? 'Administrador'
    : p.role === 'operator' ? (p.has_password ? 'Operador, com senha criada' : 'Operador, aguardando o primeiro acesso')
    : 'Jogador, entra com os 4 últimos dígitos do celular';

  return (
    <div className="overlay" role="presentation" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Opções de ${p.name}`} onClick={(e) => e.stopPropagation()}>
        <div className="row">
          {p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>}
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

        {p.active && p.role === 'player' && (
          <>
            <p className="muted">Operadores montam times, controlam a fila e o placar. Ao promover, a pessoa passa a entrar com senha própria e recebe um código de acesso de 24 horas.</p>
            <button className="btn primary" onClick={() => onChange({ role: 'operator' })}>Tornar operador</button>
          </>
        )}
        {p.active && p.role === 'operator' && (
          <>
            <p className="muted">Gerar um novo código apaga a senha atual e desconecta a pessoa. Use se ela esqueceu a senha ou ainda não conseguiu entrar.</p>
            <button className="btn" onClick={() => onChange({ reset: true })}>Novo código de acesso</button>
            <button className="btn danger" onClick={() => (sure ? onChange({ role: 'player' }, true) : setSure(true))}>
              {sure ? 'Toque de novo para confirmar' : 'Remover operador'}
            </button>
          </>
        )}
        {p.role === 'admin' && <p className="muted">O administrador não pode ser alterado por aqui.</p>}
        {!p.active && (
          <>
            <p className="muted">Este jogador não aparece no login nem no check-in, mas continua no ranking, nas estatísticas e nos resultados.</p>
            <button className="btn primary" onClick={() => onChange({ active: true }, true)}>Reativar jogador</button>
          </>
        )}
        {p.active && p.role !== 'admin' && (
          <>
            <p className="muted">Inativar tira a pessoa do login e do check-in. Ela continua no ranking, nas estatísticas e nos resultados, e pode ser reativada depois.</p>
            <button className="btn danger" onClick={() => (sureOff ? onChange({ active: false }, true) : setSureOff(true))}>
              {sureOff ? 'Toque de novo para confirmar' : 'Inativar jogador'}
            </button>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>Fechar</button>
      </div>
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
    } catch (e) { setErr(e.message); }
  };

  return (
    <section>
      <h3>Operadores</h3>
      <p className="muted">Toque numa pessoa para ver as opções. Operadores entram com senha própria.</p>
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
      {picked && <PersonSheet key={picked.id} p={picked} issued={issued} err={err} onChange={change} onClose={() => setSel(null)} />}
    </section>
  );
}
