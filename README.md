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
