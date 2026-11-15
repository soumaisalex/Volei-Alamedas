import { useState } from 'react';
import { api, brl, centsToInput, toCents, today } from './api.js';
import { Field, Modal, useLoad } from './ui.jsx';

export function TxForm({ month, onClose, onSaved }) {
  const lists = useLoad(
    () => Promise.all([api('/api/categories'), api('/api/accounts'), api('/api/cards')]),
    []
  );
  const [f, setF] = useState({
    kind: 'expense', description: '', amount: '',
    date: today().startsWith(month) ? today() : `${month}-01`,
    category_id: '', source: '', installments: 1, repeat: false, paid: false,
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const [cats, accounts, cards] = lists.data || [[], [], []];
  const isCard = f.source.startsWith('c:');

  async function submit(e) {
    e.preventDefault();
    const cents = toCents(f.amount);
    if (!cents || cents <= 0) return setErr('Informe um valor válido.');
    setBusy(true);
    setErr('');
    try {
      await api('/api/transactions', {
        method: 'POST',
        body: {
          kind: f.kind, description: f.description, amount_cents: cents, date: f.date,
          category_id: f.category_id || null,
          account_id: f.source.startsWith('a:') ? f.source.slice(2) : null,
          card_id: isCard ? f.source.slice(2) : null,
          installments: f.kind === 'expense' ? Number(f.installments) || 1 : 1,
          repeat: f.repeat ? 'monthly' : null,
          paid: f.paid && !isCard,
        },
      });
      onSaved();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <Modal title="Novo lançamento" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="tabs">
          {[['expense', 'Despesa'], ['income', 'Receita']].map(([k, l]) => (
            <button type="button" key={k} className={f.kind === k ? 'on' : ''}
              onClick={() => setF({ ...f, kind: k, category_id: '', source: isCard && k === 'income' ? '' : f.source })}>
              {l}
            </button>
          ))}
        </div>
        <Field label="Descrição">
          <input value={f.description} onChange={set('description')} required maxLength={120} />
        </Field>
        <div className="two">
          <Field label={f.installments > 1 ? 'Valor total (R$)' : 'Valor (R$)'}>
            <input inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0,00" required />
          </Field>
          <Field label="Data">
            <input type="date" value={f.date} onChange={set('date')} required />
          </Field>
        </div>
        <Field label="Categoria">
          <select value={f.category_id} onChange={set('category_id')}>
            <option value="">Sem categoria</option>
            {cats.filter((c) => c.kind === f.kind).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label={f.kind === 'expense' ? 'Pago com' : 'Recebido em'}>
          <select value={f.source} onChange={set('source')}>
            <option value="">Sem conta</option>
            {accounts.map((a) => <option key={a.id} value={`a:${a.id}`}>Conta: {a.name}</option>)}
            {f.kind === 'expense' && cards.map((c) => <option key={c.id} value={`c:${c.id}`}>Cartão: {c.name}</option>)}
          </select>
        </Field>
        {f.kind === 'expense' && (
          <Field label="Parcelas">
            <input type="number" min="1" max="60" value={f.installments} onChange={set('installments')} />
          </Field>
        )}
        {Number(f.installments) <= 1 && (
          <label className="check">
            <input type="checkbox" checked={f.repeat} onChange={set('repeat')} /> Repetir todo mês
          </label>
        )}
        {!isCard && Number(f.installments) <= 1 && !f.repeat && (
          <label className="check">
            <input type="checkbox" checked={f.paid} onChange={set('paid')} /> {f.kind === 'expense' ? 'Já foi pago' : 'Já foi recebido'}
          </label>
        )}
        {err && <p className="error">{err}</p>}
        <button className="btn" disabled={busy || !lists.data}>Salvar</button>
      </form>
    </Modal>
  );
}

export function TxEdit({ tx, onClose, onSaved }) {
  const lists = useLoad(() => Promise.all([api('/api/categories'), api('/api/accounts')]), []);
  const [f, setF] = useState({
    description: tx.description, amount: centsToInput(tx.amount_cents), date: tx.date,
    category_id: tx.category_id || '', account_id: tx.account_id || '',
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const [cats, accounts] = lists.data || [[], []];

  async function submit(e) {
    e.preventDefault();
    const cents = toCents(f.amount);
    if (!cents || cents <= 0) return setErr('Informe um valor válido.');
    const body = { description: f.description, amount_cents: cents, date: f.date, category_id: f.category_id || null };
    if (!tx.card_id) body.account_id = f.account_id || null;
    try {
      await api(`/api/transactions/${tx.id}`, { method: 'PATCH', body });
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    }
  }

  return (
    <Modal title="Editar lançamento" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {(tx.installment_total > 1 || tx.recurrence_id) && (
          <p className="muted">Altera somente {tx.installment_total > 1 ? 'esta parcela' : 'este mês'}.</p>
        )}
        <Field label="Descrição"><input value={f.description} onChange={set('description')} required maxLength={120} /></Field>
        <div className="two">
          <Field label="Valor (R$)"><input inputMode="decimal" value={f.amount} onChange={set('amount')} required /></Field>
          <Field label="Data"><input type="date" value={f.date} onChange={set('date')} required /></Field>
        </div>
        <Field label="Categoria">
          <select value={f.category_id} onChange={set('category_id')}>
            <option value="">Sem categoria</option>
            {cats.filter((c) => c.kind === tx.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {!tx.card_id && (
          <Field label="Conta">
            <select value={f.account_id} onChange={set('account_id')}>
              <option value="">Sem conta</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
        )}
        {err && <p className="error">{err}</p>}
        <button className="btn" disabled={!lists.data}>Salvar</button>
      </form>
    </Modal>
  );
}

export function PayModal({ card, accounts, onClose, onConfirm }) {
  const [acc, setAcc] = useState(accounts?.[0]?.id || '');
  return (
    <Modal title={`Pagar fatura ${card.name}`} onClose={onClose}>
      <p className="big sm">{brl(card.total_cents)}</p>
      {accounts?.length ? (
        <>
          <Field label="Pagar com a conta">
            <select value={acc} onChange={(e) => setAcc(e.target.value)}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </Field>
          <button className="btn" onClick={() => onConfirm(acc)}>Confirmar pagamento</button>
        </>
      ) : (
        <p className="muted">Cadastre uma conta em Ajustes para pagar a fatura.</p>
      )}
    </Modal>
  );
}
