import { useCallback, useEffect, useState } from 'react';
import { currentSub, disablePush, enablePush, isIos, isStandalone, pushSupported } from './push.js';

const TOPICS = [
  ['event', 'Eventos', 'check-in aberto, novo evento, cancelamento e transmissão'],
  ['polls', 'Enquetes', 'votação aberta e resultados'],
  ['notice', 'Avisos do admin', 'mensagens avulsas'],
];

// Ligar/desligar as notificações deste aparelho e escolher os assuntos.
export default function Notificacoes({ api, user }) {
  const [on, setOn] = useState(null); // null = carregando
  const [topics, setTopics] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const admin = user.role === 'admin';
  const all = admin ? [...TOPICS, ['admin', 'Confirmações (só admin)', 'quando alguém toca em “Eu vou”']] : TOPICS;

  const load = useCallback(async () => {
    const sub = await currentSub().catch(() => null);
    if (!sub) { setOn(false); return; }
    const r = await api('/push/status', { body: { endpoint: sub.endpoint } });
    setOn(r.subscribed); setTopics(r.topics);
  }, [api]);
  useEffect(() => { if (pushSupported()) load().catch(() => setOn(false)); else setOn(false); }, [load]);

  const run = async (fn, ok) => {
    setBusy(true); setMsg('');
    try { await fn(); if (ok) setMsg(ok); await load(); } catch (e) { setMsg(e.message); }
    setBusy(false);
  };
  const toggle = (k) => run(async () => {
    const next = topics.includes(k) ? topics.filter((t) => t !== k) : [...topics, k];
    const sub = await currentSub();
    await api('/push/topics', { body: { endpoint: sub.endpoint, topics: next } });
  });

  let body;
  if (!pushSupported()) {
    body = isIos() && !isStandalone()
      ? <p className="muted">No iPhone, as notificações só funcionam com o app instalado: toque em Compartilhar, depois em “Adicionar à Tela de Início”, abra o app pelo ícone e ative aqui.</p>
      : <p className="muted">Este navegador não oferece notificações.</p>;
  } else if (on === null) {
    body = <p className="muted">Carregando…</p>;
  } else if (!on) {
    body = (
      <>
        <p className="muted">Receba avisos de check-in, novos eventos, votações e resultados, mesmo com o app fechado.</p>
        {typeof Notification !== 'undefined' && Notification.permission === 'denied' && <p className="err">As notificações estão bloqueadas nas configurações deste aparelho.</p>}
        <button className="btn primary" disabled={busy} onClick={() => run(() => enablePush(api, ['event', 'polls', 'notice', ...(admin ? ['admin'] : [])]), 'Notificações ativadas neste aparelho.')}>Ativar notificações</button>
      </>
    );
  } else {
    body = (
      <>
        <p className="muted">Ativas neste aparelho. Escolha o que quer receber:</p>
        <div className="stack">
          {all.map(([k, label, hint]) => (
            <button key={k} className={`chip${topics.includes(k) ? ' on' : ''}`} aria-pressed={topics.includes(k)} disabled={busy} onClick={() => toggle(k)} title={hint}>
              {topics.includes(k) ? '✓ ' : ''}{label}
            </button>
          ))}
        </div>
        <button className="btn" disabled={busy} onClick={() => run(() => api('/push/test', { body: {} }), 'Teste enviado. Deve chegar em instantes.')}>Enviar teste</button>
        <button className="btn ghost" disabled={busy} onClick={() => run(() => disablePush(api), 'Notificações desativadas neste aparelho.')}>Desativar neste aparelho</button>
      </>
    );
  }

  return (
    <details className="card">
      <summary><span className="grow">Notificações</span><small className="muted">{on ? 'Ativas' : 'Desativadas'}</small></summary>
      {msg && <p className="muted" role="status">{msg}</p>}
      <div className="stack">{body}</div>
    </details>
  );
}
