import { useCallback, useEffect, useState } from 'react';
import Confirm from './Confirm.jsx';
import { Icon } from './icons.jsx';
import { brl, centsToInput, dateBR, parseCents } from './money.js';
import './donation.css';

const todayISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

// Registrar entrada ou saída no caixa.
function EntryForm({ kind, onSave, onClose }) {
  const [value, setValue] = useState('');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(todayISO());
  const cents = parseCents(value);
  const ok = cents >= 1 && (kind === 'in' || desc.trim().length > 0);
  return (
    <div className="overlay" role="presentation">
      <div className="sheet" role="dialog" aria-modal="true" aria-label={kind === 'in' ? 'Registrar entrada' : 'Registrar saída'}>
        <h3>{kind === 'in' ? 'Registrar entrada' : 'Registrar saída'}</h3>
        <input inputMode="decimal" placeholder="Valor (ex.: 25,00)" aria-label="Valor" value={value} onChange={(e) => setValue(e.target.value)} />
        <input placeholder={kind === 'in' ? 'Descrição (ex.: Pix da quinta, dinheiro na quadra)' : 'Como foi usado (ex.: bola nova)'} maxLength={140}
          aria-label="Descrição" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <input type="date" max={todayISO()} aria-label="Data" value={date} onChange={(e) => setDate(e.target.value)} />
        <button className="btn primary" disabled={!ok} onClick={() => onSave({ kind, amount_cents: cents, description: desc, entry_date: date })}>Registrar</button>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  );
}

// Seção do perfil do admin: liga/desliga o botão, configura o Pix e mantém o caixa.
export default function DonationAdmin({ api }) {
  const [opened, setOpened] = useState(false);
  const [d, setD] = useState(null);
  const [f, setF] = useState(null);
  const [bal, setBal] = useState('');
  const [msg, setMsg] = useState({ text: '', bad: false });
  const [entry, setEntry] = useState(null);
  const [ask, setAsk] = useState(null);
  const [qr, setQr] = useState('');
  const flash = (text, bad = false) => setMsg({ text, bad });

  const load = useCallback(async () => {
    const r = await api('/donation/admin');
    setD(r);
    setF({ enabled: r.enabled, pix_key: r.pix_key, holder_name: r.holder_name, city: r.city, default: centsToInput(r.default_cents) });
    setBal(centsToInput(r.balance_cents));
  }, [api]);
  useEffect(() => { if (opened) load().catch((e) => flash(e.message, true)); }, [opened, load]);

  // Prévia do QR (valor sugerido ou R$ 1,00)
  useEffect(() => {
    setQr('');
    if (!d?.ready) return undefined;
    let alive = true;
    (async () => {
      try {
        const r = await api(`/donation/payload?amount=${d.default_cents || 100}`);
        const m = await import('qrcode');
        const img = await (m.default ?? m).toDataURL(r.payload, { width: 480, margin: 2, errorCorrectionLevel: 'M' });
        if (alive) setQr(img);
      } catch { /* a prévia é opcional */ }
    })();
    return () => { alive = false; };
  }, [api, d?.ready, d?.default_cents, d?.pix_key, d?.holder_name, d?.city]);

  const post = async (path, body, okText) => {
    flash('');
    try { await api(path, { body }); if (okText) flash(okText); await load(); return true; }
    catch (e) { flash(e.message, true); return false; }
  };
  const save = (over = {}) => {
    const g = { ...f, ...over };
    return post('/donation/settings', { enabled: g.enabled, pix_key: g.pix_key, holder_name: g.holder_name, city: g.city, default_cents: g.default ? parseCents(g.default) : null }, 'Configurações salvas.');
  };
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <details className="card" onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary><span className="grow">Doações e caixa</span></summary>
      {msg.text && <p className={msg.bad ? 'err' : 'muted'} role="status">{msg.text}</p>}
      {!d && opened && !msg.text && <p className="muted">Carregando…</p>}

      {d && f && (
        <div className="stack">
          <button className={`btn ${f.enabled ? 'primary' : ''}`} aria-pressed={f.enabled} onClick={() => save({ enabled: !f.enabled })}>
            Botão de doações: {f.enabled ? 'ligado' : 'desligado'}
          </button>
          <p className="muted">Ligado, o card com o botão "Doar" aparece na tela inicial para todos. O saldo e o histórico só aparecem para quem está logado.</p>

          <h3>Pix</h3>
          <input placeholder="Chave Pix (aleatória, e-mail, CPF/CNPJ ou +55…)" aria-label="Chave Pix" autoComplete="off" value={f.pix_key} onChange={set('pix_key')} />
          <input placeholder="Nome do titular" maxLength={60} aria-label="Nome do titular" value={f.holder_name} onChange={set('holder_name')} />
          <input placeholder="Cidade" maxLength={40} aria-label="Cidade" value={f.city} onChange={set('city')} />
          <input inputMode="decimal" placeholder="Valor sugerido por Pix (ex.: 5,00)" aria-label="Valor sugerido" value={f.default} onChange={set('default')} />
          <button className="btn primary" onClick={() => save()}>Salvar configurações</button>
          {d.ready && (
            <>
              <p className="muted">No banco o titular aparece como <strong>{d.preview.name}</strong>, cidade <strong>{d.preview.city}</strong> (nome até 25 e cidade até 15 caracteres, sem acento).</p>
              <div className="pix-qr">{qr ? <img src={qr} alt="Prévia do QR Pix" /> : <p className="muted">Gerando a prévia…</p>}</div>
            </>
          )}

          <h3 className="spaced">Caixa</h3>
          <p className="muted">Saldo atual: <strong>{brl(d.balance_cents)}</strong></p>
          <div className="chips">
            <button className="chip" onClick={() => setEntry('in')}>Registrar entrada</button>
            <button className="chip" onClick={() => setEntry('out')}>Registrar saída</button>
          </div>
          <input inputMode="decimal" aria-label="Saldo atual" value={bal} onChange={(e) => setBal(e.target.value)} />
          <button className="btn" disabled={parseCents(bal) == null || parseCents(bal) === d.balance_cents}
            onClick={() => setAsk({ title: 'Ajustar o saldo?', text: `O saldo passa de ${brl(d.balance_cents)} para ${brl(parseCents(bal))}. Um lançamento de ajuste é criado no histórico.`, label: 'Ajustar saldo', run: () => post('/donation/adjust', { balance_cents: parseCents(bal) }, 'Saldo ajustado.') })}>
            Ajustar saldo
          </button>

          <h3 className="spaced">Histórico</h3>
          {!d.entries.length && <p className="muted">Sem lançamentos.</p>}
          <div className="scroll">
            {d.entries.map((e) => (
              <div key={e.id} className="card row entry">
                <span className="grow">
                  <strong>{e.kind === 'in' ? 'Entrou' : 'Saiu'}</strong><span className="when"> em {dateBR(e.date)}</span><br />
                  <span className="muted">{e.description || '—'}</span>
                </span>
                <span className={`amount ${e.kind}`}>{e.kind === 'in' ? '+' : '−'} {brl(e.amount_cents)}</span>
                <button className="btn danger icon small" aria-label="Excluir lançamento" title="Excluir lançamento"
                  onClick={() => setAsk({ title: 'Excluir este lançamento?', text: `${e.kind === 'in' ? 'Entrada' : 'Saída'} de ${brl(e.amount_cents)} em ${dateBR(e.date)}. O saldo será recalculado.`, label: 'Excluir', danger: true, run: () => post('/donation/delete', { id: e.id }, 'Lançamento excluído.') })}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {entry && <EntryForm kind={entry} onClose={() => setEntry(null)}
        onSave={async (b) => { if (await post('/donation/entry', b, 'Lançamento registrado.')) setEntry(null); }} />}
      {ask && <Confirm title={ask.title} text={ask.text} label={ask.label} danger={ask.danger}
        onCancel={() => setAsk(null)} onOk={() => { const r = ask.run; setAsk(null); r(); }} />}
    </details>
  );
}
