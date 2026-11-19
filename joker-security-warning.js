/* JOKER V5.8 — display-only warning after two incorrect administrative logins.
 * Never bans, identifies a phone number or reports personal information.
 */
(function(){
  'use strict';
  const KEY='joker_security_failed_attempts_v58';
  const LOGO='assets/joker-original-security-logo.png';
  let memoryAttempts=0;
  const getAttempts=()=>{try{return Math.max(memoryAttempts,Math.max(0,Math.min(2,Number(sessionStorage.getItem(KEY))||0)));}catch{return memoryAttempts;}};
  const setAttempts=n=>{memoryAttempts=n;try{sessionStorage.setItem(KEY,String(n));}catch{}};
  let pending=false,wasError='',previousFocus=null;
  function build(){
    let el=document.getElementById('joker-security-overlay');if(el)return el;
    el=document.createElement('section');el.id='joker-security-overlay';el.hidden=true;
    el.setAttribute('role','presentation');
    el.innerHTML=`<div class="js-card" role="alertdialog" aria-modal="true" aria-labelledby="jsTitle" aria-describedby="jsDescription" dir="rtl">
      <button type="button" class="js-close" aria-label="إغلاق التحذير">×</button>
      <img class="js-logo" src="${LOGO}" alt="Joker Electronics — الشعار الأصلي">
      <div class="js-symbol" aria-hidden="true"><span>×</span></div>
      <h2 class="js-title" id="jsTitle">🚨 تحذير أمني أخير</h2>
      <p class="js-eyebrow">من إدارة متجر الجوكر للإلكترونيات</p>
      <div class="js-rule"></div>
      <p class="js-copy" id="jsDescription">تم رصد محاولتين منك للدخول إلى منطقة مخصصة للمدير والموظفين المصرّح لهم فقط.</p>
      <div class="js-highlight"><small>⚠️ انتبه جيدًا!</small><strong>أمامك محاولة واحدة فقط.</strong></div>
      <p class="js-copy">إذا قمت بمحاولة ثالثة للدخول دون تصريح، فقد يتم إبلاغ إدارة المتجر لمراجعة نشاط الدخول والتحقق من هويتك، بما في ذلك طلب رقم هاتفك للتأكد مما إذا كنت من الموظفين المخوّلين أم لا.</p>
      <div class="js-last"><strong>⛔ هذا تنبيه أمني جاد!</strong><br>يرجى التوقف فورًا إذا لم تكن من الأشخاص المصرّح لهم بالدخول، وإلا فسيقوم الموقع تلقائيًا بحظرك نهائيًا من الدخول إلى متجر الجوكر وتطبيقه، ولن تتمكن من الوصول إليهما مرة أخرى.</div>
      <button type="button" class="js-ack">فهمت التحذير</button>
      <p class="js-foot">JOKER ELECTRONICS · نظام تنبيه الدخول</p>
    </div>`;
    document.body.appendChild(el);
    const close=()=>{el.hidden=true;document.body.style.removeProperty('overflow');previousFocus?.focus?.();};
    el.querySelector('.js-close').addEventListener('click',close);
    el.querySelector('.js-ack').addEventListener('click',close);
    el.addEventListener('click',ev=>{if(ev.target===el)close();});
    document.addEventListener('keydown',ev=>{if(!el.hidden&&ev.key==='Escape'){ev.preventDefault();close();}});
    return el;
  }
  function show(){const el=build();previousFocus=document.activeElement;el.hidden=false;document.body.style.overflow='hidden';el.querySelector('.js-ack')?.focus();}
  function failed(){const n=getAttempts()+1;setAttempts(n);if(n>=2)show();}
  function reset(){setAttempts(0);wasError='';pending=false;}
  // Existing owner and employee flows both update #loginError after a failed authentication.
  // Count confirmed invalid-credentials messages only, never network/timeouts or blank inputs.
  const isCredentialError=(text)=>/(اسم المستخدم أو الرقم السري غير صحيح|اسم المستخدم أو كلمة المرور غير صحيحة|(?:اسم المستخدم|الرقم السري|كلمة المرور|رمز الدخول).{0,45}(?:غير صحيح|غير صحيحة|خاطئ|خاطئة|غير موجود|غير صالحة|غير صالح|غير معروف)|(?:غير صحيح|غير صحيحة|خاطئ|خاطئة).{0,45}(?:اسم المستخدم|الرقم السري|كلمة المرور)|invalid(?: login)? credentials|invalid username or password|invalid (?:pin|password)|incorrect (?:pin|password|username)|wrong (?:pin|password|username)|الحساب غير مخوّل|غير مخوّل أو معطّل|اكتب اسم مستخدم صحيحًا ورقمًا سريًا من 4 إلى 6 أرقام)/i.test(text);
  window.addEventListener('submit',event=>{
    if(event.target?.id==='loginForm'){pending=true;wasError='';}
  },true);
  const watch=new MutationObserver(()=>{
    const node=document.getElementById('loginError');
    if(!node)return;
    const t=(node.textContent||'').trim();
    if(!t || t===wasError)return;
    wasError=t;
    if(pending&&isCredentialError(t)){pending=false;failed();}
    else if(pending){pending=false;}
  });
  function init(){build();const contents=document.getElementById('dlgContent')||document.body;watch.observe(contents,{subtree:true,characterData:true,childList:true});}
  window.JokerSecurityWarning={show,failed,reset};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
