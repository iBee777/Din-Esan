


/* ===== ระบบจัดเก็บข้อมูลสำหรับเบราว์เซอร์ทั่วไป =====
   - ข้อมูลข้อความเก็บใน localStorage
   - รูปโฉนดเก็บใน IndexedDB เพื่อไม่ให้พื้นที่ localStorage เต็มบนมือถือ
*/
(function(){
  const DB_NAME = 'din-esan-db';
  const DB_VERSION = 1;
  const IMAGE_STORE = 'images';

  function isImageKey(key){
    return String(key || '').startsWith('deed_image:');
  }

  function openDb(){
    return new Promise((resolve, reject) => {
      if(!('indexedDB' in window)){
        reject(new Error('เบราว์เซอร์นี้ไม่รองรับ IndexedDB'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if(!db.objectStoreNames.contains(IMAGE_STORE)){
          db.createObjectStore(IMAGE_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('เปิดฐานข้อมูลรูปภาพไม่สำเร็จ'));
    });
  }

  async function idbGet(key){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, 'readonly');
      const req = tx.objectStore(IMAGE_STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  async function idbSet(key, value){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, 'readwrite');
      tx.objectStore(IMAGE_STORE).put(value, key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { const e = tx.error; db.close(); reject(e); };
      tx.onabort = () => { const e = tx.error; db.close(); reject(e); };
    });
  }

  async function idbDelete(key){
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IMAGE_STORE, 'readwrite');
      tx.objectStore(IMAGE_STORE).delete(key);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { const e = tx.error; db.close(); reject(e); };
    });
  }

  window.storage = {
    get: async function(key, shared){
      if(isImageKey(key)){
        let value = await idbGet(key);
        // ย้ายรูปเดิมจาก localStorage ไป IndexedDB อัตโนมัติ
        if(value === null){
          const legacy = localStorage.getItem('ws:' + key);
          if(legacy !== null){
            try{
              await idbSet(key, legacy);
              localStorage.removeItem('ws:' + key);
            }catch(e){}
            value = legacy;
          }
        }
        if(value === null) throw new Error('Key not found: ' + key);
        return { key, value, shared: !!shared };
      }
      const value = localStorage.getItem('ws:' + key);
      if(value === null) throw new Error('Key not found: ' + key);
      return { key, value, shared: !!shared };
    },
    set: async function(key, value, shared){
      try{
        if(isImageKey(key)){
          await idbSet(key, value);
        }else{
          localStorage.setItem('ws:' + key, value);
        }
        return { key, value, shared: !!shared };
      }catch(e){
        if(e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')){
          throw new Error('พื้นที่จัดเก็บเต็ม กรุณาลบข้อมูลหรือรูปภาพเก่าบางส่วนก่อน');
        }
        throw e;
      }
    },
    delete: async function(key, shared){
      if(isImageKey(key)){
        await idbDelete(key);
        localStorage.removeItem('ws:' + key);
      }else{
        localStorage.removeItem('ws:' + key);
      }
      return { key, deleted: true, shared: !!shared };
    },
    list: async function(prefix, shared){
      const keys = [];
      const p = prefix ? 'ws:' + prefix : 'ws:';
      for(let i = 0; i < localStorage.length; i++){
        const k = localStorage.key(i);
        if(k && k.startsWith(p)) keys.push(k.slice(3));
      }
      return { keys, prefix, shared: !!shared };
    }
  };
})();
/* ===== จบระบบจัดเก็บข้อมูล ===== */

/* ====== ตั้งค่า Google Drive (ทำครั้งเดียว) ======
   1. ไปที่ https://console.cloud.google.com/ สร้างโปรเจกต์ใหม่ (หรือใช้โปรเจกต์เดิม)
   2. เปิดใช้งาน "Google Drive API" ในเมนู APIs & Services > Library
   3. ไปที่ APIs & Services > Credentials > Create Credentials > OAuth client ID
      - Application type: Web application
      - Authorized JavaScript origins: ใส่ URL ของหน้านี้ที่จะใช้งานจริง
        (ต้องเป็น http:// หรือ https:// เท่านั้น เปิดจากไฟล์ในเครื่องตรงๆ (file://) จะใช้ไม่ได้
         ต้องอัปโหลดไฟล์นี้ขึ้นที่ใดที่หนึ่งก่อน เช่น GitHub Pages, Netlify หรือเว็บโฮสติ้งของคุณ)
   4. คัดลอก "Client ID" ที่ได้มาวางแทนข้อความด้านล่างนี้

   ข้อควรระวัง: ต้องใช้ "Client ID" เท่านั้น ห้ามใช้ "API key"
   - Client ID หน้าตาแบบนี้:  116945574846-ab12cd34ef56gh78.apps.googleusercontent.com
     (ตัวเลข ขีด แล้วตามด้วยตัวอักษร/ตัวเลขผสมกัน)
   - API key หน้าตาแบบนี้:    AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
     (ขึ้นต้นด้วย "AIzaSy" เสมอ — ถ้าค่าที่จะวางขึ้นต้นแบบนี้ แสดงว่าหยิบมาผิดอัน)
   ================================================== */
const GOOGLE_CLIENT_ID = '203310648822-st6pfgi8f8mdpgjcdvvue0mkgf6nr459.apps.googleusercontent.com';
/* อีเมล Google Drive ที่จะเชื่อมต่ออัตโนมัติเมื่อผู้ใช้ล็อกอิน */
const DRIVE_OWNER_EMAIL = 'ibeephoto87@gmail.com';
const LINE_PROXY_URL = 'https://script.google.com/macros/s/AKfycbyjNi2QVWsZIIVZGe6jT7cKRJTPJHPDskujhG17CIO7Ox_jxxmZyTJi7wU5zgYWJbt3/exec';

/* ====== ตั้งค่าอีเมลที่อนุญาต (จำกัดการเข้าถึง) ======
   ใส่อีเมล Google ที่อนุญาตให้เข้าใช้งานระบบ
   ถ้าต้องการอนุญาตทุกคนให้เว้นว่างไว้: const ALLOWED_EMAILS = [];
   ================================================== */
const ALLOWED_EMAILS = [
  'ibeephoto87@gmail.com',
  'dinesan989@gmail.com',
  'rattanaporn.kit2@gmail.com',
   'ibeephoto77@gmail.com',
];
function isDriveConfigured(){
  if(!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.indexOf('YOUR_CLIENT_ID_HERE') !== -1) return false;
  // รูปแบบ Client ID ที่ถูกต้องคือ "<ตัวเลข>-<ตัวอักษร/ตัวเลข>.apps.googleusercontent.com"
  const looksLikeValidClientId = /^\d+-[0-9A-Za-z_-]+\.apps\.googleusercontent\.com$/.test(GOOGLE_CLIENT_ID);
  if(!looksLikeValidClientId){
    console.error('GOOGLE_CLIENT_ID ดูเหมือนไม่ใช่ Client ID ที่ถูกต้อง (ค่าปัจจุบัน: ' + GOOGLE_CLIENT_ID + ') — ตรวจสอบว่าหยิบมาจาก Google Cloud Console > Credentials > OAuth client ID ไม่ใช่ API key');
  }
  return looksLikeValidClientId;
}
let records = [];
let editingId = null;

let pendingFrontImage = null;
let pendingBackImage = null;
let removeFrontFlag = false;
let removeBackFlag = false;

function genId(){
  return 'rec_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
}

function imageKey(id, side){
  return `deed_image:${id}:${side}`;
}

function compressImage(file){
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('โหลดรูปไม่สำเร็จ'));
      img.onload = () => {
        const maxDim = 1280;
        let { width, height } = img;
        if(width > maxDim || height > maxDim){
          if(width > height){
            height = Math.round(height * (maxDim / width));
            width = maxDim;
          }else{
            width = Math.round(width * (maxDim / height));
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function setPreview(side, dataUrl){
  const box = document.getElementById(side + '-preview');
  if(dataUrl){
    box.innerHTML = `<img class="img-thumb" src="${dataUrl}" alt="">`;
  }else{
    box.innerHTML = `<div class="img-placeholder">ไม่มีรูป</div>`;
  }
}

async function loadRecords(){
  try{
    const res = await window.storage.get(STORAGE_KEY, false);
    records = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){
    records = [];
  }
  render();
}

async function saveRecords(){
  try{
    await window.storage.set(STORAGE_KEY, JSON.stringify(records), false);
    return true;
  }catch(e){
    console.error('บันทึกข้อมูลไม่สำเร็จ', e);
    alert('บันทึกข้อมูลไม่สำเร็จ: ' + (e && e.message ? e.message : 'กรุณาลองใหม่'));
    return false;
  }
}

async function handleImageInput(e){
  const side = e.target.dataset.side;
  const file = e.target.files[0];
  if(!file) return;
  try{
    const dataUrl = await compressImage(file);
    if(side === 'front'){
      pendingFrontImage = dataUrl;
      removeFrontFlag = false;
      setPreview('front', dataUrl);
      document.getElementById('front-remove-btn').style.display = 'inline-block';
    }else{
      pendingBackImage = dataUrl;
      removeBackFlag = false;
      setPreview('back', dataUrl);
      document.getElementById('back-remove-btn').style.display = 'inline-block';
    }
  }catch(err){
    alert('ไม่สามารถอ่านรูปนี้ได้ กรุณาลองรูปอื่น');
  }
  e.target.value = '';
}

document.getElementById('f-deed-front-gallery').addEventListener('change', handleImageInput);
document.getElementById('f-deed-back-gallery').addEventListener('change', handleImageInput);

document.getElementById('front-remove-btn').addEventListener('click', () => {
  pendingFrontImage = null;
  removeFrontFlag = true;
  setPreview('front', null);
  document.getElementById('front-remove-btn').style.display = 'none';
});

document.getElementById('back-remove-btn').addEventListener('click', () => {
  pendingBackImage = null;
  removeBackFlag = true;
  setPreview('back', null);
  document.getElementById('back-remove-btn').style.display = 'none';
});

function resetImageState(){
  pendingFrontImage = null;
  pendingBackImage = null;
  removeFrontFlag = false;
  removeBackFlag = false;
  setPreview('front', null);
  setPreview('back', null);
  document.getElementById('front-remove-btn').style.display = 'none';
  document.getElementById('back-remove-btn').style.display = 'none';
}

function escapeHtml(str){
  return (str || '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
}

function formatDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' }) +
    ' ' + d.toLocaleTimeString('th-TH', { hour:'2-digit', minute:'2-digit' });
}

function mapLinkFor(coords){
  if(!coords) return '';
  const cleaned = coords.trim();
  if(!cleaned) return '';
  return `https://www.google.com/maps?q=${encodeURIComponent(cleaned)}`;
}

function mapEmbedFor(coords){
  if(!coords) return '';
  const cleaned = coords.trim();
  if(!cleaned) return '';
  return `https://maps.google.com/maps?q=${encodeURIComponent(cleaned)}&output=embed`;
}

function openMap(coords){
  const embedUrl = mapEmbedFor(coords);
  if(!embedUrl) return;
  document.getElementById('map-iframe').src = embedUrl;
  document.getElementById('map-external-link').href = mapLinkFor(coords);
  document.getElementById('map-overlay').classList.add('open');
}

function closeMap(){
  document.getElementById('map-overlay').classList.remove('open');
  document.getElementById('map-iframe').src = '';
}

document.getElementById('map-close').addEventListener('click', closeMap);
document.getElementById('map-overlay').addEventListener('click', (e) => {
  if(e.target.id === 'map-overlay') closeMap();
});

function formatPrice(price){
  const n = Number(String(price).replace(/[, ]/g, ''));
  if(!price || isNaN(n)) return '';
  return n.toLocaleString('th-TH') + ' บาท';
}

function updateCommissionBox(){
  const priceInput = document.getElementById('f-price');
  const raw = String(priceInput.value).replace(/[,\s]/g, '');
  const n = Number(raw);
  const box = document.getElementById('commission-box');
  if(!raw || isNaN(n) || n <= 0){
    box.style.display = 'none';
    return;
  }
  box.style.display = 'block';
  const commission = Math.round(n * 0.03);
  const net = n - commission;
  document.getElementById('commission-amount').textContent = commission.toLocaleString('th-TH') + ' บาท';
  document.getElementById('commission-net').textContent = net.toLocaleString('th-TH') + ' บาท';
}

document.getElementById('f-price').addEventListener('input', updateCommissionBox);

document.getElementById('f-marketing').addEventListener('change', function(){
  const row = document.getElementById('marketing-cost-row');
  if(this.checked){
    row.classList.add('show');
  } else {
    row.classList.remove('show');
    document.getElementById('f-marketing-cost').value = '';
  }
});

document.getElementById('f-marketing-cost').addEventListener('input', (e) => {
  const input = e.target;
  const cursorFromEnd = input.value.length - input.selectionStart;
  const digitsOnly = input.value.replace(/[^\d]/g, '');
  const formatted = digitsOnly ? Number(digitsOnly).toLocaleString('en-US') : '';
  input.value = formatted;
  const pos = Math.max(0, formatted.length - cursorFromEnd);
  input.setSelectionRange(pos, pos);
});

function formatArea(r){
  const rai = Number(r.areaRai) || 0;
  const ngan = Number(r.areaNgan) || 0;
  const wah = Number(r.areaWah) || 0;
  if(!rai && !ngan && !wah) return '';
  const parts = [];
  if(rai) parts.push(`${rai} ไร่`);
  if(ngan) parts.push(`${ngan} งาน`);
  if(wah) parts.push(`${wah} ตารางวา`);
  return parts.join(' ') || '0 ตารางวา';
}

function render(){
  const q = document.getElementById('search-box').value.trim().toLowerCase();
  const filtered = records.filter(r => {
    if(!q) return true;
    return (r.firstname + ' ' + r.lastname).toLowerCase().includes(q) ||
      (r.phone||'').toLowerCase().includes(q) ||
      (r.deed||'').toLowerCase().includes(q) ||
      (r.social||'').toLowerCase().includes(q) ||
      (r.district||'').toLowerCase().includes(q) ||
      (r.province||'').toLowerCase().includes(q) ||
      (String(r.price||'')).toLowerCase().includes(q);
  }).sort((a,b) => b.createdAt - a.createdAt);

  document.getElementById('count-pill').textContent = filtered.length + ' รายการ' +
    (q && filtered.length !== records.length ? ` (จากทั้งหมด ${records.length})` : '');
  renderBackupUi();
  if(typeof populateCustomerSelect === 'function') populateCustomerSelect();

  const area = document.getElementById('list-area');

  if(filtered.length === 0){
    area.innerHTML = `<div class="empty"><div class="stamp">โฉนด</div>
      <div>${ records.length === 0 ? 'ยังไม่มีรายการลูกค้า — เริ่มเพิ่มรายการแรกได้เลย' : 'ไม่พบรายการที่ตรงกับการค้นหา' }</div></div>`;
    return;
  }

  area.innerHTML = filtered.map(r => {
    const mapUrl = mapLinkFor(r.coords);
    return `
    <div class="record" data-id="${r.id}">
      <div>
        <div class="name">${escapeHtml(r.firstname)} ${escapeHtml(r.lastname)}</div>
        <div class="meta-row">
          ${r.phone ? `<span><b>โทร:</b> ${escapeHtml(r.phone)}</span>` : ''}
          ${r.social ? `<span><b>ไลน์/เฟสบุ๊ค:</b> ${escapeHtml(r.social)}</span>` : ''}
          ${r.deed ? `<span><b>โฉนดเลขที่:</b> ${escapeHtml(r.deed)}</span>` : ''}
          ${(r.district || r.province) ? `<span><b>ที่ตั้ง:</b> ${[r.district, r.province].filter(Boolean).map(escapeHtml).join(' ')}</span>` : ''}
          ${formatArea(r) ? `<span><b>เนื้อที่:</b> ${escapeHtml(formatArea(r))}</span>` : ''}
          ${r.price ? `<span><b>ราคา:</b> ${escapeHtml(formatPrice(r.price))}</span>` : ''}
          ${r.price ? (() => { const n = Number(String(r.price).replace(/[,\s]/g,'')); if(!isNaN(n)&&n>0){ const c=Math.round(n*0.03); const net=n-c; return `<span><b>ค่านายหน้า 3%:</b> ${c.toLocaleString('th-TH')} บาท &nbsp;|&nbsp; <b>คงเหลือ:</b> ${net.toLocaleString('th-TH')} บาท${r.marketing?'<span class="badge-marketing">ทำการตลาด</span>':''}${r.marketingCost?` <span style="font-size:12px;color:var(--clay-dark)">(ค่าการตลาด: ${Number(String(r.marketingCost).replace(/[,\s]/g,'')).toLocaleString('th-TH')} บาท)</span>`:''}</span>`; } return ''; })() : ''}
          ${r.coords ? `<span><b>พิกัด:</b> ${escapeHtml(r.coords)}</span>` : ''}
        </div>
        ${r.notes ? `<div class="notes">${escapeHtml(r.notes)}</div>` : ''}
        <div class="date">บันทึกเมื่อ ${formatDate(r.createdAt)}${r.updatedAt && r.updatedAt !== r.createdAt ? ' · แก้ไขล่าสุด ' + formatDate(r.updatedAt) : ''}</div>
      </div>
      <div class="record-actions">
        ${mapUrl ? `<button class="icon-btn map-btn" title="เปิดแผนที่" data-coords="${escapeHtml(r.coords)}" onclick="openMap(this.dataset.coords)">Maps</button>` : ''}
        ${r.hasFront ? `<button class="icon-btn deed-btn" title="ดูรูปหน้าโฉนด" onclick="viewDeedImage('${r.id}','front')">หน้า</button>` : ''}
        ${r.hasBack ? `<button class="icon-btn deed-btn" title="ดูรูปหลังโฉนด" onclick="viewDeedImage('${r.id}','back')">หลัง</button>` : ''}
        <button class="icon-btn" title="แก้ไข" onclick="startEdit('${r.id}')">แก้ไข</button>
        <button class="icon-btn danger" title="ลบ" onclick="deleteRecord('${r.id}')">ลบ</button>
      </div>
    </div>`;
  }).join('');
}

async function viewDeedImage(id, side){
  try{
    const res = await window.storage.get(imageKey(id, side), false);
    if(!res || !res.value){
      alert('ไม่พบรูปภาพนี้');
      return;
    }
    document.getElementById('lightbox-img').src = res.value;
    document.getElementById('lightbox-title').textContent = side === 'front' ? 'รูปโฉนด (หน้า)' : 'รูปโฉนด (หลัง)';
    document.getElementById('lightbox-overlay').classList.add('open');
  }catch(e){
    alert('ไม่สามารถโหลดรูปภาพได้');
  }
}

function closeLightbox(){
  document.getElementById('lightbox-overlay').classList.remove('open');
  document.getElementById('lightbox-img').src = '';
}

document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
document.getElementById('lightbox-overlay').addEventListener('click', (e) => {
  if(e.target.id === 'lightbox-overlay') closeLightbox();
});

function clearForm(){
  document.getElementById('f-firstname').value = '';
  document.getElementById('f-lastname').value = '';
  document.getElementById('f-phone').value = '';
  document.getElementById('f-social').value = '';
  document.getElementById('f-deed').value = '';
  document.getElementById('f-district').value = '';
  document.getElementById('f-province').value = '';
  document.getElementById('f-price').value = '';
  document.getElementById('f-area-rai').value = '';
  document.getElementById('f-area-ngan').value = '';
  document.getElementById('f-area-wah').value = '';
  document.getElementById('f-coords').value = '';
  document.getElementById('f-notes').value = '';
  document.getElementById('f-marketing').checked = false;
  document.getElementById('f-marketing-cost').value = '';
  document.getElementById('marketing-cost-row').classList.remove('show');
  document.getElementById('commission-box').style.display = 'none';
  resetImageState();
}

async function startEdit(id){
  const r = records.find(x => x.id === id);
  if(!r) return;
  editingId = id;
  document.getElementById('f-firstname').value = r.firstname;
  document.getElementById('f-lastname').value = r.lastname;
  document.getElementById('f-phone').value = r.phone || '';
  document.getElementById('f-social').value = r.social || '';
  document.getElementById('f-deed').value = r.deed || '';
  document.getElementById('f-district').value = r.district || '';
  document.getElementById('f-province').value = r.province || '';
  document.getElementById('f-price').value = r.price ? Number(String(r.price).replace(/[^\d]/g, '')).toLocaleString('en-US') : '';
  document.getElementById('f-area-rai').value = r.areaRai || '';
  document.getElementById('f-area-ngan').value = r.areaNgan || '';
  document.getElementById('f-area-wah').value = r.areaWah || '';
  document.getElementById('f-coords').value = r.coords || '';
  document.getElementById('f-notes').value = r.notes || '';
  document.getElementById('f-marketing').checked = r.marketing || false;
  document.getElementById('f-marketing-cost').value = r.marketingCost || '';
  if(r.marketing){
    document.getElementById('marketing-cost-row').classList.add('show');
  } else {
    document.getElementById('marketing-cost-row').classList.remove('show');
  }
  updateCommissionBox();

  pendingFrontImage = null;
  pendingBackImage = null;
  removeFrontFlag = false;
  removeBackFlag = false;
  setPreview('front', null);
  setPreview('back', null);
  document.getElementById('front-remove-btn').style.display = r.hasFront ? 'inline-block' : 'none';
  document.getElementById('back-remove-btn').style.display = r.hasBack ? 'inline-block' : 'none';

  if(r.hasFront){
    window.storage.get(imageKey(id, 'front'), false)
      .then(res => { if(res && res.value && !pendingFrontImage) setPreview('front', res.value); })
      .catch(() => {});
  }
  if(r.hasBack){
    window.storage.get(imageKey(id, 'back'), false)
      .then(res => { if(res && res.value && !pendingBackImage) setPreview('back', res.value); })
      .catch(() => {});
  }

  document.getElementById('form-title').textContent = 'แก้ไขรายการลูกค้า';
  document.getElementById('edit-flag').style.display = 'block';
  document.getElementById('submit-btn').textContent = 'บันทึกการแก้ไข';
  document.getElementById('cancel-btn').style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function stopEdit(){
  editingId = null;
  clearForm();
  document.getElementById('form-title').textContent = 'เพิ่มรายการลูกค้าใหม่';
  document.getElementById('edit-flag').style.display = 'none';
  document.getElementById('submit-btn').textContent = 'บันทึกรายการ';
  document.getElementById('cancel-btn').style.display = 'none';
}

async function deleteRecord(id){
  if(!confirm('ต้องการลบรายการนี้หรือไม่?')) return;
  const r = records.find(x => x.id === id);
  records = records.filter(x => x.id !== id);
  await saveRecords();
  if(r && r.hasFront){
    try{ await window.storage.delete(imageKey(id, 'front'), false); }catch(e){}
  }
  if(r && r.hasBack){
    try{ await window.storage.delete(imageKey(id, 'back'), false); }catch(e){}
  }
  if(editingId === id) stopEdit();
  render();
}

/* ===== Appointment calendar (นัดหมายดูพื้นที่) ===== */
const APPT_STORAGE_KEY = 'land_client_appointments';
let appointments = [];
let calendarViewDate = new Date();
let selectedCalDate = todayStr();

async function loadAppointments(){
  try{
    const res = await window.storage.get(APPT_STORAGE_KEY, false);
    appointments = res && res.value ? JSON.parse(res.value) : [];
  }catch(e){
    appointments = [];
  }
}

async function saveAppointments(){
  try{
    await window.storage.set(APPT_STORAGE_KEY, JSON.stringify(appointments), false);
  }catch(e){
    console.error('บันทึกนัดหมายไม่สำเร็จ', e);
    alert('เกิดข้อผิดพลาดในการบันทึกนัดหมาย');
  }
}

function apptDateKey(d){
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function populateCustomerSelect(){
  const sel = document.getElementById('appt-customer');
  const current = sel.value;
  const sorted = [...records].sort((a, b) =>
    (a.firstname + a.lastname).localeCompare(b.firstname + b.lastname, 'th'));
  sel.innerHTML = '<option value="">— ไม่ระบุ / อื่นๆ —</option>' +
    sorted.map(r => `<option value="${r.id}">${escapeHtml(r.firstname)} ${escapeHtml(r.lastname)}${r.deed ? ' (โฉนด ' + escapeHtml(r.deed) + ')' : ''}</option>`).join('');
  if(current && sorted.some(r => r.id === current)) sel.value = current;
}

document.getElementById('appt-customer').addEventListener('change', (e) => {
  const id = e.target.value;
  const r = records.find(x => x.id === id);
  if(r && r.coords){
    document.getElementById('appt-location').value = r.coords;
  }
});

function renderCalendar(){
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  document.getElementById('cal-month-label').textContent =
    calendarViewDate.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' });

  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const apptCountByDate = {};
  appointments.forEach(a => {
    apptCountByDate[a.date] = (apptCountByDate[a.date] || 0) + 1;
  });

  const todayKey = todayStr();
  let html = '';
  for(let i = 0; i < startWeekday; i++){
    html += `<div class="calendar-day empty"></div>`;
  }
  for(let day = 1; day <= daysInMonth; day++){
    const dateObj = new Date(year, month, day);
    const key = apptDateKey(dateObj);
    const count = apptCountByDate[key] || 0;
    const classes = ['calendar-day'];
    if(key === todayKey) classes.push('today');
    if(key === selectedCalDate) classes.push('selected');
    html += `<div class="${classes.join(' ')}" onclick="selectCalDate('${key}')">
      <span class="calendar-day-num">${day}</span>
      ${count ? `<span class="calendar-day-dot">${count} นัด</span>` : ''}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML = html;
  renderApptListForSelected();
}

function selectCalDate(key){
  selectedCalDate = key;
  document.getElementById('appt-date').value = key;
  renderCalendar();
}

function renderApptListForSelected(){
  const list = appointments
    .filter(a => a.date === selectedCalDate)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const titleEl = document.getElementById('appt-list-title');
  const dateLabel = new Date(selectedCalDate + 'T00:00:00')
    .toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  titleEl.textContent = selectedCalDate === todayStr() ? `นัดหมายวันนี้ (${dateLabel})` : `นัดหมายวันที่ ${dateLabel}`;

  const area = document.getElementById('appt-list-area');
  if(!list.length){
    area.innerHTML = `<div class="appt-empty">ไม่มีนัดหมายในวันนี้</div>`;
    return;
  }

  area.innerHTML = list.map(a => {
    const mapUrl = mapLinkFor(a.location);
    return `<div class="appt-item">
      <div>
        <div><span class="appt-time">${a.time ? escapeHtml(a.time) + ' น.' : 'ไม่ระบุเวลา'}</span> — <span class="appt-customer">${escapeHtml(a.customerName || 'ไม่ระบุลูกค้า')}</span></div>
        ${a.location ? `<div class="appt-meta">สถานที่: ${escapeHtml(a.location)}${mapUrl ? ` &nbsp;<button type="button" class="icon-btn map-btn" style="display:inline-flex; width:auto; height:auto; padding:2px 8px; font-size:11.5px;" data-coords="${escapeHtml(a.location)}" onclick="openMap(this.dataset.coords)">แผนที่</button>` : ''}</div>` : ''}
        ${a.notes ? `<div class="appt-meta">${escapeHtml(a.notes)}</div>` : ''}
      </div>
      <div class="appt-actions">
        <button type="button" class="icon-btn danger" title="ลบนัดหมาย" onclick="deleteAppointment('${a.id}')">ลบ</button>
      </div>
    </div>`;
  }).join('');
}

async function deleteAppointment(id){
  if(!confirm('ต้องการลบนัดหมายนี้หรือไม่?')) return;
  appointments = appointments.filter(a => a.id !== id);
  await saveAppointments();
  renderCalendar();
}

document.getElementById('cal-prev').addEventListener('click', () => {
  calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('cal-next').addEventListener('click', () => {
  calendarViewDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1, 1);
  renderCalendar();
});

document.getElementById('appt-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const date = document.getElementById('appt-date').value;
  if(!date){
    alert('กรุณาเลือกวันที่นัดหมาย');
    return;
  }
  const customerId = document.getElementById('appt-customer').value;
  const customer = records.find(r => r.id === customerId);
  const appt = {
    id: genId(),
    customerId: customerId || '',
    customerName: customer ? `${customer.firstname} ${customer.lastname}` : '',
    date,
    time: document.getElementById('appt-time').value,
    location: document.getElementById('appt-location').value.trim(),
    notes: document.getElementById('appt-notes').value.trim(),
    createdAt: Date.now()
  };
  appointments.push(appt);
  await saveAppointments();

  document.getElementById('appt-time').value = '';
  document.getElementById('appt-location').value = '';
  document.getElementById('appt-notes').value = '';
  document.getElementById('appt-customer').value = '';

  selectedCalDate = date;
  calendarViewDate = new Date(date + 'T00:00:00');
  renderCalendar();
});

const BACKUP_DATE_KEY = 'land_client_last_backup_date';
let lastBackupDate = null;

function todayStr(){
  return new Date().toISOString().slice(0, 10);
}

async function loadLastBackupDate(){
  try{
    const res = await window.storage.get(BACKUP_DATE_KEY, false);
    lastBackupDate = res && res.value ? res.value : null;
  }catch(e){
    lastBackupDate = null;
  }
}

async function setLastBackupDate(dateStr){
  lastBackupDate = dateStr;
  try{
    await window.storage.set(BACKUP_DATE_KEY, dateStr, false);
  }catch(e){
    console.error('บันทึกวันที่แบ็คอัพไม่สำเร็จ', e);
  }
}

function renderBackupUi(){
  const label = document.getElementById('last-backup-label');
  if(lastBackupDate){
    const d = new Date(lastBackupDate);
    label.textContent = 'แบ็คอัพล่าสุด: ' + d.toLocaleDateString('th-TH', { year:'numeric', month:'short', day:'numeric' });
  }else{
    label.textContent = 'ยังไม่เคยแบ็คอัพข้อมูล';
  }

  const bannerArea = document.getElementById('backup-banner-area');
  if(lastBackupDate !== todayStr() && records.length > 0){
    bannerArea.innerHTML = `<div class="backup-banner">
      <span>ยังไม่ได้สำรองข้อมูลของวันนี้ — <strong>กดสำรองข้อมูลเพื่อเก็บไฟล์สำเนาไว้กันข้อมูลหาย</strong></span>
      <button type="button" class="btn btn-primary btn-sm" onclick="downloadBackup()">สำรองข้อมูลตอนนี้</button>
    </div>`;
  }else{
    bannerArea.innerHTML = '';
  }
}

async function buildBackupPayload(){
  const exportRecords = await Promise.all(records.map(async (r) => {
    const copy = { ...r };
    if(r.hasFront){
      try{
        const res = await window.storage.get(imageKey(r.id, 'front'), false);
        if(res && res.value) copy.deedFrontImage = res.value;
      }catch(e){}
    }
    if(r.hasBack){
      try{
        const res = await window.storage.get(imageKey(r.id, 'back'), false);
        if(res && res.value) copy.deedBackImage = res.value;
      }catch(e){}
    }
    return copy;
  }));

  return {
    exportedAt: new Date().toISOString(),
    count: records.length,
    records: exportRecords
  };
}

async function downloadBackup(){
  const payload = await buildBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = todayStr();
  a.href = url;
  a.download = `land-clients-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setLastBackupDate(stamp).then(renderBackupUi);
}

function exportToExcel(){
  if(!records.length){
    alert('ยังไม่มีรายการลูกค้าให้ส่งออก');
    return;
  }
  if(typeof XLSX === 'undefined'){
    alert('ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
    return;
  }

  const sorted = [...records].sort((a,b) => b.createdAt - a.createdAt);
  const rows = sorted.map(r => ({
    'ชื่อ': r.firstname || '',
    'นามสกุล': r.lastname || '',
    'เบอร์โทร': r.phone || '',
    'ไลน์ / เฟสบุ๊ค': r.social || '',
    'หมายเลขโฉนด': r.deed || '',
    'อำเภอ': r.district || '',
    'จังหวัด': r.province || '',
    'ราคา (บาท)': r.price ? Number(String(r.price).replace(/[, ]/g, '')) || r.price : '',
    'เนื้อที่ (ไร่-งาน-ตารางวา)': formatArea(r) || '',
    'พิกัด / สถานที่': r.coords || '',
    'ลิงก์ Google Maps': mapLinkFor(r.coords) || '',
    'มีรูปหน้าโฉนด': r.hasFront ? 'มี' : '',
    'มีรูปหลังโฉนด': r.hasBack ? 'มี' : '',
    'หมายเหตุ': r.notes || '',
    'บันทึกเมื่อ': formatDate(r.createdAt),
    'แก้ไขล่าสุด': r.updatedAt && r.updatedAt !== r.createdAt ? formatDate(r.updatedAt) : ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 20 }, { wch: 22 }, { wch: 36 }, { wch: 12 }, { wch: 12 },
    { wch: 30 }, { wch: 18 }, { wch: 18 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'ลูกค้าฝากขายที่ดิน');
  const stamp = todayStr();
  XLSX.writeFile(wb, `land-clients-${stamp}.xlsx`);
}

/* ===== Import from Excel ===== */
const FIELD_ALIASES = {
  firstname: ['ชื่อ', 'first name', 'firstname'],
  lastname: ['นามสกุล', 'last name', 'lastname'],
  phone: ['เบอร์โทร', 'โทรศัพท์', 'เบอร์โทรศัพท์', 'เบอร์', 'phone', 'tel'],
  social: ['ไลน์ / เฟสบุ๊ค', 'ไลน์/เฟสบุ๊ค', 'ไลน์', 'เฟสบุ๊ค', 'line', 'facebook', 'social'],
  deed: ['หมายเลขโฉนด', 'เลขโฉนด', 'โฉนด', 'deed'],
  district: ['อำเภอ', 'เขต', 'district'],
  province: ['จังหวัด', 'province'],
  price: ['ราคา (บาท)', 'ราคา', 'price'],
  area: ['เนื้อที่ (ไร่-งาน-ตารางวา)', 'เนื้อที่', 'area'],
  coords: ['พิกัด / สถานที่', 'พิกัด/สถานที่', 'พิกัด', 'ที่ตั้ง', 'coords', 'location'],
  notes: ['หมายเหตุ', 'note', 'notes']
};

function getField(row, aliases){
  const keys = Object.keys(row);
  for(const alias of aliases){
    const found = keys.find(k => k.trim().toLowerCase() === alias.trim().toLowerCase());
    if(found !== undefined && row[found] !== undefined) return row[found];
  }
  return '';
}

function parseAreaString(str){
  if(!str) return { rai: '', ngan: '', wah: '' };
  const s = String(str);
  const rai = (s.match(/([\d.]+)\s*ไร่/) || [])[1] || '';
  const ngan = (s.match(/([\d.]+)\s*งาน/) || [])[1] || '';
  const wah = (s.match(/([\d.]+)\s*ตารางวา/) || [])[1] || '';
  return { rai, ngan, wah };
}

function importFromExcel(file){
  if(typeof XLSX === 'undefined'){
    alert('ไม่สามารถโหลดไลบรารี Excel ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    try{
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const wsName = wb.SheetNames[0];
      const ws = wb.Sheets[wsName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if(!rows.length){
        alert('ไม่พบข้อมูลในไฟล์ Excel นี้');
        return;
      }

      let added = 0, skipped = 0;
      for(const row of rows){
        const firstname = String(getField(row, FIELD_ALIASES.firstname) || '').trim();
        const lastname = String(getField(row, FIELD_ALIASES.lastname) || '').trim();
        if(!firstname && !lastname){ skipped++; continue; }

        const priceRaw = getField(row, FIELD_ALIASES.price);
        const priceNum = Number(String(priceRaw).replace(/[, ]/g, ''));
        const price = priceRaw !== '' && !isNaN(priceNum) && priceNum > 0 ? priceNum.toLocaleString('en-US') : '';

        const area = parseAreaString(getField(row, FIELD_ALIASES.area));

        records.push({
          id: genId(),
          firstname,
          lastname,
          phone: String(getField(row, FIELD_ALIASES.phone) || '').trim(),
          social: String(getField(row, FIELD_ALIASES.social) || '').trim(),
          deed: String(getField(row, FIELD_ALIASES.deed) || '').trim(),
          district: String(getField(row, FIELD_ALIASES.district) || '').trim(),
          province: String(getField(row, FIELD_ALIASES.province) || '').trim(),
          price,
          areaRai: area.rai,
          areaNgan: area.ngan,
          areaWah: area.wah,
          coords: String(getField(row, FIELD_ALIASES.coords) || '').trim(),
          notes: String(getField(row, FIELD_ALIASES.notes) || '').trim(),
          marketing: false,
          marketingCost: '',
          hasFront: false,
          hasBack: false,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
        added++;
      }

      await saveRecords();
      render();
      alert(`นำเข้าข้อมูลจาก Excel สำเร็จ: เพิ่ม ${added} รายการ${skipped ? `, ข้าม ${skipped} แถวที่ไม่มีชื่อ` : ''}`);
    }catch(err){
      console.error('Excel import error', err);
      alert('ไม่สามารถอ่านไฟล์ Excel นี้ได้ กรุณาตรวจสอบรูปแบบไฟล์ (ควรมีคอลัมน์ ชื่อ, นามสกุล เป็นอย่างน้อย)');
    }
  };
  reader.readAsArrayBuffer(file);
}

document.getElementById('import-excel-btn').addEventListener('click', () => {
  document.getElementById('import-excel-input').click();
});
document.getElementById('import-excel-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(file) importFromExcel(file);
  e.target.value = '';
});


let driveTokenClient = null;
let driveAccessToken = null;
let driveUploadRequested = false;

function isDriveConfigured(){
  return GOOGLE_CLIENT_ID && GOOGLE_CLIENT_ID.indexOf('YOUR_CLIENT_ID_HERE') === -1;
}

function setDriveStatus(connected, message){
  const dot = document.getElementById('drive-dot');
  const text = document.getElementById('drive-status-text');
  dot.classList.toggle('on', !!connected);
  text.textContent = message;
  document.getElementById('drive-upload-btn').style.display = connected ? 'inline-block' : 'none';
  document.getElementById('drive-login-btn').textContent = connected ? 'เปลี่ยนบัญชี Google' : 'เข้าสู่ระบบ Google';
}

function initDriveAuth(){
  if(!isDriveConfigured()){
    setDriveStatus(false, 'ยังไม่ได้ตั้งค่า Google Drive (ดูคำแนะนำในไฟล์ ตัวแปร GOOGLE_CLIENT_ID)');
    return;
  }
  if(typeof google === 'undefined' || !google.accounts){
    setDriveStatus(false, 'โหลดระบบเข้าสู่ระบบของ Google ไม่สำเร็จ ลองรีเฟรชหน้านี้');
    return;
  }
  driveTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/drive.file',
    login_hint: DRIVE_OWNER_EMAIL,
    callback: (response) => {
      if(response && response.access_token){
        driveAccessToken = response.access_token;
        setDriveStatus(true, 'เชื่อมต่อ Google Drive แล้ว');
        if(driveUploadRequested){
          driveUploadRequested = false;
          uploadBackupToDrive();
        }
      }else{
        setDriveStatus(false, 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      }
    },
  });
  setDriveStatus(false, 'ยังไม่เชื่อมต่อ Google Drive');
}

function requestDriveLogin(){
  if(!isDriveConfigured()){
    alert('ยังไม่ได้ตั้งค่า Google Drive สำหรับหน้านี้\n\nเปิดไฟล์นี้ด้วยโปรแกรมแก้ไขข้อความ แล้วดูคำแนะนำการตั้งค่าที่คอมเมนต์ไว้บนสุดของส่วน <script>');
    return;
  }
  if(!driveTokenClient){
    initDriveAuth();
  }
  if(driveTokenClient){
    driveTokenClient.requestAccessToken({ prompt: driveAccessToken ? '' : 'consent' });
  }
}

async function uploadBackupToDrive(){
  if(!driveAccessToken){
    driveUploadRequested = true;
    requestDriveLogin();
    return;
  }

  const uploadBtn = document.getElementById('drive-upload-btn');
  const originalLabel = uploadBtn.textContent;
  uploadBtn.disabled = true;
  uploadBtn.textContent = 'กำลังอัปโหลด...';

  try{
    const payload = await buildBackupPayload();
    const fileContent = JSON.stringify(payload, null, 2);
    const stamp = todayStr();
    const fileName = `land-clients-backup-${stamp}.json`;
    const metadata = { name: fileName, mimeType: 'application/json' };
    const boundary = 'landclients_boundary_' + Date.now();
    const multipartBody =
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) + '\r\n' +
      `--${boundary}\r\n` +
      'Content-Type: application/json\r\n\r\n' +
      fileContent + '\r\n' +
      `--${boundary}--`;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + driveAccessToken,
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body: multipartBody
    });

    if(res.status === 401){
      driveAccessToken = null;
      setDriveStatus(false, 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
      alert('เซสชัน Google หมดอายุ กรุณากดเข้าสู่ระบบ Google อีกครั้งแล้วลองอัปโหลดใหม่');
      return;
    }
    if(!res.ok){
      const errText = await res.text();
      throw new Error(errText);
    }

    await res.json();
    await setLastBackupDate(stamp);
    renderBackupUi();
    alert(`อัปโหลดไฟล์สำรองขึ้น Google Drive สำเร็จ\nไฟล์: ${fileName}\n(ไฟล์จะอยู่ในโฟลเดอร์ของแอปนี้บน Drive ของคุณ)`);
  }catch(err){
    console.error('Drive upload error', err);
    alert('อัปโหลดไป Google Drive ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }finally{
    uploadBtn.disabled = false;
    uploadBtn.textContent = originalLabel;
  }
}

document.getElementById('drive-login-btn').addEventListener('click', requestDriveLogin);
document.getElementById('drive-upload-btn').addEventListener('click', uploadBackupToDrive);

window.addEventListener('load', () => {
  setTimeout(initDriveAuth, 300);
});

function handleImportFile(file){
  const reader = new FileReader();
  reader.onload = async (e) => {
    try{
      const parsed = JSON.parse(e.target.result);
      const incoming = Array.isArray(parsed) ? parsed : parsed.records;
      if(!Array.isArray(incoming)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');

      const existingIds = new Set(records.map(r => r.id));
      let added = 0, skipped = 0;
      for(const raw of incoming){
        if(raw && raw.id && !existingIds.has(raw.id)){
          const { deedFrontImage, deedBackImage, ...rec } = raw;
          if(deedFrontImage){
            await window.storage.set(imageKey(rec.id, 'front'), deedFrontImage, false);
            rec.hasFront = true;
          }
          if(deedBackImage){
            await window.storage.set(imageKey(rec.id, 'back'), deedBackImage, false);
            rec.hasBack = true;
          }
          records.push(rec);
          existingIds.add(rec.id);
          added++;
        }else{
          skipped++;
        }
      }
      await saveRecords();
      render();
      alert(`นำเข้าข้อมูลสำเร็จ: เพิ่มใหม่ ${added} รายการ${skipped ? `, ข้าม ${skipped} รายการ (มีอยู่แล้ว)` : ''}`);
    }catch(err){
      alert('ไม่สามารถอ่านไฟล์สำรองนี้ได้ กรุณาตรวจสอบว่าเป็นไฟล์ที่ดาวน์โหลดจากระบบนี้');
    }
  };
  reader.readAsText(file);
}

document.getElementById('backup-btn').addEventListener('click', downloadBackup);
document.getElementById('export-excel-btn').addEventListener('click', exportToExcel);
document.getElementById('import-btn').addEventListener('click', () => {
  document.getElementById('import-input').click();
});
document.getElementById('import-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(file) handleImportFile(file);
  e.target.value = '';
});

document.getElementById('cancel-btn').addEventListener('click', stopEdit);
document.getElementById('search-box').addEventListener('input', render);

document.getElementById('f-price').addEventListener('input', (e) => {
  const input = e.target;
  const cursorFromEnd = input.value.length - input.selectionStart;
  const digitsOnly = input.value.replace(/[^\d]/g, '');
  const formatted = digitsOnly ? Number(digitsOnly).toLocaleString('en-US') : '';
  input.value = formatted;
  const pos = Math.max(0, formatted.length - cursorFromEnd);
  input.setSelectionRange(pos, pos);
});

document.getElementById('record-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const firstname = document.getElementById('f-firstname').value.trim();
  const lastname = document.getElementById('f-lastname').value.trim();
  if(!firstname || !lastname){
    alert('กรุณากรอกชื่อและนามสกุล');
    return;
  }

  const data = {
    firstname,
    lastname,
    phone: document.getElementById('f-phone').value.trim(),
    social: document.getElementById('f-social').value.trim(),
    deed: document.getElementById('f-deed').value.trim(),
    district: document.getElementById('f-district').value.trim(),
    province: document.getElementById('f-province').value.trim(),
    price: document.getElementById('f-price').value.trim(),
    areaRai: document.getElementById('f-area-rai').value.trim(),
    areaNgan: document.getElementById('f-area-ngan').value.trim(),
    areaWah: document.getElementById('f-area-wah').value.trim(),
    coords: document.getElementById('f-coords').value.trim(),
    notes: document.getElementById('f-notes').value.trim(),
    marketing: document.getElementById('f-marketing').checked,
    marketingCost: document.getElementById('f-marketing-cost').value.trim(),
  };

  const id = editingId || genId();

  let hasFront = editingId ? (records.find(r => r.id === id)?.hasFront || false) : false;
  let hasBack = editingId ? (records.find(r => r.id === id)?.hasBack || false) : false;

  try{
  if(pendingFrontImage){
    await window.storage.set(imageKey(id, 'front'), pendingFrontImage, false);
    hasFront = true;
  }else if(removeFrontFlag){
    try{ await window.storage.delete(imageKey(id, 'front'), false); }catch(err){}
    hasFront = false;
  }

  if(pendingBackImage){
    await window.storage.set(imageKey(id, 'back'), pendingBackImage, false);
    hasBack = true;
  }else if(removeBackFlag){
    try{ await window.storage.delete(imageKey(id, 'back'), false); }catch(err){}
    hasBack = false;
  }

  data.hasFront = hasFront;
  data.hasBack = hasBack;

  if(editingId){
    const idx = records.findIndex(r => r.id === editingId);
    if(idx !== -1){
      records[idx] = { ...records[idx], ...data, updatedAt: Date.now() };
    }
  }else{
    records.push({
      id,
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }

  const saved = await saveRecords();
  if(!saved) throw new Error('ไม่สามารถบันทึกรายการหลักได้');
  stopEdit();
  render();
  }catch(err){
    console.error('บันทึกรายการไม่สำเร็จ', err);
    alert('บันทึกรายการไม่สำเร็จ: ' + (err && err.message ? err.message : 'กรุณาลองใหม่'));
  }
});

// ===== ระบบล็อกอิน Google =====
let currentUser = null;

function isEmailAllowed(email) {
  if (!ALLOWED_EMAILS || ALLOWED_EMAILS.length === 0) return true;
  return ALLOWED_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase());
}

function showApp() {
  document.getElementById('login-overlay').classList.add('hidden');
  document.getElementById('user-badge').classList.remove('hidden');
  // เชื่อมต่อ Google Drive อัตโนมัติหลังล็อกอิน
  setTimeout(() => {
    if(!driveAccessToken){
      if(!driveTokenClient){ initDriveAuth(); }
      if(driveTokenClient){
        driveTokenClient.requestAccessToken({ prompt: '' });
      }
    }
  }, 800);
}

function hideApp() {
  document.getElementById('login-overlay').classList.remove('hidden');
  document.getElementById('user-badge').classList.add('hidden');
}

function handleGoogleCredential(response) {
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const email = payload.email;
    const name = payload.name || email;
    const picture = payload.picture || '';

    if (!isEmailAllowed(email)) {
      document.getElementById('login-error').textContent =
        `อีเมล ${email} ไม่ได้รับอนุญาต กรุณาติดต่อผู้ดูแลระบบ`;
      return;
    }

    currentUser = { email, name, picture };
    document.getElementById('user-name').textContent = name;
    document.getElementById('user-avatar').src = picture;
    document.getElementById('login-error').textContent = '';
    showApp();
  } catch(e) {
    document.getElementById('login-error').textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่';
  }
}

function initGoogleLogin() {
  if (typeof google === 'undefined' || !google.accounts) {
    setTimeout(initGoogleLogin, 500);
    return;
  }
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleGoogleCredential,
    auto_select: false,
    cancel_on_tap_outside: false,
  });

  document.getElementById('google-signin-btn').addEventListener('click', () => {
    google.accounts.id.prompt();
  });
}

document.getElementById('logout-btn').addEventListener('click', () => {
  currentUser = null;
  if (typeof google !== 'undefined' && google.accounts) {
    google.accounts.id.disableAutoSelect();
  }
  hideApp();
});

window.addEventListener('load', () => {
  setTimeout(initGoogleLogin, 400);
});
// ===== จบระบบล็อกอิน =====


async function init(){
  await loadLastBackupDate();
  await loadAppointments();
  document.getElementById('appt-date').value = selectedCalDate;
  await loadRecords();
  renderCalendar();
}
init();


if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error);
    });
  });
}
