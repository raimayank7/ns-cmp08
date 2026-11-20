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
      if (key(d.seller && d.seller.name) !== bz || d.cancelled) return;
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
  /* ---------- GSTR-4, the yearly return: the department's GSTR-4 (Annual) Offline Utility filled from the four quarters ----------
     Table 5: the year's CMP-08 (saved workings where they were saved, else the bills); Table 6: sales at the composition rate and
     purchases by GST rate; 4A registered suppliers, 4B registered suppliers under reverse charge, 4C unregistered suppliers
     (self invoices = reverse charge Yes), one row per supplier, supply type and rate. 4D (import of services) and 7 left empty. */
  function qP(fy, q) {
    var m0 = 4 + (q - 1) * 3, yy = m0 > 12 ? fy + 1 : fy, mm = m0 > 12 ? m0 - 12 : m0, pad = function (n) { return (n < 10 ? '0' : '') + n; }, end = new Date(yy, mm + 2, 0);
    return { id: fy + '-' + q, from: yy + '-' + pad(mm) + '-01', to: end.getFullYear() + '-' + pad(end.getMonth() + 1) + '-' + pad(end.getDate()), fy: fy };
  }
  function year4(fy) {
    var ty = $('#c8-type').value, T = TYPES[ty], bz = $('#c8-biz').value, Y = { val: 0, tax: 0, rcm: 0, intr: 0 };
    for (var q = 1; q <= 4; q++) {
      var P = qP(fy, q), sv = META[bz + '|' + P.id], v = sv ? sv.v : null, a = v ? null : fromBills(P);
      var tx = v ? v['c8-tax'] : a.tax, ex = v ? v['c8-ex'] : a.ex, base = T[1] === 'tax' ? tx : tx + ex;
      Y.val = r2(Y.val + tx + ex); Y.tax = r2(Y.tax + r2(base * (sv && sv.type ? TYPES[sv.type][0] : T[0]) / 100)); Y.rcm = r2(Y.rcm + (v ? v['c8-rcm'] : a.rcm)); Y.intr = r2(Y.intr + (v ? v['c8-int'] : 0));
    }
    /* purchases of the year: one bucket per supplier, supply type and rate, plus the rate-wise total for Table 6 */
    var me = SELLER() || {}, ms = String(me.state || String(me.gstin || '').slice(0, 2)), from = fy + '-04-01', to = (fy + 1) + '-03-31', A = {}, R = {};
    DOCS.forEach(function (d) {
      if (key(d.seller && d.seller.name) !== bz || d.cancelled || d.deleted || !(d.type === 'pbill' || d.type === 'self') || d.date < from || d.date > to) return;
      if (d.type === 'pbill' && d.kind === 'return') return;
      var sup = d.buyer || {}, g15 = String(sup.gstin || '').trim().toUpperCase(), ss = String(sup.state || g15.slice(0, 2) || ms), inter = !!ss && !!ms && ss !== ms;
      var tbl = d.type === 'self' ? '4C' : g15.length !== 15 ? '4C' : (d.rc || d.rcm) ? '4B' : '4A', rc = d.type === 'self' || d.rc || d.rcm ? 'Yes' : 'No';
      (d.items || []).concat(window.NSBooks && NSBooks.chargeLines ? NSBooks.chargeLines(d) : []).forEach(function (it) {
        var q = num(it.qty), rt = num(it.rate); if (!it.desc && !rt) return;
        var g = gross(q, rt, it), gr = d.noGst ? 0 : num(it.gst), tx = r2(g * gr / 100), k = [tbl, g15, inter ? 1 : 0, gr, rc].join('|');
        var b = A[k] || (A[k] = { tbl: tbl, gstin: g15, inter: inter, g: gr, rc: rc, txv: 0, tax: 0 }); b.txv = r2(b.txv + g); b.tax = r2(b.tax + tx);
        var rr = R[gr] || (R[gr] = { txv: 0, igst: 0, cgst: 0, sgst: 0 }); rr.txv = r2(rr.txv + g); if (inter) rr.igst = r2(rr.igst + tx); else { rr.cgst = r2(rr.cgst + r2(tx / 2)); rr.sgst = r2(rr.sgst + tx - r2(tx / 2)); }
      });
    });
    Y.buy = Object.keys(A).map(function (k) { return A[k]; }); Y.rates = R; Y.rate = T[0]; Y.ms = ms;
    return Y;
  }
  function gross(q, rt, it) { var g = q * rt; return r2(g - g * num(it.disc) / 100); }
  function rateOf(v) { var s = String(v == null ? '' : v).trim(); if (!s) return NaN; var n = parseFloat(s); return /%$/.test(s) ? n : n < 1 ? Math.round(n * 10000) / 100 : n; }
  function fill4(book, fy) {
    var need = ['Home', '4A. B2B', '4B. B2BRC', '4C. URP', '4D. IMPS', '5. CMP-08', '6. Inward outward supplies', 'master'];
    if (need.some(function (n) { return book.sheets.indexOf(n) < 0; })) return Promise.reject(new Error('notutil'));
    var Y = year4(fy), s = SELLER() || {}, X = NS.xlFill, POS = [];
    var tax3 = function (b) { var ig = b.inter ? b.tax : 0, cg = b.inter ? 0 : r2(b.tax / 2); return [ig, cg, b.inter ? 0 : r2(b.tax - cg), 0]; };
    return book.sheet('master').then(function (M) { POS = M.listUnder('POS'); }).then(function () {
      var pos = X.posFrom(POS, String(Y.ms).padStart(2, '0') + '-'), st = function (b) { return b.inter ? 'Inter-State' : 'Intra-State'; };
      var rows = function (t) { return Y.buy.filter(function (b) { return b.tbl === t; }); };
      var t4a = rows('4A').map(function (b) { return ['', b.gstin, pos, st(b), b.txv, b.g].concat(tax3(b), ['Add']); });
      var t4b = rows('4B').map(function (b) { return ['', b.gstin, pos, st(b), b.txv, b.g].concat(tax3(b), ['Add']); });
      var t4c = rows('4C').map(function (b) { return ['', '', b.rc, pos, st(b), b.txv, b.g].concat(tax3(b), ['Add']); });
      var half = r2(Y.tax / 2), rh = r2(Y.rcm / 2), ih = r2(Y.intr / 2);
      return book.sheet('Home').then(function (H) { H.set('B7', String(s.gstin || '').toUpperCase()); H.set('C7', fy + '-' + String(fy + 1).slice(2)); })
        .then(function () { return book.sheet('4A. B2B'); }).then(function (S) { S.putRows(7, t4a); })
        .then(function () { return book.sheet('4B. B2BRC'); }).then(function (S) { S.putRows(7, t4b); })
        .then(function () { return book.sheet('4C. URP'); }).then(function (S) { S.putRows(7, t4c); })
        .then(function () { return book.sheet('4D. IMPS'); }).then(function (S) { S.putRows(7, []); })
        .then(function () { return book.sheet('5. CMP-08'); }).then(function (S) {
          var put = function (r, a) { ['D', 'E', 'F', 'G', 'H'].forEach(function (c, i) { if (a[i] !== null) S.set(c + r, a[i]); }); };
          put(7, [Y.val, 0, half, r2(Y.tax - half), 0]); put(8, [null, 0, rh, r2(Y.rcm - rh), 0]);
          put(9, [null, 0, r2(half + rh), r2(Y.tax - half + Y.rcm - rh), 0]); put(10, [null, 0, ih, r2(Y.intr - ih), 0]);
        })
        .then(function () { return book.sheet('6. Inward outward supplies'); }).then(function (S) {
          for (var r = 7; r <= 40; r++) {
            var ty = S.get('C' + r), rt = S.get('D' + r); if (!ty || !rt || !ty.v) continue;
            var g = rateOf(rt.v), out = /outward/i.test(ty.v), v = null;
            if (out && g === Y.rate) v = [Y.val, 0, half, r2(Y.tax - half), 0];
            else if (!out && Y.rates[g]) { var x = Y.rates[g]; v = [x.txv, x.igst, x.cgst, x.sgst, 0]; }
            ['E', 'F', 'G', 'H', 'I'].forEach(function (c, i) { S.set(c + r, v ? v[i] : ''); });
          }
        })
        .then(function () { return { n: t4a.length + t4b.length + t4c.length, Y: Y }; });
    });
  }
  function fill4Util(change) {
    var s = SELLER() || {}, g = String(s.gstin || '').toUpperCase(), fy = quarter().fy, tp = null;
    if (!/^\d{2}[A-Z0-9]{13}$/.test(g)) { NS.toast('Add the GSTIN of this business first (My data › Businesses).'); return; }
    NS.xlFill.template('gstr4a', change).then(function (x) {
      tp = x; if (!tp) return;
      NS.toast('Filling ' + tp.file.name + '…');
      return NS.xlFill.open(tp.file).then(function (book) { return fill4(book, fy).then(function (r) {
        NS.xlFill.good('gstr4a', tp);
        var lab = fy + '-' + String(fy + 1).slice(2), nm = g + '_GSTR4_' + lab + ' NSBiz.xlsm';
        return book.save(nm).then(function (bl) { return NS.xlFill.toFolder(g, 'GSTR-4 ' + lab, nm, bl); }).then(function (inF) {
          NS.toast('Saved as "' + nm + '" (year ' + lab + ': ' + r.n + ' purchase rows, CMP-08 of the four quarters).' + (inF ? ' Also saved in NSBiz › GST Returns.' : '') + ' Open it in Excel, enable macros, then use the utility\'s own buttons to check it and make the upload file.');
        });
      }); });
    }).catch(function (e) {
      var w = e && e.message; if (/^(notutil|nosheet|notxl)$/.test(w)) NS.xlFill.bad('gstr4a', tp);
      NS.toast(w === 'notzip' ? 'Choose the zip downloaded from gst.gov.in, or the utility inside it.' : w === 'notinzip' ? 'That zip does not hold the GSTR-4 (Annual) Offline Utility. Download it from gst.gov.in › Downloads › Offline Tools › GSTR-4 Offline Tool (Annual).' : w === 'notutil' || w === 'nosheet' || w === 'notxl' ? 'That file is not the GSTR-4 (Annual) Offline Utility.' : 'Could not fill the utility: ' + (w || e), 'bad');
    });
  }
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
    var off = $('#c8-off'); if (off) off.innerHTML = official(P, s, F('c8-tax') + F('c8-ex'), tax, half, rcm, intr);
  }
  /* the statement as Form GST CMP-08 (rule 62 of the CGST Rules) lays it out */
  function official(P, s, value, tax, half, rcm, intr) {
    var G = NS.gstForm; if (!G) return '';
    var rh = r2(rcm / 2), ih = r2(intr / 2), R = function (no, l, a) { return { cells: [no, l].concat(a) }; };
    var y = +P.from.slice(0, 4), m = +P.from.slice(5, 7), fy = m >= 4 ? y + '-' + String(y + 1).slice(2) : (y - 1) + '-' + String(y).slice(2);
    var h = G.head('FORM GST CMP-08', '[See rule 62]', 'Statement for payment of self-assessed tax', null, [
      ['1.', 'GSTIN', s.gstin || ''], ['2.', '(a) Legal name', (s.gst && s.gst.legal) || s.legal || s.name || ''], ['', '(b) Trade name, if any', s.name || ''],
      ['3.', '(a) Financial Year', fy], ['', '(b) Period (quarter)', P.label], ['', '(c) ARN', ''], ['', '(d) Date of filing', '']]);
    var cols = ['Sr. No.', 'Description', 'Value', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess'];
    h += G.table('4.', 'Summary of self-assessed liability (net of advances, credit and debit notes and any other adjustment due to amendments etc.)', cols, [
      R('1', 'Outward supplies (including exempt supplies)', [value, 0, half, r2(tax - half), 0]),
      R('2', 'Inward supplies attracting reverse charge including import of services', ['', 0, rh, r2(rcm - rh), 0]),
      { cells: ['3', 'Tax payable (1+2)', '', 0, r2(half + rh), r2(tax - half + rcm - rh), 0], tot: 1 },
      R('4', 'Interest payable, if any', ['', 0, ih, r2(intr - ih), 0])]);
    h += G.table('5.', 'Tax and interest paid', ['Description', 'Integrated tax', 'Central tax', 'State/UT tax', 'Cess'], [
      { cells: ['Tax paid in cash'].concat([0, r2(half + rh), r2(tax - half + rcm - rh), 0]) }, { cells: ['Interest paid in cash'].concat([0, ih, r2(intr - ih), 0]) }]);
    h += G.verify() + G.note('Prepared in NSBiz from your saved bills of supply and the figures above. File it on the GST portal (Services › Returns › Statement for Composition Taxpayer, CMP-08).');
    return G.wrap(h);
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
  (function offBox() {
    var grid = root && $('.g3-grid', root); if (!grid || $('#c8-off')) return;
    var d = document.createElement('section'); d.id = 'c8-off'; d.className = 'off-box'; d.setAttribute('aria-label', 'Form GST CMP-08');
    if (NS.gstForm && NS.gstForm.inApp) { grid.parentNode.insertBefore(d, grid); NS.gstForm.fold(grid); } else grid.parentNode.insertBefore(d, grid.nextSibling);
  })();
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
    var pr0 = $('[data-do="print"]', root); if (pr0 && NS.xlFill && !$('[data-do="g4"]', root)) pr0.insertAdjacentHTML('beforebegin', '<button type="button" class="btn" data-do="g4" data-ic="xls" title="The yearly return of a composition dealer: fills the official GSTR-4 (Annual) Offline Utility for the financial year of the chosen quarter">Fill GSTR-4 annual (Excel)</button><button type="button" class="btn sm" data-do="g4own" data-noic>Change template file</button>');
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.do === 'g4') fill4Util(false);
      else if (b.dataset.do === 'g4own') fill4Util(true);
      else if (b.dataset.do === 'refill') { load(true); NS.toast(t('g3.refilled')); }
      else if (b.dataset.do === 'save') { var v = {}; FIELDS.forEach(function (f) { v[f] = F(f); }); META[ident()] = { v: v, type: $('#c8-type').value, at: Date.now() }; NSStore.meta('cmp08', META).then(function () { NS.toast(t('g3.saved')); }); }
      else if (b.dataset.do === 'print') window.print();
      else if (b.dataset.do === 'share') NS.sharePdf([NS.gstForm && NS.gstForm.inApp && $('#c8-off .off-sheet') || $('#c8-out')], 'CMP-08 ' + quarter().label, 'a4', 'CMP-08 ' + quarter().label, 'CMP-08 working ' + quarter().label);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
