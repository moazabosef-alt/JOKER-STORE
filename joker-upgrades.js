/* JOKER STORE V3 — employee usernames and product image viewer.
   Non-destructive enhancement to the existing V3 scripts. */
(() => {
  'use strict';
  const STAFF_DOMAIN = 'staff.joker-store.invalid';
  const USERNAME = /^[a-z][a-z0-9_.-]{2,31}$/;
  const $ = (selector, root = document) => root.querySelector(selector);

  function updateLoginForm() {
    const form = $('#loginForm');
    if (!form || form.dataset.jokerUsernames === 'ready') return;
    const input = $('input[name="email"]', form);
    if (!input) return;
    form.dataset.jokerUsernames = 'ready';
    input.type = 'text';
    input.autocomplete = 'username';
    input.placeholder = 'اسم الموظف أو البريد الإلكتروني للمدير';
    input.maxLength = 254;
    const text = input.closest('label')?.querySelector('span');
    if (text) text.textContent = 'اسم المستخدم للموظف / بريد المدير';
    const hint = form.nextElementSibling;
    if (hint?.classList.contains('mute')) {
      hint.textContent = 'الموظف يدخل باسم المستخدم وكلمة المرور؛ المدير يحتفظ ببريده الإلكتروني الحالي.';
    }
  }

  function updateStaffForm() {
    const form = $('#staffForm');
    if (!form || form.dataset.jokerUsernames === 'ready') return;
    const input = $('input[name="email"]', form);
    if (!input) return;
    form.dataset.jokerUsernames = 'ready';
    const isEditing = input.readOnly;
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.dir = 'ltr';
    input.placeholder = 'مثال: mohamed01';
    if (isEditing) {
      input.value = input.value.replace(new RegExp('@' + STAFF_DOMAIN.replaceAll('.', '\\.') + '$', 'i'), '');
    } else {
      input.required = true;
      input.minLength = 3;
      input.maxLength = 32;
      input.pattern = '[a-z][a-z0-9_.-]{2,31}';
      input.title = 'من 3 إلى 32 رمزًا، يبدأ بحرف إنجليزي ثم حروف إنجليزية صغيرة أو أرقام أو . أو - أو _';
    }
    const label = input.closest('label')?.querySelector('span');
    if (label) label.textContent = 'اسم المستخدم (بدون إيميل)';
    // The original V3 client transmits this field as "email". The updated
    // server function treats this legacy key as the desired username.
  }

  function updateStaffCards() {
    document.querySelectorAll('#adminContent .employeeCard .mute').forEach(element => {
      const before = element.textContent || '';
      const after = before.replace(/\b([a-z][a-z0-9_.-]{2,31})@staff\.joker-store\.invalid\b/gi, '@$1');
      if (before !== after) element.textContent = after;
    });
  }

  function updateProductCards() {
    document.querySelectorAll('.product .pic img, .product .pic .illustration').forEach(img => {
      if (img.dataset.jokerClickable === 'yes') return;
      img.dataset.jokerClickable = 'yes';
      img.setAttribute('role', 'button');
      img.tabIndex = 0;
      img.setAttribute('aria-label', 'تكبير صورة المنتج وعرض تفاصيله');
      img.title = 'اضغط لتكبير الصورة وعرض السعر والتفاصيل';
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
    const image = $(':scope > img', content);
    if (image) {
      const frame = document.createElement('div');
      frame.className = 'joker-detail-photo';
      const hint = document.createElement('span');
      hint.className = 'joker-photo-hint';
      hint.textContent = 'اضغط على الصورة للتكبير';
      content.insertBefore(frame, image);
      frame.append(image, hint);
      image.alt ||= 'صورة المنتج بحجم كبير';
      image.removeAttribute('style');
      image.loading = 'eager';
      image.tabIndex = 0;
      image.role = 'button';
      image.setAttribute('aria-label', 'تكبير الصورة أو تصغيرها');
    }
    const info = document.createElement('div');
    info.className = 'joker-detail-info';
    for (const node of [...content.childNodes]) {
      if (node !== $('.joker-detail-photo', content)) info.appendChild(node);
    }
    content.append(info);
  }

  function enhance() {
    updateLoginForm();
    updateStaffForm();
    updateStaffCards();
    updateProductCards();
    upgradeDetails();
  }

  // Capture the employee's username just before V3's original login handler
  // constructs FormData. The internal Auth identifier remains private to the UI.
  document.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || form.id !== 'loginForm') return;
    const input = $('input[name="email"]', form);
    if (!input) return;
    const typed = input.value.trim();
    if (typed.includes('@')) return; // Owner's existing email login.
    if (!USERNAME.test(typed.toLowerCase())) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const error = $('#loginError', form);
      if (error) error.textContent = 'اسم المستخدم يجب أن يبدأ بحرف إنجليزي ويتكون من 3 إلى 32 رمزًا.';
      return;
    }
    const internal = typed.toLowerCase() + '@' + STAFF_DOMAIN;
    input.value = internal;
    queueMicrotask(() => {
      if (input.isConnected && input.value === internal) input.value = typed;
    });
  }, true);

  document.addEventListener('click', event => {
    const photo = event.target.closest?.('.product .pic img, .product .pic .illustration');
    if (photo) {
      event.preventDefault();
      const card = photo.closest('.product');
      card?.querySelector('[data-detail]')?.click();
      return;
    }
    const largeImage = event.target.closest?.('.joker-detail-photo img');
    if (largeImage) {
      largeImage.closest('.joker-detail-photo')?.classList.toggle('joker-photo-zoomed');
    }
  });

  document.addEventListener('keydown', event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const target = event.target;
    if (target?.matches?.('.product .pic img, .product .pic .illustration, .joker-detail-photo img')) {
      event.preventDefault();
      target.click();
    }
  });

  let pending = false;
  const observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    queueMicrotask(() => { pending = false; enhance(); });
  });
  function start() {
    enhance();
    observer.observe(document.body, {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
