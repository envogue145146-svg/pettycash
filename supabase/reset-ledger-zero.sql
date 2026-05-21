update public.cash_ledgers as ledger
set
  opening_balance = 0,
  current_balance = 0 + coalesce((
    select sum(case when expense.transaction_type = 'credit' then expense.amount else -expense.amount end)
    from public.expenses as expense
    where expense.ledger_id = ledger.id
      and expense.status = 'approved'
  ), 0);
