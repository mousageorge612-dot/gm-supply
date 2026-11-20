/* سبلاي | Forma Supply — storefront (guest browsing, one-seller cart, checkout, order page). */
(function () {
  'use strict';
  var F = window.FS, $ = F.$, $$ = F.$$, esc = F.esc;
  var D = { categories: [], sellers: [], products: [], support_whatsapp: null };
  var S = { cat: 'all', q: '', seller: '', city: '', avail: 'all', min: '', max: '', sort: 'new', slug: null };
  var CART_KEY = 'fs-cart';
  var cart = loadCart();
  var sellerById = {}, catBySlug = {};

  $('#cartIcon').innerHTML = F.ICON.cart; $('#searchIcon').innerHTML = F.ICON.search; $('#filterIcon').innerHTML = F.ICON.filter;

  /* ---------- routing ---------- */
  var path = location.pathname.replace(/\/+$/, '') || '/';
  var mStore = path.match(/^\/s\/([a-z0-9-]+)$/), mOrder = path.match(/^\/o\/(FS-\d+)$/i);
  if (mStore) { S.slug = mStore[1]; try { sessionStorage.setItem('fs-ref', S.slug); } catch (e) {} }

  function ref() { try { return sessionStorage.getItem('fs-ref'); } catch (e) { return null; } }

  /* ---------- cart (browser convenience only; orders live in the database) ---------- */
  function loadCart() { try { var c = JSON.parse(localStorage.getItem(CART_KEY)); if (c && c.items) return c; } catch (e) {} return { seller_id: null, items: [], ref: null, client_ref: null }; }
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} paintCart(); }
  function variantInfo(vid) {
    for (var i = 0; i < D.products.length; i++) {
      var p = D.products[i];
      for (var j = 0; j < p.variants.length; j++) if (p.variants[j].id === vid) return { p: p, v: p.variants[j] };
    }
    return null;
  }
  function cartLines() {
    return cart.items.map(function (it) { var x = variantInfo(it.variant_id); return x ? { p: x.p, v: x.v, qty: it.qty } : null; }).filter(Boolean);
  }
  function cartSubtotal() { return cartLines().reduce(function (s, l) { return s + l.v.price * l.qty; }, 0); }
  function cartCount() { return cartLines().reduce(function (s, l) { return s + l.qty; }, 0); }
  function paintCart() {
    var n = cartCount();
    $('#cartCount').hidden = !n; $('#cartCount').textContent = n;
    $('#cartBar').hidden = !n || !$('#orderView').hidden;
    $('#cartBarCount').innerHTML = '<span class="num">' + n + '</span> ' + (n === 1 ? 'قطعة' : 'قطع');
    $('#cartBarTotal').innerHTML = F.syp(cartSubtotal());
  }
  function addToCart(p, v, qty) {
    function doAdd() {
      if (cart.seller_id !== p.seller_id) cart = { seller_id: p.seller_id, items: [], ref: null, client_ref: null };
      var s = sellerById[p.seller_id];
      cart.ref = (ref() && s && ref() === s.slug) ? s.slug : null;
      var ex = cart.items.filter(function (i) { return i.variant_id === v.id; })[0];
      var want = (ex ? ex.qty : 0) + qty;
      if (want > v.stock) { F.toast('المتوفر من هالقياس ' + v.stock + ' بس'); return; }
      if (ex) ex.qty = want; else cart.items.push({ variant_id: v.id, product_id: p.id, qty: qty });
      cart.client_ref = null;
      saveCart(); F.closeSheet(); F.toast('انضاف للسلة');
    }
    if (cart.items.length && cart.seller_id !== p.seller_id && cartLines().length) {
      var cur = sellerById[cart.seller_id], nxt = sellerById[p.seller_id];
      F.sheet('<h2>كل متجر إلو طلب وشحن منفصل</h2>' +
        '<p>سلتك فيها منتجات من <b>' + esc(cur ? cur.name : 'متجر تاني') + '</b>. كل طلب على سبلاي بيروح لتاجر واحد، وكل تاجر بيشحن لحاله وبيحدد أجور شحنه.</p>' +
        '<p class="muted">إذا بدك تكمّل من <b>' + esc(nxt ? nxt.name : '') + '</b> منفرّغ السلة الحالية. فيك أول تكمّل طلبك الحالي وبعدين ترجع.</p>' +
        '<div class="btnrow"><button class="btn" id="swOk" type="button">فرّغ السلة وأضف المنتج</button><button class="btn ghost" id="swNo" type="button">كمّل طلبي الحالي</button></div>',
        function (b) { $('#swOk', b).onclick = doAdd; $('#swNo', b).onclick = function () { openCart(); }; });
      return;
    }
    doAdd();
  }

  /* ---------- search ---------- */
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[ً-ْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
  }
  function hay(p) {
    if (p._h) return p._h;
    var s = sellerById[p.seller_id] || {}, c = catBySlug[p.category] || {};
    p._h = norm([p.name_ar, p.name_en, p.description, c.name_ar, c.name_en, s.name, s.city].concat(p.variants.map(function (v) { return v.label; })).join(' '));
    return p._h;
  }
  function pMin(p) { var a = p.variants.map(function (v) { return v.price; }); return a.length ? Math.min.apply(null, a) : p.price; }
  function pMax(p) { var a = p.variants.map(function (v) { return v.price; }); return a.length ? Math.max.apply(null, a) : p.price; }
  function onReq(p) { return !(pMax(p) > 0); }
  function askWa(p) { var s = sellerById[p.seller_id] || {}; return s.whatsapp || D.support_whatsapp || null; }
  function pStock(p) { return p.variants.reduce(function (s, v) { return s + Math.max(0, v.stock); }, 0); }

  function kindRank(p) { return (catBySlug[p.category] || {}).kind === 'supplement' ? 0 : 1; }
  function filtered() {
    var words = norm(S.q).split(/\s+/).filter(Boolean);
    var list = D.products.filter(function (p) {
      var s = sellerById[p.seller_id];
      if (!s) return false;
      if (S.slug && s.slug !== S.slug) return false;
      if (S.cat !== 'all' && p.category !== S.cat) return false;
      if (S.seller && String(p.seller_id) !== S.seller) return false;
      if (S.city && (s.city || s.governorate) !== S.city) return false;
      if (S.avail === 'in' && pStock(p) <= 0) return false;
      if ((S.min !== '' || S.max !== '') && onReq(p)) return false;
      if (S.min !== '' && pMax(p) < Number(S.min)) return false;
      if (S.max !== '' && pMin(p) > Number(S.max)) return false;
      if (words.length) { var h = hay(p); for (var i = 0; i < words.length; i++) if (h.indexOf(words[i]) < 0) return false; }
      return true;
    });
    if (S.sort === 'asc') list.sort(function (a, b) { return (onReq(a) - onReq(b)) || pMin(a) - pMin(b); });
    else if (S.sort === 'desc') list.sort(function (a, b) { return pMin(b) - pMin(a); });
    else list.sort(function (a, b) { return (kindRank(a) - kindRank(b)) || (onReq(a) - onReq(b)); });
    return list;
  }

  /* ---------- render ---------- */
  function variantSummary(p) {
    var v = p.variants;
    if (!v.length) return '';
    if (v.length === 1) return v[0].label === 'قياس واحد' ? '' : v[0].label;
    return v.length + ' خيارات: ' + v.map(function (x) { return x.label; }).join('، ');
  }
  function card(p) {
    var s = sellerById[p.seller_id] || {}, st = pStock(p), mn = pMin(p), mx = pMax(p);
    var img = p.images && p.images[0] ? '<img src="' + esc(F.media(p.images[0])) + '" alt="" loading="lazy">' : F.ICON.img;
    var vs = variantSummary(p);
    return '<button class="card" type="button" data-p="' + p.id + '">' +
      '<div class="ph">' + img + (s.is_demo ? '<span class="demo-badge">تجريبي</span>' : '') + '</div>' +
      '<div class="bd"><h3 dir="auto">' + esc(p.name_ar) + '</h3>' +
      (vs ? '<div class="meta" dir="auto">' + esc(vs) + '</div>' : '') +
      '<div class="meta">' + esc(s.name || '') + (s.city ? ' · ' + esc(s.city) : '') + '</div>' +
      (onReq(p) ? '<div class="price ask">السعر عند الطلب</div><div class="avail">اسأل التاجر عن التوفر</div></div></button>' :
      '<div class="price">' + (mn !== mx ? '<span class="small muted" style="font-family:var(--ar);font-weight:600">من </span>' : '') + F.syp(mn) + '</div>' +
      '<div class="avail ' + (st > 0 ? 'in">متوفر' : 'out">غير متوفر حالياً') + '</div></div></button>');
  }
  function renderChips() {
    var cats = [{ slug: 'all', name_ar: 'الكل' }].concat(D.categories.filter(function (c) {
      return c.slug === 'all' || D.products.some(function (p) { return p.category === c.slug && (!S.slug || (sellerById[p.seller_id] || {}).slug === S.slug); });
    }));
    $('#chips').innerHTML = cats.map(function (c) {
      return '<button class="chip' + (S.cat === c.slug ? ' on' : '') + '" type="button" role="tab" aria-selected="' + (S.cat === c.slug) + '" data-c="' + esc(c.slug) + '">' + esc(c.name_ar) + '</button>';
    }).join('');
  }
  function renderActive() {
    var t = [];
    if (S.seller) t.push(['seller', 'المتجر: ' + ((sellerById[S.seller] || {}).name || '')]);
    if (S.city) t.push(['city', 'المدينة: ' + S.city]);
    if (S.avail === 'in') t.push(['avail', 'المتوفر بس']);
    if (S.min !== '') t.push(['min', 'من ' + F.sypText(S.min)]);
    if (S.max !== '') t.push(['max', 'لحد ' + F.sypText(S.max)]);
    if (S.sort !== 'new') t.push(['sort', S.sort === 'asc' ? 'الأرخص أولاً' : 'الأغلى أولاً']);
    $('#activeFilters').innerHTML = t.map(function (x) { return '<span class="tag">' + esc(x[1]) + ' <button type="button" aria-label="إزالة" data-rm="' + x[0] + '">×</button></span>'; }).join('');
  }
  function render() {
    renderChips(); renderActive();
    var list = filtered();
    $('#resultInfo').innerHTML = '<span class="num">' + list.length + '</span> منتج';
    if (!list.length) {
      var anyFilter = S.q || S.cat !== 'all' || S.seller || S.city || S.avail !== 'all' || S.min !== '' || S.max !== '';
      $('#grid').innerHTML = '<div class="empty">' + (anyFilter ? 'ما لقينا منتجات مطابقة. جرّب كلمة تانية أو شيل الفلاتر.' : (S.slug ? 'هالمتجر ما نزّل منتجات بعد.' : 'ما في منتجات منشورة حالياً.')) + '</div>';
      return;
    }
    $('#grid').innerHTML = list.map(card).join('');
  }
  function renderStoreHead() {
    if (!S.slug) { $('#storeHead').innerHTML = ''; return; }
    var s = D.sellers.filter(function (x) { return x.slug === S.slug; })[0];
    if (!s) {
      $('#storeHead').innerHTML = '<div class="storehead"><h1>المتجر مو موجود</h1><p>الرابط غلط أو المتجر مو مفعّل حالياً. <a href="/">تصفّح كل المتاجر</a></p></div>';
      return;
    }
    document.title = s.name + ' | سبلاي';
    $('#storeHead').innerHTML = '<div class="storehead"><h1 dir="auto">' + esc(s.name) + '</h1>' +
      '<p>' + esc([s.city, s.governorate !== s.city ? s.governorate : ''].filter(Boolean).join('، ')) + '</p>' +
      (s.bio ? '<p dir="auto">' + esc(s.bio) + '</p>' : '') +
      (s.is_demo ? '<p><span class="pill bad">متجر تجريبي: الطلبات منه للتجربة بس</span></p>' : '') +
      '<p class="small"><a href="/">← كل المتاجر على سبلاي</a></p></div>';
  }

  /* ---------- product sheet ---------- */
  function openProduct(id) {
    var p = D.products.filter(function (x) { return x.id === id; })[0];
    if (!p) return;
    var s = sellerById[p.seller_id] || {}, c = catBySlug[p.category] || {};
    var avail = p.variants.filter(function (v) { return v.stock > 0; });
    var sel = avail[0] || p.variants[0], qty = 1, imgs = p.images || [];
    var req = onReq(p), wa = req ? askWa(p) : null;
    function priceHtml() { if (req) return '<div style="font-weight:700;font-size:18px;margin:6px 0">السعر عند الطلب</div>'; return '<div style="font:700 22px var(--en);margin:6px 0">' + F.syp(sel ? sel.price : p.price) + '</div>'; }
    F.sheet(
      '<div class="pd-img" id="pdImg">' + (imgs[0] ? '<img src="' + esc(F.media(imgs[0])) + '" alt="">' : F.ICON.img) + '</div>' +
      (imgs.length > 1 ? '<div class="thumbs">' + imgs.map(function (u, i) { return '<img src="' + esc(F.media(u)) + '" data-i="' + i + '" class="' + (i ? '' : 'on') + '" alt="">'; }).join('') + '</div>' : '') +
      '<h2 dir="auto" style="margin-bottom:2px">' + esc(p.name_ar) + '</h2>' +
      (p.name_en ? '<div class="muted small" dir="ltr" style="text-align:right">' + esc(p.name_en) + '</div>' : '') +
      '<div class="small" style="margin-top:6px">' + esc(c.name_ar || '') + ' · <a href="/s/' + esc(s.slug) + '"><b>' + esc(s.name || '') + '</b></a>' + (s.city ? ' · ' + esc(s.city) : '') + (s.is_demo ? ' · <span class="pill bad">تجريبي</span>' : '') + '</div>' +
      '<div id="pdPrice">' + priceHtml() + '</div>' +
      (p.variants.length > 1 || (p.variants[0] && p.variants[0].label !== 'قياس واحد') ?
        '<div class="lbl">القياس / النوع</div><div class="variants" id="pdVars">' + p.variants.map(function (v) {
          return '<button type="button" class="variant' + (v === sel ? ' on' : '') + '" data-v="' + v.id + '"' + (v.stock > 0 ? '' : ' disabled title="غير متوفر"') + ' dir="auto">' + esc(v.label) + '</button>';
        }).join('') + '</div>' : '') +
      (req ? '' : '<div id="pdAvail" class="avail ' + (sel && sel.stock > 0 ? 'in">متوفر' : 'out">غير متوفر حالياً') + '</div>') +
      (p.description ? '<p dir="auto" style="white-space:pre-line">' + esc(p.description) + '</p>' : '') +
      (req ? (wa ? '<a class="btn wa block" style="margin:14px 0 4px" target="_blank" rel="noopener" href="' + F.waLink(wa, 'مرحبا، بدي اسأل عن سعر وتوفر: ' + p.name_ar + ' (' + s.name + ') على سبلاي') + '">اسأل عن السعر والتوفر على واتساب</a>'
        : '<div class="note small" style="margin:14px 0 4px">التاجر لسّا ما حدّد سعر هالمنتج، فما فيك تطلبه أونلاين حالياً. رح ينضاف السعر قريباً.</div>') :
      '<div style="display:flex;gap:10px;align-items:center;margin:14px 0 4px"><div class="qty"><button type="button" id="qm" aria-label="أنقص">−</button><span id="qv">1</span><button type="button" id="qp" aria-label="زِد">+</button></div>' +
      '<button class="btn" style="flex:1" id="addBtn" type="button"' + (sel && sel.stock > 0 ? '' : ' disabled') + '>أضف للسلة</button></div>') +
      '<p class="small muted">البيع والشحن من المتجر نفسه. الدفع عند الاستلام.</p>',
      function (b) {
        $$('.thumbs img', b).forEach(function (t) { t.onclick = function () { $$('.thumbs img', b).forEach(function (x) { x.classList.remove('on'); }); t.classList.add('on'); $('#pdImg', b).innerHTML = '<img src="' + esc(F.media(imgs[+t.dataset.i])) + '" alt="">'; }; });
        $$('.variant', b).forEach(function (el) {
          el.onclick = function () {
            sel = p.variants.filter(function (v) { return String(v.id) === el.dataset.v; })[0];
            $$('.variant', b).forEach(function (x) { x.classList.toggle('on', x === el); });
            $('#pdPrice', b).innerHTML = priceHtml();
            qty = 1; $('#qv', b).textContent = 1;
          };
        });
        if (req) return;
        $('#qm', b).onclick = function () { qty = Math.max(1, qty - 1); $('#qv', b).textContent = qty; };
        $('#qp', b).onclick = function () { if (sel && qty < sel.stock) { qty++; $('#qv', b).textContent = qty; } else F.toast('هاد كل المتوفر'); };
        $('#addBtn', b).onclick = function () { if (sel) addToCart(p, sel, qty); };
      });
    try { history.replaceState(null, '', location.pathname + '?p=' + p.id); } catch (e) {}
  }

  /* ---------- cart + checkout ---------- */
  function openCart() {
    var lines = cartLines(), s = sellerById[cart.seller_id];
    if (!lines.length) { F.sheet('<h2>السلة</h2><div class="empty">سلتك فاضية.</div>'); return; }
    F.sheet('<h2>السلة</h2><p class="small muted">من متجر <b>' + esc(s ? s.name : '') + '</b>. الطلب والشحن من هالمتجر بس.</p>' +
      lines.map(function (l) {
        return '<div class="line"><div class="im">' + (l.p.images[0] ? '<img src="' + esc(F.media(l.p.images[0])) + '" alt="">' : '') + '</div>' +
          '<div><h4 dir="auto">' + esc(l.p.name_ar) + '</h4><div class="small muted" dir="auto">' + (l.v.label !== 'قياس واحد' ? esc(l.v.label) + ' · ' : '') + F.syp(l.v.price) + '</div>' +
          '<div class="qty" style="margin-top:6px"><button type="button" data-m="' + l.v.id + '">−</button><span>' + l.qty + '</span><button type="button" data-pl="' + l.v.id + '">+</button></div></div>' +
          '<div class="num" style="font-weight:700">' + F.syp(l.v.price * l.qty) + '</div></div>';
      }).join('') +
      '<div class="sum"><div class="r"><span>مجموع المنتجات</span><b>' + F.syp(cartSubtotal()) + '</b></div><div class="r small muted"><span>الشحن</span><span>بيتحدد بالخطوة الجاية</span></div></div>' +
      '<button class="btn block" id="toCheckout" type="button">متابعة الطلب</button>',
      function (b) {
        $$('[data-m]', b).forEach(function (el) { el.onclick = function () { changeQty(+el.dataset.m, -1); }; });
        $$('[data-pl]', b).forEach(function (el) { el.onclick = function () { changeQty(+el.dataset.pl, 1); }; });
        $('#toCheckout', b).onclick = openCheckout;
      });
  }
  function changeQty(vid, d) {
    var it = cart.items.filter(function (i) { return i.variant_id === vid; })[0], x = variantInfo(vid);
    if (!it || !x) return;
    if (d > 0 && it.qty + 1 > x.v.stock) { F.toast('هاد كل المتوفر'); return; }
    it.qty += d; if (it.qty <= 0) cart.items = cart.items.filter(function (i) { return i !== it; });
    cart.client_ref = null; saveCart(); openCart();
  }
  var draft = {};
  try { draft = JSON.parse(localStorage.getItem('fs-checkout')) || {}; } catch (e) {}
  function openCheckout() {
    var s = sellerById[cart.seller_id]; if (!s) return;
    var ships = s.shipping_options || [], branches = s.pickup_branches || [];
    var method = draft.delivery_method === 'pickup' && branches.length ? 'pickup' : 'delivery';
    F.sheet('<h2>معلومات الطلب</h2><p class="small muted">طلبك بيوصل لـ <b>' + esc(s.name) + '</b> وبيتواصل معك لتأكيده. الدفع عند الاستلام.</p>' +
      '<form id="co" novalidate>' +
      '<div class="field"><label for="cName">الاسم الثلاثي</label><input class="inp" id="cName" autocomplete="name" placeholder="الاسم، اسم الأب، الكنية" value="' + esc(draft.name || '') + '" required></div>' +
      '<div class="field"><label for="cPhone">رقم الموبايل</label><input class="inp ltr" id="cPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09xx xxx xxx" value="' + esc(draft.phone || '') + '" required></div>' +
      '<div class="row2"><div class="field"><label for="cGov">المحافظة</label><select class="inp" id="cGov" required><option value="">اختار</option>' +
        F.GOVS.map(function (g) { return '<option' + (draft.governorate === g ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="cCity">المدينة / المنطقة</label><input class="inp" id="cCity" value="' + esc(draft.city || '') + '"></div></div>' +
      '<div class="lbl" style="margin-bottom:6px">طريقة الاستلام</div><div class="seg">' +
        '<label><input type="radio" name="dm" value="delivery"' + (method === 'delivery' ? ' checked' : '') + '> توصيل لعنواني</label>' +
        '<label' + (branches.length ? '' : ' style="opacity:.5"') + '><input type="radio" name="dm" value="pickup"' + (method === 'pickup' ? ' checked' : '') + (branches.length ? '' : ' disabled') + '> استلام من فرع</label></div>' +
      (branches.length ? '' : '<p class="small muted" style="margin-top:-6px">هالمتجر ما عنده فروع استلام، التوصيل بس.</p>') +
      '<div id="dmDelivery"><div class="field"><label for="cAddr">العنوان بالتفصيل</label><textarea class="inp" id="cAddr" placeholder="الحي، الشارع، أقرب نقطة دالة">' + esc(draft.address || '') + '</textarea></div>' +
        '<div class="field"><label for="cShip">شركة الشحن</label><select class="inp" id="cShip"><option value="">اختار</option>' +
        ships.map(function (o) { return '<option value="' + esc(o.name) + '"' + (draft.shipping_company === o.name ? ' selected' : '') + '>' + esc(o.name) + (o.fee != null ? ' · ' + F.sypText(o.fee) : ' · الأجور بتتحدد مع التاجر') + '</option>'; }).join('') +
        '</select></div></div>' +
      '<div id="dmPickup"><div class="field"><label for="cBranch">فرع الاستلام</label><select class="inp" id="cBranch"><option value="">اختار</option>' +
        branches.map(function (b) { return '<option>' + esc(b) + '</option>'; }).join('') + '</select></div></div>' +
      '<div class="field"><label for="cNotes">ملاحظات (اختياري)</label><textarea class="inp" id="cNotes" placeholder="وقت مناسب للتواصل، تفاصيل إضافية…"></textarea></div>' +
      '<div id="coSum"></div><div class="err" id="coErr" role="alert"></div>' +
      '<button class="btn block" id="coBtn" type="submit">تأكيد الطلب</button>' +
      '<p class="small muted center">الطلب بينحفظ عنا وبيوصل للتاجر بلوحته. ما بتدفع شي هلق.</p></form>',
      function (b) {
        function sync() {
          var m = $('input[name=dm]:checked', b).value;
          $('#dmDelivery', b).hidden = m !== 'delivery'; $('#dmPickup', b).hidden = m !== 'pickup';
          var sub = cartSubtotal(), fee = null, known = false;
          if (m === 'pickup') { fee = 0; known = true; }
          else { var o = ships.filter(function (x) { return x.name === $('#cShip', b).value; })[0]; if (o && o.fee != null) { fee = Number(o.fee); known = true; } }
          var lines = cartLines();
          $('#coSum', b).innerHTML = '<div class="sum">' + lines.map(function (l) {
            return '<div class="r small"><span dir="auto">' + esc(l.p.name_ar) + (l.v.label !== 'قياس واحد' ? ' (' + esc(l.v.label) + ')' : '') + ' × <span class="num">' + l.qty + '</span></span><span>' + F.syp(l.v.price * l.qty) + '</span></div>';
          }).join('') +
            '<div class="r"><span>مجموع المنتجات</span><b>' + F.syp(sub) + '</b></div>' +
            '<div class="r"><span>الشحن</span><span>' + (m === 'pickup' ? 'استلام من الفرع' : (known ? F.syp(fee) : (($('#cShip', b).value) ? '<b>غير معروف بعد</b>' : 'اختار شركة الشحن'))) + '</span></div>' +
            '<div class="r t"><span>' + (known ? 'المجموع' : 'المجموع بدون الشحن') + '</span><span>' + F.syp(sub + (fee || 0)) + '</span></div></div>' +
            (m === 'delivery' && $('#cShip', b).value && !known ? '<div class="note warn">أجور الشحن مع هالشركة مو محددة بعد. التاجر بيبلّغك فيها قبل الإرسال. الشحن مو مجاني.</div>' : '');
        }
        $$('input[name=dm]', b).forEach(function (r) { r.onchange = sync; });
        $('#cShip', b).onchange = sync; sync();
        $('#co', b).onsubmit = function (e) {
          e.preventDefault();
          var m = $('input[name=dm]:checked', b).value;
          var c = { name: $('#cName', b).value.trim(), phone: $('#cPhone', b).value.trim(), governorate: $('#cGov', b).value, city: $('#cCity', b).value.trim(),
            delivery_method: m, address: $('#cAddr', b).value.trim(), shipping_company: $('#cShip', b).value, pickup_branch: $('#cBranch', b).value, notes: $('#cNotes', b).value.trim() };
          var er = '';
          if (c.name.split(/\s+/).filter(Boolean).length < 3) er = 'name_three_parts';
          else if (c.phone.replace(/\D/g, '').length < 9) er = 'bad_phone';
          else if (!c.governorate) er = 'bad_governorate';
          else if (m === 'delivery' && !c.address) er = 'address_required';
          else if (m === 'delivery' && !c.shipping_company) er = 'shipping_required';
          else if (m === 'pickup' && !c.pickup_branch) er = 'bad_branch';
          if (er) { $('#coErr', b).textContent = F.errText(er); return; }
          draft = { name: c.name, phone: c.phone, governorate: c.governorate, city: c.city, address: c.address, shipping_company: c.shipping_company, delivery_method: m };
          try { localStorage.setItem('fs-checkout', JSON.stringify(draft)); } catch (x) {}
          if (!cart.client_ref) { cart.client_ref = F.uid(); saveCart(); }
          var btn = $('#coBtn', b); btn.disabled = true; btn.textContent = 'عم نحفظ الطلب…'; $('#coErr', b).textContent = '';
          F.rpc('fs_place_order', { p: { seller_id: cart.seller_id, ref: cart.ref, client_ref: cart.client_ref, customer: c,
            items: cart.items.map(function (i) { return { variant_id: i.variant_id, qty: i.qty }; }) } })
            .then(function (r) {
              cart = { seller_id: null, items: [], ref: null, client_ref: null }; saveCart(); F.closeSheet();
              history.pushState(null, '', '/o/' + r.number + '?k=' + r.token);
              showOrder(r.number, r.token, true);
            })
            .catch(function (x) { btn.disabled = false; btn.textContent = 'تأكيد الطلب'; $('#coErr', b).textContent = F.errText(x); });
        };
      });
  }

  /* ---------- order page (persists: read back from the database) ---------- */
  function waText(o) {
    var t = ['طلب جديد عبر سبلاي | Forma Supply', 'رقم الطلب: ' + o.number, 'المتجر: ' + o.seller.name, ''];
    o.items.forEach(function (i) { t.push('- ' + i.name + (i.variant_label && i.variant_label !== 'قياس واحد' ? ' (' + i.variant_label + ')' : '') + ' × ' + i.qty + ' = ' + F.sypText(i.unit_price * i.qty)); });
    t.push('', 'مجموع المنتجات: ' + F.sypText(o.subtotal));
    t.push('الشحن: ' + (o.delivery_method === 'pickup' ? 'استلام من ' + o.pickup_branch : (o.shipping_fee == null ? 'غير محدد بعد (' + o.shipping_company + ')' : F.sypText(o.shipping_fee) + ' (' + o.shipping_company + ')')));
    t.push('', 'الاسم: ' + o.customer_name, 'الموبايل: ' + o.phone, 'المحافظة: ' + o.governorate + (o.city ? '، ' + o.city : ''));
    if (o.address) t.push('العنوان: ' + o.address);
    if (o.notes) t.push('ملاحظات: ' + o.notes);
    return t.join('\n');
  }
  function showOrder(num, token, fresh) {
    $('#main').hidden = true; $('#orderView').hidden = false; paintCart();
    var v = $('#orderView');
    v.innerHTML = '<div class="empty" style="margin-top:20px">عم نجيب الطلب…</div>';
    F.rpc('fs_order_public', { p_number: num, p_token: token }).then(function (o) {
      if (!o) { v.innerHTML = '<div class="note bad" style="margin-top:16px">ما لقينا هالطلب. تأكد من الرابط.</div><a class="btn ghost block" href="/">رجوع للسوق</a>'; return; }
      document.title = 'طلب ' + o.number + ' | سبلاي';
      var known = o.shipping_fee != null;
      v.innerHTML = '<div style="padding:16px 0 120px">' +
        (fresh ? '<div class="note ok"><b>انحفظ طلبك ✓</b> ووصل للوحة <b>' + esc(o.seller.name) + '</b>. التاجر بيتواصل معك لتأكيده.</div>' : '') +
        (o.seller.is_demo ? '<div class="note bad">هاد طلب من متجر تجريبي، ما في بضاعة حقيقية.</div>' : '') +
        '<div class="panel"><div class="dash-top" style="padding:0 0 8px"><h2 style="font-size:18px">طلب ' + F.ltr(o.number) + '</h2><span class="pill ' + o.status + '">' + F.STATUS[o.status] + '</span></div>' +
        '<p class="small muted" style="margin:0 0 8px">احتفظ برابط هالصفحة لتتابع حالة طلبك.</p>' +
        o.items.map(function (i) { return '<div class="sum" style="background:none;padding:0;margin:0"><div class="r small"><span dir="auto">' + esc(i.name) + (i.variant_label !== 'قياس واحد' ? ' (' + esc(i.variant_label) + ')' : '') + ' × <span class="num">' + i.qty + '</span></span><span>' + F.syp(i.unit_price * i.qty) + '</span></div></div>'; }).join('') +
        '<div class="sum"><div class="r"><span>مجموع المنتجات</span><b>' + F.syp(o.subtotal) + '</b></div>' +
        '<div class="r"><span>الشحن</span><span>' + (o.delivery_method === 'pickup' ? 'استلام من ' + esc(o.pickup_branch) : (known ? F.syp(o.shipping_fee) : 'غير محدد بعد')) + '</span></div>' +
        '<div class="r t"><span>' + (known ? 'المجموع' : 'المجموع بدون الشحن') + '</span><span>' + F.syp(o.total) + '</span></div></div>' +
        (!known ? '<div class="note warn">أجور الشحن مع ' + esc(o.shipping_company || '') + ' بيبلّغك فيها التاجر. الشحن مو مجاني.</div>' : '') +
        '<dl class="kv"><dt>الاسم</dt><dd>' + esc(o.customer_name) + '</dd><dt>الموبايل</dt><dd>' + F.ltr(o.phone) + '</dd><dt>المحافظة</dt><dd>' + esc(o.governorate) + (o.city ? '، ' + esc(o.city) : '') + '</dd>' +
        (o.address ? '<dt>العنوان</dt><dd>' + esc(o.address) + '</dd>' : '') + (o.shipping_company ? '<dt>شركة الشحن</dt><dd>' + esc(o.shipping_company) + '</dd>' : '') +
        '<dt>الدفع</dt><dd>عند الاستلام</dd></dl>' +
        '<div class="lbl">مراحل الطلب</div><ol class="small" style="margin:6px 0 0;padding-inline-start:20px">' + (o.events || []).map(function (e) { return '<li>' + F.STATUS[e.status] + ' · <span class="muted">' + F.date(e.at) + '</span></li>'; }).join('') + '</ol></div>' +
        (o.seller.whatsapp ? '<a class="btn wa block" target="_blank" rel="noopener" href="' + F.waLink(o.seller.whatsapp, waText(o)) + '">ابعت تفاصيل الطلب للتاجر على واتساب (اختياري)</a>' +
          '<p class="small muted center">طلبك محفوظ أصلاً. واتساب بس للتواصل، ما بيعمل طلب تاني وما بيعني إنو الطلب انسلّم.</p>' : '<p class="small muted">التاجر ما ضاف رقم واتساب، بيتواصل معك على رقمك.</p>') +
        '<a class="btn ghost block" href="' + (o.seller.slug ? '/s/' + esc(o.seller.slug) : '/') + '" style="margin-top:8px">رجوع للمتجر</a></div>';
    }).catch(function (e) { v.innerHTML = '<div class="note bad" style="margin-top:16px">' + esc(F.errText(e)) + '</div>'; });
  }

  /* ---------- filter sheet ---------- */
  function openFilters() {
    var cities = {}; D.sellers.forEach(function (s) { var c = s.city || s.governorate; if (c) cities[c] = 1; });
    F.sheet('<h2>فلترة وترتيب</h2>' +
      (S.slug ? '' : '<div class="field"><label for="fSel">المتجر</label><select class="inp" id="fSel"><option value="">كل المتاجر</option>' +
        D.sellers.map(function (s) { return '<option value="' + s.id + '"' + (String(s.id) === S.seller ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field"><label for="fCity">مدينة المتجر</label><select class="inp" id="fCity"><option value="">كل المدن</option>' +
        Object.keys(cities).map(function (c) { return '<option' + (c === S.city ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>') +
      '<div class="lbl" style="margin-bottom:6px">التوفر</div><div class="seg"><label><input type="radio" name="fav" value="all"' + (S.avail === 'all' ? ' checked' : '') + '> الكل</label><label><input type="radio" name="fav" value="in"' + (S.avail === 'in' ? ' checked' : '') + '> المتوفر بس</label></div>' +
      '<div class="row2"><div class="field"><label for="fMin">السعر من (ل.س)</label><input class="inp ltr" id="fMin" inputmode="numeric" value="' + esc(S.min) + '"></div>' +
      '<div class="field"><label for="fMax">لحد (ل.س)</label><input class="inp ltr" id="fMax" inputmode="numeric" value="' + esc(S.max) + '"></div></div>' +
      '<div class="field"><label for="fSort">الترتيب</label><select class="inp" id="fSort"><option value="new">الأحدث</option><option value="asc"' + (S.sort === 'asc' ? ' selected' : '') + '>الأرخص أولاً</option><option value="desc"' + (S.sort === 'desc' ? ' selected' : '') + '>الأغلى أولاً</option></select></div>' +
      '<div class="btnrow"><button class="btn" id="fApply" type="button">طبّق</button><button class="btn ghost" id="fReset" type="button">مسح الفلاتر</button></div>',
      function (b) {
        $('#fApply', b).onclick = function () {
          if (!S.slug) { S.seller = $('#fSel', b).value; S.city = $('#fCity', b).value; }
          S.avail = $('input[name=fav]:checked', b).value;
          S.min = $('#fMin', b).value.replace(/[^\d]/g, ''); S.max = $('#fMax', b).value.replace(/[^\d]/g, ''); S.sort = $('#fSort', b).value;
          F.closeSheet(); render();
        };
        $('#fReset', b).onclick = function () { S.seller = S.city = S.min = S.max = ''; S.avail = 'all'; S.sort = 'new'; F.closeSheet(); render(); };
      });
  }

  /* ---------- events ---------- */
  $('#chips').onclick = function (e) { var b = e.target.closest('[data-c]'); if (b) { S.cat = b.dataset.c; render(); } };
  $('#grid').onclick = function (e) { var b = e.target.closest('[data-p]'); if (b) openProduct(+b.dataset.p); };
  var qt; $('#q').oninput = function () { clearTimeout(qt); qt = setTimeout(function () { S.q = $('#q').value; render(); }, 150); };
  $('#filterBtn').onclick = openFilters;
  $('#activeFilters').onclick = function (e) {
    var b = e.target.closest('[data-rm]'); if (!b) return;
    var k = b.dataset.rm; if (k === 'avail') S.avail = 'all'; else if (k === 'sort') S.sort = 'new'; else S[k] = ''; render();
  };
  $('#cartBtn').onclick = openCart; $('#cartBarBtn').onclick = openCart;
  window.addEventListener('popstate', function () { location.reload(); });

  /* ---------- boot ---------- */
  function boot() {
    if (mOrder) {
      var k = new URLSearchParams(location.search).get('k');
      F.rpc('fs_catalog').then(function (d) { D = d; index(); paintCart(); }).catch(function () {});
      showOrder(mOrder[1].toUpperCase(), k, false);
      return;
    }
    F.rpc('fs_catalog').then(function (d) {
      D = d; index(); renderStoreHead(); render(); paintCart();
      var pid = +new URLSearchParams(location.search).get('p'); if (pid) openProduct(pid);
    }).catch(function (e) {
      $('#grid').innerHTML = '<div class="empty">' + esc(F.errText(e)) + '<br><button class="btn ghost sm" type="button" onclick="location.reload()" style="margin-top:10px">جرّب مرة تانية</button></div>';
    });
  }
  function index() {
    sellerById = {}; catBySlug = {};
    D.sellers.forEach(function (s) { sellerById[s.id] = s; });
    D.categories.forEach(function (c) { catBySlug[c.slug] = c; });
    cart.items = cart.items.filter(function (i) { return variantInfo(i.variant_id); });
    if (!cart.items.length) cart.seller_id = null;
    if (D.support_whatsapp) $('#supportLink').innerHTML = ' · <a target="_blank" rel="noopener" href="' + F.waLink(D.support_whatsapp, 'مرحبا، عندي سؤال عن سبلاي') + '">دعم سبلاي على واتساب</a>';
  }
  boot();
})();
