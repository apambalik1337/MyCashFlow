/* ==========================================================================
   MyCashFlow — State Store
   Money is stored as INTEGER CENTS everywhere to avoid float drift.
   Public API: DB.state, DB.save(), DB.tx*, DB.wallet*, DB.budget*, DB.goal*,
               DB.recur*, DB.cat*, selectors under Q.*
   ========================================================================== */

const KEY = 'mycashflow.v1';
const CUR = 'RM';

/* --- money helpers ------------------------------------------------------- */
const M = {
  /** parse user input (string|number in RINGGIT) -> integer cents */
  parse(v) {
    if (typeof v === 'number') return Math.round(v * 100);
    const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? Math.round(n * 100) : 0;
  },
  /** cents -> "RM 1,250.50" */
  fmt(c, opt = {}) {
    const { sign = false, cur = true, dec = 2 } = opt;
    const neg = c < 0;
    const abs = Math.abs(c) / 100;
    const s = abs.toLocaleString('en-MY', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const pre = sign ? (neg ? '−' : '+') : (neg ? '−' : '');
    return `${pre}${cur ? CUR + ' ' : ''}${s}`;
  },
  /** compact: RM 1.2k */
  short(c) {
    const neg = c < 0, a = Math.abs(c) / 100;
    const p = neg ? '−' : '';
    if (a >= 1e6) return `${p}${CUR} ${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M`;
    if (a >= 1e3) return `${p}${CUR} ${(a / 1e3).toFixed(a >= 1e4 ? 0 : 1)}k`;
    return `${p}${CUR} ${a.toFixed(0)}`;
  },
  toNum(c) { return c / 100; }
};

/* --- date helpers -------------------------------------------------------- */
const D = {
  today() { return D.iso(new Date()); },
  iso(d) {
    const dt = d instanceof Date ? d : new Date(d);
    const y = dt.getFullYear(), m = String(dt.getMonth() + 1).padStart(2, '0'), a = String(dt.getDate()).padStart(2, '0');
    return `${y}-${m}-${a}`;
  },
  /** "2026-09" month key */
  mk(iso) { return String(iso).slice(0, 7); },
  thisMonth() { return D.mk(D.today()); },
  /** shift a month key by n months */
  shiftMk(mk, n) {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  },
  /** shift an ISO date by n days */
  shiftDays(iso, n) {
    const d = D.parse(iso);
    d.setDate(d.getDate() + n);
    return D.iso(d);
  },
  shiftMonths(iso, n) {
    const d = D.parse(iso);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + n);
    // clamp to last valid day of target month
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return D.iso(d);
  },
  /** local-safe parse of YYYY-MM-DD (avoids UTC shift) */
  parse(iso) {
    const [y, m, d] = String(iso).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  },
  monthName(mk, long = false) {
    const [y, m] = mk.split('-').map(Number);
    const d = new Date(y, m - 1, 1);
    return d.toLocaleDateString('en-MY', { month: long ? 'long' : 'short', year: 'numeric' });
  },
  /** "Mon, 1 Sep 2026" */
  pretty(iso) {
    return D.parse(iso).toLocaleDateString('en-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  },
  /** "1 Sep" */
  short(iso) {
    return D.parse(iso).toLocaleDateString('en-MY', { day: 'numeric', month: 'short' });
  },
  dowName(iso) { return D.parse(iso).toLocaleDateString('en-MY', { weekday: 'long' }); },
  daysInMonth(mk) {
    const [y, m] = mk.split('-').map(Number);
    return new Date(y, m, 0).getDate();
  },
  /** 0=Sun offset of the 1st of a month */
  firstDow(mk) {
    const [y, m] = mk.split('-').map(Number);
    return new Date(y, m - 1, 1).getDay();
  },
  /** ISO dates for the last n days ending today (inclusive) */
  lastDays(n, end) {
    const out = [];
    const e = end || D.today();
    for (let i = n - 1; i >= 0; i--) out.push(D.shiftDays(e, -i));
    return out;
  },
  /** start of week (Mon) for a given iso */
  weekStart(iso) {
    const d = D.parse(iso);
    const dow = (d.getDay() + 6) % 7; // Mon=0
    return D.shiftDays(iso, -dow);
  },
  diffDays(a, b) {
    return Math.round((D.parse(b) - D.parse(a)) / 86400000);
  },
  /** human relative: Today / Tomorrow / in 3 days / 2 days ago */
  rel(iso) {
    const n = D.diffDays(D.today(), iso);
    if (n === 0) return 'Today';
    if (n === 1) return 'Tomorrow';
    if (n === -1) return 'Yesterday';
    if (n > 1) return `in ${n} days`;
    return `${Math.abs(n)} days ago`;
  }
};

const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/* --- taxonomy ------------------------------------------------------------ */
const INCOME_CATS = [
  { id: 'salary', name: 'Salary', icon: '💼', color: '#34d399' },
  { id: 'allowance', name: 'Allowance', icon: '🤲', color: '#60a5fa' },
  { id: 'scholarship', name: 'Scholarship', icon: '🎓', color: '#a78bfa' },
  { id: 'freelance', name: 'Freelance', icon: '🧑‍💻', color: '#22d3ee' },
  { id: 'business', name: 'Business', icon: '🏪', color: '#fbbf24' },
  { id: 'gift', name: 'Gift', icon: '🎀', color: '#f472b6' },
  { id: 'investment', name: 'Investment', icon: '📈', color: '#4ade80' },
  { id: 'inc_other', name: 'Other', icon: '📥', color: '#94a3b8' }
];

const EXPENSE_CATS = [
  { id: 'food', name: 'Food & Drinks', icon: '🍔', color: '#fb7185' },
  { id: 'transport', name: 'Transportation', icon: '🚗', color: '#60a5fa' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#c084fc' },
  { id: 'education', name: 'Education', icon: '📚', color: '#38bdf8' },
  { id: 'bills', name: 'Bills & Utilities', icon: '🏠', color: '#fbbf24' },
  { id: 'fun', name: 'Entertainment', icon: '🎮', color: '#f472b6' },
  { id: 'personal', name: 'Personal', icon: '❤️', color: '#fb923c' },
  { id: 'health', name: 'Health', icon: '💊', color: '#4ade80' },
  { id: 'gifts', name: 'Gifts', icon: '🎁', color: '#e879f9' },
  { id: 'subs', name: 'Subscription', icon: '📱', color: '#818cf8' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#2dd4bf' },
  { id: 'exp_other', name: 'Other', icon: '📦', color: '#94a3b8' }
];

const PAY_METHODS = ['Cash', 'Debit Card', 'Credit Card', 'Online Banking', 'E-Wallet', 'Bank Transfer'];

const WALLET_TYPES = [
  { id: 'cash', name: 'Cash', icon: '💵', tint: 'rgba(52,211,153,0.28)' },
  { id: 'bank', name: 'Bank Account', icon: '🏦', tint: 'rgba(96,165,250,0.28)' },
  { id: 'debit', name: 'Debit Card', icon: '💳', tint: 'rgba(192,132,252,0.28)' },
  { id: 'savings', name: 'Savings Account', icon: '💰', tint: 'rgba(251,191,36,0.28)' },
  { id: 'ewallet', name: 'E-Wallet', icon: '📲', tint: 'rgba(34,211,238,0.28)' }
];

/* --- seed data ----------------------------------------------------------- */
function seed() {
  const tm = D.thisMonth();
  const lm = D.shiftMk(tm, -1);
  const day = (mk, d) => `${mk}-${String(Math.min(d, D.daysInMonth(mk))).padStart(2, '0')}`;
  const todayN = new Date().getDate();
  const NOMINAL = 28; // seed lists below are written against a nominal 28-day month
  const span = Math.max(1, Math.min(todayN, NOMINAL)); // days elapsed this month
  const PAYDAY = 1;   // salary lands on the 1st, so income is never zero

  /* Pace a nominal month of activity into the days that have actually elapsed.
     Keeps a natural transactions-per-day rhythm at any point in the month and
     never produces a future date, so on the 1st you get a small but real day
     of activity rather than an empty dashboard. */
  function pace(rows, minKeep) {
    const n = Math.max(Math.min(minKeep, rows.length), Math.round(rows.length * span / NOMINAL));
    const keep = rows.slice(0, n);
    return keep.map((r, i) => {
      const d = Math.min(span, Math.max(1, Math.ceil((i + 1) / keep.length * span)));
      return [d, r];
    });
  }

  const W = {
    cash: 'w_cash', bank: 'w_bank', debit: 'w_debit', sav: 'w_sav'
  };

  const wallets = [
    { id: W.bank, name: 'Maybank Savings', type: 'bank', icon: '🏦', opening: M.parse(1850), tint: 'rgba(96,165,250,0.3)', note: 'Primary account' },
    { id: W.cash, name: 'Cash Wallet', type: 'cash', icon: '💵', opening: M.parse(180), tint: 'rgba(52,211,153,0.3)', note: 'Physical cash' },
    { id: W.debit, name: 'TnG eWallet', type: 'ewallet', icon: '📲', opening: M.parse(95), tint: 'rgba(34,211,238,0.3)', note: 'Daily spend' },
    { id: W.sav, name: 'Savings Pot', type: 'savings', icon: '💰', opening: M.parse(2400), tint: 'rgba(251,191,36,0.3)', note: 'Goals & emergency' }
  ];

  const t = [];
  const add = (o) => t.push({ id: uid('tx'), createdAt: Date.now() - t.length * 1000, notes: '', ...o });

  /* ---- last month ---- */
  add({ type: 'income', amount: M.parse(2800), cat: 'salary', wallet: W.bank, date: day(lm, 25), desc: 'Monthly salary', source: 'Tech Sdn Bhd', method: 'Bank Transfer' });
  add({ type: 'income', amount: M.parse(500), cat: 'allowance', wallet: W.bank, date: day(lm, 3), desc: 'Family allowance', source: 'Parents', method: 'Bank Transfer' });
  add({ type: 'income', amount: M.parse(620), cat: 'freelance', wallet: W.bank, date: day(lm, 14), desc: 'Logo design project', source: 'Client — Aiman', method: 'Online Banking' });

  const lmExp = [
    // Start on day 1 so month-over-month comparisons always have a baseline,
    // even when today is early in the current month.
    [1, 'food', 26.8, 'Breakfast + coffee', W.cash, 'Cash'],
    [1, 'transport', 14.5, 'Grab to work', W.debit, 'E-Wallet'],
    [2, 'food', 57.6, 'Groceries — Tesco', W.debit, 'Debit Card'],
    [2, 'subs', 19.9, 'Spotify Premium', W.bank, 'Online Banking'],
    [3, 'food', 21.4, 'Lunch', W.cash, 'Cash'],
    [4, 'food', 32.5, 'Lunch at kopitiam', W.cash, 'Cash'],
    [4, 'transport', 15, 'Grab to campus', W.debit, 'E-Wallet'],
    [5, 'food', 48.9, 'Groceries — Jaya Grocer', W.debit, 'Debit Card'],
    [6, 'fun', 55, 'Netflix subscription', W.bank, 'Online Banking'],
    [7, 'food', 24, 'Dinner takeaway', W.cash, 'Cash'],
    [8, 'shopping', 189, 'New running shoes', W.debit, 'Debit Card'],
    [9, 'transport', 60, 'Petrol top-up', W.debit, 'Debit Card'],
    [11, 'bills', 145, 'Electricity bill', W.bank, 'Online Banking'],
    [11, 'bills', 40, 'Phone bill', W.bank, 'Online Banking'],
    [12, 'food', 38.4, 'Weekend brunch', W.debit, 'E-Wallet'],
    [14, 'education', 120, 'Online course', W.bank, 'Debit Card'],
    [15, 'health', 68, 'Pharmacy — vitamins', W.cash, 'Cash'],
    [17, 'food', 52.3, 'Groceries', W.debit, 'Debit Card'],
    [18, 'fun', 42, 'Cinema + snacks', W.cash, 'Cash'],
    [19, 'transport', 18.5, 'Grab home', W.debit, 'E-Wallet'],
    [21, 'personal', 45, 'Haircut', W.cash, 'Cash'],
    [22, 'food', 29.9, 'Bubble tea run', W.debit, 'E-Wallet'],
    [23, 'shopping', 76, 'Phone case + cable', W.debit, 'Debit Card'],
    [24, 'food', 61.2, 'Groceries', W.debit, 'Debit Card'],
    [26, 'transport', 55, 'Petrol', W.debit, 'Debit Card'],
    [27, 'gifts', 85, 'Birthday gift for sister', W.bank, 'Debit Card'],
    [28, 'food', 34.5, 'Dinner with friends', W.cash, 'Cash'],
    [29, 'subs', 19.9, 'Spotify Premium', W.bank, 'Online Banking']
  ];
  lmExp.forEach(([d, c, a, ds, w, pm]) =>
    add({ type: 'expense', amount: M.parse(a), cat: c, wallet: w, date: day(lm, d), desc: ds, method: pm })
  );

  /* ---- this month ----
     Income keeps its real pay dates and only appears once that day has passed,
     so cash flow reads truthfully mid-month. Salary lands on payday (the 1st)
     so there is always a real income figure to see. */
  const inc = (dom, o) => { if (dom <= span) add({ type: 'income', date: day(tm, dom), ...o }); };
  inc(PAYDAY, { amount: M.parse(2800), cat: 'salary', wallet: W.bank, desc: 'Monthly salary', source: 'Tech Sdn Bhd', method: 'Bank Transfer' });
  inc(3, { amount: M.parse(500), cat: 'allowance', wallet: W.bank, desc: 'Family allowance', source: 'Parents', method: 'Bank Transfer' });
  inc(8, { amount: M.parse(150), cat: 'gift', wallet: W.cash, desc: 'Duit raya', source: 'Uncle', method: 'Cash' });
  inc(12, { amount: M.parse(850), cat: 'freelance', wallet: W.bank, desc: 'Website revamp', source: 'Client — Sarah', method: 'Online Banking' });

  const tmExp = [
    [2, 'food', 28.5, 'Nasi lemak + teh', W.cash, 'Cash'],
    [2, 'transport', 12, 'Grab', W.debit, 'E-Wallet'],
    [3, 'food', 65.4, 'Groceries — Village Grocer', W.debit, 'Debit Card'],
    [4, 'subs', 19.9, 'Spotify Premium', W.bank, 'Online Banking'],
    [5, 'food', 42, 'Dinner date', W.debit, 'Debit Card'],
    [6, 'fun', 55, 'Netflix subscription', W.bank, 'Online Banking'],
    [6, 'shopping', 240, 'Jacket + jeans (sale)', W.debit, 'Debit Card'],
    [7, 'transport', 62, 'Petrol top-up', W.debit, 'Debit Card'],
    [8, 'food', 31.8, 'Cafe brunch', W.cash, 'Cash'],
    [9, 'health', 95, 'Dental checkup', W.bank, 'Debit Card'],
    [10, 'bills', 152, 'Electricity bill', W.bank, 'Online Banking'],
    [10, 'bills', 40, 'Phone bill', W.bank, 'Online Banking'],
    [11, 'food', 58.2, 'Groceries', W.debit, 'Debit Card'],
    [12, 'education', 89, 'Textbook', W.bank, 'Debit Card'],
    [13, 'food', 45.6, 'Friday dinner out', W.cash, 'Cash'],
    [13, 'fun', 68, 'Concert ticket', W.debit, 'Debit Card'],
    [14, 'transport', 22.5, 'Grab x2', W.debit, 'E-Wallet'],
    [15, 'shopping', 118, 'Skincare restock', W.debit, 'Debit Card'],
    [16, 'food', 37.9, 'Groceries top-up', W.debit, 'E-Wallet'],
    [17, 'personal', 50, 'Gym day pass', W.cash, 'Cash'],
    [18, 'food', 26.4, 'Lunch', W.cash, 'Cash'],
    [19, 'travel', 180, 'Bus + hostel deposit', W.bank, 'Online Banking'],
    [20, 'food', 54.7, 'Groceries', W.debit, 'Debit Card'],
    [20, 'transport', 58, 'Petrol', W.debit, 'Debit Card'],
    [21, 'fun', 35, 'Board game night', W.cash, 'Cash'],
    [22, 'food', 41.3, 'Dinner', W.debit, 'E-Wallet'],
    [23, 'health', 42, 'Pharmacy', W.cash, 'Cash'],
    [24, 'shopping', 95, 'Desk lamp', W.debit, 'Debit Card'],
    [25, 'food', 33.6, 'Groceries', W.debit, 'Debit Card'],
    [26, 'gifts', 60, 'Farewell gift', W.cash, 'Cash'],
    [27, 'food', 47.2, 'Weekend makan', W.debit, 'E-Wallet'],
    [28, 'transport', 16, 'Grab', W.debit, 'E-Wallet']
  ];
  // Pace this month's expenses across the elapsed days (keep at least 6 so the
  // dashboard, budgets and category charts are always meaningful on day 1).
  pace(tmExp, 6).forEach(([d, [, c, a, ds, w, pm]]) =>
    add({ type: 'expense', amount: M.parse(a), cat: c, wallet: w, date: day(tm, d), desc: ds, method: pm })
  );

  /* Fund the spend wallets from the bank.
     Cash and the e-wallet are topped up from the bank in real life; without this
     they would drift negative because all their spending has no funding source.
     Sized from actual seeded spending (rounded up to RM50) and dated at the
     start of the month, so every wallet balance stays realistic and positive. */
  const topUp = (wallet, mk, dom, desc) => {
    const spent = t.reduce((s, x) =>
      s + (x.type === 'expense' && x.wallet === wallet && x.date.startsWith(mk) ? x.amount : 0), 0);
    if (spent <= 0) return;
    const amt = Math.ceil(spent / M.parse(50)) * M.parse(50); // round up to RM50
    add({ type: 'transfer', amount: amt, from: W.bank, to: wallet, date: day(mk, dom), desc });
  };
  topUp(W.cash, lm, 2, 'ATM withdrawal');
  topUp(W.debit, lm, 2, 'TnG reload');
  topUp(W.cash, tm, 1, 'ATM withdrawal');
  topUp(W.debit, tm, 1, 'TnG reload');

  // savings transfers (bank -> savings pot)
  add({ type: 'transfer', amount: M.parse(400), from: W.bank, to: W.sav, date: day(lm, 26), desc: 'Monthly savings' });
  // Save right after payday, so the savings habit shows up from day one.
  add({ type: 'transfer', amount: M.parse(450), from: W.bank, to: W.sav, date: day(tm, Math.min(PAYDAY + 1, span)), desc: 'Monthly savings' });

  const budgets = [
    { id: uid('b'), cat: 'food', limit: M.parse(600) },
    { id: uid('b'), cat: 'transport', limit: M.parse(250) },
    { id: uid('b'), cat: 'fun', limit: M.parse(180) },
    { id: uid('b'), cat: 'shopping', limit: M.parse(400) },
    { id: uid('b'), cat: 'bills', limit: M.parse(250) },
    { id: uid('b'), cat: 'health', limit: M.parse(200) }
  ];

  const goals = [
    { id: uid('g'), name: 'Buy Laptop', icon: '🎓', target: M.parse(4500), saved: M.parse(1800), due: `${D.shiftMk(tm, 5)}-15`, wallet: W.sav, note: 'MacBook Air M3' },
    { id: uid('g'), name: 'Japan Holiday', icon: '✈️', target: M.parse(8000), saved: M.parse(2150), due: `${D.shiftMk(tm, 11)}-01`, wallet: W.sav, note: 'Spring 2027' },
    { id: uid('g'), name: 'Emergency Fund', icon: '💰', target: M.parse(6000), saved: M.parse(3400), due: `${D.shiftMk(tm, 8)}-01`, wallet: W.sav, note: '3 months expenses' },
    { id: uid('g'), name: 'New Phone', icon: '📱', target: M.parse(2200), saved: M.parse(2200), due: `${D.shiftMk(tm, 1)}-20`, wallet: W.sav, note: 'Completed!' }
  ];

  const recurring = [
    { id: uid('r'), label: 'Netflix Subscription', type: 'expense', amount: M.parse(55), cat: 'fun', wallet: W.bank, freq: 'monthly', dayOfMonth: 6, next: nextFrom(tm, 6), method: 'Online Banking', active: true, autopost: false },
    { id: uid('r'), label: 'Spotify Premium', type: 'expense', amount: M.parse(19.9), cat: 'subs', wallet: W.bank, freq: 'monthly', dayOfMonth: 4, next: nextFrom(tm, 4), method: 'Online Banking', active: true, autopost: false },
    { id: uid('r'), label: 'Phone Bill', type: 'expense', amount: M.parse(40), cat: 'bills', wallet: W.bank, freq: 'monthly', dayOfMonth: 10, next: nextFrom(tm, 10), method: 'Online Banking', active: true, autopost: false },
    { id: uid('r'), label: 'Electricity Bill', type: 'expense', amount: M.parse(150), cat: 'bills', wallet: W.bank, freq: 'monthly', dayOfMonth: 10, next: nextFrom(tm, 10), method: 'Online Banking', active: true, autopost: false },
    { id: uid('r'), label: 'Monthly Salary', type: 'income', amount: M.parse(2800), cat: 'salary', wallet: W.bank, freq: 'monthly', dayOfMonth: 25, next: nextFrom(tm, 25), source: 'Tech Sdn Bhd', method: 'Bank Transfer', active: true, autopost: false },
    { id: uid('r'), label: 'Family Allowance', type: 'income', amount: M.parse(500), cat: 'allowance', wallet: W.bank, freq: 'monthly', dayOfMonth: 3, next: nextFrom(tm, 3), source: 'Parents', method: 'Bank Transfer', active: true, autopost: false },
    { id: uid('r'), label: 'Gym Membership', type: 'expense', amount: M.parse(89), cat: 'personal', wallet: W.bank, freq: 'monthly', dayOfMonth: 15, next: nextFrom(tm, 15), method: 'Debit Card', active: false, autopost: false }
  ];

  return {
    v: 1,
    tx: t,
    wallets,
    budgets,
    goals,
    recurring,
    customCats: [],
    dismissed: [],
    settings: { name: 'Alex', autopostRecurring: true, budgetWarnAt: 80 },
    createdAt: Date.now()
  };
}

/** next occurrence date for a monthly recurring given day-of-month */
function nextFrom(mk, dom) {
  const todayIso = D.today();
  let cand = `${mk}-${String(Math.min(dom, D.daysInMonth(mk))).padStart(2, '0')}`;
  if (cand < todayIso) {
    const nm = D.shiftMk(mk, 1);
    cand = `${nm}-${String(Math.min(dom, D.daysInMonth(nm))).padStart(2, '0')}`;
  }
  return cand;
}

/* --- store --------------------------------------------------------------- */
const DB = {
  state: null,
  _subs: [],

  load() {
    let s = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) s = JSON.parse(raw);
    } catch (e) { console.warn('Load failed, reseeding.', e); }
    if (!s || !Array.isArray(s.tx) || !Array.isArray(s.wallets) || !s.wallets.length) s = seed();
    // forward-compat defaults
    s.customCats = s.customCats || [];
    s.dismissed = s.dismissed || [];
    s.settings = Object.assign({ name: 'Alex', autopostRecurring: true, budgetWarnAt: 80 }, s.settings || {});
    s.budgets = s.budgets || [];
    s.goals = s.goals || [];
    s.recurring = s.recurring || [];
    DB.state = s;
    return s;
  },

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(DB.state));
    } catch (e) {
      console.warn('Save failed (storage full or blocked).', e);
    }
    DB._subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  },

  sub(fn) { DB._subs.push(fn); },

  reset() {
    DB.state = seed();
    DB.save();
  },

  wipe() {
    DB.state = {
      v: 1, tx: [], wallets: seed().wallets.map(w => ({ ...w, opening: 0 })),
      budgets: [], goals: [], recurring: [], customCats: [], dismissed: [],
      settings: { name: 'Alex', autopostRecurring: true, budgetWarnAt: 80 },
      createdAt: Date.now()
    };
    DB.save();
  },

  /* ---- transactions ---- */
  txAdd(o) {
    const rec = {
      id: uid('tx'),
      createdAt: Date.now(),
      notes: '',
      ...o
    };
    DB.state.tx.push(rec);
    DB.save();
    return rec;
  },

  txUpdate(id, patch) {
    const i = DB.state.tx.findIndex(t => t.id === id);
    if (i < 0) return null;
    DB.state.tx[i] = { ...DB.state.tx[i], ...patch, id };
    DB.save();
    return DB.state.tx[i];
  },

  txDel(id) {
    const t = DB.state.tx.find(x => x.id === id);
    DB.state.tx = DB.state.tx.filter(x => x.id !== id);
    // if it funded a goal, roll the goal back
    if (t && t.goalId) {
      const g = DB.state.goals.find(g => g.id === t.goalId);
      if (g) g.saved = Math.max(0, g.saved - t.amount);
    }
    DB.save();
    return t;
  },

  txGet(id) { return DB.state.tx.find(t => t.id === id) || null; },

  /* ---- wallets ---- */
  walletAdd(o) {
    const w = { id: uid('w'), opening: 0, tint: 'rgba(124,108,255,0.3)', note: '', ...o };
    DB.state.wallets.push(w);
    DB.save();
    return w;
  },
  walletUpdate(id, patch) {
    const i = DB.state.wallets.findIndex(w => w.id === id);
    if (i < 0) return null;
    DB.state.wallets[i] = { ...DB.state.wallets[i], ...patch, id };
    DB.save();
    return DB.state.wallets[i];
  },
  walletDel(id) {
    DB.state.wallets = DB.state.wallets.filter(w => w.id !== id);
    DB.state.tx = DB.state.tx.filter(t => t.wallet !== id && t.from !== id && t.to !== id);
    DB.state.goals.forEach(g => { if (g.wallet === id) g.wallet = (DB.state.wallets[0] || {}).id; });
    DB.state.recurring = DB.state.recurring.filter(r => r.wallet !== id);
    DB.save();
  },
  walletGet(id) { return DB.state.wallets.find(w => w.id === id) || null; },

  /* ---- budgets ---- */
  budgetSet(cat, limitCents) {
    const ex = DB.state.budgets.find(b => b.cat === cat);
    if (ex) ex.limit = limitCents;
    else DB.state.budgets.push({ id: uid('b'), cat, limit: limitCents });
    DB.save();
  },
  budgetDel(id) {
    DB.state.budgets = DB.state.budgets.filter(b => b.id !== id);
    DB.save();
  },

  /* ---- goals ---- */
  goalAdd(o) {
    const g = { id: uid('g'), saved: 0, icon: '🎯', note: '', ...o };
    DB.state.goals.push(g);
    DB.save();
    return g;
  },
  goalUpdate(id, patch) {
    const i = DB.state.goals.findIndex(g => g.id === id);
    if (i < 0) return null;
    DB.state.goals[i] = { ...DB.state.goals[i], ...patch, id };
    DB.save();
    return DB.state.goals[i];
  },
  goalDel(id) {
    DB.state.goals = DB.state.goals.filter(g => g.id !== id);
    DB.save();
  },
  goalGet(id) { return DB.state.goals.find(g => g.id === id) || null; },

  /** move money into a goal: transfer wallet -> goal wallet + bump saved */
  goalFund(goalId, amountCents, fromWallet, date) {
    const g = DB.goalGet(goalId);
    if (!g) return null;
    const dest = g.wallet || fromWallet;
    if (fromWallet && dest && fromWallet !== dest) {
      DB.state.tx.push({
        id: uid('tx'), type: 'transfer', amount: amountCents,
        from: fromWallet, to: dest, date: date || D.today(),
        desc: `Savings → ${g.name}`, goalId, createdAt: Date.now(), notes: ''
      });
    }
    g.saved += amountCents;
    DB.save();
    return g;
  },

  /* ---- recurring ---- */
  recurAdd(o) {
    const r = { id: uid('r'), active: true, freq: 'monthly', autopost: false, ...o };
    if (!r.next) r.next = nextFrom(D.thisMonth(), r.dayOfMonth || D.parse(D.today()).getDate());
    DB.state.recurring.push(r);
    DB.save();
    return r;
  },
  recurUpdate(id, patch) {
    const i = DB.state.recurring.findIndex(r => r.id === id);
    if (i < 0) return null;
    DB.state.recurring[i] = { ...DB.state.recurring[i], ...patch, id };
    DB.save();
    return DB.state.recurring[i];
  },
  recurDel(id) {
    DB.state.recurring = DB.state.recurring.filter(r => r.id !== id);
    DB.save();
  },
  recurGet(id) { return DB.state.recurring.find(r => r.id === id) || null; },

  /** post a recurring item as a real transaction and advance its next date */
  recurPost(id, dateOverride) {
    const r = DB.recurGet(id);
    if (!r) return null;
    const date = dateOverride || r.next;
    const tx = {
      id: uid('tx'), type: r.type, amount: r.amount, cat: r.cat,
      wallet: r.wallet, date, desc: r.label, method: r.method || '',
      source: r.source || '', recurId: r.id, createdAt: Date.now(), notes: 'Auto-posted from recurring'
    };
    DB.state.tx.push(tx);
    r.next = advance(r.next, r.freq);
    r.lastPosted = date;
    DB.save();
    return tx;
  },

  /** auto-post every active+autopost recurring item whose date has arrived */
  runDueRecurring() {
    const today = D.today();
    const posted = [];
    DB.state.recurring.filter(r => r.active && r.autopost).forEach(r => {
      let guard = 0;
      while (r.next <= today && guard++ < 36) {
        const date = r.next;
        DB.state.tx.push({
          id: uid('tx'), type: r.type, amount: r.amount, cat: r.cat,
          wallet: r.wallet, date, desc: r.label, method: r.method || '',
          source: r.source || '', recurId: r.id, createdAt: Date.now(),
          notes: 'Auto-posted from recurring'
        });
        posted.push({ label: r.label, amount: r.amount, type: r.type, date });
        r.next = advance(r.next, r.freq);
        r.lastPosted = date;
      }
    });
    if (posted.length) DB.save();
    return posted;
  },

  /* ---- categories ---- */
  catAdd(o) {
    const c = { id: uid('c'), custom: true, color: '#94a3b8', icon: '🏷️', kind: 'expense', ...o };
    DB.state.customCats.push(c);
    DB.save();
    return c;
  },
  catDel(id) {
    DB.state.customCats = DB.state.customCats.filter(c => c.id !== id);
    DB.save();
  },

  dismiss(key) {
    if (!DB.state.dismissed.includes(key)) DB.state.dismissed.push(key);
    DB.save();
  }
};

function advance(iso, freq) {
  switch (freq) {
    case 'daily': return D.shiftDays(iso, 1);
    case 'weekly': return D.shiftDays(iso, 7);
    case 'biweekly': return D.shiftDays(iso, 14);
    case 'quarterly': return D.shiftMonths(iso, 3);
    case 'yearly': return D.shiftMonths(iso, 12);
    default: return D.shiftMonths(iso, 1);
  }
}

/* ==========================================================================
   Q — selectors / derived data
   ========================================================================== */
const Q = {
  /* ---- categories ---- */
  incomeCats() {
    return [...INCOME_CATS, ...DB.state.customCats.filter(c => c.kind === 'income')];
  },
  expenseCats() {
    return [...EXPENSE_CATS, ...DB.state.customCats.filter(c => c.kind === 'expense')];
  },
  allCats() { return [...Q.incomeCats(), ...Q.expenseCats()]; },
  cat(id) {
    return Q.allCats().find(c => c.id === id) ||
      { id, name: id || 'Uncategorised', icon: '❓', color: '#94a3b8' };
  },
  catsFor(type) { return type === 'income' ? Q.incomeCats() : Q.expenseCats(); },

  /* ---- wallets ---- */
  walletName(id) {
    const w = DB.walletGet(id);
    return w ? w.name : '—';
  },
  walletIcon(id) {
    const w = DB.walletGet(id);
    return w ? w.icon : '👝';
  },
  /** current balance of a wallet in cents */
  walletBalance(id) {
    const w = DB.walletGet(id);
    if (!w) return 0;
    let b = w.opening || 0;
    for (const t of DB.state.tx) {
      if (t.type === 'income' && t.wallet === id) b += t.amount;
      else if (t.type === 'expense' && t.wallet === id) b -= t.amount;
      else if (t.type === 'transfer') {
        if (t.from === id) b -= t.amount;
        if (t.to === id) b += t.amount;
      }
    }
    return b;
  },
  walletStats(id) {
    let inc = 0, exp = 0, tin = 0, tout = 0, n = 0;
    for (const t of DB.state.tx) {
      if (t.type === 'income' && t.wallet === id) { inc += t.amount; n++; }
      else if (t.type === 'expense' && t.wallet === id) { exp += t.amount; n++; }
      else if (t.type === 'transfer') {
        if (t.to === id) { tin += t.amount; n++; }
        if (t.from === id) { tout += t.amount; n++; }
      }
    }
    return { income: inc, expense: exp, transferIn: tin, transferOut: tout, count: n, balance: Q.walletBalance(id) };
  },
  totalBalance() {
    return DB.state.wallets.reduce((s, w) => s + Q.walletBalance(w.id), 0);
  },
  /** money not locked into savings-type wallets */
  availableMoney() {
    return DB.state.wallets
      .filter(w => w.type !== 'savings')
      .reduce((s, w) => s + Q.walletBalance(w.id), 0);
  },
  totalSavings() {
    const inWallets = DB.state.wallets
      .filter(w => w.type === 'savings')
      .reduce((s, w) => s + Q.walletBalance(w.id), 0);
    return inWallets;
  },
  goalsSaved() {
    return DB.state.goals.reduce((s, g) => s + (g.saved || 0), 0);
  },

  /* ---- transaction queries ---- */
  all() { return DB.state.tx; },
  sorted(list) {
    return [...(list || DB.state.tx)].sort((a, b) =>
      b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0)
    );
  },
  inMonth(mk, type) {
    return DB.state.tx.filter(t => D.mk(t.date) === mk && (!type || t.type === type));
  },
  onDate(iso) {
    return DB.state.tx.filter(t => t.date === iso);
  },
  sum(list, type) {
    return list.reduce((s, t) => (!type || t.type === type) ? s + t.amount : s, 0);
  },
  income(mk) { return Q.sum(Q.inMonth(mk, 'income')); },
  expense(mk) { return Q.sum(Q.inMonth(mk, 'expense')); },
  cashflow(mk) { return Q.income(mk) - Q.expense(mk); },

  spentToday() {
    return Q.sum(DB.state.tx.filter(t => t.type === 'expense' && t.date === D.today()));
  },
  spentThisWeek() {
    const start = D.weekStart(D.today());
    const end = D.today();
    return Q.sum(DB.state.tx.filter(t => t.type === 'expense' && t.date >= start && t.date <= end));
  },
  spentThisMonth() { return Q.expense(D.thisMonth()); },

  /** [{cat, name, icon, color, total, pct}] desc by total */
  /** @param maxDay optional day-of-month cap, for like-for-like month comparisons */
  byCategory(mk, type = 'expense', maxDay = null) {
    let list = mk ? Q.inMonth(mk, type) : DB.state.tx.filter(t => t.type === type);
    if (maxDay != null) list = list.filter(t => parseInt(t.date.slice(8, 10), 10) <= maxDay);
    const map = new Map();
    list.forEach(t => map.set(t.cat, (map.get(t.cat) || 0) + t.amount));
    const total = [...map.values()].reduce((a, b) => a + b, 0);
    return [...map.entries()]
      .map(([cat, val]) => {
        const c = Q.cat(cat);
        return { cat, name: c.name, icon: c.icon, color: c.color, total: val, pct: total ? val / total * 100 : 0 };
      })
      .sort((a, b) => b.total - a.total);
  },

  topCategory(mk) {
    return Q.byCategory(mk, 'expense')[0] || null;
  },

  /** monthly series for the last n months: [{mk, label, income, expense, net}] */
  monthSeries(n = 6, endMk) {
    const end = endMk || D.thisMonth();
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const mk = D.shiftMk(end, -i);
      const inc = Q.income(mk), ex = Q.expense(mk);
      out.push({ mk, label: D.monthName(mk).split(' ')[0], income: inc, expense: ex, net: inc - ex });
    }
    return out;
  },

  /** daily expense series for a month: [{date, day, total, income}] */
  dailySeries(mk) {
    const days = D.daysInMonth(mk);
    const arr = [];
    for (let d = 1; d <= days; d++) {
      const iso = `${mk}-${String(d).padStart(2, '0')}`;
      const list = Q.onDate(iso);
      arr.push({
        date: iso, day: d,
        total: Q.sum(list, 'expense'),
        income: Q.sum(list, 'income')
      });
    }
    return arr;
  },

  /** running balance across a month: [{date, balance}] */
  balanceSeries(mk) {
    // start from balance before the month begins
    const first = `${mk}-01`;
    let bal = DB.state.wallets.reduce((s, w) => s + (w.opening || 0), 0);
    DB.state.tx.filter(t => t.date < first).forEach(t => {
      if (t.type === 'income') bal += t.amount;
      else if (t.type === 'expense') bal -= t.amount;
    });
    const days = D.daysInMonth(mk);
    const out = [];
    for (let d = 1; d <= days; d++) {
      const iso = `${mk}-${String(d).padStart(2, '0')}`;
      Q.onDate(iso).forEach(t => {
        if (t.type === 'income') bal += t.amount;
        else if (t.type === 'expense') bal -= t.amount;
      });
      out.push({ date: iso, day: d, balance: bal });
    }
    return out;
  },

  /** spend grouped by day-of-week name, for "highest spending day" */
  byDow(mk) {
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const tot = new Array(7).fill(0);
    Q.inMonth(mk, 'expense').forEach(t => { tot[D.parse(t.date).getDay()] += t.amount; });
    return names.map((n, i) => ({ name: n, short: n.slice(0, 3), total: tot[i] }));
  },

  byPaymentMethod(mk) {
    const map = new Map();
    Q.inMonth(mk, 'expense').forEach(t => {
      const k = t.method || 'Unspecified';
      map.set(k, (map.get(k) || 0) + t.amount);
    });
    return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  },

  /* ---- budgets ---- */
  /** [{...budget, name, icon, color, spent, remaining, pct, status}] */
  budgetProgress(mk) {
    const m = mk || D.thisMonth();
    return DB.state.budgets.map(b => {
      const spent = Q.sum(Q.inMonth(m, 'expense').filter(t => t.cat === b.cat));
      const pct = b.limit > 0 ? spent / b.limit * 100 : 0;
      const c = Q.cat(b.cat);
      return {
        ...b, name: c.name, icon: c.icon, color: c.color,
        spent, remaining: b.limit - spent, pct,
        status: pct >= 100 ? 'over' : pct >= (DB.state.settings.budgetWarnAt || 80) ? 'warn' : 'ok'
      };
    }).sort((a, b) => b.pct - a.pct);
  },
  budgetTotals(mk) {
    const p = Q.budgetProgress(mk);
    const limit = p.reduce((s, b) => s + b.limit, 0);
    const spent = p.reduce((s, b) => s + b.spent, 0);
    return { limit, spent, remaining: limit - spent, pct: limit ? spent / limit * 100 : 0, count: p.length };
  },
  unbudgetedCats() {
    const used = new Set(DB.state.budgets.map(b => b.cat));
    return Q.expenseCats().filter(c => !used.has(c.id));
  },

  /* ---- goals ---- */
  goalProgress() {
    return DB.state.goals.map(g => {
      const pct = g.target > 0 ? Math.min(100, g.saved / g.target * 100) : 0;
      const left = Math.max(0, g.target - g.saved);
      const days = g.due ? D.diffDays(D.today(), g.due) : null;
      const perMonth = (days && days > 0 && left > 0) ? Math.ceil(left / Math.max(1, days / 30)) : 0;
      return { ...g, pct, left, days, perMonth, done: g.saved >= g.target && g.target > 0 };
    });
  },

  /* ---- recurring ---- */
  /** upcoming n days */
  upcomingRecurring(days = 30) {
    const end = D.shiftDays(D.today(), days);
    return DB.state.recurring
      .filter(r => r.active && r.next <= end)
      .sort((a, b) => a.next.localeCompare(b.next));
  },
  recurringMonthlyTotal(type) {
    const perMonth = { daily: 30, weekly: 4.345, biweekly: 2.17, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
    return DB.state.recurring
      .filter(r => r.active && r.type === type)
      .reduce((s, r) => s + Math.round(r.amount * (perMonth[r.freq] ?? 1)), 0);
  },

  /* ---- comparisons / insights ---- */
  /** sum of a type within a month, counting only days 1..dayN */
  throughDay(mk, type, dayN) {
    return Q.sum(Q.inMonth(mk, type).filter(t => {
      const d = parseInt(t.date.slice(8, 10), 10);
      return d <= dayN;
    }));
  },

  /** Month-over-month change. For the in-progress month this compares
      like-for-like — the same elapsed days of the previous month — so an early
      month is never reported as a huge drop against a full one. */
  momCompare(mk, type) {
    const m = mk || D.thisMonth();
    const prev = D.shiftMk(m, -1);
    const partial = m === D.thisMonth();
    const dayN = partial ? new Date().getDate() : D.daysInMonth(m);
    const cur = partial ? Q.throughDay(m, type, dayN) : Q.sum(Q.inMonth(m, type));
    const pre = partial ? Q.throughDay(prev, type, dayN) : Q.sum(Q.inMonth(prev, type));
    return {
      cur, prev: pre, diff: cur - pre, partial, dayN,
      prevFull: Q.sum(Q.inMonth(prev, type)),
      pct: pre > 0 ? (cur - pre) / pre * 100 : (cur > 0 ? 100 : 0)
    };
  },
  momChange(mk) { return Q.momCompare(mk, 'expense'); },
  incomeMomChange(mk) { return Q.momCompare(mk, 'income'); },
  savingsRate(mk) {
    const m = mk || D.thisMonth();
    const inc = Q.income(m);
    if (!inc) return 0;
    return (inc - Q.expense(m)) / inc * 100;
  },
  avgDailySpend(mk) {
    const m = mk || D.thisMonth();
    const isThis = m === D.thisMonth();
    const days = isThis ? new Date().getDate() : D.daysInMonth(m);
    return days ? Math.round(Q.expense(m) / days) : 0;
  },
  /** projected month-end spend based on current pace */
  projectedSpend(mk) {
    const m = mk || D.thisMonth();
    if (m !== D.thisMonth()) return Q.expense(m);
    const dim = D.daysInMonth(m);
    return Q.avgDailySpend(m) * dim;
  },
  biggestExpense(mk) {
    return Q.inMonth(mk || D.thisMonth(), 'expense').sort((a, b) => b.amount - a.amount)[0] || null;
  },
  transferredToSavings(mk) {
    const m = mk || D.thisMonth();
    const savIds = new Set(DB.state.wallets.filter(w => w.type === 'savings').map(w => w.id));
    return DB.state.tx
      .filter(t => t.type === 'transfer' && D.mk(t.date) === m && savIds.has(t.to))
      .reduce((s, t) => s + t.amount, 0);
  },

  /** months that actually have data, newest first */
  activeMonths() {
    const set = new Set(DB.state.tx.map(t => D.mk(t.date)));
    set.add(D.thisMonth());
    return [...set].sort().reverse();
  },

  /* ---- insights engine ---- */
  insights(mk) {
    const m = mk || D.thisMonth();
    const out = [];
    const top = Q.topCategory(m);
    const mom = Q.momChange(m);
    const inc = Q.income(m), exp = Q.expense(m);
    const flow = inc - exp;

    if (top) {
      out.push({
        icon: top.icon, tone: 'info',
        text: `You spent the most on <b>${top.name}</b> this month — ${M.fmt(top.total)} (${top.pct.toFixed(0)}% of spending).`
      });
    }
    /* Month-over-month spending. Very early in a month a same-days percentage
       swings wildly on a single purchase, so compare daily pace against last
       month's full average instead — same insight, far less noise. */
    if (mom.partial && mom.dayN < 5 && mom.prevFull > 0) {
      const prevDays = D.daysInMonth(D.shiftMk(m, -1));
      const prevRate = mom.prevFull / prevDays;
      const curRate = mom.cur / mom.dayN;
      const pct = prevRate > 0 ? (curRate - prevRate) / prevRate * 100 : 0;
      const up = curRate > prevRate;
      out.push({
        icon: up ? '📈' : '📉', tone: up ? 'down' : 'up',
        text: `You're spending <b>${M.fmt(Math.round(curRate))}/day</b> so far — ${Math.abs(pct).toFixed(0)}% ${up ? 'above' : 'below'} last month's average of ${M.fmt(Math.round(prevRate))}/day.`
      });
    } else if (mom.prev > 0) {
      const up = mom.diff > 0;
      out.push({
        icon: up ? '📈' : '📉', tone: up ? 'down' : 'up',
        text: `Your spending ${up ? 'increased' : 'decreased'} by <b>${Math.abs(mom.pct).toFixed(0)}%</b> compared to last month (${M.fmt(mom.cur)} vs ${M.fmt(mom.prev)}${mom.partial ? `, first ${mom.dayN} day${mom.dayN === 1 ? '' : 's'} of each month` : ''}).`
      });
    }
    if (flow > 0) {
      out.push({
        icon: '💰', tone: 'up',
        text: `Great — you saved <b>${M.fmt(flow)}</b> this month. That's a ${Q.savingsRate(m).toFixed(0)}% savings rate.`
      });
    } else if (exp > 0) {
      out.push({
        icon: '⚠️', tone: 'down',
        text: `You overspent by <b>${M.fmt(Math.abs(flow))}</b> this month. Expenses exceeded income.`
      });
    }
    const dow = Q.byDow(m).slice().sort((a, b) => b.total - a.total)[0];
    if (dow && dow.total > 0) {
      out.push({ icon: '📅', tone: 'info', text: `Your highest spending day was <b>${dow.name}</b> — ${M.fmt(dow.total)} in total.` });
    }
    const big = Q.biggestExpense(m);
    if (big) {
      out.push({ icon: '🔍', tone: 'info', text: `Largest single expense: <b>${big.desc || Q.cat(big.cat).name}</b> at ${M.fmt(big.amount)}.` });
    }
    const avg = Q.avgDailySpend(m);
    if (avg > 0) {
      // A projection from only a day or two is not yet meaningful, so state the
      // daily average alone until there is enough of the month to extrapolate.
      const elapsed = m === D.thisMonth() ? new Date().getDate() : D.daysInMonth(m);
      out.push({
        icon: '🧮', tone: 'info',
        text: elapsed >= 5
          ? `You're averaging <b>${M.fmt(avg)}/day</b>. At this pace you'll spend about ${M.fmt(Q.projectedSpend(m))} by month end.`
          : `You're averaging <b>${M.fmt(avg)}/day</b> so far this month.`
      });
    }
    const over = Q.budgetProgress(m).filter(b => b.status !== 'ok');
    if (over.length) {
      const w = over[0];
      out.push({
        icon: w.status === 'over' ? '🚨' : '⚠️', tone: 'down',
        text: `${w.icon} <b>${w.name}</b> budget is at <b>${w.pct.toFixed(0)}%</b> — ${w.remaining >= 0 ? `${M.fmt(w.remaining)} left` : `${M.fmt(Math.abs(w.remaining))} over`}.`
      });
    }
    const sav = Q.transferredToSavings(m);
    if (sav > 0) out.push({ icon: '🏦', tone: 'up', text: `You moved <b>${M.fmt(sav)}</b> into savings this month. Keep it up.` });

    const nearDone = Q.goalProgress().filter(g => !g.done && g.pct >= 60).sort((a, b) => b.pct - a.pct)[0];
    if (nearDone) {
      out.push({ icon: nearDone.icon, tone: 'up', text: `<b>${nearDone.name}</b> is ${nearDone.pct.toFixed(0)}% funded — only ${M.fmt(nearDone.left)} to go.` });
    }
    return out;
  },

  /* ---- notifications ---- */
  notifications() {
    const out = [];
    const m = D.thisMonth();
    const warnAt = DB.state.settings.budgetWarnAt || 80;

    Q.budgetProgress(m).forEach(b => {
      if (b.pct >= 100) {
        out.push({
          id: `bud-over-${b.cat}-${m}`, tone: 'down', icon: '🚨',
          title: `${b.name} budget exceeded`,
          msg: `You've spent ${M.fmt(b.spent)} of your ${M.fmt(b.limit)} budget — ${M.fmt(Math.abs(b.remaining))} over.`,
          go: 'budgets'
        });
      } else if (b.pct >= warnAt) {
        out.push({
          id: `bud-warn-${b.cat}-${m}`, tone: 'warn', icon: '⚠️',
          title: `Close to ${b.name} limit`,
          msg: `You have used ${b.pct.toFixed(0)}% of your ${b.name} budget. ${M.fmt(b.remaining)} remaining.`,
          go: 'budgets'
        });
      }
    });

    Q.upcomingRecurring(5).forEach(r => {
      out.push({
        id: `rec-${r.id}-${r.next}`,
        tone: r.type === 'income' ? 'up' : 'info',
        icon: r.type === 'income' ? '💵' : '📅',
        title: `${r.label} ${D.rel(r.next).toLowerCase() === 'today' ? 'is due today' : D.rel(r.next) === 'Tomorrow' ? 'due tomorrow' : `due ${D.rel(r.next)}`}`,
        msg: `${M.fmt(r.amount)} · ${Q.walletName(r.wallet)}${r.autopost ? ' · auto-post on' : ''}`,
        go: 'recurring'
      });
    });

    const flow = Q.cashflow(m);
    if (flow > 0) {
      out.push({
        id: `flow-pos-${m}`, tone: 'up', icon: '💰',
        title: `You saved ${M.fmt(flow)} this month`,
        msg: `Income ${M.fmt(Q.income(m))} vs expenses ${M.fmt(Q.expense(m))}. Nice cash flow.`,
        go: 'analytics'
      });
    } else if (Q.expense(m) > 0) {
      out.push({
        id: `flow-neg-${m}`, tone: 'down', icon: '📉',
        title: 'Negative cash flow this month',
        msg: `You're spending ${M.fmt(Math.abs(flow))} more than you earn.`,
        go: 'analytics'
      });
    }

    const mom = Q.momChange(m);
    if (mom.prev > 0 && mom.pct > 12) {
      out.push({
        id: `mom-${m}`, tone: 'warn', icon: '📈',
        title: 'Spending is higher than last month',
        msg: `Up ${mom.pct.toFixed(0)}% vs last month (${M.fmt(mom.cur)} vs ${M.fmt(mom.prev)}).`,
        go: 'analytics'
      });
    }

    Q.goalProgress().filter(g => g.done).forEach(g => {
      out.push({
        id: `goal-done-${g.id}`, tone: 'up', icon: '🎉',
        title: `Goal reached: ${g.name}`,
        msg: `You've saved the full ${M.fmt(g.target)}. Time to claim it.`,
        go: 'goals'
      });
    });

    DB.state.wallets.forEach(w => {
      const b = Q.walletBalance(w.id);
      if (b < 0) {
        out.push({
          id: `neg-${w.id}`, tone: 'down', icon: '🔴',
          title: `${w.name} is overdrawn`,
          msg: `Balance is ${M.fmt(b)}. Transfer money in to cover it.`,
          go: 'wallets'
        });
      }
    });

    return out.filter(n => !DB.state.dismissed.includes(n.id));
  },

  /** search + filter engine used by history/income/expense pages */
  filter({ type, q, cat, wallet, month, from, to, method, minAmt, maxAmt } = {}) {
    const ql = (q || '').trim().toLowerCase();
    return DB.state.tx.filter(t => {
      if (type && type !== 'all' && t.type !== type) return false;
      if (cat && cat !== 'all' && t.cat !== cat) return false;
      if (wallet && wallet !== 'all' && t.wallet !== wallet && t.from !== wallet && t.to !== wallet) return false;
      if (month && month !== 'all' && D.mk(t.date) !== month) return false;
      if (from && t.date < from) return false;
      if (to && t.date > to) return false;
      if (method && method !== 'all' && (t.method || '') !== method) return false;
      if (minAmt != null && t.amount < minAmt) return false;
      if (maxAmt != null && t.amount > maxAmt) return false;
      if (ql) {
        const hay = [
          t.desc, t.notes, t.source, t.method,
          Q.cat(t.cat).name,
          Q.walletName(t.wallet), Q.walletName(t.from), Q.walletName(t.to),
          M.fmt(t.amount, { cur: false })
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }
};

/* --- boot ---------------------------------------------------------------- */
DB.load();
