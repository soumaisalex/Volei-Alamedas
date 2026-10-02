import { useCallback, useEffect, useState } from 'react';
import Confirm from './Confirm.jsx';

const EMPTY = { id: null, name: '', emoji: '', description: '', kind: 'player', active: true };
const day = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

export default function PollsAdmin({ api, open, onChange }) {
  const [cats, setCats] = useState([]);
  const [events, setEvents] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [avulsa, setAvulsa] = useState({ title: '', options: '', hours: 24 });
  const [msg, setMsg] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);

  const loadAll = useCallback(async () => {
    setCats(await api('/polls/categories'));
    setEvents((await api('/events')).filter((e) => e.status === 'finished').slice(0, 5));
  }, [api]);
  useEffect(() => { loadAll().catch((e) => setMsg(e.message)); }, [loadAll]);

  const call = async (action, body, okMsg) => {
    setMsg('');
    try { const r = await api(`/polls/${action}`, { body }); if (okMsg) setMsg(okMsg(r)); await Promise.all([loadAll(), onChange()]); return true; }
    catch (e) { setMsg(e.message); return false; }
  };

  return (
    <details className="card admin-polls">
      <summary><span className="grow">Administrar enquetes</span></summary>
      {msg && <p className="err" role="status">{msg}</p>}

      <h3>Votações abertas</h3>
      {!open.length && <p className="muted">Nenhuma.</p>}
      {open.length > 1 && <button className="btn danger" onClick={() => setConfirmAll(true)}>Encerrar todas ({open.length})</button>}
      <div className="stack">
        {open.map((p) => (
          <div key={p.id} className="card stack">
            <strong>{p.emoji || '🗳️'} {p.title}</strong>
            <div className="chips">
              <button className="chip danger" onClick={() => call('close', { poll_id: p.id }, () => 'Votação encerrada.')}>Fechar agora</button>
              <button className="chip" onClick={() => call('extend', { poll_id: p.id, hours: 12 }, () => 'Prazo: mais 12 h.')}>Prazo +12 h</button>
              <button className="chip danger" onClick={() => call('remove', { poll_id: p.id })}>Remover</button>
            </div>
          </div>
        ))}
      </div>

      <h3>Abrir votação de um evento</h3>
      <div className="stack">
        {events.map((e) => (
          <button key={e.id} className="btn" onClick={() => call('open-event', { event_id: e.id, hours: 24 }, (r) => `${r.created} enquete(s) aberta(s).`)}>
            Evento de {day(e.event_date)}
          </button>
        ))}
        {!events.length && <p className="muted">Nenhum evento encerrado ainda.</p>}
      </div>

      <h3>Nova enquete avulsa</h3>
      <div className="stack">
        <input placeholder="Pergunta" value={avulsa.title} onChange={(e) => setAvulsa({ ...avulsa, title: e.target.value })} />
        <textarea placeholder={'Uma opção por linha\nEx.: Sábado de manhã'} value={avulsa.options} onChange={(e) => setAvulsa({ ...avulsa, options: e.target.value })} />
        <input type="number" min="1" max="168" inputMode="numeric" aria-label="Horas até fechar" value={avulsa.hours} onChange={(e) => setAvulsa({ ...avulsa, hours: Number(e.target.value) })} />
        <button className="btn primary" onClick={async () => {
          if (await call('create', { title: avulsa.title, options: avulsa.options.split('\n'), hours: avulsa.hours }, () => 'Enquete criada.')) setAvulsa({ title: '', options: '', hours: 24 });
        }}>Criar enquete</button>
      </div>

      <h3>Categorias</h3>
      <div className="stack">
        {cats.map((c) => (
          <div key={c.id} className="card row">
            <span className="emoji">{c.emoji}</span>
            <span className="grow">{c.name}{c.kind === 'team' && <small className="muted"> (times)</small>}</span>
            <button className="chip" onClick={() => call('category', { ...c, active: !c.active })}>{c.active ? 'Ativa' : 'Inativa'}</button>
            <button className="chip" onClick={() => setForm({ ...c })}>Editar</button>
          </div>
        ))}
        <div className="card stack">
          <strong>{form.id ? 'Editar categoria' : 'Nova categoria'}</strong>
          <input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input placeholder="Emoji" value={form.emoji || ''} onChange={(e) => setForm({ ...form, emoji: e.target.value })} />
          <textarea placeholder="Descrição (aparece na votação)" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="chips">
            <button className={`chip${form.kind === 'player' ? ' on' : ''}`} onClick={() => setForm({ ...form, kind: 'player' })}>Jogadores</button>
            <button className={`chip${form.kind === 'team' ? ' on' : ''}`} onClick={() => setForm({ ...form, kind: 'team' })}>Times</button>
          </div>
          <button className="btn primary" disabled={form.name.trim().length < 2} onClick={async () => { if (await call('category', form, () => 'Categoria salva.')) setForm(EMPTY); }}>Salvar categoria</button>
          {form.id && <button className="btn ghost" onClick={() => setForm(EMPTY)}>Cancelar edição</button>}
        </div>
      </div>
      {confirmAll && (
        <Confirm title="Encerrar todas as votações?" text="Os resultados são apurados agora e os troféus são entregues. Não dá para desfazer."
          label="Encerrar todas" danger onCancel={() => setConfirmAll(false)}
          onOk={async () => { setConfirmAll(false); await call('close-all', {}, (r) => `${r.closed} votações encerradas.`); }} />
      )}
    </details>
  );
}
