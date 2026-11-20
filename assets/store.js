/* GM Supply — public store: products, cart, order -> Supabase + WhatsApp. */
(function () {
  'use strict';
  var G = window.GS, $ = G.$, esc = G.esc, money = G.money;
  var P = [], BY = {}, CFG = { whatsapp: '963987461750' }, CAT = 'الكل', Q = '';
  var CK = 'gms-cart', CODEK = 'gms-code';
  var cart = load(CK) || [];          // [{id, option, qty}]
  var code = load(CODEK) || null;     // {code, pct}

  function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function saveCart() { cart = cart.filter(function (l) { return BY[l.id] || !P.length; }); store(CK, cart); badge(); }
  function badge() { $('#cartN').textContent = cart.reduce(function (s, l) { return s + l.qty; }, 0); }

  /* URL ?code=GM15 pre-fills the subscriber code */
  var urlCode = new URLSearchParams(location.search).get('code');

  Promise.all([
    G.rest('supply_products', 'select=*&active=eq.true&order=featured.desc,sort.asc,id.desc'),
    G.rest('supply_settings', 'select=*&id=eq.1')
  ]).then(function (r) {
    P = r[0] || []; P.forEach(function (p) { BY[p.id] = p; });
    if (r[1] && r[1][0]) CFG = r[1][0];
    if (CFG.announcement) { $('#announce').textContent = CFG.announcement; $('#announce').hidden = false; }
    $('#waFoot').href = 'https://wa.me/' + CFG.whatsapp;
    saveCart(); chips(); render();
    var pid = new URLSearchParams(location.search).get('p'); if (pid && BY[pid]) detail(BY[pid]);
    if (urlCode) applyCode(urlCode, true);
  }).catch(function () { $('#grid').innerHTML = '<div class="empty">ما قدرنا نحمّل المنتجات. تأكد من الإنترنت وحدّث الصفحة.</div>'; });

  function chips() {
    var cats = ['الكل']; P.forEach(function (p) { if (p.category && cats.indexOf(p.category) < 0) cats.push(p.category); });
    $('#chips').innerHTML = cats.length < 3 ? '' : cats.map(function (c) { return '<button class="chip' + (c === CAT ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>'; }).join('');
  }
  $('#chips').addEventListener('click', function (e) { var b = e.target.closest('.chip'); if (!b) return; CAT = b.dataset.c; chips(); render(); });
  $('#q').addEventListener('input', function (e) { Q = e.target.value.trim().toLowerCase(); render(); });

  function img(p) { return p.image ? '<img src="' + esc(G.media(p.image)) + '" alt="' + esc(p.name) + '" loading="lazy">' : '<span class="noimg">GM</span>'; }
  function render() {
    var list = P.filter(function (p) {
      if (CAT !== 'الكل' && p.category !== CAT) return false;
      if (Q && (p.name + ' ' + (p.brand || '') + ' ' + (p.category || '')).toLowerCase().indexOf(Q) < 0) return false;
      return true;
    });
    if (!P.length) { $('#grid').innerHTML = '<div class="empty">المنتجات قريباً جداً 🔥<br>تابعنا، وإذا بدك شي معيّن <a href="https://wa.me/' + CFG.whatsapp + '" target="_blank" rel="noopener">راسلنا واتساب</a>.</div>'; return; }
    if (!list.length) { $('#grid').innerHTML = '<div class="empty">ما في نتائج.</div>'; return; }
    $('#grid').innerHTML = list.map(function (p) {
      var off = p.old_price_usd && +p.old_price_usd > +p.price_usd ? Math.round((1 - p.price_usd / p.old_price_usd) * 100) : 0;
      return '<article class="card" data-id="' + p.id + '"><div class="ph">' + img(p) +
        (!p.in_stock ? '<span class="badge out">نفدت الكمية</span>' : off ? '<span class="badge" dir="ltr">-' + off + '%</span>' : '') +
        '<span class="badge orig">أصلي ✓</span></div><div class="bd">' +
        (p.brand ? '<span class="br">' + esc(p.brand) + '</span>' : '') + '<h3>' + esc(p.name) + '</h3>' +
        '<div class="price"><b>' + money(p.price_usd) + '</b>' + (off ? '<s>' + money(p.old_price_usd) + '</s>' : '') + '</div>' +
        '<button class="btn sm block" data-add="' + p.id + '"' + (p.in_stock ? '' : ' disabled') + '>' + (p.in_stock ? 'أضف للسلة' : 'غير متوفر') + '</button></div></article>';
    }).join('');
  }
  $('#grid').addEventListener('click', function (e) {
    var a = e.target.closest('[data-add]'); var c = e.target.closest('.card');
    if (a) { e.stopPropagation(); var p = BY[a.dataset.add]; if (p.options && p.options.length) detail(p); else add(p.id, ''); return; }
    if (c) detail(BY[c.dataset.id]);
  });

  function add(id, opt, qty) {
    var l = cart.filter(function (x) { return x.id == id && x.option === opt; })[0];
    if (l) l.qty = Math.min(20, l.qty + (qty || 1)); else cart.push({ id: +id, option: opt, qty: qty || 1 });
    saveCart(); G.toast('انضاف للسلة ✓');
  }

  function detail(p) {
    var opts = p.options || [];
    G.sheet('<div class="pd-img">' + img(p) + '</div>' + (p.brand ? '<div class="br" style="color:var(--gold);font-weight:700">' + esc(p.brand) + '</div>' : '') +
      '<h2>' + esc(p.name) + '</h2><div class="price" style="padding:0 0 10px"><b>' + money(p.price_usd) + '</b>' +
      (p.old_price_usd && +p.old_price_usd > +p.price_usd ? '<s>' + money(p.old_price_usd) + '</s>' : '') + '</div>' +
      (p.description ? '<div class="pd-desc">' + esc(p.description) + '</div>' : '') +
      (opts.length ? '<div class="field" style="margin-top:12px"><label>اختار النكهة / الحجم</label><select class="inp" id="opt">' + opts.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></div>' : '') +
      '<div class="note">✓ منتج أصلي ومضمون، مختار من الكوتش جورج موسى.</div>' +
      '<button class="btn block" id="addD"' + (p.in_stock ? '' : ' disabled') + '>' + (p.in_stock ? 'أضف للسلة' : 'نفدت الكمية') + '</button>',
      function (b) { var x = $('#addD', b); if (x) x.onclick = function () { add(p.id, opts.length ? $('#opt', b).value : ''); G.closeSheet(); }; });
  }

  function totals() {
    var sub = 0; cart.forEach(function (l) { var p = BY[l.id]; if (p) sub += p.price_usd * l.qty; });
    var pct = code ? code.pct : 0, d = Math.round(sub * pct) / 100;
    return { sub: sub, pct: pct, disc: d, total: sub - d };
  }

  $('#cartBtn').onclick = openCart;
  function openCart() {
    if (!cart.length) { G.sheet('<h2>السلة</h2><div class="empty" style="padding:30px 0">السلة فاضية.</div><button class="btn block" data-close>تصفّح المنتجات</button>'); return; }
    var t = totals();
    G.sheet('<h2>السلة</h2><div id="lines">' + cart.map(function (l, i) {
      var p = BY[l.id]; if (!p) return '';
      return '<div class="ci"><div class="im">' + img(p) + '</div><div><h4>' + esc(p.name) + '</h4><small>' + esc(l.option || p.brand || '') + ' · ' + money(p.price_usd) + '</small></div>' +
        '<div class="qty"><button data-q="' + i + '" data-d="-1">−</button><b>' + l.qty + '</b><button data-q="' + i + '" data-d="1">+</button></div></div>';
    }).join('') + '</div>' +
      '<div class="code"><input class="inp" id="code" placeholder="كود خصم المشتركين" value="' + esc(code ? code.code : '') + '"><button class="btn ghost sm" id="codeBtn">' + (code ? 'إلغاء' : 'تطبيق') + '</button></div>' +
      '<div id="codeMsg">' + (code ? '<span class="ok">✓ خصم ' + code.pct + '% مفعّل</span>' : '') + '</div>' +
      '<div class="sum"><div><span>المجموع</span><span>' + money(t.sub) + '</span></div>' + (t.pct ? '<div class="ok"><span>خصم ' + t.pct + '%</span><span>−' + money(t.disc) + '</span></div>' : '') +
      '<div class="t"><span>الإجمالي</span><span>' + money(t.total) + '</span></div></div>' +
      '<p style="color:var(--muted);font-size:13px;margin:0 0 12px">' + esc(CFG.delivery_note || '') + '</p>' +
      '<button class="btn block" id="checkout">متابعة الطلب</button>', function (b) {
        b.addEventListener('click', function (e) {
          var q = e.target.closest('[data-q]'); if (!q) return;
          var l = cart[+q.dataset.q]; l.qty += +q.dataset.d; if (l.qty < 1) cart.splice(+q.dataset.q, 1); if (l.qty > 20) l.qty = 20;
          saveCart(); openCart();
        });
        $('#codeBtn', b).onclick = function () { if (code) { code = null; store(CODEK, null); openCart(); } else applyCode($('#code', b).value); };
        $('#checkout', b).onclick = checkout;
      });
  }

  function applyCode(v, silent) {
    v = String(v || '').trim().toUpperCase(); if (!v) return;
    G.rpc('supply_check_code', { p_code: v }).then(function (pct) {
      if (pct) { code = { code: v, pct: pct }; store(CODEK, code); if (!silent) openCart(); else G.toast('كود الخصم ' + v + ' مفعّل (' + pct + '%)'); }
      else if (!silent) $('#codeMsg').innerHTML = '<span class="err">الكود غير صحيح</span>';
    }).catch(function (e) { if (!silent) G.toast(G.errText(e)); });
  }

  function checkout() {
    var me = load('gms-me') || {}, t = totals();
    G.sheet('<h2>معلومات التوصيل</h2>' +
      '<form id="of"><div class="field"><label>الاسم الكامل *</label><input class="inp" name="name" required maxlength="80" value="' + esc(me.name || '') + '"></div>' +
      '<div class="field"><label>رقم الموبايل (واتساب) *</label><input class="inp" name="phone" required inputmode="tel" maxlength="30" dir="ltr" placeholder="09xxxxxxxx" value="' + esc(me.phone || '') + '"></div>' +
      '<div class="field"><label>المحافظة *</label><select class="inp" name="city" required><option value="">اختار</option>' + G.CITIES.map(function (c) { return '<option' + (c === me.city ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label>العنوان بالتفصيل</label><input class="inp" name="address" maxlength="300" placeholder="المدينة، الحي، أقرب معلم" value="' + esc(me.address || '') + '"></div>' +
      '<div class="field"><label>ملاحظات</label><textarea class="inp" name="notes" maxlength="500"></textarea></div>' +
      '<div class="sum"><div class="t"><span>الإجمالي</span><span>' + money(t.total) + '</span></div></div>' +
      '<div class="note">💳 الدفع عبر <b>شام كاش</b>. بعد ما تبعت الطلب منبعتلك تفاصيل التحويل وأجور الشحن على واتساب.</div>' +
      '<button class="btn wa block" type="submit">تأكيد الطلب وإرساله على واتساب</button></form>', function (b) {
        $('#of', b).onsubmit = function (e) {
          e.preventDefault(); var f = e.target, btn = f.querySelector('button'); btn.disabled = true;
          var d = { name: f.name.value.trim(), phone: f.phone.value.trim(), city: f.city.value, address: f.address.value.trim() };
          store('gms-me', d);
          G.rpc('supply_place_order', { p_name: d.name, p_phone: d.phone, p_city: d.city, p_address: d.address, p_notes: f.notes.value.trim(),
            p_items: cart.map(function (l) { return { id: l.id, qty: l.qty, option: l.option }; }), p_code: code ? code.code : null })
            .then(function (o) { done(o, d, f.notes.value.trim()); })
            .catch(function (er) { btn.disabled = false; G.toast(G.errText(er)); });
        };
      });
  }

  function done(o, d, notes) {
    var msg = 'طلب جديد من متجر GM Supply 🛒\nرقم الطلب: #' + o.id + '\n\n' +
      o.items.map(function (l) { return '• ' + l.name + (l.option ? ' (' + l.option + ')' : '') + ' × ' + l.qty + ' = ' + money(l.price * l.qty); }).join('\n') +
      '\n\nالمجموع: ' + money(o.subtotal) + (o.pct ? '\nخصم ' + o.pct + '% (كود ' + o.code + '): −' + money(o.discount) : '') +
      '\nالإجمالي: ' + money(o.total) + '\n\nالاسم: ' + d.name + '\nالرقم: ' + d.phone + '\nالمحافظة: ' + d.city + (d.address ? '\nالعنوان: ' + d.address : '') + (notes ? '\nملاحظات: ' + notes : '') +
      '\n\nطريقة الدفع: شام كاش';
    var wa = 'https://wa.me/' + CFG.whatsapp + '?text=' + encodeURIComponent(msg);
    cart = []; saveCart();
    G.sheet('<div class="done"><div class="big">✅</div><h2>انحفظ طلبك رقم #' + o.id + '</h2><p style="color:var(--muted)">آخر خطوة: ابعت الطلب على واتساب لنأكدلك الشحن وتفاصيل الدفع بشام كاش.</p>' +
      (CFG.shamcash ? '<div class="note">حساب شام كاش: <b dir="ltr">' + esc(CFG.shamcash) + '</b></div>' : '') +
      '<a class="btn wa block" href="' + wa + '" target="_blank" rel="noopener">إرسال الطلب على واتساب</a></div>');
    setTimeout(function () { location.href = wa; }, 900);
  }

  badge();
})();
