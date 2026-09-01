/* ==========================================================================
   MyCashFlow — page renderers
   Each Pages.x(ctx) returns HTML. Each Pages.x_wire(root) attaches handlers.
   ctx = { month }
   ========================================================================== */

const Pages = {};

/* ========================================================== DASHBOARD === */
Pages.dashboard = (ctx) => {
  const m = ctx.month;
  const isNow = m === D.thisMonth();
  const inc = Q.income(m), exp = Q.expense(m), flow = inc - exp;
  const bal = Q.totalBalance();
  const avail = Q.availableMoney();
  const sav = Q.totalSavings();
  const mom = Q.momChange(m);
  const imom = Q.incomeMomChange(m);
  const series = Q.monthSeries(6, m);
  const daily = Q.dailySeries(m);
  const cats = Q.byCategory(m, 'expense');
  const recent = Q.sorted().filter(t => true).slice(0, 7);
  const budgets = Q.budgetProgress(m);
  const goals = Q.goalProgress();
  const insights = Q.insights(m);
  const upcoming = Q.upcomingRecurring(14);
  const bt = Q.budgetTotals(m);

  const balSpark = Q.balanceSeries(m).map(d => M.toNum(d.balance));
  const expSpark = daily.map(d => M.toNum(d.total));
  const incSpark = series.map(s => M.toNum(s.income));

  return `
  <!-- HERO -->
  <div class="hero mb20 anim-in">
    <div class="row between wrap g20">
      <div style="position:relative">
        <div class="row g8">
          <span class="eyebrow">Total Balance</span>
          <span class="badge badge-mute">${DB.state.wallets.length} wallets</span>
        </div>
        <div class="hero-val money mt8">${M.fmt(bal)}</div>
        <div class="row g14 wrap mt12">
          <span class="badge ${flow >= 0 ? 'badge-up' : 'badge-down'}">
            ${flow >= 0 ? '▲' : '▼'} ${M.fmt(Math.abs(flow))} cash flow
          </span>
          <span class="t-sm muted">${isNow ? 'This month' : D.monthName(m, true)} · ${esc(DB.state.settings.name || 'You')}</span>
        </div>
      </div>
      <div class="col g10" style="position:relative;min-width:196px">
        <div class="row between g16" style="padding:11px 14px;background:rgba(0,0,0,.28);border-radius:14px">
          <div><div class="t-xs faint">Available to spend</div><div class="t-lg w7 money">${M.fmt(avail)}</div></div>
          <span style="font-size:1.3rem">💵</span>
        </div>
        <div class="row between g16" style="padding:11px 14px;background:rgba(0,0,0,.28);border-radius:14px">
          <div><div class="t-xs faint">Total savings</div><div class="t-lg w7 money warnc">${M.fmt(sav)}</div></div>
          <span style="font-size:1.3rem">🏦</span>
        </div>
      </div>
    </div>
  </div>

  <!-- STATS -->
  <div class="grid g-4 mb20">
    ${P.statCard({
      label: 'Total Income', value: M.fmt(inc), icon: '📈',
      iconBg: 'var(--up-dim)', accent: 'var(--grad-up)',
      badge: P.momBadge(imom),
      spark: incSpark, sparkColor: '#34d399'
    })}
    ${P.statCard({
      label: 'Total Expenses', value: M.fmt(exp), icon: '📉',
      iconBg: 'var(--down-dim)', accent: 'var(--grad-down)',
      badge: P.momBadge(mom, { invert: true, pace: true }),
      spark: expSpark, sparkColor: '#fb7185'
    })}
    ${P.statCard({
      label: 'Monthly Cash Flow', value: M.fmt(flow, { sign: true }), icon: '📊',
      iconBg: flow >= 0 ? 'var(--up-dim)' : 'var(--down-dim)',
      accent: flow >= 0 ? 'var(--grad-up)' : 'var(--grad-down)',
      sub: `Income − Expenses · ${Q.savingsRate(m).toFixed(0)}% saved`,
      spark: series.map(s => M.toNum(s.net)), sparkColor: flow >= 0 ? '#34d399' : '#fb7185'
    })}
    ${P.statCard({
      label: 'Balance Trend', value: M.fmt(bal), icon: '💰',
      iconBg: 'var(--brand-dim)', accent: 'var(--grad-brand)',
      sub: `Across ${DB.state.wallets.length} wallets`,
      spark: balSpark, sparkColor: '#7c6cff'
    })}
  </div>

  <!-- QUICK SPEND SNAPSHOT -->
  <div class="grid g-4 mb20">
    <div class="card card-tight">
      <div class="row between g8"><span class="t-xs faint">Spent today</span><span style="font-size:.95rem">☀️</span></div>
      <div class="t-lg w7 money mt4">${M.fmt(Q.spentToday())}</div>
    </div>
    <div class="card card-tight">
      <div class="row between g8"><span class="t-xs faint">This week</span><span style="font-size:.95rem">📆</span></div>
      <div class="t-lg w7 money mt4">${M.fmt(Q.spentThisWeek())}</div>
    </div>
    <div class="card card-tight">
      <div class="row between g8"><span class="t-xs faint">Avg / day</span><span style="font-size:.95rem">🧮</span></div>
      <div class="t-lg w7 money mt4">${M.fmt(Q.avgDailySpend(m))}</div>
    </div>
    <div class="card card-tight">
      <div class="row between g8"><span class="t-xs faint">Top category</span><span style="font-size:.95rem">${cats[0] ? cats[0].icon : '📦'}</span></div>
      <div class="t-md w7 mt4 truncate">${cats[0] ? esc(cats[0].name) : '—'}</div>
      <div class="t-xs dim">${cats[0] ? M.fmt(cats[0].total) : 'No spending yet'}</div>
    </div>
  </div>

  <!-- MAIN SPLIT -->
  <div class="grid dash-split mb20" style="grid-template-columns:minmax(0,1.55fr) minmax(0,1fr)">
    <div class="card">
      <div class="card-hd">
        <div>
          <h2>Income vs Expenses</h2>
          <div class="t-xs dim mt4">Last 6 months</div>
        </div>
        ${C.legend([{ name: 'Income', color: '#34d399' }, { name: 'Expenses', color: '#fb7185' }])}
      </div>
      <div class="chart">${C.groupBars(
        series.map(s => ({ label: s.label, fullLabel: D.monthName(s.mk, true), income: s.income, expense: s.expense })),
        { h: 260, fmt: (v, full) => full ? M.fmt(v) : M.short(v) }
      )}</div>
    </div>

    <div class="card">
      <div class="card-hd">
        <div><h2>Spending by Category</h2><div class="t-xs dim mt4">${D.monthName(m, true)}</div></div>
      </div>
      ${cats.length ? `
        <div class="chart mb16">${C.donut(cats.slice(0, 8), {
          size: 190, thick: 24, fmt: (v, full) => full ? M.fmt(v) : M.short(v),
          centerTop: 'TOTAL SPENT', centerBot: M.short(exp)
        })}</div>
        <div class="col g8">
          ${cats.slice(0, 5).map(c => `
            <div class="row g10">
              <span class="leg-sw" style="background:${c.color}"></span>
              <span class="t-sm grow truncate">${c.icon} ${esc(c.name)}</span>
              <span class="t-sm w6 num">${M.fmt(c.total)}</span>
              <span class="t-xs faint num" style="width:38px;text-align:right">${c.pct.toFixed(0)}%</span>
            </div>`).join('')}
          ${cats.length > 5 ? `<button class="btn btn-xs mt8" data-go="analytics">View all ${cats.length} categories →</button>` : ''}
        </div>`
        : P.empty('🥧', 'No spending yet', 'Add your first expense to see the breakdown.')}
    </div>
  </div>

  <!-- DAILY SPEND -->
  <div class="card mb20">
    <div class="card-hd">
      <div><h2>Daily Spending</h2><div class="t-xs dim mt4">${D.monthName(m, true)} · bar height = amount spent that day</div></div>
      <span class="badge badge-mute">Peak ${M.short(Math.max(...daily.map(d => d.total), 0))}</span>
    </div>
    <div class="chart">${C.bars(
      daily.map(d => ({ label: String(d.day), fullLabel: D.pretty(d.date), value: d.total, color: d.total > 0 ? '#7c6cff' : 'rgba(255,255,255,.08)' })),
      { h: 190, fmt: (v, full) => full ? M.fmt(v) : M.short(v), maxBarW: 18 }
    )}</div>
  </div>

  <!-- RECENT + INSIGHTS -->
  <div class="grid dash-split mb20" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)">
    <div class="card card-pad-0">
      <div class="card-hd" style="padding:18px 18px 0;margin-bottom:12px">
        <div><h2>Recent Transactions</h2><div class="t-xs dim mt4">Your latest activity</div></div>
        <button class="btn btn-sm" data-go="history">View all →</button>
      </div>
      ${recent.length ? `<div class="tx-list" style="padding:0 8px 10px">${recent.map(t => P.txRow(t)).join('')}</div>`
        : P.empty('🧾', 'No transactions yet', 'Tap the ＋ button to record your first income or expense.')}
    </div>

    <div class="col g12">
      <div class="card">
        <div class="card-hd"><div><h2>Insights</h2><div class="t-xs dim mt4">Automatic analysis</div></div></div>
        <div class="col g10">${insights.slice(0, 4).map(P.insightRow).join('') || P.empty('💡', 'Not enough data', 'Add a few transactions to unlock insights.')}</div>
        ${insights.length > 4 ? `<button class="btn btn-sm btn-full mt12" data-go="analytics">See all insights →</button>` : ''}
      </div>
    </div>
  </div>

  <!-- BUDGETS + GOALS + UPCOMING -->
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card">
      <div class="card-hd">
        <div><h2>Budget Progress</h2>
          <div class="t-xs dim mt4">${bt.count ? `${M.fmt(bt.spent)} of ${M.fmt(bt.limit)} used` : 'No budgets set'}</div>
        </div>
        <button class="btn btn-sm" data-go="budgets">Manage</button>
      </div>
      ${budgets.length ? `<div class="col g12">
        ${budgets.slice(0, 4).map(b => `
          <div>
            <div class="row between g8 mb8">
              <span class="t-sm w6 truncate">${b.icon} ${esc(b.name)}</span>
              <span class="t-xs num nowrap ${b.status === 'over' ? 'down' : b.status === 'warn' ? 'warnc' : 'dim'}">
                ${M.fmt(b.spent)} / ${M.fmt(b.limit)}
              </span>
            </div>
            <div class="bar"><div class="bar-fill ${b.status}" style="width:${Math.min(100, b.pct)}%"></div></div>
            <div class="row between mt4">
              ${C.blocks(b.pct, 10, b.status === 'over' ? 'var(--down)' : b.status === 'warn' ? 'var(--warn)' : b.color)}
              <span class="t-xs w7 ${b.status === 'over' ? 'down' : b.status === 'warn' ? 'warnc' : 'dim'}">${b.pct.toFixed(0)}%</span>
            </div>
          </div>`).join('')}
      </div>` : P.empty('🎯', 'No budgets yet', 'Set spending limits to keep your cash flow under control.',
        `<button class="btn btn-p btn-sm" data-go="budgets">Set a budget</button>`)}
    </div>

    <div class="card">
      <div class="card-hd">
        <div><h2>Savings Goals</h2><div class="t-xs dim mt4">${goals.length} active · ${M.fmt(Q.goalsSaved())} saved</div></div>
        <button class="btn btn-sm" data-go="goals">Manage</button>
      </div>
      ${goals.length ? `<div class="col g14">
        ${goals.slice(0, 4).map(g => `
          <div class="row g12">
            ${C.ring(g.pct, { size: 46, thick: 5, color: g.done ? '#34d399' : '#7c6cff' })}
            <div class="grow" style="min-width:0">
              <div class="row between g8">
                <span class="t-sm w6 truncate">${g.icon} ${esc(g.name)}</span>
                <span class="t-xs num nowrap dim">${M.short(g.saved)} / ${M.short(g.target)}</span>
              </div>
              <div class="bar bar-sm mt4"><div class="bar-fill ${g.done ? 'ok' : ''}" style="width:${g.pct}%"></div></div>
            </div>
          </div>`).join('')}
      </div>` : P.empty('🏆', 'No goals yet', 'Create a savings goal and watch your progress grow.',
        `<button class="btn btn-p btn-sm" data-go="goals">Create a goal</button>`)}
    </div>

    <div class="card">
      <div class="card-hd">
        <div><h2>Coming Up</h2><div class="t-xs dim mt4">Next 14 days</div></div>
        <button class="btn btn-sm" data-go="recurring">Manage</button>
      </div>
      ${upcoming.length ? `<div class="col g10">
        ${upcoming.slice(0, 5).map(r => {
          const c = Q.cat(r.cat);
          const soon = D.diffDays(D.today(), r.next) <= 1;
          return `<div class="row g10">
            <div class="cat-av cat-av-sm" style="background:${c.color}22;border-color:${c.color}44">${c.icon}</div>
            <div class="grow" style="min-width:0">
              <div class="t-sm w6 truncate">${esc(r.label)}</div>
              <div class="t-xs ${soon ? 'warnc' : 'dim'}">${esc(D.rel(r.next))} · ${esc(D.short(r.next))}</div>
            </div>
            <div class="t-sm w7 num ${r.type === 'income' ? 'up' : 'down'}">${r.type === 'income' ? '+' : '−'}${M.fmt(r.amount)}</div>
          </div>`;
        }).join('')}
      </div>` : P.empty('🔁', 'Nothing scheduled', 'Add recurring bills or income to never miss a payment.',
        `<button class="btn btn-p btn-sm" data-go="recurring">Add recurring</button>`)}
    </div>
  </div>`;
};

/* ============================================================== INCOME === */
Pages.income = (ctx) => {
  const m = ctx.month;
  const f = App.filters.income;
  const list = Q.sorted(Q.filter({ type: 'income', month: f.month, q: f.q, cat: f.cat, wallet: f.wallet }));
  const total = Q.sum(list);
  const monthInc = Q.income(m);
  const cats = Q.byCategory(f.month === 'all' ? null : f.month, 'income');
  const mom = Q.incomeMomChange(m);
  const series = Q.monthSeries(6, m);
  const recurInc = Q.recurringMonthlyTotal('income');

  return `
  ${P.sectionHead('Income Tracker', 'Every ringgit coming in — salary, freelance, gifts and more',
    `<button class="btn btn-up" data-add="income">＋ Add Income</button>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: `Income · ${D.monthName(m, true)}`, value: M.fmt(monthInc), icon: '💵',
      iconBg: 'var(--up-dim)', accent: 'var(--grad-up)',
      badge: P.momBadge(mom), spark: series.map(s => M.toNum(s.income)), sparkColor: '#34d399' })}
    ${P.statCard({ label: 'Matching filters', value: M.fmt(total), icon: '🔍',
      iconBg: 'var(--info-dim)', accent: 'var(--grad-brand)', sub: `${list.length} transaction${list.length === 1 ? '' : 's'}` })}
    ${P.statCard({ label: 'Top income source', value: cats[0] ? M.fmt(cats[0].total) : M.fmt(0), icon: cats[0] ? cats[0].icon : '📥',
      iconBg: 'var(--warn-dim)', accent: 'var(--grad-brand)', sub: cats[0] ? esc(cats[0].name) : 'No income yet' })}
    ${P.statCard({ label: 'Expected recurring', value: M.fmt(recurInc), icon: '🔁',
      iconBg: 'var(--brand-dim)', accent: 'var(--grad-brand)', sub: 'Per month, from active schedules' })}
  </div>

  <div class="grid mb20" style="grid-template-columns:minmax(0,1.4fr) minmax(0,1fr)">
    <div class="card">
      <div class="card-hd"><div><h2>Income Trend</h2><div class="t-xs dim mt4">Last 6 months</div></div></div>
      <div class="chart">${C.line(
        [{ name: 'Income', color: '#34d399', values: series.map(s => M.toNum(s.income)), area: true }],
        series.map(s => s.label), { h: 220, fmt: (v, full) => full ? M.fmt(M.parse(v)) : M.short(M.parse(v)) }
      )}</div>
    </div>
    <div class="card">
      <div class="card-hd"><div><h2>By Source</h2><div class="t-xs dim mt4">${f.month === 'all' ? 'All time' : D.monthName(f.month, true)}</div></div></div>
      ${cats.length ? `<div class="chart">${C.hBars(
        cats.slice(0, 7).map(c => ({ label: c.name, value: c.total, color: c.color, icon: c.icon })),
        { fmt: (v, full) => full ? M.fmt(v) : M.short(v) }
      )}</div>` : P.empty('📥', 'No income recorded', 'Add income to see where your money comes from.')}
    </div>
  </div>

  <div class="card card-pad-0">
    <div style="padding:18px 18px 14px">
      <div class="row between g12 wrap mb12">
        <h2>Income History</h2>
        <span class="badge badge-up">${list.length} records · ${M.fmt(total)}</span>
      </div>
      <div class="row g10 wrap">
        <div class="search">
          <span class="si">🔍</span>
          <input class="inp" placeholder="Search income, source, notes…" data-filter="q" data-scope="income" value="${esc(f.q)}">
        </div>
        <select class="sel" data-filter="month" data-scope="income" style="width:auto;min-width:150px">
          <option value="all" ${f.month === 'all' ? 'selected' : ''}>All months</option>
          ${Q.activeMonths().map(mm => `<option value="${mm}" ${f.month === mm ? 'selected' : ''}>${D.monthName(mm, true)}</option>`).join('')}
        </select>
        <select class="sel" data-filter="cat" data-scope="income" style="width:auto;min-width:150px">
          <option value="all" ${f.cat === 'all' ? 'selected' : ''}>All categories</option>
          ${Q.incomeCats().map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
        </select>
        <select class="sel" data-filter="wallet" data-scope="income" style="width:auto;min-width:150px">
          <option value="all" ${f.wallet === 'all' ? 'selected' : ''}>All wallets</option>
          ${DB.state.wallets.map(w => `<option value="${w.id}" ${f.wallet === w.id ? 'selected' : ''}>${w.icon} ${esc(w.name)}</option>`).join('')}
        </select>
        ${(f.q || f.month !== 'all' || f.cat !== 'all' || f.wallet !== 'all')
          ? `<button class="btn btn-sm" data-clear="income">✕ Clear</button>` : ''}
      </div>
    </div>
    ${list.length ? `<div class="tx-list" style="padding:0 8px 10px">${list.map(t => P.txRow(t)).join('')}</div>`
      : P.empty('💵', 'No income found', f.q || f.cat !== 'all' ? 'Try adjusting your search or filters.' : 'Record your salary, allowance or freelance payments to get started.',
        `<button class="btn btn-up btn-sm" data-add="income">＋ Add Income</button>`)}
  </div>`;
};

/* ===================================================== SPENDING WALLET === */
Pages.spending = (ctx) => {
  const m = ctx.month;
  const f = App.filters.spending;
  const list = Q.sorted(Q.filter({
    type: 'expense', month: f.month, q: f.q, cat: f.cat, wallet: f.wallet,
    method: f.method, from: f.from, to: f.to
  }));
  const total = Q.sum(list);
  const cats = Q.byCategory(m, 'expense');
  const top = cats[0];
  const mom = Q.momChange(m);
  const methods = Q.byPaymentMethod(m);
  const daily = Q.dailySeries(m);
  const budgets = Q.budgetProgress(m);
  const alerts = budgets.filter(b => b.status !== 'ok');

  return `
  ${P.sectionHead('Spending Wallet', 'See exactly where your money goes — by category, wallet and payment method',
    `<div class="row g8">
      <button class="btn btn-sm" data-newcat>🏷️ New category</button>
      <button class="btn btn-dn" data-add="expense">＋ Add Expense</button>
    </div>`)}

  ${alerts.length ? `<div class="col g10 mb20">
    ${alerts.slice(0, 3).map(b => `
      <div class="insight" style="border-color:${b.status === 'over' ? 'rgba(251,113,133,.4)' : 'rgba(251,191,36,.4)'}">
        <div class="insight-ic" style="background:${b.status === 'over' ? 'var(--down-dim)' : 'var(--warn-dim)'};color:${b.status === 'over' ? 'var(--down)' : 'var(--warn)'}">
          ${b.status === 'over' ? '🚨' : '⚠️'}
        </div>
        <div class="grow t-sm muted" style="align-self:center;line-height:1.6">
          You have used <b>${b.pct.toFixed(0)}%</b> of your <b>${b.icon} ${esc(b.name)}</b> budget.
          ${b.remaining >= 0 ? `${M.fmt(b.remaining)} left this month.` : `You are ${M.fmt(Math.abs(b.remaining))} over the limit.`}
        </div>
        <button class="btn btn-xs" data-go="budgets" style="align-self:center">Review</button>
      </div>`).join('')}
  </div>` : ''}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Spent today', value: M.fmt(Q.spentToday()), icon: '☀️',
      iconBg: 'var(--warn-dim)', accent: 'var(--grad-brand)', sub: D.pretty(D.today()) })}
    ${P.statCard({ label: 'Spent this week', value: M.fmt(Q.spentThisWeek()), icon: '📆',
      iconBg: 'var(--info-dim)', accent: 'var(--grad-brand)', sub: `Since ${D.short(D.weekStart(D.today()))}` })}
    ${P.statCard({ label: `Spent · ${D.monthName(m, true)}`, value: M.fmt(Q.expense(m)), icon: '📉',
      iconBg: 'var(--down-dim)', accent: 'var(--grad-down)',
      badge: P.momBadge(mom, { invert: true, pace: true }),
      spark: daily.map(d => M.toNum(d.total)), sparkColor: '#fb7185' })}
    ${P.statCard({ label: 'Highest spending category', value: top ? M.fmt(top.total) : M.fmt(0),
      icon: top ? top.icon : '📦', iconBg: 'var(--brand-dim)', accent: 'var(--grad-brand)',
      sub: top ? `${esc(top.name)} · ${top.pct.toFixed(0)}% of spending` : 'No spending yet' })}
  </div>

  <div class="grid mb20" style="grid-template-columns:repeat(auto-fit,minmax(290px,1fr))">
    <div class="card">
      <div class="card-hd"><div><h2>Where It Goes</h2><div class="t-xs dim mt4">${D.monthName(m, true)}</div></div></div>
      ${cats.length ? `<div class="chart">${C.hBars(
        cats.slice(0, 8).map(c => ({ label: c.name, value: c.total, color: c.color, icon: c.icon })),
        { fmt: (v, full) => full ? M.fmt(v) : M.short(v) })}</div>`
        : P.empty('🛒', 'No expenses yet', 'Add an expense to see your spending breakdown.')}
    </div>
    <div class="card">
      <div class="card-hd"><div><h2>Category Share</h2><div class="t-xs dim mt4">Proportion of total spending</div></div></div>
      ${cats.length ? `<div class="chart">${C.donut(cats.slice(0, 9), {
        size: 200, thick: 25, fmt: (v, full) => full ? M.fmt(v) : M.short(v),
        centerTop: 'TOTAL', centerBot: M.short(Q.expense(m)) })}</div>`
        : P.empty('🥧', 'Nothing to show', 'Your category chart appears once you log expenses.')}
    </div>
    <div class="card">
      <div class="card-hd"><div><h2>Payment Methods</h2><div class="t-xs dim mt4">How you pay</div></div></div>
      ${methods.length ? `<div class="col g12">
        ${methods.map(mm => {
          const pct = Q.expense(m) ? mm.total / Q.expense(m) * 100 : 0;
          return `<div>
            <div class="row between g8 mb4">
              <span class="t-sm w6 truncate">${esc(mm.name)}</span>
              <span class="t-sm w6 num">${M.fmt(mm.total)}</span>
            </div>
            <div class="bar bar-sm"><div class="bar-fill" style="width:${pct}%"></div></div>
          </div>`;
        }).join('')}
      </div>` : P.empty('💳', 'No data', 'Payment method breakdown appears here.')}
    </div>
  </div>

  <div class="card card-pad-0">
    <div style="padding:18px 18px 14px">
      <div class="row between g12 wrap mb12">
        <div><h2>Expense History</h2><div class="t-xs dim mt4">Search, filter and manage every expense</div></div>
        <span class="badge badge-down">${list.length} records · ${M.fmt(total)}</span>
      </div>
      <div class="row g10 wrap mb10">
        <div class="search">
          <span class="si">🔍</span>
          <input class="inp" placeholder="Search description, category, notes…" data-filter="q" data-scope="spending" value="${esc(f.q)}">
        </div>
        <select class="sel" data-filter="month" data-scope="spending" style="width:auto;min-width:148px">
          <option value="all" ${f.month === 'all' ? 'selected' : ''}>All months</option>
          ${Q.activeMonths().map(mm => `<option value="${mm}" ${f.month === mm ? 'selected' : ''}>${D.monthName(mm, true)}</option>`).join('')}
        </select>
        <select class="sel" data-filter="wallet" data-scope="spending" style="width:auto;min-width:148px">
          <option value="all" ${f.wallet === 'all' ? 'selected' : ''}>All wallets</option>
          ${DB.state.wallets.map(w => `<option value="${w.id}" ${f.wallet === w.id ? 'selected' : ''}>${w.icon} ${esc(w.name)}</option>`).join('')}
        </select>
        <select class="sel" data-filter="method" data-scope="spending" style="width:auto;min-width:148px">
          <option value="all" ${f.method === 'all' ? 'selected' : ''}>Any payment method</option>
          ${PAY_METHODS.map(p => `<option value="${p}" ${f.method === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <input class="inp" type="date" data-filter="from" data-scope="spending" value="${esc(f.from)}" style="width:auto" title="From date">
        <input class="inp" type="date" data-filter="to" data-scope="spending" value="${esc(f.to)}" style="width:auto" title="To date">
        ${(f.q || f.month !== 'all' || f.cat !== 'all' || f.wallet !== 'all' || f.method !== 'all' || f.from || f.to)
          ? `<button class="btn btn-sm" data-clear="spending">✕ Clear</button>` : ''}
      </div>
      <div class="chip-row">
        <button class="chip ${f.cat === 'all' ? 'on' : ''}" data-cat="all" data-scope="spending">All categories</button>
        ${Q.expenseCats().map(c => {
          const n = Q.filter({ type: 'expense', month: f.month, cat: c.id }).length;
          return `<button class="chip ${f.cat === c.id ? 'on' : ''}" data-cat="${c.id}" data-scope="spending">${c.icon} ${esc(c.name)}${n ? ` <span class="faint">${n}</span>` : ''}</button>`;
        }).join('')}
      </div>
    </div>
    ${list.length ? `<div class="tx-list" style="padding:0 8px 10px">${list.map(t => P.txRow(t)).join('')}</div>`
      : P.empty('🛒', 'No expenses found', f.q || f.cat !== 'all' ? 'Try adjusting your search or filters.' : 'Log your first expense to start understanding your spending.',
        `<button class="btn btn-dn btn-sm" data-add="expense">＋ Add Expense</button>`)}
  </div>`;
};

/* ============================================================= HISTORY === */
Pages.history = (ctx) => {
  const f = App.filters.history;
  let list = Q.filter({
    type: f.type, month: f.month, q: f.q, cat: f.cat, wallet: f.wallet, from: f.from, to: f.to
  });
  // sorting
  const dir = f.dir === 'asc' ? 1 : -1;
  list = [...list].sort((a, b) => {
    switch (f.sort) {
      case 'amount': return (a.amount - b.amount) * dir;
      case 'cat': return Q.cat(a.cat).name.localeCompare(Q.cat(b.cat).name) * dir;
      case 'type': return String(a.type).localeCompare(String(b.type)) * dir;
      default: return (a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0)) * dir;
    }
  });

  const inc = Q.sum(list, 'income'), exp = Q.sum(list, 'expense');
  const trf = Q.sum(list, 'transfer');
  const arrow = (k) => f.sort === k ? (f.dir === 'asc' ? ' ▲' : ' ▼') : '';

  return `
  ${P.sectionHead('Transaction History', 'Complete record of every movement of money',
    `<div class="row g8">
      <button class="btn btn-sm" data-export>⬇️ Export CSV</button>
      <button class="btn btn-p btn-sm" data-quickmenu>＋ Add</button>
    </div>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Records shown', value: String(list.length), icon: '🧾',
      iconBg: 'var(--brand-dim)', accent: 'var(--grad-brand)', sub: 'Matching current filters' })}
    ${P.statCard({ label: 'Income in view', value: M.fmt(inc), icon: '📈',
      iconBg: 'var(--up-dim)', accent: 'var(--grad-up)' })}
    ${P.statCard({ label: 'Expenses in view', value: M.fmt(exp), icon: '📉',
      iconBg: 'var(--down-dim)', accent: 'var(--grad-down)' })}
    ${P.statCard({ label: 'Net in view', value: M.fmt(inc - exp, { sign: true }), icon: '📊',
      iconBg: inc - exp >= 0 ? 'var(--up-dim)' : 'var(--down-dim)',
      accent: inc - exp >= 0 ? 'var(--grad-up)' : 'var(--grad-down)',
      sub: trf ? `${M.fmt(trf)} transferred between wallets` : 'Income − Expenses' })}
  </div>

  <div class="card card-pad-0">
    <div style="padding:18px 18px 14px">
      <div class="row g10 wrap mb12">
        <div class="search">
          <span class="si">🔍</span>
          <input class="inp" placeholder="Search everything…" data-filter="q" data-scope="history" value="${esc(f.q)}">
        </div>
        <div class="seg">
          ${[['all', 'All'], ['income', '🟢 Income'], ['expense', '🔴 Expenses'], ['transfer', '⇄ Transfers']].map(([v, t]) =>
            `<button class="${f.type === v ? 'on' : ''}" data-type="${v}" data-scope="history">${t}</button>`).join('')}
        </div>
        <select class="sel" data-filter="month" data-scope="history" style="width:auto;min-width:148px">
          <option value="all" ${f.month === 'all' ? 'selected' : ''}>All months</option>
          ${Q.activeMonths().map(mm => `<option value="${mm}" ${f.month === mm ? 'selected' : ''}>${D.monthName(mm, true)}</option>`).join('')}
        </select>
        <select class="sel" data-filter="cat" data-scope="history" style="width:auto;min-width:148px">
          <option value="all" ${f.cat === 'all' ? 'selected' : ''}>All categories</option>
          ${Q.allCats().map(c => `<option value="${c.id}" ${f.cat === c.id ? 'selected' : ''}>${c.icon} ${esc(c.name)}</option>`).join('')}
        </select>
        <select class="sel" data-filter="wallet" data-scope="history" style="width:auto;min-width:148px">
          <option value="all" ${f.wallet === 'all' ? 'selected' : ''}>All wallets</option>
          ${DB.state.wallets.map(w => `<option value="${w.id}" ${f.wallet === w.id ? 'selected' : ''}>${w.icon} ${esc(w.name)}</option>`).join('')}
        </select>
        <input class="inp" type="date" data-filter="from" data-scope="history" value="${esc(f.from)}" style="width:auto" title="From">
        <input class="inp" type="date" data-filter="to" data-scope="history" value="${esc(f.to)}" style="width:auto" title="To">
        ${(f.q || f.type !== 'all' || f.month !== 'all' || f.cat !== 'all' || f.wallet !== 'all' || f.from || f.to)
          ? `<button class="btn btn-sm" data-clear="history">✕ Clear</button>` : ''}
      </div>
    </div>

    ${list.length ? `<div class="tbl-wrap">
      <table class="tbl">
        <thead><tr>
          <th class="sortable" data-sort="date">Date${arrow('date')}</th>
          <th class="sortable" data-sort="type">Type${arrow('type')}</th>
          <th class="sortable" data-sort="cat">Category${arrow('cat')}</th>
          <th>Description</th>
          <th>Wallet</th>
          <th class="sortable tr" data-sort="amount">Amount${arrow('amount')}</th>
          <th style="width:74px"></th>
        </tr></thead>
        <tbody>
          ${list.map(t => {
            const isT = t.type === 'transfer';
            const c = Q.cat(t.cat);
            const inc2 = t.type === 'income';
            return `<tr data-tx="${t.id}">
              <td class="nowrap"><div class="t-sm w6">${esc(D.short(t.date))}</div><div class="t-xs faint">${D.parse(t.date).getFullYear()}</div></td>
              <td><span class="row g6 nowrap">
                <span class="dot ${isT ? 'dot-tr' : inc2 ? 'dot-up' : 'dot-down'}"></span>
                <span class="t-xs w6">${isT ? 'Transfer' : inc2 ? 'Income' : 'Expense'}</span>
              </span></td>
              <td class="nowrap">${isT ? '<span class="dim">—</span>' : `${c.icon} ${esc(c.name)}`}</td>
              <td><div class="truncate" style="max-width:230px">${esc(t.desc || '—')}</div>
                  ${t.notes ? `<div class="t-xs faint truncate" style="max-width:230px">${esc(t.notes)}</div>` : ''}</td>
              <td class="nowrap t-xs">${isT
                ? `${Q.walletIcon(t.from)} ${esc(C.trunc(Q.walletName(t.from), 12))} → ${Q.walletIcon(t.to)} ${esc(C.trunc(Q.walletName(t.to), 12))}`
                : `${Q.walletIcon(t.wallet)} ${esc(Q.walletName(t.wallet))}`}</td>
              <td class="tr nowrap"><span class="w7 num ${isT ? 'muted' : inc2 ? 'up' : 'down'}">
                ${isT ? '' : inc2 ? '+' : '−'}${M.fmt(t.amount)}</span></td>
              <td><div class="row g2">
                <button class="ibtn" data-edit="${t.id}" title="Edit">✏️</button>
                <button class="ibtn ibtn-danger" data-del="${t.id}" title="Delete">🗑️</button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>` : P.empty('🧾', 'No transactions found',
      f.q ? 'Nothing matches your search. Try different keywords or clear the filters.' : 'Start recording your money movements with the ＋ button.')}
  </div>`;
};

/* ============================================================= WALLETS === */
Pages.wallets = (ctx) => {
  const m = ctx.month;
  const ws = DB.state.wallets;
  const total = Q.totalBalance();
  const transfers = Q.sorted(DB.state.tx.filter(t => t.type === 'transfer')).slice(0, 8);

  return `
  ${P.sectionHead('My Wallets', 'Cash, bank accounts, cards and savings — all in one place',
    `<div class="row g8">
      <button class="btn btn-sm" data-transfer>⇄ Transfer</button>
      <button class="btn btn-p" data-newwallet>＋ New Wallet</button>
    </div>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Total across wallets', value: M.fmt(total), icon: '💰',
      iconBg: 'var(--brand-dim)', accent: 'var(--grad-brand)', sub: `${ws.length} wallet${ws.length === 1 ? '' : 's'}` })}
    ${P.statCard({ label: 'Available to spend', value: M.fmt(Q.availableMoney()), icon: '💵',
      iconBg: 'var(--up-dim)', accent: 'var(--grad-up)', sub: 'Excludes savings accounts' })}
    ${P.statCard({ label: 'Held in savings', value: M.fmt(Q.totalSavings()), icon: '🏦',
      iconBg: 'var(--warn-dim)', accent: 'var(--grad-brand)', sub: 'Savings-type wallets' })}
    ${P.statCard({ label: 'Transfers made', value: String(DB.state.tx.filter(t => t.type === 'transfer').length), icon: '⇄',
      iconBg: 'var(--info-dim)', accent: 'var(--grad-brand)', sub: 'Money moved between wallets' })}
  </div>

  <div class="grid g-auto mb20">
    ${ws.map(w => P.walletCard(w)).join('')}
    <button class="card" data-newwallet style="border-style:dashed;display:grid;place-items:center;min-height:158px;color:var(--tx-3);cursor:pointer">
      <div class="tc">
        <div style="font-size:1.7rem;margin-bottom:6px">＋</div>
        <div class="t-sm w6">Add a new wallet</div>
        <div class="t-xs faint mt4">Cash, bank, card or savings</div>
      </div>
    </button>
  </div>

  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="card">
      <div class="card-hd"><div><h2>Balance Distribution</h2><div class="t-xs dim mt4">Share of your total money</div></div></div>
      ${total > 0 ? `<div class="chart mb16">${C.donut(
        ws.filter(w => Q.walletBalance(w.id) > 0).map(w => ({
          name: w.name, total: Q.walletBalance(w.id), icon: w.icon,
          color: (WALLET_TYPES.find(t => t.id === w.type) || {}).id === 'cash' ? '#34d399'
            : w.type === 'bank' ? '#60a5fa' : w.type === 'savings' ? '#fbbf24'
            : w.type === 'ewallet' ? '#22d3ee' : '#c084fc'
        })),
        { size: 190, thick: 24, fmt: (v, full) => full ? M.fmt(v) : M.short(v), centerTop: 'TOTAL', centerBot: M.short(total) }
      )}</div>
      <div class="col g8">
        ${ws.map(w => {
          const b = Q.walletBalance(w.id);
          const pct = total > 0 ? b / total * 100 : 0;
          return `<div class="row g10">
            <span class="t-sm grow truncate">${w.icon} ${esc(w.name)}</span>
            <span class="t-sm w6 num ${b < 0 ? 'down' : ''}">${M.fmt(b)}</span>
            <span class="t-xs faint num" style="width:40px;text-align:right">${pct.toFixed(0)}%</span>
          </div>`;
        }).join('')}
      </div>` : P.empty('👝', 'No balance yet', 'Add income to your wallets to see the distribution.')}
    </div>

    <div class="card">
      <div class="card-hd">
        <div><h2>Wallet Activity</h2><div class="t-xs dim mt4">${D.monthName(m, true)}</div></div>
      </div>
      <div class="chart">${C.groupBars(
        ws.map(w => {
          const inM = DB.state.tx.filter(t => D.mk(t.date) === m);
          return {
            label: C.trunc(w.name, 8), fullLabel: w.name,
            income: Q.sum(inM.filter(t => t.type === 'income' && t.wallet === w.id)),
            expense: Q.sum(inM.filter(t => t.type === 'expense' && t.wallet === w.id))
          };
        }),
        { h: 230, fmt: (v, full) => full ? M.fmt(v) : M.short(v) }
      )}</div>
      ${C.legend([{ name: 'Income', color: '#34d399' }, { name: 'Expenses', color: '#fb7185' }])}
    </div>

    <div class="card card-pad-0">
      <div class="card-hd" style="padding:18px 18px 0;margin-bottom:12px">
        <div><h2>Recent Transfers</h2><div class="t-xs dim mt4">Money moved between wallets</div></div>
        <button class="btn btn-sm" data-transfer>⇄ New</button>
      </div>
      ${transfers.length ? `<div class="tx-list" style="padding:0 8px 10px">${transfers.map(t => P.txRow(t)).join('')}</div>`
        : P.empty('⇄', 'No transfers yet', 'Move money between your wallets — your total balance stays the same.',
          `<button class="btn btn-p btn-sm" data-transfer>Make a transfer</button>`)}
    </div>
  </div>`;
};

/* ============================================================= BUDGETS === */
Pages.budgets = (ctx) => {
  const m = ctx.month;
  const list = Q.budgetProgress(m);
  const t = Q.budgetTotals(m);
  const unbudgeted = Q.expenseCats().filter(c => !DB.state.budgets.some(b => b.cat === c.id));
  const unspent = Q.byCategory(m, 'expense').filter(c => !DB.state.budgets.some(b => b.cat === c.cat));
  const over = list.filter(b => b.status === 'over');
  const warn = list.filter(b => b.status === 'warn');
  const daysLeft = m === D.thisMonth() ? D.daysInMonth(m) - new Date().getDate() : 0;

  return `
  ${P.sectionHead('Budget Planner', `Set monthly spending limits and track them automatically · ${D.monthName(m, true)}`,
    `<button class="btn btn-p" data-newbudget>＋ Set Budget</button>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Total budgeted', value: M.fmt(t.limit), icon: '🎯',
      iconBg: 'var(--brand-dim)', accent: 'var(--grad-brand)', sub: `${t.count} categor${t.count === 1 ? 'y' : 'ies'}` })}
    ${P.statCard({ label: 'Spent so far', value: M.fmt(t.spent), icon: '💸',
      iconBg: 'var(--down-dim)', accent: 'var(--grad-down)', sub: `${t.pct.toFixed(0)}% of total budget` })}
    ${P.statCard({ label: 'Remaining', value: M.fmt(t.remaining), icon: '🪙',
      iconBg: t.remaining >= 0 ? 'var(--up-dim)' : 'var(--down-dim)',
      accent: t.remaining >= 0 ? 'var(--grad-up)' : 'var(--grad-down)',
      sub: daysLeft > 0 ? `${daysLeft} days left · ${M.fmt(Math.max(0, Math.round(t.remaining / Math.max(1, daysLeft))))}/day` : 'Month complete' })}
    ${P.statCard({ label: 'Needs attention', value: String(over.length + warn.length), icon: over.length ? '🚨' : warn.length ? '⚠️' : '✅',
      iconBg: over.length ? 'var(--down-dim)' : warn.length ? 'var(--warn-dim)' : 'var(--up-dim)',
      accent: over.length ? 'var(--grad-down)' : 'var(--grad-up)',
      sub: over.length ? `${over.length} over budget` : warn.length ? `${warn.length} close to limit` : 'All budgets healthy' })}
  </div>

  ${t.count ? `<div class="card mb20">
    <div class="card-hd">
      <div><h2>Overall Budget Usage</h2><div class="t-xs dim mt4">All categories combined</div></div>
      <span class="badge ${t.pct >= 100 ? 'badge-down' : t.pct >= 80 ? 'badge-warn' : 'badge-up'}">${t.pct.toFixed(0)}% used</span>
    </div>
    <div class="row g16 wrap">
      ${C.ring(t.pct, { size: 86, thick: 9, color: t.pct >= 100 ? '#fb7185' : t.pct >= 80 ? '#fbbf24' : '#34d399' })}
      <div class="grow" style="min-width:220px">
        <div class="row between mb8">
          <span class="t-sm muted">${M.fmt(t.spent)} spent</span>
          <span class="t-sm muted">${M.fmt(t.limit)} budgeted</span>
        </div>
        <div class="bar bar-lg"><div class="bar-fill ${t.pct >= 100 ? 'over' : t.pct >= 80 ? 'warn' : 'ok'}" style="width:${Math.min(100, t.pct)}%"></div></div>
        <div class="t-xs dim mt8">
          ${t.remaining >= 0
            ? `You have <b>${M.fmt(t.remaining)}</b> left across all budgets${daysLeft > 0 ? ` for the next ${daysLeft} days` : ''}.`
            : `You are <b>${M.fmt(Math.abs(t.remaining))}</b> over your combined budget.`}
        </div>
      </div>
    </div>
  </div>` : ''}

  <div class="grid mb20" style="grid-template-columns:minmax(0,1.3fr) minmax(0,1fr)">
    <div>
      <div class="row between g12 mb12"><h2 style="font-size:1.05rem">Budgets by Category</h2>
        ${list.length ? `<span class="t-xs dim">Sorted by usage</span>` : ''}</div>
      ${list.length ? `<div class="col g12">${list.map(b => P.budgetRow(b)).join('')}</div>`
        : `<div class="card">${P.empty('🎯', 'No budgets set yet',
            'Budgets help you cap spending per category. Start with your biggest expense area.',
            `<button class="btn btn-p btn-sm" data-newbudget>＋ Set your first budget</button>`)}</div>`}
    </div>

    <div class="col g12">
      <div class="card">
        <div class="card-hd"><div><h2>Budget vs Actual</h2><div class="t-xs dim mt4">Limit against real spending</div></div></div>
        ${list.length ? `<div class="chart">${C.groupBars(
          list.slice(0, 6).map(b => ({ label: C.trunc(b.name, 7), fullLabel: b.name, budget: b.limit, spent: b.spent })),
          { h: 220, fmt: (v, full) => full ? M.fmt(v) : M.short(v),
            series: [{ key: 'budget', color: '#7c6cff', name: 'Budget' }, { key: 'spent', color: '#fb7185', name: 'Spent' }] }
        )}</div>
        ${C.legend([{ name: 'Budget', color: '#7c6cff' }, { name: 'Spent', color: '#fb7185' }])}`
          : P.empty('📊', 'Nothing to compare', 'Set a budget to see this chart.')}
      </div>

      ${unspent.length ? `<div class="card">
        <div class="card-hd"><div><h2>Unbudgeted Spending</h2><div class="t-xs dim mt4">Categories you spend on without a limit</div></div></div>
        <div class="col g10">
          ${unspent.slice(0, 5).map(c => `
            <div class="row g10">
              <div class="cat-av cat-av-sm" style="background:${c.color}22;border-color:${c.color}44">${c.icon}</div>
              <div class="grow truncate"><div class="t-sm w6 truncate">${esc(c.name)}</div>
                <div class="t-xs faint">${M.fmt(c.total)} spent this month</div></div>
              <button class="btn btn-xs" data-setbudget="${c.cat}">Set limit</button>
            </div>`).join('')}
        </div>
      </div>` : ''}

      ${unbudgeted.length ? `<div class="card">
        <div class="card-hd"><div><h2>Quick Add</h2><div class="t-xs dim mt4">Categories without a budget</div></div></div>
        <div class="row g8 wrap">
          ${unbudgeted.slice(0, 10).map(c => `<button class="chip" data-setbudget="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}
        </div>
      </div>` : ''}
    </div>
  </div>`;
};

/* =============================================================== GOALS === */
Pages.goals = (ctx) => {
  const goals = Q.goalProgress();
  const totalTarget = goals.reduce((s, g) => s + g.target, 0);
  const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
  const done = goals.filter(g => g.done);
  const pct = totalTarget ? totalSaved / totalTarget * 100 : 0;
  const active = goals.filter(g => !g.done).sort((a, b) => b.pct - a.pct);

  return `
  ${P.sectionHead('Savings Goals', 'Set a target, add money, watch the progress bar fill up',
    `<div class="row g8">
      ${goals.length ? `<button class="btn btn-sm" data-fundany>＋ Add Money</button>` : ''}
      <button class="btn btn-p" data-newgoal>＋ New Goal</button>
    </div>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Total saved in goals', value: M.fmt(totalSaved), icon: '🏆',
      iconBg: 'var(--warn-dim)', accent: 'var(--grad-brand)', sub: `Across ${goals.length} goal${goals.length === 1 ? '' : 's'}` })}
    ${P.statCard({ label: 'Combined target', value: M.fmt(totalTarget), icon: '🎯',
      iconBg: 'var(--brand-dim)', accent: 'var(--grad-brand)', sub: `${pct.toFixed(0)}% funded overall` })}
    ${P.statCard({ label: 'Still needed', value: M.fmt(Math.max(0, totalTarget - totalSaved)), icon: '📈',
      iconBg: 'var(--info-dim)', accent: 'var(--grad-brand)', sub: 'To complete every goal' })}
    ${P.statCard({ label: 'Goals reached', value: `${done.length} / ${goals.length}`, icon: done.length ? '🎉' : '⏳',
      iconBg: done.length ? 'var(--up-dim)' : 'var(--glass-2)', accent: 'var(--grad-up)',
      sub: done.length ? 'Well done!' : 'Keep going' })}
  </div>

  ${goals.length ? `<div class="card mb20">
    <div class="card-hd">
      <div><h2>Overall Savings Progress</h2><div class="t-xs dim mt4">All goals combined</div></div>
      <span class="badge ${pct >= 100 ? 'badge-up' : 'badge-info'}">${pct.toFixed(0)}%</span>
    </div>
    <div class="row g16 wrap">
      ${C.ring(pct, { size: 86, thick: 9, color: pct >= 100 ? '#34d399' : '#7c6cff' })}
      <div class="grow" style="min-width:220px">
        <div class="row between mb8">
          <span class="t-sm w6 money">${M.fmt(totalSaved)}</span>
          <span class="t-sm muted money">${M.fmt(totalTarget)}</span>
        </div>
        <div class="bar bar-lg"><div class="bar-fill ${pct >= 100 ? 'ok' : ''}" style="width:${Math.min(100, pct)}%"></div></div>
        <div class="mt8">${C.blocks(pct, 20)}</div>
      </div>
    </div>
  </div>` : ''}

  ${active.length ? `<h2 style="font-size:1.05rem" class="mb12">In Progress</h2>
  <div class="grid g-auto mb20">${active.map(g => P.goalCard(g)).join('')}</div>` : ''}

  ${done.length ? `<h2 style="font-size:1.05rem" class="mb12">Completed 🎉</h2>
  <div class="grid g-auto mb20">${done.map(g => P.goalCard(g)).join('')}</div>` : ''}

  ${!goals.length ? `<div class="card">${P.empty('🏆', 'No savings goals yet',
    'Whether it is a laptop, a holiday or an emergency fund — set a target and track every ringgit towards it.',
    `<button class="btn btn-p" data-newgoal>＋ Create your first goal</button>`)}</div>` : ''}`;
};

/* =========================================================== RECURRING === */
Pages.recurring = () => {
  const all = DB.state.recurring;
  const active = all.filter(r => r.active);
  const paused = all.filter(r => !r.active);
  const due = all.filter(r => r.active && r.next <= D.today());
  const soon = Q.upcomingRecurring(30);
  const mExp = Q.recurringMonthlyTotal('expense');
  const mInc = Q.recurringMonthlyTotal('income');

  const row = (r) => {
    const c = Q.cat(r.cat);
    const isDue = r.next <= D.today();
    const days = D.diffDays(D.today(), r.next);
    const freqLabel = { daily: 'Daily', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', quarterly: 'Quarterly', yearly: 'Yearly' }[r.freq] || r.freq;
    return `<div class="card card-tight" data-recur="${r.id}" style="${!r.active ? 'opacity:.6' : ''}">
      <div class="row g12 wrap">
        <div class="cat-av" style="background:${c.color}22;border-color:${c.color}44">${c.icon}</div>
        <div class="grow" style="min-width:150px">
          <div class="row g8 wrap">
            <span class="t-md w6 truncate">${esc(r.label)}</span>
            ${r.autopost ? '<span class="badge badge-info">⚡ Auto</span>' : ''}
            ${!r.active ? '<span class="badge badge-mute">Paused</span>' : isDue ? '<span class="badge badge-warn">Due now</span>' : ''}
          </div>
          <div class="t-xs dim truncate">${esc(freqLabel)} · ${esc(c.name)} · ${Q.walletIcon(r.wallet)} ${esc(Q.walletName(r.wallet))}</div>
        </div>
        <div style="text-align:right">
          <div class="t-md w7 num ${r.type === 'income' ? 'up' : 'down'}">${r.type === 'income' ? '+' : '−'}${M.fmt(r.amount)}</div>
          <div class="t-xs ${isDue ? 'warnc w6' : 'faint'}">${r.active ? `${D.rel(r.next)} · ${D.short(r.next)}` : 'Paused'}</div>
        </div>
        <div class="row g4">
          ${r.active ? `<button class="btn btn-xs btn-p" data-post="${r.id}" title="Record this now">＋ Add now</button>` : ''}
          <button class="ibtn" data-toggle="${r.id}" title="${r.active ? 'Pause' : 'Resume'}">${r.active ? '⏸️' : '▶️'}</button>
          <button class="ibtn" data-redit="${r.id}" title="Edit">✏️</button>
          <button class="ibtn ibtn-danger" data-rdel="${r.id}" title="Delete">🗑️</button>
        </div>
      </div>
    </div>`;
  };

  return `
  ${P.sectionHead('Recurring Payments', 'Subscriptions, bills and regular income — never forget one again',
    `<button class="btn btn-p" data-newrecur>＋ New Recurring</button>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Monthly recurring expenses', value: M.fmt(mExp), icon: '📉',
      iconBg: 'var(--down-dim)', accent: 'var(--grad-down)', sub: `${active.filter(r => r.type === 'expense').length} active commitments` })}
    ${P.statCard({ label: 'Monthly recurring income', value: M.fmt(mInc), icon: '📈',
      iconBg: 'var(--up-dim)', accent: 'var(--grad-up)', sub: `${active.filter(r => r.type === 'income').length} active sources` })}
    ${P.statCard({ label: 'Net recurring', value: M.fmt(mInc - mExp, { sign: true }), icon: '📊',
      iconBg: mInc - mExp >= 0 ? 'var(--up-dim)' : 'var(--down-dim)',
      accent: mInc - mExp >= 0 ? 'var(--grad-up)' : 'var(--grad-down)', sub: 'Predictable monthly flow' })}
    ${P.statCard({ label: 'Due now', value: String(due.length), icon: due.length ? '🔔' : '✅',
      iconBg: due.length ? 'var(--warn-dim)' : 'var(--up-dim)', accent: 'var(--grad-brand)',
      sub: due.length ? 'Waiting for confirmation' : 'Nothing outstanding' })}
  </div>

  ${due.length ? `<div class="card mb20" style="border-color:rgba(251,191,36,.34)">
    <div class="card-hd">
      <div><h2>⏰ Ready to Record</h2><div class="t-xs dim mt4">These are due — confirm to add them to your transactions</div></div>
      <button class="btn btn-p btn-sm" data-postall>Add all ${due.length}</button>
    </div>
    <div class="col g10">${due.map(row).join('')}</div>
  </div>` : ''}

  <div class="grid mb20" style="grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)">
    <div>
      <div class="row between g12 mb12"><h2 style="font-size:1.05rem">Active Schedules</h2>
        <span class="t-xs dim">${active.length} active</span></div>
      ${active.length ? `<div class="col g10">${active.filter(r => r.next > D.today()).map(row).join('') || '<div class="card"><div class="t-sm dim tc">All active items are listed above as due.</div></div>'}</div>`
        : `<div class="card">${P.empty('🔁', 'No recurring transactions',
            'Add your subscriptions, bills and salary so the app can predict your cash flow.',
            `<button class="btn btn-p btn-sm" data-newrecur>＋ Add recurring</button>`)}</div>`}

      ${paused.length ? `<div class="mt20">
        <div class="row between g12 mb12"><h2 style="font-size:1.05rem">Paused</h2><span class="t-xs dim">${paused.length}</span></div>
        <div class="col g10">${paused.map(row).join('')}</div>
      </div>` : ''}
    </div>

    <div class="col g12">
      <div class="card">
        <div class="card-hd"><div><h2>Next 30 Days</h2><div class="t-xs dim mt4">Upcoming schedule</div></div></div>
        ${soon.length ? `<div class="col g12">
          ${soon.map(r => {
            const c = Q.cat(r.cat);
            const d = D.diffDays(D.today(), r.next);
            return `<div class="row g10">
              <div class="col tc" style="width:38px;flex-shrink:0">
                <div class="t-xs faint">${D.parse(r.next).toLocaleDateString('en-MY', { month: 'short' })}</div>
                <div class="t-md w7 num">${D.parse(r.next).getDate()}</div>
              </div>
              <div class="cat-av cat-av-sm" style="background:${c.color}22;border-color:${c.color}44">${c.icon}</div>
              <div class="grow truncate">
                <div class="t-sm w6 truncate">${esc(r.label)}</div>
                <div class="t-xs ${d <= 1 ? 'warnc' : 'faint'}">${esc(D.rel(r.next))}</div>
              </div>
              <div class="t-sm w7 num ${r.type === 'income' ? 'up' : 'down'}">${r.type === 'income' ? '+' : '−'}${M.fmt(r.amount)}</div>
            </div>`;
          }).join('')}
        </div>` : P.empty('📅', 'Nothing coming up', 'No recurring transactions in the next 30 days.')}
      </div>

      ${active.filter(r => r.type === 'expense').length ? `<div class="card">
        <div class="card-hd"><div><h2>Where Recurring Money Goes</h2><div class="t-xs dim mt4">Monthly equivalent</div></div></div>
        <div class="chart">${C.hBars(
          active.filter(r => r.type === 'expense')
            .map(r => ({ label: r.label, value: r.amount, color: Q.cat(r.cat).color, icon: Q.cat(r.cat).icon }))
            .sort((a, b) => b.value - a.value).slice(0, 8),
          { fmt: (v, full) => full ? M.fmt(v) : M.short(v) }
        )}</div>
      </div>` : ''}
    </div>
  </div>`;
};

/* =========================================================== ANALYTICS === */
Pages.analytics = (ctx) => {
  const m = ctx.month;
  const inc = Q.income(m), exp = Q.expense(m), flow = inc - exp;
  const series = Q.monthSeries(6, m);
  const daily = Q.dailySeries(m);
  const cats = Q.byCategory(m, 'expense');
  const incCats = Q.byCategory(m, 'income');
  const dow = Q.byDow(m);
  const insights = Q.insights(m);
  const mom = Q.momChange(m);
  const bal = Q.balanceSeries(m);
  const prev = D.shiftMk(m, -1);
  // Compare the same elapsed days of each month so an in-progress month isn't
  // shown as a false drop against a completed one.
  const prevCats = Q.byCategory(prev, 'expense', mom.partial ? mom.dayN : null);
  const rate = Q.savingsRate(m);
  const methods = Q.byPaymentMethod(m);

  // Category deltas vs last month, over the same elapsed days on both sides.
  const curCats = mom.partial ? Q.byCategory(m, 'expense', mom.dayN) : cats;
  const deltas = curCats.map(c => {
    const p = prevCats.find(x => x.cat === c.cat);
    const pv = p ? p.total : 0;
    return { ...c, prev: pv, diff: c.total - pv, pctChange: pv ? (c.total - pv) / pv * 100 : (c.total ? 100 : 0) };
  }).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

  return `
  ${P.sectionHead('Analytics & Insights', `Understand your money patterns · ${D.monthName(m, true)}`,
    `<button class="btn btn-sm" data-print>🖨️ Print / Save PDF</button>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Income', value: M.fmt(inc), icon: '📈', iconBg: 'var(--up-dim)', accent: 'var(--grad-up)',
      badge: P.momBadge(Q.incomeMomChange(m)) })}
    ${P.statCard({ label: 'Expenses', value: M.fmt(exp), icon: '📉', iconBg: 'var(--down-dim)', accent: 'var(--grad-down)',
      badge: P.momBadge(mom, { invert: true, pace: true }) })}
    ${P.statCard({ label: 'Cash Flow', value: M.fmt(flow, { sign: true }), icon: '📊',
      iconBg: flow >= 0 ? 'var(--up-dim)' : 'var(--down-dim)', accent: flow >= 0 ? 'var(--grad-up)' : 'var(--grad-down)',
      sub: 'Income − Expenses' })}
    ${P.statCard({ label: 'Savings Rate', value: `${rate.toFixed(0)}%`, icon: '🏦',
      iconBg: rate >= 20 ? 'var(--up-dim)' : rate >= 0 ? 'var(--warn-dim)' : 'var(--down-dim)',
      accent: 'var(--grad-brand)',
      sub: rate >= 20 ? 'Healthy — keep it up' : rate >= 0 ? 'Room to improve' : 'Spending exceeds income' })}
  </div>

  <div class="card mb20">
    <div class="card-hd">
      <div><h2>💡 Automatic Insights</h2><div class="t-xs dim mt4">What your numbers are telling you</div></div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px">
      ${insights.length ? insights.map(P.insightRow).join('')
        : P.empty('💡', 'Not enough data yet', 'Add a few more transactions and insights will appear here automatically.')}
    </div>
  </div>

  <div class="grid mb20" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr))">
    <div class="card">
      <div class="card-hd">
        <div><h2>📊 Monthly Income vs Expenses</h2><div class="t-xs dim mt4">Last 6 months</div></div>
        ${C.legend([{ name: 'Income', color: '#34d399' }, { name: 'Expenses', color: '#fb7185' }])}
      </div>
      <div class="chart">${C.groupBars(
        series.map(s => ({ label: s.label, fullLabel: D.monthName(s.mk, true), income: s.income, expense: s.expense })),
        { h: 250, fmt: (v, full) => full ? M.fmt(v) : M.short(v) })}</div>
    </div>

    <div class="card">
      <div class="card-hd"><div><h2>📈 Cash Flow Trend</h2><div class="t-xs dim mt4">Net position each month</div></div></div>
      <div class="chart">${C.line(
        [{ name: 'Net cash flow', color: '#7c6cff', values: series.map(s => M.toNum(s.net)), area: true }],
        series.map(s => s.label),
        { h: 250, zeroBase: false, dots: true, fmt: (v, full) => full ? M.fmt(M.parse(v)) : M.short(M.parse(v)) })}</div>
    </div>

    <div class="card">
      <div class="card-hd"><div><h2>🥧 Spending by Category</h2><div class="t-xs dim mt4">${D.monthName(m, true)}</div></div></div>
      ${cats.length ? `<div class="chart mb16">${C.donut(cats, {
        size: 210, thick: 26, fmt: (v, full) => full ? M.fmt(v) : M.short(v),
        centerTop: 'TOTAL SPENT', centerBot: M.short(exp) })}</div>
      <div class="grid g-2" style="gap:6px 14px">
        ${cats.map(c => `<div class="row g8">
          <span class="leg-sw" style="background:${c.color}"></span>
          <span class="t-xs grow truncate">${c.icon} ${esc(c.name)}</span>
          <span class="t-xs w6 num">${c.pct.toFixed(0)}%</span>
        </div>`).join('')}
      </div>` : P.empty('🥧', 'No expenses', 'Log expenses to see this breakdown.')}
    </div>

    <div class="card">
      <div class="card-hd"><div><h2>📅 Daily Spending</h2><div class="t-xs dim mt4">Every day of ${D.monthName(m, true)}</div></div></div>
      <div class="chart">${C.bars(
        daily.map(d => ({ label: String(d.day), fullLabel: D.pretty(d.date), value: d.total,
          color: d.total > 0 ? '#7c6cff' : 'rgba(255,255,255,.07)' })),
        { h: 230, fmt: (v, full) => full ? M.fmt(v) : M.short(v), maxBarW: 17 })}</div>
      <div class="row between mt12">
        <span class="t-xs dim">Avg <b class="num">${M.fmt(Q.avgDailySpend(m))}</b>/day</span>
        <span class="t-xs dim">Projected month end <b class="num">${M.fmt(Q.projectedSpend(m))}</b></span>
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><div><h2>🗓️ Spending by Day of Week</h2><div class="t-xs dim mt4">Which days cost you most</div></div></div>
      <div class="chart">${C.bars(
        dow.map(d => ({ label: d.short, fullLabel: d.name, value: d.total,
          color: d.total === Math.max(...dow.map(x => x.total)) && d.total > 0 ? '#fb7185' : '#60a5fa' })),
        { h: 200, fmt: (v, full) => full ? M.fmt(v) : M.short(v), maxBarW: 40 })}</div>
    </div>

    <div class="card">
      <div class="card-hd"><div><h2>💰 Balance Over Time</h2><div class="t-xs dim mt4">Running total through the month</div></div></div>
      <div class="chart">${C.line(
        [{ name: 'Balance', color: '#22d3ee', values: bal.map(b => M.toNum(b.balance)), area: true }],
        bal.map(b => String(b.day)),
        { h: 230, zeroBase: false, fmt: (v, full) => full ? M.fmt(M.parse(v)) : M.short(M.parse(v)) })}</div>
    </div>

    ${incCats.length ? `<div class="card">
      <div class="card-hd"><div><h2>💵 Income Sources</h2><div class="t-xs dim mt4">${D.monthName(m, true)}</div></div></div>
      <div class="chart">${C.hBars(
        incCats.map(c => ({ label: c.name, value: c.total, color: c.color, icon: c.icon })),
        { fmt: (v, full) => full ? M.fmt(v) : M.short(v) })}</div>
    </div>` : ''}

    ${methods.length ? `<div class="card">
      <div class="card-hd"><div><h2>💳 Payment Methods</h2><div class="t-xs dim mt4">How you paid this month</div></div></div>
      <div class="chart">${C.donut(
        methods.map((mm, i) => ({ name: mm.name, total: mm.total, color: ['#7c6cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#c084fc'][i % 6] })),
        { size: 200, thick: 25, fmt: (v, full) => full ? M.fmt(v) : M.short(v), centerTop: 'METHODS', centerBot: String(methods.length) })}</div>
      <div class="col g6 mt16">
        ${methods.map((mm, i) => `<div class="row g8">
          <span class="leg-sw" style="background:${['#7c6cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#c084fc'][i % 6]}"></span>
          <span class="t-sm grow truncate">${esc(mm.name)}</span>
          <span class="t-sm w6 num">${M.fmt(mm.total)}</span>
        </div>`).join('')}
      </div>
    </div>` : ''}
  </div>

  ${deltas.length ? `<div class="card">
    <div class="card-hd">
      <div><h2>Category Changes vs ${D.monthName(prev)}</h2><div class="t-xs dim mt4">Where your spending shifted the most${mom.partial ? ` · first ${mom.dayN} day${mom.dayN === 1 ? '' : 's'} of each month` : ''}</div></div>
    </div>
    <div class="tbl-wrap">
      <table class="tbl" style="min-width:560px">
        <thead><tr>
          <th>Category</th><th class="tr">${D.monthName(prev)}</th><th class="tr">${D.monthName(m)}</th>
          <th class="tr">Change</th><th style="width:130px">Trend</th>
        </tr></thead>
        <tbody>
          ${deltas.map(d => `<tr>
            <td class="nowrap">${d.icon} ${esc(d.name)}</td>
            <td class="tr num muted">${M.fmt(d.prev)}</td>
            <td class="tr num w6">${M.fmt(d.total)}</td>
            <td class="tr num ${d.diff > 0 ? 'down' : d.diff < 0 ? 'up' : 'dim'}">${d.diff === 0 ? '—' : M.fmt(d.diff, { sign: true })}</td>
            <td>${d.prev ? `<span class="badge ${d.diff > 0 ? 'badge-down' : 'badge-up'}">${d.diff > 0 ? '▲' : '▼'} ${Math.abs(d.pctChange).toFixed(0)}%</span>`
              : '<span class="badge badge-info">New</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>` : ''}`;
};

/* ============================================================ CALENDAR === */
Pages.calendar = (ctx) => {
  const m = ctx.month;
  const daily = Q.dailySeries(m);
  const first = D.firstDow(m);
  const dim = D.daysInMonth(m);
  const today = D.today();
  const sel = App.selectedDay && D.mk(App.selectedDay) === m ? App.selectedDay : null;
  const inc = Q.income(m), exp = Q.expense(m);
  const busiest = [...daily].sort((a, b) => b.total - a.total)[0];
  const recurByDate = {};
  DB.state.recurring.filter(r => r.active).forEach(r => {
    // project this recurring item into the visible month
    let d = r.next;
    let guard = 0;
    while (D.mk(d) < m && guard++ < 40) d = advanceLocal(d, r.freq);
    guard = 0;
    while (D.mk(d) === m && guard++ < 40) {
      (recurByDate[d] = recurByDate[d] || []).push(r);
      d = advanceLocal(d, r.freq);
    }
  });

  const cells = [];
  for (let i = 0; i < first; i++) cells.push('<div class="cal-cell pad"></div>');
  for (let d = 1; d <= dim; d++) {
    const iso = `${m}-${String(d).padStart(2, '0')}`;
    const day = daily[d - 1];
    const list = Q.onDate(iso);
    const rec = recurByDate[iso] || [];
    const isToday = iso === today;
    cells.push(`
      <button class="cal-cell ${isToday ? 'today' : ''} ${sel === iso ? 'on' : ''}" data-day="${iso}">
        <div class="row between g4">
          <span class="cal-d ${isToday ? '' : 'muted'}">${d}</span>
          ${rec.length ? '<span style="font-size:.55rem">🔁</span>' : ''}
        </div>
        ${day.income > 0 ? `<div class="cal-amt up">+${M.short(day.income).replace('RM ', '')}</div>` : ''}
        ${day.total > 0 ? `<div class="cal-amt down">−${M.short(day.total).replace('RM ', '')}</div>` : ''}
        <div class="cal-dots">
          ${list.slice(0, 6).map(t => `<span class="cal-dot" style="background:${t.type === 'income' ? 'var(--up)' : t.type === 'transfer' ? 'var(--info)' : Q.cat(t.cat).color}"></span>`).join('')}
          ${list.length > 6 ? `<span class="t-xs faint" style="font-size:.55rem">+${list.length - 6}</span>` : ''}
        </div>
      </button>`);
  }

  const selList = sel ? Q.sorted(Q.onDate(sel)) : [];
  const upcoming = Q.upcomingRecurring(31);

  return `
  ${P.sectionHead('Financial Calendar', 'Click any day to see exactly what happened with your money',
    `<div class="row g8">
      <button class="btn btn-sm" data-mshift="-1">‹ Prev</button>
      <button class="btn btn-sm" data-mshift="today">Today</button>
      <button class="btn btn-sm" data-mshift="1">Next ›</button>
    </div>`)}

  <div class="grid g-4 mb20">
    ${P.statCard({ label: 'Income this month', value: M.fmt(inc), icon: '📈', iconBg: 'var(--up-dim)', accent: 'var(--grad-up)' })}
    ${P.statCard({ label: 'Spent this month', value: M.fmt(exp), icon: '📉', iconBg: 'var(--down-dim)', accent: 'var(--grad-down)' })}
    ${P.statCard({ label: 'Busiest spending day', value: busiest && busiest.total ? M.fmt(busiest.total) : M.fmt(0), icon: '🔥',
      iconBg: 'var(--warn-dim)', accent: 'var(--grad-brand)',
      sub: busiest && busiest.total ? D.pretty(busiest.date) : 'No spending yet' })}
    ${P.statCard({ label: 'Active days', value: `${daily.filter(d => d.total > 0 || d.income > 0).length} / ${dim}`, icon: '📆',
      iconBg: 'var(--info-dim)', accent: 'var(--grad-brand)', sub: 'Days with activity' })}
  </div>

  <div class="grid" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr)">
    <div class="card">
      <div class="card-hd">
        <div><h2>${D.monthName(m, true)}</h2><div class="t-xs dim mt4">🟢 income · 🔴 expense · 🔁 scheduled</div></div>
      </div>
      <div class="cal mb8">
        ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="cal-dow">${d}</div>`).join('')}
      </div>
      <div class="cal">${cells.join('')}</div>
    </div>

    <div class="col g12">
      <div class="card card-pad-0">
        <div class="card-hd" style="padding:18px 18px 0;margin-bottom:12px">
          <div>
            <h2>${sel ? D.pretty(sel) : 'Select a day'}</h2>
            <div class="t-xs dim mt4">${sel
              ? `${selList.length} transaction${selList.length === 1 ? '' : 's'} · net ${M.fmt(Q.sum(selList, 'income') - Q.sum(selList, 'expense'), { sign: true })}`
              : 'Click a date in the calendar'}</div>
          </div>
          ${sel ? `<button class="btn btn-p btn-sm" data-addday="${sel}">＋ Add</button>` : ''}
        </div>
        ${sel
          ? (selList.length
            ? `<div class="tx-list" style="padding:0 8px 10px">${selList.map(t => P.txRow(t, { showWallet: true })).join('')}</div>`
            : P.empty('🗓️', 'Nothing on this day', 'No income or expenses recorded.',
              `<button class="btn btn-p btn-sm" data-addday="${sel}">＋ Add transaction</button>`))
          : P.empty('👆', 'Pick a date', 'Select any day in the calendar to see its financial activity.')}
      </div>

      <div class="card">
        <div class="card-hd">
          <div><h2>Upcoming Bills & Payments</h2><div class="t-xs dim mt4">Next 31 days</div></div>
          <button class="btn btn-sm" data-go="recurring">Manage</button>
        </div>
        ${upcoming.length ? `<div class="col g12">
          ${upcoming.map(r => {
            const c = Q.cat(r.cat);
            const d = D.diffDays(D.today(), r.next);
            return `<div class="row g10">
              <div class="col tc" style="width:36px;flex-shrink:0">
                <div class="t-xs faint">${D.parse(r.next).toLocaleDateString('en-MY', { month: 'short' })}</div>
                <div class="t-md w7 num">${D.parse(r.next).getDate()}</div>
              </div>
              <div class="cat-av cat-av-sm" style="background:${c.color}22;border-color:${c.color}44">${c.icon}</div>
              <div class="grow truncate">
                <div class="t-sm w6 truncate">${esc(r.label)}</div>
                <div class="t-xs ${d <= 1 ? 'warnc w6' : 'faint'}">${esc(D.rel(r.next))}</div>
              </div>
              <div class="t-sm w7 num ${r.type === 'income' ? 'up' : 'down'}">${r.type === 'income' ? '+' : '−'}${M.fmt(r.amount)}</div>
            </div>`;
          }).join('')}
        </div>` : P.empty('📅', 'Nothing scheduled', 'Add recurring bills to see them here.',
          `<button class="btn btn-p btn-sm" data-go="recurring">Add recurring</button>`)}
      </div>
    </div>
  </div>`;
};

function advanceLocal(iso, freq) {
  switch (freq) {
    case 'daily': return D.shiftDays(iso, 1);
    case 'weekly': return D.shiftDays(iso, 7);
    case 'biweekly': return D.shiftDays(iso, 14);
    case 'quarterly': return D.shiftMonths(iso, 3);
    case 'yearly': return D.shiftMonths(iso, 12);
    default: return D.shiftMonths(iso, 1);
  }
}

/* ============================================================ SETTINGS === */
Pages.settings = () => {
  const s = DB.state.settings;
  const custom = DB.state.customCats;
  const n = DB.state.tx.length;

  return `
  ${P.sectionHead('Settings', 'Preferences, categories and your data')}

  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(320px,1fr))">
    <div class="card">
      <div class="card-hd"><div><h2>Preferences</h2><div class="t-xs dim mt4">Personalise the app</div></div></div>
      <div class="col g16">
        <div class="field">
          <label class="lbl">Your name</label>
          <input class="inp" id="setName" value="${esc(s.name || '')}" placeholder="Your name">
        </div>
        <div class="field">
          <label class="lbl">Warn me when a budget reaches</label>
          <select class="sel" id="setWarn">
            ${[60, 70, 75, 80, 85, 90, 95].map(v => `<option value="${v}" ${s.budgetWarnAt === v ? 'selected' : ''}>${v}% of the limit</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="lbl">Currency</label>
          <input class="inp" value="RM — Malaysian Ringgit" disabled style="opacity:.6">
        </div>
        <button class="btn btn-p" id="saveSet">Save preferences</button>
      </div>
    </div>

    <div class="card">
      <div class="card-hd">
        <div><h2>Custom Categories</h2><div class="t-xs dim mt4">${custom.length} custom · ${Q.allCats().length} total</div></div>
        <button class="btn btn-sm" data-newcat>＋ New</button>
      </div>
      ${custom.length ? `<div class="col g8">
        ${custom.map(c => `<div class="row g10">
          <div class="cat-av cat-av-sm" style="background:${c.color}22;border-color:${c.color}44">${c.icon}</div>
          <div class="grow truncate"><div class="t-sm w6 truncate">${esc(c.name)}</div>
            <div class="t-xs faint">${c.kind === 'income' ? 'Income' : 'Expense'} category</div></div>
          <button class="ibtn ibtn-danger" data-catdel="${c.id}" title="Delete">🗑️</button>
        </div>`).join('')}
      </div>` : P.empty('🏷️', 'No custom categories', 'Create your own categories to track spending your way.',
        `<button class="btn btn-p btn-sm" data-newcat>＋ New category</button>`)}
    </div>

    <div class="card">
      <div class="card-hd"><div><h2>Your Data</h2><div class="t-xs dim mt4">Saved automatically in this browser</div></div></div>
      <div class="col g10 mb16">
        <div class="kv"><span class="t-sm dim">Transactions</span><span class="t-sm w6 num">${n}</span></div>
        <div class="kv"><span class="t-sm dim">Wallets</span><span class="t-sm w6 num">${DB.state.wallets.length}</span></div>
        <div class="kv"><span class="t-sm dim">Budgets</span><span class="t-sm w6 num">${DB.state.budgets.length}</span></div>
        <div class="kv"><span class="t-sm dim">Savings goals</span><span class="t-sm w6 num">${DB.state.goals.length}</span></div>
        <div class="kv"><span class="t-sm dim">Recurring items</span><span class="t-sm w6 num">${DB.state.recurring.length}</span></div>
      </div>
      <div class="col g8">
        <button class="btn" data-export>⬇️ Export all transactions (CSV)</button>
        <button class="btn" id="exportJson">💾 Backup data (JSON)</button>
        <button class="btn" id="importJson">📂 Restore from backup</button>
        <div class="divider" style="margin:6px 0"></div>
        <button class="btn btn-danger" id="reseed">🔄 Reload sample data</button>
        <button class="btn btn-danger" id="wipe">🗑️ Delete everything &amp; start fresh</button>
      </div>
    </div>

    <div class="card">
      <div class="card-hd"><div><h2>Coming Soon</h2><div class="t-xs dim mt4">Planned for future versions</div></div></div>
      <div class="col g10">
        ${[['🏦', 'Bank account integration', 'Auto-import transactions from your bank'],
           ['📸', 'Receipt scanning', 'Snap a photo, we fill in the details'],
           ['🤖', 'AI financial assistant', 'Ask questions about your spending'],
           ['🎯', 'Automatic categorisation', 'Expenses sorted for you as you add them'],
           ['📄', 'PDF monthly reports', 'Polished statements you can share or file']].map(([i, t, d]) => `
          <div class="row g10">
            <div class="cat-av cat-av-sm">${i}</div>
            <div class="grow"><div class="t-sm w6">${esc(t)}</div><div class="t-xs faint">${esc(d)}</div></div>
            <span class="badge badge-mute">Soon</span>
          </div>`).join('')}
      </div>
      <div class="t-xs faint mt16" style="line-height:1.6">
        Analytics can already be printed or saved as PDF from the Analytics page.
      </div>
    </div>
  </div>`;
};
