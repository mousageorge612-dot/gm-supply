/* سبلاي | Forma Supply — support + platform admin dashboard. Role comes from fs_staff and is enforced on the server. */
(function () {
  'use strict';
  var F = window.FS, $ = F.$, $$ = F.$$, esc = F.esc;
  var s = new F.Session('fs-staff');
  var app = $('#app');
  var A = { role: null, tab: 'support', cats: [], sellers: [], rfilter: 'active', sfilter: 'all', pfilter: 'review', pq: '', ofilter: 'open', oseller: '', settings: null };

  function loginView() {
    $('#logout').hidden = true; $('#who').textContent = 'الدعم والإدارة';
    app.innerHTML = '<div class="login"><h1 style="font-size:22px">دخول فريق سبلاي</h1><p class="muted">للدعم والإدارة فقط. التجار بيدخلوا من <a href="/merchant/">لوحة التاجر</a>.</p>' +
      '<form id="lf" class="panel"><div class="field"><label for="lu">اسم المستخدم</label><input class="inp ltr" id="lu" autocomplete="username" autocapitalize="none" required></div>' +
      '<div class="field"><label for="lp">كلمة السر</label><input class="inp ltr" id="lp" type="password" autocomplete="current-password" required></div>' +
      '<div class="err" id="le"></div><button class="btn block" type="submit">دخول</button></form></div>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault(); $('#le').textContent = '';
      s.login($('#lu').value, $('#lp').value, [F.DOMAINS.staff, '@clients.georgemousa.com']).then(start).catch(function (x) { $('#le').textContent = F.errText(x); });
    };
  }
  function start() {
    return s.rest('fs_staff', 'select=*&user_id=eq.' + s.a.uid).then(function (r) {
      if (!r.length) { app.innerHTML = '<div class="login"><div class="note bad">هالحساب مو من فريق سبلاي.</div></div>'; $('#logout').hidden = false; return; }
      A.role = r[0].role; $('#logout').hidden = false;
      $('#who').textContent = (A.role === 'admin' ? 'إدارة' : 'دعم') + ' · ' + (r[0].name || '');
      return s.rest('fs_categories', 'select=*&order=sort').then(function (c) { A.cats = c; shell(); });
    }).catch(function (x) { if (x.message === 'no_session' || x.status === 401) { s.clear(); loginView(); } else app.innerHTML = '<div class="note bad">' + esc(F.errText(x)) + '</div>'; });
  }
  function tabs() {
    return A.role === 'admin'
      ? [['support', 'طلبات المساعدة'], ['sellers', 'التجار'], ['products', 'المنتجات'], ['orders', 'الطلبات'], ['settle', 'التسويات'], ['settings', 'الإعدادات']]
      : [['support', 'طلبات المساعدة'], ['orders', 'الطلبات']];
  }
  function shell() {
    app.innerHTML = '<nav class="tabs" id="tabs" style="margin-top:8px">' + tabs().map(function (t) {
      return '<button class="tab' + (A.tab === t[0] ? ' on' : '') + '" type="button" data-t="' + t[0] + '">' + t[1] + '<span id="dot-' + t[0] + '"></span></button>'; }).join('') + '</nav><div id="view"></div>';
    $('#tabs').onclick = function (e) { var b = e.target.closest('[data-t]'); if (b) { A.tab = b.dataset.t; $$('.tab').forEach(function (x) { x.classList.toggle('on', x === b); }); show(); } };
    show(); counts();
  }
  function show() {
    $('#view').innerHTML = '<div class="empty">عم نحمّل…</div>';
    ({ support: supportView, sellers: sellersView, products: productsView, orders: ordersView, settle: settleView, settings: settingsView })[A.tab]();
  }
  function counts() {
    s.rest('fs_support_requests', 'select=id&status=in.(open,in_progress)').then(function (r) { var d = $('#dot-support'); if (d) d.innerHTML = r.length ? '<span class="dot">' + r.length + '</span>' : ''; }).catch(function () {});
    if (A.role === 'admin') s.rest('fs_sellers', 'select=id&status=eq.pending').then(function (r) { var d = $('#dot-sellers'); if (d) d.innerHTML = r.length ? '<span class="dot">' + r.length + '</span>' : ''; }).catch(function () {});
  }
  function loadSellers() { return s.rest('fs_sellers', 'select=*&order=created_at.desc').then(function (r) { A.sellers = r; return r; }); }
  function sellerName(id) { var x = A.sellers.filter(function (z) { return z.id === id; })[0]; return x ? x.name : '#' + id; }
  function err(x) { $('#view').innerHTML = '<div class="note bad">' + esc(F.errText(x)) + '</div>'; }

  /* ---------- support queue ---------- */
  function supportView() {
    var q = A.rfilter === 'active' ? '&status=in.(open,in_progress,waiting_merchant)' : '';
    Promise.all([loadSellers(), s.rest('fs_support_requests', 'select=*&order=id.desc' + q)]).then(function (r) {
      var list = r[1];
      $('#view').innerHTML = '<div class="chips" style="padding-top:0"><button class="chip' + (A.rfilter === 'active' ? ' on' : '') + '" data-rf="active" type="button">المفتوحة</button><button class="chip' + (A.rfilter === 'all' ? ' on' : '') + '" data-rf="all" type="button">الكل</button></div>' +
        (list.length ? list.map(function (q) {
          return '<div class="order"><div class="hd"><b>#<span class="num">' + q.id + '</span> · ' + esc(sellerName(q.seller_id)) + '</b><span class="pill ' + (q.status === 'open' ? 'new' : (q.status === 'waiting_merchant' ? 'info' : (q.status === 'in_progress' ? 'shipping' : 'ok'))) + '">' + F.RSTATUS[q.status] + '</span></div>' +
            '<div class="small muted">' + F.date(q.created_at) + ' · ' + (q.kind === 'assisted_listing' ? 'مساعدة بإضافة منتجات' : 'طلب آخر') + ' · ' + q.files.length + ' ملف</div>' +
            (q.note ? '<div class="small" dir="auto">' + esc(q.note) + '</div>' : '') + (q.merchant_reply ? '<div class="note warn small">رد التاجر: ' + esc(q.merchant_reply) + '</div>' : '') +
            '<button class="btn sm dark" type="button" data-rq="' + q.id + '" style="margin-top:6px">فتح الطلب</button></div>';
        }).join('') : '<div class="empty">ما في طلبات مساعدة.</div>');
      $$('[data-rf]').forEach(function (b) { b.onclick = function () { A.rfilter = b.dataset.rf; supportView(); }; });
      $$('[data-rq]').forEach(function (b) { b.onclick = function () { openRequest(+b.dataset.rq); }; });
    }).catch(err);
  }
  function openRequest(id) {
    Promise.all([s.rest('fs_support_requests', 'select=*&id=eq.' + id), s.rest('fs_products', 'select=*,fs_variants(*)&assisted_request_id=eq.' + id + '&order=id')]).then(function (r) {
      var q = r[0][0], prods = r[1], seller = A.sellers.filter(function (x) { return x.id === q.seller_id; })[0];
      F.sheet('<h2>طلب مساعدة #' + q.id + '</h2>' +
        '<div class="small">المتجر: <b>' + esc(seller.name) + '</b> · ' + F.ltr('/s/' + seller.slug) + ' · ' + F.SSTATUS[seller.status] + '</div>' +
        (q.note ? '<div class="note" dir="auto">' + esc(q.note) + '</div>' : '') + (q.merchant_reply ? '<div class="note warn">رد التاجر: ' + esc(q.merchant_reply) + '</div>' : '') +
        '<div class="lbl">ملفات التاجر</div><div class="files" id="rqFiles">' + (q.files.length ? '' : '<span class="small muted">ما في ملفات</span>') + '</div>' +
        '<div class="lbl" style="margin-top:10px">المنتجات المجهّزة لهالطلب (' + prods.length + ')</div>' +
        (prods.length ? prods.map(function (p) { return '<div class="small" style="display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid var(--line)"><span dir="auto">' + esc(p.name_ar) + ' · ' + (p.price_syp > 0 ? F.syp(p.price_syp) : 'بدون سعر') + '</span><span><span class="pill ' + (p.status === 'published' ? 'ok' : 'info') + '">' + F.PSTATUS[p.status] + '</span>' + (p.status === 'draft' || p.status === 'pending_merchant' ? ' <button class="btn sm ghost" data-edp="' + p.id + '" type="button">تعديل</button>' : '') + '</span></div>'; }).join('') : '<p class="small muted">ما في منتجات بعد.</p>') +
        '<button class="btn block" id="rqAdd" type="button" style="margin-top:10px">+ إضافة منتج مسودة لهالمتجر</button>' +
        '<div class="field" style="margin-top:12px"><label for="rqNote">ملاحظة للتاجر</label><textarea class="inp" id="rqNote">' + esc(q.staff_note || '') + '</textarea></div>' +
        '<div class="btnrow"><button class="btn dark sm" data-rs="in_progress" type="button">قيد العمل</button><button class="btn sm" data-rs="waiting_merchant" type="button">إرسال للتاجر للموافقة</button><button class="btn ghost sm" data-rs="done" type="button">منجز</button></div>',
        function (b) {
          var box = $('#rqFiles', b);
          q.files.forEach(function (f) {
            s.signed(f).then(function (u) {
              var a = document.createElement('a'); a.href = u; a.target = '_blank'; a.rel = 'noopener';
              a.innerHTML = /\.(webp|jpe?g|png|gif)$/i.test(f) ? '<img src="' + esc(u) + '" alt="">' : '<span class="doc">' + esc(f.split('.').pop().toUpperCase()) + ' فتح الملف</span>';
              box.appendChild(a);
            }).catch(function () { var d = document.createElement('span'); d.className = 'f'; d.innerHTML = '<span class="doc">ما انفتح</span>'; box.appendChild(d); });
          });
          function editor(p) {
            F.editProduct({ s: s, seller: seller, product: p || null, mode: 'staff', categories: A.cats, requestId: q.id, requestFiles: q.files,
              onSaved: function (pid, st) {
                var body = { status: st === 'pending_merchant' ? 'waiting_merchant' : 'in_progress', assigned_to: s.a.uid };
                s.rest('fs_support_requests', 'id=eq.' + q.id, { method: 'PATCH', body: body }).then(function () { openRequest(q.id); counts(); });
              } });
          }
          $('#rqAdd', b).onclick = function () { editor(null); };
          $$('[data-edp]', b).forEach(function (x) { x.onclick = function () { editor(prods.filter(function (p) { return p.id === +x.dataset.edp; })[0]); }; });
          $$('[data-rs]', b).forEach(function (x) {
            x.onclick = function () {
              var st = x.dataset.rs, jobs = [];
              if (st === 'waiting_merchant') {
                var drafts = prods.filter(function (p) { return p.status === 'draft'; });
                if (!prods.some(function (p) { return p.status === 'draft' || p.status === 'pending_merchant'; })) { F.toast('ضيف منتج مسودة أولاً'); return; }
                jobs = drafts.map(function (p) { return s.rest('fs_products', 'id=eq.' + p.id, { method: 'PATCH', body: { status: 'pending_merchant' } }); });
              }
              Promise.all(jobs).then(function () {
                return s.rest('fs_support_requests', 'id=eq.' + q.id, { method: 'PATCH', body: { status: st, staff_note: $('#rqNote', b).value.trim() || null, assigned_to: s.a.uid } });
              }).then(function () { F.closeSheet(); F.toast('انحفظ'); supportView(); counts(); }).catch(function (e) { F.toast(F.errText(e)); });
            };
          });
        });
    }).catch(function (x) { F.toast(F.errText(x)); });
  }

  /* ---------- sellers (admin) ---------- */
  function sellersView() {
    loadSellers().then(function (all) {
      var list = A.sfilter === 'all' ? all : all.filter(function (x) { return x.status === A.sfilter; });
      $('#view').innerHTML = '<div class="chips" style="padding-top:0">' + [['all', 'الكل'], ['pending', 'بانتظار الموافقة'], ['approved', 'مفعّل'], ['suspended', 'موقوف']].map(function (f) {
        return '<button class="chip' + (A.sfilter === f[0] ? ' on' : '') + '" data-sf="' + f[0] + '" type="button">' + f[1] + ' (' + (f[0] === 'all' ? all.length : all.filter(function (x) { return x.status === f[0]; }).length) + ')</button>'; }).join('') + '</div>' +
        list.map(function (x) {
          return '<div class="order"><div class="hd"><b dir="auto">' + esc(x.name) + '</b><span class="pill ' + (x.status === 'approved' ? 'ok' : (x.status === 'pending' ? 'new' : 'bad')) + '">' + F.SSTATUS[x.status] + '</span></div>' +
            '<dl class="kv"><dt>الرابط</dt><dd><a href="/s/' + esc(x.slug) + '" target="_blank">' + F.ltr('/s/' + x.slug) + '</a></dd><dt>صاحب المتجر</dt><dd>' + esc(x.owner_name || '—') + '</dd>' +
            '<dt>واتساب</dt><dd>' + (x.whatsapp ? F.ltr(x.whatsapp) : 'غير مضاف') + '</dd><dt>المكان</dt><dd>' + esc([x.governorate, x.city].filter(Boolean).join('، ') || '—') + '</dd>' +
            '<dt>حساب دخول</dt><dd>' + (x.owner_id ? 'موجود (' + F.ltr(x.slug) + ')' : '<b>ما في</b>') + '</dd><dt>الإضافة</dt><dd>' + (x.onboarding_choice === 'assisted' ? 'طلب مساعدة' : (x.onboarding_choice === 'self' ? 'بنفسه' : '—')) + '</dd>' +
            '<dt>المكمّلات</dt><dd>' + (x.supplements_allowed ? 'مسموح بعد المراجعة' : 'غير مسموح') + '</dd>' + (x.is_demo ? '<dt>نوع</dt><dd>تجريبي</dd>' : '') +
            (x.admin_note ? '<dt>ملاحظة</dt><dd>' + esc(x.admin_note) + '</dd>' : '') + '</dl><div class="btnrow">' +
            (x.status !== 'approved' ? '<button class="btn sm" data-ss="approved" data-id="' + x.id + '" type="button">موافقة وتفعيل</button>' : '<button class="btn sm danger" data-ss="suspended" data-id="' + x.id + '" type="button">إيقاف</button>') +
            (x.status === 'pending' ? '<button class="btn sm danger" data-ss="rejected" data-id="' + x.id + '" type="button">رفض</button>' : '') +
            '<button class="btn sm ghost" data-supp="' + x.id + '" type="button">' + (x.supplements_allowed ? 'منع المكمّلات' : 'السماح بالمكمّلات') + '</button>' +
            '<button class="btn sm ghost" data-addp="' + x.id + '" type="button">+ منتج مسودة</button>' +
            (x.owner_id ? '<button class="btn sm ghost" data-pw="' + x.id + '" type="button">كلمة سر جديدة</button>' : '<button class="btn sm dark" data-mk="' + x.id + '" type="button">إنشاء حساب دخول</button>') +
            '</div></div>';
        }).join('');
      $$('[data-sf]').forEach(function (b) { b.onclick = function () { A.sfilter = b.dataset.sf; sellersView(); }; });
      $$('[data-ss]').forEach(function (b) { b.onclick = function () { patchSeller(+b.dataset.id, { status: b.dataset.ss }); }; });
      $$('[data-supp]').forEach(function (b) { b.onclick = function () { var x = A.sellers.filter(function (z) { return z.id === +b.dataset.supp; })[0]; patchSeller(x.id, { supplements_allowed: !x.supplements_allowed }); }; });
      $$('[data-addp]').forEach(function (b) {
        b.onclick = function () { var x = A.sellers.filter(function (z) { return z.id === +b.dataset.addp; })[0];
          F.editProduct({ s: s, seller: x, product: null, mode: 'staff', categories: A.cats, onSaved: function () { F.toast('انحفظت المسودة. التاجر بيشوفها بتبويب المنتجات'); } }); };
      });
      $$('[data-pw],[data-mk]').forEach(function (b) {
        b.onclick = function () {
          var id = +(b.dataset.pw || b.dataset.mk), mk = !!b.dataset.mk, x = A.sellers.filter(function (z) { return z.id === id; })[0];
          F.sheet('<h2>' + (mk ? 'إنشاء حساب دخول' : 'كلمة سر جديدة') + ' · ' + esc(x.name) + '</h2><p class="small">اسم المستخدم: ' + F.ltr(x.slug) + '</p>' +
            '<div class="field"><label for="pwI">كلمة السر (8 أحرف عالأقل)</label><input class="inp ltr" id="pwI"></div><div class="err" id="pwE"></div><button class="btn block" id="pwB" type="button">حفظ</button>',
            function (bb) {
              $('#pwB', bb).onclick = function () {
                s.fn('fs-auth', { action: mk ? 'create_merchant_login' : 'reset_password', seller_id: id, password: $('#pwI', bb).value })
                  .then(function () { F.closeSheet(); F.toast('انحفظ. سلّم التاجر اسم المستخدم وكلمة السر'); sellersView(); })
                  .catch(function (e) { $('#pwE', bb).textContent = F.errText(e); });
              };
            });
        };
      });
    }).catch(err);
  }
  function patchSeller(id, body) {
    s.rest('fs_sellers', 'id=eq.' + id, { method: 'PATCH', body: body }).then(function () { F.toast('انحفظ'); sellersView(); counts(); }).catch(function (x) { F.toast(F.errText(x)); });
  }

  /* ---------- product moderation (admin) ---------- */
  function productsView() {
    var q = 'select=*,fs_variants(*)&order=updated_at.desc&limit=60';
    if (A.pfilter === 'review') q += '&status=eq.published&supplement_approved=eq.false&category=in.(' + A.cats.filter(function (c) { return c.kind === 'supplement'; }).map(function (c) { return c.slug; }).join(',') + ')';
    if (A.pfilter === 'published') q += '&status=eq.published&blocked=eq.false';
    if (A.pfilter === 'blocked') q += '&blocked=eq.true';
    if (A.pfilter === 'drafts') q += '&status=in.(draft,pending_merchant)';
    if (A.pq) q += '&or=(name_ar.ilike.*' + encodeURIComponent(A.pq) + '*,name_en.ilike.*' + encodeURIComponent(A.pq) + '*)';
    Promise.all([loadSellers(), s.rest('fs_products', q), s.rest('fs_settings', 'select=*')]).then(function (r) {
      var list = r[1]; A.settings = r[2][0];
      $('#view').innerHTML = '<div class="chips" style="padding-top:0">' + [['review', 'مكمّلات بانتظار المراجعة'], ['published', 'المنشورة'], ['blocked', 'المخفية'], ['drafts', 'المسودات'], ['all', 'الكل']].map(function (f) {
          return '<button class="chip' + (A.pfilter === f[0] ? ' on' : '') + '" data-pf="' + f[0] + '" type="button">' + f[1] + '</button>'; }).join('') + '</div>' +
        '<div class="search" style="margin-bottom:10px"><input id="pq" type="search" placeholder="بحث باسم المنتج" value="' + esc(A.pq) + '" style="height:44px;border-width:1px"></div>' +
        (A.settings.supplements_enabled ? '' : '<div class="note warn small">المكمّلات مقفلة على مستوى المنصة (الإعدادات). حتى المكمّل الموافق عليه ما بينعرض قبل تفعيلها.</div>') +
        '<div class="small muted" style="margin-bottom:6px">عم يعرض أول 60 نتيجة</div>' +
        (list.length ? '<div class="list">' + list.map(function (p) {
          var supp = (A.cats.filter(function (c) { return c.slug === p.category; })[0] || {}).kind === 'supplement';
          return '<div class="item"><div class="im">' + (p.images[0] ? '<img src="' + esc(F.media(p.images[0])) + '" alt="" loading="lazy">' : '') + '</div><div>' +
            '<h4 dir="auto">' + esc(p.name_ar) + '</h4><div class="small muted">' + esc(sellerName(p.seller_id)) + ' · ' + (p.price_syp > 0 ? F.syp(p.price_syp) : 'بدون سعر') + ' · ' + F.PSTATUS[p.status] + (supp ? ' · مكمّل' + (p.supplement_approved ? ' ✓ مراجَع' : '') : '') + '</div>' +
            (p.blocked ? '<div class="small" style="color:var(--bad)">مخفي: ' + esc(p.moderation_note || '') + '</div>' : '') +
            '<div class="btnrow" style="margin-top:6px">' + (p.blocked ? '<button class="btn sm" data-unb="' + p.id + '" type="button">إظهار</button>' : '<button class="btn sm danger" data-blk="' + p.id + '" type="button">إخفاء مع سبب</button>') +
            (supp ? '<button class="btn sm ' + (p.supplement_approved ? 'ghost' : 'dark') + '" data-sa="' + p.id + '" data-v="' + (!p.supplement_approved) + '" type="button">' + (p.supplement_approved ? 'سحب الموافقة' : 'موافقة على المكمّل') + '</button>' : '') +
            '</div></div></div>';
        }).join('') + '</div>' : '<div class="empty">ما في منتجات بهالفلتر.</div>');
      $$('[data-pf]').forEach(function (b) { b.onclick = function () { A.pfilter = b.dataset.pf; productsView(); }; });
      var t; $('#pq').oninput = function () { clearTimeout(t); t = setTimeout(function () { A.pq = $('#pq').value.trim(); productsView(); }, 400); };
      $$('[data-unb]').forEach(function (b) { b.onclick = function () { patchProduct(+b.dataset.unb, { blocked: false, moderation_note: null }); }; });
      $$('[data-sa]').forEach(function (b) { b.onclick = function () { patchProduct(+b.dataset.sa, { supplement_approved: b.dataset.v === 'true' }); }; });
      $$('[data-blk]').forEach(function (b) {
        b.onclick = function () {
          F.sheet('<h2>إخفاء المنتج</h2><div class="field"><label for="bN">السبب (بيشوفه التاجر)</label><input class="inp" id="bN"></div><button class="btn danger block" id="bB" type="button">إخفاء</button>',
            function (bb) { $('#bB', bb).onclick = function () { F.closeSheet(); patchProduct(+b.dataset.blk, { blocked: true, moderation_note: $('#bN', bb).value.trim() || 'مخالف لشروط النشر' }); }; });
        };
      });
    }).catch(err);
  }
  function patchProduct(id, body) { s.rest('fs_products', 'id=eq.' + id, { method: 'PATCH', body: body }).then(function () { F.toast('انحفظ'); productsView(); }).catch(function (x) { F.toast(F.errText(x)); }); }

  /* ---------- orders ---------- */
  function ordersView() {
    var q = 'select=*,fs_order_items(*)&order=id.desc&limit=100';
    if (A.ofilter === 'open') q += '&status=in.(new,confirmed,shipping)';
    if (A.oseller) q += '&seller_id=eq.' + A.oseller;
    Promise.all([loadSellers(), s.rest('fs_orders', q)]).then(function (r) {
      var list = r[1];
      $('#view').innerHTML = '<div class="filterrow"><div class="chips" style="padding:0;flex:1"><button class="chip' + (A.ofilter === 'open' ? ' on' : '') + '" data-of="open" type="button">قيد التنفيذ</button><button class="chip' + (A.ofilter === 'all' ? ' on' : '') + '" data-of="all" type="button">الكل</button></div>' +
        '<select class="inp" id="os" style="max-width:200px;min-height:40px"><option value="">كل المتاجر</option>' + A.sellers.map(function (x) { return '<option value="' + x.id + '"' + (String(x.id) === A.oseller ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div>' +
        (A.role !== 'admin' ? '<div class="note small">عرض فقط: تغيير حالة الطلب من التاجر أو الإدارة.</div>' : '') +
        (list.length ? list.map(function (o) {
          return '<div class="order"><div class="hd"><b>' + F.ltr(o.number) + ' · ' + esc(sellerName(o.seller_id)) + '</b><span class="pill ' + o.status + '">' + F.STATUS[o.status] + '</span></div>' +
            '<div class="small muted">' + F.date(o.created_at) + ' · ' + F.SOURCE[o.source] + ' ' + Number(o.commission_rate) + '% · ' + esc(o.customer_name) + ' · ' + F.ltr(o.phone) + ' · ' + esc(o.governorate) + '</div>' +
            '<div class="small">' + o.fs_order_items.map(function (i) { return esc(i.name) + (i.variant_label !== 'قياس واحد' ? ' (' + esc(i.variant_label) + ')' : '') + ' × ' + i.qty + (i.returned_qty ? ' [مرتجع ' + i.returned_qty + ']' : ''); }).join('، ') + '</div>' +
            '<div class="small">المنتجات ' + F.syp(o.subtotal) + ' · الشحن ' + (o.shipping_fee == null ? 'غير محدد' : F.syp(o.shipping_fee)) + ' · العمولة ' + F.syp(o.commission_amount) + (o.delivery_evidence ? ' · إثبات: ' + esc(o.delivery_evidence) : '') + (o.delivery_evidence_file ? ' · <a href="#" data-ev="' + esc(o.delivery_evidence_file) + '">صورة الإثبات</a>' : '') + '</div>' +
            (A.role === 'admin' && F.NEXT[o.status] ? '<div class="btnrow" style="margin-top:6px">' + F.NEXT[o.status].map(function (n) { return '<button class="btn sm ' + (n === 'cancelled' || n === 'returned' ? 'danger' : 'ghost') + '" data-o="' + o.id + '" data-st="' + n + '" type="button">' + F.STATUS[n] + '</button>'; }).join('') + '</div>' : '') + '</div>';
        }).join('') : '<div class="empty">ما في طلبات.</div>');
      $$('[data-of]').forEach(function (b) { b.onclick = function () { A.ofilter = b.dataset.of; ordersView(); }; });
      $('#os').onchange = function () { A.oseller = $('#os').value; ordersView(); };
      $$('[data-ev]').forEach(function (a) { a.onclick = function (e) { e.preventDefault(); s.signed(a.dataset.ev).then(function (u) { window.open(u, '_blank'); }); }; });
      $$('[data-st]').forEach(function (b) {
        b.onclick = function () {
          var st = b.dataset.st, ev = null;
          if (st === 'delivered') { ev = prompt('إثبات التسليم (رقم الإيصال أو وصف):'); if (!ev) return; }
          s.rpc('fs_order_set_status', { p_order: +b.dataset.o, p_status: st, p_evidence: ev, p_note: 'من الإدارة' }).then(function () { F.toast('انحفظ'); ordersView(); }).catch(function (x) { F.toast(F.errText(x)); });
        };
      });
    }).catch(err);
  }

  /* ---------- settlements (admin) ---------- */
  function settleView() {
    s.rpc('fs_settlements_overview', {}).then(function (rows) {
      $('#view').innerHTML = '<div class="note info small">العمولة على المنتجات المسلّمة بعد الخصم وبدون الشحن. المرتجعات بتنطرح بالأسبوع اللي انسجّلت فيه. الأسبوع بيبلّش يوم الإثنين بتوقيت دمشق.</div>' +
        (rows.length ? '<div class="scroll-x"><table class="tbl"><tr><th>الأسبوع</th><th>المتجر</th><th>صافي المبيعات</th><th>العمولة</th><th>الحالة</th><th></th></tr>' +
          rows.map(function (r) {
            return '<tr><td>' + F.day(r.week_start) + '</td><td>' + esc(r.seller_name) + '</td><td><span class="ltr num">' + Math.round(r.net_sales).toLocaleString('en-US') + '</span></td><td><b class="ltr num">' + Math.round(r.commission).toLocaleString('en-US') + '</b></td>' +
              '<td>' + (r.paid ? '<span class="pill ok">تمت التسوية</span>' : '<span class="pill new">مفتوح</span>') + '</td><td><button class="btn sm ghost" data-det="' + r.seller_id + '" type="button">التفاصيل</button>' +
              (r.paid ? '' : ' <button class="btn sm" data-pay="' + r.seller_id + '" data-wk="' + r.week_start + '" data-amt="' + r.commission + '" type="button">تسجيل الاستلام</button>') + '</td></tr>';
          }).join('') + '</table></div>' : '<div class="empty">ما في عمولات بعد. بتظهر لما تاجر يسجّل أول طلب «تم التسليم».</div>');
      $$('[data-pay]').forEach(function (b) {
        b.onclick = function () {
          F.sheet('<h2>تسجيل تسوية الأسبوع</h2><p>المبلغ: ' + F.syp(b.dataset.amt) + '</p><div class="field"><label for="pN">ملاحظة (طريقة الاستلام…)</label><input class="inp" id="pN"></div><button class="btn block" id="pB" type="button">تسجيل</button>',
            function (bb) {
              $('#pB', bb).onclick = function () {
                s.rest('fs_settlement_marks', '', { method: 'POST', body: { seller_id: +b.dataset.pay, week_start: b.dataset.wk, amount: Math.round(+b.dataset.amt), note: $('#pN', bb).value.trim() || null, marked_by: s.a.uid } })
                  .then(function () { F.closeSheet(); settleView(); }).catch(function (x) { F.toast(F.errText(x)); });
              };
            });
        };
      });
      $$('[data-det]').forEach(function (b) {
        b.onclick = function () {
          s.rpc('fs_statement', { p_seller: +b.dataset.det }).then(function (ws) {
            F.sheet('<h2>كشف ' + esc(sellerName(+b.dataset.det)) + '</h2>' + ws.map(function (w) {
              return '<div class="panel"><b>أسبوع ' + F.day(w.week_start) + '</b> · عمولة ' + F.syp(w.commission) + '<div class="scroll-x"><table class="tbl"><tr><th>الطلب</th><th>الحركة</th><th>النسبة</th><th>الأساس</th><th>العمولة</th></tr>' +
                w.entries.map(function (e) { return '<tr><td>' + F.ltr(e.order_number) + '</td><td>' + F.KIND[e.kind] + '</td><td><span class="ltr num">' + Number(e.rate) + '%</span></td><td><span class="ltr num">' + Math.round(e.base_delta).toLocaleString('en-US') + '</span></td><td><span class="ltr num">' + Math.round(e.amount).toLocaleString('en-US') + '</span></td></tr>'; }).join('') + '</table></div></div>';
            }).join(''));
          });
        };
      });
    }).catch(err);
  }

  /* ---------- settings + staff (admin) ---------- */
  function settingsView() {
    Promise.all([s.rest('fs_settings', 'select=*'), s.rest('fs_staff', 'select=*&order=created_at')]).then(function (r) {
      var st = r[0][0], staff = r[1];
      $('#view').innerHTML = '<div class="panel"><h3>حالة الخدمات</h3>' +
        '<div class="setup-state"><span class="pill ok">شغّال</span><span class="small">قاعدة البيانات والحسابات وتخزين الصور (Supabase).</span></div>' +
        '<div class="setup-state" style="margin-top:6px"><span class="pill ' + (st.support_whatsapp ? 'ok">مضبوط' : 'new">غير مضبوط') + '</span><span class="small">رقم واتساب دعم سبلاي (بيظهر بأسفل الموقع).</span></div>' +
        '<div class="setup-state" style="margin-top:6px"><span class="pill ok">شغّال</span><span class="small">إشعار التاجر بالطلب الجديد داخل لوحته (تحديث كل 30 ثانية).</span></div>' +
        '<div class="setup-state" style="margin-top:6px"><span class="pill new">غير مضبوط</span><span class="small">إشعارات تلقائية خارج اللوحة (SMS أو واتساب API أو Push). ما في خدمة مربوطة.</span></div>' +
        '<div class="setup-state" style="margin-top:6px"><span class="pill new">غير مفعّل</span><span class="small">الدفع الإلكتروني. حالياً الدفع عند الاستلام بس.</span></div></div>' +
        '<form class="panel" id="stf"><h3>إعدادات المنصة</h3>' +
        '<div class="field"><label for="stW">واتساب دعم سبلاي (منفصل عن أرقام التجار)</label><input class="inp ltr" id="stW" type="tel" value="' + esc(st.support_whatsapp || '') + '" placeholder="+9639…"></div>' +
        '<div class="row2"><div class="field"><label for="stR1">عمولة رابط التاجر %</label><input class="inp ltr" id="stR1" inputmode="decimal" value="' + Number(st.rate_seller_link) + '"></div>' +
        '<div class="field"><label for="stR2">عمولة زبون السوق %</label><input class="inp ltr" id="stR2" inputmode="decimal" value="' + Number(st.rate_marketplace) + '"></div></div>' +
        '<p class="small muted" style="margin-top:-6px">تغيير النسب بيطبق عالطلبات الجديدة بس. كل طلب محفوظ بنسبته وقت الطلب.</p>' +
        '<div class="seg" style="grid-template-columns:1fr"><label><input type="checkbox" id="stSupp"' + (st.supplements_enabled ? ' checked' : '') + '> تفعيل قسم المكمّلات الغذائية للعموم</label></div>' +
        '<p class="small muted" style="margin-top:-6px">حتى لو تفعّل: المكمّل بيظهر بس إذا المتجر مسموح إلو بالمكمّلات والمنتج نفسه مراجَع ومُوافق عليه. فعّله بعد التأكد من المتطلبات القانونية والتراخيص.</p>' +
        '<div class="err" id="stE"></div><button class="btn block" type="submit">حفظ</button></form>' +
        '<div class="panel"><h3>فريق سبلاي</h3>' + staff.map(function (x) { return '<div class="small" style="padding:4px 0;border-bottom:1px solid var(--line)">' + esc(x.name || '') + ' · <span class="pill">' + (x.role === 'admin' ? 'إدارة' : 'دعم') + '</span></div>'; }).join('') +
        '<form id="sff" style="margin-top:10px"><div class="row2"><div class="field"><label for="sfU">اسم المستخدم</label><input class="inp ltr" id="sfU" autocapitalize="none"></div><div class="field"><label for="sfN">الاسم</label><input class="inp" id="sfN"></div></div>' +
        '<div class="row2"><div class="field"><label for="sfP">كلمة السر</label><input class="inp ltr" id="sfP"></div><div class="field"><label for="sfR">الدور</label><select class="inp" id="sfR"><option value="support">دعم</option><option value="admin">إدارة</option></select></div></div>' +
        '<div class="err" id="sfE"></div><button class="btn dark block" type="submit">إضافة حساب للفريق</button></form></div>';
      $('#stf').onsubmit = function (e) {
        e.preventDefault();
        var body = { support_whatsapp: $('#stW').value.replace(/[^\d+]/g, '') || null, rate_seller_link: Number($('#stR1').value), rate_marketplace: Number($('#stR2').value), supplements_enabled: $('#stSupp').checked, updated_at: new Date().toISOString() };
        if (!(body.rate_seller_link >= 0 && body.rate_seller_link <= 50 && body.rate_marketplace >= 0 && body.rate_marketplace <= 50)) { $('#stE').textContent = 'النسبة لازم تكون بين 0 و 50'; return; }
        s.rest('fs_settings', 'id=eq.1', { method: 'PATCH', body: body }).then(function () { F.toast('انحفظت الإعدادات'); settingsView(); }).catch(function (x) { $('#stE').textContent = F.errText(x); });
      };
      $('#sff').onsubmit = function (e) {
        e.preventDefault();
        s.fn('fs-auth', { action: 'create_staff', username: $('#sfU').value.trim(), name: $('#sfN').value.trim(), password: $('#sfP').value, role: $('#sfR').value })
          .then(function () { F.toast('انضاف الحساب'); settingsView(); }).catch(function (x) { $('#sfE').textContent = F.errText(x); });
      };
    }).catch(err);
  }

  $('#logout').onclick = function () { s.clear(); loginView(); };
  if (s.a) start(); else loginView();
})();
