// script.js - localStorage based accounts, topup, chat, admin helpers

// Utilities
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
function formatVND(n){ return new Intl.NumberFormat('vi-VN').format(Number(n)) + ' đ'; }
function now(){ return Date.now(); }

// Data helpers stored in localStorage keys
function load(key, def){ return JSON.parse(localStorage.getItem(key) || JSON.stringify(def)); }
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }

// Keys
const KEY_USERS = 'sh_users_v2';
const KEY_CUR = 'sh_curr_v2';
const KEY_PENDING = 'topup_pending_v2';
const KEY_CHATS = 'sh_chats_v2'; // object: { chatId: [msgs...] } where chatId could be username or user-admin-id

// Ensure default admin user exists
function ensureAdmin(){
  const users = load(KEY_USERS, {});
  if(!users['admin']){
    users['admin'] = { password: 'admin123', role: 'admin', balance: 0, purchases: 0, createdAt: now() };
    save(KEY_USERS, users);
  }
}
ensureAdmin();

// Auth functions
function getUsers(){ return load(KEY_USERS, {}); }
function saveUsers(u){ save(KEY_USERS, u); }
function currentUser(){ return localStorage.getItem(KEY_CUR) || null; }
function setCurrentUser(u){ if(u) localStorage.setItem(KEY_CUR, u); else localStorage.removeItem(KEY_CUR); }

function registerUser(username, password){
  const users = getUsers();
  if(users[username]) return { ok:false, msg:'Tên đăng nhập đã tồn tại' };
  users[username] = { password, role:'member', balance:0, purchases:0, createdAt: now() };
  saveUsers(users);
  setCurrentUser(username);
  return { ok:true };
}
function loginUser(username, password){
  const users = getUsers();
  if(!users[username] || users[username].password !== password) return { ok:false };
  setCurrentUser(username);
  return { ok:true };
}
function logoutUser(){ setCurrentUser(null); }

// UI: header auth UI
function renderAuthHeader(){
  const header = document.getElementById('headerActions');
  header.innerHTML = '';
  const cur = currentUser();
  if(cur){
    const users = getUsers();
    const u = users[cur];
    const span = document.createElement('div');
    span.style.display='flex'; span.style.gap='8px'; span.style.alignItems='center';
    span.innerHTML = `<span class="small">Xin chào <b>${cur}</b> • ${formatVND(u.balance||0)}</span>
      <button class="btn small" id="btnLogout">Đăng xuất</button>
      <a class="btn small" href="admin.html" target="_blank">Admin</a>`;
    header.appendChild(span);
    document.getElementById('btnLogout').addEventListener('click', ()=>{ logoutUser(); renderAuthHeader(); alert('Đã đăng xuất'); });
  } else {
    const wrapper = document.createElement('div');
    wrapper.style.display='flex'; wrapper.style.gap='8px'; wrapper.style.alignItems='center';
    wrapper.innerHTML = `<input id="regUser" placeholder="Tên đăng nhập" /><input id="regPass" placeholder="Mật khẩu" type="password" />
      <button class="btn small" id="regBtn">Đăng ký</button><button class="btn small" id="loginBtn">Đăng nhập</button>`;
    header.appendChild(wrapper);
    wrapper.querySelector('#regBtn').addEventListener('click', ()=>{
      const u = wrapper.querySelector('#regUser').value.trim();
      const p = wrapper.querySelector('#regPass').value;
      if(!u||!p) return alert('Nhập tên & mật khẩu');
      const r = registerUser(u,p);
      if(!r.ok) return alert(r.msg);
      renderAuthHeader();
      alert('Đăng ký & đăng nhập thành công');
    });
    wrapper.querySelector('#loginBtn').addEventListener('click', ()=>{
      const u = wrapper.querySelector('#regUser').value.trim();
      const p = wrapper.querySelector('#regPass').value;
      const r = loginUser(u,p);
      if(!r.ok) return alert('Sai tài khoản hoặc mật khẩu');
      renderAuthHeader();
      alert('Đăng nhập thành công');
    });
  }
}

// Products (sample)
const PRODUCTS = [
  {id:'s1', title:'Cày Blox Fruits cấp 1–2450', desc:'Cày hộ cấp, farm boss, mở haki full', price:'80000', category:'bloxfruits', img:''},
  {id:'s2', title:'Farm Trái Ác Quỷ', desc:'Farm trái bất kỳ, giao sau 10 phút', price:'35000', category:'bloxfruits', img:''},
  {id:'s3', title:'Cày Grow a Garden full map', desc:'Mở khóa items & map', price:'70000', category:'growagarden', img:''}
];

function renderProducts(){
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';
  PRODUCTS.forEach(p=>{
    const c = document.createElement('div'); c.className='card';
    c.innerHTML = `<h3>${p.title}</h3><p>${p.desc}</p><div class="price">${formatVND(p.price)}</div>
      <div style="margin-top:8px"><button class="btn buy" data-id="${p.id}">Mua dịch vụ</button></div>`;
    grid.appendChild(c);
  });
  document.querySelectorAll('.buy').forEach(b=> b.addEventListener('click', ()=> alert('Liên hệ admin để mua: Facebook / Discord')));
}

// Topup functions (store pending with bill image as data URL)
function readFileAsDataURL(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(file); }); }

async function handleConfirmTopup(){
  const cur = currentUser();
  if(!cur) return alert('Bạn phải đăng nhập');
  const amount = Number($('#topupAmount').value) || 0;
  if(amount<=0) return alert('Nhập số tiền hợp lệ');
  const txn = $('#topupTxn').value.trim();
  const billFile = $('#topupBill').files[0];
  if(!billFile) return alert('Bạn phải upload ảnh bill');
  const dataUrl = await readFileAsDataURL(billFile);
  const pending = load(KEY_PENDING, []);
  pending.push({ id: 'tp_'+now(), username: cur, amount, txn, bill:dataUrl, time: now(), status:'pending' });
  save(KEY_PENDING, pending);
  alert('Yêu cầu nạp đã được gửi. Admin sẽ kiểm tra sớm.');
  $('#topupModal').classList.add('hidden');
}

// Chat functions (store chats per user; admin sees all)
function getChats(){ return load(KEY_CHATS, {}); }
function saveChats(c){ save(KEY_CHATS, c); }

function openChatModal(){
  const cur = currentUser();
  if(!cur) return alert('Bạn phải đăng nhập');
  $('#chatModal').classList.remove('hidden');
  renderChatList();
  openChatWith(cur); // open personal chat by default
}

function renderChatList(){
  const list = document.getElementById('chatList');
  const chats = getChats();
  list.innerHTML = '';
  const cur = currentUser();
  // if admin -> show all users' chats; else show own + admin
  const users = Object.keys(getUsers());
  users.forEach(u=>{
    const el = document.createElement('div');
    el.style.padding='8px'; el.style.borderBottom='1px solid #222';
    el.innerHTML = `<b>${u}</b> <div class="small">role: ${getUsers()[u].role}</div>`;
    el.addEventListener('click', ()=> openChatWith(u));
    list.appendChild(el);
  });
}

function openChatWith(username){
  const title = document.getElementById('chatTitle');
  title.textContent = 'Chat với: ' + username;
  const msgsBox = document.getElementById('messagesBox');
  msgsBox.innerHTML = '';
  const chats = getChats();
  const chatId = chatIdFor(username);
  const msgs = chats[chatId] || [];
  msgs.forEach(m=>{
    const el = document.createElement('div'); el.className='message';
    el.innerHTML = `<div class="small">${new Date(m.time).toLocaleString()} - <b>${m.from}</b></div>
      <div>${m.text?m.text:''}${m.img?('<div><img src="'+m.img+'" style="max-width:200px;border-radius:6px;margin-top:6px"/>') : ''}</div>`;
    msgsBox.appendChild(el);
  });
  msgsBox.scrollTop = msgsBox.scrollHeight;
  // store currently opened
  msgsBox.dataset.openWith = username;
}

function chatIdFor(username){ // use conversation id as username (1-1 between admin and user)
  return 'chat_'+username;
}

async function sendMessage(){
  const cur = currentUser();
  if(!cur) return alert('Bạn phải đăng nhập');
  const txt = $('#msgText').value.trim();
  const file = $('#msgFile').files[0];
  let img = null;
  if(file) img = await readFileAsDataURL(file);
  if(!txt && !img) return;
  const chatWith = document.getElementById('messagesBox').dataset.openWith;
  const id = chatIdFor(chatWith);
  const chats = getChats();
  chats[id] = chats[id] || [];
  chats[id].push({ from: cur, text: txt, img: img, time: now() });
  saveChats(chats);
  $('#msgText').value=''; $('#msgFile').value='';
  openChatWith(chatWith);
}

// Admin functions: login check, render pending, confirm
function appAdminLogin(u,p){
  const users = getUsers();
  if(!users[u] || users[u].password !== p) return false;
  if(users[u].role !== 'admin') return false;
  setCurrentUser(u);
  return true;
}

function renderAdminPending(){
  const pend = load(KEY_PENDING, []);
  const el = document.getElementById('pendingList');
  if(!el) return;
  if(pend.length===0){ el.innerHTML = '<p>Không có giao dịch chờ</p>'; return; }
  el.innerHTML = pend.map((p,idx)=>`
    <div style="background:#111;padding:10px;border-radius:8px;margin-bottom:8px;">
      <b>${p.username}</b> — ${formatVND(p.amount)} — ${new Date(p.time).toLocaleString()}<br/>
      Mã: ${p.txn||'-'} <br/>
      <img src="${p.bill}" style="max-width:220px;border-radius:6px;margin-top:6px"/><br/>
      <button class="btn confirm" data-idx="${idx}">Confirm</button>
      <button class="btn" style="background:#888" onclick="adminDecline(${idx})">Decline</button>
    </div>
  `).join('');
  // attach confirm handlers
  document.querySelectorAll('.confirm').forEach(b=> b.addEventListener('click', (e)=>{
    const idx = Number(e.currentTarget.dataset.idx);
    adminConfirmTopup(idx);
  }));
}

function adminConfirmTopup(idx){
  const pend = load(KEY_PENDING, []);
  const rec = pend[idx];
  if(!rec) return alert('Không tìm thấy giao dịch');
  // only admin/staff allowed - check current user role
  const cur = currentUser();
  if(!cur) return alert('Bạn phải đăng nhập admin');
  const users = getUsers();
  if(!users[cur] || (users[cur].role !== 'admin' && users[cur].role !== 'staff')) return alert('Bạn không có quyền');
  // credit user
  if(!users[rec.username]) return alert('User không tồn tại');
  users[rec.username].balance = (Number(users[rec.username].balance||0) + Number(rec.amount));
  saveUsers(users);
  // record history by moving to history key
  const hist = load('topup_history_v2', []);
  rec.status='confirmed'; rec.confirmedBy = cur; rec.confirmedAt = now();
  hist.push(rec);
  save('topup_history_v2', hist);
  // remove from pending
  pend.splice(idx,1);
  save(KEY_PENDING, pend);
  alert('Đã cộng tiền cho ' + rec.username);
  renderAdminPending(); renderAdminUsers();
}

function adminDecline(idx){
  const pend = load(KEY_PENDING, []);
  const rec = pend[idx];
  if(!rec) return;
  const hist = load('topup_history_v2', []);
  rec.status='declined'; rec.declinedAt = now();
  hist.push(rec); save('topup_history_v2', hist);
  pend.splice(idx,1); save(KEY_PENDING, pend); renderAdminPending(); renderAdminUsers();
}

function renderAdminUsers(){
  const users = getUsers();
  const el = document.getElementById('usersList');
  if(!el) return;
  el.innerHTML = Object.keys(users).map(u=>{
    const info = users[u];
    return `<div style="background:#111;padding:10px;border-radius:8px;margin-bottom:8px;">
      <b>${u}</b> — Role: ${info.role} — Balance: ${formatVND(info.balance||0)} — Purchases: ${info.purchases||0}
      <div style="margin-top:6px;"><button class="btn grant" data-u="${u}">Grant staff</button> <button class="btn revoke" data-u="${u}">Revoke</button></div>
    </div>`;
  }).join('');
  document.querySelectorAll('.grant').forEach(b=> b.addEventListener('click', e=>{
    const u = e.currentTarget.dataset.u;
    const us = getUsers(); us[u].role='staff'; saveUsers(us); renderAdminUsers();
  }));
  document.querySelectorAll('.revoke').forEach(b=> b.addEventListener('click', e=>{
    const u = e.currentTarget.dataset.u;
    const us = getUsers(); us[u].role='member'; saveUsers(us); renderAdminUsers();
  }));
}

// Expose admin render functions for admin.html
window.renderAdminPending = renderAdminPending;
window.renderAdminUsers = renderAdminUsers;
window.appAdminLogin = appAdminLogin;

// Event bindings for index page
window.addEventListener('DOMContentLoaded', ()=>{
  renderAuthHeader();
  renderProducts();
  document.getElementById('year').textContent = new Date().getFullYear();

  // topup modal
  $('#openTopUp').addEventListener('click', ()=>{
    if(!currentUser()){ alert('Bạn phải đăng nhập trước khi nạp'); return; }
    $('#topupModal').classList.remove('hidden');
  });
  $('#topupClose').addEventListener('click', ()=> $('#topupModal').classList.add('hidden'));
  $('#confirmTopup').addEventListener('click', ()=> handleConfirmTopup());

  // chat modal
  $('#openChat').addEventListener('click', ()=> openChatModal());
  $('#chatClose').addEventListener('click', ()=> $('#chatModal').classList.add('hidden'));
  $('#sendMsg').addEventListener('click', ()=> sendMessage());
});
