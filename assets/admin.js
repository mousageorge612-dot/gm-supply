/* GM Supply — admin dashboard (coach account only; RLS enforces is_coach()). */
(function () {
  'use strict';
  var G = window.GS, $ = G.$, esc = G.esc, money = G.money;
  var S = new G.Session('gms-admin');
  var TAB = 'orders', OF = 'active', PRODUCTS = [];

  function start() {
    if (!S.a) return loginView();
    S.rpc('is_coach', {}).then(function (ok) {
      if (!ok) { S.clear(); G.toast('هالحساب مو حساب المدرب'); return loginView(); }
      $('#out').hidden = false; shell();
    }).catch(function () { S.clear(); loginView(); });
  }
  $('#out').onclick = function () { S.clear(); location.reload(); };

  function loginView() {
    $('#out').hidden = true;
    $('#app').innerHTML = '<form class="login" id="lf"><img src="../assets/img/logo-full.webp" alt="GM Supply"><h2 style="margin:0 0 14px">لوحة التحكم</h2>' +
      '<div class="field"><input class="inp" name="u" placeholder="اسم المستخدم" autocomplete="username" dir="ltr"></div>' +
      '<div class="field"><input class="inp" name="p" type="password" placeholder="كلمة المرور" autocomplete="current-password" dir="ltr"></div>' +
      '<button class="btn block">دخول</button><p style="color:var(--muted);font-size:13px">نفس حساب المدرب تبع لوحة GM Coach</p></form>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault(); var f = e.target;
      S.login(f.u.value, f.p.value).then(start).catch(function (er) { G.toast(G.errText(er)); });
    };
  }

  var TABS = [['orders', 'الطلبات'], ['products', 'المنتجات'], ['codes', 'أكواد الخصم'], ['settings', 'الإعدادات']];
  function shell() {
    $('#app').innerHTML = '<div class="tabs">' + TABS.map(function (t) { return '<button class="chip' + (t[0] === TAB ? ' on' : '') + '" data-t="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div><div id="view"></div>';
    $('.tabs').onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { TAB = b.dataset.t; shell(); } };
    ({ orders: orders, products: products, codes: codes, settings: settings })[TAB]();
  }
  function fail(e) { G.toast(G.errText(e)); }

  /* ---------------- orders ---------------- */
  function orders() {
    var q = 'select=*&order=id.desc&limit=200';
    if (OF === 'active') q += '&status=in.(new,confirmed,paid,shipped)';
    else if (OF !== 'all') q += '&status=eq.' + OF;
    Promise.all([S.rest('supply_orders', q), S.rest('supply_orders', 'select=status,total,created_at&status=neq.cancelled')]).then(function (r) {
      var list = r[0], all = r[1], m0 = new Date(); m0.setDate(1); m0.setHours(0, 0, 0, 0);
      var newN = all.filter(function (o) { return o.status === 'new'; }).length;
      var month = all.filter(function (o) { return new Date(o.created_at) >= m0; });
      var sales = month.filter(function (o) { return o.status === 'paid' || o.status === 'shipped' || o.status === 'delivered'; }).reduce(function (s, o) { return s + +o.total; }, 0);
      var F = [['active', 'المفتوحة'], ['new', 'جديد'], ['delivered', 'استلم'], ['cancelled', 'ملغى'], ['all', 'الكل']];
      $('#view').innerHTML = '<div class="stats"><div><b>' + newN + '</b><span>طلبات جديدة</span></div><div><b>' + month.length + '</b><span>طلبات هالشهر</span></div><div><b>' + money(sales) + '</b><span>مبيعات مدفوعة هالشهر</span></div></div>' +
        '<div class="chips" style="margin-bottom:12px">' + F.map(function (f) { return '<button class="chip' + (f[0] === OF ? ' on' : '') + '" data-f="' + f[0] + '">' + f[1] + '</button>'; }).join('') + '</div>' +
        '<div class="list">' + (list.length ? list.map(orderCard).join('') : '<div class="empty">ما في طلبات هون.</div>') + '</div>';
      $('#view .chips').onclick = function (e) { var b = e.target.closest('[data-f]'); if (b) { OF = b.dataset.f; orders(); } };
      $('#view .list').addEventListener('change', function (e) {
        var s = e.target.closest('[data-st]'); if (!s) return;
        S.rest('supply_orders', 'id=eq.' + s.dataset.st, { method: 'PATCH', body: { status: s.value } }).then(function () { G.toast('انحفظت الحالة'); orders(); }, fail);
      });
      $('#view .list').addEventListener('click', function (e) {
        var n = e.target.closest('[data-note]'); if (!n) return;
        var v = prompt('ملاحظة داخلية للطلب', n.dataset.v || ''); if (v === null) return;
        S.rest('supply_orders', 'id=eq.' + n.dataset.note, { method: 'PATCH', body: { admin_note: v } }).then(orders, fail);
      });
    }, fail);
  }
  function waNum(p) { p = String(p).replace(/\D/g, ''); if (p.indexOf('00') === 0) p = p.slice(2); if (p.indexOf('0') === 0) p = '963' + p.slice(1); return p; }
  function orderCard(o) {
    var d = new Date(o.created_at);
    return '<div class="it"><div class="hd"><div><h3>#' + o.id + ' · ' + esc(o.name) + '</h3><small>' + d.toLocaleDateString('ar-SY') + ' ' + d.toLocaleTimeString('ar-SY', { hour: '2-digit', minute: '2-digit' }) + ' · ' + esc(o.city) + '</small></div>' +
      '<span class="pill st-' + o.status + '">' + G.STATUS[o.status] + '</span></div>' +
      '<ul>' + o.items.map(function (l) { return '<li>' + esc(l.name) + (l.option ? ' (' + esc(l.option) + ')' : '') + ' × ' + l.qty + ' — ' + money(l.price * l.qty) + '</li>'; }).join('') + '</ul>' +
      '<div><b style="color:var(--gold)">' + money(o.total) + '</b>' + (o.discount_pct ? ' <small>(خصم ' + o.discount_pct + '% بكود ' + esc(o.discount_code) + ')</small>' : '') + '</div>' +
      (o.address ? '<small>📍 ' + esc(o.address) + '</small><br>' : '') + (o.notes ? '<small>📝 ' + esc(o.notes) + '</small><br>' : '') +
      (o.admin_note ? '<small style="color:var(--gold2)">🔒 ' + esc(o.admin_note) + '</small>' : '') +
      '<div class="acts"><a class="btn wa sm" href="https://wa.me/' + waNum(o.phone) + '" target="_blank" rel="noopener">واتساب ' + esc(o.phone) + '</a>' +
      '<select class="inp" style="width:auto" data-st="' + o.id + '">' + Object.keys(G.STATUS).map(function (k) { return '<option value="' + k + '"' + (k === o.status ? ' selected' : '') + '>' + G.STATUS[k] + '</option>'; }).join('') + '</select>' +
      '<button class="btn ghost sm" data-note="' + o.id + '" data-v="' + esc(o.admin_note || '') + '">ملاحظة</button></div></div>';
  }

  /* ---------------- products ---------------- */
  function products() {
    S.rest('supply_products', 'select=*&order=active.desc,featured.desc,sort.asc,id.desc').then(function (list) {
      PRODUCTS = list;
      $('#view').innerHTML = '<button class="btn block" id="newP" style="margin-bottom:12px">+ منتج جديد</button><div class="list">' +
        (list.length ? list.map(function (p) {
          return '<div class="it prow"><div class="im">' + (p.image ? '<img src="' + esc(G.media(p.image)) + '" alt="">' : '') + '</div><div><h3>' + esc(p.name) + '</h3><small>' + esc(p.brand || '') + (p.category ? ' · ' + esc(p.category) : '') + '</small><br>' +
            '<b style="color:var(--gold)">' + money(p.price_usd) + '</b> ' + (!p.active ? '<span class="pill">مخفي</span> ' : '') + (!p.in_stock ? '<span class="pill st-cancelled">نفد</span> ' : '') + (p.featured ? '<span class="pill st-new">مميز</span>' : '') + '</div>' +
            '<button class="btn ghost sm" data-e="' + p.id + '">تعديل</button></div>';
        }).join('') : '<div class="empty">ما في منتجات بعد. ضيف أول منتج.</div>') + '</div>';
      $('#newP').onclick = function () { editP({ active: true, in_stock: true, options: [], sort: 0 }); };
      $('#view .list').onclick = function (e) { var b = e.target.closest('[data-e]'); if (b) editP(PRODUCTS.filter(function (p) { return p.id == b.dataset.e; })[0]); };
    }, fail);
  }
  function editP(p) {
    var cats = []; PRODUCTS.forEach(function (x) { if (x.category && cats.indexOf(x.category) < 0) cats.push(x.category); });
    ['بروتين', 'كرياتين', 'بري وركاوت', 'أحماض أمينية', 'فيتامينات', 'تنحيف', 'زيادة وزن'].forEach(function (c) { if (cats.indexOf(c) < 0) cats.push(c); });
    var newImg = null;
    G.sheet('<h2>' + (p.id ? 'تعديل منتج' : 'منتج جديد') + '</h2><form id="pf">' +
      '<div class="field"><label>الصورة</label><div class="imgprev" id="ip">' + (p.image ? '<img src="' + esc(G.media(p.image)) + '">' : '') + '</div><input type="file" accept="image/*" id="pi"></div>' +
      '<div class="field"><label>اسم المنتج *</label><input class="inp" name="name" required value="' + esc(p.name || '') + '"></div>' +
      '<div class="row2"><div class="field"><label>الماركة</label><input class="inp" name="brand" value="' + esc(p.brand || '') + '"></div>' +
      '<div class="field"><label>التصنيف</label><input class="inp" name="category" list="cats" value="' + esc(p.category || '') + '"><datalist id="cats">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></div></div>' +
      '<div class="row2"><div class="field"><label>السعر $ *</label><input class="inp" name="price" type="number" step="0.01" min="0" required value="' + esc(p.price_usd != null ? p.price_usd : '') + '"></div>' +
      '<div class="field"><label>السعر القديم $ (للعروض)</label><input class="inp" name="old" type="number" step="0.01" min="0" value="' + esc(p.old_price_usd || '') + '"></div></div>' +
      '<div class="field"><label>النكهات / الأحجام (افصل بفاصلة)</label><input class="inp" name="options" placeholder="شوكولا، فانيلا، فريز" value="' + esc((p.options || []).join('، ')) + '"></div>' +
      '<div class="field"><label>الوصف</label><textarea class="inp" name="description" rows="4">' + esc(p.description || '') + '</textarea></div>' +
      '<div class="field"><label>الترتيب (رقم أصغر = أول)</label><input class="inp" name="sort" type="number" value="' + (p.sort || 0) + '"></div>' +
      '<label class="chk"><input type="checkbox" name="in_stock"' + (p.in_stock ? ' checked' : '') + '> متوفر</label>' +
      '<label class="chk"><input type="checkbox" name="featured"' + (p.featured ? ' checked' : '') + '> مميز (يطلع أول)</label>' +
      '<label class="chk"><input type="checkbox" name="active"' + (p.active ? ' checked' : '') + '> ظاهر بالمتجر</label>' +
      '<button class="btn block" type="submit">حفظ</button>' + (p.id ? '<button class="btn ghost block" type="button" id="delP" style="margin-top:8px;color:var(--red)">حذف المنتج</button>' : '') + '</form>',
      function (b) {
        $('#pi', b).onchange = function (e) {
          var f = e.target.files[0]; if (!f) return;
          G.shrink(f, 1000).then(function (blob) { newImg = blob; $('#ip', b).innerHTML = '<img src="' + URL.createObjectURL(blob) + '">'; }, fail);
        };
        $('#pf', b).onsubmit = function (e) {
          e.preventDefault(); var f = e.target, btn = f.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'عم يحفظ...';
          var row = { name: f.name.value.trim(), brand: f.brand.value.trim() || null, category: f.category.value.trim() || null,
            price_usd: +f.price.value || 0, old_price_usd: +f.old.value || null, description: f.description.value.trim() || null,
            options: f.options.value.split(/[،,]/).map(function (s) { return s.trim(); }).filter(Boolean),
            sort: +f.sort.value || 0, in_stock: f.in_stock.checked, featured: f.featured.checked, active: f.active.checked };
          var up = newImg ? S.upload('products/' + Date.now() + '.webp', newImg).then(function (u) { row.image = u; }) : Promise.resolve();
          up.then(function () {
            return p.id ? S.rest('supply_products', 'id=eq.' + p.id, { method: 'PATCH', body: row })
              : S.rest('supply_products', '', { method: 'POST', body: row });
          }).then(function () { G.closeSheet(); G.toast('انحفظ ✓'); products(); }, function (er) { btn.disabled = false; btn.textContent = 'حفظ'; fail(er); });
        };
        var del = $('#delP', b);
        if (del) del.onclick = function () {
          if (!confirm('أكيد بدك تحذف "' + p.name + '"؟ (إذا بدك تخبيه بس، شيل علامة "ظاهر بالمتجر")')) return;
          S.rest('supply_products', 'id=eq.' + p.id, { method: 'DELETE' }).then(function () { G.closeSheet(); products(); }, fail);
        };
      });
  }

  /* ---------------- codes ---------------- */
  function codes() {
    S.rest('supply_codes', 'select=*&order=created_at.desc').then(function (list) {
      $('#view').innerHTML = '<form class="it" id="cf"><h3 style="margin-bottom:8px">كود جديد</h3><div class="row2"><div class="field"><label>الكود</label><input class="inp" name="code" required dir="ltr" style="text-transform:uppercase" placeholder="GM15"></div>' +
        '<div class="field"><label>نسبة الخصم %</label><input class="inp" name="pct" type="number" min="1" max="90" required value="15"></div></div>' +
        '<div class="field"><label>ملاحظة (لمين الكود)</label><input class="inp" name="note"></div><button class="btn block">إضافة</button></form>' +
        '<div class="list" style="margin-top:12px">' + list.map(function (c) {
          return '<div class="it"><div class="hd"><div><h3 class="en" dir="ltr" style="text-align:right">' + esc(c.code) + '</h3><small>' + c.percent + '% · استُعمل ' + c.uses + ' مرة' + (c.note ? ' · ' + esc(c.note) : '') + '</small></div>' +
            '<span class="pill' + (c.active ? ' st-delivered' : '') + '">' + (c.active ? 'فعّال' : 'موقوف') + '</span></div>' +
            '<div class="acts"><button class="btn ghost sm" data-tg="' + esc(c.code) + '" data-a="' + (c.active ? 0 : 1) + '">' + (c.active ? 'إيقاف' : 'تفعيل') + '</button>' +
            '<button class="btn ghost sm" data-cp="' + esc(c.code) + '">نسخ رابط المتجر مع الكود</button></div></div>';
        }).join('') + '</div>';
      $('#cf').onsubmit = function (e) {
        e.preventDefault(); var f = e.target;
        S.rest('supply_codes', '', { method: 'POST', body: { code: f.code.value.trim().toUpperCase(), percent: +f.pct.value, note: f.note.value.trim() || null } }).then(codes, fail);
      };
      $('#view .list').onclick = function (e) {
        var t = e.target.closest('[data-tg]'), c = e.target.closest('[data-cp]');
        if (t) S.rest('supply_codes', 'code=eq.' + encodeURIComponent(t.dataset.tg), { method: 'PATCH', body: { active: t.dataset.a === '1' } }).then(codes, fail);
        if (c) { var u = 'https://supply.georgemousa.com/?code=' + c.dataset.cp; (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { G.toast('انسخ الرابط ✓'); }, function () { prompt('انسخ الرابط', u); }); }
      };
    }, fail);
  }

  /* ---------------- settings ---------------- */
  function settings() {
    S.rest('supply_settings', 'select=*&id=eq.1').then(function (r) {
      var s = r[0] || {};
      $('#view').innerHTML = '<form class="it" id="sf">' +
        '<div class="field"><label>رقم واتساب لاستقبال الطلبات (مع 963 بدون +)</label><input class="inp" name="whatsapp" dir="ltr" required value="' + esc(s.whatsapp || '') + '"></div>' +
        '<div class="field"><label>رقم/كود حساب شام كاش (بيطلع للزبون بعد الطلب)</label><input class="inp" name="shamcash" dir="ltr" value="' + esc(s.shamcash || '') + '"></div>' +
        '<div class="field"><label>ملاحظة التوصيل (بتطلع بالسلة)</label><textarea class="inp" name="delivery_note">' + esc(s.delivery_note || '') + '</textarea></div>' +
        '<div class="field"><label>شريط إعلان أعلى المتجر (اتركه فاضي لإخفائه)</label><input class="inp" name="announcement" value="' + esc(s.announcement || '') + '"></div>' +
        '<button class="btn block">حفظ</button></form>';
      $('#sf').onsubmit = function (e) {
        e.preventDefault(); var f = e.target;
        S.rest('supply_settings', 'id=eq.1', { method: 'PATCH', body: { whatsapp: f.whatsapp.value.replace(/\D/g, ''), shamcash: f.shamcash.value.trim() || null,
          delivery_note: f.delivery_note.value.trim() || null, announcement: f.announcement.value.trim() || null, updated_at: new Date().toISOString() } })
          .then(function () { G.toast('انحفظ ✓'); }, fail);
      };
    }, fail);
  }

  start();
})();
