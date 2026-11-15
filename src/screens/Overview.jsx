import { CalendarDays, CreditCard, Layers, PieChart, Wallet } from 'lucide-react';
import { useState } from 'react';
import { api, brl, fmtDate, monthLabel } from '../api.js';
import { PayModal } from '../forms.jsx';
import { catStyle } from '../icons.js';
import { IconChip, Loading, Round, Seg, useLoad } from '../ui.jsx';
import Transactions from './Transactions.jsx';

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const short = (c) => `R$ ${Math.round(c / 100).toLocaleString('pt-BR')}`;
const shiftM = (m, n) => {
  const [y, mo] = m.split('-').map(Number);
  const t = y * 12 + mo - 1 + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};

function Saldo({ d, first }) {
  const income = d.salary_cents + d.extra_income_cents;
  const base = Math.max(income, d.expenses_cents + d.invoices_cents) || 1;
  const pct = (v) => `${Math.max(0, (v / base) * 100)}%`;
  const free = Math.max(0, d.forecast_cents);
  const items = [
    ['Contas do mês', d.expenses_cents, '#2f7ae5'],
    ['Faturas de cartão', d.invoices_cents, '#1e3a8a'],
    ['Livre para gastar', d.forecast_cents, '#19b27b'],
  ];
  return (
    <section className="panel tint c-saldo">
      <div className="ph"><IconChip Icon={Wallet} color="#2f7ae5" /><h3>Saldo livre de {first}</h3></div>
      <p className={`big ${d.forecast_cents < 0 ? 'neg' : ''}`}>{brl(d.forecast_cents)}</p>
      <p className="sub">
        {income === 0
          ? 'Defina seu salário em Ajustes ou lance uma receita para ver o saldo.'
          : `Salário de ${brl(d.salary_cents)}${d.extra_income_cents > 0 ? ` mais ${brl(d.extra_income_cents)} de outras receitas` : ''} menos as contas do mês e as faturas de cartão.`}
      </p>
      <div className="seg-bar" aria-hidden="true">
        <i style={{ width: pct(d.expenses_cents), background: items[0][2] }} />
        <i style={{ width: pct(d.invoices_cents), background: items[1][2] }} />
        <i style={{ width: pct(free), background: items[2][2] }} />
      </div>
      <div className="legend3">
        {items.map(([label, v, color]) => (
          <div key={label}>
            <small><i className="dot" style={{ background: color }} />{label}</small>
            <b className={label.startsWith('Livre') ? 'pos' : ''}>{brl(v)}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pagar({ d, month, bump, toggleInvoice }) {
  const [sel, setSel] = useState('all');
  const items = [
    ...d.bills.map((b) => ({ key: `b${b.id}`, id: b.id, name: b.description, date: b.date, amount: b.amount_cents, paid: b.paid, category: b.category_name || 'Sem categoria', note: '' })),
    ...d.cards.filter((c) => c.invoice_id && c.total_cents > 0).map((c) => ({
      key: `i${c.invoice_id}`, card: c, name: `Fatura ${c.name}`, date: c.due_date, amount: c.total_cents,
      paid: !!c.paid_at, category: 'Fatura', note: ` · ${c.purchases} compra${c.purchases === 1 ? '' : 's'}`,
    })),
  ].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const days = [...new Set(items.map((i) => i.date))];
  const cur = days.includes(sel) ? sel : 'all';
  const shown = cur === 'all' ? items : items.filter((i) => i.date === cur);
  const total = items.reduce((s, i) => s + i.amount, 0);
  const open = shown.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0);
  const paidN = items.filter((i) => i.paid).length;

  async function toggle(i) {
    if (i.card) return toggleInvoice(i.card);
    await api(`/api/transactions/${i.id}`, { method: 'PATCH', body: { paid: !i.paid } });
    bump();
  }

  return (
    <section className="panel c-pagar">
      <div className="ph"><IconChip Icon={CalendarDays} color="#f2711c" /><h3>Contas a pagar</h3></div>
      <p className="big md">{brl(total)}</p>
      <p className="sub">Contas e faturas de {lower(monthLabel(month))} · {items.length} vencimento{items.length === 1 ? '' : 's'} · {paidN} de {items.length} pagas</p>
      {days.length > 0 && (
        <div className="days">
          <button className={cur === 'all' ? 'on' : ''} onClick={() => setSel('all')}>
            <b>Todas</b><small>{items.length} contas</small>
          </button>
          {days.map((dt) => {
            const n = items.filter((i) => i.date === dt).length;
            return (
              <button key={dt} className={cur === dt ? 'on' : ''} onClick={() => setSel(dt)}>
                <b>{dt.slice(8, 10)}</b><small>{MONTHS[Number(dt.slice(5, 7)) - 1]}</small>
                <span className="dots">{'•'.repeat(Math.min(n, 3))}</span>
              </button>
            );
          })}
        </div>
      )}
      <div className="row between lh">
        <b>{cur === 'all' ? 'Todas do mês' : `Dia ${cur.slice(8, 10)}`}</b>
        <small className="muted">{brl(open)} em aberto</small>
      </div>
      {items.length === 0 && <p className="muted">Nenhuma conta neste mês.</p>}
      <ul className="plist">
        {shown.map((i) => {
          const st = catStyle(i.category);
          return (
            <li key={i.key} className={i.paid ? 'done' : ''}>
              <Round on={i.paid} onClick={() => toggle(i)} label={i.paid ? 'Desfazer pagamento' : 'Marcar como pago'} />
              <IconChip Icon={st.Icon} color={st.color} size={34} />
              <div className="grow">
                <div className="name">{i.name}</div>
                <small className="muted">vence {fmtDate(i.date)}{i.note}</small>
              </div>
              <b>{brl(i.amount)}</b>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Donut({ list, total }) {
  const R = 44;
  const C = 2 * Math.PI * R;
  let off = 0;
  return (
    <svg viewBox="0 0 120 120" className="donut" role="img" aria-label="Gastos por categoria">
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--soft)" strokeWidth="16" />
      {list.map((x) => {
        const len = (x.total / total) * C;
        const el = (
          <circle key={x.name} cx="60" cy="60" r={R} fill="none" stroke={catStyle(x.name).color} strokeWidth="16"
            strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} transform="rotate(-90 60 60)" />
        );
        off += len;
        return el;
      })}
      <text x="60" y="56" textAnchor="middle" className="dt">Total</text>
      <text x="60" y="70" textAnchor="middle" className="dv">{brl(total)}</text>
    </svg>
  );
}

function Categorias({ d, month }) {
  const [src, setSrc] = useState('all');
  const rows = d.spending.filter((r) => src === 'all' || (src === 'card') === r.is_card);
  const sumBy = (arr) => {
    const by = {};
    for (const r of arr) by[r.category] = (by[r.category] || 0) + r.total_cents;
    return by;
  };
  const list = Object.entries(sumBy(rows.filter((r) => r.month === month)))
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total);
  const total = list.reduce((s, x) => s + x.total, 0);

  const months = [-5, -4, -3, -2, -1, 0].map((i) => shiftM(month, i));
  const hist = months.map((m) => {
    const by = sumBy(rows.filter((r) => r.month === m));
    return { m, by, total: Object.values(by).reduce((s, v) => s + v, 0) };
  });
  const maxTotal = Math.max(1, ...hist.map((h) => h.total));
  const order = Object.entries(sumBy(rows)).sort((a, b) => b[1] - a[1]).map(([n]) => n);

  return (
    <section className="panel c-cats">
      <div className="row between wrap">
        <div className="ph"><IconChip Icon={PieChart} color="#2f7ae5" /><h3>Gastos por categoria</h3></div>
        <Seg value={src} onChange={setSrc} options={[['all', 'Tudo'], ['account', 'Conta'], ['card', 'Cartão']]} />
      </div>
      <p className="sub">Mês selecionado, por categoria</p>
      {total === 0 ? (
        <p className="muted">Sem gastos neste mês.</p>
      ) : (
        <div className="catrow">
          <Donut list={list} total={total} />
          <ul className="catlist">
            {list.map((x) => {
              const st = catStyle(x.name);
              const p = (x.total / total) * 100;
              return (
                <li key={x.name}>
                  <IconChip Icon={st.Icon} color={st.color} size={26} />
                  <div className="grow">
                    <div className="row between"><span>{x.name}</span><b>{brl(x.total)} <small className="muted">{Math.round(p)}%</small></b></div>
                    <div className="thin"><i style={{ width: `${p}%`, background: st.color }} /></div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <h4>Últimos 6 meses</h4>
      <div className="hist">
        {hist.map((h) => (
          <div key={h.m} className="hcol">
            <small className="hval">{h.total > 0 ? short(h.total) : ''}</small>
            <div className="hbar">
              {order.filter((n) => h.by[n]).map((n) => (
                <i key={n} title={`${n}: ${brl(h.by[n])}`} style={{ height: `${(h.by[n] / maxTotal) * 110}px`, background: catStyle(n).color }} />
              ))}
            </div>
            <small className={h.m === month ? 'hm now' : 'hm'}>{MONTHS[Number(h.m.slice(5)) - 1]}</small>
          </div>
        ))}
      </div>
      <div className="hleg">
        {order.map((n) => <span key={n}><i className="dot" style={{ background: catStyle(n).color }} />{n}</span>)}
      </div>
    </section>
  );
}

function Parceladas({ d, month }) {
  const sumMonth = d.installments.reduce((s, x) => s + (x.month_cents || 0), 0);
  const sumRem = d.installments.reduce((s, x) => s + x.remaining_cents, 0);
  return (
    <section className="panel c-parc">
      <div className="ph"><IconChip Icon={Layers} color="#6c5ce7" /><h3>Compras parceladas</h3></div>
      <p className="sub">Parcelas em {lower(monthLabel(month))}: {brl(sumMonth)} · ainda faltam {brl(sumRem)} nos próximos meses</p>
      <p className="big md">{d.installments.length} compra{d.installments.length === 1 ? '' : 's'}</p>
      {d.installments.map((x) => {
        const done = x.current_no / x.total;
        return (
          <div className="inst" key={x.id}>
            <div className="row between top">
              <div>
                <div className="name">{x.description} <span className="tag">{x.current_no}/{x.total}</span></div>
                <small className="muted">{brl(x.month_cents)} por mês{x.category_name ? ` · ${x.category_name}` : ''}</small><br />
                <small className="muted">
                  {x.remaining_n === 0 ? 'Última parcela' : `Faltam ${x.remaining_n} parcela${x.remaining_n === 1 ? '' : 's'} (${brl(x.remaining_cents)}) · última em ${lower(monthLabel(x.last_date.slice(0, 7)))}`}
                </small>
              </div>
              <div className="right"><b>{brl(x.remaining_cents || x.month_cents)}</b><br /><small className="muted">a pagar</small></div>
            </div>
            <div className="thin lg"><i style={{ width: `${done * 100}%`, background: 'var(--accent)' }} /></div>
          </div>
        );
      })}
    </section>
  );
}

function Faturas({ d, go }) {
  return (
    <section className="panel c-fat">
      <div className="ph"><IconChip Icon={CreditCard} color="#6c5ce7" /><h3>Faturas dos cartões</h3></div>
      <p className="sub">Fatura do mês de cada cartão e o limite que ainda está disponível.</p>
      <p className="big md">{brl(d.invoices_cents)}</p>
      {d.cards.length === 0 && <p className="muted">Nenhum cartão cadastrado.</p>}
      <ul className="plist">
        {d.cards.map((c) => (
          <li key={c.id}>
            <IconChip Icon={CreditCard} color="#6c5ce7" size={34} />
            <div className="grow">
              <div className="name">{c.name}</div>
              <small className="muted">vence {fmtDate(c.due_date)} · disponível {brl(c.available_cents)}</small>
            </div>
            <b>{brl(c.total_cents)}</b>
            <span className={`badge ${c.paid_at ? 'ok' : ''}`}>{c.paid_at ? 'Paga' : 'Aberta'}</span>
          </li>
        ))}
      </ul>
      <button className="link" onClick={() => go('cards')}>Gerenciar cartões</button>
    </section>
  );
}

export default function Overview({ user, month, rev, bump, go }) {
  const o = useLoad(() => api(`/api/overview?month=${month}`), [month, rev]);
  const acc = useLoad(() => api('/api/accounts'), [rev]);
  const [pay, setPay] = useState(null);
  const d = o.data;
  if (!d) return <Loading q={o} />;
  const first = user.name.split(' ')[0];

  async function toggleInvoice(c) {
    if (c.paid_at) {
      await api(`/api/invoices/${c.invoice_id}/pay`, { method: 'POST', body: { paid: false } });
      bump();
    } else setPay(c);
  }
  async function confirmPay(accountId) {
    await api(`/api/invoices/${pay.invoice_id}/pay`, { method: 'POST', body: { paid: true, account_id: accountId } });
    setPay(null);
    bump();
  }

  return (
    <div className="dash">
      <Saldo d={d} first={first} />
      <Pagar d={d} month={month} bump={bump} toggleInvoice={toggleInvoice} />
      <Categorias d={d} month={month} />
      <Parceladas d={d} month={month} />
      <Faturas d={d} go={go} />
      <Transactions user={user} month={month} rev={rev} bump={bump} cards={d.cards} toggleInvoice={toggleInvoice} go={go} />
      {pay && <PayModal card={pay} accounts={acc.data} onClose={() => setPay(null)} onConfirm={confirmPay} />}
    </div>
  );
}
