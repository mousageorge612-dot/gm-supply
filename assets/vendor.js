/* GM Supply — vendor dashboard: a merchant manages only their own products (RLS + trigger). */
(function () {
  'use strict';
  var G = window.GS, $ = G.$, esc = G.esc, money = G.money;
  var S = new G.Session('gms-vendor'), ME = null, LIST = [];
  var DOMAIN = '@vendors.georgemousa.com';
  var CATS = ['بروتين', 'زيادة وزن', 'كرياتين', 'بري وركاوت', 'أحماض أمينية', 'جلوتامين', 'فيتامينات ومعادن', 'كولاجين', 'حرق الدهون', 'دعم الكبد', 'دعم الهرمونات طبيعياً', 'صحة عامة', 'سناكات بروتين', 'مشروبات طاقة', 'إكسسوارات', 'ملابس وحقائب', 'عناية شخصية'];

  function fail(e) { G.toast(G.errText(e)); }
  function start() {
    if (!S.a) return loginView();
    S.rest('supply_vendors', 'select=*').then(function (r) {
      ME = r && r[0];
      if (!ME || !ME.active) { S.clear(); G.toast(ME ? 'حسابك موقوف، تواصل مع الإدارة' : 'هالحساب مو حساب تاجر'); return loginView(); }
      $('#out').hidden = false; list();
    }).catch(function () { S.clear(); loginView(); });
  }
  $('#out').onclick = function () { S.clear(); location.reload(); };

  function loginView() {
    $('#out').hidden = true;
    $('#app').innerHTML = '<form class="login" id="lf"><img src="../assets/img/logo-full.webp" alt="GM Supply"><h2 style="margin:0 0 14px">لوحة التجار</h2>' +
      '<div class="field"><input class="inp" name="u" placeholder="اسم المستخدم" autocomplete="username" dir="ltr"></div>' +
      '<div class="field"><input class="inp" name="p" type="password" placeholder="كلمة المرور" autocomplete="current-password" dir="ltr"></div>' +
      '<button class="btn block">دخول</button><p style="color:var(--muted);font-size:13px">بدك تبيع منتجاتك على GM Supply؟ تواصل معنا على واتساب لنفتحلك حساب.</p></form>';
    $('#lf').onsubmit = function (e) {
      e.preventDefault(); var f = e.target;
      S.login(f.u.value, f.p.value, DOMAIN).then(start).catch(function (er) { G.toast(G.errText(er)); });
    };
  }

  function status(p) {
    if (p.review_note) return '<span class="pill st-cancelled">مطلوب تعديل</span>';
    return p.active ? '<span class="pill st-delivered">ظاهر بالمتجر</span>' : '<span class="pill st-new">بانتظار الموافقة</span>';
  }
  function list() {
    S.rest('supply_products', 'select=*&vendor_id=eq.' + ME.id + '&order=id.desc').then(function (r) {
      LIST = r;
      $('#app').innerHTML = '<div style="padding:14px 0 6px"><h2 style="margin:0">أهلاً ' + esc(ME.name) + '</h2><small style="color:var(--muted)">' + r.length + ' منتج · أي منتج جديد أو تعديل بيظهر بالمتجر بعد موافقة الإدارة. الطلبات بتوصل للإدارة وهي بتتواصل معك.</small></div>' +
        '<button class="btn block" id="newP" style="margin:8px 0 12px">+ أضف منتج</button><div class="list">' +
        (r.length ? r.map(function (p) {
          return '<div class="it prow" data-e="' + p.id + '"><div class="im">' + (p.image ? '<img loading="lazy" src="' + esc(G.media(p.image)) + '" alt="">' : '') + '</div><div><h3>' + esc(p.name) + '</h3><small>' + esc(p.brand || '') + (p.category ? ' · ' + esc(p.category) : '') + '</small><br>' +
            (+p.price_usd > 0 ? '<b style="color:var(--gold)">' + money(p.price_usd) + '</b> ' : '') + status(p) + (!p.in_stock ? ' <span class="pill">نفد</span>' : '') +
            (p.review_note ? '<div style="color:var(--red);font-size:13px">ملاحظة الإدارة: ' + esc(p.review_note) + '</div>' : '') + '</div><button class="btn ghost sm">تعديل</button></div>';
        }).join('') : '<div class="empty">لسا ما ضفت منتجات.</div>') + '</div>';
      $('#newP').onclick = function () { edit({ in_stock: true, options: [] }); };
      $('#app .list').onclick = function (e) { var b = e.target.closest('[data-e]'); if (b) edit(LIST.filter(function (p) { return p.id == b.dataset.e; })[0]); };
    }, fail);
  }

  function edit(p) {
    var newImg = null;
    G.sheet('<h2>' + (p.id ? 'تعديل منتج' : 'منتج جديد') + '</h2><form id="pf">' +
      '<div class="field"><label>صورة المنتج *</label><div class="imgprev" id="ip">' + (p.image ? '<img src="' + esc(G.media(p.image)) + '">' : '') + '</div><input type="file" accept="image/*" id="pi"></div>' +
      '<div class="field"><label>اسم المنتج *</label><input class="inp" name="name" required value="' + esc(p.name || '') + '"></div>' +
      '<div class="row2"><div class="field"><label>الماركة</label><input class="inp" name="brand" value="' + esc(p.brand || '') + '"></div>' +
      '<div class="field"><label>التصنيف</label><select class="inp" name="category">' + CATS.map(function (c) { return '<option' + (c === p.category ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="row2"><div class="field"><label>السعر $ *</label><input class="inp" name="price" type="number" step="0.01" min="0.01" required value="' + esc(+p.price_usd > 0 ? p.price_usd : '') + '"></div>' +
      '<div class="field"><label>السعر قبل الخصم $</label><input class="inp" name="old" type="number" step="0.01" min="0" value="' + esc(p.old_price_usd || '') + '"></div></div>' +
      '<div class="field"><label>النكهات / الأحجام (افصل بفاصلة)</label><input class="inp" name="options" value="' + esc((p.options || []).join('، ')) + '"></div>' +
      '<div class="field"><label>الوصف</label><textarea class="inp" name="description" rows="4">' + esc(p.description || '') + '</textarea></div>' +
      '<label class="chk"><input type="checkbox" name="in_stock"' + (p.in_stock ? ' checked' : '') + '> متوفر</label>' +
      '<div class="note">بعد الحفظ، المنتج بيروح للمراجعة وبيظهر بالمتجر بعد موافقة الإدارة.</div>' +
      '<button class="btn block" type="submit">حفظ وإرسال للمراجعة</button>' + (p.id ? '<button class="btn ghost block" type="button" id="delP" style="margin-top:8px;color:var(--red)">حذف المنتج</button>' : '') + '</form>',
      function (b) {
        $('#pi', b).onchange = function (e) {
          var f = e.target.files[0]; if (!f) return;
          G.shrink(f, 1000).then(function (blob) { newImg = blob; $('#ip', b).innerHTML = '<img src="' + URL.createObjectURL(blob) + '">'; }, fail);
        };
        $('#pf', b).onsubmit = function (e) {
          e.preventDefault(); var f = e.target, btn = f.querySelector('[type=submit]');
          if (!newImg && !p.image) { G.toast('ضيف صورة للمنتج'); return; }
          btn.disabled = true; btn.textContent = 'عم يحفظ...';
          var row = { name: f.name.value.trim(), brand: f.brand.value.trim() || null, category: f.category.value,
            price_usd: +f.price.value || 0, old_price_usd: +f.old.value || null, description: f.description.value.trim() || null,
            options: f.options.value.split(/[،,]/).map(function (s) { return s.trim(); }).filter(Boolean), in_stock: f.in_stock.checked, vendor_id: ME.id };
          var up = newImg ? S.upload('v' + ME.id + '/' + Date.now() + '.webp', newImg).then(function (u) { row.image = u; }) : Promise.resolve();
          up.then(function () {
            return p.id ? S.rest('supply_products', 'id=eq.' + p.id, { method: 'PATCH', body: row }) : S.rest('supply_products', '', { method: 'POST', body: row });
          }).then(function () { G.closeSheet(); G.toast('انحفظ وراح للمراجعة ✓'); list(); }, function (er) { btn.disabled = false; btn.textContent = 'حفظ وإرسال للمراجعة'; fail(er); });
        };
        var del = $('#delP', b);
        if (del) del.onclick = function () {
          if (!confirm('أكيد بدك تحذف "' + p.name + '"؟')) return;
          S.rest('supply_products', 'id=eq.' + p.id, { method: 'DELETE' }).then(function () { G.closeSheet(); list(); }, fail);
        };
      });
  }
  start();
})();
