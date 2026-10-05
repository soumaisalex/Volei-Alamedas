import { useEffect, useState } from 'react';
import ThemeButton from './ThemeButton.jsx';
import { InfoCards } from './InfoCards.jsx';
import { OPEN, STATUS, fmtDate } from './shared.jsx';

// Lista de eventos; tocar abre o detalhe. Com onRsvp, os eventos agendados ganham o botão
// "Eu vou" / "Não vou mais" no canto direito do card (quebra para baixo se não couber).
export function EventCards({ title, events, onOpen, onRsvp }) {
  if (!events.length) return null;
  return (
    <section>
      <h3>{title}</h3>
      <div className="stack">
        {events.map((e) => {
          const text = (
            <>
              <strong className="date">{e.title ? `${e.title}: ` : ''}{fmtDate(e.event_date)}</strong>
              <p className="muted">
                {STATUS[e.status]}
                {e.status === 'cancelled' ? `: ${e.cancel_reason}` : e.status === 'finished' ? `, ${e.attended} ${e.attended === 1 ? 'presente' : 'presentes'}` : ''}
              </p>
            </>
          );
          if (!(onRsvp && ['scheduled', 'checkin_open'].includes(e.status))) {
            return <button key={e.id} className="card" onClick={() => onOpen(e.id)}>{text}</button>;
          }
          return (
            <div key={e.id} className="card event-row">
              <button className="event-main" onClick={() => onOpen(e.id)}>{text}</button>
              <button className={`btn small ${e.going ? 'ghost' : 'primary'}`} onClick={() => onRsvp(e)}>{e.going ? 'Não vou mais' : 'Eu vou'}</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Tela inicial para quem não está logado: só leitura. "Eu vou" leva ao login e confirma ao entrar.
export function PublicHome({ api, onOpenEvent, onLogin, onRsvp }) {
  const [events, setEvents] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/events').then(setEvents).catch((e) => setErr(e.message)); }, [api]);
  const open = (events || []).filter((e) => OPEN.includes(e.status)).sort((a, b) => a.event_date.localeCompare(b.event_date));
  const past = (events || []).filter((e) => !OPEN.includes(e.status));

  return (
    <main className="screen">
      <div className="theme-row"><ThemeButton /></div>
      <img className="logo" src="/logo.png" alt="Vôlei Alamedas Jardins" />
      <p className="muted">Veja os eventos, o ranking e os perfis. Para fazer check-in e votar, entre com o seu nome.</p>
      <button className="btn primary" onClick={onLogin}>Entrar</button>
      {err && <p className="err" role="alert">{err}</p>}
      {!events && !err && <p className="muted">Carregando…</p>}
      <EventCards title="Próximos eventos" events={open} onOpen={onOpenEvent} onRsvp={onRsvp} />
      <EventCards title="Eventos anteriores" events={past} onOpen={onOpenEvent} />
      <InfoCards api={api} />
    </main>
  );
}
