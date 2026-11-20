/* سبلاي | Forma Supply — shared client helpers. Plain JS, no build step.
   Backend: Supabase (Postgres + Auth + Storage). All rules are enforced on the server (RLS + RPCs). */
(function () {
  'use strict';
  var URL_ = 'https://lwnjdcwlxbanjbkmbvoc.supabase.co';
  var KEY_ = 'sb_publishable_noH86NX1wSd4t6--8_cMbA_AqYIMub1';
  var DOMAINS = { merchant: '@merchants.supply.georgemousa.com', staff: '@staff.supply.georgemousa.com' };

  function raw(path, o) {
    o = o || {};
    var h = { apikey: KEY_ };
    if (!o.blob) h['Content-Type'] = 'application/json';
    if (o.token) h.Authorization = 'Bearer ' + o.token;
    if (o.headers) for (var k in o.headers) h[k] = o.headers[k];
    var body = o.blob ? o.blob : (o.body != null ? JSON.stringify(o.body) : undefined);
    return fetch(URL_ + path, { method: o.method || 'GET', headers: h, body: body, cache: 'no-store' }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
        if (!r.ok) {
          var m = (j && (j.message || j.error_description || j.msg || j.error)) || ('HTTP ' + r.status);
          var er = new Error(typeof m === 'string' ? m : JSON.stringify(m)); er.status = r.status; er.data = j; throw er;
        }
        return j;
      });
    });
  }
  function rest(table, query, o) { return raw('/rest/v1/' + table + (query ? '?' + query : ''), o); }
  function rpc(fn, body, o) { o = o || {}; o.method = 'POST'; o.body = body || {}; return raw('/rest/v1/rpc/' + fn, o); }
  function fn(name, body, token) { return raw('/functions/v1/' + name, { method: 'POST', body: body, token: token }); }

  /* ---------- session (Supabase Auth, password grant) ---------- */
  function Session(key) { this.key = key; this.a = null; try { this.a = JSON.parse(localStorage.getItem(key)); } catch (e) {} }
  Session.prototype.save = function (j) {
    this.a = { token: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000, uid: j.user && j.user.id };
    try { localStorage.setItem(this.key, JSON.stringify(this.a)); } catch (e) {}
  };
  Session.prototype.clear = function () { this.a = null; try { localStorage.removeItem(this.key); } catch (e) {} };
  Session.prototype.token = function () {
    var s = this;
    if (!s.a) return Promise.reject(new Error('no_session'));
    if (Date.now() < s.a.exp) return Promise.resolve(s.a.token);
    return raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.a.refresh } })
      .then(function (j) { s.save(j); return s.a.token; }, function (e) { if (e.status === 400 || e.status === 401) s.clear(); throw e; });
  };
  Session.prototype.login = function (user, pass, domains) {
    var s = this, u = String(user || '').trim().toLowerCase();
    var list = u.indexOf('@') > 0 ? [u] : domains.map(function (d) { return u + d; });
    function attempt(i) {
      return raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: list[i], password: pass } })
        .then(function (j) { s.save(j); }, function (e) { if (i + 1 < list.length) return attempt(i + 1); throw e; });
    }
    return attempt(0);
  };
  Session.prototype.rest = function (t, q, o) { o = o || {}; return this.token().then(function (k) { o.token = k; return rest(t, q, o); }); };
  Session.prototype.rpc = function (f, b) { return this.token().then(function (k) { return rpc(f, b, { token: k }); }); };
  Session.prototype.fn = function (n, b) { return this.token().then(function (k) { return fn(n, b, k); }); };
  Session.prototype.upload = function (bucket, path, blob) {
    return this.token().then(function (k) {
      return raw('/storage/v1/object/' + bucket + '/' + path, { method: 'POST', blob: blob, token: k,
        headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true' } }).then(function () { return path; });
    });
  };
  Session.prototype.signed = function (path) {
    return this.token().then(function (k) {
      return raw('/storage/v1/object/sign/fs-private/' + path, { method: 'POST', body: { expiresIn: 3600 }, token: k })
        .then(function (j) { return URL_ + '/storage/v1' + j.signedURL; });
    });
  };

  /* ---------- media ---------- */
  function media(p) {
    if (!p) return '';
    if (/^https?:/.test(p) || p.charAt(0) === '/') return p;
    return URL_ + '/storage/v1/object/public/fs-media/' + p;
  }
  function shrink(file, max) {
    max = max || 1200;
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('encode')); }, 'image/webp', 0.85);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }
  function uid() { return (crypto.randomUUID ? crypto.randomUUID() : (Date.now() + '-' + Math.random()).replace('.', '')); }

  /* ---------- DOM + text ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function usdFmt(u) { u = Math.round(u * 100) / 100; return '$' + u.toLocaleString('en-US', { maximumFractionDigits: 2 }); }
  // Prices are shown in dollars and Syrian pounds together. rate = SYP per 1 USD (FS.rate from settings, or an order's own rate).
  function syp(n, rate) {
    if (n == null || n === '') return '';
    var v = Math.round(Number(n) || 0), r = rate === undefined ? window.FS.rate : rate;
    var s = '<span class="num ltr">' + v.toLocaleString('en-US') + '</span> ل.س';
    return r > 0 && v ? '<span class="num ltr">' + usdFmt(v / r) + '</span> · ' + s : s;
  }
  function sypText(n) { return Math.round(Number(n) || 0).toLocaleString('en-US') + ' ل.س'; }
  function ltr(s) { return '<span class="ltr num">' + esc(s) + '</span>'; }
  function date(d) {
    try { return new Date(d).toLocaleString('ar-SY-u-nu-latn', { timeZone: 'Asia/Damascus', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return String(d).slice(0, 16).replace('T', ' '); }
  }
  function day(d) {
    try { return new Date(d + (String(d).length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ar-SY-u-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }); }
    catch (e) { return d; }
  }
  function toast(m) {
    var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2800);
  }
  var ERR = {
    name_three_parts: 'اكتب الاسم الثلاثي كامل (الاسم، اسم الأب، الكنية)',
    bad_phone: 'رقم الموبايل مو صحيح', bad_governorate: 'اختار المحافظة', address_required: 'اكتب عنوان التوصيل',
    shipping_required: 'اختار شركة الشحن', bad_branch: 'اختار فرع الاستلام', seller_unavailable: 'هالمتجر مو متاح حالياً',
    item_unavailable: 'في منتج بالسلة صار غير متاح، شيله وجرّب مرة تانية', empty_cart: 'السلة فاضية', bad_qty: 'الكمية مو صحيحة',
    evidence_required: 'لازم تسجّل إثبات التسليم (رقم الإيصال أو صورة)', bad_transition: 'ما فيك تنقل الطلب لهالحالة',
    forbidden: 'ما عندك صلاحية', not_admin: 'ما عندك صلاحية', taken: 'هالاسم محجوز، جرّب غيره', bad_username: 'اسم الرابط لازم يكون أحرف إنكليزية صغيرة وأرقام و - (3 أحرف عالأقل)',
    weak_password: 'كلمة السر لازم تكون 8 أحرف عالأقل', missing_fields: 'عبّي كل الحقول المطلوبة', bad_return_qty: 'كمية المرتجع أكبر من المسلّمة',
    nothing_returned: 'حدّد كمية مرتجعة', not_delivered: 'المرتجع بس للطلبات المسلّمة', support_drafts_only: 'الدعم بيقدر يضيف مسودات بس',
    forbidden_status: 'ما فيك تغيّر لهالحالة', has_login: 'هالمتجر عنده حساب دخول', no_login: 'هالمتجر ما عنده حساب دخول'
  };
  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (/invalid login|invalid_grant|credentials/i.test(m)) return 'اسم المستخدم أو كلمة السر غلط';
    if (/failed to fetch|network|load failed/i.test(m)) return 'ما في اتصال بالإنترنت، جرّب مرة تانية';
    if (/^out_of_stock:/.test(m)) return 'الكمية المطلوبة من «' + m.split(':').slice(1).join(':') + '» مو متوفرة';
    if (e && e.data && e.data.error && ERR[e.data.error]) return ERR[e.data.error];
    for (var k in ERR) if (m.indexOf(k) >= 0) return ERR[k];
    if (/row-level security|permission denied/i.test(m)) return 'ما عندك صلاحية لهالعملية';
    return m || 'صار خطأ، جرّب مرة تانية';
  }
  function sheet(html, onOpen) {
    var sh = $('#sheet');
    if (!sh) {
      sh = document.createElement('div'); sh.id = 'sheet'; sh.className = 'sheet';
      sh.innerHTML = '<div class="sheet-bg" data-close></div><div class="sheet-panel" role="dialog" aria-modal="true"><button class="sheet-x" data-close aria-label="إغلاق">✕</button><div id="sheet-body"></div></div>';
      document.body.appendChild(sh);
      sh.addEventListener('click', function (e) { if (e.target.hasAttribute('data-close')) closeSheet(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    }
    $('#sheet-body').innerHTML = html; sh.hidden = false; document.body.classList.add('lock');
    sh.querySelector('.sheet-panel').scrollTop = 0;
    if (onOpen) onOpen($('#sheet-body'));
  }
  function closeSheet() { var sh = $('#sheet'); if (sh) sh.hidden = true; document.body.classList.remove('lock'); }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) {} document.body.removeChild(t);
    return Promise.resolve();
  }
  function waLink(phone, text) {
    var d = String(phone || '').replace(/\D/g, '');
    if (d.indexOf('00') === 0) d = d.slice(2);
    if (d.indexOf('0') === 0) d = '963' + d.slice(1);
    return 'https://wa.me/' + d + '?text=' + encodeURIComponent(text);
  }

  var GOVS = ['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'درعا', 'السويداء', 'القنيطرة', 'دير الزور', 'الرقة', 'الحسكة'];
  var STATUS = { 'new': 'جديد', confirmed: 'مؤكّد', shipping: 'قيد الشحن', delivered: 'تم التسليم', cancelled: 'ملغى', returned: 'مرتجع' };
  var NEXT = { 'new': ['confirmed', 'cancelled'], confirmed: ['shipping', 'delivered', 'cancelled'], shipping: ['delivered', 'cancelled'], delivered: ['returned'] };
  var PSTATUS = { draft: 'مسودة', pending_merchant: 'بانتظار موافقة التاجر', published: 'منشور', archived: 'مؤرشف' };
  var SSTATUS = { pending: 'بانتظار الموافقة', approved: 'مفعّل', suspended: 'موقوف', rejected: 'مرفوض' };
  var RSTATUS = { open: 'جديد', in_progress: 'قيد العمل', waiting_merchant: 'بانتظار موافقة التاجر', done: 'منجز', closed: 'مغلق' };
  var SOURCE = { seller_link: 'رابط التاجر', marketplace: 'من السوق' };
  var KIND = { delivered: 'تسليم', return_adjustment: 'تعديل مرتجع جزئي', full_return_reversal: 'عكس مرتجع كامل' };

  var ICON = {
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.6 12.2a2 2 0 0 0 2 1.6h8.1a2 2 0 0 0 2-1.5L22 7H6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 5h18M6 12h12M10 19h4"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9M3 9h18v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM5 13v7h14v-7"/></svg>',
    img: '<svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#9aa0a8" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-8 8"/></svg>'
  };

  window.FS = { rate: null, URL: URL_, DOMAINS: DOMAINS, raw: raw, rest: rest, rpc: rpc, fn: fn, Session: Session, media: media, shrink: shrink, uid: uid,
    $: $, $$: $$, esc: esc, syp: syp, sypText: sypText, ltr: ltr, date: date, day: day, toast: toast, errText: errText,
    sheet: sheet, closeSheet: closeSheet, copy: copy, waLink: waLink,
    GOVS: GOVS, STATUS: STATUS, NEXT: NEXT, PSTATUS: PSTATUS, SSTATUS: SSTATUS, RSTATUS: RSTATUS, SOURCE: SOURCE, KIND: KIND, ICON: ICON };
})();
