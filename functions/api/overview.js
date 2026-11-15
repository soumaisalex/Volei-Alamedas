import { daysIn, iso, monthRange, shiftMonth, validMonth } from '../_lib/dates.js';
import { materialize } from '../_lib/finance.js';
import { bad, json } from '../_lib/http.js';
import { db } from '../_lib/users.js';

// previsto = salário + outras receitas − despesas em conta − faturas do mês
export async function onRequestGet({ request, env, data }) {
  const month = new URL(request.url).searchParams.get('month');
  if (!validMonth(month)) return bad('Mês inválido.');
  const sql = db(env);
  const uid = data.userId;
  const { start, end } = monthRange(month);
  const { start: since } = monthRange(shiftMonth(month, -5));
  const [y, m] = month.split('-').map(Number);

  // Recorrências dos últimos 6 meses (gráfico) e do mês atual.
  await Promise.all([-5, -4, -3, -2, -1, 0].map((i) => materialize(sql, uid, shiftMonth(month, i))));

  const [[me], [agg], bills, cardRows, spending, installments] = await Promise.all([
    sql`select monthly_income_cents from users where id = ${uid}`,
    sql`
      select
        coalesce(sum(amount_cents) filter (where kind = 'income'), 0) as extra_income_cents,
        coalesce(sum(amount_cents) filter (where kind = 'expense' and card_id is null), 0) as expenses_cents,
        coalesce(sum(amount_cents) filter (where kind = 'expense' and card_id is null and not paid), 0) as pending_cents
      from transactions
      where user_id = ${uid} and date >= ${start}::date and date < ${end}::date`,
    sql`
      select t.id, t.description, t.amount_cents, t.date::text as date, t.paid, t.account_id,
             c.name as category_name
      from transactions t left join categories c on c.id = t.category_id
      where t.user_id = ${uid} and t.kind = 'expense' and t.card_id is null
        and t.date >= ${start}::date and t.date < ${end}::date
      order by t.date, t.created_at`,
    sql`
      select k.id, k.name, k.limit_cents, k.closing_day, k.due_day,
        i.id as invoice_id, i.paid_at, coalesce(sum(t.amount_cents), 0) as total_cents,
        count(t.id)::int as purchases,
        (k.limit_cents - coalesce((select sum(x.amount_cents) from transactions x
           join invoices xi on xi.id = x.invoice_id
           where x.card_id = k.id and xi.paid_at is null), 0))::bigint as available_cents
      from credit_cards k
      left join invoices i on i.card_id = k.id and i.ref_month = ${start}::date
      left join transactions t on t.invoice_id = i.id
      where k.user_id = ${uid} and not k.archived
      group by k.id, i.id
      order by k.name`,
    sql`
      select to_char(t.date, 'YYYY-MM') as month, coalesce(c.name, 'Sem categoria') as category,
             (t.card_id is not null) as is_card, sum(t.amount_cents) as total_cents
      from transactions t left join categories c on c.id = t.category_id
      where t.user_id = ${uid} and t.kind = 'expense'
        and t.date >= ${since}::date and t.date < ${end}::date
      group by 1, 2, 3`,
    sql`
      select t.installment_group as id, min(t.description) as description, min(c.name) as category_name,
        max(case when t.date >= ${start}::date and t.date < ${end}::date then t.installment_no end) as current_no,
        max(t.installment_total) as total,
        max(case when t.date >= ${start}::date and t.date < ${end}::date then t.amount_cents end) as month_cents,
        coalesce(sum(t.amount_cents) filter (where t.date >= ${end}::date), 0) as remaining_cents,
        (count(*) filter (where t.date >= ${end}::date))::int as remaining_n,
        max(t.date)::text as last_date
      from transactions t left join categories c on c.id = t.category_id
      where t.user_id = ${uid} and t.installment_group in (
        select installment_group from transactions
        where user_id = ${uid} and installment_group is not null
          and date >= ${start}::date and date < ${end}::date)
      group by t.installment_group
      order by month_cents desc nulls last`,
  ]);

  const cards = cardRows.map((c) => ({
    ...c,
    due_date: iso(y, m, Math.min(c.due_day, daysIn(y, m))),
  }));
  const salary = Number(me.monthly_income_cents);
  const extra = Number(agg.extra_income_cents);
  const expenses = Number(agg.expenses_cents);
  const invoices = cards.reduce((s, c) => s + Number(c.total_cents), 0);

  return json({
    month,
    salary_cents: salary,
    extra_income_cents: extra,
    expenses_cents: expenses,
    pending_cents: Number(agg.pending_cents),
    invoices_cents: invoices,
    forecast_cents: salary + extra - expenses - invoices,
    bills,
    cards,
    spending,
    installments,
  });
}
