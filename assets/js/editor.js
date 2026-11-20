/* سبلاي | Forma Supply — product editor shared by the merchant dashboard and the support/admin dashboard.
   mode 'merchant': publish or save draft. mode 'staff': save draft or send to the merchant for approval. */
(function () {
  'use strict';
  var F = window.FS, $ = F.$, $$ = F.$$, esc = F.esc;

  F.editProduct = function (o) {
    // o: { s: Session, seller, product (with fs_variants) | null, mode, categories, requestId, requestFiles, onSaved }
    var p = o.product || { name_ar: '', name_en: '', description: '', category: '', images: [], price_syp: '', status: 'draft', fs_variants: [] };
    var imgs = (p.images || []).slice();
    var vars = (p.fs_variants || []).slice().sort(function (a, b) { return (a.sort - b.sort) || (a.id - b.id); })
      .map(function (v) { return { id: v.id, label: v.label, price_syp: v.price_syp, stock: v.stock }; });
    if (!vars.length) vars.push({ label: 'قياس واحد', price_syp: null, stock: 1 });
    var removed = [];
    var cats = o.categories || [];
    var isSupp = function (slug) { var c = cats.filter(function (x) { return x.slug === slug; })[0]; return c && c.kind === 'supplement'; };

    function varRows() {
      return vars.map(function (v, i) {
        return '<div class="varrow" data-i="' + i + '"><input class="inp" data-k="label" value="' + esc(v.label) + '" placeholder="مثلاً M أو أسود" aria-label="القياس">' +
          '<input class="inp ltr" data-k="price_syp" inputmode="numeric" value="' + (v.price_syp == null ? '' : v.price_syp) + '" placeholder="نفس السعر" aria-label="سعر خاص">' +
          '<input class="inp ltr" data-k="stock" inputmode="numeric" value="' + (v.stock == null ? 0 : v.stock) + '" aria-label="الكمية">' +
          '<button type="button" data-del="' + i + '" aria-label="حذف">✕</button></div>';
      }).join('');
    }
    function imgRow() {
      return imgs.map(function (u, i) { return '<div class="im"><img src="' + esc(F.media(u)) + '" alt=""><button type="button" data-rmimg="' + i + '" aria-label="حذف الصورة">✕</button></div>'; }).join('') +
        '<label class="im" style="display:flex;align-items:center;justify-content:center;cursor:pointer;border:1.5px dashed #b9bdc4;font-size:12px;text-align:center">+ صورة<input type="file" accept="image/*" multiple hidden id="peFile"></label>';
    }
    var staff = o.mode === 'staff';
    F.sheet('<h2>' + (o.product ? 'تعديل منتج' : (staff ? 'منتج جديد لمتجر ' + esc(o.seller.name) : 'منتج جديد')) + '</h2>' +
      (staff ? '<div class="note info">بتنحفظ كمسودة لمتجر <b>' + esc(o.seller.name) + '</b>. ما بتنعرض للزبائن قبل ما التاجر يوافق عليها.</div>' : '') +
      (p.status === 'pending_merchant' && !staff ? '<div class="note info">فريق الدعم جهّز هالمنتج إلك. راجعه، عدّل إذا بدك، واضغط «موافقة ونشر».</div>' : '') +
      '<form id="pe" novalidate>' +
      '<div class="lbl">الصور</div><div class="imgedit" id="peImgs">' + imgRow() + '</div>' +
      (o.requestFiles && o.requestFiles.length ? '<div class="small muted">صور التاجر بالطلب (اضغط لتستخدمها):</div><div class="files" id="peReq"></div>' : '') +
      '<div class="field"><label for="peAr">اسم المنتج بالعربي</label><input class="inp" id="peAr" value="' + esc(p.name_ar) + '" required></div>' +
      '<div class="field"><label for="peEn">الاسم بالإنكليزي (اختياري، بيساعد بالبحث)</label><input class="inp ltr" id="peEn" value="' + esc(p.name_en || '') + '"></div>' +
      '<div class="field"><label for="peCat">الفئة</label><select class="inp" id="peCat"><option value="">اختار</option>' +
        cats.map(function (c) { return '<option value="' + c.slug + '"' + (c.slug === p.category ? ' selected' : '') + '>' + esc(c.name_ar) + (c.kind === 'supplement' ? ' (مكمّل، بيحتاج مراجعة)' : '') + '</option>'; }).join('') + '</select>' +
        '<div class="note warn" id="peSupp" hidden>المكمّلات الغذائية ما بتنعرض للزبائن قبل مراجعة الإدارة وتفعيلها للمتجر. فيك تجهّزها هلق.</div></div>' +
      '<div class="field"><label for="peDesc">الوصف</label><textarea class="inp" id="peDesc" placeholder="المادة، المقاس، طريقة الاستعمال…">' + esc(p.description || '') + '</textarea></div>' +
      '<div class="field"><label for="pePrice">السعر (ل.س)</label><input class="inp ltr" id="pePrice" inputmode="numeric" value="' + (p.price_syp || '') + '" required></div>' +
      '<div class="lbl">القياسات والكميات</div><div class="small muted" style="margin-bottom:6px">لكل قياس أو لون: الاسم، سعر خاص إذا مختلف، والكمية الموجودة عندك.</div>' +
      '<div class="varrow small muted" style="margin:0"><span>القياس</span><span>سعر خاص</span><span>الكمية</span><span></span></div>' +
      '<div id="peVars">' + varRows() + '</div><button type="button" class="btn ghost sm" id="peAddVar">+ قياس أو لون</button>' +
      '<div class="err" id="peErr" role="alert" style="margin-top:10px"></div>' +
      '<div class="btnrow" style="margin-top:12px">' +
        (staff ? '<button class="btn" type="submit" data-st="pending_merchant">إرسال للتاجر للموافقة</button><button class="btn ghost" type="submit" data-st="draft">حفظ كمسودة</button>'
               : '<button class="btn" type="submit" data-st="published">' + (p.status === 'pending_merchant' ? 'موافقة ونشر' : 'نشر') + '</button><button class="btn ghost" type="submit" data-st="draft">حفظ كمسودة</button>') +
      '</div></form>',
      function (b) {
        function paintImgs() { $('#peImgs', b).innerHTML = imgRow(); bindFile(); }
        function bindFile() {
          $('#peFile', b).onchange = function (e) {
            var files = Array.prototype.slice.call(e.target.files || []); if (!files.length) return;
            F.toast('عم نرفع الصور…');
            Promise.all(files.slice(0, 6).map(function (f) {
              return F.shrink(f, 1200).then(function (blob) { return o.s.upload('fs-media', 's' + o.seller.id + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.webp', blob); });
            })).then(function (paths) { imgs = imgs.concat(paths); paintImgs(); F.toast('انرفعت'); })
              .catch(function (x) { $('#peErr', b).textContent = 'ما انرفعت الصورة: ' + F.errText(x); });
          };
        }
        bindFile();
        $('#peImgs', b).onclick = function (e) { var x = e.target.closest('[data-rmimg]'); if (x) { imgs.splice(+x.dataset.rmimg, 1); paintImgs(); } };
        if (o.requestFiles && o.requestFiles.length) {
          var box = $('#peReq', b);
          o.requestFiles.filter(function (f) { return /\.(webp|jpe?g|png|gif)$/i.test(f); }).forEach(function (f) {
            o.s.signed(f).then(function (u) {
              var a = document.createElement('button'); a.type = 'button'; a.className = 'f'; a.style.border = '0'; a.style.cursor = 'pointer';
              a.innerHTML = '<img src="' + esc(u) + '" alt="">';
              a.onclick = function () {
                F.toast('عم ننسخ الصورة للمنتج…');
                fetch(u).then(function (r) { return r.blob(); }).then(function (bl) { return F.shrink(bl, 1200); })
                  .then(function (blob) { return o.s.upload('fs-media', 's' + o.seller.id + '/' + Date.now() + '.webp', blob); })
                  .then(function (path) { imgs.push(path); paintImgs(); F.toast('انضافت الصورة'); })
                  .catch(function (x) { F.toast(F.errText(x)); });
              };
              box.appendChild(a);
            });
          });
        }
        function readVars() {
          $$('.varrow[data-i]', b).forEach(function (row) {
            var v = vars[+row.dataset.i];
            v.label = $('[data-k=label]', row).value.trim();
            var pr = $('[data-k=price_syp]', row).value.replace(/[^\d]/g, ''); v.price_syp = pr === '' ? null : Number(pr);
            v.stock = Number($('[data-k=stock]', row).value.replace(/[^\d]/g, '') || 0);
          });
        }
        $('#peVars', b).onclick = function (e) {
          var x = e.target.closest('[data-del]'); if (!x) return;
          readVars(); var v = vars.splice(+x.dataset.del, 1)[0]; if (v && v.id) removed.push(v.id);
          if (!vars.length) vars.push({ label: 'قياس واحد', price_syp: null, stock: 0 });
          $('#peVars', b).innerHTML = varRows();
        };
        $('#peAddVar', b).onclick = function () { readVars(); vars.push({ label: '', price_syp: null, stock: 0 }); $('#peVars', b).innerHTML = varRows(); };
        function suppNote() { $('#peSupp', b).hidden = !isSupp($('#peCat', b).value); }
        $('#peCat', b).onchange = suppNote; suppNote();
        var want = 'draft';
        $$('button[type=submit]', b).forEach(function (bt) { bt.onclick = function () { want = bt.dataset.st; }; });
        $('#pe', b).onsubmit = function (e) {
          e.preventDefault(); readVars();
          var row = { name_ar: $('#peAr', b).value.trim(), name_en: $('#peEn', b).value.trim() || null, category: $('#peCat', b).value,
            description: $('#peDesc', b).value.trim() || null, images: imgs, price_syp: Number($('#pePrice', b).value.replace(/[^\d]/g, '') || 0), status: want };
          var er = '';
          if (!row.name_ar) er = 'اكتب اسم المنتج';
          else if (!row.category) er = 'اختار الفئة';
          else if (want !== 'draft' && row.price_syp <= 0) er = 'حط السعر قبل النشر';
          else if (want !== 'draft' && !imgs.length) er = 'ضيف صورة واحدة عالأقل قبل النشر';
          else if (vars.some(function (v) { return !v.label; })) er = 'كل قياس لازم يكون إلو اسم';
          if (er) { $('#peErr', b).textContent = er; return; }
          $$('button[type=submit]', b).forEach(function (x) { x.disabled = true; });
          var pid;
          var save = o.product
            ? o.s.rest('fs_products', 'id=eq.' + o.product.id, { method: 'PATCH', body: row, headers: { Prefer: 'return=representation' } })
            : o.s.rest('fs_products', '', { method: 'POST', headers: { Prefer: 'return=representation' },
                body: Object.assign(row, { seller_id: o.seller.id }, o.requestId ? { assisted_request_id: o.requestId } : {}) });
          save.then(function (r) {
            if (!r || !r[0]) throw new Error('ما عندك صلاحية لهالعملية');
            pid = r[0].id;
            var jobs = removed.map(function (id) { return o.s.rest('fs_variants', 'id=eq.' + id, { method: 'DELETE' }); });
            vars.forEach(function (v, i) {
              var body = { label: v.label, price_syp: v.price_syp, stock: v.stock, sort: i };
              jobs.push(v.id ? o.s.rest('fs_variants', 'id=eq.' + v.id, { method: 'PATCH', body: body })
                             : o.s.rest('fs_variants', '', { method: 'POST', body: Object.assign(body, { product_id: pid }) }));
            });
            return Promise.all(jobs);
          }).then(function () {
            F.closeSheet();
            F.toast(want === 'published' ? 'انتشر المنتج' : (want === 'pending_merchant' ? 'انبعت للتاجر للموافقة' : 'انحفظت المسودة'));
            if (o.onSaved) o.onSaved(pid, want);
          }).catch(function (x) {
            $$('button[type=submit]', b).forEach(function (y) { y.disabled = false; });
            $('#peErr', b).textContent = F.errText(x);
          });
        };
      });
  };
})();
