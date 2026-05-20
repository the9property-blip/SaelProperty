# 🏠 The 9 Property — บ้านขาย เชียงใหม่

แคทตาล็อกบ้านขาย/คอนโด/พูลวิลล่า ในจังหวัดเชียงใหม่ ดึงข้อมูลสดจาก Google Sheets ผ่าน Apps Script Web App

**ดูเว็บ:** `https://<your-username>.github.io/<repo-name>/`

## โครงสร้างไฟล์

```
github-pages/
├── index.html          ← หน้าเว็บหลัก (ไฟล์เดียว รวม CSS + JS)
├── .nojekyll           ← บอก GitHub ไม่ต้องใช้ Jekyll
└── README.md           ← ไฟล์นี้
```

## ตั้งค่าก่อน deploy

เปิด `index.html` หา section `CONFIG` (ราวบรรทัด 660) แล้วแก้ 3 ค่านี้:

```js
const LINE_ID    = '@the9property';                                  // Line ID จริง
const WA_PHONE   = '66809945497';                                    // WhatsApp (66 + เบอร์ตัด 0)
const SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';    // Apps Script Web App URL
```

ถ้า `SCRIPT_URL` ว่าง → เว็บจะใช้ mock-data เพื่อ preview UI

## Deploy บน GitHub Pages

1. สร้าง repo ใหม่บน GitHub (เช่น `the9-sale`)
2. Upload ไฟล์ทั้งหมดในโฟลเดอร์นี้ (index.html, .nojekyll, README.md) ไปไว้ที่ root ของ repo
3. ไปที่ repo → Settings → Pages → Source: `Deploy from a branch` → Branch: `main` / folder: `/ (root)` → Save
4. รอ 1-2 นาที จะได้ URL: `https://<username>.github.io/the9-sale/`

## Backend (Apps Script)

โปรเจกต์ Apps Script เดียวกับเว็บเช่า — ต้องเพิ่มไฟล์ `SaleCatalogScript.gs` (อยู่ในโฟลเดอร์ WebForSael) และ patch `doGet()` ใน `PropertyAllScript.gs` ดูคำสั่งในไฟล์ `SaleCatalogScript.gs` ท้ายไฟล์
