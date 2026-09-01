/* ==========================================================================
   MyCashFlow — UI kernel: toasts, modals, forms, confirm, pickers
   ========================================================================== */

const esc = C.esc;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------------------------------------------------------- TOASTS */
const Toast = {
  show(title, msg, tone = 'info', ms = 4200) {
    const tones = {
      up: { c: 'var(--up)', i: '✅' }, down: { c: 'var(--down)', i: '⚠️' },
      warn: { c: 'var(--warn)', i: '⚠️' }, info: { c: 'var(--brand)', i: 'ℹ️' }
    };
    const t = tones[tone] || tones.info;
    const el = document.createElement('div');
    el.className = 'toast';
    el.style.setProperty('--tc', t.c);
    el.innerHTML = `<span class="toast-ic">${t.i}</span>
      <div class="grow"><div class="toast-t">${esc(title)}</div>${msg ? `<div class="toast-m">${msg}</div>` : ''}</div>
      <button class="ibtn" style="width:22px;height:22px;font-size:.75rem">✕</button>`;
    $('#toasts').appendChild(el);
    const kill = () => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 300);
    };
    el.querySelector('button').onclick = kill;
    setTimeout(kill, ms);
  },
  ok(t, m) { Toast.show(t, m, 'up'); },
  err(t, m) { Toast.show(t, m, 'down'); },
  warn(t, m) { Toast.show(t, m, 'warn'); },
  info(t, m) { Toast.show(t, m, 'info'); }
};

/* ---------------------------------------------------------------- MODALS */
const Modal = {
  stack: [],

  open({ title, icon = '', body, footer, size = '', onMount, onClose, closeOnBackdrop = true }) {
    const ovl = document.createElement('div');
    ovl.className = 'ovl';
    ovl.innerHTML = `
      <div class="modal ${size}" role="dialog" aria-modal="true">
        <div class="modal-hd">
          ${icon ? `<div class="cat-av">${icon}</div>` : ''}
          <div class="grow"><h2 style="font-size:1.05rem">${esc(title)}</h2></div>
          <button class="ibtn" data-x aria-label="Close">✕</button>
        </div>
        <div class="modal-bd">${body}</div>
        ${footer ? `<div class="modal-ft">${footer}</div>` : ''}
      </div>`;
    $('#modalRoot').appendChild(ovl);
    document.body.style.overflow = 'hidden';

    const inst = { ovl, close: () => Modal.close(inst) };
    inst.onClose = onClose;
    Modal.stack.push(inst);

    ovl.querySelector('[data-x]').onclick = inst.close;
    if (closeOnBackdrop) {
      ovl.addEventListener('mousedown', e => { if (e.target === ovl) inst.close(); });
    }
    if (onMount) onMount(ovl, inst);
    // focus first sensible control
    setTimeout(() => {
      const f = ovl.querySelector('[data-focus], input:not([type=hidden]), select, textarea');
      if (f) f.focus();
    }, 60);
    return inst;
  },

  close(inst) {
    const i = inst || Modal.stack[Modal.stack.length - 1];
    if (!i) return;
    i.ovl.style.animation = 'fadeIn .18s reverse';
    setTimeout(() => {
      i.ovl.remove();
      Modal.stack = Modal.stack.filter(x => x !== i);
      if (!Modal.stack.length) document.body.style.overflow = '';
      if (i.onClose) i.onClose();
    }, 150);
  },

  closeAll() { [...Modal.stack].forEach(i => Modal.close(i)); },

  /** promise-based confirm */
  confirm({ title = 'Are you sure?', msg = '', okLabel = 'Confirm', danger = false, icon = '❓' }) {
    return new Promise(res => {
      let done = false;
      const inst = Modal.open({
        title, icon, size: 'modal-sm',
        body: `<p class="t-md muted" style="line-height:1.65">${msg}</p>`,
        footer: `<button class="btn" data-no>Cancel</button>
                 <button class="btn ${danger ? 'btn-dn' : 'btn-p'}" data-yes data-focus>${esc(okLabel)}</button>`,
        onMount(ovl, i) {
          ovl.querySelector('[data-no]').onclick = () => { done = true; res(false); i.close(); };
          ovl.querySelector('[data-yes]').onclick = () => { done = true; res(true); i.close(); };
        },
        onClose() { if (!done) res(false); }
      });
    });
  }
};

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (Modal.stack.length) Modal.close();
    else if ($('#fabMenu').classList.contains('open')) UI.toggleFab(false);
  }
});

/* ------------------------------------------------------------ FORM UTILS */
const F = {
  /** category picker markup */
  pickCats(cats, selected, name = 'cat') {
    return `<div class="pick-grid" data-pick="${name}">
      ${cats.map(c => `
        <button type="button" class="pick ${c.id === selected ? 'on' : ''}" data-val="${esc(c.id)}">
          <span class="pick-ic">${c.icon}</span>
          <span class="pick-nm">${esc(c.name)}</span>
        </button>`).join('')}
    </div><input type="hidden" name="${name}" value="${esc(selected || '')}">`;
  },

  pickWallets(selected, name = 'wallet', exclude) {
    const ws = DB.state.wallets.filter(w => w.id !== exclude);
    return `<div class="pick-grid" data-pick="${name}">
      ${ws.map(w => `
        <button type="button" class="pick ${w.id === selected ? 'on' : ''}" data-val="${esc(w.id)}">
          <span class="pick-ic">${w.icon}</span>
          <span class="pick-nm">${esc(w.name)}</span>
          <span class="t-xs faint num">${M.short(Q.walletBalance(w.id))}</span>
        </button>`).join('')}
    </div><input type="hidden" name="${name}" value="${esc(selected || '')}">`;
  },

  /** amount field with RM prefix */
  amount(val = '', label = 'Amount') {
    return `<div class="field">
      <label class="lbl">${esc(label)} <span class="req">*</span></label>
      <div class="amt-wrap">
        <span class="cur">RM</span>
        <input class="inp amt-inp" name="amount" inputmode="decimal" placeholder="0.00"
               value="${val === '' ? '' : esc(val)}" data-focus autocomplete="off">
      </div>
      <div class="err hidden" data-err="amount"></div>
    </div>`;
  },

  sel(name, label, options, selected, req = false) {
    return `<div class="field">
      <label class="lbl">${esc(label)}${req ? ' <span class="req">*</span>' : ''}</label>
      <select class="sel" name="${name}">
        ${options.map(o => {
          const v = typeof o === 'string' ? o : o.v;
          const t = typeof o === 'string' ? o : o.t;
          return `<option value="${esc(v)}" ${String(v) === String(selected) ? 'selected' : ''}>${esc(t)}</option>`;
        }).join('')}
      </select>
    </div>`;
  },

  inp(name, label, opt = {}) {
    const { type = 'text', val = '', ph = '', req = false, ...rest } = opt;
    const attrs = Object.entries(rest).map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
    return `<div class="field">
      <label class="lbl">${esc(label)}${req ? ' <span class="req">*</span>' : ''}</label>
      <input class="inp" type="${type}" name="${name}" value="${esc(val)}" placeholder="${esc(ph)}" ${attrs} autocomplete="off">
      <div class="err hidden" data-err="${name}"></div>
    </div>`;
  },

  txt(name, label, val = '', ph = '') {
    return `<div class="field">
      <label class="lbl">${esc(label)}</label>
      <textarea class="txt" name="${name}" placeholder="${esc(ph)}">${esc(val)}</textarea>
    </div>`;
  },

  /** wire pick-grids inside a container */
  wirePicks(root) {
    $$('[data-pick]', root).forEach(grid => {
      const name = grid.dataset.pick;
      const hidden = grid.parentElement.querySelector(`input[name="${name}"]`)
        || root.querySelector(`input[name="${name}"]`);
      grid.addEventListener('click', e => {
        const b = e.target.closest('.pick');
        if (!b) return;
        $$('.pick', grid).forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        if (hidden) hidden.value = b.dataset.val;
        grid.dispatchEvent(new CustomEvent('picked', { detail: b.dataset.val, bubbles: true }));
      });
    });
  },

  /** read a form into a plain object */
  read(root) {
    const o = {};
    $$('input,select,textarea', root).forEach(el => {
      if (!el.name) return;
      o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim();
    });
    return o;
  },

  bad(root, name, msg) {
    const el = root.querySelector(`[name="${name}"]`);
    const err = root.querySelector(`[data-err="${name}"]`);
    if (el) el.classList.add('bad');
    if (err) { err.textContent = msg; err.classList.remove('hidden'); }
    if (el && el.focus) el.focus();
    return false;
  },

  clearBad(root) {
    $$('.bad', root).forEach(e => e.classList.remove('bad'));
    $$('[data-err]', root).forEach(e => { e.classList.add('hidden'); e.textContent = ''; });
  },

  /** validate amount > 0; returns cents or null */
  validAmount(root, { max = null, maxMsg = '' } = {}) {
    F.clearBad(root);
    const raw = root.querySelector('[name="amount"]').value;
    if (!String(raw).trim()) { F.bad(root, 'amount', 'Please enter an amount.'); return null; }
    const cents = M.parse(raw);
    if (!Number.isFinite(cents) || cents <= 0) { F.bad(root, 'amount', 'Amount must be greater than zero.'); return null; }
    if (cents > 1e11) { F.bad(root, 'amount', 'That amount is unrealistically large.'); return null; }
    if (max != null && cents > max) { F.bad(root, 'amount', maxMsg || `Only ${M.fmt(max)} available.`); return null; }
    return cents;
  }
};

/* --------------------------------------------------------- SHARED PIECES */
const P = {
  /** transaction row for lists */
  txRow(t, opt = {}) {
    const { showWallet = true, actions = true } = opt;
    const isT = t.type === 'transfer';
    const c = Q.cat(t.cat);
    const inc = t.type === 'income';
    const sign = isT ? '' : inc ? '+' : '−';
    const cls = isT ? 'muted' : inc ? 'up' : 'down';
    const icon = isT ? '⇄' : c.icon;
    const title = isT
      ? `${Q.walletName(t.from)} → ${Q.walletName(t.to)}`
      : (t.desc || c.name);
    const sub = isT
      ? (t.desc || 'Transfer')
      : [c.name, showWallet ? `${Q.walletIcon(t.wallet)} ${Q.walletName(t.wallet)}` : null, t.method]
          .filter(Boolean).join(' · ');

    return `<div class="tx-item" data-tx="${t.id}">
      <div class="cat-av" style="${isT ? 'background:var(--info-dim)' : `background:${c.color}22;border-color:${c.color}44`}">${icon}</div>
      <div class="grow" style="min-width:0">
        <div class="row g6"><span class="t-md w6 truncate">${esc(title)}</span></div>
        <div class="t-xs dim truncate">${esc(sub)}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div class="tx-amt ${cls}">${sign}${M.fmt(t.amount)}</div>
        <div class="t-xs faint nowrap">${esc(D.short(t.date))}</div>
      </div>
      ${actions ? `<div class="tx-acts">
        <button class="ibtn" data-edit="${t.id}" title="Edit">✏️</button>
        <button class="ibtn ibtn-danger" data-del="${t.id}" title="Delete">🗑️</button>
      </div>` : ''}
    </div>`;
  },

  empty(icon, title, sub, btn) {
    return `<div class="empty">
      <div class="empty-ic">${icon}</div>
      <div class="empty-t">${esc(title)}</div>
      <div class="empty-s">${esc(sub)}</div>
      ${btn ? `<div class="mt16">${btn}</div>` : ''}
    </div>`;
  },

  statCard({ label, value, icon, iconBg, accent, sub, spark, sparkColor, badge }) {
    return `<div class="stat" style="--accent:${accent || 'var(--grad-brand)'};--icbg:${iconBg || 'var(--brand-dim)'}">
      <div class="stat-top">
        <div class="stat-ic">${icon}</div>
        ${badge || ''}
      </div>
      <div class="stat-val money">${value}</div>
      <div class="stat-lbl">${esc(label)}</div>
      ${sub ? `<div class="t-xs dim mt4">${sub}</div>` : ''}
      ${spark ? `<div class="stat-spark">${C.spark(spark, { color: sparkColor || '#7c6cff' })}</div>` : ''}
    </div>`;
  },

  badge(pct, opt = {}) {
    const { invert = false, suffix = '', tip = '' } = opt;
    if (!Number.isFinite(pct)) return '';
    const up = pct >= 0;
    const good = invert ? !up : up;
    return `<span class="badge ${good ? 'badge-up' : 'badge-down'}"${tip ? ` data-tip="${esc(tip)}"` : ''}>${up ? '▲' : '▼'} ${Math.abs(pct).toFixed(0)}%${suffix}</span>`;
  },

  /** delta badge vs last month, with an explanatory tooltip about the basis */
  momBadge(mom, opt = {}) {
    if (!mom) return '';
    const { pace = false } = opt;
    /* Very early in the month a same-days % swings on one transaction. For
       spending, a daily-pace comparison is steadier and still honest. Income is
       deliberately excluded: it arrives in lumps (salary on a single day), so a
       "per day" rate would be meaningless — we simply omit the badge instead. */
    if (pace && mom.partial && mom.dayN < 5) {
      if (!(mom.prevFull > 0)) return '';
      const prevDays = D.daysInMonth(D.shiftMk(D.thisMonth(), -1));
      const prevRate = mom.prevFull / prevDays;
      const curRate = mom.cur / mom.dayN;
      if (!(prevRate > 0)) return '';
      const pct = (curRate - prevRate) / prevRate * 100;
      return P.badge(pct, {
        ...opt,
        tip: `Daily pace: ${M.fmt(Math.round(curRate))}/day over ${mom.dayN} day${mom.dayN === 1 ? '' : 's'} vs last month's average of ${M.fmt(Math.round(prevRate))}/day.`
      });
    }
    // Non-pace metrics (income) stay unlabelled in the first days of a month:
    // one lumpy deposit either side would produce a wildly misleading figure.
    if (!pace && mom.partial && mom.dayN < 5) return '';
    if (!(mom.prev > 0)) return '';
    const basis = mom.partial
      ? `First ${mom.dayN} days of this month (${M.fmt(mom.cur)}) vs the same days last month (${M.fmt(mom.prev)}). Last month's full total was ${M.fmt(mom.prevFull)}.`
      : `${M.fmt(mom.cur)} this month vs ${M.fmt(mom.prev)} last month.`;
    return P.badge(mom.pct, { ...opt, tip: basis });
  },

  /** budget progress row */
  budgetRow(b) {
    const clr = b.status === 'over' ? 'var(--down)' : b.status === 'warn' ? 'var(--warn)' : b.color;
    return `<div class="card card-tight" data-budget="${b.id}">
      <div class="row g12">
        <div class="cat-av" style="background:${b.color}22;border-color:${b.color}44">${b.icon}</div>
        <div class="grow" style="min-width:0">
          <div class="row between g8">
            <span class="t-md w6 truncate">${esc(b.name)}</span>
            <span class="t-sm w7 num nowrap">${M.fmt(b.spent)} <span class="faint">/ ${M.fmt(b.limit)}</span></span>
          </div>
          <div class="bar mt8"><div class="bar-fill ${b.status}" style="width:${Math.min(100, b.pct)}%"></div></div>
          <div class="row between g8 mt8">
            <span class="t-xs ${b.status === 'over' ? 'down' : b.status === 'warn' ? 'warnc' : 'dim'} w6">
              ${b.remaining >= 0 ? `${M.fmt(b.remaining)} left` : `${M.fmt(Math.abs(b.remaining))} over budget`}
            </span>
            <span class="t-xs w7" style="color:${clr}">${b.pct.toFixed(0)}%</span>
          </div>
        </div>
        <div class="col g4">
          <button class="ibtn" data-bedit="${b.cat}" title="Edit budget">✏️</button>
          <button class="ibtn ibtn-danger" data-bdel="${b.id}" title="Remove">🗑️</button>
        </div>
      </div>
    </div>`;
  },

  goalCard(g) {
    const clr = g.done ? 'var(--up)' : '#7c6cff';
    return `<div class="card" data-goal="${g.id}">
      <div class="row g12 mb16">
        <div class="cat-av cat-av-lg">${g.icon}</div>
        <div class="grow" style="min-width:0">
          <div class="t-md w7 truncate">${esc(g.name)}</div>
          <div class="t-xs dim truncate">${g.note ? esc(g.note) + ' · ' : ''}${g.due ? `Target ${D.short(g.due)}` : 'No deadline'}</div>
        </div>
        ${g.done ? '<span class="badge badge-up">✓ Done</span>' : ''}
      </div>
      <div class="row g14">
        ${C.ring(g.pct, { size: 66, thick: 7, color: clr })}
        <div class="grow">
          <div class="t-lg w7 money">${M.fmt(g.saved)} <span class="t-sm faint nowrap">/ ${M.fmt(g.target)}</span></div>
          <div class="bar mt8"><div class="bar-fill ${g.done ? 'ok' : ''}" style="width:${g.pct}%"></div></div>
          <div class="t-xs dim mt8 truncate">
            ${g.done ? 'Goal reached 🎉'
              : `${M.fmt(g.left)} to go${g.days != null && g.days > 0 ? ` · ${g.days}d left` : g.days != null && g.days <= 0 ? ' · overdue' : ''}`}
          </div>
        </div>
      </div>
      ${!g.done && g.perMonth > 0 ? `<div class="t-xs muted mt12" style="padding:8px 11px;background:var(--glass);border-radius:10px">
        💡 Save <b class="nowrap">${M.fmt(g.perMonth)}/month</b> to hit this on time.
      </div>` : ''}
      <div class="row g8 mt16">
        <button class="btn btn-p btn-sm grow" data-fund="${g.id}">＋ Add Money</button>
        <button class="ibtn" data-gedit="${g.id}" title="Edit">✏️</button>
        <button class="ibtn ibtn-danger" data-gdel="${g.id}" title="Delete">🗑️</button>
      </div>
    </div>`;
  },

  walletCard(w) {
    const s = Q.walletStats(w.id);
    const t = (WALLET_TYPES.find(x => x.id === w.type) || {});
    return `<div class="wallet-card" style="--w1:${w.tint || t.tint || 'rgba(124,108,255,.28)'}" data-wallet="${w.id}">
      <div class="row between g8 mb16" style="position:relative">
        <div class="row g10">
          <div class="cat-av" style="background:rgba(255,255,255,.1)">${w.icon}</div>
          <div>
            <div class="t-md w7 truncate">${esc(w.name)}</div>
            <div class="t-xs dim">${esc(t.name || w.type)}</div>
          </div>
        </div>
        <div class="row g2">
          <button class="ibtn" data-wedit="${w.id}" title="Edit">✏️</button>
          <button class="ibtn ibtn-danger" data-wdel="${w.id}" title="Delete">🗑️</button>
        </div>
      </div>
      <div style="position:relative">
        <div class="eyebrow">Balance</div>
        <div class="money w7" style="font-size:1.62rem;letter-spacing:-.035em;font-family:'Plus Jakarta Sans',sans-serif;${s.balance < 0 ? 'color:var(--down)' : ''}">${M.fmt(s.balance)}</div>
      </div>
      <div class="row g16 mt16" style="position:relative;margin-top:auto;padding-top:14px;border-top:1px solid rgba(255,255,255,.09)">
        <div><div class="t-xs faint">Income</div><div class="t-sm w7 up num">${M.short(s.income + s.transferIn)}</div></div>
        <div><div class="t-xs faint">Expenses</div><div class="t-sm w7 down num">${M.short(s.expense + s.transferOut)}</div></div>
        <div class="grow tr"><div class="t-xs faint">Transactions</div><div class="t-sm w7 num">${s.count}</div></div>
      </div>
    </div>`;
  },

  insightRow(i) {
    const tone = { up: 'var(--up)', down: 'var(--down)', warn: 'var(--warn)', info: 'var(--info)' }[i.tone] || 'var(--info)';
    const bg = { up: 'var(--up-dim)', down: 'var(--down-dim)', warn: 'var(--warn-dim)', info: 'var(--info-dim)' }[i.tone] || 'var(--info-dim)';
    return `<div class="insight">
      <div class="insight-ic" style="background:${bg};color:${tone}">${i.icon}</div>
      <div class="t-sm muted grow" style="line-height:1.6;align-self:center">${i.text}</div>
    </div>`;
  },

  monthOptions(selected) {
    return Q.activeMonths().map(m => ({ v: m, t: D.monthName(m, true) }));
  },

  sectionHead(title, sub, right = '') {
    return `<div class="row between g12 wrap mb16">
      <div><h2>${esc(title)}</h2>${sub ? `<div class="t-sm dim mt4">${esc(sub)}</div>` : ''}</div>
      ${right}
    </div>`;
  }
};

/* ==========================================================================
   Dlg — all create/edit dialogs
   ========================================================================== */
const Dlg = {

  /* ------------------------------------------------- INCOME / EXPENSE ---- */
  tx(type, existing) {
    const isInc = type === 'income';
    const cats = Q.catsFor(type);
    // A preset (e.g. from the calendar day view) prefills fields but is NOT an edit:
    // only a record with a real id may be updated in place.
    const editing = !!(existing && existing.id && !existing.__preset);
    const t = existing || {};
    const defWallet = t.wallet || (DB.state.wallets[0] || {}).id;
    const defCat = t.cat || cats[0].id;

    Modal.open({
      title: editing ? `Edit ${isInc ? 'Income' : 'Expense'}` : `Add ${isInc ? 'Income' : 'Expense'}`,
      icon: isInc ? '💵' : '🛒',
      body: `
        <form id="txForm" class="col g16">
          ${F.amount(editing ? M.toNum(t.amount).toFixed(2) : '')}

          <div class="field">
            <label class="lbl">Category <span class="req">*</span></label>
            ${F.pickCats(cats, defCat)}
            <button type="button" class="btn btn-xs mt8" id="newCat" style="align-self:flex-start">＋ New category</button>
          </div>

          <div class="field">
            <label class="lbl">${isInc ? 'Deposit into' : 'Paid from'} <span class="req">*</span></label>
            ${F.pickWallets(defWallet)}
          </div>

          <div class="grid g-2" style="gap:12px">
            ${F.inp('date', 'Date', { type: 'date', val: t.date || D.today(), req: true })}
            ${isInc
              ? F.inp('source', 'Income source', { val: t.source || '', ph: 'e.g. Tech Sdn Bhd' })
              : F.sel('method', 'Payment method', PAY_METHODS, t.method || 'Cash')}
          </div>

          ${F.inp('desc', 'Description', { val: t.desc || '', ph: isInc ? 'e.g. Monthly salary' : 'e.g. Lunch at kopitiam' })}
          ${F.txt('notes', 'Notes (optional)', t.notes || '', 'Any extra detail…')}
          ${isInc ? '' : `<input type="hidden" name="source" value="${esc(t.source || '')}">`}
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn ${isInc ? 'btn-up' : 'btn-dn'}" data-save>${editing ? 'Save changes' : `Add ${isInc ? 'Income' : 'Expense'}`}</button>`,
      onMount(ovl, inst) {
        const form = $('#txForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;

        $('#newCat', ovl).onclick = () => Dlg.category(type, (c) => {
          inst.close();
          Dlg.tx(type, existing);
          Toast.ok('Category created', `${c.icon} ${esc(c.name)} is ready to use.`);
        });

        const submit = () => {
          const wal = form.querySelector('[name="wallet"]').value;
          const cents = F.validAmount(form);
          if (cents == null) return;
          if (!wal) { Toast.err('Pick a wallet', 'Choose which wallet this belongs to.'); return; }
          const d = F.read(form);
          if (!d.date) return F.bad(form, 'date', 'Pick a date.');

          const payload = {
            type, amount: cents, cat: d.cat, wallet: wal, date: d.date,
            desc: d.desc || Q.cat(d.cat).name,
            method: d.method || (isInc ? 'Bank Transfer' : 'Cash'),
            source: d.source || '', notes: d.notes || ''
          };

          if (editing) {
            DB.txUpdate(existing.id, payload);
            Toast.ok('Transaction updated', `${esc(payload.desc)} · ${M.fmt(cents)}`);
          } else {
            DB.txAdd(payload);
            const bal = Q.walletBalance(wal);
            Toast.show(
              isInc ? `Income added: ${M.fmt(cents)}` : `Expense added: ${M.fmt(cents)}`,
              `${Q.walletIcon(wal)} ${esc(Q.walletName(wal))} balance is now <b>${M.fmt(bal)}</b>`,
              isInc ? 'up' : 'info'
            );
            if (!isInc) Dlg.budgetAlert(d.cat);
          }
          inst.close();
          App.render();
        };

        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /** after an expense, surface budget threshold crossings */
  budgetAlert(cat) {
    const b = Q.budgetProgress().find(x => x.cat === cat);
    if (!b) return;
    if (b.pct >= 100) {
      Toast.err(`${b.icon} ${b.name} budget exceeded`,
        `You've used <b>${b.pct.toFixed(0)}%</b> — ${M.fmt(Math.abs(b.remaining))} over your ${M.fmt(b.limit)} limit.`);
    } else if (b.pct >= (DB.state.settings.budgetWarnAt || 80)) {
      Toast.warn(`⚠️ ${b.pct.toFixed(0)}% of ${b.name} budget used`,
        `${M.fmt(b.remaining)} left for the rest of the month.`);
    }
  },

  /* -------------------------------------------------------- TRANSFER ---- */
  transfer(preFrom) {
    if (DB.state.wallets.length < 2) {
      Toast.warn('Need two wallets', 'Create at least two wallets to transfer money between them.');
      return;
    }
    const from = preFrom || DB.state.wallets[0].id;
    const to = DB.state.wallets.find(w => w.id !== from).id;

    Modal.open({
      title: 'Transfer Money', icon: '⇄',
      body: `
        <form id="trForm" class="col g16">
          ${F.amount('')}
          <div class="field">
            <label class="lbl">From wallet <span class="req">*</span></label>
            ${F.pickWallets(from, 'from')}
          </div>
          <div class="tc" style="font-size:1.3rem;color:var(--info)">↓</div>
          <div class="field">
            <label class="lbl">To wallet <span class="req">*</span></label>
            <div id="toZone">${F.pickWallets(to, 'to', from)}</div>
          </div>
          ${F.inp('date', 'Date', { type: 'date', val: D.today(), req: true })}
          ${F.inp('desc', 'Description', { ph: 'e.g. Monthly savings' })}
          <div class="t-xs muted" style="padding:10px 12px;background:var(--info-dim);border-radius:10px;line-height:1.6">
            ℹ️ Transfers move money between your wallets. Your <b>total balance stays the same</b>.
          </div>
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn btn-p" data-save>Transfer</button>`,
      onMount(ovl, inst) {
        const form = $('#trForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;

        // rebuild destination when source changes, to prevent same-wallet transfer
        form.addEventListener('picked', e => {
          const grid = e.target.closest('[data-pick]');
          if (!grid || grid.dataset.pick !== 'from') return;
          const f = form.querySelector('[name="from"]').value;
          const cur = form.querySelector('[name="to"]').value;
          const nextTo = cur === f ? (DB.state.wallets.find(w => w.id !== f) || {}).id : cur;
          $('#toZone', ovl).innerHTML = F.pickWallets(nextTo, 'to', f);
          F.wirePicks($('#toZone', ovl));
        });

        const submit = () => {
          const d = F.read(form);
          const f = d.from, tt = d.to;
          if (!f || !tt) { Toast.err('Pick both wallets'); return; }
          if (f === tt) { Toast.err('Same wallet', 'Choose two different wallets.'); return; }
          const avail = Q.walletBalance(f);
          const cents = F.validAmount(form, {
            max: avail > 0 ? avail : 0,
            maxMsg: `${Q.walletName(f)} only has ${M.fmt(Math.max(0, avail))} available.`
          });
          if (cents == null) return;
          if (!d.date) return F.bad(form, 'date', 'Pick a date.');

          DB.txAdd({ type: 'transfer', amount: cents, from: f, to: tt, date: d.date, desc: d.desc || 'Transfer' });
          Toast.ok(`Transferred ${M.fmt(cents)}`,
            `${Q.walletIcon(f)} ${esc(Q.walletName(f))} → <b>${M.fmt(Q.walletBalance(f))}</b><br>${Q.walletIcon(tt)} ${esc(Q.walletName(tt))} → <b>${M.fmt(Q.walletBalance(tt))}</b>`);
          inst.close();
          App.render();
        };
        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /* ------------------------------------------------------ FUND A GOAL --- */
  fundGoal(goalId) {
    const goals = Q.goalProgress().filter(g => !g.done);
    if (!DB.state.goals.length) {
      Toast.warn('No savings goals yet', 'Create a goal first, then you can add money to it.');
      App.go('goals');
      return;
    }
    const pick = goalId || (goals[0] || DB.state.goals[0]).id;
    const g = DB.goalGet(pick);
    const srcWallets = DB.state.wallets;
    const defSrc = (srcWallets.find(w => w.id !== g.wallet) || srcWallets[0]).id;

    Modal.open({
      title: 'Add Money to Savings', icon: g.icon || '🏆',
      body: `
        <form id="fgForm" class="col g16">
          ${F.sel('goal', 'Savings goal', DB.state.goals.map(x => ({
            v: x.id, t: `${x.icon} ${x.name} — ${M.fmt(x.saved)} / ${M.fmt(x.target)}`
          })), pick, true)}
          ${F.amount('')}
          <div class="field">
            <label class="lbl">Take money from <span class="req">*</span></label>
            ${F.pickWallets(defSrc, 'src')}
          </div>
          ${F.inp('date', 'Date', { type: 'date', val: D.today(), req: true })}
          <div id="fgHint" class="t-xs muted" style="padding:10px 12px;background:var(--glass);border-radius:10px;line-height:1.6"></div>
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn btn-p" data-save>Add to Savings</button>`,
      onMount(ovl, inst) {
        const form = $('#fgForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;

        const hint = () => {
          const gg = DB.goalGet(form.querySelector('[name="goal"]').value);
          if (!gg) return;
          const left = Math.max(0, gg.target - gg.saved);
          const dest = Q.walletName(gg.wallet);
          $('#fgHint', ovl).innerHTML =
            `${gg.icon} <b>${esc(gg.name)}</b> needs <b>${M.fmt(left)}</b> more.<br>Money lands in <b>${esc(dest)}</b>.`;
        };
        hint();
        form.querySelector('[name="goal"]').onchange = hint;

        const submit = () => {
          const d = F.read(form);
          const gg = DB.goalGet(d.goal);
          if (!gg) { Toast.err('Pick a goal'); return; }
          const avail = Q.walletBalance(d.src);
          const cents = F.validAmount(form, {
            max: avail > 0 ? avail : 0,
            maxMsg: `${Q.walletName(d.src)} only has ${M.fmt(Math.max(0, avail))} available.`
          });
          if (cents == null) return;

          DB.goalFund(gg.id, cents, d.src, d.date);
          const up = DB.goalGet(gg.id);
          const pct = up.target ? Math.min(100, up.saved / up.target * 100) : 0;
          Toast.ok(`${M.fmt(cents)} added to ${esc(up.name)}`,
            `Progress: <b>${M.fmt(up.saved)} / ${M.fmt(up.target)}</b> (${pct.toFixed(0)}%)`);
          if (up.saved >= up.target) {
            setTimeout(() => Toast.show(`🎉 Goal reached: ${esc(up.name)}`, `You saved the full ${M.fmt(up.target)}!`, 'up', 7000), 500);
          }
          inst.close();
          App.render();
        };
        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /* ------------------------------------------------------------- GOAL --- */
  goal(existing) {
    const g = existing || {};
    const icons = ['🎓', '✈️', '🚗', '💰', '🏠', '📱', '💻', '🎁', '💍', '🏥', '📚', '🎯'];
    Modal.open({
      title: existing ? 'Edit Savings Goal' : 'New Savings Goal', icon: g.icon || '🏆',
      body: `
        <form id="glForm" class="col g16">
          ${F.inp('name', 'Goal name', { val: g.name || '', ph: 'e.g. Buy Laptop', req: true, 'data-focus': '1' })}
          <div class="field">
            <label class="lbl">Icon</label>
            <div class="pick-grid" data-pick="icon" style="grid-template-columns:repeat(auto-fill,minmax(56px,1fr))">
              ${icons.map(i => `<button type="button" class="pick ${i === (g.icon || '🎯') ? 'on' : ''}" data-val="${i}"><span class="pick-ic">${i}</span></button>`).join('')}
            </div>
            <input type="hidden" name="icon" value="${esc(g.icon || '🎯')}">
          </div>
          <div class="grid g-2" style="gap:12px">
            <div class="field">
              <label class="lbl">Target amount <span class="req">*</span></label>
              <div class="amt-wrap"><span class="cur" style="font-size:.9rem">RM</span>
                <input class="inp" name="target" inputmode="decimal" style="padding-left:44px"
                  placeholder="0.00" value="${g.target ? M.toNum(g.target).toFixed(2) : ''}">
              </div>
              <div class="err hidden" data-err="target"></div>
            </div>
            ${F.inp('due', 'Target date', { type: 'date', val: g.due || D.shiftMonths(D.today(), 6) })}
          </div>
          ${existing ? `<div class="field">
            <label class="lbl">Already saved</label>
            <div class="amt-wrap"><span class="cur" style="font-size:.9rem">RM</span>
              <input class="inp" name="saved" inputmode="decimal" style="padding-left:44px" value="${M.toNum(g.saved || 0).toFixed(2)}">
            </div>
          </div>` : ''}
          ${F.sel('wallet', 'Keep savings in', DB.state.wallets.map(w => ({ v: w.id, t: `${w.icon} ${w.name}` })),
            g.wallet || (DB.state.wallets.find(w => w.type === 'savings') || DB.state.wallets[0] || {}).id, true)}
          ${F.inp('note', 'Note (optional)', { val: g.note || '', ph: 'e.g. MacBook Air M3' })}
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn btn-p" data-save>${existing ? 'Save changes' : 'Create Goal'}</button>`,
      onMount(ovl, inst) {
        const form = $('#glForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;
        const submit = () => {
          F.clearBad(form);
          const d = F.read(form);
          if (!d.name) return F.bad(form, 'name', 'Give your goal a name.');
          const target = M.parse(d.target);
          if (target <= 0) return F.bad(form, 'target', 'Target must be greater than zero.');
          const payload = {
            name: d.name, icon: d.icon, target, due: d.due || '',
            wallet: d.wallet, note: d.note || ''
          };
          if (existing) {
            payload.saved = Math.max(0, M.parse(d.saved));
            DB.goalUpdate(existing.id, payload);
            Toast.ok('Goal updated', esc(d.name));
          } else {
            DB.goalAdd(payload);
            Toast.ok('Goal created', `${d.icon} ${esc(d.name)} · target ${M.fmt(target)}`);
          }
          inst.close();
          App.render();
        };
        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /* ----------------------------------------------------------- BUDGET --- */
  budget(catId) {
    const editing = !!catId;
    const existing = editing ? DB.state.budgets.find(b => b.cat === catId) : null;
    const options = editing ? Q.expenseCats() : (Q.unbudgetedCats().length ? Q.unbudgetedCats() : Q.expenseCats());
    const sel = catId || options[0].id;
    const spent = Q.sum(Q.inMonth(D.thisMonth(), 'expense').filter(t => t.cat === sel));

    Modal.open({
      title: editing ? 'Edit Budget' : 'Set Monthly Budget', icon: '🎯',
      body: `
        <form id="bdForm" class="col g16">
          <div class="field">
            <label class="lbl">Category <span class="req">*</span></label>
            ${editing
              ? `<div class="row g10" style="padding:11px 13px;background:var(--glass);border-radius:12px">
                   <span style="font-size:1.2rem">${Q.cat(sel).icon}</span>
                   <b>${esc(Q.cat(sel).name)}</b>
                 </div><input type="hidden" name="cat" value="${esc(sel)}">`
              : F.pickCats(options, sel)}
          </div>
          <div class="field">
            <label class="lbl">Monthly limit <span class="req">*</span></label>
            <div class="amt-wrap"><span class="cur">RM</span>
              <input class="inp amt-inp" name="amount" inputmode="decimal" placeholder="0.00"
                value="${existing ? M.toNum(existing.limit).toFixed(2) : ''}" data-focus>
            </div>
            <div class="err hidden" data-err="amount"></div>
          </div>
          <div class="t-xs muted" id="bdHint" style="padding:10px 12px;background:var(--glass);border-radius:10px;line-height:1.6">
            You've already spent <b>${M.fmt(spent)}</b> in this category this month.
          </div>
          <div class="row g8 wrap">
            ${[100, 200, 300, 500, 800, 1000].map(v => `<button type="button" class="chip" data-quick="${v}">RM ${v}</button>`).join('')}
          </div>
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn btn-p" data-save>${editing ? 'Save Budget' : 'Set Budget'}</button>`,
      onMount(ovl, inst) {
        const form = $('#bdForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;
        const amt = form.querySelector('[name="amount"]');

        $$('[data-quick]', ovl).forEach(b => b.onclick = () => { amt.value = b.dataset.quick; amt.focus(); });

        form.addEventListener('picked', () => {
          const c = form.querySelector('[name="cat"]').value;
          const s = Q.sum(Q.inMonth(D.thisMonth(), 'expense').filter(t => t.cat === c));
          $('#bdHint', ovl).innerHTML = `You've already spent <b>${M.fmt(s)}</b> on ${esc(Q.cat(c).name)} this month.`;
        });

        const submit = () => {
          const cents = F.validAmount(form);
          if (cents == null) return;
          const d = F.read(form);
          DB.budgetSet(d.cat, cents);
          const b = Q.budgetProgress().find(x => x.cat === d.cat);
          Toast.ok(`Budget set: ${esc(Q.cat(d.cat).name)}`,
            `${M.fmt(cents)}/month · currently at <b>${b ? b.pct.toFixed(0) : 0}%</b>`);
          inst.close();
          App.render();
        };
        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /* ----------------------------------------------------------- WALLET --- */
  wallet(existing) {
    const w = existing || {};
    Modal.open({
      title: existing ? 'Edit Wallet' : 'New Wallet', icon: w.icon || '👝',
      body: `
        <form id="wlForm" class="col g16">
          ${F.inp('name', 'Wallet name', { val: w.name || '', ph: 'e.g. Maybank Savings', req: true, 'data-focus': '1' })}
          <div class="field">
            <label class="lbl">Wallet type <span class="req">*</span></label>
            <div class="pick-grid" data-pick="type">
              ${WALLET_TYPES.map(t => `
                <button type="button" class="pick ${t.id === (w.type || 'cash') ? 'on' : ''}" data-val="${t.id}" data-icon="${t.icon}" data-tint="${t.tint}">
                  <span class="pick-ic">${t.icon}</span><span class="pick-nm">${esc(t.name)}</span>
                </button>`).join('')}
            </div>
            <input type="hidden" name="type" value="${esc(w.type || 'cash')}">
          </div>
          <div class="field">
            <label class="lbl">${existing ? 'Opening balance' : 'Starting balance'}</label>
            <div class="amt-wrap"><span class="cur" style="font-size:.9rem">RM</span>
              <input class="inp" name="opening" inputmode="decimal" style="padding-left:44px"
                placeholder="0.00" value="${w.opening != null ? M.toNum(w.opening).toFixed(2) : ''}">
            </div>
            ${existing ? `<div class="t-xs faint">Current balance including transactions: <b>${M.fmt(Q.walletBalance(w.id))}</b></div>` : ''}
          </div>
          ${F.inp('note', 'Note (optional)', { val: w.note || '', ph: 'e.g. Primary account' })}
          <div class="t-xs muted" style="padding:10px 12px;background:var(--glass);border-radius:10px;line-height:1.6">
            💡 Wallets of type <b>Savings Account</b> are counted as savings, not as available spending money.
          </div>
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn btn-p" data-save>${existing ? 'Save changes' : 'Create Wallet'}</button>`,
      onMount(ovl, inst) {
        const form = $('#wlForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;
        const submit = () => {
          F.clearBad(form);
          const d = F.read(form);
          if (!d.name) return F.bad(form, 'name', 'Give your wallet a name.');
          const t = WALLET_TYPES.find(x => x.id === d.type) || WALLET_TYPES[0];
          const payload = {
            name: d.name, type: d.type, icon: t.icon, tint: t.tint,
            opening: M.parse(d.opening || 0), note: d.note || ''
          };
          if (existing) { DB.walletUpdate(existing.id, payload); Toast.ok('Wallet updated', esc(d.name)); }
          else { DB.walletAdd(payload); Toast.ok('Wallet created', `${t.icon} ${esc(d.name)} · ${M.fmt(payload.opening)}`); }
          inst.close();
          App.render();
        };
        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /* -------------------------------------------------------- RECURRING --- */
  recurring(existing) {
    const r = existing || {};
    const type = r.type || 'expense';
    Modal.open({
      title: existing ? 'Edit Recurring' : 'New Recurring Transaction', icon: '🔁',
      body: `
        <form id="rcForm" class="col g16">
          <div class="field">
            <label class="lbl">Type <span class="req">*</span></label>
            <div class="seg" style="width:100%" data-seg="type">
              <button type="button" class="${type === 'expense' ? 'on' : ''}" data-val="expense" style="flex:1">📉 Expense</button>
              <button type="button" class="${type === 'income' ? 'on' : ''}" data-val="income" style="flex:1">📈 Income</button>
            </div>
            <input type="hidden" name="type" value="${esc(type)}">
          </div>
          ${F.inp('label', 'Name', { val: r.label || '', ph: 'e.g. Netflix Subscription', req: true, 'data-focus': '1' })}
          <div class="field">
            <label class="lbl">Amount <span class="req">*</span></label>
            <div class="amt-wrap"><span class="cur">RM</span>
              <input class="inp amt-inp" name="amount" inputmode="decimal" placeholder="0.00"
                value="${r.amount ? M.toNum(r.amount).toFixed(2) : ''}">
            </div>
            <div class="err hidden" data-err="amount"></div>
          </div>
          <div class="field">
            <label class="lbl">Category <span class="req">*</span></label>
            <div id="rcCats">${F.pickCats(Q.catsFor(type), r.cat || Q.catsFor(type)[0].id)}</div>
          </div>
          <div class="grid g-2" style="gap:12px">
            ${F.sel('wallet', 'Wallet', DB.state.wallets.map(w => ({ v: w.id, t: `${w.icon} ${w.name}` })), r.wallet || (DB.state.wallets[0] || {}).id, true)}
            ${F.sel('freq', 'Repeats', [
              { v: 'daily', t: 'Daily' }, { v: 'weekly', t: 'Weekly' }, { v: 'biweekly', t: 'Every 2 weeks' },
              { v: 'monthly', t: 'Monthly' }, { v: 'quarterly', t: 'Every 3 months' }, { v: 'yearly', t: 'Yearly' }
            ], r.freq || 'monthly', true)}
          </div>
          <div class="grid g-2" style="gap:12px">
            ${F.inp('next', 'Next due date', { type: 'date', val: r.next || D.today(), req: true })}
            ${F.sel('method', 'Payment method', PAY_METHODS, r.method || 'Online Banking')}
          </div>
          <label class="row g10" style="padding:12px;background:var(--glass);border-radius:12px;cursor:pointer">
            <input type="checkbox" name="autopost" ${r.autopost ? 'checked' : ''} style="width:17px;height:17px;accent-color:#7c6cff">
            <div class="grow">
              <div class="t-sm w6">Add automatically when due</div>
              <div class="t-xs dim">Off = you'll just get a reminder to confirm it.</div>
            </div>
          </label>
          <label class="row g10" style="padding:12px;background:var(--glass);border-radius:12px;cursor:pointer">
            <input type="checkbox" name="active" ${r.active !== false ? 'checked' : ''} style="width:17px;height:17px;accent-color:#7c6cff">
            <div class="grow"><div class="t-sm w6">Active</div><div class="t-xs dim">Pause without deleting.</div></div>
          </label>
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn btn-p" data-save>${existing ? 'Save changes' : 'Create Recurring'}</button>`,
      onMount(ovl, inst) {
        const form = $('#rcForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;

        // type toggle rebuilds category picker
        const seg = $('[data-seg="type"]', ovl);
        seg.addEventListener('click', e => {
          const b = e.target.closest('button[data-val]');
          if (!b) return;
          $$('button', seg).forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          form.querySelector('[name="type"]').value = b.dataset.val;
          const cats = Q.catsFor(b.dataset.val);
          $('#rcCats', ovl).innerHTML = F.pickCats(cats, cats[0].id);
          F.wirePicks($('#rcCats', ovl));
        });

        const submit = () => {
          const cents = F.validAmount(form);
          if (cents == null) return;
          const d = F.read(form);
          if (!d.label) return F.bad(form, 'label', 'Give it a name.');
          if (!d.next) return F.bad(form, 'next', 'Pick the next due date.');
          const payload = {
            label: d.label, type: d.type, amount: cents, cat: d.cat, wallet: d.wallet,
            freq: d.freq, next: d.next, method: d.method,
            dayOfMonth: D.parse(d.next).getDate(),
            autopost: !!d.autopost, active: !!d.active
          };
          if (existing) { DB.recurUpdate(existing.id, payload); Toast.ok('Recurring updated', esc(d.label)); }
          else { DB.recurAdd(payload); Toast.ok('Recurring created', `${esc(d.label)} · ${M.fmt(cents)} ${d.freq}`); }
          inst.close();
          App.render();
        };
        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /* --------------------------------------------------- CUSTOM CATEGORY -- */
  category(kind = 'expense', cb) {
    const icons = ['🏷️', '🍕', '☕', '🐶', '🎨', '🎵', '🏋️', '🚲', '🧾', '💡', '🧴', '👶', '🎓', '🛠️', '🌱', '💸'];
    const colors = ['#fb7185', '#60a5fa', '#c084fc', '#fbbf24', '#34d399', '#22d3ee', '#f472b6', '#94a3b8'];
    Modal.open({
      title: 'New Category', icon: '🏷️', size: 'modal-sm',
      body: `
        <form id="ctForm" class="col g16">
          ${F.inp('name', 'Category name', { ph: 'e.g. Pet Care', req: true, 'data-focus': '1' })}
          <div class="field">
            <label class="lbl">Type</label>
            <div class="seg" style="width:100%" data-seg="kind">
              <button type="button" class="${kind === 'expense' ? 'on' : ''}" data-val="expense" style="flex:1">Expense</button>
              <button type="button" class="${kind === 'income' ? 'on' : ''}" data-val="income" style="flex:1">Income</button>
            </div>
            <input type="hidden" name="kind" value="${esc(kind)}">
          </div>
          <div class="field">
            <label class="lbl">Icon</label>
            <div class="pick-grid" data-pick="icon" style="grid-template-columns:repeat(auto-fill,minmax(50px,1fr))">
              ${icons.map((i, n) => `<button type="button" class="pick ${n === 0 ? 'on' : ''}" data-val="${i}"><span class="pick-ic">${i}</span></button>`).join('')}
            </div>
            <input type="hidden" name="icon" value="🏷️">
          </div>
          <div class="field">
            <label class="lbl">Colour</label>
            <div class="row g8 wrap" data-pick="color">
              ${colors.map((c, n) => `<button type="button" class="pick ${n === 0 ? 'on' : ''}" data-val="${c}" style="width:38px;height:38px;padding:0"><span style="width:18px;height:18px;border-radius:6px;background:${c};display:block"></span></button>`).join('')}
            </div>
            <input type="hidden" name="color" value="${colors[0]}">
          </div>
        </form>`,
      footer: `<button class="btn" data-cancel>Cancel</button>
               <button class="btn btn-p" data-save>Create</button>`,
      onMount(ovl, inst) {
        const form = $('#ctForm', ovl);
        F.wirePicks(form);
        $('[data-cancel]', ovl).onclick = inst.close;
        const seg = $('[data-seg="kind"]', ovl);
        seg.addEventListener('click', e => {
          const b = e.target.closest('button[data-val]');
          if (!b) return;
          $$('button', seg).forEach(x => x.classList.remove('on'));
          b.classList.add('on');
          form.querySelector('[name="kind"]').value = b.dataset.val;
        });
        const submit = () => {
          F.clearBad(form);
          const d = F.read(form);
          if (!d.name) return F.bad(form, 'name', 'Name your category.');
          const dupe = Q.allCats().some(c => c.name.toLowerCase() === d.name.toLowerCase());
          if (dupe) return F.bad(form, 'name', 'A category with that name already exists.');
          const c = DB.catAdd({ name: d.name, icon: d.icon, color: d.color, kind: d.kind });
          inst.close();
          if (cb) cb(c); else { Toast.ok('Category created', `${c.icon} ${esc(c.name)}`); App.render(); }
        };
        $('[data-save]', ovl).onclick = submit;
        form.onsubmit = e => { e.preventDefault(); submit(); };
      }
    });
  },

  /* ------------------------------------------------------- VIEW A DAY --- */
  day(iso) {
    const list = Q.sorted(Q.onDate(iso));
    const inc = Q.sum(list, 'income'), exp = Q.sum(list, 'expense');
    const due = DB.state.recurring.filter(r => r.active && r.next === iso);

    Modal.open({
      title: D.pretty(iso), icon: '📅',
      body: `
        <div class="grid g-3 mb16" style="gap:10px">
          <div class="card card-tight tc"><div class="t-xs faint">Income</div><div class="t-md w7 up money">${M.fmt(inc)}</div></div>
          <div class="card card-tight tc"><div class="t-xs faint">Spent</div><div class="t-md w7 down money">${M.fmt(exp)}</div></div>
          <div class="card card-tight tc"><div class="t-xs faint">Net</div><div class="t-md w7 money ${inc - exp >= 0 ? 'up' : 'down'}">${M.fmt(inc - exp, { sign: true })}</div></div>
        </div>
        ${due.length ? `<div class="mb16">
          <div class="eyebrow mb8">Scheduled for this day</div>
          ${due.map(r => `<div class="tx-item">
            <div class="cat-av" style="background:var(--warn-dim)">🔁</div>
            <div class="grow"><div class="t-md w6">${esc(r.label)}</div><div class="t-xs dim">${esc(r.freq)} · ${esc(Q.walletName(r.wallet))}</div></div>
            <div class="tx-amt ${r.type === 'income' ? 'up' : 'down'}">${r.type === 'income' ? '+' : '−'}${M.fmt(r.amount)}</div>
          </div>`).join('')}
        </div>` : ''}
        <div class="eyebrow mb8">Transactions (${list.length})</div>
        ${list.length ? `<div class="tx-list">${list.map(t => P.txRow(t)).join('')}</div>`
          : P.empty('🗓️', 'Nothing recorded', 'No income or expenses on this day.')}`,
      footer: `<button class="btn" data-cancel>Close</button>
               <button class="btn btn-dn" data-addexp>＋ Expense</button>
               <button class="btn btn-up" data-addinc>＋ Income</button>`,
      onMount(ovl, inst) {
        $('[data-cancel]', ovl).onclick = inst.close;
        $('[data-addexp]', ovl).onclick = () => { inst.close(); Dlg.prefillDate = iso; Dlg.txWithDate('expense', iso); };
        $('[data-addinc]', ovl).onclick = () => { inst.close(); Dlg.txWithDate('income', iso); };
        App.wireTxActions(ovl, () => { inst.close(); App.render(); });
      }
    });
  },

  /** open tx dialog with a preset date */
  txWithDate(type, iso) {
    Dlg.tx(type, { date: iso, wallet: (DB.state.wallets[0] || {}).id, cat: Q.catsFor(type)[0].id, amount: 0, __preset: true });
  },

  /* --------------------------------------------------- TX DETAIL VIEW --- */
  txView(id) {
    const t = DB.txGet(id);
    if (!t) return;
    const isT = t.type === 'transfer';
    const c = Q.cat(t.cat);
    const rows = isT
      ? [['Type', 'Transfer'], ['From', `${Q.walletIcon(t.from)} ${Q.walletName(t.from)}`], ['To', `${Q.walletIcon(t.to)} ${Q.walletName(t.to)}`]]
      : [['Type', t.type === 'income' ? 'Income' : 'Expense'],
         ['Category', `${c.icon} ${c.name}`],
         ['Wallet', `${Q.walletIcon(t.wallet)} ${Q.walletName(t.wallet)}`],
         [t.type === 'income' ? 'Source' : 'Payment method', (t.type === 'income' ? t.source : t.method) || '—']];
    rows.push(['Date', D.pretty(t.date)]);
    if (t.notes) rows.push(['Notes', t.notes]);

    Modal.open({
      title: t.desc || c.name, icon: isT ? '⇄' : c.icon, size: 'modal-sm',
      body: `
        <div class="tc mb20">
          <div class="money w7 ${isT ? '' : t.type === 'income' ? 'up' : 'down'}" style="font-size:2.05rem;font-family:'Plus Jakarta Sans',sans-serif;letter-spacing:-.04em">
            ${isT ? '' : t.type === 'income' ? '+' : '−'}${M.fmt(t.amount)}
          </div>
        </div>
        <div class="card card-tight">
          ${rows.map(([k, v]) => `<div class="kv"><span class="t-sm dim">${esc(k)}</span><span class="t-sm w6" style="text-align:right">${esc(v)}</span></div>`).join('')}
        </div>`,
      footer: `<button class="btn btn-danger" data-d>🗑️ Delete</button>
               <button class="btn btn-p" data-e>✏️ Edit</button>`,
      onMount(ovl, inst) {
        $('[data-e]', ovl).onclick = () => {
          inst.close();
          if (isT) Toast.info('Transfers are not editable', 'Delete it and create a new transfer instead.');
          else Dlg.tx(t.type, t);
        };
        $('[data-d]', ovl).onclick = async () => {
          inst.close();
          await App.deleteTx(id);
        };
      }
    });
  }
};

