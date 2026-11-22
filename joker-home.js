/* JOKER STORE — Home Showcase V1.0
   Owner-only management. Public media, titles and ticker are stored in Supabase.
   This optional extension does not modify cart, orders or legacy staff permissions. */
(() => {
  'use strict';
  const cfg = window.JOKER_CONFIG || {};
  const BUCKET = 'product-images';
  const MAX_SLIDES = 10;
  const defaults = {default_duration_seconds: 2, ticker_text: '', ticker_enabled: false, ticker_speed_seconds: 24};
  const state = {db: null, slides: [], settings: {...defaults}, adminSlides: [], products: [], owner: false, index: 0, timer: 0, paused: false, busy: false, lastLoad: 0};
  const $ = (selector, root=document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const num = (value, fallback, low, high) => {const n=Number(value);return Number.isFinite(n)?Math.max(low,Math.min(high,n)):fallback};
  const safeUrl = value => {if(!String(value||'').trim())return '';try {const u=new URL(value, location.href);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}};
  const toast = message => {const t=$('#toast');if(!t){alert(message);return} t.textContent=message;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),4000)};
  const hero = () => $('.hero');
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let observer=null;

  function stopCycle(){if(state.timer){clearTimeout(state.timer);state.timer=0}}
  function cycle(){stopCycle();if(state.slides.length<2 || state.paused || document.hidden || reduced?.matches)return;
    const current=state.slides[state.index];const ms=num(current?.duration_seconds == null ? state.settings.default_duration_seconds : current.duration_seconds,2,1,3600)*1000;
    const bar=$('.jh-progress');if(bar){bar.style.animation='none';void bar.offsetWidth;bar.style.setProperty('--jh-progress-ms',ms+'ms');bar.style.animation='jh-progress var(--jh-progress-ms) linear both'}
    state.timer=setTimeout(()=>show((state.index+1)%state.slides.length),ms);
  }
  function show(next){const count=state.slides.length;if(!count)return;state.index=(next+count)%count;
    document.querySelectorAll('.jh-slide').forEach((node,i)=>{const active=i===state.index;node.classList.toggle('is-active',active);node.setAttribute('aria-hidden',String(!active));
      node.querySelectorAll('a').forEach(a=>a.tabIndex=active?0:-1);
      const image=node.querySelector('img');if(active && image && image.loading==='lazy') image.loading='eager';
    });
    document.querySelectorAll('.jh-dot').forEach((b,i)=>{b.classList.toggle('is-active',i===state.index);b.setAttribute('aria-current',i===state.index?'true':'false')});
    cycle();
  }
  function goTarget(slide){const type=slide.target_type;
    if(type==='product' && slide.target_value){
      const id=String(slide.target_value);const shop=$('#shop');shop?.scrollIntoView({behavior:'smooth',block:'start'});
      setTimeout(()=>{const btn=[...document.querySelectorAll('#products [data-detail]')].find(x=>x.dataset.detail===id);btn?.click()},400);
    }else if(type==='url'){
      const url=safeUrl(slide.target_value);if(url)window.open(url,'_blank','noopener,noreferrer');
    }else{$('#shop')?.scrollIntoView({behavior:'smooth',block:'start'})}
  }
  function renderHero(){const root=hero();if(!root)return;stopCycle();root.querySelector('.jh-carousel')?.remove();
    root.classList.toggle('jh-enabled',state.slides.length>0);
    if(!state.slides.length)return;
    const carousel=document.createElement('div');carousel.className='jh-carousel';carousel.setAttribute('aria-roledescription','عرض صور متحرك');carousel.setAttribute('aria-label','عروض وواجهة متجر الجوكر');
    carousel.innerHTML=`<div class="jh-stage">${state.slides.map((s,i)=>{
      const image=safeUrl(s.image_url); const hasCTA=Boolean(s.button_text?.trim() && s.target_type!=='none');
      return `<article class="jh-slide ${i===0?'is-active':''}" aria-hidden="${i!==0}" data-jh-id="${esc(s.id)}">
        <img src="${esc(image)}" alt="${esc(s.image_alt||s.title||'تصميم متجر الجوكر')}" ${i===0?'loading="eager" fetchpriority="high"':'loading="lazy"'} decoding="async">
        <div class="jh-overlay"></div><div class="jh-slide-body"><span class="jh-kicker">✦ JOKER STORE ✦</span>
        ${s.title?`<h1 class="jh-slide-title">${esc(s.title)}</h1>`:''}
        ${s.subtitle?`<p class="jh-slide-subtitle">${esc(s.subtitle)}</p>`:''}
        ${hasCTA?`<button type="button" class="jh-slide-cta" data-jh-go="${i}">${esc(s.button_text)} <span aria-hidden="true">←</span></button>`:''}
        </div></article>`}).join('')}</div>
      ${state.slides.length>1?`<button class="jh-arrow jh-prev" type="button" aria-label="الصورة السابقة">‹</button><button class="jh-arrow jh-next" type="button" aria-label="الصورة التالية">›</button><div class="jh-dots">${state.slides.map((_,i)=>`<button type="button" class="jh-dot ${i===0?'is-active':''}" data-jh-dot="${i}" aria-label="الانتقال للصورة ${i+1}" aria-current="${i===0}"></button>`).join('')}</div><div class="jh-progress"></div>`:''}
      <div class="jh-count" dir="ltr"><span class="jh-count-now">01</span> / ${String(state.slides.length).padStart(2,'0')}</div>`;
    root.prepend(carousel);
    carousel.addEventListener('click',event=>{const btn=event.target.closest('[data-jh-go]');if(btn){goTarget(state.slides[Number(btn.dataset.jhGo)]);return}
      const dot=event.target.closest('[data-jh-dot]');if(dot){show(Number(dot.dataset.jhDot));return}
      if(event.target.closest('.jh-prev')){show(state.index-1);return}
      if(event.target.closest('.jh-next'))show(state.index+1);
    });
    carousel.addEventListener('mouseenter',()=>{state.paused=true;stopCycle()});
    carousel.addEventListener('mouseleave',()=>{state.paused=false;cycle()});
    carousel.addEventListener('focusin',()=>{state.paused=true;stopCycle()});
    carousel.addEventListener('focusout',event=>{if(!carousel.contains(event.relatedTarget)){state.paused=false;cycle()}});
    carousel.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();show(state.index+1)}if(event.key==='ArrowRight'){event.preventDefault();show(state.index-1)}});
    // Touch swipe, without interfering with CTA buttons.
    let touchX=null;
    carousel.addEventListener('touchstart',event=>{touchX=event.touches[0]?.clientX??null},{passive:true});
    carousel.addEventListener('touchend',event=>{if(touchX===null||state.slides.length<2)return;const diff=(event.changedTouches[0]?.clientX??touchX)-touchX;touchX=null;if(Math.abs(diff)>45)show(state.index+(diff>0?1:-1))},{passive:true});
    const counter=$('.jh-count-now',carousel);
    new MutationObserver(()=>{if(counter)counter.textContent=String(state.index+1).padStart(2,'0')}).observe($('.jh-stage',carousel),{attributes:true,subtree:true,attributeFilter:['class']});
    state.index=Math.min(state.index,state.slides.length-1);show(state.index);
  }
  function renderTicker(){document.querySelector('.jh-ticker')?.remove();const text=String(state.settings.ticker_text||'').trim();if(!state.settings.ticker_enabled || !text)return;
    const wrap=document.createElement('div');wrap.className='jh-ticker';wrap.setAttribute('role','region');wrap.setAttribute('aria-label','آخر أخبار المتجر');
    wrap.style.setProperty('--jh-ticker-duration',num(state.settings.ticker_speed_seconds,24,8,90)+'s');
    wrap.innerHTML=`<div class="jh-ticker-pill">✦ جديد الجوكر</div><div class="jh-ticker-window"><div class="jh-ticker-rail"><span>${esc(text)} <b>✦</b> </span><span aria-hidden="true">${esc(text)} <b>✦</b> </span></div></div>`;
    const anchor=hero();anchor?.insertAdjacentElement('afterend',wrap);
  }
  async function reloadPublic(){if(!state.db)return;
    const [a,b]=await Promise.all([
      state.db.from('joker_home_settings').select('*').eq('id',1).maybeSingle(),
      state.db.from('joker_home_slides').select('*').eq('enabled',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true}).limit(MAX_SLIDES)
    ]);
    if(a.error||b.error){console.warn('Joker showcase:',a.error?.message||b.error?.message);return}
    state.settings={...defaults,...(a.data||{})};state.slides=(b.data||[]).filter(s=>Boolean(safeUrl(s.image_url)));
    state.lastLoad=Date.now();renderHero();renderTicker();
  }
  async function checkOwner(){if(!state.db)return;try{const {data:{user}}=await state.db.auth.getUser();
      if(!user){state.owner=false;document.querySelector('#jhAdminTab')?.remove();return}
      const {data,error}=await state.db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
      state.owner=!error&&Boolean(data);if(!state.owner)document.querySelector('#jhAdminTab')?.remove();else ensureAdminTab();
    }catch(err){console.warn('Showcase owner:',err);state.owner=false}}
  function ensureAdminTab(){if(!state.owner)return;const tabs=$('#adminTabs');if(!tabs||$('#jhAdminTab',tabs))return;
    const button=document.createElement('button');button.type='button';button.id='jhAdminTab';button.textContent='🎬 الواجهة الرئيسية';
    button.onclick=()=>{tabs.querySelectorAll('[data-tab]').forEach(x=>x.classList.remove('active'));button.classList.add('active');openManager().catch(e=>managerError(e))};
    tabs.append(button);
  }
  function managerError(error){const host=$('#adminContent');if(host)host.innerHTML=`<p class="order-error" role="alert">${esc(error.message||String(error))}</p><button type="button" class="outline" id="jhTryAgain">إعادة المحاولة</button>`;
    $('#jhTryAgain')?.addEventListener('click',()=>openManager().catch(managerError));}
  const preview = s => `<img class="jh-admin-thumb" loading="lazy" alt="" src="${esc(safeUrl(s.image_url))}">`;
  async function loadAdminData(){const [s,p]=await Promise.all([
      state.db.from('joker_home_slides').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true}),
      state.db.from('products').select('id,name,image_url,available').order('name',{ascending:true}).limit(500)
    ]);
    if(s.error)throw s.error;if(p.error)throw p.error;state.adminSlides=s.data||[];state.products=p.data||[];
  }
  async function openManager(){if(!state.owner)throw Error('هذا القسم متاح للمدير العام فقط');
    const host=$('#adminContent');if(!host)return;host.innerHTML='<p class="mute">جارٍ تحميل إعدادات الواجهة...</p>';
    await loadAdminData();if(!host.isConnected || !$('#jhAdminTab')?.classList.contains('active'))return;
    host.innerHTML=`<section class="jh-manager" dir="rtl">
      <div class="jh-manager-heading"><div><span class="jh-admin-tag">JOKER SHOWCASE</span><h3>🎬 إدارة الواجهة الأولى</h3><p class="mute">ارفع صور عروضك وتصاميمك، واختر مدة العرض والكتابات والشريط الإخباري. الحد الأقصى ${MAX_SLIDES} صور.</p></div><button type="button" class="gold" id="jhAdd" ${state.adminSlides.length>=MAX_SLIDES?'disabled':''}>+ صورة جديدة</button></div>
      <form id="jhSettings" class="jh-admin-settings">
        <h4>⚙️ إعدادات الحركة والشريط</h4><div class="jh-settings-grid">
        <label class="field"><span>المدة الافتراضية لكل صورة (بالثواني)</span><input type="number" name="default_duration_seconds" min="1" max="3600" step="1" value="${num(state.settings.default_duration_seconds,2,1,3600)}" required></label>
        <label class="field"><span>سرعة شريط الأخبار (مدة دورة كاملة بالثواني)</span><input type="number" name="ticker_speed_seconds" min="8" max="90" step="1" value="${num(state.settings.ticker_speed_seconds,24,8,90)}" required></label></div>
        <label class="field"><span>نص الشريط المتحرك</span><textarea name="ticker_text" rows="2" maxlength="400" placeholder="اكتب آخر عروض الجوكر هنا...">${esc(state.settings.ticker_text||'')}</textarea></label>
        <label class="jh-toggle"><input type="checkbox" name="ticker_enabled" ${state.settings.ticker_enabled?'checked':''}> إظهار الشريط المتحرك للزبائن</label>
        <button type="submit" class="gold" id="jhSaveSettings">💾 حفظ إعدادات الواجهة</button></form>
      <div class="jh-list-head"><h4>🖼️ الصور (${state.adminSlides.length}/${MAX_SLIDES})</h4><span class="mute">استعمل ↑ ↓ لتغيير ترتيب الظهور</span></div>
      <div class="jh-admin-list">${state.adminSlides.map((s,i)=>`<article class="jh-admin-row" data-slide="${esc(s.id)}">${preview(s)}<div class="jh-admin-info"><strong>${esc(s.title||'صورة بدون عنوان')}</strong><small>${s.enabled?'🟢 ظاهرة':'⚪ مخفية'} · ${s.duration_seconds?s.duration_seconds+' ثانية':'المدة العامة'} · ${esc(s.target_type==='product'?'منتج':s.target_type==='url'?'رابط':'تصميم')}</small></div><div class="jh-admin-actions"><button class="outline smallBtn" data-jh-move="up" data-jh-id="${esc(s.id)}" title="تحريك للأعلى" ${i===0?'disabled':''}>↑</button><button class="outline smallBtn" data-jh-move="down" data-jh-id="${esc(s.id)}" title="تحريك للأسفل" ${i===state.adminSlides.length-1?'disabled':''}>↓</button><button class="outline smallBtn" data-jh-edit="${esc(s.id)}">تعديل</button><button class="outline smallBtn" data-jh-toggle="${esc(s.id)}">${s.enabled?'إخفاء':'إظهار'}</button><button class="danger smallBtn" data-jh-delete="${esc(s.id)}">حذف</button></div></article>`).join('')||'<p class="jh-admin-empty">لا توجد صور بعد. اضغط «+ صورة جديدة» لبدء المعرض.</p>'}</div>
      <p class="jh-admin-tip">المقاس المقترح للصور: 1920 × 800 بكسل. JPG / PNG / WebP، بحد أقصى 5 ميغابايت للصورة.</p>
    </section>`;
    $('#jhAdd',host)?.addEventListener('click',()=>openEditor(null));
    $('#jhSettings',host).addEventListener('submit',saveSettings);
    host.querySelectorAll('[data-jh-edit]').forEach(b=>b.addEventListener('click',()=>openEditor(state.adminSlides.find(s=>s.id===b.dataset.jhEdit))));
    host.querySelectorAll('[data-jh-toggle]').forEach(b=>b.addEventListener('click',()=>toggleSlide(b.dataset.jhToggle)));
    host.querySelectorAll('[data-jh-delete]').forEach(b=>b.addEventListener('click',()=>deleteSlide(b.dataset.jhDelete)));
    host.querySelectorAll('[data-jh-move]').forEach(b=>b.addEventListener('click',()=>moveSlide(b.dataset.jhId,b.dataset.jhMove)));
  }
  async function saveSettings(event){event.preventDefault();if(state.busy)return;const form=event.currentTarget;const f=new FormData(form);
    const values={id:1,default_duration_seconds:num(f.get('default_duration_seconds'),2,1,3600),ticker_text:String(f.get('ticker_text')||'').trim().slice(0,400),ticker_enabled:form.elements.ticker_enabled.checked,ticker_speed_seconds:num(f.get('ticker_speed_seconds'),24,8,90),updated_at:new Date().toISOString()};
    state.busy=true;const btn=$('#jhSaveSettings');btn.disabled=true;
    try{const {error}=await state.db.from('joker_home_settings').upsert(values,{onConflict:'id'});if(error)throw error;await reloadPublic();toast('✅ تم حفظ إعدادات الواجهة');}
    catch(e){toast('تعذّر الحفظ: '+e.message)}finally{state.busy=false;btn.disabled=false}}
  function openEditor(slide){const host=$('#adminContent');if(!host)return;const editing=Boolean(slide);
    const productOptions=state.products.filter(p=>p.image_url).map(p=>`<option value="${esc(p.id)}" ${slide?.target_type==='product'&&slide.target_value===String(p.id)?'selected':''}>${esc(p.name)}</option>`).join('');
    host.innerHTML=`<section class="jh-manager jh-editor" dir="rtl"><div class="jh-manager-heading"><div><span class="jh-admin-tag">JOKER SHOWCASE</span><h3>${editing?'✏️ تعديل الصورة':'🖼️ إضافة صورة للواجهة'}</h3></div><button type="button" class="outline" id="jhBack">الرجوع</button></div>
      <form id="jhSlideForm" class="jh-slide-form">
        ${slide?.image_url?`<div class="jh-current-image"><span>الصورة الحالية</span><img src="${esc(safeUrl(slide.image_url))}" alt="معاينة التصميم"></div>`:''}
        <label class="field"><span>صورة من الهاتف أو الكمبيوتر (اختياري عند التعديل)</span><input type="file" name="photo" accept="image/jpeg,image/png,image/webp"><small>مناسب للصورة العرضية 1920×800. يمكنك استعمال صورة المنتج تلقائياً بدلاً من الرفع.</small></label>
        <label class="field"><span>ربط الصورة بـ</span><select name="target_type"><option value="none" ${!slide||slide.target_type==='none'?'selected':''}>تصميم أو إعلان عادي (بدون رابط)</option><option value="product" ${slide?.target_type==='product'?'selected':''}>منتج موجود في المتجر</option><option value="url" ${slide?.target_type==='url'?'selected':''}>رابط موقع خارجي</option></select></label>
        <label class="field jh-product-field" hidden><span>اختر منتجاً (يمكن استخدام صورته تلقائياً)</span><select name="product_id"><option value="">— اختر المنتج —</option>${productOptions}</select></label>
        <label class="field jh-url-field" hidden><span>الرابط (https://)</span><input type="url" name="target_url" placeholder="https://example.com" maxlength="500" value="${esc(slide?.target_type==='url'?slide.target_value:'')}"></label>
        <label class="field"><span>العنوان التفاعلي على الصورة</span><input type="text" name="title" maxlength="100" value="${esc(slide?.title||'')}" placeholder="أقوى عروض الجوكر"></label>
        <label class="field"><span>الوصف أسفل العنوان</span><textarea name="subtitle" maxlength="230" rows="3" placeholder="اكتب وصفاً جذاباً...">${esc(slide?.subtitle||'')}</textarea></label>
        <div class="jh-settings-grid"><label class="field"><span>اسم زر التفاعل (إن وُجد)</span><input type="text" name="button_text" maxlength="35" value="${esc(slide?.button_text||'')}" placeholder="شاهد العرض"></label>
        <label class="field"><span>مدة الصورة وحدها (بالثواني، اختياري)</span><input type="number" name="duration_seconds" min="1" max="3600" step="1" value="${slide?.duration_seconds??''}" placeholder="اتركه فارغاً للمدة العامة"></label></div>
        <label class="field"><span>وصف الصورة لسهولة الوصول (اختياري)</span><input type="text" name="image_alt" maxlength="160" value="${esc(slide?.image_alt||'')}"></label>
        <label class="jh-toggle"><input type="checkbox" name="enabled" ${slide?.enabled!==false?'checked':''}> عرض الصورة للزبائن</label>
        <button type="submit" class="gold" id="jhSaveSlide">💾 ${editing?'حفظ التعديل':'إضافة الصورة'}</button><p class="jh-form-error" id="jhFormError" role="alert"></p>
      </form></section>`;
    $('#jhBack',host).onclick=()=>openManager().catch(managerError);
    const form=$('#jhSlideForm',host);
    const mode=form.elements.target_type;
    const updateFields=()=>{$('.jh-product-field',form).hidden=mode.value!=='product';$('.jh-url-field',form).hidden=mode.value!=='url'};
    mode.onchange=updateFields;updateFields();
    form.onsubmit=e=>saveSlide(e,slide);
  }
  async function saveSlide(event, original){event.preventDefault();if(state.busy)return;
    const form=event.currentTarget,err=$('#jhFormError',form),btn=$('#jhSaveSlide',form);err.textContent='';const f=new FormData(form);
    const type=String(f.get('target_type')||'none');let value='';let image=original?.image_url||'';
    if(type==='product'){
      value=String(f.get('product_id')||'');if(!value){err.textContent='اختر المنتج أولاً';return}
      const p=state.products.find(p=>String(p.id)===value);if(!p){err.textContent='المنتج المحدد غير موجود';return}
      if((!original||original.target_value!==value)&&p.image_url)image=p.image_url;
    }else if(type==='url'){
      value=String(f.get('target_url')||'').trim();if(!safeUrl(value)||!/^https?:\/\//i.test(value)){err.textContent='أدخل رابط https:// أو http:// صحيحاً';return}
    }
    const file=form.elements.photo.files?.[0];if(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)){err.textContent='اختر JPG أو PNG أو WebP';return}if(file.size>5*1024*1024){err.textContent='حجم الصورة أكبر من 5 ميغابايت';return}}
    if(!image&&!file){err.textContent='ارفع صورة للواجهة أو اختر منتجاً له صورة';return}
    const durationRaw=String(f.get('duration_seconds')||'').trim();const duration=durationRaw?num(durationRaw,2,1,3600):null;
    const order=original?.sort_order??((state.adminSlides.at(-1)?.sort_order||0)+10);
    const row={title:String(f.get('title')||'').trim().slice(0,100),subtitle:String(f.get('subtitle')||'').trim().slice(0,230),button_text:String(f.get('button_text')||'').trim().slice(0,35),duration_seconds:duration,image_alt:String(f.get('image_alt')||'').trim().slice(0,160),target_type:type,target_value:value||null,enabled:form.elements.enabled.checked,sort_order:order};
    if(!original&&state.adminSlides.length>=MAX_SLIDES){err.textContent='الحد الأقصى 10 صور، احذف صورة لإضافة أخرى';return}
    state.busy=true;btn.disabled=true;btn.textContent='جارٍ الحفظ...';let uploadedPath='';
    try{
      if(file){const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];uploadedPath=`home/${crypto.randomUUID()}.${ext}`;
        const uploaded=await state.db.storage.from(BUCKET).upload(uploadedPath,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
        if(uploaded.error)throw uploaded.error;image=state.db.storage.from(BUCKET).getPublicUrl(uploadedPath).data.publicUrl;}
      if(!safeUrl(image))throw Error('رابط الصورة غير صالح');row.image_url=image;
      const query=original?state.db.from('joker_home_slides').update(row).eq('id',original.id):state.db.from('joker_home_slides').insert(row);
      const {error}=await query;if(error)throw error;
      // Clean up a replaced home-banner file only after the database has saved.
      const replaced=original&&original.image_url!==image?ownedHomePath(original.image_url):'';
      if(replaced&&!state.adminSlides.some(s=>s.id!==original.id&&s.image_url===original.image_url)){
        const cleanup=await state.db.storage.from(BUCKET).remove([replaced]);
        if(cleanup.error)console.warn('Old home media cleanup:',cleanup.error.message);
      }
      await reloadPublic();toast('✅ تم حفظ صورة الواجهة');await openManager();
    }catch(e){err.textContent='تعذّر الحفظ: '+(e.message||String(e));if(uploadedPath){await state.db.storage.from(BUCKET).remove([uploadedPath]).catch(()=>{})}}
    finally{state.busy=false;if(btn.isConnected){btn.disabled=false;btn.textContent='💾 حفظ الصورة'}}
  }
  async function toggleSlide(id){const slide=state.adminSlides.find(s=>String(s.id)===String(id));if(!slide||state.busy)return;state.busy=true;
    try{const {error}=await state.db.from('joker_home_slides').update({enabled:!slide.enabled}).eq('id',id);if(error)throw error;await reloadPublic();await openManager()}
    catch(e){toast('تعذر التعديل: '+e.message)}finally{state.busy=false}}
  async function deleteSlide(id){const slide=state.adminSlides.find(s=>String(s.id)===String(id));if(!slide||state.busy||!confirm('حذف هذه الصورة من الواجهة نهائياً؟'))return;
    state.busy=true;try{const {error}=await state.db.from('joker_home_slides').delete().eq('id',id);if(error)throw error;
      // Never delete a product photo or a media URL referenced by another slide.
      const path=ownedHomePath(slide.image_url);if(path&&!state.adminSlides.some(s=>s.id!==slide.id&&s.image_url===slide.image_url)){
        const result=await state.db.storage.from(BUCKET).remove([path]);if(result.error)console.warn('Old showcase media could not be removed:',result.error.message);
      }
      await reloadPublic();await openManager();toast('✅ حُذفت الصورة');
    }catch(e){toast('تعذر الحذف: '+e.message)}finally{state.busy=false}}
  function ownedHomePath(url){try{const prefix=`/storage/v1/object/public/${BUCKET}/home/`;const u=new URL(url);if(u.origin!==new URL(cfg.supabaseUrl).origin||!u.pathname.startsWith(prefix))return '';
      const end=decodeURIComponent(u.pathname.slice(prefix.length));return end&&!end.includes('/')&&!end.includes('..')?'home/'+end:'';
    }catch{return ''}}
  async function moveSlide(id,direction){if(state.busy)return;const all=[...state.adminSlides];const from=all.findIndex(s=>String(s.id)===String(id));const to=from+(direction==='up'?-1:1);
    if(from<0||to<0||to>=all.length)return;[all[from],all[to]]=[all[to],all[from]];state.busy=true;
    try{
      for(let i=0;i<all.length;i++){if(all[i].sort_order===(i+1)*10)continue;const {error}=await state.db.from('joker_home_slides').update({sort_order:(i+1)*10}).eq('id',all[i].id);if(error)throw error}
      await reloadPublic();await openManager();
    }catch(e){toast('تعذر تغيير الترتيب: '+e.message);await openManager().catch(()=>{})}finally{state.busy=false}
  }
  async function init(){const root=hero();if(!root||!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.8');
    state.db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
    await reloadPublic();await checkOwner();
    const shade=$('#shade');if(shade){observer=new MutationObserver(()=>ensureAdminTab());observer.observe(shade,{childList:true,subtree:true});}
    state.db.auth.onAuthStateChange(()=>setTimeout(checkOwner,100));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCycle();else {cycle();if(Date.now()-state.lastLoad>30000)reloadPublic()}});
    // Refresh other open storefront windows while limiting background traffic.
    setInterval(()=>{if(!document.hidden)reloadPublic()},60000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error),{once:true});
  else init().catch(console.error);
})();
