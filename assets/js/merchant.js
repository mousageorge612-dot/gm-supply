/* سبلاي | Forma Supply — merchant dashboard. Every read/write is scoped to the merchant's own store by the server (RLS). */
(function () {
  'use strict';
  var F = window.FS, $ = F.$, $$ = F.$$, esc = F.esc;
  var s = new F.Session('fs-merchant');
  var app = $('#app');
  var M = { seller: null, cats: [], products: [], orders: [], requests: [], tab: 'orders', ofilter: 'open', poll: null, lastIds: null };

  /* ---------- auth ---------- */
  function loginView(msg) {
    $('#logout').hidden = true;
    app.innerHTML = '<div class="login"><h1 style="font-size:22px;margin-bottom:6px">لوحة التاجر</h1>' +
      '<p class="muted" style="margin-top:0">ادخل لتدير متجرك ومنتجاتك وطلباتك.</p>' + (msg ? '<div class="note ok">' + msg + '</div>' : '') +
      '<form id="lf" class="panel"><div class="field"><label for="lu">اسم المستخدم (رابط متجرك)</label><input class="inp ltr" id="lu" autocomplete="username" autocapitalize="none" required></div>' +
      '<div class="field"><label for="lp">كلمة السر</label><input class="inp ltr" id="lp" type="password" autocomplete="current-password" required></div>' +
      '<div class="err" id="le" role="alert"></div><button class="btn block" type="submit">دخول</button></form>' +
      '<div class="panel"><h3>ما عندك متجر على سبلاي؟</h3><p class="small muted" style="margin-top:0">التسجيل مجاني. بتجهّز متجرك فوراً، وبينعرض للزبائن بعد موافقة الإدارة.</p>' +
      '<button class="btn dark block" id="toReg" type="button">سجّل متجرك</button></div></div>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault(); $('#le').textContent = '';
      s.login($('#lu').value, $('#lp').value, [F.DOMAINS.merchant]).then(start).catch(function (x) { $('#le').textContent = F.errText(x); });
    };
    $('#toReg').onclick = registerView;
  }
  function registerView() {
    app.innerHTML = '<div class="login"><h1 style="font-size:22px;margin-bottom:6px">سجّل متجرك</h1>' +
      '<form id="rf" class="panel" novalidate>' +
      '<div class="field"><label for="rName">اسم المتجر</label><input class="inp" id="rName" required placeholder="مثلاً: عالم الحديد"></div>' +
      '<div class="field"><label for="rSlug">رابط متجرك (أحرف إنكليزية)</label><input class="inp ltr" id="rSlug" autocapitalize="none" placeholder="iron-world" required>' +
        '<span class="hint">بيصير رابطك: <span class="ltr num" id="rPrev">/s/…</span> · وهو نفسه اسم المستخدم للدخول</span></div>' +
      '<div class="field"><label for="rOwner">اسمك</label><input class="inp" id="rOwner" required></div>' +
      '<div class="field"><label for="rWa">رقم واتساب المتجر</label><input class="inp ltr" id="rWa" type="tel" inputmode="tel" placeholder="09xx xxx xxx" required><span class="hint">الطلبات بتوصلك عاللوحة، والزبون بيقدر يبعتلك تفاصيلها على هالرقم.</span></div>' +
      '<div class="row2"><div class="field"><label for="rGov">المحافظة</label><select class="inp" id="rGov"><option value="">اختار</option>' + F.GOVS.map(function (g) { return '<option>' + g + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="rCity">المدينة</label><input class="inp" id="rCity"></div></div>' +
      '<div class="field"><label for="rPass">كلمة السر</label><input class="inp ltr" id="rPass" type="password" autocomplete="new-password" required><span class="hint">8 أحرف عالأقل</span></div>' +
      '<div class="err" id="rErr" role="alert"></div><button class="btn block" type="submit">إنشاء المتجر</button>' +
      '<button class="btn ghost block" type="button" id="toLogin" style="margin-top:8px">عندي حساب، بدي أدخل</button></form></div>';
    $('#rSlug').oninput = function () { var v = $('#rSlug').value.toLowerCase().replace(/[^a-z0-9-]/g, ''); $('#rSlug').value = v; $('#rPrev').textContent = location.origin + '/s/' + (v || '…'); };
    $('#toLogin').onclick = function () { loginView(); };
    $('#rf').onsubmit = function (e) {
      e.preventDefault();
      var body = { action: 'register', store_name: $('#rName').value.trim(), username: $('#rSlug').value.trim(), owner_name: $('#rOwner').value.trim(),
        whatsapp: $('#rWa').value.trim(), governorate: $('#rGov').value, city: $('#rCity').value.trim(), password: $('#rPass').value };
      if (!body.store_name || !body.owner_name) { $('#rErr').textContent = F.errText('missing_fields'); return; }
      if (!/^[a-z0-9][a-z0-9-]{2,30}$/.test(body.username)) { $('#rErr').textContent = F.errText('bad_username'); return; }
      if (!body.governorate) { $('#rErr').textContent = F.errText('bad_governorate'); return; }
      if (body.password.length < 8) { $('#rErr').textContent = F.errText('weak_password'); return; }
      var btn = $('#rf button[type=submit]'); btn.disabled = true; btn.textContent = 'عم ننشئ المتجر…';
      F.fn('fs-auth', body).then(function () { return s.login(body.username, body.password, [F.DOMAINS.merchant]); }).then(start)
        .catch(function (x) { btn.disabled = false; btn.textContent = 'إنشاء المتجر'; $('#rErr').textContent = F.errText(x); });
    };
  }

  /* ---------- boot ---------- */
  function start() {
    $('#logout').hidden = false;
    return Promise.all([s.rest('fs_sellers', 'select=*&owner_id=eq.' + s.a.uid), s.rest('fs_categories', 'select=*&order=sort'), F.rpc('fs_rate').catch(function () { return null; })]).then(function (r) {
      F.rate = Number(r[2]) || null;
      if (!r[0].length) {
        app.innerHTML = '<div class="login"><div class="note warn">هالحساب مو حساب تاجر. إذا إنت من فريق الدعم أو الإدارة ادخل من <a href="/admin/">لوحة الإدارة</a>.</div></div>';
        return;
      }
      M.seller = r[0][0]; M.cats = r[1];
      if (!M.seller.onboarding_choice) return onboarding();
      shell();
    }).catch(function (x) { if (x.message === 'no_session' || x.status === 401) { s.clear(); loginView(); } else app.innerHTML = '<div class="note bad">' + esc(F.errText(x)) + '</div>'; });
  }
  function storeUrl() { return location.origin + '/s/' + M.seller.slug; }
  function linkBox() {
    return '<div class="linkbox"><code>' + esc(storeUrl()) + '</code><button class="btn sm" type="button" id="copyLink">نسخ رابط متجري</button></div>';
  }
  function bindCopy(root) {
    var b = $('#copyLink', root || document); if (!b) return;
    b.onclick = function () { F.copy(storeUrl()).then(function () { F.toast('انسخ الرابط. حطّه ببايو إنستغرام'); }); };
  }

  function onboarding() {
    app.innerHTML = '<div style="padding:16px 0 40px"><h1 style="font-size:22px">أهلاً ' + esc(M.seller.owner_name || '') + ' 👋</h1>' +
      '<p class="muted">متجر <b>' + esc(M.seller.name) + '</b> انعمل. كيف بدك تضيف منتجاتك؟</p>' +
      (M.seller.status !== 'approved' ? '<div class="note warn">متجرك بانتظار موافقة الإدارة. جهّز منتجاتك هلق، وبتنعرض للزبائن بعد التفعيل.</div>' : '') +
      '<div class="choices"><button class="choice" type="button" data-ch="self"><b>بضيف منتجاتي بنفسي</b><span>صوّر المنتج، حط السعر والقياسات والكمية، وانشر. بياخد دقيقتين للمنتج.</span></button>' +
      '<button class="choice" type="button" data-ch="assisted"><b>بدي مساعدة بإضافة منتجاتي</b><span>ابعتلنا صور منتجاتك أو قائمة أسعارك من موبايلك، وفريق الدعم بيجهّزها وبيبعتلك ياها لتوافق عليها قبل النشر.</span></button></div>' +
      '<div class="lbl">رابط متجرك</div>' + linkBox() + '</div>';
    bindCopy();
    $$('[data-ch]').forEach(function (b) {
      b.onclick = function () {
        var ch = b.dataset.ch;
        s.rest('fs_sellers', 'id=eq.' + M.seller.id, { method: 'PATCH', body: { onboarding_choice: ch } }).then(function () {
          M.seller.onboarding_choice = ch;
          M.tab = ch === 'self' ? 'products' : 'help';
          shell(); if (ch === 'self') newProduct(); else helpForm();
        }).catch(function (x) { F.toast(F.errText(x)); });
      };
    });
  }

  /* ---------- shell ---------- */
  function shell() {
    app.innerHTML = '<div class="dash-top"><div><h1 style="font-size:19px" dir="auto">' + esc(M.seller.name) + '</h1>' +
      '<span class="pill ' + (M.seller.status === 'approved' ? 'ok' : 'new') + '">' + F.SSTATUS[M.seller.status] + '</span>' + (M.seller.is_demo ? ' <span class="pill bad">متجر تجريبي</span>' : '') + '</div></div>' +
      (M.seller.status === 'pending' ? '<div class="note warn">متجرك بانتظار موافقة الإدارة. فيك تجهّز منتجاتك هلق، وبتنعرض للزبائن بعد التفعيل.</div>' : '') +
      (M.seller.status === 'suspended' ? '<div class="note bad">متجرك موقوف حالياً ومو ظاهر للزبائن. تواصل مع دعم سبلاي.</div>' : '') +
      linkBox() +
      '<nav class="tabs" style="margin-top:12px" id="tabs">' +
        [['orders', 'الطلبات'], ['products', 'المنتجات'], ['help', 'المساعدة'], ['statement', 'التسوية'], ['store', 'إعدادات المتجر']].map(function (t) {
          return '<button class="tab' + (M.tab === t[0] ? ' on' : '') + '" type="button" data-t="' + t[0] + '">' + t[1] + '<span id="dot-' + t[0] + '"></span></button>';
        }).join('') + '</nav><div id="view"></div>';
    bindCopy();
    $('#tabs').onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { M.tab = b.dataset.t; $$('.tab').forEach(function (x) { x.classList.toggle('on', x === b); }); show(); } };
    show();
    clearInterval(M.poll); M.poll = setInterval(pollOrders, 30000); pollOrders(true);
  }
  function show() {
    var v = $('#view'); v.innerHTML = '<div class="empty">عم نحمّل…</div>';
    ({ orders: ordersView, products: productsView, help: helpView, statement: statementView, store: storeView })[M.tab]();
  }

  /* ---------- orders ---------- */
  function pollOrders(first) {
    s.rest('fs_orders', 'select=id,seen_by_seller,number&order=id.desc&limit=200').then(function (r) {
      var unseen = r.filter(function (o) { return !o.seen_by_seller; }).length;
      var dot = $('#dot-orders'); if (dot) dot.innerHTML = unseen ? '<span class="dot">' + unseen + '</span>' : '';
      var ids = r.map(function (o) { return o.id; });
      if (!first && M.lastIds && ids.some(function (id) { return M.lastIds.indexOf(id) < 0; })) {
        F.toast('وصلك طلب جديد'); if (M.tab === 'orders') ordersView();
      }
      M.lastIds = ids;
    }).catch(function () {});
    s.rest('fs_products', 'select=id&status=eq.pending_merchant').then(function (r) {
      var dot = $('#dot-products'); if (dot) dot.innerHTML = r.length ? '<span class="dot">' + r.length + '</span>' : '';
    }).catch(function () {});
  }
  function ordersView() {
    s.rest('fs_orders', 'select=*,fs_order_items(*)&order=id.desc&limit=200').then(function (r) {
      M.orders = r;
      var open = r.filter(function (o) { return ['new', 'confirmed', 'shipping'].indexOf(o.status) >= 0; });
      var list = M.ofilter === 'open' ? open : r;
      $('#view').innerHTML = '<div class="chips" style="padding-top:0"><button class="chip' + (M.ofilter === 'open' ? ' on' : '') + '" data-of="open" type="button">قيد التنفيذ (' + open.length + ')</button>' +
        '<button class="chip' + (M.ofilter === 'all' ? ' on' : '') + '" data-of="all" type="button">كل الطلبات (' + r.length + ')</button></div>' +
        (list.length ? list.map(orderCard).join('') : '<div class="empty">' + (r.length ? 'ما في طلبات مفتوحة.' : 'ما وصلك طلبات بعد. شارك رابط متجرك لتبلّش.') + '</div>');
      $$('[data-of]').forEach(function (b) { b.onclick = function () { M.ofilter = b.dataset.of; ordersView(); }; });
      $$('[data-act]').forEach(function (b) { b.onclick = function () { orderAction(+b.dataset.o, b.dataset.act); }; });
      var unseen = r.filter(function (o) { return !o.seen_by_seller; }).map(function (o) { return o.id; });
      if (unseen.length) s.rpc('fs_orders_mark_seen', { p_ids: unseen }).then(function () { var d = $('#dot-orders'); if (d) d.innerHTML = ''; }).catch(function () {});
    }).catch(function (x) { $('#view').innerHTML = '<div class="note bad">' + esc(F.errText(x)) + '</div>'; });
  }
  function orderCard(o) {
    var items = (o.fs_order_items || []).sort(function (a, b) { return a.id - b.id; });
    var next = F.NEXT[o.status] || [];
    var label = { confirmed: 'تأكيد الطلب', shipping: 'انشحن', delivered: 'تم التسليم', cancelled: 'إلغاء', returned: 'مرتجع كامل' };
    return '<div class="order' + (o.seen_by_seller ? '' : ' unseen') + '"><div class="hd"><b>' + F.ltr(o.number) + '</b><span class="pill ' + o.status + '">' + F.STATUS[o.status] + '</span></div>' +
      '<div class="small muted">' + F.date(o.created_at) + ' · ' + F.SOURCE[o.source] + ' · عمولة <span class="num">' + Number(o.commission_rate) + '%</span></div>' +
      items.map(function (i) {
        return '<div class="small" style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><span dir="auto">' + esc(i.name) + (i.variant_label !== 'قياس واحد' ? ' (' + esc(i.variant_label) + ')' : '') + ' × <span class="num">' + i.qty + '</span>' +
          (i.returned_qty ? ' <span class="pill bad">مرتجع ' + i.returned_qty + '</span>' : '') + '</span><span>' + F.syp(i.unit_price * i.qty, o.usd_rate || 0) + '</span></div>';
      }).join('') +
      '<div class="sum" style="margin:8px 0"><div class="r small"><span>المنتجات</span><span>' + F.syp(o.subtotal, o.usd_rate || 0) + '</span></div>' +
      '<div class="r small"><span>الشحن</span><span>' + (o.delivery_method === 'pickup' ? 'استلام من ' + esc(o.pickup_branch) : (o.shipping_fee == null ? 'غير محدد (' + esc(o.shipping_company) + ')' : F.syp(o.shipping_fee, o.usd_rate || 0) + ' · ' + esc(o.shipping_company))) + '</span></div>' +
      '<div class="r"><b>' + (o.shipping_fee == null ? 'المجموع بدون الشحن' : 'المجموع') + '</b><b>' + F.syp(o.total, o.usd_rate || 0) + '</b></div>' +
      (o.status === 'delivered' || o.status === 'returned' ? '<div class="r small muted"><span>عمولة سبلاي</span><span>' + F.syp(o.commission_amount, o.usd_rate || 0) + '</span></div>' : '') + '</div>' +
      '<dl class="kv"><dt>الزبون</dt><dd>' + esc(o.customer_name) + '</dd><dt>الموبايل</dt><dd><a href="tel:' + esc(o.phone) + '">' + F.ltr(o.phone) + '</a></dd>' +
      '<dt>المحافظة</dt><dd>' + esc(o.governorate) + (o.city ? '، ' + esc(o.city) : '') + '</dd>' + (o.address ? '<dt>العنوان</dt><dd>' + esc(o.address) + '</dd>' : '') +
      (o.notes ? '<dt>ملاحظات</dt><dd>' + esc(o.notes) + '</dd>' : '') + (o.delivery_evidence ? '<dt>إثبات التسليم</dt><dd>' + esc(o.delivery_evidence) + '</dd>' : '') + '</dl>' +
      '<div class="btnrow">' + next.map(function (n) {
        return '<button class="btn sm ' + (n === 'cancelled' || n === 'returned' ? 'danger' : (n === 'delivered' ? '' : 'dark')) + '" type="button" data-o="' + o.id + '" data-act="' + n + '">' + label[n] + '</button>';
      }).join('') + (o.status === 'delivered' ? '<button class="btn sm ghost" type="button" data-o="' + o.id + '" data-act="partial">مرتجع جزئي</button>' : '') +
      '<a class="btn sm wa" target="_blank" rel="noopener" href="' + F.waLink(o.phone, 'مرحبا ' + o.customer_name.split(' ')[0] + '، معك ' + M.seller.name + ' بخصوص طلبك ' + o.number + ' على سبلاي.') + '">واتساب الزبون</a></div></div>';
  }
  function orderAction(id, act) {
    var o = M.orders.filter(function (x) { return x.id === id; })[0]; if (!o) return;
    if (act === 'delivered') {
      F.sheet('<h2>تأكيد التسليم · ' + F.ltr(o.number) + '</h2><p class="small muted">سجّل إثبات التسليم. العمولة بتنحسب على المنتجات المسلّمة بدون الشحن.</p>' +
        '<div class="field"><label for="evT">رقم إيصال الشحن أو وصف الإثبات</label><input class="inp" id="evT" placeholder="مثلاً: إيصال القدموس 55821، استلمها الزبون بإيده"></div>' +
        '<div class="field"><label for="evF">صورة الإيصال (اختياري)</label><input class="inp" id="evF" type="file" accept="image/*"></div>' +
        '<div class="err" id="evE"></div><button class="btn block" id="evB" type="button">تأكيد التسليم</button>',
        function (b) {
          $('#evB', b).onclick = function () {
            var t = $('#evT', b).value.trim(), f = $('#evF', b).files[0];
            if (!t && !f) { $('#evE', b).textContent = F.errText('evidence_required'); return; }
            $('#evB', b).disabled = true;
            var up = f ? F.shrink(f, 1400).then(function (bl) { return s.upload('fs-private', 's' + M.seller.id + '/evidence/' + o.number + '-' + Date.now() + '.webp', bl); }) : Promise.resolve(null);
            up.then(function (path) { return s.rpc('fs_order_set_status', { p_order: id, p_status: 'delivered', p_evidence: t || null, p_evidence_file: path }); })
              .then(function () { F.closeSheet(); F.toast('انسجّل التسليم'); ordersView(); })
              .catch(function (x) { $('#evB', b).disabled = false; $('#evE', b).textContent = F.errText(x); });
          };
        });
      return;
    }
    if (act === 'partial') {
      var items = (o.fs_order_items || []).filter(function (i) { return i.qty > i.returned_qty; });
      F.sheet('<h2>مرتجع جزئي · ' + F.ltr(o.number) + '</h2><p class="small muted">حدّد الكمية اللي رجعت. العمولة بتتعدّل تلقائياً بالتسوية.</p>' +
        items.map(function (i) { return '<div class="field"><label dir="auto">' + esc(i.name) + (i.variant_label !== 'قياس واحد' ? ' (' + esc(i.variant_label) + ')' : '') + ' · مسلّم ' + (i.qty - i.returned_qty) + '</label><input class="inp ltr" inputmode="numeric" data-ri="' + i.id + '" value="0"></div>'; }).join('') +
        '<div class="field"><label for="rtN">سبب المرتجع</label><input class="inp" id="rtN"></div><div class="err" id="rtE"></div><button class="btn block" id="rtB" type="button">تسجيل المرتجع</button>',
        function (b) {
          $('#rtB', b).onclick = function () {
            var arr = $$('[data-ri]', b).map(function (x) { return { item_id: +x.dataset.ri, qty: Number(x.value.replace(/\D/g, '') || 0) }; }).filter(function (x) { return x.qty > 0; });
            if (!arr.length) { $('#rtE', b).textContent = F.errText('nothing_returned'); return; }
            s.rpc('fs_order_return_items', { p_order: id, p_items: arr, p_note: $('#rtN', b).value.trim() || null })
              .then(function () { F.closeSheet(); F.toast('انسجّل المرتجع وتعدّلت العمولة'); ordersView(); })
              .catch(function (x) { $('#rtE', b).textContent = F.errText(x); });
          };
        });
      return;
    }
    var ask = { cancelled: 'أكيد بدك تلغي الطلب؟ الكميات بترجع للمخزون.', returned: 'تسجيل مرتجع كامل؟ العمولة بتنعكس بالتسوية والكميات بترجع للمخزون.' }[act];
    if (ask) {
      F.sheet('<h2>' + F.STATUS[act] + ' · ' + F.ltr(o.number) + '</h2><p>' + ask + '</p><div class="field"><label for="cN">ملاحظة (اختياري)</label><input class="inp" id="cN"></div>' +
        '<div class="err" id="cE"></div><div class="btnrow"><button class="btn danger" id="cY" type="button">نعم</button><button class="btn ghost" data-close type="button">رجوع</button></div>',
        function (b) {
          $('#cY', b).onclick = function () {
            s.rpc('fs_order_set_status', { p_order: id, p_status: act, p_note: $('#cN', b).value.trim() || null })
              .then(function () { F.closeSheet(); ordersView(); }).catch(function (x) { $('#cE', b).textContent = F.errText(x); });
          };
        });
      return;
    }
    s.rpc('fs_order_set_status', { p_order: id, p_status: act }).then(function () { F.toast('صار ' + F.STATUS[act]); ordersView(); })
      .catch(function (x) { F.toast(F.errText(x)); });
  }

  /* ---------- products ---------- */
  function catName(slug) { var c = M.cats.filter(function (x) { return x.slug === slug; })[0]; return c ? c.name_ar : slug; }
  function catKind(slug) { var c = M.cats.filter(function (x) { return x.slug === slug; })[0]; return c ? c.kind : 'equipment'; }
  function productsView() {
    s.rest('fs_products', 'select=*,fs_variants(*)&order=updated_at.desc').then(function (r) {
      M.products = r;
      var pending = r.filter(function (p) { return p.status === 'pending_merchant'; }), rest = r.filter(function (p) { return p.status !== 'pending_merchant'; });
      $('#view').innerHTML = '<div class="btnrow" style="margin-bottom:12px"><button class="btn" id="npBtn" type="button">+ منتج جديد</button><button class="btn ghost" id="hpBtn" type="button">بدي مساعدة بإضافة منتجات</button></div>' +
        (pending.length ? '<div class="panel" style="border-color:var(--gold)"><h3>منتجات جهّزها الدعم وبانتظار موافقتك (' + pending.length + ')</h3>' + pending.map(prodItem).join('') + '</div>' : '') +
        '<div class="panel"><h3>منتجاتك (' + rest.length + ')</h3>' + (rest.length ? '<div class="list">' + rest.map(prodItem).join('') + '</div>' : '<div class="empty">ما في منتجات بعد.</div>') + '</div>';
      $('#npBtn').onclick = newProduct; $('#hpBtn').onclick = function () { M.tab = 'help'; $$('.tab').forEach(function (x) { x.classList.toggle('on', x.dataset.t === 'help'); }); show(); helpForm(); };
      $$('[data-ed]').forEach(function (b) { b.onclick = function () { editProduct(+b.dataset.ed); }; });
      $$('[data-ok]').forEach(function (b) { b.onclick = function () { approveDraft(+b.dataset.ok); }; });
      $$('[data-chg]').forEach(function (b) { b.onclick = function () { requestChanges(+b.dataset.chg); }; });
      $$('[data-tog]').forEach(function (b) { b.onclick = function () { toggleProduct(+b.dataset.tog); }; });
    }).catch(function (x) { $('#view').innerHTML = '<div class="note bad">' + esc(F.errText(x)) + '</div>'; });
  }
  function prodItem(p) {
    var vars = (p.fs_variants || []), stock = vars.reduce(function (a, v) { return a + v.stock; }, 0);
    var supp = catKind(p.category) === 'supplement';
    var state = p.status === 'published' ? (p.blocked ? '<span class="pill bad">مخفي من الإدارة</span>' : (supp && !p.supplement_approved ? '<span class="pill new">مكمّل: بانتظار مراجعة الإدارة</span>' : (M.seller.status === 'approved' ? '<span class="pill ok">منشور</span>' : '<span class="pill new">منشور، بيظهر بعد تفعيل المتجر</span>'))) : '<span class="pill ' + (p.status === 'pending_merchant' ? 'info' : '') + '">' + F.PSTATUS[p.status] + '</span>';
    return '<div class="item"><div class="im">' + (p.images[0] ? '<img src="' + esc(F.media(p.images[0])) + '" alt="" loading="lazy">' : '') + '</div><div>' +
      '<h4 dir="auto">' + esc(p.name_ar) + '</h4><div class="small muted">' + esc(catName(p.category)) + ' · ' + (p.price_syp > 0 ? F.syp(p.price_syp) : 'بدون سعر') + ' · مخزون <span class="num">' + stock + '</span></div>' +
      '<div style="margin:4px 0">' + state + '</div>' + (p.moderation_note ? '<div class="small" style="color:var(--bad)">' + esc(p.moderation_note) + '</div>' : '') +
      '<div class="btnrow" style="margin-top:6px">' +
      (p.status === 'pending_merchant' ? '<button class="btn sm" type="button" data-ok="' + p.id + '">موافقة ونشر</button><button class="btn sm ghost" type="button" data-ed="' + p.id + '">مراجعة وتعديل</button><button class="btn sm ghost" type="button" data-chg="' + p.id + '">اطلب تعديل</button>'
        : '<button class="btn sm ghost" type="button" data-ed="' + p.id + '">تعديل السعر والمخزون</button><button class="btn sm ghost" type="button" data-tog="' + p.id + '">' + (p.status === 'published' ? 'إخفاء' : 'نشر') + '</button>') +
      '</div></div></div>';
  }
  function newProduct() { F.editProduct({ s: s, seller: M.seller, product: null, mode: 'merchant', categories: M.cats, onSaved: productsView }); }
  function editProduct(id) { var p = M.products.filter(function (x) { return x.id === id; })[0]; F.editProduct({ s: s, seller: M.seller, product: p, mode: 'merchant', categories: M.cats, onSaved: productsView }); }
  function approveDraft(id) {
    var p = M.products.filter(function (x) { return x.id === id; })[0];
    if (!(p.price_syp > 0) || !p.images.length) { F.toast('ناقصه سعر أو صورة، افتحه وكمّله'); editProduct(id); return; }
    s.rest('fs_products', 'id=eq.' + id, { method: 'PATCH', body: { status: 'published' } }).then(function () {
      F.toast('وافقت وانتشر المنتج');
      if (p.assisted_request_id) closeRequestIfDone(p.assisted_request_id);
      productsView(); pollOrders(true);
    }).catch(function (x) { F.toast(F.errText(x)); });
  }
  function closeRequestIfDone(rid) {
    s.rest('fs_products', 'select=id&status=eq.pending_merchant&assisted_request_id=eq.' + rid).then(function (r) {
      if (!r.length) return s.rest('fs_support_requests', 'id=eq.' + rid, { method: 'PATCH', body: { status: 'closed', merchant_reply: 'وافقت على المنتجات ✓' } });
    }).catch(function () {});
  }
  function requestChanges(id) {
    var p = M.products.filter(function (x) { return x.id === id; })[0];
    F.sheet('<h2>اطلب تعديل</h2><p class="small muted">اكتب للدعم شو بدك يتغيّر بـ «' + esc(p.name_ar) + '».</p><div class="field"><textarea class="inp" id="rcT"></textarea></div><button class="btn block" id="rcB" type="button">إرسال</button>',
      function (b) {
        $('#rcB', b).onclick = function () {
          var t = $('#rcT', b).value.trim(); if (!t) return;
          var job = p.assisted_request_id
            ? s.rest('fs_support_requests', 'id=eq.' + p.assisted_request_id, { method: 'PATCH', body: { status: 'in_progress', merchant_reply: '«' + p.name_ar + '»: ' + t } })
            : s.rest('fs_support_requests', '', { method: 'POST', body: { seller_id: M.seller.id, kind: 'other', note: 'تعديل على «' + p.name_ar + '»: ' + t } });
          job.then(function () { F.closeSheet(); F.toast('انبعت للدعم'); }).catch(function (x) { F.toast(F.errText(x)); });
        };
      });
  }
  function toggleProduct(id) {
    var p = M.products.filter(function (x) { return x.id === id; })[0];
    var to = p.status === 'published' ? 'archived' : 'published';
    if (to === 'published' && (!(p.price_syp > 0) || !p.images.length)) { F.toast('ناقصه سعر أو صورة'); editProduct(id); return; }
    s.rest('fs_products', 'id=eq.' + id, { method: 'PATCH', body: { status: to } }).then(productsView).catch(function (x) { F.toast(F.errText(x)); });
  }

  /* ---------- assisted listing requests ---------- */
  function helpView() {
    s.rest('fs_support_requests', 'select=*&order=id.desc').then(function (r) {
      M.requests = r;
      $('#view').innerHTML = '<div class="panel"><h3>بدي مساعدة بإضافة منتجاتي</h3><p class="small muted" style="margin-top:0">ابعت صور منتجاتك أو قائمة أسعارك. فريق الدعم بيجهّز المنتجات كمسودات لمتجرك، وبتوصلك هون وبتبويب المنتجات لتوافق عليها. ما منحتاج كلمة سرّك.</p>' +
        '<button class="btn block" id="newReq" type="button">طلب مساعدة جديد</button></div>' +
        '<div class="panel"><h3>طلباتك</h3>' + (r.length ? r.map(function (q) {
          return '<div style="border-bottom:1px solid var(--line);padding:8px 0"><div class="hd" style="display:flex;justify-content:space-between"><b>طلب #<span class="num">' + q.id + '</span></b><span class="pill ' + (q.status === 'waiting_merchant' ? 'info' : (q.status === 'closed' || q.status === 'done' ? 'ok' : 'new')) + '">' + F.RSTATUS[q.status] + '</span></div>' +
            '<div class="small muted">' + F.date(q.created_at) + ' · ' + q.files.length + ' ملف</div>' + (q.note ? '<div class="small" dir="auto">' + esc(q.note) + '</div>' : '') +
            (q.staff_note ? '<div class="note info small">الدعم: ' + esc(q.staff_note) + '</div>' : '') +
            (q.status === 'waiting_merchant' ? '<button class="btn sm" type="button" data-goprod>راجع المنتجات ووافق</button>' : '') + '</div>';
        }).join('') : '<div class="empty">ما في طلبات.</div>') + '</div>';
      $('#newReq').onclick = helpForm;
      $$('[data-goprod]').forEach(function (b) { b.onclick = function () { M.tab = 'products'; $$('.tab').forEach(function (x) { x.classList.toggle('on', x.dataset.t === 'products'); }); show(); }; });
    }).catch(function (x) { $('#view').innerHTML = '<div class="note bad">' + esc(F.errText(x)) + '</div>'; });
  }
  function helpForm() {
    F.sheet('<h2>طلب مساعدة بإضافة منتجات</h2>' +
      '<div class="field"><label for="hF">صور المنتجات أو قائمة الأسعار</label><input class="inp" id="hF" type="file" multiple accept="image/*,.pdf,.xlsx,.xls,.csv,.txt,.doc,.docx"><span class="hint">لحد 10 ملفات. الصور بتتصغّر تلقائياً.</span></div>' +
      '<div class="field"><label for="hN">ملاحظة للدعم</label><textarea class="inp" id="hN" placeholder="مثلاً: الأحزمة عندي بالقياسات S و M و L، السعر 350 ألف"></textarea></div>' +
      '<div class="err" id="hE"></div><button class="btn block" id="hB" type="button">إرسال الطلب</button>',
      function (b) {
        $('#hB', b).onclick = function () {
          var files = Array.prototype.slice.call($('#hF', b).files || []).slice(0, 10), note = $('#hN', b).value.trim();
          if (!files.length && !note) { $('#hE', b).textContent = 'ضيف صورة أو ملف أو ملاحظة'; return; }
          $('#hB', b).disabled = true; $('#hB', b).textContent = 'عم نرفع…';
          Promise.all(files.map(function (f, i) {
            var base = 's' + M.seller.id + '/req/' + Date.now() + '-' + i;
            if (/^image\//.test(f.type)) return F.shrink(f, 1600).then(function (bl) { return s.upload('fs-private', base + '.webp', bl); });
            var ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
            return s.upload('fs-private', base + '.' + ext, f);
          })).then(function (paths) {
            return s.rest('fs_support_requests', '', { method: 'POST', body: { seller_id: M.seller.id, kind: 'assisted_listing', note: note || null, files: paths } });
          }).then(function () { F.closeSheet(); F.toast('وصل طلبك لفريق الدعم'); M.tab = 'help'; $$('.tab').forEach(function (x) { x.classList.toggle('on', x.dataset.t === 'help'); }); show(); })
            .catch(function (x) { $('#hB', b).disabled = false; $('#hB', b).textContent = 'إرسال الطلب'; $('#hE', b).textContent = F.errText(x); });
        };
      });
  }

  /* ---------- weekly settlement statement ---------- */
  function statementView() {
    s.rpc('fs_statement', {}).then(function (weeks) {
      $('#view').innerHTML = '<div class="note info small">عمولة سبلاي بتنحسب على المنتجات <b>المسلّمة</b> بعد الخصم وبدون الشحن: <b>3%</b> إذا الزبون اشترى من رابط متجرك، و<b>7%</b> إذا جابه السوق. الملغى والمرتجع الكامل بلا عمولة، والمرتجع الجزئي بينطرح.</div>' +
        (weeks.length ? weeks.map(function (w) {
          return '<div class="panel"><div class="dash-top" style="padding:0 0 6px"><h3 style="margin:0">أسبوع ' + F.day(w.week_start) + '</h3>' + (w.paid ? '<span class="pill ok">تمت التسوية</span>' : '<span class="pill new">مفتوح</span>') + '</div>' +
            '<div class="stats"><div class="stat"><b>' + w.delivered_orders + '</b><span>طلب مسلّم</span></div><div class="stat"><b class="num">' + Math.round(w.net_sales).toLocaleString('en-US') + '</b><span>صافي المبيعات (ل.س)</span></div>' +
            '<div class="stat"><b class="num">' + Math.round(w.commission).toLocaleString('en-US') + '</b><span>العمولة المستحقة (ل.س)</span></div></div>' +
            '<div class="scroll-x"><table class="tbl"><tr><th>الطلب</th><th>الحركة</th><th>المصدر</th><th>الأساس</th><th>العمولة</th></tr>' +
            w.entries.map(function (e) { return '<tr><td>' + F.ltr(e.order_number) + '</td><td>' + F.KIND[e.kind] + '</td><td>' + F.SOURCE[e.source] + ' <span class="ltr num">' + Number(e.rate) + '%</span></td><td><span class="ltr num">' + Math.round(e.base_delta).toLocaleString('en-US') + '</span></td><td><span class="ltr num">' + Math.round(e.amount).toLocaleString('en-US') + '</span></td></tr>'; }).join('') +
            '</table></div>' + (w.paid ? '<p class="small muted">انسوّت ' + F.date(w.paid.paid_at) + (w.paid.note ? ' · ' + esc(w.paid.note) : '') + '</p>' : '') + '</div>';
        }).join('') : '<div class="empty">ما في حركات بعد. العمولة بتظهر هون لما تسجّل أول طلب «تم التسليم».</div>');
    }).catch(function (x) { $('#view').innerHTML = '<div class="note bad">' + esc(F.errText(x)) + '</div>'; });
  }

  /* ---------- store settings ---------- */
  function storeView() {
    var st = M.seller, ships = (st.shipping_options || []).slice(), br = (st.pickup_branches || []).slice();
    function shipRows() {
      return ships.map(function (o, i) { return '<div class="varrow" style="grid-template-columns:1.4fr 1fr 36px" data-si="' + i + '"><input class="inp" data-k="name" value="' + esc(o.name) + '" placeholder="اسم الشركة"><input class="inp ltr" data-k="fee" inputmode="numeric" value="' + (o.fee == null ? '' : o.fee) + '" placeholder="غير محدد"><button type="button" data-sd="' + i + '">✕</button></div>'; }).join('');
    }
    function brRows() { return br.map(function (x, i) { return '<div class="varrow" style="grid-template-columns:1fr 36px" data-bi="' + i + '"><input class="inp" value="' + esc(x) + '"><button type="button" data-bd="' + i + '">✕</button></div>'; }).join(''); }
    $('#view').innerHTML = '<form id="sf" class="panel" novalidate>' +
      '<div class="field"><label for="sN">اسم المتجر</label><input class="inp" id="sN" value="' + esc(st.name) + '"></div>' +
      '<div class="field"><label for="sB">نبذة قصيرة</label><textarea class="inp" id="sB">' + esc(st.bio || '') + '</textarea></div>' +
      '<div class="field"><label for="sW">واتساب المتجر</label><input class="inp ltr" id="sW" type="tel" value="' + esc(st.whatsapp || '') + '"><span class="hint">هاد رقمك إنت، منفصل عن رقم دعم سبلاي.</span></div>' +
      '<div class="row2"><div class="field"><label for="sG">المحافظة</label><select class="inp" id="sG">' + F.GOVS.map(function (g) { return '<option' + (g === st.governorate ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="sC">المدينة</label><input class="inp" id="sC" value="' + esc(st.city || '') + '"></div></div>' +
      '<div class="lbl">شركات الشحن وأجورها (ل.س)</div><div class="small muted" style="margin-bottom:6px">إذا الأجور بتختلف حسب المنطقة اتركها فاضية، والزبون بيشوف إنها «غير محددة بعد».</div>' +
      '<div id="sShips">' + shipRows() + '</div><button class="btn ghost sm" type="button" id="sAddShip">+ شركة شحن</button>' +
      '<div class="lbl" style="margin-top:12px">فروع الاستلام (اختياري)</div><div id="sBr">' + brRows() + '</div><button class="btn ghost sm" type="button" id="sAddBr">+ فرع</button>' +
      '<div class="err" id="sE" style="margin-top:10px"></div><button class="btn block" type="submit" style="margin-top:12px">حفظ</button></form>';
    function read() {
      ships = $$('[data-si]').map(function (r) { var f = $('[data-k=fee]', r).value.replace(/\D/g, ''); return { name: $('[data-k=name]', r).value.trim(), fee: f === '' ? null : Number(f) }; });
      br = $$('[data-bi] input').map(function (x) { return x.value.trim(); });
    }
    $('#sAddShip').onclick = function () { read(); ships.push({ name: '', fee: null }); $('#sShips').innerHTML = shipRows(); };
    $('#sAddBr').onclick = function () { read(); br.push(''); $('#sBr').innerHTML = brRows(); };
    $('#sShips').onclick = function (e) { var x = e.target.closest('[data-sd]'); if (x) { read(); ships.splice(+x.dataset.sd, 1); $('#sShips').innerHTML = shipRows(); } };
    $('#sBr').onclick = function (e) { var x = e.target.closest('[data-bd]'); if (x) { read(); br.splice(+x.dataset.bd, 1); $('#sBr').innerHTML = brRows(); } };
    $('#sf').onsubmit = function (e) {
      e.preventDefault(); read();
      var body = { name: $('#sN').value.trim(), bio: $('#sB').value.trim() || null, whatsapp: $('#sW').value.replace(/[^\d+]/g, '') || null,
        governorate: $('#sG').value, city: $('#sC').value.trim() || null, shipping_options: ships.filter(function (o) { return o.name; }), pickup_branches: br.filter(Boolean) };
      if (!body.name) { $('#sE').textContent = 'اكتب اسم المتجر'; return; }
      s.rest('fs_sellers', 'id=eq.' + M.seller.id, { method: 'PATCH', body: body, headers: { Prefer: 'return=representation' } })
        .then(function (r) { M.seller = r[0]; F.toast('انحفظت الإعدادات'); }).catch(function (x) { $('#sE').textContent = F.errText(x); });
    };
  }

  $('#logout').onclick = function () { clearInterval(M.poll); s.clear(); loginView(); };
  if (s.a) start(); else loginView();
})();
