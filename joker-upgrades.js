/* JOKER STORE V4 — Arabic/English staff usernames, 4–6 digit PINs,
   safe staff management, and existing product-image expansion.
   Staff credentials are verified ONLY by the Supabase Edge Function. */
(() => {
  'use strict';
  const $ = (sel, root = document) => root.querySelector(sel);
  const STAFF_DOMAIN = 'staff.joker-store.invalid';
  const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]{2,32}$/u;
  const PIN_PATTERN = /^[0-9]{4,6}$/;
  const clientPromise = import('https://esm.sh/@supabase/supabase-js@2.49.8')
    .then(({createClient}) => {
      const config = window.JOKER_CONFIG;
      if (!config?.supabaseUrl || !config?.supabasePublishableKey) throw Error('إعدادات Supabase غير متاحة');
      return createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {persistSession:true, autoRefreshToken:true}
      });
    });
  const normalizeName = value => String(value || '').normalize('NFC').trim().toLowerCase();
  const validUser = value => USERNAME_PATTERN.test(value) && !value.includes('@');
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let busy = false;
  let staffNameMap = null;
  let loadingStaffNames = false;

  function fetchStaffNames() {
    if (staffNameMap || loadingStaffNames) return;
    loadingStaffNames = true;
    clientPromise.then(c => c.from('joker_staff').select('user_id,username')).then(({data,error}) => {
      if (error) throw error;
      staffNameMap = new Map((data || []).map(x => [String(x.user_id), String(x.username || '')]));
      upgradeStaffCards();
    }).catch(() => {staffNameMap = new Map();}).finally(() => {loadingStaffNames = false;});
  }

  function upgradeLoginForm() {
    const form = $('#loginForm');
    if (!form || form.dataset.jokerV4 === 'yes') return;
    form.dataset.jokerV4 = 'yes';
    const input = $('input[name="email"]', form);
    if (!input) return;
    input.type = 'text';
    input.autocomplete = 'username';
    input.autocapitalize = 'none';
    input.spellcheck = false;
    input.placeholder = 'اسم مستخدم الموظف أو بريد المدير';
    const label = input.closest('label')?.querySelector('span');
    if (label) label.textContent = 'اسم مستخدم الموظف / بريد المدير';
    const password = $('input[name="password"]', form);
    if (password) password.placeholder = 'رقم الموظف السري (4 إلى 6 أرقام) أو كلمة مرور المدير';
    const hint = form.nextElementSibling;
    if (hint?.classList.contains('mute')) hint.textContent = 'الموظف: اسم مستخدم عربي أو إنجليزي ورقم سري. المدير: بريده وكلمة مروره الحالية.';
  }

  function upgradeStaffForm() {
    const form = $('#staffForm');
    if (!form || form.dataset.jokerV4 === 'yes') return;
    form.dataset.jokerV4 = 'yes';
    const input = $('input[name="email"]', form);
    if (!input) return;
    const editing = input.readOnly;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.required = true;
    input.maxLength = 32;
    input.minLength = 2;
    input.placeholder = 'مثال: نضال أو nedal';
    if (editing) {
      input.readOnly = true;
      input.closest('label').hidden = true;
    }
    const label = input.closest('label')?.querySelector('span');
    if (label) label.textContent = 'اسم المستخدم (عربي أو إنجليزي)';
    const password = $('input[name="password"]', form);
    if (password) {
      password.type = 'password';
      password.setAttribute('inputmode', 'numeric');
      password.minLength = 4;
      password.maxLength = 6;
      password.pattern = '[0-9]{4,6}';
      password.autocomplete = 'new-password';
      const passLabel = password.closest('label')?.querySelector('span');
      if (passLabel) passLabel.textContent = 'الرقم السري (4 إلى 6 أرقام، يُفضّل 6)';
    }
  }

  function upgradeStaffCards() {
    const cards = document.querySelectorAll('#adminContent .employeeCard');
    if (cards.length) fetchStaffNames();
    cards.forEach(card => {
      const edit = $('[data-staffedit]', card);
      const uid = edit?.dataset.staffedit;
      const text = $('.mute', card);
      if (text) {
        const original = text.textContent || '';
        const marker = ' · ';
        const state = original.includes(marker) ? original.slice(original.indexOf(marker)) : '';
        const username = staffNameMap?.get(String(uid));
        const updated = (username ? 'اسم المستخدم: ' + username : 'حساب موظف') + state;
        if (original !== updated) text.textContent = updated;
      }
      if (card.dataset.staffV4 === 'ready') return;
      const actions = $('.steps', card);
      if (!uid || !actions) return;
      card.dataset.staffV4 = 'ready';
      const reset = document.createElement('button');
      reset.className = 'outline smallBtn';
      reset.dataset.v4reset = uid;
      reset.textContent = 'تغيير الرقم السري';
      const del = document.createElement('button');
      del.className = 'danger smallBtn';
      del.dataset.v4delete = uid;
      del.textContent = 'حذف الموظف';
      actions.append(reset, del);
    });
    const p = $('#adminContent .summary p.mute');
    if (p && p.textContent.includes('Supabase Auth')) p.textContent = 'أضف الموظف باسمه واسم مستخدم عربي أو إنجليزي ورقم سري من 4 إلى 6 أرقام. يمكن تعديل الصلاحيات أو حذف الحساب.';
  }

  function upgradeProductCards() {
    document.querySelectorAll('.product .pic img, .product .pic .illustration').forEach(img => {
      if (img.dataset.jokerClickable) return;
      img.dataset.jokerClickable = 'yes';
      img.setAttribute('role', 'button');
      img.tabIndex = 0;
      img.title = 'اضغط لتكبير الصورة وعرض السعر والتفاصيل';
      img.setAttribute('aria-label', 'تكبير صورة المنتج وعرض تفاصيله');
    });
  }

  function upgradeDetails() {
    const content = $('#dlgContent');
    const dialog = $('#dialog');
    if (!content || !dialog) return;
    if (!$('#detailAdd', content)) {
      dialog.classList.remove('joker-product-detail');
      return;
    }
    if (content.classList.contains('joker-detail-layout')) return;
    dialog.classList.add('joker-product-detail');
    content.classList.add('joker-detail-layout');
    const img = $(':scope > img', content);
    if (img) {
      const frame = document.createElement('div');
      frame.className = 'joker-detail-photo';
      const hint = document.createElement('span');
      hint.className = 'joker-photo-hint';
      hint.textContent = 'اضغط على الصورة للتكبير';
      content.insertBefore(frame, img);
      frame.append(img, hint);
      img.removeAttribute('style');
      img.loading = 'eager';
      img.tabIndex = 0;
      img.role = 'button';
      img.setAttribute('aria-label', 'تكبير الصورة أو تصغيرها');
    }
    const info = document.createElement('div');
    info.className = 'joker-detail-info';
    for (const node of [...content.childNodes]) {
      if (node !== $('.joker-detail-photo', content)) info.appendChild(node);
    }
    content.append(info);
  }

  function enhance() {
    upgradeLoginForm();
    upgradeStaffForm();
    upgradeStaffCards();
    upgradeProductCards();
    upgradeDetails();
  }

  async function callAdmin(body) {
    const client = await clientPromise;
    const {data, error} = await client.functions.invoke('joker-staff-admin', {body});
    if (error) throw Error(error.message || 'تعذر الاتصال بخدمة الموظفين');
    if (data?.error) throw Error(data.error);
    if (!data?.ok) throw Error('لم تصل رسالة نجاح من الخادم');
    return data;
  }

  function staffError(form, message) {
    const element = $('#staffError', form) || $('#loginError', form);
    if (element) element.textContent = message;
  }

  // The original app handles the owner's email/password normally.
  // Only employee login is captured and submitted through the server-side PIN verifier.
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'loginForm') return;
    const typed = String($('input[name="email"]', form)?.value || '').trim();
    if (typed.includes('@')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    const username = normalizeName(typed);
    const pin = String($('input[name="password"]', form)?.value || '');
    if (!validUser(username) || !PIN_PATTERN.test(pin)) {
      staffError(form, 'اكتب اسم مستخدم صحيحًا ورقمًا سريًا من 4 إلى 6 أرقام.');
      return;
    }
    const button = $('button', form);
    if (button) button.disabled = true;
    busy = true;
    try {
      const client = await clientPromise;
      const config = window.JOKER_CONFIG;
      const response = await fetch(config.supabaseUrl + '/functions/v1/joker-staff-login', {
        method:'POST',
        headers:{'Content-Type':'application/json','apikey':config.supabasePublishableKey},
        body:JSON.stringify({username,pin}),
        cache:'no-store'
      });
      let data;
      try {data = await response.json();} catch {throw Error('تعذر قراءة استجابة تسجيل الدخول');}
      if (!response.ok || !data?.access_token || !data?.refresh_token) throw Error(data?.error || 'تعذر تسجيل الدخول');
      const {error} = await client.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
      if (error) throw error;
      sessionStorage.setItem('joker-v4-staff-login','yes');
      window.location.reload();
    } catch (e) {
      staffError(form,e.message || 'تعذر تسجيل الدخول');
      if (button) button.disabled = false;
    } finally { busy = false; }
  }, true);

  // Staff creation uses the new server-side endpoint. Permission edits are still
  // handled by the original admin UI, preserving the existing RLS checks.
  document.addEventListener('submit', async event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'staffForm') return;
    const usernameInput = $('input[name="email"]',form);
    if (!usernameInput || usernameInput.readOnly) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (busy) return;
    const f = new FormData(form);
    const name = String(f.get('name')||'').trim();
    const username = normalizeName(f.get('email'));
    const pin = String(f.get('password')||'');
    if (name.length < 2 || name.length > 100 || !validUser(username) || !PIN_PATTERN.test(pin)) {
      staffError(form,'اكتب اسم الموظف واسم مستخدم عربي أو إنجليزي ورقمًا سريًا من 4 إلى 6 أرقام.');
      return;
    }
    const permissions = f.getAll('perm').map(String);
    busy = true;
    const button = $('button',form);
    if(button)button.disabled=true;
    try {
      await callAdmin({action:'create_pin',name,username,pin,permissions,active:f.has('active')});
      sessionStorage.setItem('joker-v4-staff-login','yes');
      window.location.reload();
    } catch (e) {
      staffError(form,e.message || 'تعذر حفظ الموظف');
      if(button)button.disabled=false;
    } finally { busy=false; }
  }, true);

  document.addEventListener('click', async event => {
    const reset = event.target.closest?.('[data-v4reset]');
    const del = event.target.closest?.('[data-v4delete]');
    if (reset || del) {
      event.preventDefault();
      if (busy) return;
      const uid = (reset || del).dataset[reset?'v4reset':'v4delete'];
      const employeeCard = (reset || del).closest('.employeeCard');
      const employeeName = $('strong',employeeCard)?.textContent || 'الموظف';
      if (del) {
        if (!confirm(`حذف حساب ${employeeName} نهائيًا ومنعه من الدخول؟ ستُحذف بيانات حساب الموظف وصلاحياته فقط.`)) return;
        busy=true;
        del.disabled=true;
        try {
          await callAdmin({action:'delete_staff',user_id:uid});
          window.location.reload();
        } catch (e) {alert(e.message || 'تعذر حذف الموظف');del.disabled=false;}
        finally {busy=false;}
        return;
      }
      const pin = prompt(`أدخل رقمًا سريًا جديدًا للموظف ${employeeName} (4 إلى 6 أرقام، ويُفضّل 6):`);
      if (pin === null) return;
      if (!PIN_PATTERN.test(pin)) {alert('الرقم السري يجب أن يتكوّن من 4 إلى 6 أرقام إنجليزية فقط.');return;}
      if (!confirm(`تأكيد تغيير الرقم السري للموظف ${employeeName}؟ سيبطل الرقم القديم فورًا.`)) return;
      busy=true;
      reset.disabled=true;
      try {
        await callAdmin({action:'reset_pin',user_id:uid,pin});
        alert(`تم تغيير الرقم السري للموظف ${employeeName}. سلّمه الرقم الذي اخترته بطريقة خاصة.`);
      } catch(e) {alert(e.message || 'تعذر تغيير الرقم السري');}
      finally {busy=false;reset.disabled=false;}
      return;
    }

    const photo=event.target.closest?.('.product .pic img, .product .pic .illustration');
    if(photo){event.preventDefault();photo.closest('.product')?.querySelector('[data-detail]')?.click();return;}
    const large=event.target.closest?.('.joker-detail-photo img');
    if(large) large.closest('.joker-detail-photo')?.classList.toggle('joker-photo-zoomed');
  });

  document.addEventListener('keydown', event => {
    if (!['Enter',' '].includes(event.key))return;
    const target=event.target;
    if(target?.matches?.('.product .pic img, .product .pic .illustration, .joker-detail-photo img')){
      event.preventDefault();target.click();
    }
  });

  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    queueMicrotask(()=>{queued=false;enhance();});
  });
  function start(){
    enhance();
    observer.observe(document.body,{childList:true,subtree:true});
    if(sessionStorage.getItem('joker-v4-staff-login')==='yes'){
      sessionStorage.removeItem('joker-v4-staff-login');
      setTimeout(()=>$('#adminBtn')?.click(),1300);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
