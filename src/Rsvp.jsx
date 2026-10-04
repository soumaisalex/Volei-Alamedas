import { useEffect, useState } from 'react';

// Quantidade e nomes de quem confirmou: só o admin vê (o servidor também recusa para os demais).
export function RsvpAdmin({ api, eventId, count }) {
  const [list, setList] = useState(null);
  useEffect(() => { api(`/events/${eventId}/rsvps`).then(setList).catch(() => setList([])); }, [api, eventId, count]);
  const n = list ? list.length : (count ?? 0);
  return (
    <details className="card">
      <summary><span className="grow">{n} {n === 1 ? 'confirmado' : 'confirmados'} <small className="muted">(só admin)</small></span></summary>
      {list?.length ? <p>{list.map((p) => p.name).join(', ')}</p> : <p className="muted">Ninguém confirmou ainda.</p>}
    </details>
  );
}
