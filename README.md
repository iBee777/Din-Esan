# Din-Esan — ระบบบันทึกลูกค้าฝากขายที่ดิน

เว็บแอปภาษาไทยสำหรับบันทึกข้อมูลลูกค้าฝากขายที่ดิน รองรับค้นหา แก้ไข ลบ นัดหมาย แนบภาพโฉนด สำรองข้อมูล JSON ส่งออก Excel และอัปโหลดไฟล์สำรองไป Google Drive

## เปิดใช้งานบน GitHub Pages

1. สร้าง Repository ใหม่ใน GitHub เช่น `Din-Esan`
2. อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้น Repository โดยให้ `index.html` อยู่ระดับบนสุด
3. ไปที่ **Settings → Pages**
4. ที่ **Build and deployment → Source** เลือก **GitHub Actions**
5. Push ไฟล์ขึ้น branch `main` ระบบจะเผยแพร่เว็บให้อัตโนมัติ
6. ดู URL เว็บได้ที่หน้า **Actions** หรือ **Settings → Pages**

URL โดยทั่วไปจะมีรูปแบบ:

```text
https://ชื่อผู้ใช้.github.io/ชื่อ-repository/
```

## อัปโหลดด้วย Git command

```bash
git init
git add .
git commit -m "Initial Din-Esan web app"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

## ตั้งค่า Google Login และ Google Drive

ใน `index.html` มีตัวแปรต่อไปนี้:

```js
const GOOGLE_CLIENT_ID = '...apps.googleusercontent.com';
const DRIVE_OWNER_EMAIL = '...';
const ALLOWED_EMAILS = ['...'];
```

ใน Google Cloud Console ให้เพิ่ม URL GitHub Pages ใน OAuth Client ID ประเภท **Web application** ที่ช่อง **Authorized JavaScript origins** ตัวอย่าง:

```text
https://ชื่อผู้ใช้.github.io
```

จากนั้นเปิดใช้งาน **Google Drive API** ในโปรเจกต์เดียวกัน หากแก้ชื่อ Repository หรือย้ายโดเมน ต้องตรวจสอบ Origin นี้อีกครั้ง

> Google OAuth Client ID ไม่ใช่รหัสผ่าน แต่รายชื่ออีเมลที่อนุญาตและ URL Apps Script จะมองเห็นได้จาก source code ของเว็บสาธารณะ

## การจัดเก็บข้อมูล

ข้อมูลหลักและภาพถูกเก็บใน `localStorage` ของเบราว์เซอร์แต่ละเครื่อง จึงไม่ซิงก์ข้ามเครื่องโดยอัตโนมัติ ควรกดสำรองข้อมูลเป็นประจำ และนำเข้าไฟล์สำรองเมื่อต้องย้ายเครื่องหรือล้างข้อมูลเบราว์เซอร์

## ทดสอบในเครื่อง

ไม่ควรเปิดด้วย `file://` เพราะ Google Login และ Service Worker ต้องใช้เว็บเซิร์ฟเวอร์

```bash
python -m http.server 8000
```

แล้วเปิด:

```text
http://localhost:8000
```

สำหรับ Google Login บน localhost ให้เพิ่ม `http://localhost:8000` ใน Authorized JavaScript origins ด้วย

## โครงสร้างไฟล์

```text
.
├── index.html
├── logo.png
├── style.css
├── site.webmanifest
├── sw.js
├── .nojekyll
└── .github/workflows/pages.yml
```

## การแก้ปัญหาบันทึกข้อมูลบน iPhone
เวอร์ชันนี้เก็บข้อมูลข้อความใน localStorage และเก็บรูปโฉนดใน IndexedDB เพื่อลดปัญหาพื้นที่ localStorage เต็มบน Safari/iPhone โดยรูปเดิมที่เคยอยู่ใน localStorage จะถูกย้ายเมื่อเปิดดูหรือแก้ไขรายการนั้น


## เวอร์ชัน v4
แก้ข้อผิดพลาด `Can't find variable: STORAGE_KEY` ที่ทำให้บันทึกรายการไม่ได้บน Safari/iPhone และปรับ cache เป็น v4 เพื่อบังคับโหลดไฟล์ใหม่

## การบันทึกลง Google Drive (v5)
1. เปิด Google Drive API ใน Google Cloud Console
2. OAuth Client ต้องมี Authorized JavaScript origin ของ GitHub Pages เช่น `https://ibee777.github.io`
3. หลังเข้าเว็บ กด **เชื่อมต่อ Google Drive** และอนุญาตสิทธิ์
4. ระบบจะสร้าง/อัปเดตไฟล์ `Din-Esan-data.json` และบันทึกอัตโนมัติหลังเพิ่มหรือแก้ไขรายการ
5. อุปกรณ์ใหม่ให้กด **โหลดข้อมูลจาก Drive**

## Google Calendar

เวอร์ชันนี้สามารถลงนัดหมายจากส่วน “ปฏิทินนัดหมายดูพื้นที่” ไปยัง Google Calendar หลักของบัญชีที่เชื่อมต่อได้

1. เปิด Google Cloud Console → APIs & Services → Library
2. เปิดใช้งาน **Google Calendar API** เพิ่มจาก Google Drive API
3. ที่ OAuth consent screen เพิ่มสิทธิ์ `.../auth/calendar.events` หากระบบร้องขอ
4. เข้าเว็บแล้วกด **เชื่อมต่อ Google** และยอมรับสิทธิ์ Drive/Calendar
5. ตอนเพิ่มนัดหมาย ให้เลือกช่อง **ลง Google Calendar**

นัดหมายที่ระบุเวลาจะสร้างกิจกรรมยาว 1 ชั่วโมง ส่วนรายการที่ไม่ระบุเวลาจะสร้างเป็นกิจกรรมตลอดวัน ระบบบันทึก Calendar Event ID ไว้เพื่อให้การลบนัดหมายในเว็บสามารถลบรายการใน Google Calendar ได้เมื่อยังเชื่อมต่อบัญชีอยู่


## v9 LINE notification fix
- ส่งข้อมูลไป LINE_PROXY_URL อัตโนมัติเมื่อเพิ่มลูกค้าใหม่
- ใช้ POST แบบ text/plain เพื่อลดปัญหา CORS กับ Google Apps Script
- เปลี่ยน cache version เพื่อให้ GitHub Pages โหลดโค้ดใหม่

## v10 ใช้งานหลายเครื่องและเห็นรายการเดียวกัน

เวอร์ชันนี้เพิ่มฐานข้อมูลกลางด้วย Google Sheet + Google Apps Script:

1. สร้าง Google Sheet ใหม่ แล้วคัดลอก Spreadsheet ID จาก URL
2. เปิด **Extensions → Apps Script** และวางไฟล์ `Code.gs`
3. ที่ **Project Settings → Script Properties** เพิ่มค่า:
   - `SPREADSHEET_ID`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_TO`
4. กด **Deploy → Manage deployments → Edit → New version**
5. ตั้ง **Execute as: Me** และ **Who has access: Anyone** แล้ว Deploy
6. นำ Web app URL ไปใส่ใน `LINE_PROXY_URL` ภายใน `index.html`
7. อัปโหลดไฟล์เว็บทั้งหมดขึ้น GitHub Pages ใหม่

เมื่อเพิ่ม แก้ไข หรือลบลูกค้าจากเครื่องใด ข้อมูลจะบันทึกใน Google Sheet กลาง และเครื่องอื่นจะอัปเดตรายการเมื่อเปิดหน้าเว็บหรือภายในประมาณ 15 วินาที รูปโฉนดยังคงอยู่เฉพาะเครื่องที่อัปโหลด ส่วนข้อมูลข้อความและรายการลูกค้าจะซิงก์ข้ามเครื่อง
