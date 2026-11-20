/* GM Supply — shared helpers (store + admin). No build step, no libraries. */
(function () {
  'use strict';
  var URL_ = 'https://lwnjdcwlxbanjbkmbvoc.supabase.co';
  var KEY_ = 'sb_publishable_noH86NX1wSd4t6--8_cMbA_AqYIMub1';
  var BUCKET = 'supply-media';

  function raw(path, o) {
    o = o || {};
    var h = { apikey: KEY_, 'Content-Type': 'application/json' };
    if (o.token) h.Authorization = 'Bearer ' + o.token;
    if (o.headers) for (var k in o.headers) h[k] = o.headers[k];
    return fetch(URL_ + path, { method: o.method || 'GET', headers: h, body: o.body != null ? JSON.stringify(o.body) : undefined, cache: 'no-store' })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
          if (!r.ok) { var er = new Error((j && (j.error_description || j.msg || j.message || j.error)) || 'HTTP ' + r.status); er.status = r.status; throw er; }
          return j;
        });
      });
  }
  function rest(table, query, o) { return raw('/rest/v1/' + table + (query ? '?' + query : ''), o); }
  function rpc(fn, body, o) { o = o || {}; o.method = 'POST'; o.body = body; return raw('/rest/v1/rpc/' + fn, o); }

  function Session(key) { this.key = key; this.a = null; try { this.a = JSON.parse(localStorage.getItem(key)); } catch (e) {} }
  Session.prototype.save = function (j) {
    this.a = { token: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 - 60000 };
    try { localStorage.setItem(this.key, JSON.stringify(this.a)); } catch (e) {}
  };
  Session.prototype.clear = function () { this.a = null; try { localStorage.removeItem(this.key); } catch (e) {} };
  Session.prototype.token = function () {
    var s = this;
    if (!s.a) return Promise.reject(new Error('no session'));
    if (Date.now() < s.a.exp) return Promise.resolve(s.a.token);
    return raw('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.a.refresh } })
      .then(function (j) { s.save(j); return s.a.token; }, function (e) { if (e.status === 400 || e.status === 401) s.clear(); throw e; });
  };
  Session.prototype.login = function (user, pass, domain) {
    var s = this, u = String(user || '').trim().toLowerCase();
    var email = u.indexOf('@') > 0 ? u : u + (domain || '@clients.georgemousa.com');
    return raw('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: email, password: pass } }).then(function (j) { s.save(j); });
  };
  Session.prototype.rest = function (table, query, o) {
    o = o || {}; return this.token().then(function (t) { o.token = t; return rest(table, query, o); });
  };
  Session.prototype.rpc = function (fn, body) { return this.token().then(function (t) { return rpc(fn, body, { token: t }); }); };
  Session.prototype.fn = function (name, body) { return this.token().then(function (t) { return raw('/functions/v1/' + name, { method: 'POST', body: body, token: t }); }); };
  Session.prototype.upload = function (path, blob) {
    return this.token().then(function (t) {
      return fetch(URL_ + '/storage/v1/object/' + BUCKET + '/' + path, { method: 'POST',
        headers: { apikey: KEY_, Authorization: 'Bearer ' + t, 'Content-Type': blob.type || 'image/webp', 'x-upsert': 'true' }, body: blob })
        .then(function (r) { if (!r.ok) return r.text().then(function (x) { throw new Error('upload ' + r.status + ' ' + x); }); return media(path); });
    });
  };

  function media(p) { if (!p) return ''; if (/^https?:/.test(p)) return p; return URL_ + '/storage/v1/object/public/' + BUCKET + '/' + p; }

  function shrink(file, max) {
    max = max || 1000;
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('encode')); }, 'image/webp', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('image')); };
      img.src = url;
    });
  }

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(n) || 0; return '$' + (Math.round(n * 100) / 100).toFixed(n % 1 ? 2 : 0); }
  function toast(m) {
    var t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = m; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function errText(e) {
    var m = String((e && e.message) || e || '');
    if (/invalid login|invalid_grant|credentials/i.test(m)) return 'اسم المستخدم أو كلمة المرور غلط';
    if (/failed to fetch|network/i.test(m)) return 'ما في اتصال بالإنترنت';
    if (/not_coach/.test(m)) return 'ما عندك صلاحية';
    if (/unavailable/.test(m)) return 'في منتج بالسلة صار غير متوفر، شيله وجرب مرة تانية';
    if (/missing_fields/.test(m)) return 'عبّي الاسم والرقم والمحافظة';
    return m || 'صار خطأ';
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
    $('#sheet-body').innerHTML = html; sh.hidden = false; document.body.classList.add('noscroll');
    sh.querySelector('.sheet-panel').scrollTop = 0;
    if (onOpen) onOpen($('#sheet-body'));
  }
  function closeSheet() { var sh = $('#sheet'); if (sh) sh.hidden = true; document.body.classList.remove('noscroll'); }

  var CITIES = ['دمشق', 'ريف دمشق', 'حلب', 'حمص', 'حماة', 'اللاذقية', 'طرطوس', 'إدلب', 'درعا', 'السويداء', 'القنيطرة', 'دير الزور', 'الرقة', 'الحسكة'];
  var STATUS = { 'new': 'جديد', confirmed: 'مؤكد', paid: 'مدفوع', shipped: 'انشحن', delivered: 'استلم', cancelled: 'ملغى' };

  window.GS = { rest: rest, rpc: rpc, Session: Session, media: media, shrink: shrink, $: $, $$: $$, esc: esc, money: money,
    toast: toast, errText: errText, sheet: sheet, closeSheet: closeSheet, CITIES: CITIES, STATUS: STATUS };
})();
