import { useCallback, useEffect, useState } from 'react';
import { fmtDate } from './shared.jsx';

// Tela aberta pelo QR da entrada: faz o check-in no evento em andamento.
export default function QrCheckin({ api, onDone }) {
  const [st, setSt] = useState({ loading: true });

  const run = useCallback(() => {
    setSt({ loading: true });
    api('/checkin', { body: {} }).then((r) => setSt({ ok: true, ...r })).catch((e) => setSt({ err: e.message }));
  }, [api]);
  useEffect(() => { run(); }, [run]);

  const undo = async () => {
    try { await api(`/events/${st.event.id}/leave`, { body: {} }); setSt({ undone: true, event: st.event }); }
    catch (e) { setSt({ err: e.message }); }
  };

  return (
    <main className="screen">
      <img className="logo" src="/logo.png" alt="Vôlei Alamedas Jardins" />
      {st.loading && <p className="muted center">Fazendo o check-in…</p>}

      {st.ok && (
        <section className="card hero center">
          <span className="check" aria-hidden="true">✓</span>
          <h1>Check-in feito!</h1>
          <p className="big">{fmtDate(st.event.event_date)}</p>
          {st.already && <p className="muted">Você já estava na lista.</p>}
        </section>
      )}
      {st.undone && <section className="card center"><strong>Check-in desfeito.</strong></section>}
      {st.err && <p className="err" role="alert">{st.err}</p>}

      {st.ok && <button className="btn ghost" onClick={undo}>Não estou aqui (desfazer)</button>}
      {(st.undone || st.err) && <button className="btn" onClick={run}>Tentar o check-in de novo</button>}
      {!st.loading && <button className="btn primary" onClick={onDone}>Ir para o início</button>}
    </main>
  );
}
