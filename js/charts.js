/* ==========================================================================
   MyCashFlow — dependency-free SVG charts
   All builders return an SVG string. Tooltips wired via data-tip attributes.
   ========================================================================== */

const C = {
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  },

  /** nice rounded max for an axis */
  niceMax(v) {
    if (v <= 0) return 100;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 5 ? 5 : n <= 7.5 ? 7.5 : 10;
    return step * mag;
  },

  /* ---------------------------------------------------------------- SPARK */
  /** tiny area sparkline; values = numbers */
  spark(values, opt = {}) {
    const { w = 200, h = 34, color = '#7c6cff', fill = true, id = 'sp' + Math.random().toString(36).slice(2, 7) } = opt;
    if (!values || values.length < 2) return `<svg viewBox="0 0 ${w} ${h}"></svg>`;
    const max = Math.max(...values), min = Math.min(...values);
    const span = (max - min) || 1;
    const pad = 3;
    const pts = values.map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return [x, y];
    });
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const area = `${line} L${w},${h} L0,${h} Z`;
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="height:${h}px;width:100%">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".42"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${fill ? `<path d="${area}" fill="url(#${id})"/>` : ''}
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
    </svg>`;
  },

  /* -------------------------------------------------------- GROUPED BARS */
  /**
   * Income vs Expense grouped bars.
   * data: [{label, income, expense}]  values in cents
   */
  groupBars(data, opt = {}) {
    const { h = 250, fmt = v => v, series = [{ key: 'income', color: '#34d399', name: 'Income' }, { key: 'expense', color: '#fb7185', name: 'Expenses' }] } = opt;
    if (!data.length) return C.emptySvg(h);
    const w = 700, padL = 52, padR = 12, padT = 14, padB = 30;
    const iw = w - padL - padR, ih = h - padT - padB;
    const peak = Math.max(...data.flatMap(d => series.map(s => d[s.key] || 0)), 1);
    const max = C.niceMax(peak / 100) * 100;
    const y = v => padT + ih - (v / max) * ih;

    const groupW = iw / data.length;
    const barW = Math.min(22, (groupW * 0.62) / series.length);
    const gap = 4;

    let g = '';
    // gridlines + y labels
    for (let i = 0; i <= 4; i++) {
      const val = (max / 4) * i;
      const yy = y(val);
      g += `<line class="gline" x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}"/>`;
      g += `<text class="axl" x="${padL - 8}" y="${yy + 3.5}" text-anchor="end">${C.esc(fmt(val))}</text>`;
    }

    data.forEach((d, i) => {
      const cx = padL + groupW * i + groupW / 2;
      const totalW = series.length * barW + (series.length - 1) * gap;
      series.forEach((s, si) => {
        const v = d[s.key] || 0;
        const bh = Math.max(v > 0 ? 2.5 : 0, padT + ih - y(v));
        const bx = cx - totalW / 2 + si * (barW + gap);
        g += `<rect class="bar-r" x="${bx.toFixed(1)}" y="${(padT + ih - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(5, barW / 2)}" fill="${s.color}" fill-opacity=".92"
          data-tip="${C.esc(d.fullLabel || d.label)} · ${C.esc(s.name)}: ${C.esc(fmt(v, true))}"/>`;
      });
      g += `<text class="axl" x="${cx}" y="${h - 10}" text-anchor="middle">${C.esc(d.label)}</text>`;
    });

    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  },

  /* --------------------------------------------------------- SINGLE BARS */
  /** data: [{label, value, color?, fullLabel?}] */
  bars(data, opt = {}) {
    const { h = 220, fmt = v => v, color = '#7c6cff', maxBarW = 30 } = opt;
    if (!data.length) return C.emptySvg(h);
    const w = 700, padL = 52, padR = 12, padT = 14, padB = 30;
    const iw = w - padL - padR, ih = h - padT - padB;
    const peak = Math.max(...data.map(d => d.value), 1);
    const max = C.niceMax(peak / 100) * 100;
    const y = v => padT + ih - (v / max) * ih;
    const slot = iw / data.length;
    const bw = Math.min(maxBarW, slot * 0.66);

    let g = '';
    for (let i = 0; i <= 4; i++) {
      const val = (max / 4) * i, yy = y(val);
      g += `<line class="gline" x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}"/>`;
      g += `<text class="axl" x="${padL - 8}" y="${yy + 3.5}" text-anchor="end">${C.esc(fmt(val))}</text>`;
    }
    // label thinning for dense axes
    const step = data.length > 20 ? Math.ceil(data.length / 15) : 1;
    data.forEach((d, i) => {
      const cx = padL + slot * i + slot / 2;
      const bh = Math.max(d.value > 0 ? 2.5 : 0, padT + ih - y(d.value));
      g += `<rect class="bar-r" x="${(cx - bw / 2).toFixed(1)}" y="${(padT + ih - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(5, bw / 2)}" fill="${d.color || color}" fill-opacity=".92"
        data-tip="${C.esc(d.fullLabel || d.label)}: ${C.esc(fmt(d.value, true))}"/>`;
      if (i % step === 0) g += `<text class="axl" x="${cx}" y="${h - 10}" text-anchor="middle">${C.esc(d.label)}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  },

  /* ------------------------------------------------------------- H-BARS */
  /** horizontal ranked bars. data: [{label, value, color, icon?}] */
  hBars(data, opt = {}) {
    const { fmt = v => v, rowH = 30 } = opt;
    if (!data.length) return C.emptySvg(120);
    const w = 460, labelW = 128, valW = 78;
    const h = data.length * rowH + 6;
    const trackW = w - labelW - valW;
    const max = Math.max(...data.map(d => d.value), 1);
    let g = '';
    data.forEach((d, i) => {
      const yy = i * rowH + 6;
      const bw = Math.max(2, (d.value / max) * trackW);
      g += `<text class="axl" x="0" y="${yy + 12}" style="font-size:11px;fill:#a8b2d1">${C.esc((d.icon ? d.icon + ' ' : '') + C.trunc(d.label, 15))}</text>`;
      g += `<rect x="${labelW}" y="${yy + 3}" width="${trackW}" height="13" rx="6.5" fill="rgba(0,0,0,.34)"/>`;
      g += `<rect class="bar-r" x="${labelW}" y="${yy + 3}" width="${bw.toFixed(1)}" height="13" rx="6.5" fill="${d.color}" data-tip="${C.esc(d.label)}: ${C.esc(fmt(d.value, true))}"/>`;
      g += `<text x="${w}" y="${yy + 13.5}" text-anchor="end" style="font-size:11px;font-weight:700;fill:#f2f5ff;font-variant-numeric:tabular-nums">${C.esc(fmt(d.value))}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMinYMin meet" style="width:100%">${g}</svg>`;
  },

  /* -------------------------------------------------------------- DONUT */
  /** data: [{name, total, color, icon?}] */
  donut(data, opt = {}) {
    const { size = 220, thick = 26, fmt = v => v, centerTop = '', centerBot = '' } = opt;
    const total = data.reduce((s, d) => s + d.total, 0);
    if (!total) return C.emptySvg(size);
    const r = size / 2 - thick / 2 - 2;
    const cx = size / 2, cy = size / 2;
    const circ = 2 * Math.PI * r;
    let off = 0, g = '';
    data.forEach(d => {
      const frac = d.total / total;
      const len = frac * circ;
      g += `<circle class="donut-seg" cx="${cx}" cy="${cy}" r="${r}" fill="none"
        stroke="${d.color}" stroke-width="${thick}"
        stroke-dasharray="${(len - 1.6).toFixed(2)} ${(circ - len + 1.6).toFixed(2)}"
        stroke-dashoffset="${(-off).toFixed(2)}" stroke-linecap="round"
        data-tip="${C.esc((d.icon ? d.icon + ' ' : '') + d.name)}: ${C.esc(fmt(d.total, true))} (${(frac * 100).toFixed(1)}%)"/>`;
      off += len;
    });
    const ct = centerTop ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" style="font-size:10px;font-weight:700;letter-spacing:.1em;fill:#6b7699">${C.esc(centerTop)}</text>` : '';
    const cb = centerBot ? `<text x="${cx}" y="${cy + 16}" text-anchor="middle" style="font-size:17px;font-weight:800;fill:#f2f5ff;font-variant-numeric:tabular-nums;font-family:'Plus Jakarta Sans',sans-serif">${C.esc(centerBot)}</text>` : '';
    return `<svg viewBox="0 0 ${size} ${size}" style="max-width:${size}px;margin:0 auto">
      <g transform="rotate(-90 ${cx} ${cy})">${g}</g>${ct}${cb}
    </svg>`;
  },

  /* --------------------------------------------------------------- LINE */
  /**
   * Multi-series line/area chart.
   * series: [{name, color, values:[numbers], area?:bool}]
   * labels: x labels aligned to values index
   */
  line(series, labels, opt = {}) {
    const { h = 250, fmt = v => v, zeroBase = true, dots = false } = opt;
    if (!series.length || !series[0].values.length) return C.emptySvg(h);
    const w = 700, padL = 54, padR = 14, padT = 16, padB = 30;
    const iw = w - padL - padR, ih = h - padT - padB;
    const all = series.flatMap(s => s.values);
    let lo = Math.min(...all), hi = Math.max(...all);
    if (zeroBase) lo = Math.min(0, lo);
    if (hi === lo) hi = lo + 100;
    const pad = (hi - lo) * 0.08;
    hi += pad; if (!zeroBase) lo -= pad;
    const n = series[0].values.length;
    const x = i => padL + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = v => padT + ih - ((v - lo) / (hi - lo)) * ih;

    let g = '';
    for (let i = 0; i <= 4; i++) {
      const val = lo + ((hi - lo) / 4) * i, yy = y(val);
      g += `<line class="gline" x1="${padL}" y1="${yy}" x2="${w - padR}" y2="${yy}"/>`;
      g += `<text class="axl" x="${padL - 8}" y="${yy + 3.5}" text-anchor="end">${C.esc(fmt(val))}</text>`;
    }
    if (lo < 0) {
      const zy = y(0);
      g += `<line x1="${padL}" y1="${zy}" x2="${w - padR}" y2="${zy}" stroke="rgba(255,255,255,.22)" stroke-width="1" stroke-dasharray="3 3"/>`;
    }

    series.forEach((s, si) => {
      const gid = `lg${si}_${Math.random().toString(36).slice(2, 6)}`;
      const pts = s.values.map((v, i) => [x(i), y(v)]);
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
      if (s.area) {
        g = `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${s.color}" stop-opacity=".34"/>
              <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
            </linearGradient></defs>` + g +
          `<path d="${d} L${x(n - 1)},${padT + ih} L${padL},${padT + ih} Z" fill="url(#${gid})"/>`;
      }
      g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (dots || n <= 14) {
        pts.forEach((p, i) => {
          g += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3.4" fill="#0a0e1c" stroke="${s.color}" stroke-width="2"/>`;
          g += `<circle class="bar-r" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="11" fill="transparent"
            data-tip="${C.esc(labels[i] || '')} · ${C.esc(s.name)}: ${C.esc(fmt(s.values[i], true))}"/>`;
        });
      } else {
        pts.forEach((p, i) => {
          g += `<rect class="bar-r" x="${(p[0] - iw / n / 2).toFixed(1)}" y="${padT}" width="${(iw / n).toFixed(1)}" height="${ih}" fill="transparent"
            data-tip="${C.esc(labels[i] || '')} · ${C.esc(s.name)}: ${C.esc(fmt(s.values[i], true))}"/>`;
        });
      }
    });

    const step = n > 16 ? Math.ceil(n / 12) : 1;
    labels.forEach((l, i) => {
      if (i % step === 0 || i === n - 1) {
        g += `<text class="axl" x="${x(i)}" y="${h - 10}" text-anchor="middle">${C.esc(l)}</text>`;
      }
    });
    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">${g}</svg>`;
  },

  /* ------------------------------------------------------------ HELPERS */
  emptySvg(h) {
    return `<svg viewBox="0 0 700 ${h}" preserveAspectRatio="xMidYMid meet">
      <text x="350" y="${h / 2}" text-anchor="middle" style="fill:#4a5375;font-size:13px;font-weight:600">No data for this period</text>
    </svg>`;
  },

  trunc(s, n) {
    s = String(s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  },

  legend(items) {
    return `<div class="legend">${items.map(i =>
      `<div class="leg"><span class="leg-sw" style="background:${i.color}"></span><span class="muted">${C.esc(i.name)}</span>${i.val ? `<b class="num">${C.esc(i.val)}</b>` : ''}</div>`
    ).join('')}</div>`;
  },

  /** SVG progress ring markup */
  ring(pct, opt = {}) {
    const { size = 62, thick = 6, color = '#7c6cff', track = 'rgba(0,0,0,.4)', label = null } = opt;
    const r = (size - thick) / 2, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, pct));
    const dash = (p / 100) * c;
    return `<div class="ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${track}" stroke-width="${thick}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="${thick}"
          stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}" stroke-linecap="round"
          style="transition:stroke-dasharray .85s cubic-bezier(.22,1,.36,1)"/>
      </svg>
      <span class="ring-txt">${label != null ? C.esc(label) : Math.round(p) + '%'}</span>
    </div>`;
  },

  /** ASCII block bar like ████████░░ */
  blocks(pct, n = 10, color) {
    const filled = Math.max(0, Math.min(n, Math.round(pct / 100 * n)));
    return `<span class="blocks" ${color ? `style="--bc:${color}"` : ''}><b>${'█'.repeat(filled)}</b>${'░'.repeat(n - filled)}</span>`;
  }
};

/* --- chart tooltip wiring (single global listener) ----------------------- */
(function tooltips() {
  let el = null;
  function tip() {
    if (!el) {
      el = document.createElement('div');
      el.className = 'ctip';
      document.body.appendChild(el);
    }
    return el;
  }
  document.addEventListener('mouseover', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) return;
    const d = tip();
    d.innerHTML = t.getAttribute('data-tip');
    d.classList.add('on');
  });
  document.addEventListener('mousemove', e => {
    if (!el || !el.classList.contains('on')) return;
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY - 34;
    const r = el.getBoundingClientRect();
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - pad;
    if (y < 6) y = e.clientY + 20;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('[data-tip]') && el) el.classList.remove('on');
  });
  document.addEventListener('click', () => { if (el) el.classList.remove('on'); });
})();
