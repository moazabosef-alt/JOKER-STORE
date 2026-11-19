/* JOKER STORE PREMIUM V5.4 (optional game size in GB per console)
 * General gallery: single cover, available console badges, no prices.
 * Choose device: jump to the same game inside that console's priced catalog.
 * Retains the V5.2 multi-console editor and optional per-variant pricing.
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
  const S = {db:null,games:[],categories:[],backgrounds:new Map(),platform:'all',mode:'all',search:'',
             selectedVariants:new Map(),cardPlatforms:new Map(),
             currentAdminTab:'games',currentBackground:'hero',editId:null,cloneImage:'',editGroupKey:null,cloneDraft:null,focusVariant:null,isOwner:false,
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
  // Smart Cards V5.3: one public gallery card per title; console catalogs show prices.
  // Underlying Supabase rows, pricing, images, owners and order identifiers remain unchanged.
  function gameKey(title){return String(title||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();}
  function groupGames(rows){const byName=new Map();
    rows.forEach(g=>{const key=gameKey(g.title);if(!key)return;
      if(!byName.has(key))byName.set(key,{key,title:g.title,variants:[]});
      byName.get(key).variants.push(g);
    });
    return [...byName.values()];
  }
  function allVisibleGroups(){return groupGames(S.games.filter(g=>g.available));}
  function renderModes(){const parent=q('#jpModeWrap');if(!parent)return;
    if(S.platform==='all'){
      parent.innerHTML='<span class="jp-scroll-pill">🕹️ استعرض صور الألعاب واختر جهازك لمعرفة أنواع التشغيل والأسعار</span>';return;
    }
    if(S.platform==='PS3'){
      parent.innerHTML='<span class="jp-scroll-pill">🎮 جميع ألعاب PS3</span>';return;
    }
    const options=[{id:'all',icon:'🎮',label:'كل الأنواع'},...MODES];
    parent.innerHTML=options.map(m=>`<button type="button" data-jp-mode="${m.id}" class="jp-mode ${S.mode===m.id?'jp-active':''}" aria-pressed="${S.mode===m.id}"><span>${m.icon}</span><small>${m.label}</small></button>`).join('');
  }
  function gamePrice(g){return g.pricing_type==='fixed'?money(g.price):'السعر حسب الطلب'}
  function gameSizeNumber(g){const n=g?.game_size_gb==null?null:Number(g.game_size_gb);return n!=null&&Number.isFinite(n)&&n>0?String(n):'';}
  function gameSize(g){const n=gameSizeNumber(g);return n?n+' جيجابايت':'';}
  function isNew(g){return new Date(g.created_at).getTime()>Date.now()-14*86400000;}
  function modeInfo(mode){return MODES.find(m=>m.id===mode)||{id:'standard',icon:'🎮',label:'نسخة PS3'};}
  function platformOrder(id){return ['PS3','PS4','PS5'].indexOf(id);}
  function currentVariant(group){
    const platform=S.platform==='all'?(S.cardPlatforms.get(group.key)||null):S.platform;
    let scope=platform?group.variants.filter(g=>g.platform===platform):group.variants;
    if(!scope.length)scope=group.variants;
    if(S.platform!=='all' && S.mode!=='all'){
      const modeScope=scope.filter(g=>g.game_mode===S.mode);
      if(modeScope.length)scope=modeScope;
    }
    return scope.find(g=>g.id===S.selectedVariants.get(group.key))||scope[0]||null;
  }
  // The all-games gallery is deliberately free of prices and mode-specific variants.
  // The data remains intact; visitors choose a console before viewing its prices.
  function galleryCard(group){
    const platforms=[...new Set(group.variants.map(v=>v.platform))].sort((a,b)=>platformOrder(a)-platformOrder(b));
    const cover=group.variants.find(v=>v.image_url)?.image_url;
    const featured=group.variants.some(v=>v.featured),fresh=group.variants.some(isNew);
    return `<article class="jp-game jp-smart-card jp-gallery-card" data-jp-game-key="${esc(group.key)}">
      <div class="jp-game-art">${cover?`<img src="${esc(cover)}" alt="غلاف لعبة ${esc(group.title)}" loading="lazy" onerror="this.replaceWith(document.createTextNode('🎮'))">`:'<span class="jp-art-fallback" aria-hidden="true">🎮</span>'}
        <span class="jp-chip jp-smart-cover-badge">${platforms.map(esc).join(' · ')}</span></div>
      <div class="jp-game-info"><h3>${esc(group.title)}</h3>
        <div class="jp-game-sub">${featured?'⭐ ترشيحات الجوكر · ':''}${fresh?'🆕 وصل حديثًا':'🎮 لعبة متوفرة'}</div>
        <p class="jp-gallery-caption">متوفرة على ${platforms.map(esc).join(' • ')}</p>
        <button type="button" class="jp-btn jp-gallery-choose" data-jp-choose-platform="1" aria-label="اختر جهازًا لمعرفة أنواع وأسعار ${esc(group.title)}">🎮 عرض الأجهزة والأسعار</button>
      </div></article>`;
  }
  function gameCard(group){
    const g=currentVariant(group);if(!g)return '';
    const platforms=[...new Set(group.variants.map(v=>v.platform))].sort((a,b)=>platformOrder(a)-platformOrder(b));
    const selectedPlatform=S.platform==='all'?(S.cardPlatforms.get(group.key)||g.platform):S.platform;
    const currentVariants=group.variants.filter(v=>v.platform===selectedPlatform);
    const variants=currentVariants.length?currentVariants:group.variants;
    const displaySize=gameSizeNumber(variants.find(v=>gameSizeNumber(v)));
    const uniqueModes=new Map();
    variants.forEach(v=>{if(!uniqueModes.has(v.game_mode))uniqueModes.set(v.game_mode,v)});
    const choices=['standard','offline','online','modified'].filter(m=>uniqueModes.has(m));
    const cover=g.image_url||group.variants.find(v=>v.image_url)?.image_url;
    const featured=group.variants.some(v=>v.featured),fresh=group.variants.some(isNew);
    const badgePlatforms=S.platform==='all'?platforms:[S.platform];
    const deviceBar=S.platform==='all'
      ?`<div class="jp-smart-label">الأجهزة المتوفرة</div><div class="jp-smart-devices" role="group" aria-label="اختر جهاز اللعبة">${platforms.map(platform=>`<button type="button" class="jp-smart-platform ${selectedPlatform===platform?'jp-active':''}" data-jp-pick-platform="${platform}" aria-pressed="${selectedPlatform===platform}">${platform}</button>`).join('')}</div>`
      :`<div class="jp-smart-platform-static">🎮 ألعاب ${esc(S.platform)}</div>`;
    const modeButtons=choices.map(mode=>{
      const v=uniqueModes.get(mode),m=modeInfo(mode),active=g.id===v.id;
      return `<button type="button" class="jp-smart-mode ${active?'jp-active':''}" data-jp-pick-mode="${mode}" aria-pressed="${active}" title="اختر ${esc(m.label)}">
        <span class="jp-smart-mode-name">${m.icon} ${esc(m.label)}</span><span class="jp-smart-mode-price">${esc(gamePrice(v))}</span>
      </button>`;
    }).join('');
    return `<article class="jp-game jp-smart-card" data-jp-game-key="${esc(group.key)}">
      <div class="jp-game-art">${cover?`<img src="${esc(cover)}" alt="غلاف لعبة ${esc(group.title)}" loading="lazy" onerror="this.replaceWith(document.createTextNode('🎮'))">`:'<span class="jp-art-fallback" aria-hidden="true">🎮</span>'}
        <span class="jp-chip jp-smart-cover-badge">${badgePlatforms.map(esc).join(' · ')}</span></div>
      <div class="jp-game-info"><h3>${esc(group.title)}</h3>
        <div class="jp-game-sub">${featured?'⭐ ترشيحات الجوكر · ':''}${fresh?'🆕 وصل حديثًا':'🎮 متوفر للاستفسار'}</div>
        ${deviceBar}
        ${displaySize?`<div class="jp-smart-game-size" dir="rtl"><span class="jp-game-size-label">💾 حجم اللعبة على <bdi dir="ltr">${esc(selectedPlatform)}</bdi></span><span class="jp-game-size-value"><bdi dir="ltr">${esc(displaySize)}</bdi> <span>جيجابايت</span></span></div>`:''}
        <div class="jp-smart-label">خيارات ${esc(selectedPlatform)} — اضغط على النوع لمعرفة سعره</div>
        <div class="jp-smart-modes jp-smart-modes-with-price" role="group" aria-label="نوع تشغيل اللعبة والسعر">${modeButtons}</div>
        <div class="jp-smart-selected">النسخة المختارة: <strong>${esc(g.platform)} · ${esc(modeInfo(g.game_mode).label)}</strong></div>
        <div class="jp-game-price">${esc(gamePrice(g))}</div>
        <div class="jp-game-buttons"><button type="button" class="jp-btn" data-jp-add="${esc(g.id)}">${g.pricing_type==='fixed'?'🛍️ اطلب هذه النسخة':'💬 استفسر عن هذه النسخة'}</button>
          <button type="button" class="jp-btn jp-outline" data-jp-details="${esc(g.id)}" aria-label="تفاصيل النسخة المحددة">تفاصيل</button></div>
      </div></article>`;
  }
  function activeGroups(){
    const phrase=S.search.toLowerCase();
    return allVisibleGroups().map(group=>({...group,variants:S.platform==='all'?group.variants:group.variants.filter(g=>g.platform===S.platform)}))
      .filter(group=>group.variants.length>0)
      .filter(group=>S.mode==='all'||group.variants.some(g=>g.game_mode===S.mode))
      .filter(group=>!phrase||(group.title+' '+group.variants.map(g=>g.description||'').join(' ')).toLowerCase().includes(phrase));
  }
  function renderGames(){const root=q('#jpGamesGrid');if(!root)return;
    qa('[data-jp-platform]').forEach(b=>{const isSelected=b.dataset.jpPlatform===S.platform;
      b.classList.toggle('jp-selected',isSelected);b.setAttribute('aria-pressed',String(isSelected));
    });
    renderModes();
    const hint=q('#jpCatalogHint');
    if(hint)hint.textContent=S.platform==='all'
      ?'🃏 معرض الألعاب — اضغط «عرض الأجهزة والأسعار» على أي لعبة، ثم اختر جهازك.'
      :'🎮 قسم '+S.platform+' — الأسعار وأنواع التشغيل المعروضة تخص '+S.platform+' فقط.';
    const groups=activeGroups();
    root.innerHTML=groups.length?groups.map(S.platform==='all'?galleryCard:gameCard).join(''):'<div class="jp-empty">🎮 لا توجد ألعاب معروضة في هذا التصنيف حاليًا. جرّب جميع الأنواع أو منصة أخرى.</div>';
    const count=q('#jpCount');if(count)count.textContent=groups.length+' لعبة';
    const platformGroups=allVisibleGroups().map(group=>({...group,variants:S.platform==='all'?group.variants:group.variants.filter(g=>g.platform===S.platform)})).filter(group=>group.variants.length);
    const favorites=platformGroups.filter(group=>group.variants.some(v=>v.featured)).slice(0,12),featured=q('#jpFeatured');
    if(featured)featured.innerHTML=favorites.length?favorites.map(S.platform==='all'?galleryCard:gameCard).join(''):'<div class="jp-empty">ستظهر هنا الألعاب التي يختارها المدير ضمن ترشيحات الجوكر.</div>';
    const latest=platformGroups.filter(group=>group.variants.some(isNew)).slice(0,12),latestNode=q('#jpLatest');
    if(latestNode)latestNode.innerHTML=latest.length?latest.map(S.platform==='all'?galleryCard:gameCard).join(''):'<div class="jp-empty">ستظهر هنا الألعاب التي تُضاف حديثًا.</div>';
    const counter=q('#jpInquiryCounter');if(counter)counter.textContent=S.inquiryIds.size;
  }
  function installSmartStyles(){if(q('#jpSmartCardStyles'))return;
    const style=document.createElement('style');style.id='jpSmartCardStyles';style.textContent=`
    .jp-all-devices-row{display:flex;justify-content:center;margin:8px auto 13px}
    .jp-all-devices-btn{border:1px solid #9d7354;border-radius:999px;padding:12px 28px;color:#ffe4b5;background:#26181c;cursor:pointer;font-weight:800;box-shadow:0 6px 20px #0004;transition:.2s}
    .jp-all-devices-btn.jp-selected,.jp-all-devices-btn:hover{background:linear-gradient(120deg,#75402b,#3a1520);border-color:#f4c87d;color:#fff;box-shadow:0 0 0 2px #c08b4540}
    .jp-catalog-hint{margin:8px 0 17px;padding:11px 13px;border:1px solid #85604c;background:#2b1b21;color:#ffe8be;border-radius:11px;font-size:13px;font-weight:750;line-height:1.65;text-align:center}
    .jp-gallery-card .jp-game-info{display:flex;flex-direction:column;gap:7px;min-width:0}
    .jp-gallery-card .jp-gallery-caption{margin:2px 0 4px;color:#f4d3a7;font-size:12px;line-height:1.6}
    .jp-gallery-card .jp-gallery-choose{width:100%;margin-top:auto;min-height:43px;white-space:normal;line-height:1.4;font-weight:850}
    .jp-choose-intro{color:#f4d9b7;font-size:14px;line-height:1.8;margin:0 0 14px}
    .jp-choose-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:10px;margin:12px 0 5px}
    .jp-choose-device{border:1px solid #a67a5c;background:#322028;color:#ffe8bd;border-radius:12px;padding:15px 9px;font-size:15px;font-weight:850;cursor:pointer;min-height:66px;transition:background .16s,border-color .16s}
    .jp-choose-device:hover,.jp-choose-device:focus-visible{background:#673b32;border-color:#f4ce81;outline-offset:2px}
    .jp-focus-game{outline:3px solid #f7c46b!important;outline-offset:3px;box-shadow:0 0 35px #f2bb6440}
    .jp-smart-card .jp-game-info{min-width:0}
    .jp-smart-card .jp-smart-label{font-weight:700;color:#efc992;font-size:11px;margin-top:9px;margin-bottom:5px}
    .jp-smart-card .jp-smart-devices,.jp-smart-card .jp-smart-modes{display:flex;flex-wrap:wrap;gap:5px;align-items:center}
    .jp-smart-card .jp-smart-platform,.jp-smart-card .jp-smart-mode{border:1px solid #665057;background:#241b22;border-radius:8px;color:#eedcce;font-size:11px;font-weight:750;padding:7px 8px;cursor:pointer;line-height:1.25;transition:border-color .18s,background .18s;white-space:normal}
    .jp-smart-card .jp-smart-platform.jp-active,.jp-smart-card .jp-smart-mode.jp-active{border-color:#f6c877;background:#6f422f;color:#fff;box-shadow:inset 0 0 0 1px #fac88a38}
    .jp-smart-card .jp-smart-platform:focus-visible,.jp-smart-card .jp-smart-mode:focus-visible,.jp-all-devices-btn:focus-visible{outline:2px solid #fff;outline-offset:2px}
    .jp-smart-card .jp-smart-cover-badge{max-width:calc(100% - 12px);white-space:normal;text-align:center;line-height:1.4;word-break:normal;font-size:11px}
    .jp-smart-card .jp-smart-selected{font-size:11px;color:#e8d5c8;margin-top:10px;padding:7px 8px;border-radius:7px;background:#38232c;line-height:1.5}
    .jp-smart-card .jp-smart-selected strong{color:#ffe0a1}
    .jp-smart-card .jp-game-price{margin-top:8px}
    .jp-smart-card .jp-game-buttons{margin-top:9px}
    .jp-smart-card .jp-game-buttons .jp-btn{white-space:normal}
    .jp-smart-card .jp-smart-modes-with-price{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
    .jp-smart-card .jp-smart-modes-with-price .jp-smart-mode{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;text-align:start;min-width:0;min-height:49px;border-radius:10px}
    .jp-smart-card .jp-smart-mode-price{display:block;color:#ffda95;font-size:10px;font-weight:800;line-height:1.4;white-space:normal}
    .jp-smart-card .jp-smart-game-size{padding:7px 9px;margin:7px 0;border-radius:10px;background:#1c2028aa;border:1px solid #87673f;color:#f9e4c2;font-size:12px;line-height:1.5}
    .jp-smart-card .jp-smart-mode.jp-active .jp-smart-mode-price{color:#fff5ca}
    .jp-smart-platform-static{margin:8px 0 4px;color:#ffe0a1;background:#35222b;border:1px solid #704a52;padding:7px 10px;border-radius:8px;font-weight:800;font-size:12px}
    .jp-multi-platforms{display:flex;flex-wrap:wrap;gap:10px;margin:8px 0 14px}
    .jp-multi-platforms label{display:flex;align-items:center;gap:8px;padding:9px 12px;background:#302029;border:1px solid #806168;border-radius:10px;color:#ffe0a1;font-weight:800;cursor:pointer}
    .jp-multi-platforms input{accent-color:#e6b45d;width:17px;height:17px}
    .jp-variants-box{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:10px;margin:9px 0 16px}
    .jp-variant-device{border:1px solid #7b5b61;background:#251922;border-radius:12px;padding:12px;min-width:0}
    .jp-variant-device h4{margin:0 0 9px;color:#ffe0a1;font-size:15px}
    .jp-variant-entry{display:grid;grid-template-columns:1fr;gap:4px;border-bottom:1px solid #65434a66;padding:8px 0}
    .jp-variant-entry:last-child{border-bottom:0}
    .jp-variant-entry .jp-variant-check{display:flex;gap:8px;align-items:center;color:#fff;font-weight:700;font-size:13px}
    .jp-variant-entry input[type="checkbox"]{accent-color:#e6b45d;width:17px;height:17px}
    .jp-variant-entry .jp-variant-price-label{display:flex;gap:7px;align-items:center;color:#f2d3bb;font-size:12px;flex-wrap:wrap}
    .jp-variant-entry .jp-variant-price-label input{width:130px;max-width:100%;padding:7px 9px;border-radius:7px;background:#1b141b;border:1px solid #745960;color:#fff;direction:ltr}
    .jp-variant-entry .jp-variant-price-label input:disabled{opacity:.35}
    .jp-variant-admin-list{margin:8px 0;padding:8px 0;border-top:1px dashed #725258}
    .jp-variant-admin-list summary{cursor:pointer;color:#f8d4a1;font-weight:700}
    .jp-variant-admin-list .jp-admin-row{margin:6px 0}
    .jp-admin-game-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
    .jp-admin-game-head .jp-btn{flex-shrink:0}
    .jp-admin-game-row{border:1px solid #68424c;padding:12px;background:#231820;border-radius:12px;margin:9px 0}
    .jp-manager-tip{background:#32232c;border-inline-start:3px solid #e8bc7c;padding:12px;border-radius:8px;color:#fae6d6;line-height:1.7;font-size:12px}
    @media(max-width:700px){.jp-smart-card .jp-smart-platform,.jp-smart-card .jp-smart-mode{font-size:10px;padding:6px 7px}.jp-all-devices-btn{width:min(100%,320px)}.jp-smart-card .jp-smart-label{font-size:10px}.jp-variants-box{grid-template-columns:1fr}.jp-multi-platforms label{padding:7px 9px;font-size:12px}}
    @media(max-width:500px){.jp-game-grid{grid-template-columns:1fr!important}.jp-game-grid .jp-smart-card .jp-game-art{height:190px}.jp-smart-card .jp-smart-modes-with-price{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;document.head.append(style);
  }
  function gameSection(){installSmartStyles();const section=document.createElement('section');section.id='jokerPremiumGames';section.className='jp-genre';section.innerHTML=`
    <div class="jp-header"><div><div class="jp-kicker">✦ JOKER GAME ZONE ✦</div><h2 class="jp-title">🎮 عالم <em>ألعاب البلايستيشن</em></h2><p class="jp-muted">PS3 • PS4 • PS5 — صورة واحدة لكل لعبة، والأسعار داخل قسم الجهاز</p></div><button class="jp-scroll-pill" id="jpOpenBasket" type="button">💬 قائمة طلب الألعاب (<span id="jpInquiryCounter">0</span>)</button></div>
    <div class="jp-consoles">${deviceButtons()}</div>
    <div class="jp-all-devices-row"><button type="button" class="jp-all-devices-btn jp-selected" data-jp-platform="all" aria-pressed="true">🕹️ معرض جميع الألعاب — بدون أسعار</button></div>
    <div class="jp-catalog-hint" id="jpCatalogHint" aria-live="polite">🃏 معرض الألعاب — اختر اللعبة وجهازها لمعرفة الأسعار</div>
    <div class="jp-modes" id="jpModeWrap"></div>
    <div class="jp-game-toolbar"><strong id="jpCount">0 لعبة</strong><input class="jp-search" id="jpSearch" type="search" placeholder="ابحث عن لعبة بالاسم..." aria-label="ابحث عن لعبة"></div>
    <div class="jp-game-grid" id="jpGamesGrid"><div class="jp-empty">جاري تحميل ألعاب الجوكر...</div></div>
    <div class="jp-carousel-wrap"><div class="jp-carousel-label">🔥 ترشيحات الجوكر <div class="jp-action-row"><button type="button" class="jp-btn jp-outline" data-jp-scroll="featured:-1">❯</button><button type="button" class="jp-btn jp-outline" data-jp-scroll="featured:1">❮</button></div></div><div class="jp-featured" id="jpFeatured"></div></div>
    <div class="jp-carousel-wrap"><div class="jp-carousel-label">🆕 وصل حديثًا</div><div class="jp-featured" id="jpLatest"></div></div>
    <p class="jp-footnote">الأسعار المتغيرة يتم تأكيدها عند الاستفسار. جميع الرسائل تُفتح في واتساب ليؤكد الزبون إرسالها.</p>`;
    const shop=q('#shop'),offers=q('#featuredOffers');if(shop)shop.before(section);else if(offers)offers.after(section);else q('main')?.append(section);
    section.addEventListener('click',e=>{const device=e.target.closest('[data-jp-platform]');if(device){
        S.platform=device.dataset.jpPlatform;S.mode='all';S.search='';q('#jpSearch').value='';renderGames();
        q('#jpGamesGrid')?.scrollIntoView({behavior:'smooth',block:'start'});return;}
      const mode=e.target.closest('[data-jp-mode]');if(mode){S.mode=mode.dataset.jpMode;renderGames();return;}
      const choose=e.target.closest('[data-jp-choose-platform]');if(choose){
        const card=choose.closest('[data-jp-game-key]');
        const group=allVisibleGroups().find(g=>g.key===card?.dataset.jpGameKey);
        if(group)openPlatformChooser(group);
        return;}
      const selectedPlatform=e.target.closest('[data-jp-pick-platform]');if(selectedPlatform){
        const card=selectedPlatform.closest('[data-jp-game-key]');
        const group=allVisibleGroups().find(g=>g.key===card?.dataset.jpGameKey);if(!group)return;
        const requested=selectedPlatform.dataset.jpPickPlatform,current=currentVariant(group);
        const variants=group.variants.filter(g=>g.platform===requested);
        const next=variants.find(g=>g.game_mode===current.game_mode)||variants[0];if(!next)return;
        S.cardPlatforms.set(group.key,requested);S.selectedVariants.set(group.key,next.id);
        if(S.mode!=='all'&&S.mode!==next.game_mode)S.mode='all';renderGames();return;}
      const selectedMode=e.target.closest('[data-jp-pick-mode]');if(selectedMode){
        const card=selectedMode.closest('[data-jp-game-key]');
        const group=allVisibleGroups().find(g=>g.key===card?.dataset.jpGameKey);if(!group)return;
        const requested=selectedMode.dataset.jpPickMode;
        const explicit=S.platform==='all'?S.cardPlatforms.get(group.key):S.platform;
        const current=currentVariant(group);
        const candidates=group.variants.filter(g=>g.game_mode===requested&&(!explicit||g.platform===explicit));
        const next=candidates.find(g=>g.platform===current.platform)||candidates[0];if(!next)return;
        S.selectedVariants.set(group.key,next.id);if(S.platform==='all')S.cardPlatforms.set(group.key,next.platform);
        if(S.mode!=='all'&&S.mode!==requested)S.mode='all';renderGames();return;}
      const add=e.target.closest('[data-jp-add]');if(add){const g=S.games.find(x=>x.id===add.dataset.jpAdd);if(g){S.inquiryIds.add(g.id);persistList();renderGames();openBasket();}return;}
      const details=e.target.closest('[data-jp-details]');if(details){const g=S.games.find(x=>x.id===details.dataset.jpDetails);if(g)openDetails(g);return;}
      const scroll=e.target.closest('[data-jp-scroll]');if(scroll){const [where,sign]=scroll.dataset.jpScroll.split(':');q(where==='featured'?'#jpFeatured':'#jpLatest')?.scrollBy({left:Number(sign)*230,behavior:'smooth'});return;}});
    q('#jpSearch').addEventListener('input',e=>{S.search=e.target.value.trim();renderGames()});q('#jpOpenBasket').onclick=openBasket;
    renderGames();return section;}
  function createDialog(){const shade=document.createElement('div');shade.className='jp-drawer-back';shade.id='jpDialogBack';shade.innerHTML='<div class="jp-drawer" role="dialog" aria-modal="true" aria-label="متجر الجوكر"><div class="jp-top"><h2 id="jpDialogTitle"></h2><button type="button" id="jpDialogClose" class="jp-close">✕ إغلاق</button></div><div id="jpDialogBody"></div></div>';document.body.append(shade);
    q('#jpDialogClose').onclick=closeDialog;shade.addEventListener('click',e=>{if(e.target===shade)closeDialog()});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&shade.classList.contains('jp-open'))closeDialog()});}
  function openDialog(title,content){q('#jpDialogTitle').textContent=title;q('#jpDialogBody').innerHTML=content;q('#jpDialogBack').classList.add('jp-open');}
  function closeDialog(){q('#jpDialogBack').classList.remove('jp-open')}
  function goToGameOnDevice(groupKey,platform){
    // Preserve the DB variant IDs and prices; only switch the view and focus the game.
    const group=allVisibleGroups().find(g=>g.key===groupKey);
    const variant=group?.variants.find(g=>g.platform===platform);
    if(!variant)return;
    S.platform=platform;S.mode='all';S.search='';
    S.selectedVariants.set(groupKey,variant.id);
    const search=q('#jpSearch');if(search)search.value='';
    closeDialog();renderGames();
    const list=q('#jpGamesGrid');
    const target=list&&qa('[data-jp-game-key]',list).find(el=>el.dataset.jpGameKey===groupKey);
    if(target){
      target.classList.add('jp-focus-game');target.setAttribute('tabindex','-1');
      target.scrollIntoView({behavior:prefMotion?.matches?'auto':'smooth',block:'center'});
      target.focus({preventScroll:true});
    }else list?.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function openPlatformChooser(group){
    const platforms=[...new Set(group.variants.map(v=>v.platform))].sort((a,b)=>platformOrder(a)-platformOrder(b));
    const buttons=platforms.map(platform=>`<button class="jp-choose-device" type="button" data-jp-go-platform="${esc(platform)}">🎮 ${esc(platform)}</button>`).join('');
    openDialog('🎮 اختر جهاز اللعبة',`<p class="jp-choose-intro"><strong>${esc(group.title)}</strong><br>اختر جهاز البلايستيشن الذي تريد معرفة نسخ اللعبة وأسعارها عليه. سنوصلك مباشرة للعبة داخل قسم ذلك الجهاز.</p><div class="jp-choose-list">${buttons}</div>`);
    qa('[data-jp-go-platform]',q('#jpDialogBody')).forEach(button=>button.onclick=()=>goToGameOnDevice(group.key,button.dataset.jpGoPlatform));
  }
  function openDetails(g){const m=MODES.find(x=>x.id===g.game_mode)?.label||'ألعاب PS3';openDialog('🎮 تفاصيل اللعبة',
    `<div class="jp-panel">${g.image_url?`<img src="${esc(g.image_url)}" alt="${esc(g.title)}" style="max-height:250px;width:100%;object-fit:contain">`:''}<h3>${esc(g.title)}</h3><p>الجهاز: ${esc(g.platform)} | النوع: ${esc(m)}</p>${gameSize(g)?`<p>💾 حجم اللعبة: ${esc(gameSize(g))}</p>`:''}<p>${esc(g.description)}</p><strong>${esc(gamePrice(g))}</strong></div><button type="button" class="jp-btn" id="jpDetailAdd">إضافة إلى قائمة طلب الألعاب</button>`);
    q('#jpDetailAdd').onclick=()=>{S.inquiryIds.add(g.id);persistList();renderGames();openBasket()};}
  function openBasket(){const items=[...S.inquiryIds].map(id=>S.games.find(g=>g.id===id)).filter(Boolean);const content=items.length?items.map(g=>`<div class="jp-admin-row"><span><strong>${esc(g.title)}</strong><br><small>${esc(g.platform)} · ${esc(MODES.find(m=>m.id===g.game_mode)?.label||'PS3')} · ${esc(gamePrice(g))}${gameSize(g)?' · '+esc(gameSize(g)):''}</small></span><button class="jp-btn jp-outline" data-jp-remove="${esc(g.id)}">إزالة</button></div>`).join(''):'<p class="jp-muted">قائمة طلب الألعاب فارغة.</p>';
    openDialog('💬 قائمة الاستفسار عن الألعاب',`${content}<div class="jp-panel"><label for="jpSendPhone">رقم التواصل الذي تريد مراسلته</label><select id="jpSendPhone">${WHATSAPP.map((n,i)=>`<option value="${n.value}">${n.label}</option>`).join('')}</select><p class="jp-footnote">يفتح واتساب برسالة جاهزة؛ يلزم الزبون الضغط على إرسال داخل واتساب. لا تُرسل الرسائل تلقائيًا.</p><button type="button" class="jp-btn" id="jpSendInquiry" ${items.length?'':'disabled'}>فتح واتساب لإرسال الاستفسار</button></div>`);
    qa('[data-jp-remove]',q('#jpDialogBody')).forEach(b=>b.onclick=()=>{S.inquiryIds.delete(b.dataset.jpRemove);persistList();renderGames();openBasket()});
    const send=q('#jpSendInquiry');if(send)send.onclick=()=>{const list=[...S.inquiryIds].map(id=>S.games.find(x=>x.id===id)).filter(Boolean);if(!list.length)return;
      const lines=list.map((g,i)=>`${i+1}- ${g.title} | ${g.platform} | ${MODES.find(m=>m.id===g.game_mode)?.label||'PS3'} | ${gamePrice(g)}${gameSize(g)?' | الحجم: '+gameSize(g):''}`).join('\n');
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
  // Each saved option still has its own DB row/id, price, and optional per-console game size.
  // One cover upload is shared across the selected console/mode combinations.
  function pairKey(platform,mode){return platform+'|'+mode;}
  function groupFromKey(key){return groupGames(S.games).find(g=>g.key===key)||null;}
  function defaultCover(group){return group?.variants.find(v=>v.image_url)?.image_url||null;}
  function adminGroupTemplate(){
    const group=S.editGroupKey?groupFromKey(S.editGroupKey):null;
    const draft=S.cloneDraft||null;
    const example=group?.variants.find(v=>v.available)||group?.variants[0]||draft||{};
    const known=group?new Set(group.variants.filter(v=>v.available).map(g=>g.platform)):new Set([draft?.platform||'PS4']);
    const cover=defaultCover(group)||draft?.image_url||null;
    return `<div class="jp-manager-tip">✅ اختر جهازًا أو أكثر وأنواع التشغيل المطلوبة. السعر وحجم اللعبة كلاهما اختياريان؛ إن تركت الحجم فارغًا لن يظهر للزبون. تُرفع صورة واحدة لجميع النسخ، وتبقى أسعار كل نوع مستقلة.</div>
      <form id="jpGroupForm"><div class="jp-panels"><div class="jp-panel">
        <label>اسم اللعبة</label><input name="title" maxlength="150" minlength="2" required value="${esc(example.title||'')}" placeholder="مثال: GTA V">
        <label>وصف وملاحظات اللعبة</label><textarea name="description" rows="3" placeholder="وصف اللعبة ومتطلبات التشغيل">${esc(example.description||'')}</textarea>
        <label>اختر أجهزة البلايستيشن (جهاز أو أكثر)</label>
        <div class="jp-multi-platforms">${DEVICES.map(d=>`<label><input type="checkbox" data-jp-device="${d.id}" ${known.has(d.id)?'checked':''}> ${d.id}</label>`).join('')}</div>
        <label>صورة غلاف اللعبة (ملف واحد لجميع الأجهزة والأنواع)</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp">
        ${cover?`<p class="jp-footnote">📷 الصورة الحالية محفوظة، وإذا لم ترفع صورة جديدة ستبقى كما هي.</p>`:''}
      </div><div class="jp-panel"><label>خيارات العرض</label>
        <div class="jp-checks"><label><input type="checkbox" name="featured" ${example.featured?'checked':''}> ⭐ لعبة مميزة في ترشيحات الجوكر</label></div>
        <p class="jp-footnote">لكل جهاز اختر أوفلاين وأونلاين وأجهزة معدلة حسب المتوفر، ويمكن تحديد أكثر من خيار. كل نوع له سعر مستقل أو خانة فارغة للاستفسار.</p>
        <p class="jp-footnote">${group?'التعديل على المجموعة يحدث البيانات المشتركة، ويُخفي النسخ التي تلغي تحديدها دون حذفها من قاعدة البيانات.':'عند الحفظ، ينشئ المتجر جميع الاختيارات بضغطة واحدة دون تكرار رفع الصورة.'}</p>
      </div></div>
      <div class="jp-variants-box" id="jpVariantMatrix"></div>
      <div class="jp-action-row"><button class="jp-btn" type="submit">${group?'💾 حفظ تعديل اللعبة وجميع النسخ':'➕ إضافة اللعبة للأجهزة المختارة'}</button>
      <button class="jp-btn jp-outline" id="jpCancelEdit" type="button">إلغاء / إضافة لعبة جديدة</button></div>
      <p class="jp-status" id="jpStatus" role="status"></p></form>`;
  }
  function bindGroupForm(){
    const form=q('#jpGroupForm');if(!form)return;
    const group=S.editGroupKey?groupFromKey(S.editGroupKey):null;
    const draft=S.cloneDraft||null;
    const draftValues=new Map();
    const sizeDraft=new Map();
    if(group){group.variants.forEach(g=>draftValues.set(pairKey(g.platform,g.game_mode),{checked:!!g.available,price:g.pricing_type==='fixed'&&g.price!=null?String(g.price):''}));}
    else if(draft){draftValues.set(pairKey(draft.platform,draft.game_mode),{checked:true,price:draft.pricing_type==='fixed'&&draft.price!=null?String(draft.price):''});}
    (group?.variants|| (draft?[draft]:[])).forEach(g=>{if(g.game_size_gb!=null&&Number(g.game_size_gb)>0&&!sizeDraft.has(g.platform))sizeDraft.set(g.platform,String(g.game_size_gb));});
    function collect(){qa('[data-jp-size]',form).forEach(input=>sizeDraft.set(input.dataset.jpSize,input.value));
      qa('[data-jp-variant]',form).forEach(check=>{
      const field=q('[data-jp-price="'+check.dataset.jpVariant+'"]',form);
      draftValues.set(check.dataset.jpVariant,{checked:check.checked,price:field?.value||''});
    });}
    function renderMatrix(){
      const container=q('#jpVariantMatrix');if(!container)return;
      const chosen=qa('[data-jp-device]:checked',form).map(ch=>ch.dataset.jpDevice);
      container.innerHTML=chosen.length?chosen.map(platform=>{
        const modes=[...(group?.variants.some(g=>g.platform===platform&&g.game_mode==='standard')?['standard']:[]),...MODES_ALLOWED];
        return `<div class="jp-variant-device"><h4>🎮 ${platform}</h4>
          <div class="jp-size-editor" dir="rtl"><label for="jp-size-${esc(platform)}">💾 حجم اللعبة على <bdi dir="ltr">${esc(platform)}</bdi> (اختياري)</label>
            <div class="jp-size-entry"><input id="jp-size-${esc(platform)}" type="number" min="0.01" max="9999" step="0.01" inputmode="decimal" placeholder="مثال: 10.8" aria-label="أدخل حجم اللعبة بالأرقام فقط" data-jp-size="${platform}" value="${esc(sizeDraft.get(platform)??'')}"><span>جيجابايت</span></div></div>
          ${modes.map(mode=>{
          const key=pairKey(platform,mode),v=draftValues.get(key);
          const checked=v?.checked??(mode==='offline'&&!modes.some(m=>draftValues.get(pairKey(platform,m))?.checked));
          const modeLabel=modeInfo(mode).label;
          return `<div class="jp-variant-entry"><label class="jp-variant-check"><input type="checkbox" data-jp-variant="${key}" ${checked?'checked':''}>
            ${esc(modeLabel)}${mode==='standard'?' (نسخة PS3 القديمة)':''}</label>
            <label class="jp-variant-price-label">السعر (اختياري)<input type="number" min="0.01" max="999999999" step="0.01" inputmode="decimal" placeholder="فارغ = السعر حسب الطلب" data-jp-price="${key}" value="${esc(v?.price??'')}" ${checked?'':'disabled'}> د.ل</label></div>`;
        }).join('')}</div>`;
      }).join(''):'<div class="jp-empty">اختر جهازًا واحدًا على الأقل لإظهار أنواع التشغيل وأسعارها.</div>';
      qa('[data-jp-variant]',form).forEach(ch=>ch.onchange=()=>{
        const price=q('[data-jp-price="'+ch.dataset.jpVariant+'"]',form);if(price)price.disabled=!ch.checked;
      });
    }
    qa('[data-jp-device]',form).forEach(ch=>ch.onchange=()=>{collect();renderMatrix()});
    renderMatrix();
    q('#jpCancelEdit').onclick=()=>{S.editGroupKey=null;S.cloneDraft=null;S.focusVariant=null;openManager('games');};
    if(S.focusVariant){const focused=q('[data-jp-price="'+S.focusVariant+'"]',form);
      if(focused){focused.scrollIntoView({block:'center',behavior:'smooth'});focused.focus({preventScroll:true});}}
    form.onsubmit=async e=>{
      e.preventDefault();if(S.saving)return;collect();
      const f=new FormData(form),title=String(f.get('title')||'').trim();
      if(title.length<2||title.length>150){alertMsg('اسم اللعبة يجب أن يتكون من حرفين إلى 150 حرفًا.');return;}
      const targetPlatforms=qa('[data-jp-device]:checked',form).map(ch=>ch.dataset.jpDevice);
      const selections=[...draftValues.entries()]
        .filter(([key,v])=>v.checked&&targetPlatforms.includes(key.split('|')[0]))
        .map(([key,v])=>{const [platform,game_mode]=key.split('|');return {platform,game_mode,rawPrice:v.price.trim()};});
      if(!selections.length){alertMsg('اختر جهازًا ونوع تشغيل واحدًا على الأقل.');return;}
      const newKey=gameKey(title),existingOther=groupGames(S.games).find(g=>g.key===newKey && g.key!==S.editGroupKey);
      if(existingOther){alertMsg('هذه اللعبة موجودة بالفعل. استخدم زر «تعديل اللعبة» لإضافة الأجهزة والأنواع إلى نفس الصورة.');return;}
      for(const item of selections){if(item.rawPrice==='')continue;
        const value=Number(item.rawPrice);
        if(!Number.isFinite(value)||value<=0||value>999999999){alertMsg('أدخل سعرًا موجبًا، أو اترك خانة السعر فارغة للاستفسار.');return;}
      }
      const platformSizes=new Map();
      for(const platform of targetPlatforms){const raw=(sizeDraft.get(platform)||'').trim();
        if(raw===''){platformSizes.set(platform,null);continue;}
        const n=Number(raw);if(!Number.isFinite(n)||n<=0||n>9999){alertMsg('حجم اللعبة يجب أن يكون رقمًا موجبًا بالجيجابايت، أو اتركه فارغًا.');return;}
        platformSizes.set(platform,n);
      }
      const featured=f.has('featured'),description=String(f.get('description')||'').trim();
      S.saving=true;const btn=form.querySelector('button[type=submit]');btn.disabled=true;alertMsg('جاري حفظ اللعبة وخيارات الأجهزة...');
      try{
        const file=f.get('photo');let image_url=defaultCover(group)||draft?.image_url||null;
        if(file instanceof File&&file.size)image_url=await uploadFile(file,'games');
        const base={title,description,featured,image_url};
        const chosen=new Map(selections.map(v=>[pairKey(v.platform,v.game_mode),v]));
        const covered=new Set(),updates=[],inserts=[];
        if(group){group.variants.forEach(old=>{
          const key=pairKey(old.platform,old.game_mode),selection=chosen.get(key),first=!covered.has(key);
          const payload={...base,available:!!selection&&first};
          if(platformSizes.has(old.platform))payload.game_size_gb=platformSizes.get(old.platform);
          if(selection&&first){const price=selection.rawPrice===''?null:Number(selection.rawPrice);
            payload.pricing_type=price===null?'inquiry':'fixed';payload.price=price;
          }
          updates.push({id:old.id,payload});covered.add(key);
        });}
        selections.forEach(v=>{if(covered.has(pairKey(v.platform,v.game_mode)))return;
          const price=v.rawPrice===''?null:Number(v.rawPrice);
          inserts.push({...base,platform:v.platform,game_mode:v.game_mode,game_size_gb:platformSizes.get(v.platform)??null,available:true,pricing_type:price===null?'inquiry':'fixed',price});
        });
        // Preserve record IDs so older customer inquiry lists and old links continue working.
        for(const row of updates){const {error}=await S.db.from('joker_premium_games').update(row.payload).eq('id',row.id);if(error)throw error;}
        if(inserts.length){const {error}=await S.db.from('joker_premium_games').insert(inserts);if(error)throw error;}
        S.editGroupKey=null;S.cloneDraft=null;S.focusVariant=null;
        await reload();openManager('games');alertMsg('✅ تم الحفظ بنجاح. ستظهر اللعبة بصورة واحدة في كل الأقسام المناسبة.');
      }catch(err){
        // DB requests are performed in separate calls; refresh after a partial failure.
        try{await reload()}catch{}
        alertMsg('❌ تعذر إكمال الحفظ: '+(err?.message||err)+' — راجع قائمة الألعاب قبل إعادة المحاولة.');btn.disabled=false;
      }finally{S.saving=false;}
    };
  }
  function gameAdmin(){
    const allGroups=groupGames(S.games);
    const groupsMarkup=allGroups.map(group=>{
      const visible=group.variants.filter(g=>g.available);
      const platforms=[...new Set(visible.map(g=>g.platform))].sort((a,b)=>platformOrder(a)-platformOrder(b));
      const variantMarkup=group.variants.map(g=>`<div class="jp-admin-row"><span><strong>${esc(g.platform)} · ${esc(modeInfo(g.game_mode).label)}</strong><br>
        <small>${esc(gamePrice(g))}${gameSize(g)?' · حجم: '+esc(gameSize(g)):''}${g.available?'':' · مخفية'}</small></span>
        <span class="jp-action-row"><button class="jp-btn jp-outline" type="button" data-jp-edit-variant="${esc(g.id)}">تعديل السعر</button>
        <button class="jp-btn jp-outline" type="button" data-jp-delete="${esc(g.id)}">حذف النسخة</button></span></div>`).join('');
      return `<div class="jp-admin-game-row"><div class="jp-admin-game-head"><div><strong>${esc(group.title)}</strong>
          <div class="jp-footnote">${esc(platforms.join(' · ')||'غير معروضة')} — ${visible.length} نسخة معروضة</div></div>
          <button class="jp-btn jp-outline" type="button" data-jp-edit-group="${esc(group.key)}">✏️ تعديل اللعبة والأجهزة والأسعار والحجم</button></div>
        <details class="jp-variant-admin-list"><summary>إدارة النسخ الفردية (${group.variants.length})</summary>${variantMarkup}</details></div>`;
    }).join('');
    q('#jpAdminContent').innerHTML=`<h3>${S.editGroupKey?'✏️ تعديل لعبة بجميع أجهزتها':'➕ إضافة لعبة واحدة لعدة أجهزة'}</h3>${adminGroupTemplate()}
      <h3>الألعاب المُضافة (${allGroups.length} لعبة، ${S.games.length} نسخة)</h3>
      <div class="jp-panel">${groupsMarkup||'<p class="jp-muted">لم تتم إضافة ألعاب بعد.</p>'}</div>`;
    bindGroupForm();
    qa('[data-jp-edit-group]').forEach(b=>b.onclick=()=>{
      S.editGroupKey=b.dataset.jpEditGroup;S.cloneDraft=null;S.focusVariant=null;openManager('games');
    });
    qa('[data-jp-edit-variant]').forEach(b=>b.onclick=()=>{
      const g=S.games.find(x=>x.id===b.dataset.jpEditVariant);if(!g)return;
      S.editGroupKey=gameKey(g.title);S.cloneDraft=null;S.focusVariant=pairKey(g.platform,g.game_mode);openManager('games');
    });
    qa('[data-jp-delete]').forEach(b=>b.onclick=async()=>{
      const g=S.games.find(x=>x.id===b.dataset.jpDelete);if(!g||!confirm(`حذف نسخة ${g.title} من ${g.platform} (${modeInfo(g.game_mode).label}) نهائيًا؟ بقية النسخ لن تُحذف.`))return;
      const {error}=await S.db.from('joker_premium_games').delete().eq('id',g.id);
      if(error){alert('تعذر الحذف: '+error.message);return;}await reload();openManager('games');
    });
  }
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
    qa('[data-jp-tab]').forEach(b=>b.onclick=()=>{S.editId=null;S.cloneImage='';S.editGroupKey=null;S.cloneDraft=null;S.focusVariant=null;openManager(b.dataset.jpTab)});
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

/* JOKER STORE V5.11 | Add-on-only social-link compatibility layer.
 * Safe with both the earlier and newer index.html: it fixes existing links,
 * or adds the social hub only if it is absent. Core app files are unchanged.
 */
(function jokerSocialLinksV511(){
  'use strict';
  const HUB_HTML="<section id=\"jokerSocialHub\" class=\"joker-social-hub\" aria-labelledby=\"jokerSocialTitle\">\n  <div class=\"joker-social-head\">\n    <div class=\"joker-social-head-copy\"><div class=\"joker-social-kicker\">✦ CONNECT WITH JOKER ELECTRONICS ✦</div><h2 id=\"jokerSocialTitle\">تابع عالم <span>الجوكر</span> 🃏</h2><p>كل جديد في عالم الألعاب والإلكترونيات والعروض — تابعنا وتواصل معنا مباشرة عبر منصاتنا الرسمية.</p></div>\n    <img class=\"joker-social-brand\" src=\"assets/logo.png\" alt=\"شعار متجر الجوكر الأصلي\" loading=\"lazy\"/>\n  </div>\n  <div class=\"joker-social-platforms\">\n    <a class=\"joker-social-platform joker-social-facebook\" href=\"https://www.facebook.com/share/1FfV4E7Q4q/\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"صفحة فيسبوك لمتجر الجوكر\"><span class=\"joker-social-ico\"><svg viewBox=\"0 0 24 24\" fill=\"currentColor\" aria-hidden=\"true\"><path d=\"M14.6 21v-8h2.8l.4-3.3h-3.2V7.6c0-1 .3-1.6 1.6-1.6H18V3.1c-.4-.1-1.8-.1-2.5-.1-3 0-5 1.8-5 5V9.7H7.8V13h2.7v8h4.1Z\"/></svg></span><span><strong>فيسبوك</strong><small>صفحتنا الرسمية</small></span><span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span></a>\n    <a class=\"joker-social-platform joker-social-tiktok\" href=\"https://www.tiktok.com/@goker_218\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"صفحة تيك توك لمتجر الجوكر\"><span class=\"joker-social-ico\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 3v12.5a4.5 4.5 0 1 1-4.5-4.5\"/><path d=\"M14 3c.6 3 2.3 5 6.5 5.1V12c-3.7-.1-6-1.4-6.5-3\"/></svg></span><span><strong>تيك توك</strong><small>صفحتنا الرسمية</small></span><span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span></a>\n      <a class=\"joker-social-platform joker-social-telegram\" href=\"https://linktr.ee/Joker82025\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"فتح صفحة روابط الجوكر للوصول إلى تليجرام\">\n      <span class=\"joker-social-ico\" aria-hidden=\"true\">\n        <svg viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"m21.5 3.4-3.6 17.1c-.3 1.1-1 1.4-2 0.9l-5.3-3.9-2.6 2.5c-.3.3-.6.6-1.2.6l.4-5.4 9.8-8.9c.4-.4-.1-.6-.6-.2L4.1 14 0 12.7c-1-.3-1-1 .2-1.5L19.8 3c.9-.3 1.9.2 1.7.4Z\"/></svg>\n      </span><span><strong>تليجرام</strong><small>من صفحة الروابط الرسمية</small></span>\n      <span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span>\n    </a>\n    <a class=\"joker-social-platform joker-social-maps\" href=\"https://www.google.com/maps/search/?api=1&query=%D8%AC%D9%88%D9%83%D8%B1+%D9%84%D9%84%D8%A3%D8%AC%D9%87%D8%B2%D8%A9+%D8%A7%D9%84%D8%A5%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A9+%D9%88%D9%83%D9%85%D8%A7%D9%84%D9%8A%D8%A7%D8%AA%D9%87%D8%A7+%D8%B7%D8%B1%D8%A7%D8%A8%D9%84%D8%B3+%D9%84%D9%8A%D8%A8%D9%8A%D8%A7&query_place_id=ChIJDbbyVwCTqBMRmXfe0xP33OU\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"فتح موقع محل الجوكر على خرائط جوجل\">\n      <span class=\"joker-social-ico\" aria-hidden=\"true\">\n        <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M20 10c0 5.5-8 12-8 12S4 15.5 4 10a8 8 0 1 1 16 0Z\"/><circle cx=\"12\" cy=\"10\" r=\"3\"/></svg>\n      </span><span><strong>موقع المحل 📍</strong><small>خرائط Google — الاتجاهات إلى المتجر</small></span>\n      <span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span>\n    </a>\n  </div>\n  <div class=\"joker-social-wa-heading\"><span>💬 تواصل معنا على واتساب</span><small>اختر الرقم المناسب لك</small></div>\n  <div class=\"joker-social-wa-grid\"><a class=\"joker-social-wa\" href=\"https://wa.me/218915206879\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"تواصل مع متجر الجوكر على واتساب رقم 0915206879\"><span class=\"joker-social-ico joker-social-ico-wa\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.5-4.7A8.5 8.5 0 1 1 20.5 11.7Z\"/><path d=\"m9.2 8.1 1.2 2.4-1 1.1a8 8 0 0 0 3.2 3.1l1.1-1 2.4 1.2c.2.1.3.4.2.7-.3 1-1.2 1.5-2.2 1.4-3.8-.4-6.8-3.4-7.2-7.1-.1-1.1.5-1.9 1.4-2.2.3 0 .7.1.9.4Z\"/></svg></span><span><strong>واتساب 1</strong><small dir=\"ltr\">0915206879</small></span><span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span></a>\n<a class=\"joker-social-wa\" href=\"https://wa.me/218923319182\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"تواصل مع متجر الجوكر على واتساب رقم 0923319182\"><span class=\"joker-social-ico joker-social-ico-wa\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.5-4.7A8.5 8.5 0 1 1 20.5 11.7Z\"/><path d=\"m9.2 8.1 1.2 2.4-1 1.1a8 8 0 0 0 3.2 3.1l1.1-1 2.4 1.2c.2.1.3.4.2.7-.3 1-1.2 1.5-2.2 1.4-3.8-.4-6.8-3.4-7.2-7.1-.1-1.1.5-1.9 1.4-2.2.3 0 .7.1.9.4Z\"/></svg></span><span><strong>واتساب 2</strong><small dir=\"ltr\">0923319182</small></span><span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span></a>\n<a class=\"joker-social-wa\" href=\"https://wa.me/218925206879\" target=\"_blank\" rel=\"noopener noreferrer\" aria-label=\"تواصل مع متجر الجوكر على واتساب رقم 0925206879\"><span class=\"joker-social-ico joker-social-ico-wa\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20.5 11.7a8.5 8.5 0 0 1-12.7 7.4L3 20.5l1.5-4.7A8.5 8.5 0 1 1 20.5 11.7Z\"/><path d=\"m9.2 8.1 1.2 2.4-1 1.1a8 8 0 0 0 3.2 3.1l1.1-1 2.4 1.2c.2.1.3.4.2.7-.3 1-1.2 1.5-2.2 1.4-3.8-.4-6.8-3.4-7.2-7.1-.1-1.1.5-1.9 1.4-2.2.3 0 .7.1.9.4Z\"/></svg></span><span><strong>واتساب 3</strong><small dir=\"ltr\">0925206879</small></span><span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span></a></div>\n  <div class=\"joker-social-footer\">\n    <a href=\"https://linktr.ee/Joker82025\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"joker-social-all\"><span class=\"joker-social-ico\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M10 13.5l4-4m-2.7-3 1.7-1.7a4.2 4.2 0 1 1 5.9 6l-3.2 3.1a4.2 4.2 0 0 1-5.9 0m2.9 3.2-1.7 1.7a4.2 4.2 0 0 1-5.9-6l3.2-3.1a4.2 4.2 0 0 1 5.9 0\"/></svg></span><span><strong>كل روابط الجوكر</strong><small>جميع حساباتنا في مكان واحد</small></span><span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span></a>\n    <a href=\"https://joker-store-ck6.pages.dev/\" target=\"_blank\" rel=\"noopener noreferrer\" class=\"joker-social-site\" aria-label=\"فتح متجر الجوكر للتسوق عبر الإنترنت\"><span class=\"joker-social-ico\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M3 12h18M12 3c3.5 3.8 3.5 14.2 0 18M12 3c-3.5 3.8-3.5 14.2 0 18\"/></svg></span><span><strong>التسوق الإلكتروني</strong><small dir=\"ltr\">joker-store-ck6.pages.dev</small></span><span class=\"joker-social-arrow\" aria-hidden=\"true\">↗</span></a>\n  </div>\n</section>";
  const LINKS={
    facebook:'https://www.facebook.com/share/1FfV4E7Q4q/',
    tiktok:'https://www.tiktok.com/@goker_218',
    telegram:'https://linktr.ee/Joker82025',
    maps:'https://www.google.com/maps/search/?api=1&query=%D8%AC%D9%88%D9%83%D8%B1+%D9%84%D9%84%D8%A3%D8%AC%D9%87%D8%B2%D8%A9+%D8%A7%D9%84%D8%A5%D9%84%D9%83%D8%AA%D8%B1%D9%88%D9%86%D9%8A%D8%A9+%D9%88%D9%83%D9%85%D8%A7%D9%84%D9%8A%D8%A7%D8%AA%D9%87%D8%A7+%D8%B7%D8%B1%D8%A7%D8%A8%D9%84%D8%B3+%D9%84%D9%8A%D8%A8%D9%8A%D8%A7&query_place_id=ChIJDbbyVwCTqBMRmXfe0xP33OU'
  };
  function init(){
    if(!document.querySelector('link[href="joker-socials.css"]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='joker-socials.css';
      css.setAttribute('data-joker-addon','socials-v5-11');document.head.appendChild(css);
    }
    let hub=document.getElementById('jokerSocialHub');
    if(!hub){
      const template=document.createElement('template');template.innerHTML=HUB_HTML.trim();
      hub=template.content.firstElementChild;
      const container=document.querySelector('main.wrap')||document.querySelector('main')||document.body;
      if(!hub||!container)return;container.appendChild(hub);
    }
    const setLink=(selector,url,title)=>{
      const a=hub.querySelector(selector);if(!a)return;
      a.href=url;a.target='_blank';a.rel='noopener noreferrer';
      if(title)a.setAttribute('aria-label',title);
    };
    setLink('.joker-social-facebook',LINKS.facebook,'صفحة متجر الجوكر على فيسبوك');
    setLink('.joker-social-tiktok',LINKS.tiktok,'حساب متجر الجوكر على تيك توك');
    setLink('.joker-social-telegram',LINKS.telegram,'روابط متجر الجوكر للوصول إلى تليجرام');
    setLink('.joker-social-maps',LINKS.maps,'موقع محل الجوكر على خرائط Google');
    const fb=hub.querySelector('.joker-social-facebook small');if(fb)fb.textContent='صفحتنا على فيسبوك';
    const tt=hub.querySelector('.joker-social-tiktok small');if(tt)tt.textContent='حسابنا على تيك توك';
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();


/* JOKER V5.12 — Public UI cleanup + load ORIGINAL security warning (unchanged).
   Keep #goAdmin in the DOM: app.js assigns an onclick to it.
   The top navigation #adminBtn is intentionally kept visible to everyone.
*/
(function jokerPublicUiSecurityV512(){
  'use strict';

  function ensureStylesheet(id, path) {
    if (document.getElementById(id)) return;
    if ([...document.querySelectorAll('link[rel="stylesheet"]')]
         .some(el => (el.getAttribute('href') || '').split(/[?#]/)[0] === path)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = path;
    document.head.appendChild(link);
  }

  function ensureOriginalWarning() {
    if (window.JokerSecurityWarning) return;
    if (document.querySelector('script[data-joker-original-security]')) return;
    if ([...document.scripts].some(el => /(?:^|\/)joker-security-warning\.js(?:[?#].*)?$/.test(el.getAttribute('src') || ''))) return;
    const script = document.createElement('script');
    script.src = 'joker-security-warning.js';
    script.dataset.jokerOriginalSecurity = 'true';
    script.onerror = () => console.error('JOKER: original security warning file did not load');
    document.head.appendChild(script);
  }

  function hidePublicStaffControls() {
    // Must remain in DOM because the older app.js uses #goAdmin without a null check.
    const heroAdmin = document.getElementById('goAdmin');
    if (heroAdmin) {
      heroAdmin.hidden = true;
      heroAdmin.setAttribute('aria-hidden', 'true');
      heroAdmin.tabIndex = -1;
    }
    for (const card of document.querySelectorAll('.features > .feature')) {
      if (card.querySelector('strong')?.textContent?.trim() === 'صلاحيات الموظفين') {
        card.hidden = true;
        card.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function boot() {
    ensureStylesheet('joker-security-warning-style-v512', 'joker-security-warning.css');
    ensureStylesheet('joker-social-style-v512', 'joker-socials.css');
    hidePublicStaffControls();
    ensureOriginalWarning();
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();

