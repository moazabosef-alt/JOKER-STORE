/* JOKER STORE PREMIUM V5 (single integrated visual & games enhancement)
 * Existing app.js, product/cart/order handlers and staff auth stay untouched.
 * Public reads and owner-only writes use database RLS on new tables.
 */
(() => {
  'use strict';
  const cfg = window.JOKER_CONFIG || {};
  const q = (selector, root=document) => root.querySelector(selector);
  const qa = (selector, root=document) => [...root.querySelectorAll(selector)];
  const esc = input => String(input ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => Number(n).toFixed(2) + ' د.ل';
  const PHOTO_BUCKET = 'product-images';
  const WHATSAPP = [{label:'0915206879',value:'218915206879'},{label:'0923319182',value:'218923319182'},{label:'0925206879',value:'218925206879'}];
  const DEVICES = [{id:'PS3',label:'PlayStation 3',img:'assets/joker-ps3-3d.webp'},
                   {id:'PS4',label:'PlayStation 4',img:'assets/joker-ps4-3d.webp'},
                   {id:'PS5',label:'PlayStation 5',img:'assets/joker-ps5-3d.webp'}];
  const MODES = [{id:'offline',icon:'📴',label:'أوفلاين',english:'Offline'},
                 {id:'online',icon:'🌐',label:'أونلاين',english:'Online'},
                 {id:'modified',icon:'🛠️',label:'أجهزة معدلة',english:'Modified'}];
  const S = {db:null,games:[],categories:[],backgrounds:new Map(),platform:'PS4',mode:'offline',search:'',
             currentAdminTab:'games',currentBackground:'hero',editId:null,cloneImage:'',isOwner:false,
             inquiryIds:new Set(),saving:false,selectedSlide:0,slidesTimer:0};
  const prefMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  function safeList(){try {const a=JSON.parse(localStorage.getItem('joker_v5_games_list')||'[]');return Array.isArray(a)?a.filter(x=>typeof x==='string'):[]}catch{return []}}
  S.inquiryIds=new Set(safeList());
  function persistList(){try{localStorage.setItem('joker_v5_games_list',JSON.stringify([...S.inquiryIds]))}catch{}}
  const alertMsg = text => {const area=q('#jpStatus');if(area){area.textContent=text;area.scrollIntoView({block:'nearest',behavior:'smooth'});}else alert(text)};
  function host(id){const el=typeof id==='string'?q(id):id;if(!el)return null;el.classList.add('jp-bg-host');
    if(!q('.jp-bg-image',el))el.insertAdjacentHTML('afterbegin','<div class="jp-bg-image"></div><div class="jp-bg-veil"></div>');return el}
  function applyBg(selector,key){const el=host(selector);if(!el)return;const s=S.backgrounds.get(key)||S.backgrounds.get(key.split(':')[0]);
    const img=q('.jp-bg-image',el);if(!img)return;img.style.backgroundImage=s?.image_url?`url(${JSON.stringify(s.image_url)})`:'';
    img.style.opacity=String((s?.opacity??22)/100);
    img.dataset.motion=s?.motion||'soft';el.style.setProperty('--jp-veil',String((s?.overlay??75)/100));}
  function currentCategory(){return q('#categories .chip.active')?.dataset?.cat;}
  function refreshBackgrounds(){applyBg('.hero','hero');applyBg('#featuredOffers','offers');applyBg('#jokerPremiumGames','games');
    const cat=currentCategory();applyBg('#shop',cat && !['all','offer','fav'].includes(cat)?'category:'+cat:'shop');
    const hero=q('.hero');if(hero && !q('.jp-fallback-console',hero)){
      const fallback=document.createElement('img');fallback.className='jp-fallback-console';fallback.src='assets/joker-ps5-3d.webp';fallback.alt='';fallback.setAttribute('aria-hidden','true');hero.append(fallback);
    }
    if(hero)q('.jp-fallback-console',hero).style.display=S.backgrounds.get('hero')?.image_url?'none':'';
    scheduleParallax();
  }
  let raf=0;
  function scheduleParallax(){if(raf)return;raf=requestAnimationFrame(()=>{raf=0;const reduced=prefMotion?.matches;
    qa('.jp-bg-image').forEach(el=>{const motion=el.dataset.motion;if(reduced||motion==='off'){el.style.transform='translate3d(0,0,0)';return;}
      const r=el.parentElement.getBoundingClientRect();const middle=r.top+r.height/2;
      const offset=Math.max(-55,Math.min(55,(innerHeight/2-middle)*(motion==='medium'?0.11:0.045)));
      el.style.transform=`translate3d(0,${offset.toFixed(1)}px,0)`;});});}
  function deviceButtons(){return DEVICES.map(d=>`<button type="button" class="jp-console ${S.platform===d.id?'jp-selected':''}" data-jp-platform="${d.id}" data-platform="${d.id}" aria-pressed="${S.platform===d.id}">
    <img src="${d.img}" loading="lazy" alt="مجسم ثلاثي الأبعاد لجهاز ${d.label}"><b>${d.label}</b><span>استكشف ألعاب ${d.id}</span></button>`).join('');}
  function renderModes(){const parent=q('#jpModeWrap');if(!parent)return;
    parent.innerHTML=S.platform==='PS3'?'<div class="jp-scroll-pill">🎮 جميع ألعاب PS3</div>':MODES.map(m=>`<button type="button" data-jp-mode="${m.id}" class="jp-mode ${S.mode===m.id?'jp-active':''}" aria-pressed="${S.mode===m.id}"><span>${m.icon}</span><small>${m.label}</small></button>`).join('');}
  function gamePrice(g){return g.pricing_type==='fixed'?money(g.price):'السعر حسب الطلب'}
  function isNew(g){return new Date(g.created_at).getTime()>Date.now()-14*86400000;}
  function gameCard(g){const mode=MODES.find(m=>m.id===g.game_mode),badge=mode?.label||'PS3';return `<article class="jp-game">
    <div class="jp-game-art">${g.image_url?`<img src="${esc(g.image_url)}" alt="غلاف لعبة ${esc(g.title)}" loading="lazy" onerror="this.replaceWith(document.createTextNode('🎮'))">`:'<span class="jp-art-fallback" aria-hidden="true">🎮</span>'}
      <span class="jp-chip">${esc(g.platform)} · ${esc(badge)}</span></div>
    <div class="jp-game-info"><h3>${esc(g.title)}</h3>
      <div class="jp-game-sub">${g.featured?'⭐ ترشيحات الجوكر · ':''}${isNew(g)?'🆕 وصل حديثًا':'🎮 متوفر للاستفسار'}</div>
      <div class="jp-game-price">${esc(gamePrice(g))}</div>
      <div class="jp-game-buttons"><button type="button" class="jp-btn" data-jp-add="${esc(g.id)}">${g.pricing_type==='fixed'?'🛍️ اطلب اللعبة':'💬 استفسر عن السعر'}</button>
      <button type="button" class="jp-btn jp-outline" data-jp-details="${esc(g.id)}" aria-label="تفاصيل اللعبة">تفاصيل</button></div>
    </div></article>`;}
  function filteredGames(){return S.games.filter(g=>g.available && g.platform===S.platform && (S.platform==='PS3'||g.game_mode===S.mode)
    && (!S.search || (g.title+' '+(g.description||'')).toLowerCase().includes(S.search.toLowerCase())));}
  function renderGames(){const root=q('#jpGamesGrid');if(!root)return;
    qa('[data-jp-platform]').forEach(b=>{b.classList.toggle('jp-selected',b.dataset.jpPlatform===S.platform);b.setAttribute('aria-pressed',String(b.dataset.jpPlatform===S.platform));});
    renderModes();const items=filteredGames();root.innerHTML=items.length?items.map(gameCard).join(''):'<div class="jp-empty">🎮 لا توجد ألعاب معروضة في هذا التصنيف حاليًا. تابعنا، الألعاب الجديدة تُضاف هنا.</div>';
    const count=q('#jpCount');if(count)count.textContent=items.length+' لعبة';
    const selected=S.games.filter(x=>x.available&&x.featured).slice(0,12),featured=q('#jpFeatured');
    if(featured){featured.innerHTML=selected.length?selected.map(gameCard).join(''):'<div class="jp-empty">ستظهر هنا الألعاب التي يختارها المدير ضمن ترشيحات الجوكر.</div>';}
    const newGames=S.games.filter(x=>x.available&&isNew(x)).slice(0,12),latest=q('#jpLatest');
    if(latest)latest.innerHTML=newGames.length?newGames.map(gameCard).join(''):'<div class="jp-empty">ستظهر هنا الألعاب التي تُضاف حديثًا.</div>';
    const c=q('#jpInquiryCounter');if(c)c.textContent=S.inquiryIds.size;}
  function gameSection(){const section=document.createElement('section');section.id='jokerPremiumGames';section.className='jp-genre';section.innerHTML=`
    <div class="jp-header"><div><div class="jp-kicker">✦ JOKER GAME ZONE ✦</div><h2 class="jp-title">🎮 عالم <em>ألعاب البلايستيشن</em></h2><p class="jp-muted">PS3 • PS4 • PS5 — صور الألعاب، خيارات التشغيل، والسعر الحالي حسب الطلب</p></div><button class="jp-scroll-pill" id="jpOpenBasket" type="button">💬 قائمة طلب الألعاب (<span id="jpInquiryCounter">0</span>)</button></div>
    <div class="jp-consoles">${deviceButtons()}</div><div class="jp-modes" id="jpModeWrap"></div>
    <div class="jp-game-toolbar"><strong id="jpCount">0 لعبة</strong><input class="jp-search" id="jpSearch" type="search" placeholder="ابحث عن لعبة بالاسم..." aria-label="ابحث عن لعبة"></div>
    <div class="jp-game-grid" id="jpGamesGrid"><div class="jp-empty">جاري تحميل ألعاب الجوكر...</div></div>
    <div class="jp-carousel-wrap"><div class="jp-carousel-label">🔥 ترشيحات الجوكر <div class="jp-action-row"><button type="button" class="jp-btn jp-outline" data-jp-scroll="featured:-1">❯</button><button type="button" class="jp-btn jp-outline" data-jp-scroll="featured:1">❮</button></div></div><div class="jp-featured" id="jpFeatured"></div></div>
    <div class="jp-carousel-wrap"><div class="jp-carousel-label">🆕 وصل حديثًا</div><div class="jp-featured" id="jpLatest"></div></div>
    <p class="jp-footnote">الأسعار المتغيرة يتم تأكيدها عند الاستفسار. جميع الرسائل تُفتح في واتساب ليؤكد الزبون إرسالها.</p>`;
    const shop=q('#shop'),offers=q('#featuredOffers');if(shop)shop.before(section);else if(offers)offers.after(section);else q('main')?.append(section);
    section.addEventListener('click',e=>{const device=e.target.closest('[data-jp-platform]');if(device){S.platform=device.dataset.jpPlatform;S.mode='offline';S.search='';q('#jpSearch').value='';renderGames();return;}
      const mode=e.target.closest('[data-jp-mode]');if(mode){S.mode=mode.dataset.jpMode;renderGames();return;}
      const add=e.target.closest('[data-jp-add]');if(add){const g=S.games.find(x=>x.id===add.dataset.jpAdd);if(g){S.inquiryIds.add(g.id);persistList();renderGames();openBasket();}return;}
      const details=e.target.closest('[data-jp-details]');if(details){const g=S.games.find(x=>x.id===details.dataset.jpDetails);if(g)openDetails(g);return;}
      const scroll=e.target.closest('[data-jp-scroll]');if(scroll){const [where,sign]=scroll.dataset.jpScroll.split(':');q(where==='featured'?'#jpFeatured':'#jpLatest')?.scrollBy({left:Number(sign)*230,behavior:'smooth'});return;}});
    q('#jpSearch').addEventListener('input',e=>{S.search=e.target.value.trim();renderGames()});q('#jpOpenBasket').onclick=openBasket;
    renderGames();return section;}
  function createDialog(){const shade=document.createElement('div');shade.className='jp-drawer-back';shade.id='jpDialogBack';shade.innerHTML='<div class="jp-drawer" role="dialog" aria-modal="true" aria-label="متجر الجوكر"><div class="jp-top"><h2 id="jpDialogTitle"></h2><button type="button" id="jpDialogClose" class="jp-close">✕ إغلاق</button></div><div id="jpDialogBody"></div></div>';document.body.append(shade);
    q('#jpDialogClose').onclick=closeDialog;shade.addEventListener('click',e=>{if(e.target===shade)closeDialog()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&shade.classList.contains('jp-open'))closeDialog()});}
  function openDialog(title,content){q('#jpDialogTitle').textContent=title;q('#jpDialogBody').innerHTML=content;q('#jpDialogBack').classList.add('jp-open');}
  function closeDialog(){q('#jpDialogBack').classList.remove('jp-open')}
  function openDetails(g){const m=MODES.find(x=>x.id===g.game_mode)?.label||'ألعاب PS3';openDialog('🎮 تفاصيل اللعبة',
    `<div class="jp-panel">${g.image_url?`<img src="${esc(g.image_url)}" alt="${esc(g.title)}" style="max-height:250px;width:100%;object-fit:contain">`:''}<h3>${esc(g.title)}</h3><p>الجهاز: ${esc(g.platform)} | النوع: ${esc(m)}</p><p>${esc(g.description)}</p><strong>${esc(gamePrice(g))}</strong></div><button type="button" class="jp-btn" id="jpDetailAdd">إضافة إلى قائمة طلب الألعاب</button>`);
    q('#jpDetailAdd').onclick=()=>{S.inquiryIds.add(g.id);persistList();renderGames();openBasket()};}
  function openBasket(){const items=[...S.inquiryIds].map(id=>S.games.find(g=>g.id===id)).filter(Boolean);const content=items.length?items.map(g=>`<div class="jp-admin-row"><span><strong>${esc(g.title)}</strong><br><small>${esc(g.platform)} · ${esc(MODES.find(m=>m.id===g.game_mode)?.label||'PS3')} · ${esc(gamePrice(g))}</small></span><button class="jp-btn jp-outline" data-jp-remove="${esc(g.id)}">إزالة</button></div>`).join(''):'<p class="jp-muted">قائمة طلب الألعاب فارغة.</p>';
    openDialog('💬 قائمة الاستفسار عن الألعاب',`${content}<div class="jp-panel"><label for="jpSendPhone">رقم التواصل الذي تريد مراسلته</label><select id="jpSendPhone">${WHATSAPP.map((n,i)=>`<option value="${n.value}">${n.label}</option>`).join('')}</select><p class="jp-footnote">يفتح واتساب برسالة جاهزة؛ يلزم الزبون الضغط على إرسال داخل واتساب. لا تُرسل الرسائل تلقائيًا.</p><button type="button" class="jp-btn" id="jpSendInquiry" ${items.length?'':'disabled'}>فتح واتساب لإرسال الاستفسار</button></div>`);
    qa('[data-jp-remove]',q('#jpDialogBody')).forEach(b=>b.onclick=()=>{S.inquiryIds.delete(b.dataset.jpRemove);persistList();renderGames();openBasket()});
    const send=q('#jpSendInquiry');if(send)send.onclick=()=>{const list=[...S.inquiryIds].map(id=>S.games.find(x=>x.id===id)).filter(Boolean);if(!list.length)return;
      const lines=list.map((g,i)=>`${i+1}- ${g.title} | ${g.platform} | ${MODES.find(m=>m.id===g.game_mode)?.label||'PS3'} | ${gamePrice(g)}`).join('\n');
      const txt=`السلام عليكم، نبي نستفسر ونطلب الألعاب التالية من متجر الجوكر:\n${lines}\nهل متوفرة؟ ونبي تأكيد الأسعار الحالية وطريقة الاستلام. شكرًا.`;
      window.open(`https://wa.me/${q('#jpSendPhone').value}?text=${encodeURIComponent(txt)}`,'_blank','noopener,noreferrer');};}
  async function uploadFile(file,prefix){if(!file||!file.size)return null;
    if(file.size>5*1024*1024)throw Error('حجم الصورة يجب ألا يتجاوز 5 ميغابايت');
    const ext={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type];if(!ext)throw Error('استخدم JPG أو PNG أو WebP');
    const id=crypto.randomUUID();const path=`premium/${prefix}/${id}.${ext}`;
    const {error}=await S.db.storage.from(PHOTO_BUCKET).upload(path,file,{contentType:file.type,upsert:false});if(error)throw error;
    return S.db.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;}
  async function reload(){if(!S.db)return;
    const [g,b,c]=await Promise.all([S.db.from('joker_premium_games').select('*').order('created_at',{ascending:false}).limit(500),
      S.db.from('joker_premium_backgrounds').select('*'),S.db.from('categories').select('id,name').order('name')]);
    if(g.error)throw g.error;if(b.error)throw b.error;
    S.games=g.data||[];S.backgrounds=new Map((b.data||[]).map(x=>[x.section_key,x]));S.categories=c.data||[];
    S.inquiryIds=new Set([...S.inquiryIds].filter(id=>S.games.some(x=>x.id===id)));persistList();renderGames();refreshBackgrounds();}
  async function detectOwner(){if(!S.db)return;
    try{const {data:{user},error}=await S.db.auth.getUser();if(error||!user){S.isOwner=false;q('#jpManage')?.remove();return;}
      const {data, error:err}=await S.db.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();
      if(err||!data){S.isOwner=false;q('#jpManage')?.remove();return;}S.isOwner=true;const parent=q('.topactions');if(parent&&!q('#jpManage')){
        const b=document.createElement('button');b.type='button';b.id='jpManage';b.className='jp-manager-launch';b.textContent='🎨 ألعاب وخلفيات';b.onclick=openManager;parent.insertBefore(b,parent.firstChild);}
    }catch(e){console.warn('Premium owner check:',e?.message||e);}}
  const MODES_ALLOWED=['offline','online','modified'];
  function formTemplate(game){const edit=!!game;const platform=game?.platform||'PS4';const mode=game?.game_mode||'offline';
    return `<form id="jpGameForm"><div class="jp-panels"><div class="jp-panel">
    <label>اسم اللعبة</label><input name="title" maxlength="150" required minlength="2" value="${esc(game?.title||'')}" placeholder="مثال: GTA V">
    <label>الجهاز</label><select name="platform" id="jpGamePlatform">${DEVICES.map(d=>`<option value="${d.id}" ${d.id===platform?'selected':''}>${d.label}</option>`).join('')}</select>
    <label>نوع التشغيل ${edit?'(تعديل النسخة المحددة)':'(يمكن اختيار أكثر من نوع)'}</label><div class="jp-checks" id="jpGameModes"></div>
    <label>وصف وملاحظات</label><textarea name="description" rows="3" placeholder="معلومات اللعبة ومتطلبات التشغيل">${esc(game?.description||'')}</textarea>
    </div><div class="jp-panel"><label>طريقة عرض السعر</label><select name="pricing_type" id="jpPriceType"><option value="inquiry" ${game?.pricing_type!=='fixed'?'selected':''}>السعر حسب الطلب</option><option value="fixed" ${game?.pricing_type==='fixed'?'selected':''}>سعر ثابت</option></select>
    <label>السعر بالدينار الليبي</label><input name="price" id="jpGamePrice" type="number" step=".01" min="0.01" value="${game?.price??''}" placeholder="يُترك فارغًا للسعر حسب الطلب">
    <label>صورة غلاف اللعبة (حتى 5 MB)</label><input name="photo" type="file" accept="image/jpeg,image/png,image/webp">
    ${game?.image_url?`<p class="jp-footnote">الصورة الحالية ستبقى إذا لم ترفع صورة جديدة.</p>`:''}
    <div class="jp-checks"><label><input type="checkbox" name="available" ${game?.available!==false?'checked':''}>متوفرة للعرض</label><label><input type="checkbox" name="featured" ${game?.featured?'checked':''}>⭐ مميزة</label></div>
    <p class="jp-footnote">${edit?'تعديل هذه النسخة فقط، ولن يتأثر تكرارها في أنواع أخرى.':'اختر عدة أنماط، وستُحفظ كل نسخة كسجل مستقل بنفس الصورة.'}</p></div></div>
    <div class="jp-action-row"><button class="jp-btn" type="submit">${edit?'💾 حفظ التعديل':'➕ إضافة اللعبة'}</button><button class="jp-btn jp-outline" type="button" id="jpCancelEdit">إلغاء</button></div><p class="jp-status" id="jpStatus" role="status"></p></form>`;}
  function refreshFormModes(existing){const type=q('#jpGamePlatform')?.value||'PS4',el=q('#jpGameModes');if(!el)return;
    if(type==='PS3'){el.innerHTML='<span class="jp-muted">🎮 ألعاب PS3: قسم واحد</span>';return;}
    const selected=existing?.game_mode||'offline';el.innerHTML=MODES.map(m=>`<label><input type="checkbox" name="game_mode" value="${m.id}" ${m.id===selected?'checked':''}> ${m.icon} ${m.label}</label>`).join('');
    if(existing){qa('input[name="game_mode"]',el).forEach(x=>x.onchange=()=>{if(x.checked)qa('input[name="game_mode"]',el).filter(y=>y!==x).forEach(y=>y.checked=false);});}}
  function bindGameForm(game){const form=q('#jpGameForm');if(!form)return;
    refreshFormModes(game);q('#jpGamePlatform').onchange=()=>refreshFormModes(null);q('#jpPriceType').onchange=()=>{
      const price=q('#jpGamePrice');price.disabled=q('#jpPriceType').value==='inquiry';if(price.disabled)price.value='';};q('#jpPriceType').onchange();
    q('#jpCancelEdit').onclick=()=>{S.editId=null;S.cloneImage='';openManager('games')};
    form.onsubmit=async e=>{e.preventDefault();if(S.saving)return;const f=new FormData(form);
      const platform=String(f.get('platform')),modes=platform==='PS3'?['standard']:f.getAll('game_mode').filter(m=>MODES_ALLOWED.includes(m));
      if(modes.length===0){alertMsg('اختر نوع تشغيل واحدًا على الأقل.');return;}
      if(S.editId&&modes.length!==1){alertMsg('عند تعديل نسخة موجودة، اختر نوعًا واحدًا فقط.');return;}
      const pricing_type=String(f.get('pricing_type'));const price=pricing_type==='fixed'?Number(f.get('price')):null;
      if(pricing_type==='fixed'&&(!Number.isFinite(price)||price<=0)){alertMsg('اكتب سعرًا ثابتًا أكبر من صفر.');return;}
      const base={title:String(f.get('title')||'').trim(),platform,description:String(f.get('description')||'').trim(),pricing_type,price,
        featured:f.has('featured'),available:f.has('available')};if(base.title.length<2){alertMsg('اكتب اسم اللعبة.');return;}
      S.saving=true;const btn=form.querySelector('button[type=submit]');btn.disabled=true;alertMsg('جاري حفظ اللعبة...');
      try{const photo=f.get('photo');const old=game?.image_url||S.cloneImage||null;const image_url=(photo instanceof File&&photo.size)?await uploadFile(photo,'games'):old;
        const rows=modes.map(game_mode=>({...base,game_mode,image_url}));
        const req=S.editId?S.db.from('joker_premium_games').update(rows[0]).eq('id',S.editId):S.db.from('joker_premium_games').insert(rows);
        const {error}=await req;if(error)throw error;
        S.editId=null;S.cloneImage='';await reload();openManager('games');alertMsg('✅ تم حفظ اللعبة بنجاح.');}
      catch(err){alertMsg('❌ تعذر حفظ اللعبة: '+(err?.message||err));btn.disabled=false;}
      finally{S.saving=false;}
    };
  }
  function gameAdmin(){const edit=S.games.find(x=>x.id===S.editId)||null;
    const intro='<p class="jp-muted">أضف اللعبة مرة واحدة واختر أوفلاين وأونلاين ومعدلة. كل نسخة مستقلة ويمكن تغيير سعرها لاحقًا. ألعاب PS3 تظهر في قسم واحد.</p>';
    const list=S.games.map(g=>`<div class="jp-admin-row"><span><strong>${esc(g.title)} — ${esc(g.platform)}</strong><br><small>${esc(MODES.find(m=>m.id===g.game_mode)?.label||'PS3')} | ${esc(gamePrice(g))} ${g.available?'':'| مخفية'}</small></span><span class="jp-action-row"><button type="button" class="jp-btn jp-outline" data-jp-edit="${esc(g.id)}">تعديل</button><button type="button" class="jp-btn jp-outline" data-jp-clone="${esc(g.id)}">نسخ</button><button type="button" class="jp-btn jp-outline" data-jp-delete="${esc(g.id)}">حذف</button></span></div>`).join('');
    q('#jpAdminContent').innerHTML=intro+formTemplate(edit)+`<h3>الألعاب المُضافة (${S.games.length})</h3><div class="jp-panel">${list||'<p class="jp-muted">لم تتم إضافة ألعاب بعد.</p>'}</div>`;
    bindGameForm(edit);
    qa('[data-jp-edit]').forEach(b=>b.onclick=()=>{S.editId=b.dataset.jpEdit;S.cloneImage='';openManager('games')});
    qa('[data-jp-clone]').forEach(b=>b.onclick=()=>{const g=S.games.find(x=>x.id===b.dataset.jpClone);if(!g)return;S.editId=null;S.cloneImage=g.image_url||'';
      openManager('games');const form=q('#jpGameForm');form.elements.title.value=g.title;form.elements.platform.value=g.platform;
      q('#jpGamePlatform').dispatchEvent(new Event('change'));/* Existing mode is selected by default in the new form. */
      form.elements.description.value=g.description||'';q('#jpPriceType').value=g.pricing_type;q('#jpPriceType').onchange();
      if(g.pricing_type==='fixed')q('#jpGamePrice').value=g.price;form.elements.featured.checked=g.featured;form.elements.available.checked=g.available;
      alertMsg('تم نسخ بيانات اللعبة. اختر الأنواع التي تبي تضيفها، ثم احفظ.');});
    qa('[data-jp-delete]').forEach(b=>b.onclick=async()=>{const g=S.games.find(x=>x.id===b.dataset.jpDelete);if(!g||!confirm(`حذف نسخة ${g.title} (${g.platform}) من ${MODES.find(m=>m.id===g.game_mode)?.label||'PS3'}؟ لا تتأثر النسخ الأخرى.`))return;
      const {error}=await S.db.from('joker_premium_games').delete().eq('id',g.id);if(error){alert('تعذر الحذف: '+error.message);return;}await reload();openManager('games');});}
  function sectionOptions(){const basic=[{key:'hero',name:'الواجهة الرئيسية'},{key:'games',name:'ألعاب البلايستيشن'},{key:'offers',name:'العروض المميزة'},{key:'shop',name:'كل المنتجات'}];return basic.concat(S.categories.map(c=>({key:'category:'+c.id,name:'القسم: '+c.name})));}
  function bgAdmin(){const options=sectionOptions();if(!options.some(x=>x.key===S.currentBackground))S.currentBackground='hero';
    const record=S.backgrounds.get(S.currentBackground)||{};
    q('#jpAdminContent').innerHTML=`<p class="jp-muted">غيّر صور الخلفيات من هاتفك أو الكمبيوتر، واضبط قوتها وحركة العمق لكل قسم بشكل مستقل. لا تُحذف الصورة القديمة عند تغييرها.</p>
      <form id="jpBgForm"><div class="jp-panels"><div class="jp-panel">
      <label>اختر القسم</label><select id="jpBgSection" name="section_key">${options.map(x=>`<option value="${esc(x.key)}" ${x.key===S.currentBackground?'selected':''}>${esc(x.name)}</option>`).join('')}</select>
      <label>ارفع صورة الخلفية (اختياري)</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp">
      <label>أو رابط صورة HTTPS (اختياري)</label><input type="url" name="url" id="jpBgUrl" value="${esc(record.image_url||'')}" placeholder="https://...">
      <p class="jp-footnote">الصيغ المسموحة PNG وJPG وWebP حتى 5MB. الصورة المرفوعة تتقدم على الرابط.</p>
      </div><div class="jp-panel">
      <label>قوة ظهور الصورة: <strong id="jpOValue">${record.opacity??22}%</strong></label><input type="range" name="opacity" min="0" max="100" value="${record.opacity??22}" id="jpO">
      <label>طبقة التعتيم: <strong id="jpVValue">${record.overlay??75}%</strong></label><input type="range" name="overlay" min="0" max="100" value="${record.overlay??75}" id="jpV">
      <label>حركة الخلفية عند التمرير</label><select name="motion"><option value="off" ${record.motion==='off'?'selected':''}>ثابتة</option><option value="soft" ${!record.motion||record.motion==='soft'?'selected':''}>هادئة</option><option value="medium" ${record.motion==='medium'?'selected':''}>متوسطة</option></select>
      <button type="button" class="jp-btn jp-outline" id="jpBgClear">إلغاء صورة هذا القسم</button>
      </div></div><div class="jp-panel" id="jpBgPreview" style="min-height:135px;background:linear-gradient(110deg,#160f18dc,#260e19c9),url(${esc(record.image_url||'assets/joker-ps5-3d.webp')}) center/cover;border-radius:13px"><h3 style="color:#ffd18b">معاينة الخلفية</h3><p>التحكم هنا مستقل عن خلفيات الأقسام الأخرى</p></div>
      <button class="jp-btn" type="submit">💾 حفظ الخلفية</button><p class="jp-status" id="jpStatus" role="status"></p></form>`;
    q('#jpBgSection').onchange=e=>{S.currentBackground=e.target.value;bgAdmin()};
    q('#jpO').oninput=e=>q('#jpOValue').textContent=e.target.value+'%';q('#jpV').oninput=e=>q('#jpVValue').textContent=e.target.value+'%';
    q('#jpBgClear').onclick=()=>{q('#jpBgUrl').value='';alertMsg('تم إلغاء اختيار الصورة في النموذج. اضغط حفظ الخلفية لتطبيق التغيير.');};
    q('#jpBgForm').onsubmit=async e=>{e.preventDefault();if(S.saving)return;S.saving=true;const f=new FormData(e.target);const btn=e.target.querySelector('button[type=submit]');btn.disabled=true;alertMsg('جاري حفظ إعدادات الخلفية...');
      try{const file=f.get('photo');let url=String(f.get('url')||'').trim();if(url&&(!url.startsWith('https://')||!/^https:\/\/[^\s]+$/i.test(url)))throw Error('رابط الصورة يجب أن يبدأ بـ https://');
        if(file instanceof File&&file.size)url=await uploadFile(file,'backgrounds');
        const payload={section_key:String(f.get('section_key')),image_url:url||null,opacity:Number(f.get('opacity')),overlay:Number(f.get('overlay')),motion:String(f.get('motion')),updated_at:new Date().toISOString()};
        const {error}=await S.db.from('joker_premium_backgrounds').upsert(payload,{onConflict:'section_key'});if(error)throw error;
        await reload();openManager('backgrounds');alertMsg('✅ تم حفظ الخلفية وتطبيقها.');}
      catch(err){alertMsg('❌ تعذر الحفظ: '+(err?.message||err));btn.disabled=false;}finally{S.saving=false;}};}
  function openManager(tab){if(!S.isOwner){alert('لوحة PREMIUM متاحة لحساب المدير العام فقط.');return;}
    S.currentAdminTab=tab==='backgrounds'?'backgrounds':'games';openDialog('🎨 إدارة ألعاب الجوكر والخلفيات',
      `<div class="jp-tabbar"><button type="button" class="jp-tab ${S.currentAdminTab==='games'?'jp-active':''}" data-jp-tab="games">🎮 إدارة الألعاب</button><button type="button" class="jp-tab ${S.currentAdminTab==='backgrounds'?'jp-active':''}" data-jp-tab="backgrounds">🖼️ خلفيات الأقسام</button></div><div id="jpAdminContent"></div>`);
    qa('[data-jp-tab]').forEach(b=>b.onclick=()=>{S.editId=null;S.cloneImage='';openManager(b.dataset.jpTab)});
    if(S.currentAdminTab==='games')gameAdmin();else bgAdmin();}
  async function init(){if(!cfg.supabaseUrl||!cfg.supabasePublishableKey){console.warn('JOKER PREMIUM: Supabase config missing');return;}
    const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.49.8');
    S.db=createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true}});
    gameSection();createDialog();
    q('#categories')&&new MutationObserver(()=>refreshBackgrounds()).observe(q('#categories'),{childList:true});
    window.addEventListener('scroll',scheduleParallax,{passive:true});window.addEventListener('resize',scheduleParallax,{passive:true});
    try{await reload()}catch(error){console.error('JOKER PREMIUM:',error);const el=q('#jpGamesGrid');if(el)el.innerHTML='<div class="jp-empty">تعذّر تحميل مكتبة الألعاب. تأكد من إعداد قاعدة البيانات PREMIUM V5.</div>';}
    await detectOwner();
    S.db.auth.onAuthStateChange(()=>setTimeout(detectOwner,100));
  }
  function begin(){init().catch(e=>console.error('JOKER PREMIUM initialization:',e));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin,{once:true});else begin();
})();
