/* CMP-08 working (cmp08.niveshsahayak.in) for composition dealers: tax for the quarter by business type (CGST Rule 7,
   Notification 2/2019-CT(Rate) for small service providers), plus reverse charge tax and interest, all paid in cash.
   Turnover comes from bills of supply and cash memos saved in the data home, or is typed. Also tracks the year's turnover
   against the composition limit. Workings saved in the data home under meta 'cmp08'. Screen words: NS.t('c8.*'). */
(function () {
  'use strict';
  var $ = NS.$, $$ = NS.$$, esc = NS.esc, num = NS.num, r2 = NS.r2, t = NS.t, money = NS.money;
  var root = $('#c8');
  if (!root) return;
  function key(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  /* rate (CGST + SGST/UTGST together) and what it is charged on */
  var TYPES = { trader: [1, 'tax'], maker: [1, 'all'], food: [5, 'all'], svc: [6, 'tax'] };
  var QN = ['Apr–Jun', 'Jul–Sep', 'Oct–Dec', 'Jan–Mar'];
  var DOCS = [], BIZ = [], META = {}, AUTO = null;

  function quarter() {   /* value 'YYYY-Q' = financial year starting YYYY, quarter Q (1 = Apr-Jun) */
    var v = $('#c8-q').value.split('-'), y = +v[0], q = +v[1], m0 = 4 + (q - 1) * 3, yy = m0 > 12 ? y + 1 : y, mm = m0 > 12 ? m0 - 12 : m0;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; }, end = new Date(yy, mm + 2, 0);
    var due = new Date(end.getFullYear(), end.getMonth() + 1, 18);
    return { id: v.join('-'), late: new Date() > new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59), from: yy + '-' + pad(mm) + '-01', to: end.getFullYear() + '-' + pad(end.getMonth() + 1) + '-' + pad(end.getDate()), fy: y, label: QN[q - 1] + ' ' + y + '-' + String(y + 1).slice(2),
      due: due.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][due.getMonth()] + ' ' + due.getFullYear() };
  }
  function qOptions() {
    var d = new Date(), y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, out = [];
    for (var fy = y; fy >= y - 2; fy--) for (var q = 4; q >= 1; q--) out.push([fy + '-' + q, QN[q - 1] + ' ' + fy + '-' + String(fy + 1).slice(2)]);
    return out;
  }
  function value(d) {   /* bill total without tax: a composition dealer's bill of supply has no GST */
    return r2((d.items || []).reduce(function (a, it) { var g = num(it.qty) * num(it.rate); return a + g - g * num(it.disc) / 100; }, 0));
  }
  function fromBills(P) {
    var bz = $('#c8-biz').value, o = { tax: 0, ex: 0, rcm: 0, fy: 0, n: 0 };
    DOCS.forEach(function (d) {
      if (key(d.seller && d.seller.name) !== bz) return;
      var sale = d.type === 'invoice' || d.type === 'cashmemo', fyStart = P.fy + '-04-01', fyEnd = (P.fy + 1) + '-03-31';
      if (sale && d.date >= fyStart && d.date <= fyEnd && d.date <= P.to) o.fy += value(d);
      if (!(d.date >= P.from && d.date <= P.to)) return;
      if (sale) {
        o.tax += value(d); o.n++;   /* exempt sales can't be told apart on a bill of supply: the user moves them to the exempt box */
      } else if (d.type === 'note' && d.kind === 'credit' && d.side !== 'purchase') o.tax -= value(d);
      else if (d.type === 'self') o.rcm += r2((d.items || []).reduce(function (a, it) { return a + num(it.qty) * num(it.rate) * num(it.gst) / 100; }, 0));
    });
    ['tax', 'ex', 'rcm', 'fy'].forEach(function (k) { o[k] = r2(o[k]); });
    return o;
  }
  function F(id) { return num($('#' + id).value); }
  function draw() {
    var P = quarter(), ty = $('#c8-type').value, T = TYPES[ty], s = SELLER() || {};
    var base = T[1] === 'tax' ? F('c8-tax') : F('c8-tax') + F('c8-ex'), tax = r2(base * T[0] / 100), half = r2(tax / 2);
    var rcm = F('c8-rcm'), intr = F('c8-int'), total = r2(tax + rcm + intr);
    var fy = F('c8-fy'), lim = ty === 'svc' ? 5000000 : num($('#c8-lim').value);
    var m = function (n) { return money(n, false); };
    /* CMP-08 is only for composition dealers: say so for a business saved as regular (round C) */
    var h = (s.reg && s.reg !== 'comp' ? '<p class="note b1-warn">' + esc(t('c8.notcomp', { n: s.name || '' })) + '</p>' : '') +
      '<div class="g1-print-hd"><b>' + esc(s.name || '') + '</b>' + (s.gstin ? ' · GSTIN ' + esc(s.gstin) : '') + '<br>' + esc(t('c8.for', { p: P.label })) + '</div>' +
      '<div class="g1-tiles"><div><span>' + esc(t('c8.k.base')) + '</span><b>' + m(base) + '</b></div><div><span>' + esc(t('c8.k.rate')) + '</span><b>' + T[0] + '%</b></div>' +
      '<div class="hi"><span>' + esc(t('c8.k.pay')) + '</span><b>' + m(total) + '</b></div><div><span>' + esc(t('c8.k.due')) + '</span><b>' + esc(P.due) + '</b></div></div>' +
      '<div class="g1-tw"><table class="g1-t"><thead><tr><th></th><th class="n">CGST</th><th class="n">SGST/UTGST</th><th class="n">' + esc(t('g1.total')) + '</th></tr></thead><tbody>' +
      '<tr><td>' + esc(t('c8.r.out', { r: T[0] })) + '</td><td class="n">' + m(half) + '</td><td class="n">' + m(r2(tax - half)) + '</td><td class="n">' + m(tax) + '</td></tr>' +
      '<tr><td>' + esc(t('c8.r.rcm')) + '</td><td class="n">' + m(r2(rcm / 2)) + '</td><td class="n">' + m(r2(rcm - r2(rcm / 2))) + '</td><td class="n">' + m(rcm) + '</td></tr>' +
      '<tr><td>' + esc(t('c8.r.int')) + '</td><td class="n">' + m(r2(intr / 2)) + '</td><td class="n">' + m(r2(intr - r2(intr / 2))) + '</td><td class="n">' + m(intr) + '</td></tr>' +
      '</tbody><tfoot><tr><td>' + esc(t('c8.r.cash')) + '</td><td class="n">' + m(r2(half + r2(rcm / 2) + r2(intr / 2))) + '</td><td class="n">' + m(r2(total - half - r2(rcm / 2) - r2(intr / 2))) + '</td><td class="n">' + m(total) + '</td></tr></tfoot></table></div>' +
      '<p class="soft">' + esc(t('c8.cash')) + '</p>' +
      (P.late ? '<p class="callout c8-late">' + esc(t('c8.w.late', { d: P.due })) + '</p>' : '') +
      '<h3>' + esc(t('c8.h.lim')) + '</h3><div class="c8-bar" role="img" aria-label="' + esc(t('c8.used', { p: Math.round(fy / lim * 100) })) + '"><i style="width:' + Math.min(100, fy / lim * 100) + '%"></i></div>' +
      '<p>' + esc(t('c8.used2', { a: money(fy), l: money(lim), p: Math.round(fy / lim * 100) })) + '</p>' +
      (fy > lim ? '<p class="callout">' + esc(t('c8.w.over')) + '</p>' : fy > lim * 0.8 ? '<p class="callout">' + esc(t('c8.w.near')) + '</p>' : '') +
      (ty === 'trader' && F('c8-ex') ? '<p class="soft">' + esc(t('c8.w.trex')) + '</p>' : '');
    $('#c8-out').innerHTML = h;
  }
  function SELLER() { var bz = $('#c8-biz').value; return BIZ.filter(function (b) { return key(b.name) === bz; })[0] || (DOCS.filter(function (d) { return key(d.seller && d.seller.name) === bz; })[0] || {}).seller; }
  function ident() { return $('#c8-biz').value + '|' + quarter().id; }
  var FIELDS = ['c8-tax', 'c8-ex', 'c8-rcm', 'c8-int', 'c8-fy'];
  function load(fresh) {
    var P = quarter(), sv = !fresh && META[ident()], a = AUTO = fromBills(P);
    var v = sv ? sv.v : { 'c8-tax': a.tax, 'c8-ex': a.ex, 'c8-rcm': a.rcm, 'c8-int': 0, 'c8-fy': a.fy };
    FIELDS.forEach(function (f) { $('#' + f).value = v[f] ? r2(v[f]) : ''; });
    if (sv && sv.type) $('#c8-type').value = sv.type;
    $('#c8-saved').textContent = sv ? t('g3.loaded', { d: new Date(sv.at).toLocaleString('en-IN') }) : t('c8.from', { n: a.n });
    draw();
    try { localStorage.setItem('ns-c8', JSON.stringify({ biz: $('#c8-biz').value, q: $('#c8-q').value, type: $('#c8-type').value, lim: $('#c8-lim').value })); } catch (e) {}
  }
  function start() {
    document.addEventListener('ns-lang', function () { draw(); });   /* the language pack can arrive after the first drawing */
    $('#c8-q').innerHTML = qOptions().map(function (o) { return '<option value="' + o[0] + '">' + esc(o[1]) + '</option>'; }).join('');
    var sv = {}; try { sv = JSON.parse(localStorage.getItem('ns-c8') || '{}'); } catch (e) {}
    /* default: the last finished quarter */
    var d = new Date(); d.setMonth(d.getMonth() - 3); var fy = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1, q = d.getMonth() >= 3 ? Math.floor((d.getMonth() - 3) / 3) + 1 : 4;
    $('#c8-q').value = sv.q || fy + '-' + q;
    if (sv.type) $('#c8-type').value = sv.type;
    if (sv.lim) $('#c8-lim').value = sv.lim;
    NSStore.ready().then(function () { return Promise.all([NSStore.list('doc'), NSStore.list('biz'), NSStore.meta('cmp08')]); }).then(function (x) {
      DOCS = x[0] || []; BIZ = x[1] || []; META = x[2] || {};
      var seen = {}, bl = [];
      BIZ.concat(DOCS.map(function (d) { return d.seller; })).forEach(function (s) { var k = key(s && s.name); if (k && !seen[k]) { seen[k] = 1; bl.push([k, s.name + (s.gstin ? ' (' + s.gstin + ')' : '')]); } });
      $('#c8-biz').innerHTML = bl.length ? bl.map(function (b) { return '<option value="' + esc(b[0]) + '">' + esc(b[1]) + '</option>'; }).join('') : '<option value="">' + esc(t('g3.nobiz')) + '</option>';
      if (sv.biz && bl.some(function (b) { return b[0] === sv.biz; })) $('#c8-biz').value = sv.biz;
      $('#c8-status').textContent = t(NSStore.mode() === 'vault' ? 'g1.vault' : 'g1.local', { n: DOCS.length });
      load();
    }).catch(function () { $('#c8-status').textContent = t('g1.fail'); load(); });
    root.addEventListener('change', function (e) { if (e.target.matches('#c8-biz, #c8-q')) load(); else draw(); });
    root.addEventListener('input', function (e) { if (e.target.matches('input')) draw(); });
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.do === 'refill') { load(true); NS.toast(t('g3.refilled')); }
      else if (b.dataset.do === 'save') { var v = {}; FIELDS.forEach(function (f) { v[f] = F(f); }); META[ident()] = { v: v, type: $('#c8-type').value, at: Date.now() }; NSStore.meta('cmp08', META).then(function () { NS.toast(t('g3.saved')); }); }
      else if (b.dataset.do === 'print') window.print();
      else if (b.dataset.do === 'share') NS.sharePdf([$('#c8-out')], 'CMP-08 ' + quarter().label, 'a4', 'CMP-08 ' + quarter().label, 'CMP-08 working ' + quarter().label);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
