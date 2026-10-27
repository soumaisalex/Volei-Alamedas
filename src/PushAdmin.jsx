import { useEffect, useState } from 'react';
import Confirm from './Confirm.jsx';

const AUDIENCES = [
  ['all', 'Todos', 'todos os aparelhos com avisos ativos'],
  ['rsvp', 'Quem confirmou', 'quem tocou em “Eu vou” no próximo evento'],
  ['present', 'Quem está no evento', 'quem fez check-in no evento em andamento'],
];

// Admin: notificação avulsa para todos ou para um grupo.
export default function PushAdmin({ api }) {
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  const [stats, setStats] = useState(null);
  const [ask, setAsk] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/push/stats').then(setStats).catch(() => {}); }, [api]);

  const send = async () => {
    setAsk(false); setBusy(true); setMsg('');
    try {
      const r = await api('/push/broadcast', { body: form });
      setMsg(r.total ? `Enviada para ${r.sent} de ${r.total} aparelhos.${r.left ? ` ${r.left} ficaram de fora (limite por envio).` : ''}` : 'Ninguém para receber: ninguém neste grupo ativou as notificações.');
      if (r.sent) setForm({ ...form, title: '', body: '' });
    } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const aud = AUDIENCES.find((a) => a[0] === form.audience);

  return (
    <details className="card admin-polls">
      <summary><span className="grow">Enviar notificação</span></summary>
      {stats && <p className="muted">{stats.devices} {stats.devices === 1 ? 'aparelho inscrito' : 'aparelhos inscritos'} ({stats.players} {stats.players === 1 ? 'pessoa' : 'pessoas'}).</p>}
      {msg && <p className="muted" role="status">{msg}</p>}
      <div className="stack">
        <input placeholder="Título" maxLength={60} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Mensagem" maxLength={200} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <div className="chips">
          {AUDIENCES.map(([k, label]) => <button key={k} className={`chip${form.audience === k ? ' on' : ''}`} aria-pressed={form.audience === k} onClick={() => setForm({ ...form, audience: k })}>{label}</button>)}
        </div>
        <p className="muted">Vai para {aud[2]}.</p>
        <button className="btn primary" disabled={busy || form.title.trim().length < 2 || form.body.trim().length < 2} onClick={() => setAsk(true)}>Enviar notificação</button>
      </div>
      {ask && (
        <Confirm title="Enviar esta notificação?" text={`“${form.title.trim()}”: ${form.body.trim()}`} label="Enviar" onCancel={() => setAsk(false)} onOk={send} />
      )}
    </details>
  );
}
