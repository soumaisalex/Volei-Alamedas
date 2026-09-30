import { useCallback, useEffect, useState } from 'react';
import Admin from './Admin.jsx';
import ShareCard from './ShareCard.jsx';
import { playerCard, trophyCard } from './cards.js';

// Recorta ao centro e reduz para um JPEG quadrado leve (~30 KB).
async function toJpeg(file, size = 320) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const s = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  canvas.getContext('2d').drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, size, size);
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error('Não foi possível processar a foto.'))), 'image/jpeg', 0.85));
}

export default function Profile({ api, user, playerId, onBack, onSaved }) {
  const id = playerId || user.id;
  const mine = id === user.id;
  const canEdit = mine || user.role === 'admin';
  const [d, setD] = useState(null);
  const [name, setName] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [card, setCard] = useState(null);

  const load = useCallback(
    () => api(`/profile/${id}/stats`).then((r) => { setD(r); setName(r.player.name); }).catch((e) => setErr(e.message)),
    [api, id],
  );
  useEffect(() => { setD(null); load(); }, [load]);

  const saveName = async () => {
    setErr('');
    try { await api(`/profile/${id}/edit`, { body: { name } }); setEditing(false); await load(); onSaved?.(); }
    catch (e) { setErr(e.message); }
  };
  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/profile/${id}/photo`, { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: await toJpeg(file) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Não foi possível enviar a foto.');
      await load(); onSaved?.();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  if (!d) return <main className="screen">{err ? <p className="err" role="alert">{err}</p> : <p className="muted">Carregando…</p>}</main>;
  const { player: p, stats: s, trophies } = d;
  const tiles = [
    ['Eventos', s.events], ['Partidas', s.matches], ['Vitórias', s.wins], ['Derrotas', s.losses],
    ['Aproveitamento', s.pct == null ? '—' : `${s.pct}%`], ['Maior sequência', s.best_streak],
  ];

  return (
    <main className="screen">
      {!mine && <button className="btn ghost small" onClick={onBack}>Voltar</button>}
      {err && <p className="err" role="alert">{err}</p>}
      <section className="card profile-head">
        {p.photo_url ? <img className="avatar xl" src={p.photo_url} alt="" /> : <span className="avatar xl">{p.name[0]}</span>}
        <h2>{p.name}</h2>
        {p.role !== 'player' && <span className="pill">{p.role === 'admin' ? 'Admin' : 'Operador'}</span>}
        <button className="btn primary" onClick={() => setCard({ name: p.name, make: () => playerCard(d) })}>Compartilhar card</button>
        {canEdit && (
          <div className="stack fill">
            <label className="btn">
              {busy ? 'Enviando…' : 'Trocar foto'}
              <input className="sr" type="file" accept="image/*" onChange={pickPhoto} disabled={busy} />
            </label>
            {editing ? (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" />
                <button className="btn primary" disabled={name.trim().length < 2} onClick={saveName}>Salvar nome</button>
              </>
            ) : <button className="btn ghost" onClick={() => setEditing(true)}>Editar nome</button>}
          </div>
        )}
      </section>

      <section>
        <h3>Estatísticas</h3>
        <div className="tiles">
          {tiles.map(([label, v]) => <div key={label} className="card tile"><strong>{v}</strong><span className="muted">{label}</span></div>)}
        </div>
      </section>

      <section>
        <h3>Troféus</h3>
        {trophies.length ? (
          <div className="stack">
            {trophies.map((t) => (
              <div key={t.id} className="card row"><span className="emoji">{t.emoji}</span><span className="grow">{t.name}</span><button className="chip" onClick={() => setCard({ name: t.name, make: () => trophyCard(p, t) })}>Compartilhar</button><strong>x{t.n}</strong></div>
            ))}
          </div>
        ) : <p className="muted">Os troféus das enquetes aparecem aqui.</p>}
      </section>

      {mine && user.role === 'admin' && <Admin api={api} />}
      {card && <ShareCard card={card} onClose={() => setCard(null)} />}
    </main>
  );
}
