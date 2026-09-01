/* ==========================================================================
   MyCashFlow — app controller: routing, event wiring, notifications
   ========================================================================== */

const App = {
  page: 'dashboard',
  month: D.thisMonth(),
  selectedDay: null,

  meta: {
    dashboard: ['Dashboard', 'Your financial overview'],
    analytics: ['Analytics & Insights', 'Understand your money patterns'],
    calendar: ['Financial Calendar', 'Daily money activity'],
    income: ['Income Tracker', 'Everything coming in'],
    spending: ['Spending Wallet', 'Where your money goes'],
    wallets: ['My Wallets', 'Accounts and balances'],
    history: ['Transaction History', 'Every record'],
    budgets: ['Budget Planner', 'Monthly spending limits'],
    goals: ['Savings Goals', 'Targets and progress'],
    recurring: ['Recurring Payments', 'Bills and subscriptions'],
    settings: ['Settings', 'Preferences and data']
  },

  filters: {
    income: { q: '', month: 'all', cat: 'all', wallet: 'all' },
    spending: { q: '', month: 'all', cat: 'all', wallet: 'all', method: 'all', from: '', to: '' },
    history: { q: '', type: 'all', month: 'all', cat: 'all', wallet: 'all', from: '', to: '', sort: 'date', dir: 'desc' }
  },

  /* ---------------------------------------------------------------- boot */
  init() {
    // auto-post any recurring transactions that came due while away
    const posted = DB.runDueRecurring();

    App.month = D.thisMonth();
    App.bindShell();
    App.route(location.hash.replace('#', '') || 'dashboard');

    if (posted.length) {
      setTimeout(() => {
        Toast.info(`${posted.length} recurring transaction${posted.length > 1 ? 's' : ''} added`,
          posted.slice(0, 3).map(p => `${p.type === 'income' ? '+' : '−'}${M.fmt(p.amount)} ${esc(p.label)}`).join('<br>'));
      }, 900);
    }

    // first-run welcome
    if (!localStorage.getItem('mycashflow.seen')) {
      localStorage.setItem('mycashflow.seen', '1');
      setTimeout(() => App.welcome(), 500);
    } else {
      setTimeout(() => App.nudge(), 1400);
    }
  },

  welcome() {
    Modal.open({
      title: 'Welcome to MyCashFlow', icon: '💸',
      body: `
        <p class="t-md muted mb16" style="line-height:1.7">
          Your smart spending wallet — track money, understand spending, control cash flow and save more.
          We've loaded <b>realistic sample data</b> so you can explore everything right away.
        </p>
        <div class="col g10 mb16">
          ${[['➕', 'Tap the ＋ button', 'Add income, expenses, transfers or savings in seconds'],
             ['📊', 'Watch it update live', 'Balances, charts and budgets recalculate instantly'],
             ['🎯', 'Set budgets & goals', 'Get warned before you overspend'],
             ['💾', 'Saved automatically', 'Your data stays in this browser — no account needed']].map(([i, t, d]) => `
            <div class="row g12" style="padding:11px;background:var(--glass);border-radius:12px">
              <div class="cat-av cat-av-sm">${i}</div>
              <div><div class="t-sm w6">${t}</div><div class="t-xs dim">${d}</div></div>
            </div>`).join('')}
        </div>
        <div class="t-xs muted" style="padding:11px;background:var(--brand-dim);border-radius:10px;line-height:1.6">
          💡 Want a clean slate? Go to <b>Settings → Delete everything &amp; start fresh</b>.
        </div>`,
      footer: `<button class="btn" data-fresh>Start fresh instead</button>
               <button class="btn btn-p" data-x2 data-focus>Explore the demo</button>`,
      onMount(ovl, inst) {
        $('[data-x2]', ovl).onclick = inst.close;
        $('[data-fresh]', ovl).onclick = () => {
          DB.wipe(); inst.close(); App.render();
          Toast.ok('Fresh start', 'All sample data cleared. Add your first transaction with ＋.');
        };
      }
    });
  },

  /** gentle surfacing of the most urgent notification on load */
  nudge() {
    const n = Q.notifications();
    const urgent = n.find(x => x.tone === 'down') || n.find(x => x.tone === 'warn');
    if (urgent) Toast.show(urgent.title, urgent.msg, urgent.tone, 6000);
  },

  /* --------------------------------------------------------------- shell */
  bindShell() {
    // sidebar nav + any [data-go] in the app
    document.addEventListener('click', e => {
      const go = e.target.closest('[data-go]');
      if (go) { App.go(go.dataset.go); return; }
    });

    // mobile drawer
    const nav = $('#nav');
    $('#burger').onclick = () => {
      nav.classList.add('open');
      const scrim = document.createElement('div');
      scrim.className = 'nav-scrim';
      scrim.onclick = () => { nav.classList.remove('open'); scrim.remove(); };
      document.body.appendChild(scrim);
    };

    // FAB
    $('#fab').onclick = () => App.toggleFab();
    $('#quickAdd').onclick = () => App.toggleFab();
    $$('[data-fab]').forEach(b => b.onclick = () => {
      App.toggleFab(false);
      App.quick(b.dataset.fab);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.fab-zone') && $('#fabMenu').classList.contains('open')) App.toggleFab(false);
    });

    // notifications
    $('#bellBtn').onclick = (e) => { e.stopPropagation(); App.toggleNotif(); };
    document.addEventListener('click', e => {
      if (!e.target.closest('#notifPop') && !e.target.closest('#bellBtn')) $('#notifPop').innerHTML = '';
    });

    // month segmented control
    $('#monthSeg').addEventListener('click', e => {
      const b = e.target.closest('button[data-m]');
      if (!b) return;
      App.month = b.dataset.m;
      App.render();
    });

    // keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea') || Modal.stack.length) return;
      const k = e.key.toLowerCase();
      if (k === 'e') { e.preventDefault(); App.quick('expense'); }
      else if (k === 'i') { e.preventDefault(); App.quick('income'); }
      else if (k === 't') { e.preventDefault(); App.quick('transfer'); }
      else if (k === 's') { e.preventDefault(); App.quick('savings'); }
      else if (k === '/') { e.preventDefault(); const s = $('[data-filter="q"]'); if (s) s.focus(); }
    });

    window.addEventListener('hashchange', () => {
      const p = location.hash.replace('#', '') || 'dashboard';
      if (p !== App.page) App.route(p);
    });
  },

  toggleFab(force) {
    const menu = $('#fabMenu'), fab = $('#fab');
    const open = force != null ? force : !menu.classList.contains('open');
    menu.classList.toggle('open', open);
    fab.classList.toggle('open', open);
  },

  quick(kind) {
    if (kind === 'income') Dlg.tx('income');
    else if (kind === 'expense') Dlg.tx('expense');
    else if (kind === 'transfer') Dlg.transfer();
    else if (kind === 'savings') Dlg.fundGoal();
  },

  toggleNotif() {
    const pop = $('#notifPop');
    if (pop.innerHTML) { pop.innerHTML = ''; return; }
    const list = Q.notifications();
    pop.innerHTML = `
      <div class="notif-pop">
        <div class="row between g8" style="padding:14px 15px;border-bottom:1px solid var(--glass-brd)">
          <div><div class="t-md w7">Notifications</div><div class="t-xs dim">${list.length} item${list.length === 1 ? '' : 's'}</div></div>
          ${list.length ? '<button class="btn btn-xs" data-clearnotif>Clear all</button>' : ''}
        </div>
        <div class="scroll-y" style="max-height:370px">
          ${list.length ? list.map(n => {
            const clr = { up: 'var(--up)', down: 'var(--down)', warn: 'var(--warn)', info: 'var(--info)' }[n.tone];
            const bg = { up: 'var(--up-dim)', down: 'var(--down-dim)', warn: 'var(--warn-dim)', info: 'var(--info-dim)' }[n.tone];
            return `<div class="notif-item" data-notif="${esc(n.id)}" data-nav="${esc(n.go || '')}" style="cursor:pointer">
              <div class="insight-ic" style="background:${bg};color:${clr};width:30px;height:30px;font-size:.85rem">${n.icon}</div>
              <div class="grow" style="min-width:0">
                <div class="t-sm w6">${esc(n.title)}</div>
                <div class="t-xs dim" style="line-height:1.5">${n.msg}</div>
              </div>
              <button class="ibtn" data-dismiss="${esc(n.id)}" style="width:22px;height:22px;font-size:.7rem" title="Dismiss">✕</button>
            </div>`;
          }).join('') : `<div class="empty" style="padding:34px 20px">
              <div class="empty-ic">🔔</div>
              <div class="empty-t">All clear</div>
              <div class="empty-s">No warnings or reminders right now.</div>
            </div>`}
        </div>
      </div>`;

    $$('[data-dismiss]', pop).forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      DB.dismiss(b.dataset.dismiss);
      App.toggleNotif(); App.toggleNotif();
      App.refreshBell();
    });
    $$('[data-notif]', pop).forEach(row => row.onclick = () => {
      const nav = row.dataset.nav;
      pop.innerHTML = '';
      if (nav) App.go(nav);
    });
    const ca = $('[data-clearnotif]', pop);
    if (ca) ca.onclick = () => {
      list.forEach(n => DB.dismiss(n.id));
      pop.innerHTML = '';
      App.refreshBell();
      Toast.info('Notifications cleared');
    };
  },

  refreshBell() {
    const n = Q.notifications().length;
    const dot = $('#bellDot');
    dot.textContent = n > 9 ? '9+' : n;
    dot.classList.toggle('hidden', n === 0);
  },

  /* -------------------------------------------------------------- routing */
  go(page) {
    if (!Pages[page]) return;
    location.hash = page;
    App.route(page);
  },

  route(page) {
    if (!Pages[page]) page = 'dashboard';
    App.page = page;
    App.render();
    $('#nav').classList.remove('open');
    $('.nav-scrim')?.remove();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  render() {
    const [title, sub] = App.meta[App.page] || ['MyCashFlow', ''];
    $('#pgTitle').textContent = title;
    $('#pgSub').textContent = sub;
    $('#userName').textContent = DB.state.settings.name || 'You';

    $$('.nav-item').forEach(b => b.classList.toggle('on', b.dataset.go === App.page));

    // month selector (relevant pages only)
    const showMonth = ['dashboard', 'analytics', 'calendar', 'budgets', 'spending', 'income', 'wallets'].includes(App.page);
    const seg = $('#monthSeg');
    seg.classList.toggle('hidden', !showMonth);
    if (showMonth) {
      const months = Q.activeMonths().slice(0, 4).reverse();
      if (!months.includes(App.month)) App.month = D.thisMonth();
      seg.innerHTML = months.map(m =>
        `<button class="${m === App.month ? 'on' : ''}" data-m="${m}">${m === D.thisMonth() ? 'This month' : D.monthName(m)}</button>`
      ).join('');
    }

    const view = $('#view');
    view.innerHTML = Pages[App.page]({ month: App.month });
    view.classList.remove('anim-in');
    void view.offsetWidth;
    view.classList.add('anim-in');

    App.wire(view);
    App.refreshBell();
  },

  /* -------------------------------------------------------------- wiring */
  wire(root) {
    App.wireTxActions(root);
    App.wireFilters(root);

    // add buttons
    $$('[data-add]', root).forEach(b => b.onclick = () => Dlg.tx(b.dataset.add));
    $('[data-quickmenu]', root)?.addEventListener('click', () => App.toggleFab(true));

    // wallets
    $$('[data-newwallet]', root).forEach(b => b.onclick = () => Dlg.wallet());
    $$('[data-transfer]', root).forEach(b => b.onclick = () => Dlg.transfer());
    $$('[data-wedit]', root).forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      Dlg.wallet(DB.walletGet(b.dataset.wedit));
    });
    $$('[data-wdel]', root).forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const w = DB.walletGet(b.dataset.wdel);
      if (DB.state.wallets.length <= 1) {
        Toast.err('Cannot delete', 'You need at least one wallet.');
        return;
      }
      const s = Q.walletStats(w.id);
      const ok = await Modal.confirm({
        title: `Delete ${w.name}?`, icon: '🗑️', danger: true, okLabel: 'Delete wallet',
        msg: `This will permanently remove the wallet <b>and its ${s.count} transaction${s.count === 1 ? '' : 's'}</b> (balance ${M.fmt(s.balance)}).<br><br>This cannot be undone.`
      });
      if (ok) { DB.walletDel(w.id); Toast.ok('Wallet deleted', esc(w.name)); App.render(); }
    });

    // budgets
    $$('[data-newbudget]', root).forEach(b => b.onclick = () => Dlg.budget());
    $$('[data-setbudget]', root).forEach(b => b.onclick = () => Dlg.budget(b.dataset.setbudget));
    $$('[data-bedit]', root).forEach(b => b.onclick = () => Dlg.budget(b.dataset.bedit));
    $$('[data-bdel]', root).forEach(b => b.onclick = async () => {
      const bud = DB.state.budgets.find(x => x.id === b.dataset.bdel);
      if (!bud) return;
      const ok = await Modal.confirm({
        title: 'Remove this budget?', icon: '🎯', danger: true, okLabel: 'Remove budget',
        msg: `The <b>${esc(Q.cat(bud.cat).name)}</b> budget limit of ${M.fmt(bud.limit)} will be removed. Your transactions are not affected.`
      });
      if (ok) { DB.budgetDel(bud.id); Toast.ok('Budget removed', esc(Q.cat(bud.cat).name)); App.render(); }
    });

    // goals
    $$('[data-newgoal]', root).forEach(b => b.onclick = () => Dlg.goal());
    $$('[data-fundany]', root).forEach(b => b.onclick = () => Dlg.fundGoal());
    $$('[data-fund]', root).forEach(b => b.onclick = () => Dlg.fundGoal(b.dataset.fund));
    $$('[data-gedit]', root).forEach(b => b.onclick = () => Dlg.goal(DB.goalGet(b.dataset.gedit)));
    $$('[data-gdel]', root).forEach(b => b.onclick = async () => {
      const g = DB.goalGet(b.dataset.gdel);
      if (!g) return;
      const ok = await Modal.confirm({
        title: `Delete "${g.name}"?`, icon: g.icon, danger: true, okLabel: 'Delete goal',
        msg: `This removes the goal and its progress record of <b>${M.fmt(g.saved)}</b>.<br><br>The money stays in your wallet — only the goal is deleted.`
      });
      if (ok) { DB.goalDel(g.id); Toast.ok('Goal deleted', esc(g.name)); App.render(); }
    });

    // recurring
    $$('[data-newrecur]', root).forEach(b => b.onclick = () => Dlg.recurring());
    $$('[data-redit]', root).forEach(b => b.onclick = () => Dlg.recurring(DB.recurGet(b.dataset.redit)));
    $$('[data-toggle]', root).forEach(b => b.onclick = () => {
      const r = DB.recurGet(b.dataset.toggle);
      DB.recurUpdate(r.id, { active: !r.active });
      Toast.info(r.active ? 'Paused' : 'Resumed', `${esc(r.label)} is now ${r.active ? 'paused' : 'active'}.`);
      App.render();
    });
    $$('[data-post]', root).forEach(b => b.onclick = () => {
      const r = DB.recurGet(b.dataset.post);
      const tx = DB.recurPost(r.id);
      Toast.ok(`${esc(r.label)} recorded`,
        `${r.type === 'income' ? '+' : '−'}${M.fmt(tx.amount)} · ${esc(Q.walletName(r.wallet))} is now <b>${M.fmt(Q.walletBalance(r.wallet))}</b>`);
      if (r.type === 'expense') Dlg.budgetAlert(r.cat);
      App.render();
    });
    $('[data-postall]', root)?.addEventListener('click', async () => {
      const due = DB.state.recurring.filter(r => r.active && r.next <= D.today());
      const ok = await Modal.confirm({
        title: `Record ${due.length} transaction${due.length > 1 ? 's' : ''}?`, icon: '🔁', okLabel: 'Add them all',
        msg: due.map(r => `${r.type === 'income' ? '🟢' : '🔴'} <b>${esc(r.label)}</b> — ${M.fmt(r.amount)}`).join('<br>')
      });
      if (!ok) return;
      due.forEach(r => DB.recurPost(r.id));
      Toast.ok(`${due.length} transaction${due.length > 1 ? 's' : ''} recorded`, 'Wallet balances and charts updated.');
      App.render();
    });
    $$('[data-rdel]', root).forEach(b => b.onclick = async () => {
      const r = DB.recurGet(b.dataset.rdel);
      const ok = await Modal.confirm({
        title: `Delete "${r.label}"?`, icon: '🔁', danger: true, okLabel: 'Delete',
        msg: `This recurring schedule will be removed. Past transactions it created stay in your history.`
      });
      if (ok) { DB.recurDel(r.id); Toast.ok('Recurring deleted', esc(r.label)); App.render(); }
    });

    // categories
    $$('[data-newcat]', root).forEach(b => b.onclick = () => Dlg.category('expense'));
    $$('[data-catdel]', root).forEach(b => b.onclick = async () => {
      const c = DB.state.customCats.find(x => x.id === b.dataset.catdel);
      if (!c) return;
      const used = DB.state.tx.filter(t => t.cat === c.id).length;
      const ok = await Modal.confirm({
        title: `Delete "${c.name}"?`, icon: c.icon, danger: true, okLabel: 'Delete category',
        msg: used ? `<b>${used} transaction${used === 1 ? '' : 's'}</b> use this category. They will keep the label but it will no longer appear in pickers.`
          : 'This custom category will be removed.'
      });
      if (ok) { DB.catDel(c.id); Toast.ok('Category deleted', esc(c.name)); App.render(); }
    });

    // calendar
    $$('[data-day]', root).forEach(b => b.onclick = () => {
      App.selectedDay = b.dataset.day;
      App.render();
    });
    $$('[data-addday]', root).forEach(b => b.onclick = () => Dlg.day(b.dataset.addday));
    $$('[data-mshift]', root).forEach(b => b.onclick = () => {
      const v = b.dataset.mshift;
      App.month = v === 'today' ? D.thisMonth() : D.shiftMk(App.month, Number(v));
      App.selectedDay = null;
      App.render();
    });

    // analytics / export
    $('[data-print]', root)?.addEventListener('click', () => window.print());
    $$('[data-export]', root).forEach(b => b.onclick = () => App.exportCsv());

    // settings
    const save = $('#saveSet', root);
    if (save) {
      save.onclick = () => {
        DB.state.settings.name = $('#setName').value.trim() || 'You';
        DB.state.settings.budgetWarnAt = Number($('#setWarn').value);
        DB.save();
        Toast.ok('Preferences saved');
        App.render();
      };
      $('#reseed', root).onclick = async () => {
        const ok = await Modal.confirm({
          title: 'Reload sample data?', icon: '🔄', danger: true, okLabel: 'Reload samples',
          msg: 'This replaces <b>all your current data</b> with the demo dataset. Anything you added will be lost.'
        });
        if (ok) { DB.reset(); Toast.ok('Sample data reloaded'); App.month = D.thisMonth(); App.render(); }
      };
      $('#wipe', root).onclick = async () => {
        const ok = await Modal.confirm({
          title: 'Delete everything?', icon: '🗑️', danger: true, okLabel: 'Delete all data',
          msg: 'Every transaction, budget, goal and recurring item will be permanently deleted. Your wallets will be reset to zero.<br><br>This cannot be undone.'
        });
        if (ok) { DB.wipe(); Toast.ok('All data deleted', 'Start fresh with the ＋ button.'); App.month = D.thisMonth(); App.render(); }
      };
      $('#exportJson', root).onclick = () => {
        App.download(`mycashflow-backup-${D.today()}.json`, JSON.stringify(DB.state, null, 2), 'application/json');
        Toast.ok('Backup downloaded', 'Keep the JSON file somewhere safe.');
      };
      $('#importJson', root).onclick = () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = () => {
          const file = inp.files[0];
          if (!file) return;
          const fr = new FileReader();
          fr.onload = async () => {
            try {
              const data = JSON.parse(fr.result);
              if (!Array.isArray(data.tx) || !Array.isArray(data.wallets)) throw new Error('bad shape');
              const ok = await Modal.confirm({
                title: 'Restore this backup?', icon: '📂', danger: true, okLabel: 'Restore',
                msg: `The file contains <b>${data.tx.length} transactions</b> and <b>${data.wallets.length} wallets</b>. This replaces your current data.`
              });
              if (!ok) return;
              DB.state = data;
              DB.load.call(null); // normalise defaults
              DB.state = Object.assign(DB.state, data);
              DB.save();
              Toast.ok('Backup restored', `${data.tx.length} transactions loaded.`);
              App.month = D.thisMonth();
              App.render();
            } catch (err) {
              Toast.err('Could not read that file', 'Make sure it is a MyCashFlow JSON backup.');
            }
          };
          fr.readAsText(file);
        };
        inp.click();
      };
    }
  },

  /** edit / delete / open on transaction rows and table rows */
  wireTxActions(root, after) {
    const done = after || (() => App.render());

    $$('[data-edit]', root).forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const t = DB.txGet(b.dataset.edit);
      if (!t) return;
      if (t.type === 'transfer') {
        Toast.info('Transfers cannot be edited', 'Delete it and create a new transfer instead.');
        return;
      }
      Dlg.tx(t.type, t);
    });

    $$('[data-del]', root).forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      await App.deleteTx(b.dataset.del, done);
    });

    // clicking the row body opens detail
    $$('[data-tx]', root).forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        Dlg.txView(row.dataset.tx);
      });
      row.style.cursor = 'pointer';
    });
  },

  async deleteTx(id, after) {
    const t = DB.txGet(id);
    if (!t) return;
    const isT = t.type === 'transfer';
    const label = isT ? `${Q.walletName(t.from)} → ${Q.walletName(t.to)}` : (t.desc || Q.cat(t.cat).name);
    const ok = await Modal.confirm({
      title: 'Delete this transaction?', icon: '🗑️', danger: true, okLabel: 'Delete',
      msg: `<b>${esc(label)}</b> — ${M.fmt(t.amount)} on ${D.pretty(t.date)}.<br><br>
        ${isT ? 'Both wallet balances will be corrected.' : `Your ${esc(Q.walletName(t.wallet))} balance will be updated.`}
        ${t.goalId ? '<br>The savings goal progress will also be rolled back.' : ''}
        <br><br>This cannot be undone.`
    });
    if (!ok) return;
    DB.txDel(id);
    Toast.ok('Transaction deleted', `${esc(label)} · ${M.fmt(t.amount)} removed.`);
    (after || (() => App.render()))();
  },

  /* -------------------------------------------------------------- filters */
  wireFilters(root) {
    const scope = (el) => el.dataset.scope;

    $$('[data-filter]', root).forEach(el => {
      const key = el.dataset.filter, sc = scope(el);
      if (!sc || !App.filters[sc]) return;
      if (el.tagName === 'INPUT' && el.type === 'text' || el.tagName === 'INPUT' && !el.type.match(/date/)) {
        let tid;
        el.addEventListener('input', () => {
          clearTimeout(tid);
          tid = setTimeout(() => {
            App.filters[sc][key] = el.value;
            App.render();
            const s = $(`[data-filter="${key}"][data-scope="${sc}"]`);
            if (s) { s.focus(); s.setSelectionRange(s.value.length, s.value.length); }
          }, 260);
        });
      } else {
        el.addEventListener('change', () => {
          App.filters[sc][key] = el.value;
          App.render();
        });
      }
    });

    $$('[data-cat][data-scope]', root).forEach(b => b.onclick = () => {
      App.filters[b.dataset.scope].cat = b.dataset.cat;
      App.render();
    });

    $$('[data-type][data-scope]', root).forEach(b => b.onclick = () => {
      App.filters[b.dataset.scope].type = b.dataset.type;
      App.render();
    });

    $$('[data-clear]', root).forEach(b => b.onclick = () => {
      const sc = b.dataset.clear;
      const keep = App.filters[sc].sort ? { sort: App.filters[sc].sort, dir: App.filters[sc].dir } : {};
      App.filters[sc] = Object.assign({
        q: '', month: 'all', cat: 'all', wallet: 'all', method: 'all', type: 'all', from: '', to: ''
      }, keep);
      App.render();
    });

    $$('[data-sort]', root).forEach(th => th.onclick = () => {
      const f = App.filters.history;
      const k = th.dataset.sort;
      if (f.sort === k) f.dir = f.dir === 'asc' ? 'desc' : 'asc';
      else { f.sort = k; f.dir = k === 'date' ? 'desc' : 'asc'; }
      App.render();
    });
  },

  /* --------------------------------------------------------------- export */
  exportCsv() {
    const rows = [['Date', 'Type', 'Category', 'Description', 'Wallet', 'From', 'To', 'Payment Method', 'Source', 'Amount (RM)', 'Notes']];
    Q.sorted().forEach(t => {
      rows.push([
        t.date,
        t.type,
        t.type === 'transfer' ? '' : Q.cat(t.cat).name,
        t.desc || '',
        t.type === 'transfer' ? '' : Q.walletName(t.wallet),
        t.type === 'transfer' ? Q.walletName(t.from) : '',
        t.type === 'transfer' ? Q.walletName(t.to) : '',
        t.method || '',
        t.source || '',
        (t.amount / 100).toFixed(2),
        (t.notes || '').replace(/\s+/g, ' ')
      ]);
    });
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\r\n');
    App.download(`mycashflow-transactions-${D.today()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
    Toast.ok('CSV exported', `${rows.length - 1} transactions downloaded.`);
  },

  download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
};

/* keep bell fresh whenever state changes */
DB.sub(() => App.refreshBell());

document.addEventListener('DOMContentLoaded', () => App.init());
