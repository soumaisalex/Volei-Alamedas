export const OPEN = ['scheduled', 'checkin_open', 'in_progress'];
export const STATUS = { finished: 'Encerrado', cancelled: 'Cancelado', in_progress: 'Em andamento', scheduled: 'Agendado', checkin_open: 'Agendado' };
export const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
export const today = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // horário de Aracaju
export const Face = ({ p }) => (p.photo_url ? <img className="avatar" src={p.photo_url} alt="" /> : <span className="avatar">{p.name[0]}</span>);

// O evento "atual": o que está em andamento ou, senão, o agendado mais próximo.
export function pickCurrent(list) {
  const open = list.filter((e) => OPEN.includes(e.status));
  return open.find((e) => e.status === 'in_progress') ?? [...open].sort((a, b) => a.event_date.localeCompare(b.event_date))[0];
}
