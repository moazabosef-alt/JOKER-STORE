(()=>{'use strict';
const splash=document.getElementById('jokerSplash'),skip=document.getElementById('jokerSplashSkip');
let seen=false;try{seen=sessionStorage.getItem('joker_intro_seen_v3')==='1'}catch{}
const leave=()=>{if(!splash||splash.classList.contains('is-leaving'))return;splash.classList.add('is-leaving');setTimeout(()=>splash.remove(),700);try{sessionStorage.setItem('joker_intro_seen_v3','1')}catch{}};
if(splash){if(seen)splash.remove();else{skip?.addEventListener('click',leave);window.setTimeout(leave,4300)}}
const drawer=document.getElementById('jokerDrawer'),back=document.getElementById('jokerDrawerBackdrop'),open=document.getElementById('jokerMenuButton'),close=document.getElementById('jokerDrawerClose');
const toggle=value=>{if(!drawer||!back)return;drawer.classList.toggle('open',value);back.classList.toggle('open',value);drawer.setAttribute('aria-hidden',String(!value));open?.setAttribute('aria-expanded',String(value));if(value)close?.focus();else open?.focus()};
open?.addEventListener('click',()=>toggle(true));close?.addEventListener('click',()=>toggle(false));back?.addEventListener('click',()=>toggle(false));
drawer?.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>toggle(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape')toggle(false)});
})();