import { ChevronRight, CreditCard, Pencil, Plus, Receipt, X } from 'lucide-react';
import { useState } from 'react';
import { api, brl, fmtDateFull } from '../api.js';
import { TxEdit, TxForm } from '../forms.jsx';
import { catStyle } from '../icons.js';
import { IconChip, Loading, Round, useLoad } from '../ui.jsx';

export default function Transactions({ user, month, rev, bump, cards, toggleInvoice, go }) {
  const q = useLoad(() => api(`/api/transactions?month=${month}`), [month, rev]);
  const cats = useLoad(() => api('/api/categories'), [rev]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  if (!q.data) return <section className="panel c-lanc"><Loading q={q} /></section>;

  const rows = [...q.data].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const sum = (k) => rows.filter((t) => t.kind === k).reduce((s, t) => s + t.amount_cents, 0);

  async function toggle(t) {
    await api(`/api/transactions/${t.id}`, { method: 'PATCH', body: { paid: !t.paid } });
    bump();
  }
  async function setCategory(t, id) {
    await api(`/api/transactions/${t.id}`, { method: 'PATCH', body: { category_id: id || null } });
    bump();
  }
  async function remove(t) {
    let scope = '';
    if (t.recurrence_id) {
      if (!confirm('Encerrar esta recorrência a partir deste mês? Os lançamentos daqui para frente serão removidos.')) return;
      scope = '?scope=future';
    } else if (t.installment_total > 1) {
      if (confirm(`Excluir TODAS as ${t.installment_total} parcelas?\n(Cancelar para escolher só esta parcela)`)) scope = '?scope=group';
      else if (!confirm('Excluir somente esta parcela?')) return;
    } else if (!confirm('Excluir este lançamento?')) return;
    await api(`/api/transactions/${t.id}${scope}`, { method: 'DELETE' });
    bump();
  }

  return (
    <section className="panel c-lanc">
      <div className="row between wrap">
        <div className="ph"><IconChip Icon={Receipt} color="#64748b" /><h3>Gastos lançados por {user.name.split(' ')[0]}</h3></div>
        <button className="btn sm" onClick={() => setAdding(true)}><Plus size={16} /> Adicionar gasto</button>
      </div>
      <p className="sub">
        Toque no círculo para marcar como pago ou recebido. Você lançou {brl(sum('expense'))} em despesas e {brl(sum('income'))} em receitas neste mês.
      </p>
      {rows.length === 0 && cards.every((c) => !c.invoice_id) && <p className="muted">Nenhum lançamento neste mês.</p>}
      <ul className="txlist">
        {rows.map((t) => {
          const st = catStyle(t.category_name || (t.kind === 'income' ? 'Receita' : 'Sem categoria'));
          return (
            <li key={t.id} className={`tx ${t.paid ? 'done' : ''}`}>
              {t.card_id
                ? <span className="cardmark" title={`Cartão ${t.card_name}`}><CreditCard size={16} /></span>
                : <Round on={t.paid} onClick={() => toggle(t)} label={t.kind === 'expense' ? 'Marcar como pago' : 'Marcar como recebido'} />}
              <IconChip Icon={st.Icon} color={st.color} size={36} />
              <div className="grow">
                <div className="name">
                  {t.description}
                  {t.installment_total > 1 && <span className="tag">{t.installment_no}/{t.installment_total}</span>}
                  {t.recurrence_id && <span className="tag">mensal</span>}
                </div>
                <small className="muted">{t.kind === 'income' ? 'recebe' : 'vence'} {fmtDateFull(t.date)}</small>
                <div>
                  <select className="mini" aria-label="Categoria" value={t.category_id || ''} onChange={(e) => setCategory(t, e.target.value)}>
                    <option value="">Sem categoria</option>
                    {cats.data?.filter((c) => c.kind === t.kind).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="tx-right">
                <button className="iconbtn" aria-label="Editar" onClick={() => setEditing(t)}><Pencil size={14} /></button>
                <span className={`badge ${t.kind === 'income' ? 'ok' : ''}`}>{t.kind === 'income' ? 'Receita' : t.card_name || t.account_name || 'Sem conta'}</span>
                <b className={t.kind === 'income' ? 'pos' : ''}>{t.kind === 'income' ? '+ ' : ''}{brl(t.amount_cents)}</b>
                <button className="iconbtn" aria-label="Excluir" onClick={() => remove(t)}><X size={16} /></button>
              </div>
            </li>
          );
        })}
        {cards.filter((c) => c.invoice_id && c.total_cents > 0).map((c) => (
          <li key={`i${c.invoice_id}`} className={`tx ${c.paid_at ? 'done' : ''}`}>
            <Round on={!!c.paid_at} onClick={() => toggleInvoice(c)} label={c.paid_at ? 'Desfazer pagamento' : 'Pagar fatura'} />
            <IconChip Icon={CreditCard} color="#6c5ce7" size={36} />
            <div className="grow">
              <div className="name">Fatura do cartão {c.name}</div>
              <small className="muted">vence {fmtDateFull(c.due_date)} · {c.purchases} compra{c.purchases === 1 ? '' : 's'}</small>
            </div>
            <div className="tx-right">
              <b>{brl(c.total_cents)}</b>
              <button className="iconbtn" aria-label="Ver cartão" onClick={() => go('cards')}><ChevronRight size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      {adding && <TxForm month={month} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); bump(); }} />}
      {editing && <TxEdit tx={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); bump(); }} />}
    </section>
  );
}
