/* JOKER STORE — Visual Sections V2
 * Optional companion to joker-home.js, does not replace product/cart/order JS.
 * Owner-only UI; server enforces access through RLS. */
(() => {
  'use strict';
  const cfg = window.JOKER_CONFIG || {};
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validImage = value => {try{let u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:''}catch{return ''}};
  const n = (v, fallback=3) => {let x=Number(v);return Number.isInteger(x)&&x>=1&&x<=3600?x:fallback};
  const sections = {shop:'🛍️ خلفية المنتجات',offers:'⚡ خلفية العروض',games:'🎮 خلفية الألعاب'};
  const MAX=10, BUCKET='product-images';
  const empty = {category_duration_seconds:3,background_duration_seconds:5};
  const S = {db:null,settings:{...empty},slides:[],categories:[],products:[],owner:false,adminSlides:[],area:'category',cat:'',editId:null,timers:[],observer:null,busy:false,lastSync:0};
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const allowed = ['image/png','image/jpeg','image/webp'];
  const notify = message=>{const toast=$('#toast');if(toast){toast.textContent=message;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),4000)}else alert(message)};
  function imagesFor(area,category){return S.slides.filter(x=>x.area===area && (area!=='category'||x.category_id===category) && x.enabled && validImage(x.image_url));}
  function productsFor(category){return S.products.filter(p=>String(p.category_id)===String(category)&&validImage(p.image_url)).slice(0,5).map(p=>({image_url:p.image_url,title:p.name,caption:'شاهد المنتجات',duration_seconds:null}));}
  function gallery(category){const rows=imagesFor('category',category);return rows.length?rows:productsFor(category);}
  function stopTimers(){for(const x of S.timers)clearTimeout(x);S.timers.length=0;}
  function later(fn,ms){const id=setTimeout(fn,ms);S.timers.push(id);return id;}
  function canRotate(){return !document.hidden&&!reduceMotion?.matches;}

  function rotateFrames(root,slides,defaultSeconds,opts={}){
    if(!root)return;root.textContent='';
    const view=document.createElement('div');view.className='jv-frames';
    slides.forEach((s,i)=>{const frame=document.createElement('div');frame.className='jv-frame'+(i===0?' active':'');frame.setAttribute('aria-hidden',i===0?'false':'true');
      const img=document.createElement('img');img.alt=s.title||opts.alt||'صورة';img.src=validImage(s.image_url);img.loading=i===0?'eager':'lazy';img.decoding='async';frame.append(img);view.append(frame)});
    root.append(view);
    let pos=0;
    const indicators=opts.dots&&slides.length>1?document.createElement('div'):null;
    if(indicators){indicators.className='jv-frame-dots';slides.forEach((_,i)=>{const b=document.createElement('button');b.type='button';b.title='الصورة '+(i+1);b.ariaLabel='الصورة '+(i+1);b.className=i===0?'active':'';b.addEventListener('click',()=>activate(i));indicators.append(b)});root.append(indicators)}
    const activate=i=>{pos=(i+slides.length)%slides.length;[...view.children].forEach((f,j)=>{f.classList.toggle('active',j===pos);f.setAttribute('aria-hidden',j===pos?'false':'true')});if(indicators)$$('button',indicators).forEach((b,j)=>b.classList.toggle('active',j===pos));if(opts.onChange)opts.onChange(slides[pos]);};
    if(slides.length>1){let hold=false;root.addEventListener('mouseenter',()=>hold=true);root.addEventListener('mouseleave',()=>hold=false);root.addEventListener('focusin',()=>hold=true);root.addEventListener('focusout',()=>hold=false);
      const tick=()=>{if(!root.isConnected)return;const delay=n(slides[pos]?.duration_seconds,n(defaultSeconds))*1000;
        later(()=>{if(!root.isConnected)return;if(canRotate()&&!hold)activate(pos+1);tick()},delay);
      };if(canRotate())tick();}
    return activate;
  }
  function renderCards(){const shop=$('#shop');if(!shop||!S.categories.length)return;
    let section=$('#jvCategoryDeck');if(!section){section=document.createElement('section');section.id='jvCategoryDeck';section.className='jv-deck';shop.insertBefore(section,shop.firstChild)}
    section.innerHTML=`<div class="jv-deck-top"><div><span class="jv-tag">✦ JOKER COLLECTIONS</span><h2>تسوّق حسب <em>القسم</em></h2><p>اكتشف صور الأقسام المتجددة واضغط على أي قسم لتصفّح منتجاته.</p></div><div class="jv-deck-count">${S.categories.length} قسم</div></div><div class="jv-deck-strip" id="jvCards"></div>`;
    const cards=$('#jvCards',section);
    S.categories.forEach(c=>{const slides=gallery(c.id);const card=document.createElement('button');card.type='button';card.className='jv-cat-card';card.dataset.category=c.id;
      card.innerHTML=`<span class="jv-cat-photo"></span><span class="jv-cat-name">${esc(c.name)}</span><span class="jv-cat-action">اكتشف المنتجات ←</span>`;
      cards.append(card);
      if(slides.length)rotateFrames($('.jv-cat-photo',card),slides,S.settings.category_duration_seconds,{alt:c.name});
      else $('.jv-cat-photo',card).innerHTML='<span class="jv-cat-empty">🃏</span>';
      card.onclick=()=>{const chip=$$('#categories [data-cat]').find(x=>x.dataset.cat===String(c.id));if(chip)chip.click();else renderSpotlight(c.id);$('#jvCategorySpotlight')?.scrollIntoView({behavior:'smooth',block:'center'})};
    });
    cards.addEventListener('wheel',e=>{if(Math.abs(e.deltaY)>Math.abs(e.deltaX) && e.shiftKey){cards.scrollLeft+=e.deltaY}},{passive:true});
  }
  function findSelected(){return $('#categories .chip.active')?.dataset.cat||'all';}
  function renderSpotlight(category=findSelected()){
    const shop=$('#shop');if(!shop)return;let host=$('#jvCategorySpotlight');if(!host){host=document.createElement('div');host.id='jvCategorySpotlight';const chips=$('#categories');chips?.insertAdjacentElement('afterend',host)}
    const cat=S.categories.find(x=>String(x.id)===String(category));
    $$('.jv-cat-card').forEach(b=>b.classList.toggle('selected',b.dataset.category===String(category)));
    if(!cat){host.hidden=true;host.innerHTML='';return}
    const photos=gallery(cat.id);
    if(!photos.length){host.hidden=true;host.innerHTML='';return}
    host.hidden=false;host.className='jv-spotlight';
    host.innerHTML=`<div class="jv-spot-art"><div class="jv-spot-gallery"></div></div><div class="jv-spot-copy"><div class="jv-tag">✦ قسم مميز</div><h3>${esc(cat.name)}</h3><p id="jvSpotCaption">تابع صور هذا القسم، واستكشف منتجاتنا المتوفرة.</p><span class="jv-spot-hint">اسحب الصور أو استخدم النقاط للتنقل</span></div>`;
    rotateFrames($('.jv-spot-gallery',host),photos,S.settings.category_duration_seconds,{dots:true,alt:cat.name,onChange:(s)=>{$('#jvSpotCaption',host).textContent=s.caption||s.title||'استكشف منتجات هذا القسم'}});
    $('#jvSpotCaption',host).textContent=photos[0]?.caption||photos[0]?.title||'استكشف منتجات هذا القسم';
  }
  function renderBackgrounds(){for(const [area,selector] of [['shop','#shop'],['offers','#featuredOffers'],['games','#jokerPremiumGames']]){
      const el=$(selector);if(!el)continue;const old=$('.jv-section-art',el);if(old)old.remove();el.classList.remove('jv-has-bg');el.classList.toggle('jv-no-old-bg',S.settings[area+'_original_enabled']===false);const slides=imagesFor(area);if(!slides.length)continue;
      el.classList.add('jv-has-bg');const root=document.createElement('div');root.className='jv-section-art';root.setAttribute('aria-hidden','true');el.insertBefore(root,el.firstChild);rotateFrames(root,slides,S.settings.background_duration_seconds);
    }}
  function refresh(){stopTimers();renderCards();renderSpotlight();renderBackgrounds();}
  async function reload(){if(!S.db)return;
    const [s,v,c,p]=await Promise.all([
      S.db.from('joker_visual_settings').select('*').eq('id',1).maybeSingle(),
      S.db.from('joker_visual_slides').select('*').eq('enabled',true).order('sort_order',{ascending:true}).order('created_at',{ascending:true}).limit(500),
      S.db.from('categories').select('id,name').order('name'),
      S.db.from('products').select('id,name,image_url,category_id,available').limit(1000)
    ]);
    if(s.error||v.error||c.error||p.error){console.warn('Visuals not available:',s.error?.message||v.error?.message||c.error?.message||p.error?.message);return;}
    S.settings={...empty,...(s.data||{})};S.slides=v.data||[];S.categories=c.data||[];S.products=(p.data||[]).filter(x=>x.available!==false);S.lastSync=Date.now();refresh();
  }
  async function ownerCheck(){try{const {data:{user}}=await S.db.auth.getUser();if(!user){S.owner=false;$('#jvAdminTab')?.remove();return;}
      const {data,error}=await S.db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();S.owner=!error&&!!data;if(S.owner)ensureTab();else $('#jvAdminTab')?.remove();
    }catch(e){console.warn('Visual owner check:',e);S.owner=false}}
  function ensureTab(){if(!S.owner)return;const t=$('#adminTabs');if(!t||$('#jvAdminTab',t))return;const b=document.createElement('button');b.type='button';b.id='jvAdminTab';b.textContent='🎨 صور الأقسام والخلفيات';b.onclick=()=>{t.querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');openManager().catch(displayError)};t.append(b)}
  function displayError(e){const el=$('#adminContent');if(el)el.innerHTML=`<p class="order-error">${esc(e?.message||String(e))}</p>`;}
  const scoped = row=>row.area===S.area && (S.area!=='category'||String(row.category_id)===String(S.cat));
  const counts = ()=>S.adminSlides.filter(scoped).length;
  function areaName(){return S.area==='category' ? S.categories.find(x=>String(x.id)===String(S.cat))?.name||'القسم' : sections[S.area]||S.area}
  async function fetchAdmin(){const [{data,error}, prod]=await Promise.all([S.db.from('joker_visual_slides').select('*').order('sort_order',{ascending:true}).order('created_at',{ascending:true}).limit(500),S.db.from('products').select('id,name,image_url,category_id').limit(1000)]);
    if(error)throw error;S.adminSlides=data||[];if(!prod.error)S.products=prod.data||[];if(!S.cat&&S.categories.length)S.cat=S.categories[0].id;}
  async function openManager(){if(!S.owner)throw Error('هذا القسم خاص بالمدير العام');await fetchAdmin();const el=$('#adminContent');if(!el||!$('#jvAdminTab')?.classList.contains('active'))return;
    el.innerHTML=`<section class="jv-admin"><div class="jv-admin-top"><div><span class="jv-tag">JOKER VISUAL CONTROL</span><h3>🎨 إدارة صور الأقسام والخلفيات</h3><p>تحكم من هاتفك في الصور المتحركة لكل قسم، وخلفيات المنتجات والعروض والألعاب.</p></div><button class="gold" type="button" id="jvNew" ${counts()>=MAX?'disabled':''}>+ إضافة صورة</button></div>
      <div class="jv-settings-card"><h4>⚙️ التوقيت العام</h4><form id="jvSettings"><div class="jv-fields"><label class="field"><span>مدة صور الأقسام (ثانية)</span><input name="category" type="number" min="1" max="3600" step="1" value="${n(S.settings.category_duration_seconds)}" required></label><label class="field"><span>مدة صور الخلفيات (ثانية)</span><input name="background" type="number" min="1" max="3600" step="1" value="${n(S.settings.background_duration_seconds,5)}" required></label></div>${S.area!=='category'?`<label class="jv-checkbox"><input type="checkbox" name="keep_original" ${S.settings[S.area+'_original_enabled']!==false?'checked':''}> الاحتفاظ بالخلفية القديمة إذا حذفت كل الصور المتحركة في هذا المكان</label>`:''}<button class="gold" type="submit">💾 حفظ التوقيت والخلفية</button></form></div>
      <div class="jv-settings-card"><h4>🖼️ اختر المكان الذي تريد تغييره</h4><div class="jv-fields"><label class="field"><span>نوع الصور</span><select id="jvArea"><option value="category" ${S.area==='category'?'selected':''}>🎴 صور أقسام المنتجات</option><option value="shop" ${S.area==='shop'?'selected':''}>${sections.shop}</option><option value="offers" ${S.area==='offers'?'selected':''}>${sections.offers}</option><option value="games" ${S.area==='games'?'selected':''}>${sections.games}</option></select></label><label class="field" id="jvCategoryField" ${S.area==='category'?'':'hidden'}><span>القسم</span><select id="jvCategory">${S.categories.map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(S.cat)?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div><p class="mute">الصور المضافة هنا مستقلة عن المنتجات. حذف صورة من المعرض لا يحذف أي منتج من المتجر.</p></div>
      <div class="jv-admin-list-heading"><h4>${esc(areaName())} — الصور (${counts()}/${MAX})</h4></div><div class="jv-admin-rows">${S.adminSlides.filter(scoped).map((row,i,arr)=>`<div class="jv-admin-row"><img src="${esc(validImage(row.image_url))}" alt=""><div class="jv-admin-row-info"><b>${esc(row.title||'تصميم بدون عنوان')}</b><small>${row.enabled?'🟢 ظاهر':'⚪ مخفي'} · ${row.duration_seconds?row.duration_seconds+' ثانية':'المدة العامة'}</small></div><div class="jv-admin-buttons"><button type="button" data-jv-move="up" data-id="${esc(row.id)}" ${i===0?'disabled':''}>↑</button><button type="button" data-jv-move="down" data-id="${esc(row.id)}" ${i===arr.length-1?'disabled':''}>↓</button><button type="button" data-jv-edit="${esc(row.id)}">تعديل</button><button type="button" data-jv-toggle="${esc(row.id)}">${row.enabled?'إخفاء':'إظهار'}</button><button type="button" class="jv-danger" data-jv-delete="${esc(row.id)}">حذف</button></div></div>`).join('')||'<p class="mute">لا توجد صور مخصصة هنا بعد. اضغط «إضافة صورة» لرفع صورك. صور المنتجات الحالية تظهر تلقائياً كبديل في بطاقات الأقسام.</p>'}</div>
      <p class="jv-admin-tip">يمكنك إضافة حتى 10 صور لكل قسم أو خلفية، وتحديد 1 إلى 3600 ثانية لأي صورة. الصور JPG / PNG / WebP حتى 5 ميغابايت.</p>
      </section>`;
    $('#jvNew',el)?.addEventListener('click',()=>editor());$('#jvArea',el).onchange=e=>{S.area=e.target.value;openManager().catch(displayError)};
    $('#jvCategory',el)?.addEventListener('change',e=>{S.cat=e.target.value;openManager().catch(displayError)});
    $('#jvSettings',el).onsubmit=saveSettings;
    $$('[data-jv-edit]',el).forEach(b=>b.onclick=()=>editor(S.adminSlides.find(x=>x.id===b.dataset.jvEdit)));
    $$('[data-jv-toggle]',el).forEach(b=>b.onclick=()=>toggle(b.dataset.jvToggle));
    $$('[data-jv-delete]',el).forEach(b=>b.onclick=()=>remove(b.dataset.jvDelete));
    $$('[data-jv-move]',el).forEach(b=>b.onclick=()=>move(b.dataset.id,b.dataset.jvMove));
  }
  function editor(original=null){const el=$('#adminContent');if(!el)return;const options=S.products.filter(p=>p.image_url&&(S.area!=='category'||String(p.category_id)===String(S.cat)));
    el.innerHTML=`<section class="jv-admin"><div class="jv-admin-top"><div><span class="jv-tag">JOKER VISUAL CONTROL</span><h3>${original?'✏️ تعديل':'🖼️ إضافة'} صورة — ${esc(areaName())}</h3></div><button class="outline" type="button" id="jvBack">رجوع</button></div>
    <form id="jvEditor" class="jv-settings-card">${original?`<img class="jv-editor-cover" src="${esc(validImage(original.image_url))}" alt="الصورة الحالية">`:''}
    <label class="field"><span>اختر صورة جديدة من هاتفك</span><input name="file" type="file" accept="image/jpeg,image/png,image/webp"><small>ارفع صورة بديلة في أي وقت؛ اتركها فارغة للإبقاء على الصورة الحالية.</small></label>
    <label class="field"><span>أو استخدم صورة منتج موجود (اختياري)</span><select name="product"><option value="">— بدون اختيار —</option>${options.map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></label>
    <label class="field"><span>عنوان اختياري يظهر مع الصور</span><input name="title" maxlength="100" value="${esc(original?.title||'')}" placeholder="مثلاً: أحدث السماعات والملحقات"></label>
    <label class="field"><span>وصف اختياري</span><textarea name="caption" maxlength="230" rows="2">${esc(original?.caption||'')}</textarea></label>
    <label class="field"><span>مدة هذه الصورة بالثواني (اختياري)</span><input name="duration" type="number" min="1" max="3600" step="1" value="${esc(original?.duration_seconds??'')}" placeholder="اتركها فارغة للمدة العامة"></label>
    <label class="jv-checkbox"><input name="enabled" type="checkbox" ${original?.enabled!==false?'checked':''}> الصورة ظاهرة للزبائن</label>
    <p id="jvEditorError" role="alert"></p><button type="submit" id="jvSave" class="gold">💾 ${original?'حفظ التغييرات':'إضافة الصورة'}</button>
    </form></section>`;
    $('#jvBack',el).onclick=()=>openManager().catch(displayError);$('#jvEditor',el).onsubmit=e=>save(e,original);
  }
  async function saveSettings(e){e.preventDefault();if(S.busy)return;const f=new FormData(e.target),c=Number(f.get('category')),b=Number(f.get('background'));if(!Number.isInteger(c)||c<1||c>3600||!Number.isInteger(b)||b<1||b>3600){notify('التوقيت يجب أن يكون بين 1 و3600 ثانية');return}
    S.busy=true;try{const payload={id:1,category_duration_seconds:c,background_duration_seconds:b,updated_at:new Date().toISOString()};if(S.area!=='category')payload[S.area+'_original_enabled']=!!e.target.elements.keep_original.checked;const {error}=await S.db.from('joker_visual_settings').upsert(payload,{onConflict:'id'});if(error)throw error;await reload();notify('✅ تم تعديل سرعة صور الأقسام والخلفيات')}
    catch(e){notify('تعذر الحفظ: '+e.message)}finally{S.busy=false}}
  async function save(e,original){e.preventDefault();if(S.busy)return;const form=e.currentTarget,f=new FormData(form),errorBox=$('#jvEditorError',form);errorBox.textContent='';
    const durationText=String(f.get('duration')||'').trim();const duration=durationText?Number(durationText):null;
    if(duration!==null&&(!Number.isInteger(duration)||duration<1||duration>3600)){errorBox.textContent='المدة يجب أن تكون بين 1 و3600 ثانية';return}
    let url=original?.image_url||'';
    const photo=form.elements.file.files?.[0], productId=String(f.get('product')||''),prod=S.products.find(p=>String(p.id)===productId);
    if(productId&&!prod){errorBox.textContent='المنتج غير متوفر';return}
    if(prod?.image_url)url=prod.image_url;
    if(photo&&(!allowed.includes(photo.type)||photo.size>5*1024*1024)){errorBox.textContent='استخدم JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميغابايت';return}
    if(!url&&!photo){errorBox.textContent='اختر صورة أو أحد المنتجات التي تحتوي على صورة';return}
    if(!original&&counts()>=MAX){errorBox.textContent='الحد الأقصى 10 صور في هذا القسم';return}
    let uploadedPath='';S.busy=true;const btn=$('#jvSave');btn.disabled=true;
    try{if(photo){const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[photo.type];uploadedPath='visuals/'+crypto.randomUUID()+'.'+ext;const uploaded=await S.db.storage.from(BUCKET).upload(uploadedPath,photo,{contentType:photo.type,upsert:false});if(uploaded.error)throw uploaded.error;url=S.db.storage.from(BUCKET).getPublicUrl(uploadedPath).data.publicUrl}
      if(!validImage(url))throw Error('الصورة غير صالحة');
      const row={area:S.area,category_id:S.area==='category'?S.cat:null,image_url:url,title:String(f.get('title')||'').trim().slice(0,100),caption:String(f.get('caption')||'').trim().slice(0,230),duration_seconds:duration,enabled:form.elements.enabled.checked,sort_order:original?.sort_order??((S.adminSlides.filter(scoped).at(-1)?.sort_order||0)+10)};
      const query=original?S.db.from('joker_visual_slides').update(row).eq('id',original.id):S.db.from('joker_visual_slides').insert(row);
      const {error}=await query;if(error)throw error;
      if(original?.image_url && original.image_url!==url)await cleanupOwned(original.image_url,original.id);
      await reload();await openManager();notify('✅ تم حفظ الصورة والتوقيت');
    }catch(err){errorBox.textContent='تعذر الحفظ: '+(err?.message||String(err));if(uploadedPath)await S.db.storage.from(BUCKET).remove([uploadedPath]);}
    finally{S.busy=false;if(btn?.isConnected)btn.disabled=false}
  }
  function ownedPath(url){try{const u=new URL(url),base=new URL(cfg.supabaseUrl);const prefix='/storage/v1/object/public/'+BUCKET+'/visuals/';if(u.origin!==base.origin||!u.pathname.startsWith(prefix))return null;const tail=decodeURIComponent(u.pathname.slice(prefix.length));return tail&&!tail.includes('/')&&!tail.includes('..')?'visuals/'+tail:null}catch{return null}}
  async function cleanupOwned(url,exceptId){const path=ownedPath(url);if(!path)return;const {data,error}=await S.db.from('joker_visual_slides').select('id').eq('image_url',url).limit(2);if(error||data?.some(x=>String(x.id)!==String(exceptId)))return;const old=await S.db.storage.from(BUCKET).remove([path]);if(old.error)console.warn('Visual media cleanup:',old.error.message)}
  async function toggle(id){if(S.busy)return;const current=S.adminSlides.find(x=>x.id===id);if(!current)return;S.busy=true;try{const {error}=await S.db.from('joker_visual_slides').update({enabled:!current.enabled}).eq('id',id);if(error)throw error;await reload();await openManager()}catch(e){notify('تعذر التغيير: '+e.message)}finally{S.busy=false}}
  async function remove(id){const current=S.adminSlides.find(x=>x.id===id);if(!current||S.busy||!confirm('هل تريد حذف الصورة من هذا المعرض؟ لن يتم حذف المنتج الأصلي.'))return;S.busy=true;
    try{const {error}=await S.db.from('joker_visual_slides').delete().eq('id',id);if(error)throw error;await cleanupOwned(current.image_url,id);await reload();await openManager();notify('✅ حذفت الصورة من المعرض')}
    catch(e){notify('تعذر الحذف: '+e.message)}finally{S.busy=false}}
  async function move(id,direction){if(S.busy)return;const rows=S.adminSlides.filter(scoped);const i=rows.findIndex(x=>x.id===id),j=i+(direction==='up'?-1:1);if(i<0||j<0||j>=rows.length)return;[rows[i],rows[j]]=[rows[j],rows[i]];S.busy=true;
    try{for(let k=0;k<rows.length;k++){const {error}=await S.db.from('joker_visual_slides').update({sort_order:(k+1)*10}).eq('id',rows[k].id);if(error)throw error}await reload();await openManager()}
    catch(e){notify('تعذر تغيير الترتيب: '+e.message)}finally{S.busy=false}}
  async function init(){if(!cfg.supabaseUrl||!cfg.supabasePublishableKey)return;const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.8');S.db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
    await reload();await ownerCheck();const shade=$('#shade');if(shade){S.observer=new MutationObserver(ensureTab);S.observer.observe(shade,{childList:true,subtree:true});}
    // Listen to existing app category selection; it redraws chips whenever a category is changed.
    const chips=$('#categories');if(chips){let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;renderSpotlight()})}).observe(chips,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});}
    // Premium games are mounted after page initialization.
    const games=$('#jokerPremiumGames');if(!games){let tries=0;const poll=setInterval(()=>{tries++;if($('#jokerPremiumGames')){clearInterval(poll);renderBackgrounds()}else if(tries>=30)clearInterval(poll)},1000)}
    S.db.auth.onAuthStateChange(()=>setTimeout(ownerCheck,100));document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-S.lastSync>30000)reload()});
    setInterval(()=>{if(!document.hidden)reload()},90000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>init().catch(console.error),{once:true});else init().catch(console.error);
})();
