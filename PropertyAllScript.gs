// ============================================================
//  PropertyAllScript.gs  —  REWRITE v2 (clean)
//  ลงทะเบียนทรัพย์อัตโนมัติ — รวมงานเช่า + งานขาย + Catalog API
// ============================================================


// ════════════════════════════════════════════════════════════
//  CONFIG
// ════════════════════════════════════════════════════════════
const SS_ID      = '1ki4ApHJKp-zQZ998n3t5mAIXYHLKxUL2tsp9Z2gAdcQ';
const AGENT_TEL  = '0809945497';
const TZ         = 'Asia/Bangkok';

// งานเช่า
const SHEET_LIST   = 'รายชื่อบ้านเช่า';
const SHEET_CODE   = 'รหัสเช่า';
const FOLDER_BAAN  = '1YyFWrlD82xXCYMQ9dcnDKwfMgrj9oGJ4';
const FOLDER_CONDO = '1J8at0Qv1LYYIovHIQYsOPAu1g2nc0dEQ';

// งานขาย
const SHEET_SALE_LIST   = 'รายชื่อบ้านขาย';
const SHEET_SALE_CODE   = 'รหัสขาย';
const FOLDER_SALE_BAAN  = '1OwnXfQNZpUGOWrH2oTJIuafITse5Dsxu';
const FOLDER_SALE_CONDO = '1OwnXfQNZpUGOWrH2oTJIuafITse5Dsxu';

// ════════════════════════════════════════════════════════════
//  ฐานข้อมูลลูกค้าหาเช่า (CRM) — ลูกค้าที่ติดต่อเข้ามาแต่ยังไม่ได้บ้าน
//  ใช้กับหน้าเว็บ "ฐานข้อมูลลูกค้า" (staff เท่านั้น) — แท็บใหม่ในชีตเดียวกัน
// ════════════════════════════════════════════════════════════
const SHEET_CUSTOMER = 'ลูกค้าหาเช่า';
const CUSTOMER_HEADERS = [
  'รหัสลูกค้า', 'วันที่รับลูกค้า', 'ชื่อผู้หาเช่า', 'ช่องทางติดต่อ', 'สัญชาติ',
  'งบประมาณ (บาท/เดือน)', 'ประเภททรัพย์ที่ต้องการ', 'ทำเล / ใกล้', 'ห้องนอนที่ต้องการ',
  'ห้องน้ำที่ต้องการ', 'สัตว์เลี้ยง', 'จำนวนผู้อาศัย', 'วันที่อยากเข้าอยู่',
  'ติดตามครั้งที่ 1', 'ติดตามครั้งที่ 2', 'ติดตามครั้งที่ 3',
  'สถานะ', 'ผู้ประกาศ', 'หมายเหตุ', 'ผู้ลงทะเบียน', 'ผู้หาเอง',
  'จำนวนน้องหมา', 'จำนวนน้องแมว', 'จำนวนสัตว์อื่นๆ', 'ระบุสัตว์อื่นๆ'
];
// ลำดับสถานะ — 2 ตัวท้าย = "ปิดเคส" (ถือว่าสำเร็จ/ยกเลิก ไม่นับว่ายังหาบ้านอยู่)
const CUSTOMER_STATUSES = ['กำลังหา', 'นัดชมทรัพย์', 'รอตัดสินใจ', 'ได้บ้านแล้ว', 'ยกเลิก'];
// map ชื่อฟิลด์ (จาก query string) → เลขคอลัมน์ในชีต (1-based) สำหรับการแก้ไขทีละช่อง
const CUST_FIELD_COL = {
  dateIn: 2, name: 3, contact: 4, nationality: 5, budget: 6, propType: 7, area: 8,
  bedroom: 9, bathroom: 10, pet: 11, occupants: 12, moveIn: 13,
  follow1: 14, follow2: 15, follow3: 16, status: 17, staff: 18, note: 19,
  petDog: 22, petCat: 23, petOther: 24, petOtherNote: 25
};
const CUST_COL_REGISTRANT = 20;   // คอลัมน์ T = ผู้ลงทะเบียน (ตั้งอัตโนมัติตอนเพิ่ม, ไม่ให้แก้ผ่านฟอร์ม)
const CUST_COL_SELFSEEK   = 21;   // คอลัมน์ U = "ผู้เช่าหาเอง" (ลูกค้าเป็นคนเดียวกับผู้ประกาศ)

// ════════════════════════════════════════════════════════════
//  ระบบสมาชิก (membership) — แท็บ "สมาชิก" + 3 ระดับสิทธิ์ (ใช้กับหน้าลูกค้า CRM)
//    ผู้ออกแบบ > แอดมิน > สมาชิก
// ════════════════════════════════════════════════════════════
const SHEET_MEMBER  = 'สมาชิก';
const MEMBER_HEADERS = ['ชื่อผู้ใช้', 'รหัสผ่าน', 'ระดับ', 'ชื่อแสดง', 'เบอร์โทร', 'สถานะ', 'วันที่สมัคร', 'Facebook', 'LINE', 'WhatsApp', 'ช่องทางอื่นๆ'];
const ROLE_DESIGNER = 'ผู้ออกแบบ';   // แก้ไขได้ทุกอย่าง + จัดการสมาชิก (rank 3)
const ROLE_ADMIN    = 'แอดมิน';      // แก้/ลบทุกการ์ด + เห็นเบอร์ทุกใบ (rank 2)
const ROLE_MEMBER   = 'สมาชิก';      // ค้นหา/ลงข้อมูล + แก้เฉพาะการ์ดของตัวเอง (rank 1)
const MEMBER_ROLES  = [ROLE_DESIGNER, ROLE_ADMIN, ROLE_MEMBER];

// Regex จับรหัสจากชื่อ folder เช่น "RSK0136 - บ้านสวย" → "RSK0136"
const CODE_REGEX = /^(R[A-Z]{2}\d+)/;
// ★ ดึงรหัสจากชื่อโฟลเดอร์รูป — ยอมรับทั้งฟอร์แมตปกติ R.. และทรัพย์โค CO.. (เช่น CORENT00028)
const FOLDER_CODE_REGEX = /^((?:R[A-Z]{2}|CO[A-Z]*)\d+)/;

// รหัสผ่านพนักงาน — ใส่ใน URL เป็น ?token=xxx
const STAFF_PASSWORD = '456258';

// Cache key — v5 เพราะเปลี่ยน shape เป็น {thumb, folderId}
const PHOTO_CACHE_KEY = 'catalog_photoMap_v5';
const PHOTO_CACHE_TTL = 21600;  // 6 ชั่วโมง


// ════════════════════════════════════════════════════════════
//  UTILS
// ════════════════════════════════════════════════════════════

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _normLocation(s) {
  return String(s == null ? '' : s)
    .replace(/^(ตำบล|อำเภอ|แขวง|เขต|ต\.|อ\.)\s*/u, '')
    .trim();
}

function _todayStr() {
  return Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy');
}

function _tr(t) {
  if (!t || !String(t).trim()) return '';
  try { return LanguageApp.translate(String(t).trim(), 'th', 'en'); }
  catch (e) { return t; }
}

function _toLines(t) {
  if (!t) return '';
  return String(t).split('\n')
    .map(function(l) { return l.trim(); })
    .filter(function(l) { return l; })
    .join('\n');
}

function _toHL(t) {
  if (!t) return '';
  return String(t).split('\n')
    .map(function(l) { return l.trim(); })
    .filter(function(l) { return l; })
    .map(function(l) { return '🚩 ' + l.replace(/^🚩\s*/, ''); })
    .join('\n');
}


// ════════════════════════════════════════════════════════════
//  MENU
// ════════════════════════════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🏠 ลงทะเบียนทรัพย์')
    .addItem('➕ เพิ่มทรัพย์ให้เช่า', 'showForm')
    .addItem('🏷️ เพิ่มทรัพย์ขาย',    'showSaleForm')
    .addItem('➕ เพิ่มทรัพย์ขายใหม่', 'showFormSale')
    .addSeparator()
    .addItem('👥 ตั้งค่าแท็บฐานข้อมูลลูกค้า', 'setupCustomerSheet')
    .addItem('👤 ตั้งค่าแท็บสมาชิก', 'setupMemberSheet')
    .addItem('📑 ตั้งค่าแท็บสัญญา', 'setupContractSheet')
    .addItem('🖼️ แชร์รูปบ้านปล่อยเช่าเป็นสาธารณะ', 'makeRentedPhotosPublic')
    .addSeparator()
    .addItem('📲 เปิดแจ้งเตือน Telegram รายวัน (08:00)', 'setupDailyReminderTrigger')
    .addItem('📲 ทดสอบส่ง Telegram ตอนนี้', 'testTelegramNow')
    .addItem('🆔 ดู Telegram chat id', 'tgGetChatId')
    .addToUi();
  try { if (typeof addGeoMenu === 'function') addGeoMenu(); } catch (e) {}
}


// ════════════════════════════════════════════════════════════
//  UPLOAD QUEUE
// ════════════════════════════════════════════════════════════
function addToUploadQueue(propertyCode, facebookUrl) {
  if (!facebookUrl || !String(facebookUrl).trim()) return;
  const ss = SpreadsheetApp.openById(SS_ID);
  let q = ss.getSheetByName('Upload Queue');
  if (!q) {
    q = ss.insertSheet('Upload Queue');
    q.getRange('A1:E1')
      .setValues([['วันที่', 'รหัสทรัพย์', 'Facebook URL', 'สถานะ', 'ผล']])
      .setFontWeight('bold')
      .setBackground('#e8f0fe');
    [160, 110, 400, 100, 160].forEach(function(w, i) {
      q.setColumnWidth(i + 1, w);
    });
  }
  q.appendRow([
    new Date(),
    String(propertyCode).toUpperCase(),
    String(facebookUrl).trim(),
    'pending',
    ''
  ]);
}

// ★ อ่านลิงก์ FB ล่าสุดของแต่ละรหัส จากชีต 'Upload Queue' → { CODE(ตัวพิมพ์ใหญ่): fbUrl }
//   ใช้ได้ทั้งฝั่งเช่าและขาย (อยู่ใน Apps Script project เดียวกัน, SS_ID เดียวกัน)
//   ค่าที่ได้อาจเป็น URL จริง หรือคำว่า "Survey" (ทรัพย์ที่ยังไม่ได้โพส)
function getUploadFbMap_(ss) {
  var map = {};
  try {
    var q = ss.getSheetByName('Upload Queue');
    if (!q || q.getLastRow() < 2) return map;
    // คอลัมน์ B = รหัสทรัพย์, C = Facebook URL
    var vals = q.getRange(2, 2, q.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < vals.length; i++) {
      var code = String(vals[i][0] || '').trim().toUpperCase();
      var fb   = String(vals[i][1] || '').trim();
      if (code && fb) map[code] = fb;   // แถวหลังสุดของรหัสเดิม = ค่าล่าสุด
    }
  } catch (e) { Logger.log('getUploadFbMap_ error: ' + e); }
  return map;
}


// ════════════════════════════════════════════════════════════
//  LOCATION LOOKUP
// ════════════════════════════════════════════════════════════
function findLocationCode_(ss, sheetName, amphoe, tambon) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('ไม่พบ Sheet: ' + sheetName);
  const data = sheet.getDataRange().getValues();
  let lastAmphoe = '', lastDCode = '';
  for (let i = 1; i < data.length; i++) {
    const ca = String(data[i][2]).trim();
    const cd = String(data[i][3]).trim();
    if (ca !== '') { lastAmphoe = ca; lastDCode = cd; }
    if (_normLocation(lastAmphoe) === _normLocation(amphoe) &&
        _normLocation(data[i][4]) === _normLocation(tambon)) {
      return { row: i + 1, amphoe: lastAmphoe, dCode: lastDCode,
               tCode: String(data[i][5]).trim(), count: data[i][6] };
    }
  }
  return null;
}

function findRentCode(ss, amphoe, tambon) {
  return findLocationCode_(ss, SHEET_CODE, amphoe, tambon);
}
function findSaleCode(ss, amphoe, tambon) {
  return findLocationCode_(ss, SHEET_SALE_CODE, amphoe, tambon);
}


// ════════════════════════════════════════════════════════════
//  CO-AGENT CODE COUNTER  —  รหัสทรัพย์โค (แยกจากรหัสปกติ)
// ════════════════════════════════════════════════════════════
// ตัวนับรหัส Co-Agent แบบรวม (ไม่อิงอำเภอ/ตำบล) → CORENT00001, CORENT00002...
function nextCoCode(prefix) {
  const props = PropertiesService.getScriptProperties();
  const key   = 'co_counter_' + prefix;
  const next  = (parseInt(props.getProperty(key), 10) || 0) + 1;
  props.setProperty(key, String(next));
  return prefix + String(next).padStart(5, '0');
}

// รันครั้งเดียวก่อนใช้งานจริง — สแกนเลข CORENT สูงสุดที่มีในชีต
// แล้วตั้งตัวนับให้ต่อจากนั้น (กันรหัสใหม่ชนของเก่า)
function syncCoCounter() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SHEET_LIST);
  const last  = sheet.getLastRow();
  if (last < 2) { Logger.log('ชีตว่าง'); return 0; }
  const codes = sheet.getRange(2, 2, last - 1, 1).getValues();
  let max = 0;
  codes.forEach(function(r) {
    const m = String(r[0] || '').trim().match(/^CORENT(\d+)$/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
  });
  PropertiesService.getScriptProperties().setProperty('co_counter_CORENT', String(max));
  Logger.log('✅ ตั้ง co_counter_CORENT = ' + max +
             ' (รหัสถัดไป = CORENT' + String(max + 1).padStart(5, '0') + ')');
  return max;
}


// ════════════════════════════════════════════════════════════
//  งานเช่า — ฟอร์ม + บันทึกข้อมูล
// ════════════════════════════════════════════════════════════
function showForm() {
  const html = HtmlService.createHtmlOutput(FORM_HTML)
    .setWidth(560).setHeight(900).setTitle('เพิ่มทรัพย์ให้เช่า');
  SpreadsheetApp.getUi().showModalDialog(html, 'เพิ่มทรัพย์ให้เช่า');
}

function buildStatus(d) {
  if (d.status === 'ประกาศล่วงหน้า' && d.availableDate) {
    const p = String(d.availableDate).split('-');
    if (p.length === 3) return p[2] + '/' + p[1];
  }
  return d.status;
}

// รับเฉพาะค่าที่เลือกจริง ไม่ตีความช่องว่างว่า "ไม่มี"
function _roomFeatureValues_(d) {
  return [['downstairsBedroom', 'ห้องนอนชั้นล่าง'], ['maidRoom', 'ห้องแม่บ้าน']]
    .map(function(field) {
      const value = d[field[0]] == null ? '' : String(d[field[0]]).trim();
      if (value && value !== 'มี' && value !== 'ไม่มี') {
        throw new Error('กรุณาเลือก' + field[1] + ' เป็น มี หรือ ไม่มี');
      }
      return { name: field[1], value: value };
    }).filter(function(field) { return field.value !== ''; });
}

// ค้นตามหัวคอลัมน์ ถ้ายังไม่มีให้ต่อท้าย ไม่แทรกหรือเลื่อนคอลัมน์เดิม
function _prepareRoomFeatureWrites_(sheet, fields) {
  if (!fields.length) return [];
  const lastCol = sheet.getLastColumn();
  const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  const normalized = headers.map(function(value) { return String(value || '').replace(/\s/g, ''); });
  let nextCol = Math.max(lastCol, 21); // สงวน A-U รวมวันที่โพสต์และเกรดทรัพย์เดิม
  const writes = fields.map(function(field) {
    const indexes = [];
    normalized.forEach(function(header, index) { if (header === field.name) indexes.push(index); });
    if (indexes.length > 1) throw new Error('พบหัวคอลัมน์ซ้ำ: ' + field.name);
    const existingCol = indexes.length ? indexes[0] + 1 : 0;
    if (existingCol && existingCol <= 21) {
      throw new Error('คอลัมน์ ' + field.name + ' ทับตำแหน่งข้อมูลเดิม กรุณาย้ายไว้หลังคอลัมน์ U');
    }
    return { column: existingCol || ++nextCol, name: field.name, value: field.value, addHeader: !existingCol };
  });
  const maxColumns = sheet.getMaxColumns();
  if (nextCol > maxColumns) sheet.insertColumnsAfter(maxColumns, nextCol - maxColumns);
  writes.forEach(function(field) {
    if (field.addHeader) sheet.getRange(1, field.column).setValue(field.name);
  });
  return writes;
}

// แยกสัญญา 3/6 เดือน พร้อมคงการอ่านข้อมูลเดิมที่มีราคาเดียว
function _shortTermPlans_(d) {
  if (d.shortTerm !== 'ได้') return [];
  const prices = [
    ['3 เดือน', String(d.shortTermPrice3 || '').trim()],
    ['6 เดือน', String(d.shortTermPrice6 || '').trim()]
  ];
  prices.forEach(function(plan) {
    if (plan[1] && !/^[1-9][0-9]*$/.test(plan[1])) {
      throw new Error('ราคาเช่าระยะสั้น ' + plan[0] + ' ต้องเป็นจำนวนบาทมากกว่า 0');
    }
  });
  const selected = prices.filter(function(plan) { return plan[1]; });
  if (selected.length) return selected;
  const oldPrice = String(d.shortTermPrice || '').trim();
  const oldMonths = String(d.shortTermMonths || '');
  if (!oldPrice) return [];
  const oldPlans = [];
  if (oldMonths.indexOf('3') !== -1) oldPlans.push(['3 เดือน', oldPrice]);
  if (oldMonths.indexOf('6') !== -1) oldPlans.push(['6 เดือน', oldPrice]);
  return oldPlans.length ? oldPlans : [['', oldPrice]];
}

function _shortTermCell_(d) {
  _shortTermPlans_(d); // ตรวจราคาที่ส่งมา แต่ไม่บันทึกราคา/รายละเอียดลง Excel
  return d.shortTerm || '';
}

function registerProperty(d) {
  Logger.log('registerProperty: ' + JSON.stringify(d));
  try {
    const roomFeatures = _roomFeatureValues_(d);
    const shortTermInfo = _shortTermCell_(d);
    const ss   = SpreadsheetApp.openById(SS_ID);
    const listSheet = ss.getSheetByName(SHEET_LIST);
    if (!listSheet) throw new Error('ไม่พบชีต: ' + SHEET_LIST);
    // ตรวจค่าและเตรียมคอลัมน์ก่อนออกรหัส/สร้างโฟลเดอร์
    const roomFeatureWrites = _prepareRoomFeatureWrites_(listSheet, roomFeatures);
    const isCo = (d.agentType === 'Co-Agent');
    // ใช้มาตรฐานเดียวใน Excel: รับ / ไม่รับ (รองรับข้อมูลเก่าที่ส่งคำว่า "ได้")
    d.pet = (d.pet === 'รับ' || d.pet === 'ได้') ? 'รับ' : 'ไม่รับ';
    if (d.pet !== 'รับ') {
      d.petExtraDeposit = '';
      d.petExtraDepositMonths = '';
    }

    let newCode, locationCell, info = null;

    if (isCo) {
      // Co-Agent → รหัสรวม CORENT (ตัวนับกลาง ไม่อิงอำเภอ/ตำบล)
      newCode      = nextCoCode('CORENT');
      locationCell = [d.amphoe, d.tambon].filter(Boolean).join(' > ');
    } else {
      // ติดทรัพย์รับโค → R + รหัสอำเภอ/ตำบล (โหมดเดิม)
      info = findRentCode(ss, d.amphoe, d.tambon);
      if (!info) return { ok: false, msg: 'ไม่พบอำเภอ/ตำบล: ' + d.amphoe + ' / ' + d.tambon };
      const newCount    = (parseInt(info.count) || 0) + 1;
      const paddedCount = String(newCount).padStart(2, '0');
      newCode      = 'R' + info.dCode + info.tCode + paddedCount;
      locationCell = info.amphoe + ' > ' + d.tambon;
      const codeSheet = ss.getSheetByName(SHEET_CODE);
      codeSheet.getRange(info.row, 7).setValue(newCount);
      codeSheet.getRange(info.row, 8).setValue(newCode);
    }

    const isCondo    = (d.type === 'คอนโด');
    const rootFolder = DriveApp.getFolderById(isCondo ? FOLDER_CONDO : FOLDER_BAAN);
    const subFolder  = rootFolder.createFolder(newCode);
    const txtBlob    = Utilities.newBlob(
      makeRentTxt(newCode, d, info ? info.amphoe : d.amphoe),
      'text/plain; charset=utf-8',
      newCode + '.txt'
    );
    subFolder.createFile(txtBlob);

    const lastRow   = listSheet.getLastRow() + 1;
    // คอลัมน์ N เก็บเพียงสถานะ ได้/ไม่ได้; ราคา 3/6 เดือนใช้ในโพสต์เท่านั้น
    const row = [
      isCo ? 'Co' : '',
      newCode,
      locationCell,
      d.project,
      buildStatus(d),
      d.price,
      d.type,
      d.bedroom,
      d.bathroom,
      d.pet,
      d.ownerName,
      d.contact   || '',
      d.ownerTel,
      shortTermInfo,
      d.floor     || '',
      d.land      || '',
      d.usable    || '',
      _todayStr()
    ];
    listSheet.getRange(lastRow, 1, 1, row.length).setValues([row]);
    roomFeatureWrites.forEach(function(field) {
      listSheet.getRange(lastRow, field.column).setValue(field.value);
    });
    // ★ บันทึก mapsUrl + พิกัด lat/lng ที่โปรแกรมส่งมา ลงคอลัมน์ในชีต
    try { _writeRowGeo_(listSheet, lastRow, d.mapsUrl, d.lat, d.lng); } catch (e) {}
    addToUploadQueue(newCode, d.facebook);
    try { clearPhotoCache(); } catch (e) {}
    return { ok: true, code: newCode };

  } catch (err) {
    Logger.log('registerProperty error: ' + err);
    return { ok: false, msg: String(err) };
  }
}

function makeRentTxt(code, d, amphoe) {
  const divTh  = '\n──────────────────────────────────────────\n';
  const divOwn = '\n--------------------------------------------------------------------\n';
  const price  = Number(d.price).toLocaleString('th-TH');
  const STATUS_TH = { 'พร้อมเช่า':'พร้อมเช่า','ประกาศล่วงหน้า':'ให้เช่า','ให้เช่า':'ให้เช่า','ขาย':'ขาย' };
  const STATUS_EN = { 'พร้อมเช่า':'Available for Rent','ประกาศล่วงหน้า':'For Rent','ให้เช่า':'For Rent','ขาย':'For Sale' };
  const statusTh = STATUS_TH[d.status] || 'ให้เช่า / ขาย';
  const statusEn = STATUS_EN[d.status] || 'For Rent / Sale';
  let availTh = '', availEn = '';
  if (d.status === 'ประกาศล่วงหน้า' && d.availableDate) {
    const p = String(d.availableDate).split('-');
    if (p.length === 3) {
      availTh = '📅 พร้อมเช่า ' + p[2] + '/' + p[1] + '/' + (parseInt(p[0]) + 543);
      availEn = '📅 Available from ' + p[2] + '/' + p[1] + '/' + p[0];
    }
  }
  let th = '';
  if (d.agentType === 'ติดทรัพย์รับโค') th += '#ติดทรัพย์รับโค\n';
  th += '• ' + statusTh + ': ' + d.project + ' (' + d.tambon + ')\n';
  if (availTh) th += availTh + '\n';
  th += '💵 ค่าเช่า ' + price + ' บาท / เดือน';
  if (d.contract) th += ' (สัญญา ' + d.contract + ')';
  th += '\n';
  if (d.deposit) th += '💸 ' + d.deposit + '\n';
  if (d.shortTerm === 'ได้') {
    th += '🗓️ เช่าระยะสั้นได้';
    _shortTermPlans_(d).forEach(function(plan) {
      th += ' | ' + (plan[0] ? plan[0] + ' ' : '') + 'ราคา ' + plan[1] + ' บาท/เดือน';
    });
    if (d.shortTermDetails) th += ' (' + d.shortTermDetails + ')';
    th += '\n';
  }
  th += '🏠 รายละเอียดบ้าน\n';
  th += '🛏️ ' + d.bedroom + ' ห้องนอน\n🚿 ' + d.bathroom + ' ห้องน้ำ\n';
  if (d.land) th += '📐 พื้นที่ ' + d.land + '\n';
  if (d.roomDetails) th += _toLines(d.roomDetails) + '\n';
  th += (d.pet === 'รับ') ? '✅ รับสัตว์เลี้ยง\n' : '🚫 ไม่รับสัตว์เลี้ยง\n';
  if (d.pet === 'รับ' && d.petExtraDeposit === 'เพิ่ม' && d.petExtraDepositMonths) {
    th += '💸 สัตว์เลี้ยง: เพิ่มเงินประกัน ' + d.petExtraDepositMonths + ' เดือน\n';
  }
  if (d.furnitureList) th += '✨ เฟอร์นิเจอร์ & เครื่องใช้ไฟฟ้า\n' + _toLines(d.furnitureList) + '\n';
  if (d.securityInfo)  th += '🛡️ ความปลอดภัย & ส่วนกลาง\n' + _toLines(d.securityInfo) + '\n';
  if (d.locationHighlights) th += '📍 ทำเลทอง' + d.tambon + '\n' + _toHL(d.locationHighlights) + '\n';
  th += '\nสนใจติดต่อ/Contact\n☎ Tel. ' + AGENT_TEL + '\nรหัสทรัพย์ ' + code + '\nรับ ขาย-เช่า ขายฝาก จำนอง\n';
  let en = '';
  en += '• ' + statusEn + ': ' + d.project + ' (' + _tr(d.tambon) + ')\n';
  if (availEn) en += availEn + '\n';
  en += '💵 Rent: ' + price + ' THB/month';
  if (d.contract) en += ' (' + _tr(d.contract) + ' contract)';
  en += '\n';
  if (d.deposit) en += '💸 ' + _tr(d.deposit) + '\n';
  if (d.shortTerm === 'ได้') {
    en += '🗓️ Short-term rental available';
    _shortTermPlans_(d).forEach(function(plan) {
      en += ' | ' + (plan[0] === '3 เดือน' ? '3 months ' : plan[0] === '6 เดือน' ? '6 months ' : '') + plan[1] + ' THB/month';
    });
    if (d.shortTermDetails) en += ' (' + _tr(d.shortTermDetails) + ')';
    en += '\n';
  }
  en += '🏠 House Details\n🛏️ ' + d.bedroom + ' Bedrooms\n🚿 ' + d.bathroom + ' Bathrooms\n';
  if (d.land) en += '📐 Area: ' + d.land + '\n';
  const roomEn = _tr(d.roomDetails);
  if (roomEn) en += _toLines(roomEn) + '\n';
  en += (d.pet === 'รับ') ? '✅ Pets Allowed\n' : '🚫 No Pets\n';
  if (d.pet === 'รับ' && d.petExtraDeposit === 'เพิ่ม' && d.petExtraDepositMonths) {
    en += '💸 Pets: Additional ' + d.petExtraDepositMonths + '-month deposit\n';
  }
  const furniEn = _tr(d.furnitureList);
  if (furniEn) en += '✨ Furniture & Appliances Included\n' + _toLines(furniEn) + '\n';
  const secEn = _tr(d.securityInfo);
  if (secEn) en += '🛡️ Security & Common Areas\n' + _toLines(secEn) + '\n';
  const locEn = _tr(d.locationHighlights);
  if (locEn) en += '📍 Prime Location in ' + _tr(d.tambon) + '\n' + _toHL(locEn) + '\n';
  en += '\nContact\n☎ Tel. ' + AGENT_TEL + '\n';
  let owner = '';
  if (d.ownerPost) owner += d.ownerPost + '\n\n';
  owner += 'ชื่อเจ้าของ : ' + d.ownerName + '\n';
  if (d.ownerTel && d.ownerTel !== '-') owner += 'เบอร์โทร : ' + d.ownerTel + '\n';
  if (d.contact)  owner += 'ช่องทางติดต่อ : ' + d.contact + '\n';
  if (d.facebook) owner += 'Facebook : ' + d.facebook + '\n';
  if (d.mapsUrl)  owner += 'Map : ' + d.mapsUrl + '\n';
  return '﻿' + th + divTh + en + divOwn + owner;
}


// ════════════════════════════════════════════════════════════
//  งานขาย — ฟอร์ม + บันทึกข้อมูล
// ════════════════════════════════════════════════════════════
function showSaleForm() {
  const html = HtmlService.createHtmlOutput(SALE_FORM_HTML)
    .setWidth(580).setHeight(980).setTitle('เพิ่มทรัพย์ขาย');
  SpreadsheetApp.getUi().showModalDialog(html, 'เพิ่มทรัพย์ขาย');
}

function registerSaleProperty(d) {
  try {
    const saleFeatures = saleExtraFields_(d);
    const ss   = SpreadsheetApp.openById(SS_ID);
    const info = findSaleCode(ss, d.amphoe, d.tambon);
    if (!info) return { ok: false, msg: 'ไม่พบอำเภอ/ตำบล: ' + d.amphoe + ' / ' + d.tambon };

    const newCount = (parseInt(info.count) || 0) + 1;
    const newCode  = 'S' + info.dCode + info.tCode + newCount;

    const isCondo    = (d.type === 'คอนโด');
    const rootFolder = DriveApp.getFolderById(isCondo ? FOLDER_SALE_CONDO : FOLDER_SALE_BAAN);
    const subFolder  = rootFolder.createFolder(newCode);
    const txtBlob    = Utilities.newBlob(
      makeSaleTxt(newCode, d, info.amphoe),
      'text/plain; charset=utf-8',
      newCode + '.txt'
    );
    subFolder.createFile(txtBlob);

    const codeSheet = ss.getSheetByName(SHEET_SALE_CODE);
    codeSheet.getRange(info.row, 7).setValue(newCount);
    codeSheet.getRange(info.row, 8).setValue(newCode);

    const listSheet = ss.getSheetByName(SHEET_SALE_LIST);
    const colB      = listSheet.getRange('B:B').getValues();
    let lastDataRow = 1;
    for (let i = colB.length - 1; i >= 1; i--) {
      if (colB[i][0] !== '') { lastDataRow = i + 1; break; }
    }
    const lastRow = lastDataRow + 1;
    const row = [
      (d.agentType === 'Co-Agent') ? 'Co' : '',
      newCode,
      info.amphoe + ' > ' + d.tambon,
      d.project,
      d.price,
      d.type,
      d.houseInfo   || '',
      d.land        || '',
      d.usable      || '',
      d.floor       || '',
      d.building    || '',
      d.bedroom,
      d.bathroom,
      d.parking     || '',
      d.direction   || '',
      d.houseAge    || '',
      d.commonFee   || '',
      d.bonus       || '',
      d.transfer    || '',
      d.mapsUrl     || '',
      d.ownerName,
      d.contact     || '',
      d.ownerTel,
      _todayStr(),
      '',
      ''
    ];
    listSheet.getRange(lastRow, 1, 1, row.length).setValues([row]);
    writeSaleExtraFields_(listSheet, lastRow, saleFeatures);
    // ★ บันทึก mapsUrl + พิกัด lat/lng ที่โปรแกรมส่งมา ลงคอลัมน์ในชีต
    try { _writeRowGeo_(listSheet, lastRow, d.mapsUrl, d.lat, d.lng); } catch (e) {}
    addToUploadQueue(newCode, d.facebook);
    return { ok: true, code: newCode };

  } catch (err) {
    Logger.log('registerSaleProperty error: ' + err);
    return { ok: false, msg: String(err) };
  }
}

function makeSaleTxt(code, d, amphoe) {
  const divTh  = '\n──────────────────────────────────────────\n';
  const divOwn = '\n--------------------------------------------------------------------\n';
  const price  = Number(d.price).toLocaleString('th-TH');
  const TYPE_EN = {
    'บ้านเดี่ยว':'Single House', 'ทาวน์เฮ้าส์':'Townhouse',
    'พูลวิลล่า':'Pool Villa', 'คอนโด':'Condo / Apartment',
    'ที่ดิน':'Land', 'อาคารพาณิชย์':'Commercial Building',
    'หอพัก':'Dormitory', 'สำนักงาน':'Office', 'โกดัง':'Warehouse'
  };
  const typeEn = TYPE_EN[d.type] || d.type;
  const isCoAgent = (d.agentType === 'Co-Agent');
  let th = '';
  th += '• ขาย: ' + d.project + ' (' + d.tambon + ')\n';
  th += '💰 ราคาขาย ' + price + ' บาท';
  if (d.negotiate === 'ได้') th += ' (ต่อรองได้)';
  th += '\n';
  if (d.transfer) th += '📋 ค่าโอน: ' + d.transfer + '\n';
  th += '\n🏠 รายละเอียด\n• ประเภท: ' + d.type + '\n';
  th += '🛏️ ' + d.bedroom + ' ห้องนอน  🚿 ' + d.bathroom + ' ห้องน้ำ';
  if (d.parking) th += '  🚘 จอดรถ ' + d.parking + ' คัน';
  th += '\n';
  if (d.land)      th += '📐 ขนาดที่ดิน: ' + d.land + ' ตรว.\n';
  if (d.usable)    th += '📐 พื้นที่ใช้สอย: ' + d.usable + ' ตรม.\n';
  if (d.floor)     th += '• ชั้น: ' + d.floor + '\n';
  if (d.building)  th += '• ตึก: ' + d.building + '\n';
  if (d.direction) th += '• ทิศ: ' + d.direction + '\n';
  if (d.houseAge)  th += '• อายุบ้าน: ' + d.houseAge + '\n';
  if (d.houseInfo) th += '\n' + _toLines(d.houseInfo) + '\n';
  if (d.bonus)     th += '\n🎁 ของแถม\n' + _toLines(d.bonus) + '\n';
  if (d.locationHighlights) th += '\n📍 ทำเลทอง' + d.tambon + '\n' + _toHL(d.locationHighlights) + '\n';
  if (!isCoAgent)  th += '\n#ติดทรัพย์รับโค\n';
  th += '\nสนใจติดต่อ/Contact\n☎ Tel. ' + AGENT_TEL + '\nรหัสทรัพย์ ' + code + '\nรับ ขาย-เช่า ขายฝาก จำนอง\n';
  let en = '';
  en += '• For Sale: ' + d.project + ' (' + _tr(d.tambon) + ')\n';
  en += '💰 Asking Price: ' + price + ' THB';
  if (d.negotiate === 'ได้') en += ' (Negotiable)';
  en += '\n';
  if (d.transfer) en += '📋 Transfer Fee: ' + _tr(d.transfer) + '\n';
  en += '\n🏠 Details\n• Type: ' + typeEn + '\n';
  en += '🛏️ ' + d.bedroom + ' Bedrooms  🚿 ' + d.bathroom + ' Bathrooms';
  if (d.parking) en += '  🚘 ' + d.parking + ' Parking';
  en += '\n';
  if (d.land)      en += '📐 Land Area: ' + d.land + ' sq.w.\n';
  if (d.usable)    en += '📐 Usable Area: ' + d.usable + ' sq.m.\n';
  if (d.floor)     en += '• Floor: ' + d.floor + '\n';
  if (d.building)  en += '• Building: ' + d.building + '\n';
  if (d.direction) en += '• Facing: ' + _tr(d.direction) + '\n';
  if (d.houseAge)  en += '• House Age: ' + d.houseAge + '\n';
  const infoEn = _tr(d.houseInfo);
  if (infoEn) en += '\n' + _toLines(infoEn) + '\n';
  const bonusEn = _tr(d.bonus);
  if (bonusEn) en += '\n🎁 Included\n' + _toLines(bonusEn) + '\n';
  const locEn = _tr(d.locationHighlights);
  if (locEn) en += '\n📍 Prime Location in ' + _tr(d.tambon) + '\n' + _toHL(locEn) + '\n';
  if (!isCoAgent) en += '\n#ติดทรัพย์รับโค\n';
  en += '\nContact\n☎ Tel. ' + AGENT_TEL + '\n';
  let owner = '';
  if (d.ownerPost) owner += d.ownerPost + '\n\n';
  owner += 'ชื่อเจ้าของ : ' + d.ownerName + '\n';
  if (d.ownerTel && d.ownerTel !== '-') owner += 'เบอร์โทร : ' + d.ownerTel + '\n';
  if (d.contact)  owner += 'ช่องทางติดต่อ : ' + d.contact + '\n';
  if (d.facebook) owner += 'Facebook : ' + d.facebook + '\n';
  if (d.mapsUrl)  owner += 'Map : ' + d.mapsUrl + '\n';
  return '﻿' + th + divTh + en + divOwn + owner;
}


// ════════════════════════════════════════════════════════════
//  API ENDPOINT — doPost
// ════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, msg: 'Empty request body' });
    }
    const payload = JSON.parse(e.postData.contents);
    // Staff downloads use the existing staff login, independently of the registration API.
    if (payload && payload.action === 'downloadPhotos') return downloadPropertyPhotos_(payload);
    if (payload && payload.action === 'markRented') return markPropertyRented_(payload);
    if (payload && payload.action === 'restoreRental') return transferRentalProperty_(payload, true);
    if (payload && payload.action === 'deleteRental') return deleteRentalProperty_(payload);
    if (payload && payload.action === 'downloadSalePhotos') return downloadSalePropertyPhotos_(payload);
    if (payload && payload.action === 'markSold') return markPropertySold_(payload);
    if (payload && payload.action === 'restoreSale') return transferSaleProperty_(payload, true);
    if (payload && payload.action === 'deleteSale') return deleteSaleProperty_(payload);
    const expectedToken = PropertiesService.getScriptProperties().getProperty('API_SECRET');
    if (!expectedToken) {
      return _json({ ok: false, msg: 'Server: API_SECRET not configured' });
    }
    if (payload.token !== expectedToken) {
      return _json({ ok: false, msg: 'Unauthorized: invalid token' });
    }
    const action = String(payload.action || 'rent').toLowerCase();
    const data   = payload.data || {};
    if (action === 'rent') return _json(registerPropertyForApi(data));
    if (action === 'sale') return _json(registerSalePropertyForApi(data));
    if (action === 'ping') return _json({ ok: true, msg: 'pong', time: new Date().toISOString() });
    return _json({ ok: false, msg: 'Unknown action: ' + action });
  } catch (err) {
    return _json({ ok: false, msg: 'Server error: ' + err });
  }
}

// Bound memory/time for Apps Script and mobile browsers. Never return a partial archive.
// Only this rental subtree can supply folders for the "เช่าแล้ว" action.
const RENT_ACTION_ROOT = '1EI5dKL9C4v0bNMRkH4oRvYNdVyo5TLBn'; // Rent
const RENT_ACTION_DESTINATION = '1cBVRZTNj9ZB3rTEQuk3MXLgJKsnRrlOc'; // Rent/0-2บ้านที่ปล่อยเช่าแล้ว
const RENT_ACTION_SHEET = 'เช่าแล้ว';

function rentalRowVersion_(row) {
  const values = row.slice();
  while (values.length && (values[values.length - 1] === '' || values[values.length - 1] == null)) values.pop();
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(values))
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function rentActionError_(code) { const e = new Error(code); e.rentActionError = code; throw e; }
function rentFolderCode_(name) {
  const m = String(name || '').trim().toUpperCase().match(/^((?:R[A-Z]{2}|CO[A-Z]*)\d+)(?=$|[^A-Z0-9])/);
  return m ? m[1] : '';
}
function rentFolderParents_(folder) {
  const it = folder.getParents(), ids = [];
  while (it.hasNext()) ids.push(it.next().getId());
  return ids;
}
function rentFolderInScope_(folder) {
  const seen = {};
  for (let depth = 0; depth < 100; depth++) {
    const id = folder.getId();
    if (id === RENT_ACTION_ROOT) return true;
    if (id === RENT_ACTION_DESTINATION || id === FOLDER_SALE_BAAN || id === FOLDER_SALE_CONDO || seen[id]) return false;
    seen[id] = true;
    if (folder.isTrashed()) return false;
    const parents = rentFolderParents_(folder);
    if (parents.length !== 1) return false;
    folder = DriveApp.getFolderById(parents[0]);
  }
  return false;
}
// Breadth-first search. Drive shortcuts are not followed; the archived/sale subtrees are skipped.
function findRentalActionFolders_(code) {
  const queue = [RENT_ACTION_ROOT], seen = {}, matches = [], deadline = Date.now() + 45000;
  const fast = typeof Drive !== 'undefined' && Drive.Files && Drive.Files.list;
  let visited = 0;
  function accept(id, name, parentId) {
    if (seen[id] || id === RENT_ACTION_DESTINATION || id === FOLDER_SALE_BAAN || id === FOLDER_SALE_CONDO) return;
    seen[id] = true;
    if (++visited > 5000 || Date.now() > deadline) rentActionError_('folder_scan_timeout');
    if (rentFolderCode_(name) === code) {
      matches.push({ id: id, parentId: parentId });
      if (matches.length > 25) rentActionError_('too_many_folders');
    } else queue.push(id);
  }
  while (queue.length) {
    if (Date.now() > deadline) rentActionError_('folder_scan_timeout');
    if (fast) {
      const batch = queue.splice(0, 20);
      let pageToken = null;
      do {
        if (Date.now() > deadline) rentActionError_('folder_scan_timeout');
        const response = Drive.Files.list({
          q: '(' + batch.map(function(id) { return "'" + id + "' in parents"; }).join(' or ') +
            ") and mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: 'nextPageToken,files(id,name,parents)', pageSize: 1000, pageToken: pageToken
        });
        (response.files || []).forEach(function(f) {
          const parent = (f.parents || []).filter(function(id) { return batch.indexOf(id) !== -1; })[0];
          if (!parent) rentActionError_('outside_rent');
          accept(f.id, f.name, parent);
        });
        pageToken = response.nextPageToken;
      } while (pageToken);
    } else {
      const parent = queue.shift(), it = DriveApp.getFolderById(parent).getFolders();
      while (it.hasNext()) { const f = it.next(); accept(f.getId(), f.getName(), parent); }
    }
  }
  return matches;
}
function findRentalSheetRow_(sheet, code) {
  const data = sheet.getDataRange().getValues(), found = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toUpperCase() === code) found.push(i + 1);
  }
  if (found.length > 1) rentActionError_('duplicate_code');
  return found.length ? found[0] : 0;
}
function rentalArchiveRow_(sheet, job) {
  const marker = 'rent-action:' + job.id, last = sheet.getLastRow();
  if (last > 1) {
    const notes = sheet.getRange(2, 2, last - 1, 1).getNotes();
    const found = [];
    notes.forEach(function(row, i) { if (String(row[0] || '').split('\n').indexOf(marker) !== -1) found.push(i + 2); });
    if (found.length > 1) rentActionError_('archive_conflict');
    if (found.length) return found[0];
  }
  // Completed actions no longer have a tracking note. Match the saved snapshot
  // so a retry can still find the row after rows are inserted or reordered.
  if (job.phase === 'done') {
    const data = last > 1 ? sheet.getRange(2, 1, last - 1, job.width).getValues() : [];
    const found = [];
    data.forEach(function(row, i) {
      if (String(row[1] || '').trim().toUpperCase() === job.code && rentalRowVersion_(row) === (job.targetVersion || job.version)) found.push(i + 2);
    });
    if (found.length !== 1) rentActionError_('archive_conflict');
    return found[0];
  }
  return job.archiveRow;
}
function verifyRentalArchive_(sheet, row, job) {
  const values = sheet.getRange(row, 1, 1, job.width).getValues()[0];
  if (String(values[1] || '').trim().toUpperCase() !== job.code || rentalRowVersion_(values) !== (job.targetVersion || job.version))
    rentActionError_('archive_conflict');
}
function finishRentalAction_(sheet, row, job, props, key) {
  // Save completion BEFORE removing the marker so a lost response can recover.
  job.archiveRow = row;
  job.phase = 'done'; props.setProperty(key, JSON.stringify(job));
  const cell = sheet.getRange(row, 2), marker = 'rent-action:' + job.id;
  const note = cell.getNote() || '';
  const cleaned = note.split('\n').filter(function(line) { return line !== marker; }).join('\n');
  if (cleaned !== note) {
    cell.setNote(cleaned);
    SpreadsheetApp.flush();
  }
}
function markPropertyRented_(params) { return transferRentalProperty_(params, false); }

// Resolve categories under Rent; never send a return to the sale tree.
function rentalReturnDestination_(type) {
  const value = String(type || '').trim().toLowerCase();
  let id;
  if (/คอนโด|condo/.test(value)) id = FOLDER_CONDO;
  else if (/บ้าน|ทาวน์|พูลวิลล่า|house|villa/.test(value)) id = FOLDER_BAAN;
  else if (value) {
    const folders = DriveApp.getFolderById(RENT_ACTION_ROOT).getFolders(), matches = [];
    while (folders.hasNext()) {
      const f = folders.next();
      if (/business|bussinest|bassinets|ธุรกิจ/i.test(f.getName())) matches.push(f.getId());
    }
    if (matches.length !== 1) rentActionError_('destination_mismatch');
    id = matches[0];
  } else rentActionError_('unsupported_type');
  const folder = DriveApp.getFolderById(id);
  if (!rentFolderInScope_(folder)) rentActionError_('destination_mismatch');
  return id;
}
function rentalTransferValues_(snapshot, returning, timestamp) {
  const values = snapshot.slice();
  while (values.length < 29) values.push('');
  if (returning) {
    values[4] = 'พร้อมเช่า';
    values[27] = new Date(timestamp);
    const count = values[28] === '' || values[28] == null ? 0 : Number(values[28]);
    if (!Number.isSafeInteger(count) || count < 0) rentActionError_('invalid_return_count');
    values[28] = count + 1;
  } else values[26] = new Date(timestamp);
  return values;
}
function transferRentalProperty_(params, returning) {
  if (!params || !params.token || params.token !== STAFF_PASSWORD) return _json({ ok: false, error: 'unauthorized' });
  if (params.confirmed !== true) return _json({ ok: false, error: 'confirmation_required' });
  const code = String(params.code || '').trim().toUpperCase();
  if (!/^(?:R[A-Z]{2}|CO[A-Z]*)\d+$/.test(code)) return _json({ ok: false, error: 'invalid_code' });
  if (!/^[a-f0-9]{64}$/.test(String(params.version || ''))) return _json({ ok: false, error: 'invalid_version' });
  let lock, held = false;
  try {
    lock = LockService.getScriptLock();
    held = lock.tryLock(1000);
    if (!held) return _json({ ok: false, error: 'busy' });
    const ss = SpreadsheetApp.openById(SS_ID), source = ss.getSheetByName(returning ? RENT_ACTION_SHEET : SHEET_LIST), archive = ss.getSheetByName(returning ? SHEET_LIST : RENT_ACTION_SHEET);
    if (!source || !archive) rentActionError_('missing_sheet');
    assertNoPendingRentalDelete_(code);
    let destination = DriveApp.getFolderById(RENT_ACTION_DESTINATION);
    const destParents = rentFolderParents_(destination);
    if (destination.isTrashed() || destination.getName() !== '0-2บ้านที่ปล่อยเช่าแล้ว' ||
        destParents.length !== 1 || destParents[0] !== RENT_ACTION_ROOT) rentActionError_('destination_mismatch');
    const props = PropertiesService.getScriptProperties(), key = (returning ? 'rent_return_' : 'rent_action_') + code;
    let job = JSON.parse(props.getProperty(key) || 'null');
    let sourceRow = findRentalSheetRow_(source, code);
    if (!sourceRow) {
      if (!job || job.version !== params.version) rentActionError_('source_missing');
      const savedRow = rentalArchiveRow_(archive, job);
      verifyRentalArchive_(archive, savedRow, job);
      job.folders.forEach(function(f) {
        const folder = DriveApp.getFolderById(f.id), parents = rentFolderParents_(folder);
        if (folder.isTrashed() || rentFolderCode_(folder.getName()) !== code || parents.length !== 1 || parents[0] !== (job.destinationId || RENT_ACTION_DESTINATION))
          rentActionError_('rental_incomplete');
      });
      finishRentalAction_(archive, savedRow, job, props, key);
      try { clearPhotoCache(); _clearRentedPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache(); } catch (e) {}
      return _json({ ok: true, code: code, alreadyDone: true });
    }
    if (source.getMaxColumns() < 29) source.insertColumnsAfter(source.getMaxColumns(), 29 - source.getMaxColumns());
    const width = source.getMaxColumns(), snapshot = source.getRange(sourceRow, 1, 1, width).getValues()[0];
    if (rentalRowVersion_(snapshot) !== params.version) rentActionError_('source_changed');
    if (job && job.phase !== 'done' && job.version !== params.version) rentActionError_('archive_conflict');
    if (job && job.phase === 'done' && job.version === params.version) rentActionError_('archive_conflict');
    if (!job || job.phase === 'done') {
      if (findRentalSheetRow_(archive, code)) rentActionError_('archive_conflict');
      const destinationId = returning ? rentalReturnDestination_(snapshot[6]) : RENT_ACTION_DESTINATION;
      const folders = [];
      if (returning) {
        const it = DriveApp.getFolderById(RENT_ACTION_DESTINATION).getFolders();
        while (it.hasNext()) { const f = it.next(); if (rentFolderCode_(f.getName()) === code) folders.push({ id: f.getId(), parentId: RENT_ACTION_DESTINATION }); }
        if (folders.length > 25) rentActionError_('too_many_folders');
      } else folders.push.apply(folders, findRentalActionFolders_(code));
      if (!folders.length) rentActionError_('no_rent_folder');
      folders.forEach(function(f) {
        const folder = DriveApp.getFolderById(f.id);
        if (returning ? rentFolderParents_(folder).length !== 1 || rentFolderParents_(folder)[0] !== RENT_ACTION_DESTINATION : !rentFolderInScope_(folder)) rentActionError_('outside_rent');
      });
      const timestamp = new Date().toISOString();
      const targetValues = rentalTransferValues_(snapshot, returning, timestamp);
      job = { id: Utilities.getUuid(), code: code, version: params.version, targetVersion: rentalRowVersion_(targetValues), timestamp: timestamp, destinationId: destinationId, width: width,
        archiveRow: archive.getLastRow() + 1, folders: folders, phase: 'reserved' };
      // Persist the reservation BEFORE writing. Retries reuse the same archive row and folders.
      props.setProperty(key, JSON.stringify(job));
    }
    destination = DriveApp.getFolderById(job.destinationId || RENT_ACTION_DESTINATION);
    if (returning && !rentFolderInScope_(destination)) rentActionError_('destination_mismatch');
    if (archive.getMaxColumns() < job.width) archive.insertColumnsAfter(archive.getMaxColumns(), job.width - archive.getMaxColumns());
    const archiveRow = rentalArchiveRow_(archive, job);
    if (archive.getMaxRows() < archiveRow) archive.insertRowsAfter(archive.getMaxRows(), archiveRow - archive.getMaxRows());
    const target = archive.getRange(archiveRow, 1, 1, job.width), previous = target.getValues()[0];
    if (previous.some(function(v) { return v !== '' && v != null; })) {
      // Recover a copyTo that succeeded before the history write failed.
      if (job.timestamp && job.phase === 'reserved' && rentalRowVersion_(previous) === job.version) {
        target.setValues([rentalTransferValues_(snapshot, returning, job.timestamp).map(function(v) { return typeof v === 'string' && v.charAt(0) === '=' ? "'" + v : v; })]);
        SpreadsheetApp.flush();
      }
      verifyRentalArchive_(archive, archiveRow, job);
    } else {
      if (job.phase !== 'reserved') rentActionError_('archive_conflict');
      source.getRange(sourceRow, 1, 1, job.width).copyTo(target);
      // Freeze the original values; relative formulas must not recalculate against archive rows.
      target.setValues([(job.timestamp ? rentalTransferValues_(snapshot, returning, job.timestamp) : snapshot).slice(0, job.width).map(function(v) { return typeof v === 'string' && v.charAt(0) === '=' ? "'" + v : v; })]);
      SpreadsheetApp.flush();
      verifyRentalArchive_(archive, archiveRow, job);
    }
    archive.getRange(archiveRow, returning ? 28 : 27).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    const codeCell = archive.getRange(archiveRow, 2), marker = 'rent-action:' + job.id;
    const note = codeCell.getNote() || '';
    if (note.split('\n').indexOf(marker) === -1) codeCell.setNote(note + (note ? '\n' : '') + marker);
    job.phase = 'copied'; props.setProperty(key, JSON.stringify(job));
    job.folders.forEach(function(f) {
      const folder = DriveApp.getFolderById(f.id), parents = rentFolderParents_(folder);
      if (folder.isTrashed() || rentFolderCode_(folder.getName()) !== code) rentActionError_('outside_rent');
      if (parents.length === 1 && parents[0] === (job.destinationId || RENT_ACTION_DESTINATION)) return;
      if (returning ? parents.length !== 1 || parents[0] !== RENT_ACTION_DESTINATION : !rentFolderInScope_(folder)) rentActionError_('outside_rent');
      folder.moveTo(destination);
      const movedParents = rentFolderParents_(folder);
      if (movedParents.length !== 1 || movedParents[0] !== (job.destinationId || RENT_ACTION_DESTINATION)) rentActionError_('rental_incomplete');
    });
    // Locate by code again because editors may have inserted/reordered rows while Drive moved.
    sourceRow = findRentalSheetRow_(source, code);
    if (!sourceRow || rentalRowVersion_(source.getRange(sourceRow, 1, 1, job.width).getValues()[0]) !== job.version)
      rentActionError_('source_changed');
    verifyRentalArchive_(archive, archiveRow, job);
    source.deleteRow(sourceRow);
    SpreadsheetApp.flush();
    finishRentalAction_(archive, archiveRow, job, props, key);
    try { clearPhotoCache(); _clearRentedPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache(); } catch (e) {}
    return _json({ ok: true, code: code });
  } catch (err) {
    return _json({ ok: false, error: err.rentActionError || 'rental_incomplete' });
  } finally {
    if (held) lock.releaseLock();
  }
}

function assertNoPendingRentalDelete_(code) {
  const props = PropertiesService.getScriptProperties();
  ['active', 'rented'].forEach(function(dataset) {
    const job = JSON.parse(props.getProperty('rent_delete_' + dataset + '_' + code) || 'null');
    if (job && job.phase !== 'done') rentActionError_('deletion_pending');
  });
}

// Delete only the selected sheet's row and its exact-code rental folders.
// Trash is recoverable; the journal makes retries safe after a lost response.
function deleteRentalProperty_(params) {
  if (!params || !params.token || params.token !== STAFF_PASSWORD) return _json({ ok: false, error: 'unauthorized' });
  if (params.confirmed !== true) return _json({ ok: false, error: 'confirmation_required' });
  if (String(params.deleteCode || '') !== '1140') return _json({ ok: false, error: 'invalid_delete_code' });
  const code = String(params.code || '').trim().toUpperCase();
  if (!/^(?:R[A-Z]{2}|CO[A-Z]*)\d+$/.test(code)) return _json({ ok: false, error: 'invalid_code' });
  if (!/^[a-f0-9]{64}$/.test(String(params.version || ''))) return _json({ ok: false, error: 'invalid_version' });
  if (params.dataset !== 'active' && params.dataset !== 'rented') return _json({ ok: false, error: 'invalid_dataset' });
  let lock, held = false;
  try {
    lock = LockService.getScriptLock(); held = lock.tryLock(1000);
    if (!held) return _json({ ok: false, error: 'busy' });
    const props = PropertiesService.getScriptProperties();
    ['rent_action_', 'rent_return_'].forEach(function(prefix) {
      const transfer = JSON.parse(props.getProperty(prefix + code) || 'null');
      if (transfer && transfer.phase !== 'done') rentActionError_('archive_conflict');
    });
    const sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(params.dataset === 'rented' ? RENT_ACTION_SHEET : SHEET_LIST);
    if (!sheet) rentActionError_('missing_sheet');
    const key = 'rent_delete_' + params.dataset + '_' + code;
    let job = JSON.parse(props.getProperty(key) || 'null');
    let row = findRentalSheetRow_(sheet, code);
    if (!row) {
      if (!job || job.version !== params.version) rentActionError_('source_missing');
      job.folders.forEach(function(f) { if (!DriveApp.getFolderById(f.id).isTrashed()) rentActionError_('deletion_incomplete'); });
      job.phase = 'done'; props.setProperty(key, JSON.stringify(job));
      clearPhotoCache(); _clearRentedPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache();
      return _json({ ok: true, code: code, alreadyDone: true });
    }
    const width = sheet.getMaxColumns();
    if (rentalRowVersion_(sheet.getRange(row, 1, 1, width).getValues()[0]) !== params.version) rentActionError_('source_changed');
    if (job && job.phase !== 'done' && job.version !== params.version) rentActionError_('archive_conflict');
    if (job && job.phase === 'done' && job.version === params.version) rentActionError_('source_changed');
    if (!job || job.phase === 'done') {
      let folders;
      if (params.dataset === 'active') folders = findRentalActionFolders_(code);
      else {
        folders = []; const root = DriveApp.getFolderById(RENT_ACTION_DESTINATION);
        const parents = rentFolderParents_(root);
        if (root.isTrashed() || parents.length !== 1 || parents[0] !== RENT_ACTION_ROOT) rentActionError_('destination_mismatch');
        const it = root.getFolders(), deadline = Date.now() + 45000;
        while (it.hasNext()) {
          if (Date.now() > deadline) rentActionError_('folder_scan_timeout');
          const f = it.next();
          if (rentFolderCode_(f.getName()) === code) folders.push({ id: f.getId(), parentId: RENT_ACTION_DESTINATION });
          if (folders.length > 25) rentActionError_('too_many_folders');
        }
      }
      job = { version: params.version, folders: folders, phase: 'reserved' };
      props.setProperty(key, JSON.stringify(job));
    }
    function validate(folder, saved) {
      const parents = rentFolderParents_(folder);
      if (rentFolderCode_(folder.getName()) !== code || parents.length !== 1 || parents[0] !== saved.parentId) rentActionError_('outside_rent');
      if (!folder.isTrashed() && (params.dataset === 'active' ? !rentFolderInScope_(folder) : parents[0] !== RENT_ACTION_DESTINATION)) rentActionError_('outside_rent');
    }
    // Validate every folder before deleting any, including on retries.
    job.folders.forEach(function(f) { validate(DriveApp.getFolderById(f.id), f); });
    job.folders.forEach(function(f) {
      row = findRentalSheetRow_(sheet, code);
      if (!row || rentalRowVersion_(sheet.getRange(row, 1, 1, width).getValues()[0]) !== job.version) rentActionError_('source_changed');
      const folder = DriveApp.getFolderById(f.id); validate(folder, f);
      if (!folder.isTrashed()) folder.setTrashed(true);
      if (!folder.isTrashed()) rentActionError_('deletion_incomplete');
    });
    row = findRentalSheetRow_(sheet, code);
    if (!row || rentalRowVersion_(sheet.getRange(row, 1, 1, width).getValues()[0]) !== job.version) rentActionError_('source_changed');
    sheet.deleteRow(row); SpreadsheetApp.flush();
    job.phase = 'done'; props.setProperty(key, JSON.stringify(job));
    clearPhotoCache(); _clearRentedPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache();
    return _json({ ok: true, code: code });
  } catch (err) {
    return _json({ ok: false, error: err.rentActionError || 'deletion_incomplete' });
  } finally { if (held) lock.releaseLock(); }
}

const PHOTO_ZIP_MAX_BYTES = 50 * 1024 * 1024;
const PHOTO_ZIP_MAX_FILES = 200;
function downloadPropertyPhotos_(params) {
  if (!params || !params.token || params.token !== STAFF_PASSWORD) {
    return _json({ ok: false, error: 'unauthorized' });
  }
  const code = String(params.code || '').trim().toUpperCase();
  if (!/^(?:R[A-Z]{2}|CO[A-Z]*)\d+$/.test(code)) {
    return _json({ ok: false, error: 'invalid_code' });
  }
  try {
    // Resolve only known property folders; never accept a folder ID from the browser.
    const map = buildPhotoMap(params.dataset === 'rented' ? RENT_ACTION_DESTINATION : undefined);
    const entry = Object.prototype.hasOwnProperty.call(map, code) ? map[code] : null;
    if (!entry || !entry.folderId) return _json({ ok: false, error: 'no_folder' });
    const iterator = DriveApp.getFolderById(entry.folderId).getFiles();
    const files = [];
    let totalBytes = 0;
    while (iterator.hasNext()) {
      const file = iterator.next();
      if (!/^image\//i.test(file.getMimeType())) continue;
      totalBytes += file.getSize();
      files.push(file);
      if (totalBytes > PHOTO_ZIP_MAX_BYTES || files.length > PHOTO_ZIP_MAX_FILES) {
        return _json({ ok: false, error: 'too_large', maxMB: PHOTO_ZIP_MAX_BYTES / (1024 * 1024), maxFiles: PHOTO_ZIP_MAX_FILES });
      }
    }
    if (!files.length) return _json({ ok: false, error: 'no_photos' });
    files.sort(function(a, b) { return a.getName().localeCompare(b.getName(), 'th', { numeric: true }); });
    let actualBytes = 0;
    const blobs = files.map(function(file, index) {
      const blob = file.getBlob();
      actualBytes += blob.getBytes().length;
      if (actualBytes > PHOTO_ZIP_MAX_BYTES) throw new Error('PHOTO_ZIP_TOO_LARGE');
      // A numeric prefix preserves duplicate names; remove paths/unsafe filename characters.
      const safeName = file.getName().replace(/[\x00-\x1f\x7f\\/:*?"<>|]/g, '_').replace(/^\.+|[. ]+$/g, '') || 'photo';
      return blob.setName(String(index + 1).padStart(3, '0') + '-' + safeName);
    });
    if (params.format === 'images') {
      return _json({ ok: true, format: 'images', count: blobs.length,
        images: blobs.map(function(blob, index) {
          return { name: blob.getName(), mimeType: files[index].getMimeType(),
            base64: Utilities.base64Encode(blob.getBytes()) };
        }) });
    }
    const filename = code + '-photos.zip';
    const archive = Utilities.zip(blobs, filename);
    return _json({ ok: true, filename: filename, count: blobs.length,
      mimeType: 'application/zip', base64: Utilities.base64Encode(archive.getBytes()) });
  } catch (err) {
    if (String(err.message) === 'PHOTO_ZIP_TOO_LARGE') {
      return _json({ ok: false, error: 'too_large', maxMB: PHOTO_ZIP_MAX_BYTES / (1024 * 1024), maxFiles: PHOTO_ZIP_MAX_FILES });
    }
    // Do not expose Drive IDs or internal exception details in download responses.
    return _json({ ok: false, error: 'archive_failed' });
  }
}

function registerPropertyForApi(d) {
  const result = registerProperty(d);
  if (!result.ok) return result;
  const isCondo    = (d.type === 'คอนโด');
  const rootFolder = DriveApp.getFolderById(isCondo ? FOLDER_CONDO : FOLDER_BAAN);
  const folders    = rootFolder.getFoldersByName(result.code);
  const folderId   = folders.hasNext() ? folders.next().getId() : null;
  if (d.beautiful && String(d.beautiful).trim() !== '') {
    try {
      const ss        = SpreadsheetApp.openById(SS_ID);
      const listSheet = ss.getSheetByName(SHEET_LIST);
      const codes     = listSheet.getRange('B:B').getValues();
      for (let i = codes.length - 1; i >= 0; i--) {
        if (String(codes[i][0]).trim() === result.code) {
          listSheet.getRange(i + 1, 21).setValue(d.beautiful);
          break;
        }
      }
    } catch (e) { Logger.log('beautiful write error: ' + e); }
  }
  return { ok: true, code: result.code, folderId: folderId };
}

function registerSalePropertyForApi(d) {
  const result = registerSaleProperty(d);
  if (!result.ok) return result;
  const isCondo    = (d.type === 'คอนโด');
  const rootFolder = DriveApp.getFolderById(isCondo ? FOLDER_SALE_CONDO : FOLDER_SALE_BAAN);
  const folders    = rootFolder.getFoldersByName(result.code);
  const folderId   = folders.hasNext() ? folders.next().getId() : null;
  return { ok: true, code: result.code, folderId: folderId };
}


// ════════════════════════════════════════════════════════════
//  CATALOG — doGet
// ════════════════════════════════════════════════════════════
function parseRentStatus_(raw, todayKey, todayY) {
  if (raw == null) return null;
  if (Object.prototype.toString.call(raw) === '[object Date]' && !isNaN(raw)) {
    const dd   = Utilities.formatDate(raw, TZ, 'dd');
    const mm   = Utilities.formatDate(raw, TZ, 'MM');
    const yyyy = Utilities.formatDate(raw, TZ, 'yyyy');
    const key  = parseInt(yyyy + mm + dd, 10);
    return { ready: key <= todayKey, availableDate: yyyy + '-' + mm + '-' + dd };
  }
  const s = String(raw).trim();
  if (!s) return null;
  if (s.indexOf('พร้อมเช่า') !== -1) return { ready: true, availableDate: '' };
  const m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (!m) return null;
  const dd = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  let yyyy = m[3] ? parseInt(m[3], 10) : todayY;
  if (yyyy < 100)  yyyy += 2000;
  if (yyyy > 2400) yyyy -= 543;
  if (!dd || !mm) return null;
  let key = yyyy * 10000 + mm * 100 + dd;
  if (!m[3] && key < todayKey) { yyyy += 1; key = yyyy * 10000 + mm * 100 + dd; }
  const pad = function(n) { return n < 10 ? '0' + n : '' + n; };
  return { ready: key <= todayKey, availableDate: yyyy + '-' + pad(mm) + '-' + pad(dd) };
}

function _rentSheetAsCSV_() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SHEET_LIST);
  if (!sheet) {
    return ContentService.createTextOutput('ERROR,Sheet not found: ' + SHEET_LIST)
      .setMimeType(ContentService.MimeType.CSV);
  }
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 1 || lastCol < 1) {
    return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.CSV);
  }
  const data = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const csv = data.map(function(row) {
    return row.map(function(cell) {
      let s = (cell == null) ? '' : String(cell);
      if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 ||
          s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}

function _foldersAsJSON_() {
  try {
    const photoMap = buildPhotoMap();
    const folders = {};
    Object.keys(photoMap).forEach(function(code) {
      const e = photoMap[code] || {};
      // ★ ส่งทั้ง url (โฟลเดอร์ Drive) + thumb (fileId รูปแรก) ให้หน้า "ตารางโพสทรัพย์"
      //   เพื่อทำการ์ดพร้อมรูปได้ทันที (ดู index.html ใน random Post FB)
      folders[code] = {
        url:   e.folderId ? 'https://drive.google.com/drive/folders/' + e.folderId : '',
        thumb: e.thumb || ''
      };
    });
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, folders: folders }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ════════════════════════════════════════════════════════════
//  HIDE FROM SCHEDULE — ลบคำว่า "สวย" ออกจากคอลัมน์ U ของชีตบ้านเช่า
//    ใช้จากหน้า "ตารางโพสทรัพย์" (random Post FB) เมื่อกดปุ่ม 🗑️ บนการ์ด
//    → ทรัพย์นั้นจะไม่ผ่านฟิลเตอร์ "สวย" อีก = ไม่ขึ้นตารางโพสซ้ำ
//    GET: ?action=hideSchedule&code=RXX####&token=<STAFF_PASSWORD>
// ════════════════════════════════════════════════════════════
function _hideFromSchedule_(params) {
  try {
    if (params.token !== STAFF_PASSWORD) return _json({ ok: false, msg: 'unauthorized' });
    const code = String(params.code || '').trim().toUpperCase();
    if (!code) return _json({ ok: false, msg: 'no code' });

    const ss        = SpreadsheetApp.openById(SS_ID);
    const listSheet = ss.getSheetByName(SHEET_LIST);
    if (!listSheet) return _json({ ok: false, msg: 'no sheet' });

    const codes = listSheet.getRange('B:B').getValues();   // คอลัมน์ B = รหัส
    for (let i = codes.length - 1; i >= 1; i--) {
      if (String(codes[i][0]).trim().toUpperCase() === code) {
        const cell = listSheet.getRange(i + 1, 21);   // คอลัมน์ U (ตัวที่ 21)
        const cur  = String(cell.getValue() == null ? '' : cell.getValue());
        const next = cur.replace(/สวย/g, '').trim();   // ★ ลบเฉพาะคำว่า "สวย"
        if (next !== cur) cell.setValue(next);
        return _json({ ok: true, hidden: true, code: code, valueU: next });
      }
    }
    return _json({ ok: false, msg: 'code not found: ' + code });
  } catch (err) {
    return _json({ ok: false, msg: String(err) });
  }
}

// ════════════════════════════════════════════════════════════
//  MARK POSTED — บันทึกวันโพสวันนี้ (dd/MM/yyyy) ลงคอลัมน์ S ของชีตบ้านเช่า
//    ใช้จากหน้า "ตารางโพสทรัพย์" เมื่อกดปุ่ม ✅ โพสแล้ว
//    → ทรัพย์นั้นกลายเป็น "วันโพสล่าสุด = วันนี้" = ไปต่อท้ายคิว, ตัวเก่าสุดถูกวนมาแทน
//    GET: ?action=markPosted&code=RXX####&token=<STAFF_PASSWORD>
// ════════════════════════════════════════════════════════════
function _markPosted_(params) {
  try {
    if (params.token !== STAFF_PASSWORD) return _json({ ok: false, msg: 'unauthorized' });
    const code = String(params.code || '').trim().toUpperCase();
    if (!code) return _json({ ok: false, msg: 'no code' });

    const ss        = SpreadsheetApp.openById(SS_ID);
    const listSheet = ss.getSheetByName(SHEET_LIST);
    if (!listSheet) return _json({ ok: false, msg: 'no sheet' });

    const codes = listSheet.getRange('B:B').getValues();   // คอลัมน์ B = รหัส
    for (let i = codes.length - 1; i >= 1; i--) {
      if (String(codes[i][0]).trim().toUpperCase() === code) {
        const today = _todayStr();                          // dd/MM/yyyy (Asia/Bangkok)
        listSheet.getRange(i + 1, 19).setValue(today);      // คอลัมน์ S (ตัวที่ 19) = วันโพสล่าสุด
        return _json({ ok: true, posted: true, code: code, dateS: today });
      }
    }
    return _json({ ok: false, msg: 'code not found: ' + code });
  } catch (err) {
    return _json({ ok: false, msg: String(err) });
  }
}

// ════════════════════════════════════════════════════════════
//  CAPTION — ดึงเนื้อหาไฟล์ {รหัส}-1.txt (caption ประกาศ ไม่มีข้อมูลเจ้าของ)
//  เรียกจากส่วน "ข้อมูลทีมงาน" ในเว็บ (staff เท่านั้น) เพื่อ copy เสนอลูกค้า
// ════════════════════════════════════════════════════════════
function getCaption_(params) {
  if (params.token !== STAFF_PASSWORD) return _json({ ok: false, msg: 'unauthorized' });
  const code = String(params.code || '').trim().toUpperCase();
  if (!code) return _json({ ok: false, msg: 'no code' });
  // ★ ลิงก์โพส FB ล่าสุด (จาก Upload Queue) — แนบไปกับ caption เสมอ ใช้เช็คว่าปล่อยเช่ายัง
  let fb = '';
  try { fb = getUploadFbMap_(SpreadsheetApp.openById(SS_ID))[code] || ''; } catch (e) {}
  const map = (params.type === 'sale') ? buildSalePhotoMap() : buildPhotoMap(params.dataset === 'rented' ? RENT_ACTION_DESTINATION : undefined);
  const entry = map[code];
  if (!entry || !entry.folderId) return _json({ ok: false, msg: 'no folder', fb: fb });
  try {
    const it = DriveApp.getFolderById(entry.folderId).getFilesByName(code + '-1.txt');
    if (!it.hasNext()) return _json({ ok: false, msg: 'no caption', fb: fb });
    const text = it.next().getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
    return _json({ ok: true, code: code, caption: text, fb: fb });
  } catch (e) {
    return _json({ ok: false, msg: String(e), fb: fb });
  }
}

// ────────────────────────────────────────────────────────────
//  บันทึก mapsUrl + lat/lng ของแถวที่เพิ่งลงทะเบียน → คอลัมน์ตามชื่อ header
//  (โปรแกรม auto_register ส่ง d.lat/d.lng มาแล้ว — ที่นี่แค่เขียนลงชีต ไม่แปลงจาก URL)
// ────────────────────────────────────────────────────────────
function _writeRowGeo_(sheet, rowNum, mapsUrl, lat, lng) {
  try {
    const lastCol = sheet.getLastColumn();
    const hdr = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const cM = hdr.indexOf(GEO_COL_MAPS_URL) + 1;   // 'mapsUrl'
    const cA = hdr.indexOf(GEO_COL_LAT) + 1;         // 'lat'
    const cG = hdr.indexOf(GEO_COL_LNG) + 1;         // 'lng'
    if (cM && mapsUrl)                    sheet.getRange(rowNum, cM).setValue(mapsUrl);
    if (cA && lat !== '' && lat != null)  sheet.getRange(rowNum, cA).setValue(parseFloat(lat));
    if (cG && lng !== '' && lng != null)  sheet.getRange(rowNum, cG).setValue(parseFloat(lng));
    try { clearGeoCache(); } catch (e) {}
  } catch (e) {
    Logger.log('_writeRowGeo_ error: ' + e);
  }
}

// ════════════════════════════════════════════════════════════
//  CUSTOMER CRM — แท็บ "ลูกค้าหาเช่า" (staff เท่านั้น)
//    อ่าน : ?action=custList&token=<STAFF_PASSWORD>
//    เพิ่ม : ?action=custAdd&token=&name=&contact=&...     (ออกรหัส C##### + วันที่ให้อัตโนมัติ)
//    แก้ไข : ?action=custUpdate&token=&id=C00001&<ฟิลด์ที่จะแก้>=...  (แก้เฉพาะฟิลด์ที่ส่งมา)
//    ลบ   : ?action=custDelete&token=&id=C00001
//  เก็บข้อมูลในแท็บใหม่ของชีตเดิม (SS_ID) — สร้างแท็บ + หัวตารางให้อัตโนมัติถ้ายังไม่มี
// ════════════════════════════════════════════════════════════

// สร้าง/คืนแท็บลูกค้า — ถ้ายังไม่มีจะสร้างพร้อมหัวตาราง + dropdown สถานะ (เหมือน addToUploadQueue)
function _ensureCustomerSheet_(ss) {
  ss = ss || SpreadsheetApp.openById(SS_ID);
  let sh = ss.getSheetByName(SHEET_CUSTOMER);
  if (!sh) {
    sh = ss.insertSheet(SHEET_CUSTOMER);
    sh.getRange(1, 1, 1, CUSTOMER_HEADERS.length)
      .setValues([CUSTOMER_HEADERS])
      .setFontWeight('bold').setBackground('#1a365d').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    const widths = [90, 110, 150, 170, 90, 130, 170, 190, 100, 100, 100, 90, 120, 160, 160, 160, 120, 110, 280, 130, 120, 95, 95, 95, 150];
    widths.forEach(function(w, i) { sh.setColumnWidth(i + 1, w); });
    try {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(CUSTOMER_STATUSES, true).build();
      sh.getRange(2, 17, sh.getMaxRows() - 1, 1).setDataValidation(rule);   // คอลัมน์ Q = สถานะ
    } catch (e) {}
    sh.getRange(2, 1, sh.getMaxRows() - 1, CUSTOMER_HEADERS.length).setNumberFormat('@');   // ★ บังคับเป็นข้อความ → เก็บเลข 0 นำหน้าได้ (เบอร์/งบ)
  }
  return sh;
}

// ★ รันครั้งเดียวจากเมนู 🏠 ลงทะเบียนทรัพย์ → "ตั้งค่าแท็บฐานข้อมูลลูกค้า"
function setupCustomerSheet() {
  const sh = _ensureCustomerSheet_(SpreadsheetApp.openById(SS_ID));
  try { SpreadsheetApp.getUi().alert('✅ พร้อมใช้งานแท็บ "' + SHEET_CUSTOMER + '" แล้ว (' + CUSTOMER_HEADERS.length + ' คอลัมน์)'); } catch (e) {}
  return sh.getName();
}

// ออกรหัสลูกค้าใหม่ C##### — ★ ใช้ตัวนับถาวร (ScriptProperties) วิ่งขึ้นเรื่อยๆ
//   ไม่ย้อนกลับมาใช้เลขซ้ำแม้จะลบการ์ดทิ้ง (เทียบกับเลขสูงสุดในชีตด้วย กันตัวนับหาย/ตามหลัง)
function _custNextId_(sh) {
  const props = PropertiesService.getScriptProperties();
  const KEY = 'cust_counter';
  const lock = LockService.getScriptLock();
  try { lock.waitLock(5000); } catch (e) {}
  try {
    let maxSheet = 0;
    const last = sh.getLastRow();
    if (last >= 2) {
      sh.getRange(2, 1, last - 1, 1).getValues().forEach(function(r) {
        const m = String(r[0] || '').match(/(\d+)/);
        if (m) { const n = parseInt(m[1], 10); if (n > maxSheet) maxSheet = n; }
      });
    }
    const stored = parseInt(props.getProperty(KEY), 10) || 0;
    const next = Math.max(stored, maxSheet) + 1;   // เดินหน้าเสมอ
    props.setProperty(KEY, String(next));
    return 'C' + String(next).padStart(5, '0');
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

// หาเลขแถวของลูกค้าจากรหัส (คืน -1 ถ้าไม่พบ)
function _custFindRow_(sh, id) {
  id = String(id || '').trim().toUpperCase();
  if (!id) return -1;
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0] || '').trim().toUpperCase() === id) return i + 2;
  }
  return -1;
}

// แปลงแถว (array) → object ส่งให้หน้าเว็บ
function _custRowToObj_(row, rowNum) {
  return {
    row: rowNum,
    id:          String(row[0]  || '').trim(),
    dateIn:      String(row[1]  || '').trim(),
    name:        String(row[2]  || '').trim(),
    contact:     String(row[3]  || '').trim(),
    nationality: String(row[4]  || '').trim(),
    budget:      String(row[5]  || '').trim(),
    propType:    String(row[6]  || '').trim(),
    area:        String(row[7]  || '').trim(),
    bedroom:     String(row[8]  || '').trim(),
    bathroom:    String(row[9]  || '').trim(),
    pet:         String(row[10] || '').trim(),
    occupants:   String(row[11] || '').trim(),
    moveIn:      String(row[12] || '').trim(),
    follow1:     String(row[13] || '').trim(),
    follow2:     String(row[14] || '').trim(),
    follow3:     String(row[15] || '').trim(),
    status:      String(row[16] || '').trim(),
    staff:       String(row[17] || '').trim(),
    note:        String(row[18] || '').trim(),
    registrant:  String(row[19] || '').trim(),
    selfSeek:    String(row[20] || '').trim(),
    petDog:      String(row[21] || '').trim(),
    petCat:      String(row[22] || '').trim(),
    petOther:    String(row[23] || '').trim(),
    petOtherNote:String(row[24] || '').trim()
  };
}

// อ่านรายชื่อลูกค้าทั้งหมด (สมาชิกที่ล็อกอินแล้ว) → JSON
//   ซ่อนเบอร์ติดต่อของการ์ดที่ไม่ใช่ของตัวเอง (ยกเว้นแอดมินขึ้นไป) + แนบ flag canEdit/canDelete
function _custList_(params) {
  const auth = _memberAuth_(params);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const adminPlus = _roleRank_(auth.role) >= 2;
  const meUser    = String(auth.user || '').toLowerCase();
  const memberSh  = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));

  const sh = _ensureCustomerSheet_(SpreadsheetApp.openById(SS_ID));
  const last = sh.getLastRow();
  const out = [];
  const memCache = {};   // cache ข้อมูลผู้ลงทะเบียน (ชื่อแสดง + ช่องทางติดต่อ)
  if (last >= 2) {
    const data = sh.getRange(2, 1, last - 1, CUSTOMER_HEADERS.length).getDisplayValues();
    for (let i = 0; i < data.length; i++) {
      const o = _custRowToObj_(data[i], i + 2);
      if (!o.id && !o.name && !o.contact) continue;   // ข้ามแถวว่าง
      const reg     = String(o.registrant || '').toLowerCase();
      const isOwner = !!reg && reg === meUser;
      const canSee  = adminPlus || isOwner || !reg;   // เห็นเบอร์: แอดมิน+/เจ้าของการ์ด/การ์ดเก่าไม่มีผู้ลงทะเบียน
      o.canEdit   = adminPlus || isOwner || !reg;     // สมาชิกแก้ได้เฉพาะของตัวเอง
      o.canDelete = adminPlus || isOwner || !reg;     // สมาชิกลบได้เฉพาะของตัวเอง
      // ข้อมูลผู้ลงทะเบียน (ให้คนอื่นติดต่อผ่านได้)
      if (reg) {
        if (!(reg in memCache)) {
          const m = _findMember_(memberSh, o.registrant);
          memCache[reg] = m ? { name: m.name || m.user, phone: m.contact || '', contact: _memberContactStr_(m) } : { name: o.registrant, phone: '', contact: '' };
        }
        o.registrantName    = memCache[reg].name;
        o.registrantPhone   = memCache[reg].phone;     // เบอร์โทรนายหน้า (สำหรับปุ่มโทร)
        o.registrantContact = memCache[reg].contact;   // ทุกช่องทางรวม (สำหรับคัดลอก)
      } else {
        o.registrantName = ''; o.registrantPhone = ''; o.registrantContact = '';
      }
      if (!canSee) { o.contactHidden = !!o.contact; o.contact = ''; }
      else { o.contactHidden = false; }
      out.push(o);
    }
  }
  return _json({
    ok: true, count: out.length, data: out,
    statuses: CUSTOMER_STATUSES, doneStatuses: ['ได้บ้านแล้ว', 'ยกเลิก'],
    me: { user: auth.user, role: auth.role, name: auth.name, rank: _roleRank_(auth.role) }
  });
}

// เพิ่มลูกค้าใหม่ (สมาชิกที่ล็อกอิน) — ออกรหัส + วันที่ + ผู้ลงทะเบียนให้อัตโนมัติ
function _custAdd_(p) {
  const auth = _memberAuth_(p);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const sh = _ensureCustomerSheet_(SpreadsheetApp.openById(SS_ID));
  const id     = _custNextId_(sh);
  const dateIn = String(p.dateIn || '').trim() || _todayStr();
  const status = (CUSTOMER_STATUSES.indexOf(String(p.status || '').trim()) >= 0) ? String(p.status).trim() : 'กำลังหา';
  const row = [
    id, dateIn,
    String(p.name        || '').trim(),
    String(p.contact     || '').trim(),
    String(p.nationality || '').trim(),
    String(p.budget      || '').trim(),
    String(p.propType    || '').trim(),
    String(p.area        || '').trim(),
    String(p.bedroom     || '').trim(),
    String(p.bathroom    || '').trim(),
    String(p.pet         || '').trim(),
    String(p.occupants   || '').trim(),
    String(p.moveIn      || '').trim(),
    String(p.follow1     || '').trim(),
    String(p.follow2     || '').trim(),
    String(p.follow3     || '').trim(),
    status,
    String(p.staff       || '').trim(),
    String(p.note        || '').trim(),
    auth.user,                      // ★ คอลัมน์ T = ผู้ลงทะเบียน (สมาชิกที่ล็อกอิน)
    _isSelfSeek_(p.selfSeek) ? 'ผู้เช่าหาเอง' : '',   // ★ คอลัมน์ U = ผู้เช่าหาเอง
    String(p.petDog       || '').trim(),   // V = จำนวนน้องหมา
    String(p.petCat       || '').trim(),   // W = จำนวนน้องแมว
    String(p.petOther     || '').trim(),   // X = จำนวนสัตว์อื่นๆ
    String(p.petOtherNote || '').trim()    // Y = ระบุสัตว์อื่นๆ
  ];
  const newRow = sh.getLastRow() + 1;
  sh.getRange(newRow, 1, 1, row.length).setNumberFormat('@').setValues([row]);   // ★ เขียนแบบข้อความ เก็บเลข 0 นำหน้า
  return _json({ ok: true, added: true, id: id, row: newRow, dateIn: dateIn, status: status, registrant: auth.user });
}

// แก้ไขลูกค้า — สมาชิกแก้ได้เฉพาะการ์ดของตัวเอง / แอดมินขึ้นไปแก้ได้ทุกใบ
function _custUpdate_(p) {
  const auth = _memberAuth_(p);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const sh = _ensureCustomerSheet_(SpreadsheetApp.openById(SS_ID));
  const rowNum = _custFindRow_(sh, p.id);
  if (rowNum < 0) return _json({ ok: false, msg: 'id not found: ' + p.id });
  const reg       = String(sh.getRange(rowNum, CUST_COL_REGISTRANT).getValue() || '').trim().toLowerCase();
  const adminPlus = _roleRank_(auth.role) >= 2;
  if (!adminPlus && reg && reg !== String(auth.user).toLowerCase()) {
    return _json({ ok: false, msg: 'forbidden', reason: 'แก้ได้เฉพาะการ์ดของตัวเอง' });
  }
  const changed = [];
  Object.keys(CUST_FIELD_COL).forEach(function(k) {
    if (!Object.prototype.hasOwnProperty.call(p, k)) return;
    let v = String(p[k] == null ? '' : p[k]).trim();
    if (k === 'status' && v && CUSTOMER_STATUSES.indexOf(v) < 0) return;   // กันค่าสถานะแปลกปลอม
    sh.getRange(rowNum, CUST_FIELD_COL[k]).setNumberFormat('@').setValue(v);   // ★ ข้อความ เก็บเลข 0 นำหน้า
    changed.push(k);
  });
  if (Object.prototype.hasOwnProperty.call(p, 'selfSeek')) {   // ★ คอลัมน์ U = ผู้เช่าหาเอง
    sh.getRange(rowNum, CUST_COL_SELFSEEK).setNumberFormat('@').setValue(_isSelfSeek_(p.selfSeek) ? 'ผู้เช่าหาเอง' : '');
    changed.push('selfSeek');
  }
  return _json({ ok: true, updated: true, id: String(p.id).trim(), row: rowNum, changed: changed });
}

// แปลงค่า selfSeek จาก query (1/true/ผู้เช่าหาเอง) → boolean
function _isSelfSeek_(v) {
  const s = String(v == null ? '' : v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'ผู้เช่าหาเอง';
}

// ลบลูกค้า — สมาชิกลบได้เฉพาะการ์ดของตัวเอง / แอดมินขึ้นไปลบได้ทุกใบ
function _custDelete_(p) {
  const auth = _memberAuth_(p);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const sh = _ensureCustomerSheet_(SpreadsheetApp.openById(SS_ID));
  const rowNum = _custFindRow_(sh, p.id);
  if (rowNum < 0) return _json({ ok: false, msg: 'id not found: ' + p.id });
  const reg       = String(sh.getRange(rowNum, CUST_COL_REGISTRANT).getValue() || '').trim().toLowerCase();
  const adminPlus = _roleRank_(auth.role) >= 2;
  if (!adminPlus && reg && reg !== String(auth.user).toLowerCase()) {
    return _json({ ok: false, msg: 'forbidden', reason: 'ลบได้เฉพาะการ์ดของตัวเอง' });
  }
  sh.deleteRow(rowNum);
  return _json({ ok: true, deleted: true, id: String(p.id).trim() });
}

// ════════════════════════════════════════════════════════════
//  MEMBERSHIP — แท็บ "สมาชิก" (ชื่อผู้ใช้ + รหัส + ระดับ) สำหรับหน้าลูกค้า (CRM)
//    เข้าสู่ระบบ : ?action=memberLogin&user=&pass=
//    สมัคร     : ?action=memberSignup&user=&pass=&name=&contact=
//  ★ token=STAFF_PASSWORD (456258) ยังใช้ได้ = เข้าระบบเป็น "ผู้ออกแบบ" (กุญแจหลัก/ทดสอบ)
// ════════════════════════════════════════════════════════════
function _ensureMemberSheet_(ss) {
  ss = ss || SpreadsheetApp.openById(SS_ID);
  let sh = ss.getSheetByName(SHEET_MEMBER);
  if (!sh) {
    sh = ss.insertSheet(SHEET_MEMBER);
    sh.getRange(1, 1, 1, MEMBER_HEADERS.length)
      .setValues([MEMBER_HEADERS])
      .setFontWeight('bold').setBackground('#6b46c1').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    [130, 110, 110, 150, 120, 90, 110, 160, 130, 140, 160].forEach(function(w, i) { sh.setColumnWidth(i + 1, w); });
    try {
      const rule = SpreadsheetApp.newDataValidation().requireValueInList(MEMBER_ROLES, true).build();
      sh.getRange(2, 3, sh.getMaxRows() - 1, 1).setDataValidation(rule);   // คอลัมน์ C = ระดับ
    } catch (e) {}
    sh.getRange(2, 1, sh.getMaxRows() - 1, MEMBER_HEADERS.length).setNumberFormat('@');   // ★ เก็บเลข 0 นำหน้า (เบอร์โทร)
    // seed บัญชีผู้ออกแบบเริ่มต้น — เปลี่ยนรหัสได้ภายหลังในชีต
    sh.appendRow(['owner', '456258', ROLE_DESIGNER, 'เจ้าของระบบ', '', 'ใช้งาน', _todayStr()]);
  }
  return sh;
}

// ★ รันครั้งเดียวจากเมนู 🏠 ลงทะเบียนทรัพย์ → "ตั้งค่าแท็บสมาชิก"
function setupMemberSheet() {
  const sh = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));
  try { SpreadsheetApp.getUi().alert('✅ พร้อมใช้งานแท็บ "' + SHEET_MEMBER + '"\nบัญชีเริ่มต้น: owner / 456258 (ผู้ออกแบบ) — เปลี่ยนรหัสได้ในชีต'); } catch (e) {}
  return sh.getName();
}

function _memberRowToObj_(row, rowNum) {
  return {
    row: rowNum,
    user:     String(row[0]  || '').trim(),
    pass:     String(row[1] == null ? '' : row[1]),
    role:     String(row[2]  || '').trim(),
    name:     String(row[3]  || '').trim(),
    contact:  String(row[4]  || '').trim(),   // เบอร์โทร
    status:   String(row[5]  || '').trim(),
    date:     String(row[6]  || '').trim(),
    facebook: String(row[7]  || '').trim(),
    line:     String(row[8]  || '').trim(),
    whatsapp: String(row[9]  || '').trim(),
    other:    String(row[10] || '').trim()
  };
}

// รวมช่องทางติดต่อทั้งหมดของสมาชิกเป็นข้อความเดียว (โชว์บนการ์ด / หน้าจัดการสมาชิก)
function _memberContactStr_(m) {
  if (!m) return '';
  const parts = [];
  if (m.contact)  parts.push(m.contact);
  if (m.facebook) parts.push('FB: ' + m.facebook);
  if (m.line)     parts.push('LINE: ' + m.line);
  if (m.whatsapp) parts.push('WhatsApp: ' + m.whatsapp);
  if (m.other)    parts.push(m.other);
  return parts.join(' · ');
}

// หาสมาชิกจากชื่อผู้ใช้ (case-insensitive) → object หรือ null
function _findMember_(sh, user) {
  user = String(user || '').trim().toLowerCase();
  if (!user) return null;
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, MEMBER_HEADERS.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][0] || '').trim().toLowerCase() === user) return _memberRowToObj_(vals[i], i + 2);
  }
  return null;
}

// ลำดับสิทธิ์: ผู้ออกแบบ 3 > แอดมิน 2 > สมาชิก 1 > ไม่รู้จัก 0
function _roleRank_(role) {
  if (role === ROLE_DESIGNER) return 3;
  if (role === ROLE_ADMIN)    return 2;
  if (role === ROLE_MEMBER)   return 1;
  return 0;
}

// ตรวจสิทธิ์จาก params → { ok, user, role, name, contact }
//   token=456258 = เข้าเป็นผู้ออกแบบ (กุญแจหลัก) | หรือ user+pass = ตรวจกับแท็บสมาชิก
function _memberAuth_(params) {
  if (params.token && params.token === STAFF_PASSWORD) {
    return { ok: true, user: 'owner', role: ROLE_DESIGNER, name: 'เจ้าของระบบ', contact: '' };
  }
  const user = String(params.user || '').trim();
  const pass = String(params.pass == null ? '' : params.pass);
  if (!user || !pass) return { ok: false };
  const m = _findMember_(_ensureMemberSheet_(SpreadsheetApp.openById(SS_ID)), user);
  if (!m) return { ok: false };
  if (String(m.pass) !== pass) return { ok: false };
  if (m.status && m.status !== 'ใช้งาน') return { ok: false, msg: 'disabled' };
  return { ok: true, user: m.user, role: m.role || ROLE_MEMBER, name: m.name || m.user, contact: m.contact || '' };
}

// เข้าสู่ระบบ (หน้า login) → แยกข้อความ "ไม่มีผู้ใช้" / "รหัสผิด" + ล็อก 1 นาทีเมื่อผิดครบ 5 ครั้ง
function _memberLogin_(params) {
  // กุญแจหลัก (token=456258) — ข้ามการนับ/ล็อก
  if (params.token && params.token === STAFF_PASSWORD) {
    return _json({ ok: true, user: 'owner', role: ROLE_DESIGNER, name: 'เจ้าของระบบ', contact: '', rank: 3 });
  }
  const user = String(params.user || '').trim();
  const pass = String(params.pass == null ? '' : params.pass);
  if (!user || !pass) return _json({ ok: false, code: 'empty', msg: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });

  const sh = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));
  const m = _findMember_(sh, user);
  if (!m) return _json({ ok: false, code: 'no_user', msg: 'ไม่มีชื่อผู้ใช้นี้ในระบบ' });   // ★ ไม่มีผู้ใช้

  const cache   = CacheService.getScriptCache();
  const uKey    = String(user).toLowerCase();
  const lockKey = 'mlock_' + uKey, failKey = 'mfail_' + uKey;
  if (cache.get(lockKey)) return _json({ ok: false, code: 'locked', wait: 60, msg: 'ใส่รหัสผิดเกิน 5 ครั้ง — ถูกล็อก 1 นาที' });
  if (m.status && m.status !== 'ใช้งาน') return _json({ ok: false, code: 'disabled', msg: 'บัญชีนี้ถูกระงับการใช้งาน' });

  if (String(m.pass) !== pass) {                                          // ★ มีผู้ใช้ แต่รหัสผิด
    const n = (parseInt(cache.get(failKey), 10) || 0) + 1;
    if (n >= 5) {
      cache.put(lockKey, '1', 60);     // ล็อก 60 วินาที
      cache.remove(failKey);
      return _json({ ok: false, code: 'locked', wait: 60, msg: 'ใส่รหัสผิดครบ 5 ครั้ง — ถูกล็อก 1 นาที' });
    }
    cache.put(failKey, String(n), 600);
    return _json({ ok: false, code: 'bad_pass', left: (5 - n), msg: 'รหัสผ่านไม่ถูกต้อง' });
  }

  cache.remove(failKey); cache.remove(lockKey);                          // สำเร็จ → ล้างตัวนับ
  return _json({ ok: true, user: m.user, role: m.role || ROLE_MEMBER, name: m.name || m.user, contact: _memberContactStr_(m), rank: _roleRank_(m.role) });
}

// สมัครสมาชิก (หน้า signup) → เพิ่มผู้ใช้ระดับ "สมาชิก" ใช้งานทันที (กันชื่อซ้ำ) + ช่องทางติดต่อหลายช่อง
function _memberSignup_(params) {
  const user = String(params.user || '').trim();
  const pass = String(params.pass == null ? '' : params.pass);
  if (!user || !pass) return _json({ ok: false, msg: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน' });
  if (user.length < 3)  return _json({ ok: false, msg: 'ชื่อผู้ใช้ต้องยาว 3 ตัวอักษรขึ้นไป' });
  const sh = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));
  if (_findMember_(sh, user)) return _json({ ok: false, code: 'taken', msg: 'มีผู้ใช้งานแล้ว กรุณาเลือกชื่ออื่น' });
  const dispName = String(params.name || '').trim();
  if (dispName && _findMemberByName_(sh, dispName)) return _json({ ok: false, code: 'name_taken', msg: 'มีชื่อเล่นนี้แล้ว กรุณาใช้ชื่ออื่น' });
  const mrow = [
    user, pass, ROLE_MEMBER,
    String(params.name     || '').trim(),
    String(params.contact  || '').trim(),   // เบอร์โทร
    'ใช้งาน', _todayStr(),
    String(params.facebook || '').trim(),
    String(params.line     || '').trim(),
    String(params.whatsapp || '').trim(),
    String(params.other    || '').trim()
  ];
  const mNewRow = sh.getLastRow() + 1;
  sh.getRange(mNewRow, 1, 1, mrow.length).setNumberFormat('@').setValues([mrow]);   // ★ เก็บเลข 0 นำหน้า (เบอร์โทร)
  return _json({ ok: true, user: user, role: ROLE_MEMBER, msg: 'สมัครสำเร็จ' });
}

// เช็กชื่อผู้ใช้ว่าซ้ำไหม (ใช้ตอนพิมพ์ในหน้าสมัคร ก่อนกดลงทะเบียน) — ไม่ต้องล็อกอิน
function _memberCheck_(params) {
  const sh = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));
  // โหมดเช็ก "ชื่อเล่น/ชื่อแสดง" — เรียกด้วย ?action=memberCheck&name=...
  const nm = String(params.name || '').trim();
  const usr = String(params.user || '').trim();
  if (nm && !usr) {
    if (nm.length < 2) return _json({ ok: true, available: false, code: 'short', field: 'name' });
    const taken = !!_findMemberByName_(sh, nm);
    return _json({ ok: true, name: nm, available: !taken, code: taken ? 'taken' : 'free', field: 'name' });
  }
  // โหมดเช็ก "ชื่อผู้ใช้" (เดิม)
  if (!usr)             return _json({ ok: true, available: false, code: 'empty', field: 'user' });
  if (usr.length < 3)   return _json({ ok: true, available: false, code: 'short', field: 'user' });
  const exists = !!_findMember_(sh, usr);
  return _json({ ok: true, user: usr, available: !exists, code: exists ? 'taken' : 'free', field: 'user' });
}

// หาสมาชิกจากชื่อเล่น/ชื่อแสดง (คอลัมน์ D, case-insensitive) → object หรือ null
function _findMemberByName_(sh, name) {
  name = String(name || '').trim().toLowerCase();
  if (!name) return null;
  const last = sh.getLastRow();
  if (last < 2) return null;
  const vals = sh.getRange(2, 1, last - 1, MEMBER_HEADERS.length).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (String(vals[i][3] || '').trim().toLowerCase() === name) return _memberRowToObj_(vals[i], i + 2);
  }
  return null;
}

// รายชื่อสมาชิก (แอดมินขึ้นไป) — ไม่ส่งรหัสผ่านออกไป
function _memberList_(params) {
  const auth = _memberAuth_(params);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  if (_roleRank_(auth.role) < 2) return _json({ ok: false, msg: 'forbidden', reason: 'เฉพาะแอดมินขึ้นไป' });
  const sh = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));
  const last = sh.getLastRow();
  const out = [];
  if (last >= 2) {
    const data = sh.getRange(2, 1, last - 1, MEMBER_HEADERS.length).getValues();
    for (let i = 0; i < data.length; i++) {
      const m = _memberRowToObj_(data[i], i + 2);
      if (!m.user) continue;
      out.push({ user: m.user, role: m.role, name: m.name, contact: _memberContactStr_(m), status: m.status, date: m.date, rank: _roleRank_(m.role) });
    }
  }
  return _json({ ok: true, count: out.length, data: out, me: { user: auth.user, role: auth.role, rank: _roleRank_(auth.role) } });
}

// ลบสมาชิก (แอดมินขึ้นไป) — ลบได้เฉพาะระดับต่ำกว่าตัวเอง + ห้ามลบบัญชีตัวเอง
function _memberDelete_(params) {
  const auth = _memberAuth_(params);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const myRank = _roleRank_(auth.role);
  if (myRank < 2) return _json({ ok: false, msg: 'forbidden', reason: 'เฉพาะแอดมินขึ้นไป' });
  const target = String(params.target || '').trim();   // ★ ใช้ชื่อ 'target' กันชนกับ user (= บัญชีที่ล็อกอิน)
  if (!target) return _json({ ok: false, msg: 'no target' });
  if (target.toLowerCase() === String(auth.user).toLowerCase()) return _json({ ok: false, msg: 'forbidden', reason: 'ลบบัญชีตัวเองไม่ได้' });
  const sh = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));
  const m = _findMember_(sh, target);
  if (!m) return _json({ ok: false, msg: 'ไม่พบสมาชิก: ' + target });
  if (_roleRank_(m.role) >= myRank) return _json({ ok: false, msg: 'forbidden', reason: 'ลบได้เฉพาะระดับที่ต่ำกว่าตัวเอง' });
  sh.deleteRow(m.row);
  return _json({ ok: true, deleted: true, user: m.user });
}

// ปรับระดับสมาชิก — เฉพาะ "ผู้ออกแบบ" (OWNER) เท่านั้น + เปลี่ยนระดับตัวเองไม่ได้
function _memberSetRole_(params) {
  const auth = _memberAuth_(params);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  if (_roleRank_(auth.role) < 3) return _json({ ok: false, msg: 'forbidden', reason: 'เฉพาะผู้ออกแบบเท่านั้นที่ปรับระดับได้' });
  const target = String(params.target || '').trim();
  const role   = String(params.role || '').trim();
  if (!target) return _json({ ok: false, msg: 'no target' });
  if (MEMBER_ROLES.indexOf(role) < 0) return _json({ ok: false, msg: 'ระดับไม่ถูกต้อง' });
  if (target.toLowerCase() === String(auth.user).toLowerCase()) return _json({ ok: false, msg: 'forbidden', reason: 'เปลี่ยนระดับบัญชีตัวเองไม่ได้' });
  const sh = _ensureMemberSheet_(SpreadsheetApp.openById(SS_ID));
  const m = _findMember_(sh, target);
  if (!m) return _json({ ok: false, msg: 'ไม่พบสมาชิก: ' + target });
  sh.getRange(m.row, 3).setValue(role);   // คอลัมน์ C = ระดับ
  return _json({ ok: true, user: m.user, role: role });
}

// ════════════════════════════════════════════════════════════
//  CONTRACT (ทำสัญญา) — ติดตามสัญญาเช่า + แจ้งเตือนครบกำหนด
//  login ใช้ระบบสมาชิกเดียวกัน (_memberAuth_) · สมาชิกเห็น/แก้เฉพาะของตัวเอง
//  อ่าน/เขียนโดยอิง "ชื่อหัวคอลัมน์" (หัวอยู่แถว 3) → ทนทานต่อ layout เดิม
// ════════════════════════════════════════════════════════════
const SHEET_CONTRACT = 'ทำสัญญา';
const CONTRACT_HEADER_ROW = 3;        // หัวตารางอยู่แถว 3 (ตามชีตเดิม) ข้อมูลเริ่มแถว 4
const FOLDER_RENTED = '1NhuCXpCcUEGk-4h8JXadJ64szssipcy7';   // Drive folder "0-2บ้านที่ปล่อยเช่าแล้ว" — รูปบ้านที่ปล่อยเช่าแล้ว (โฟลเดอร์ย่อยตั้งชื่อตามรหัส + แชร์รูปเป็นสาธารณะ)
const RENTED_PHOTO_CACHE_KEY = 'rented_photoMap_v1';
// [key, ชื่อหัวคอลัมน์]
const CONTRACT_FIELDS = [
  ['registrant', 'ผู้ลงทะเบียน'], ['status', 'สถานะสัญญา'], ['code', 'รหัส'], ['project', 'โครงการ'],
  ['type', 'ประเภท'], ['startDate', 'วันที่เริ่มสัญญา'], ['renewDate', 'แจ้งต่อสัญญา'], ['endDate', 'วันที่หมดสัญญา'],
  ['duration', 'ระยะเวลาสัญญา'], ['payDay', 'จ่ายทุกวันที่'], ['rent', 'ค่าเช่า'],
  ['tenantName', 'ชื่อผู้เช่า'], ['tenantTel', 'เบอร์ติดต่อคนเช่า'], ['ownerTel', 'เบอร์ติดต่อเจ้าของบ้าน'],
  ['coAgent', 'Co-Agent'], ['place', 'สถานที่'], ['geo', 'พิกัด'], ['deposit', 'เงินประกัน'], ['contractFile', 'ลิงก์ไฟล์สัญญา'],
  ['paidThru', 'ชำระล่าสุด']   // ★ วันที่กด"ชำระค่าเช่าแล้ว" ล่าสุด (คุมการเตือน/ค้างจ่าย)
];
const TH_MON_MAP = { 'ม.ค.':1,'ก.พ.':2,'มี.ค.':3,'เม.ย.':4,'พ.ค.':5,'มิ.ย.':6,'ก.ค.':7,'ส.ค.':8,'ก.ย.':9,'ต.ค.':10,'พ.ย.':11,'ธ.ค.':12 };

// แปลงค่าเซลล์ → Date (รองรับ Date จริง / yyyy-mm-dd / dd/mm/yyyy / "30 พ.ย. 24")
function _toDateAny_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const s = String(v == null ? '' : v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; if (y > 2400) y -= 543; return new Date(y, +m[2] - 1, +m[1]); }
  m = s.match(/^(\d{1,2})\s*([ก-๙\.]+)\s*(\d{2,4})$/);
  if (m && TH_MON_MAP[m[2]]) { let y = +m[3]; if (y < 100) y += 2000; if (y > 2400) y -= 543; return new Date(y, TH_MON_MAP[m[2]] - 1, +m[1]); }
  return null;
}

// หา index คอลัมน์ (0-based) ตามชื่อหัว — คืน { map, hdr }
function _contractColMap_(sh) {
  const lastCol = Math.max(sh.getLastColumn(), 1);
  const hdr = sh.getRange(CONTRACT_HEADER_ROW, 1, 1, lastCol).getValues()[0].map(function(h){ return String(h == null ? '' : h).trim(); });
  const map = {};
  CONTRACT_FIELDS.forEach(function(f) {
    let idx = hdr.indexOf(f[1]);
    if (idx < 0) idx = hdr.findIndex(function(h){ return h && (h.indexOf(f[1]) >= 0 || f[1].indexOf(h) >= 0); });
    map[f[0]] = idx;
  });
  return { map: map, hdr: hdr };
}

// ★ เมนู: ตั้งค่าแท็บสัญญา — เติมหัวคอลัมน์ที่ขาด (ไม่ลบของเดิม)
function setupContractSheet() {
  const ss = SpreadsheetApp.openById(SS_ID);
  let sh = ss.getSheetByName(SHEET_CONTRACT);
  if (!sh) { sh = ss.insertSheet(SHEET_CONTRACT); }
  const info = _contractColMap_(sh);
  let nextCol = info.hdr.length;
  while (nextCol > 0 && !info.hdr[nextCol - 1]) nextCol--;   // ตัดหัวว่างท้ายๆ
  CONTRACT_FIELDS.forEach(function(f) {
    if (info.map[f[0]] == null || info.map[f[0]] < 0) {
      nextCol++;
      sh.getRange(CONTRACT_HEADER_ROW, nextCol).setValue(f[1]).setFontWeight('bold');
    }
  });
  try { SpreadsheetApp.getUi().alert('✅ ตั้งค่าแท็บ "' + SHEET_CONTRACT + '" แล้ว (เติมหัวคอลัมน์ที่ขาด)'); } catch (e) {}
  return sh.getName();
}

// อ่านสัญญาทั้งหมด (raw)
function _contractRead_(sh, cmap) {
  const start = CONTRACT_HEADER_ROW + 1;
  const last = sh.getLastRow();
  if (last < start) return [];
  const lastCol = sh.getLastColumn();
  const vals = sh.getRange(start, 1, last - start + 1, lastCol).getValues();
  const disp = sh.getRange(start, 1, last - start + 1, lastCol).getDisplayValues();
  const out = [];
  for (let i = 0; i < vals.length; i++) {
    if (!vals[i].some(function(v){ return v !== '' && v !== null; })) continue;
    const g  = function(k){ const idx = cmap[k]; return (idx == null || idx < 0) ? '' : vals[i][idx]; };
    const gd = function(k){ const idx = cmap[k]; return (idx == null || idx < 0) ? '' : String(disp[i][idx] || '').trim(); };
    out.push({
      row: start + i,
      registrant: gd('registrant'), statusRaw: gd('status'), code: gd('code'), project: gd('project'),
      type: gd('type'), duration: gd('duration'), place: gd('place'), tenantName: gd('tenantName'),
      tenantTel: gd('tenantTel'), ownerTel: gd('ownerTel'), coAgent: gd('coAgent'), geo: gd('geo'),
      deposit: gd('deposit'), contractFile: gd('contractFile'),
      startDisp: gd('startDate'), renewDisp: gd('renewDate'), endDisp: gd('endDate'),
      payDayRaw: g('payDay'), rentRaw: g('rent'), startRaw: g('startDate'), renewRaw: g('renewDate'), endRaw: g('endDate'),
      paidThruRaw: g('paidThru')
    });
  }
  return out;
}

// คืน "รอบค่าเช่าที่ยังไม่ได้เก็บ" ที่ใกล้สุด (Date) — รองรับจ่ายก่อนถึงวันจ่าย; null = เก็บครบแล้ว/ไม่มี payDay/หลังหมดสัญญา
function _collectCycle_(payDay, paid, today, end) {
  if (payDay == null || isNaN(payDay)) return null;
  const dOnly = function(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const clamp = function(y, m){ return Math.min(payDay, new Date(y, m + 1, 0).getDate()); };   // กันวันจ่าย 31 ในเดือนสั้น
  let y = today.getFullYear(), mo = today.getMonth();
  let mostRecent = new Date(y, mo, clamp(y, mo));
  if (mostRecent > today) { let m2 = mo - 1, y2 = y; if (m2 < 0) { m2 = 11; y2--; } mostRecent = new Date(y2, m2, clamp(y2, m2)); }
  let mn = mostRecent.getMonth() + 1, yn = mostRecent.getFullYear(); if (mn > 11) { mn = 0; yn++; }
  const next = new Date(yn, mn, clamp(yn, mn));   // วันจ่ายรอบถัดไป (สำหรับจ่ายล่วงหน้า)
  const paidT = paid ? dOnly(paid) : null;
  const endT  = end ? dOnly(end) : null;
  const ok = function(d){ return (!paidT || d > paidT) && (!endT || d < endT); };   // ยังไม่จ่าย + ก่อนวันหมดสัญญา
  if (ok(mostRecent)) return mostRecent;   // มีรอบค้าง/ถึงกำหนดแล้ว
  if (ok(next)) return next;               // จ่ายล่วงหน้ารอบถัดไป
  return null;
}

// คำนวณสถานะ + flag แจ้งเตือน
function _contractEnrich_(o) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dOnly = function(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
  const start = _toDateAny_(o.startRaw), end = _toDateAny_(o.endRaw), renew = _toDateAny_(o.renewRaw);
  const paid = _toDateAny_(o.paidThruRaw);
  const dd = function(d){ if (!d) return null; return Math.round((dOnly(d) - today) / 86400000); };
  const dEnd = dd(end), dRenew = dd(renew);
  const inactive = /หมด|ยกเลิก|คืนห้อง|ย้ายออก|ออกแล้ว|ต่อแล้ว/.test(o.statusRaw || '');
  const ended = (dEnd !== null && dEnd < 0);
  const payDay = (o.payDayRaw === '' || o.payDayRaw == null) ? null : parseInt(o.payDayRaw, 10);
  o.payDay = payDay;

  // ── รอบค่าเช่าที่ยังไม่ได้เก็บ (รองรับจ่ายล่วงหน้า) ──
  const collect = _collectCycle_(payDay, paid, today, end);
  o.collectCycleISO = collect ? Utilities.formatDate(collect, TZ, 'yyyy-MM-dd') : '';
  o.canCollect = !!collect && !inactive && !ended;          // ยังมีรอบค้างเก็บ → โชว์ปุ่ม "รอชำระ" ได้แม้ยังไม่ถึงวันจ่าย
  o.dueToday   = o.canCollect && collect <= today;           // ★ ถึงกำหนด/ค้างจ่าย → ขึ้นแจ้งเตือน (#4 ค้างจ่ายเตือนต่อทุกวัน)
  o.daysOverdue = (o.dueToday && collect) ? Math.round((today - collect) / 86400000) : 0;
  o.paidThisCycle = !o.canCollect;

  o.renewDue = dRenew !== null && dRenew <= 0 && !ended && !inactive;   // ★ เตือน "ตั้งแต่" วันแจ้งต่อเป็นต้นไป (ไม่เตือนล่วงหน้า)
  o.expiring = dEnd !== null && dEnd >= 0 && dEnd <= 30 && !inactive;
  o.daysToEnd = dEnd; o.daysToRenew = dRenew; o.ended = ended; o.inactive = inactive;
  o.rent = (o.rentRaw === '' || o.rentRaw == null) ? '' : String(o.rentRaw).replace(/[^\d.]/g, '');
  o.startISO = start ? Utilities.formatDate(start, TZ, 'yyyy-MM-dd') : '';
  o.renewISO = renew ? Utilities.formatDate(renew, TZ, 'yyyy-MM-dd') : '';
  o.endISO   = end   ? Utilities.formatDate(end, TZ, 'yyyy-MM-dd') : '';
  o.paidThruISO = paid ? Utilities.formatDate(paid, TZ, 'yyyy-MM-dd') : '';
  let status = o.statusRaw;
  if (!status) status = ended ? 'หมดอายุ' : (o.expiring ? 'ใกล้หมด' : (o.renewDue ? 'ใกล้ต่อ' : 'ปกติ'));
  o.status = status;
  return o;
}

// แผนที่รูป "บ้านที่ปล่อยเช่าแล้ว" → { CODE: {thumb,folderId} }
function _buildRentedPhotoMap_() {
  if (!FOLDER_RENTED) return {};
  const cache = CacheService.getScriptCache();
  const c = cache.get(RENTED_PHOTO_CACHE_KEY);
  if (c) { try { return JSON.parse(c); } catch (e) {} }
  const map = {};
  try {
    if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.list) {
      let pageToken = null;
      do {
        const resp = Drive.Files.list({
          q: "'" + FOLDER_RENTED + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: 'nextPageToken, files(id,name)', pageSize: 1000, pageToken: pageToken
        });
        (resp.files || []).forEach(function(f) {
          const m = String(f.name || '').trim().match(FOLDER_CODE_REGEX);
          if (!m) return;
          const code = m[1].toUpperCase();
          var thumb = '';
          try {
            const im = Drive.Files.list({ q: "'" + f.id + "' in parents and mimeType contains 'image/' and trashed=false", fields: 'files(id,name)', pageSize: 1, orderBy: 'name' });
            if (im.files && im.files[0]) thumb = im.files[0].id;
          } catch (e) {}
          map[code] = { thumb: thumb, folderId: f.id };
        });
        pageToken = resp.nextPageToken;
      } while (pageToken);
    }
  } catch (e) { Logger.log('rented photo map err: ' + e); }
  if (!Object.keys(map).length) { try { _rentedPhotoMapSlow_(map); } catch (e) { Logger.log('rented slow err: ' + e); } }   // fallback: DriveApp (เผื่อไม่ได้เปิด Drive Advanced Service)
  try { const j = JSON.stringify(map); if (j.length < 100000) cache.put(RENTED_PHOTO_CACHE_KEY, j, 21600); } catch (e) {}
  return map;
}
// fallback อ่านรูปบ้านปล่อยเช่าด้วย DriveApp (ช้ากว่า แต่ไม่ต้องเปิด Advanced Service)
function _rentedPhotoMapSlow_(map) {
  const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
  const DEADLINE = Date.now() + 25000;
  const subs = DriveApp.getFolderById(FOLDER_RENTED).getFolders();
  while (subs.hasNext()) {
    if (Date.now() > DEADLINE) { Logger.log('⏱️ rented slow timeout'); break; }
    const sub = subs.next();
    const m = sub.getName().trim().match(FOLDER_CODE_REGEX);
    if (!m) continue;
    const code = m[1].toUpperCase();
    const imgs = [];
    const files = sub.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (IMAGE_MIME.indexOf(f.getMimeType()) === -1) continue;
      imgs.push({ id: f.getId(), name: f.getName() });
    }
    var thumb = '';
    if (imgs.length) { imgs.sort(function(a, b){ return a.name.localeCompare(b.name, 'th', { numeric: true }); }); thumb = imgs[0].id; }
    map[code] = { thumb: thumb, folderId: sub.getId() };
  }
}
function _clearRentedPhotoCache_() { try { CacheService.getScriptCache().remove(RENTED_PHOTO_CACHE_KEY); } catch (e) {} }

// ★ เมนู: แชร์รูปในโฟลเดอร์ "บ้านปล่อยเช่าแล้ว" เป็นสาธารณะ (Anyone with link) — รูปถึงจะขึ้นบนการ์ด
function makeRentedPhotosPublic() {
  if (!FOLDER_RENTED) { try { SpreadsheetApp.getUi().alert('ยังไม่ได้ตั้ง FOLDER_RENTED'); } catch (e) {} return; }
  const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
  const DEADLINE = Date.now() + 5 * 60 * 1000;
  let shared = 0, total = 0, timedOut = false;
  try {
    const subs = DriveApp.getFolderById(FOLDER_RENTED).getFolders();
    while (subs.hasNext()) {
      if (Date.now() > DEADLINE) { timedOut = true; break; }
      const files = subs.next().getFiles();
      while (files.hasNext()) {
        const f = files.next();
        if (IMAGE_MIME.indexOf(f.getMimeType()) === -1) continue;
        total++;
        try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); shared++; } catch (e) {}
      }
    }
  } catch (e) { Logger.log('makeRentedPhotosPublic err: ' + e); }
  _clearRentedPhotoCache_();
  Logger.log('✅ แชร์รูปบ้านปล่อยเช่า: ' + shared + '/' + total + (timedOut ? ' (หมดเวลา — รันซ้ำอีกครั้ง)' : ''));
  try { SpreadsheetApp.getUi().alert((timedOut ? '⏱️ ยังไม่ครบ รันซ้ำอีกครั้ง\n' : '✅ เสร็จแล้ว\n') + 'แชร์รูปสาธารณะ ' + shared + '/' + total); } catch (e) {}
}

// ── API: รายการสัญญา (สมาชิกเห็นเฉพาะของตัวเอง / แอดมิน+ เห็นหมด) ──
function _contractList_(params) {
  const auth = _memberAuth_(params);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const adminPlus = _roleRank_(auth.role) >= 2;
  const meUser = String(auth.user || '').toLowerCase();
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SHEET_CONTRACT);
  const me = { user: auth.user, role: auth.role, name: auth.name, rank: _roleRank_(auth.role) };
  if (!sh) return _json({ ok: true, count: 0, data: [], me: me, msg: 'no sheet — รัน setupContractSheet' });
  const info = _contractColMap_(sh);
  const recs = _contractRead_(sh, info.map);
  const photoMap = _buildRentedPhotoMap_();
  const catMap = (FOLDER_RENTED ? null : {});   // (ไม่มี fallback ถ้าไม่ตั้งโฟลเดอร์)
  const out = [];
  recs.forEach(function(o) {
    const reg = String(o.registrant || '').toLowerCase();
    const mine = !!reg && reg === meUser;
    if (!adminPlus && !mine) return;            // ★ สมาชิกเห็นเฉพาะของตัวเอง
    _contractEnrich_(o);
    o.canEdit = adminPlus || mine;
    o.canDelete = adminPlus || mine;
    o.mine = mine;
    const pe = photoMap[String(o.code || '').toUpperCase()];
    o.thumb = pe ? (pe.thumb || '') : '';
    out.push(o);
  });
  return _json({ ok: true, count: out.length, data: out, me: me, today: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd') });
}

function _contractWriteRow_(sh, info, row, p, opts) {
  opts = opts || {};
  const lastCol = Math.max(sh.getLastColumn(), info.hdr.length);
  const arr = (opts.fresh) ? new Array(lastCol).fill('') : sh.getRange(row, 1, 1, lastCol).getValues()[0];
  const KEYS = ['status','code','project','type','startDate','renewDate','endDate','duration','payDay','rent','tenantName','tenantTel','ownerTel','coAgent','place','geo','deposit','contractFile'];
  KEYS.forEach(function(k) {
    if (!opts.fresh && !Object.prototype.hasOwnProperty.call(p, k)) return;
    const idx = info.map[k]; if (idx == null || idx < 0) return;
    let v = p[k];
    if (k === 'startDate' || k === 'renewDate' || k === 'endDate') v = _toDateAny_(v) || String(v == null ? '' : v).trim();
    else if (k === 'payDay') v = (v === '' || v == null) ? '' : parseInt(v, 10);
    else if (k === 'rent')   v = (v === '' || v == null) ? '' : String(v).replace(/,/g, '');
    else v = String(v == null ? '' : v).trim();
    arr[idx] = v;
  });
  if (opts.registrant != null && info.map['registrant'] >= 0) arr[info.map['registrant']] = opts.registrant;
  sh.getRange(row, 1, 1, arr.length).setValues([arr]);
}

function _contractAdd_(p) {
  const auth = _memberAuth_(p);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const lock = LockService.getScriptLock();
  try {
    try { lock.waitLock(8000); } catch (e) {}
    const ss = SpreadsheetApp.openById(SS_ID);
    let sh = ss.getSheetByName(SHEET_CONTRACT);
    if (!sh) { setupContractSheet(); sh = ss.getSheetByName(SHEET_CONTRACT); }
    const info = _contractColMap_(sh);
    const newRow = Math.max(sh.getLastRow() + 1, CONTRACT_HEADER_ROW + 1);
    _contractWriteRow_(sh, info, newRow, p, { fresh: true, registrant: auth.user });
    return _json({ ok: true, added: true, row: newRow, registrant: auth.user });
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

function _contractUpdate_(p) {
  const auth = _memberAuth_(p);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const row = parseInt(p.row, 10);
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SHEET_CONTRACT);
  if (!sh || !row || row < CONTRACT_HEADER_ROW + 1) return _json({ ok: false, msg: 'bad row' });
  const info = _contractColMap_(sh);
  const adminPlus = _roleRank_(auth.role) >= 2;
  const regIdx = info.map['registrant'];
  const cur = sh.getRange(row, 1, 1, Math.max(sh.getLastColumn(), info.hdr.length)).getValues()[0];
  const reg = String((regIdx >= 0 ? cur[regIdx] : '') || '').trim().toLowerCase();
  if (!adminPlus && reg && reg !== String(auth.user).toLowerCase()) return _json({ ok: false, msg: 'forbidden', reason: 'แก้ได้เฉพาะของตัวเอง' });
  _contractWriteRow_(sh, info, row, p, {});
  return _json({ ok: true, updated: true, row: row });
}

function _contractDelete_(p) {
  const auth = _memberAuth_(p);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const row = parseInt(p.row, 10);
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SHEET_CONTRACT);
  if (!sh || !row || row < CONTRACT_HEADER_ROW + 1) return _json({ ok: false, msg: 'bad row' });
  const info = _contractColMap_(sh);
  const adminPlus = _roleRank_(auth.role) >= 2;
  const regIdx = info.map['registrant'];
  const cur = sh.getRange(row, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  const reg = String((regIdx >= 0 ? cur[regIdx] : '') || '').trim().toLowerCase();
  if (!adminPlus && reg && reg !== String(auth.user).toLowerCase()) return _json({ ok: false, msg: 'forbidden' });
  sh.getRange(row, 1, 1, sh.getLastColumn()).clearContent();
  return _json({ ok: true, deleted: true, row: row });
}

// ── API: กด "ชำระค่าเช่าแล้ว" → บันทึกวันที่ชำระล่าสุด (หรือ unpay=1 เพื่อยกเลิก) ──
function _contractMarkPaid_(p) {
  const auth = _memberAuth_(p);
  if (!auth.ok) return _json({ ok: false, msg: 'unauthorized' });
  const row = parseInt(p.row, 10);
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SHEET_CONTRACT);
  if (!sh || !row || row < CONTRACT_HEADER_ROW + 1) return _json({ ok: false, msg: 'bad row' });
  let info = _contractColMap_(sh);
  const adminPlus = _roleRank_(auth.role) >= 2;
  const regIdx = info.map['registrant'];
  const cur = sh.getRange(row, 1, 1, Math.max(sh.getLastColumn(), info.hdr.length)).getValues()[0];
  const reg = String((regIdx >= 0 ? cur[regIdx] : '') || '').trim().toLowerCase();
  if (!adminPlus && reg && reg !== String(auth.user).toLowerCase()) return _json({ ok: false, msg: 'forbidden', reason: 'ทำได้เฉพาะของตัวเอง' });
  // ถ้ายังไม่มีคอลัมน์ "ชำระล่าสุด" → เติมหัวให้อัตโนมัติ
  let idx = info.map['paidThru'];
  if (idx == null || idx < 0) {
    let nextCol = info.hdr.length; while (nextCol > 0 && !info.hdr[nextCol - 1]) nextCol--;
    nextCol++;
    sh.getRange(CONTRACT_HEADER_ROW, nextCol).setValue('ชำระล่าสุด').setFontWeight('bold');
    idx = nextCol - 1;
  }
  let val;
  if (String(p.unpay) === '1') { val = ''; }
  else {
    // ตั้ง paidThru = วันจ่ายของ "รอบที่กำลังเก็บ" (รองรับจ่ายล่วงหน้า: ถ้ายังไม่ถึงวันจ่าย ใช้วันจ่ายรอบนั้น)
    const gi = function(k){ const i = info.map[k]; return (i == null || i < 0) ? '' : cur[i]; };
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const pd = parseInt(gi('payDay'), 10);
    const collect = _collectCycle_(isNaN(pd) ? null : pd, _toDateAny_(gi('paidThru')), today0, _toDateAny_(gi('endDate')));
    val = Utilities.formatDate(collect || today0, TZ, 'yyyy-MM-dd');
  }
  sh.getRange(row, idx + 1).setValue(val);
  return _json({ ok: true, row: row, paidThru: val });
}

// ════════════════════════════════════════════════════════════
//  TELEGRAM — แจ้งเตือนสัญญาประจำวัน (ส่งทุกเช้าผ่าน time-driven trigger)
//  ★ ตั้งค่า token/chat id ใน Project Settings → Script Properties:
//      TELEGRAM_BOT_TOKEN = 123456:ABC-DEF...   (ขอจาก @BotFather)
//      TELEGRAM_CHAT_ID   = 123456789           (ของตัวเอง) หรือ -100xxxx (กลุ่ม)
// ════════════════════════════════════════════════════════════
function _tgConfig_() {
  const p = PropertiesService.getScriptProperties();
  return { token: (p.getProperty('TELEGRAM_BOT_TOKEN') || '').trim(), chatId: (p.getProperty('TELEGRAM_CHAT_ID') || '').trim() };
}
function _htmlEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function _isoToTh_(iso) { const m = String(iso || '').split('-'); return (m.length === 3) ? ((+m[2]) + '/' + (+m[1]) + '/' + ((+m[0]) + 543)) : String(iso || ''); }

function _tgSend_(text) {
  const cfg = _tgConfig_();
  if (!cfg.token || !cfg.chatId) { Logger.log('⚠️ Telegram ยังไม่ได้ตั้งค่า (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)'); return false; }
  try {
    const resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/sendMessage', {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify({ chat_id: cfg.chatId, text: text, parse_mode: 'HTML', disable_web_page_preview: true }),
      muteHttpExceptions: true
    });
    const ok = resp.getResponseCode() === 200;
    if (!ok) Logger.log('tg send fail: ' + resp.getContentText());
    return ok;
  } catch (e) { Logger.log('tg send err: ' + e); return false; }
}

// เตือนสัญญาใกล้หมด/แจ้งต่อ: สัปดาห์สุดท้ายเตือนทุกวัน + heads-up ที่ 15 และ 30 วัน
function _alertWindow_(days) { return days != null && days >= 0 && (days <= 7 || days === 15 || days === 30); }

// สร้างข้อความสรุปสัญญาที่ต้องสนใจ "วันนี้" (คืน '' ถ้าไม่มีรายการ)
function _buildDailyReminderMsg_() {
  const ss = SpreadsheetApp.openById(SS_ID);
  const sh = ss.getSheetByName(SHEET_CONTRACT);
  if (!sh) return '';
  const info = _contractColMap_(sh);
  const recs = _contractRead_(sh, info.map);
  const due = [], exp = [], renew = [];
  recs.forEach(function(o) {
    _contractEnrich_(o);
    const name = _htmlEsc_(o.project || o.code || '-');
    if (o.dueToday) {
      const od = o.daysOverdue || 0;
      const rent = o.rent ? Number(o.rent).toLocaleString('en-US') : '-';
      due.push('• ' + name + ' — ฿' + rent + (od > 0 ? ' ⏰ เลยกำหนด ' + od + ' วัน' : ' (วันนี้)') + (o.tenantTel ? ' 📞 ' + _htmlEsc_(o.tenantTel) : ''));
    }
    if (o.expiring && _alertWindow_(o.daysToEnd)) exp.push('• ' + name + ' — ' + (o.daysToEnd === 0 ? 'หมดวันนี้' : 'หมดใน ' + o.daysToEnd + ' วัน') + ' (' + _isoToTh_(o.endISO) + ')');
    if (o.renewDue) renew.push('• ' + name + ' — ' + (o.daysToRenew === 0 ? 'แจ้งต่อวันนี้' : (o.daysToRenew < 0 ? 'เลยกำหนดแจ้งต่อ ' + (-o.daysToRenew) + ' วัน' : 'แจ้งต่อใน ' + o.daysToRenew + ' วัน')) + ' (' + _isoToTh_(o.renewISO) + ')');
  });
  if (!due.length && !exp.length && !renew.length) return '';
  let msg = '🔔 <b>แจ้งเตือนสัญญา</b> — ' + _isoToTh_(Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')) + '\n';
  if (due.length)   msg += '\n💰 <b>เก็บค่าเช่า</b> (' + due.length + ')\n' + due.join('\n') + '\n';
  if (exp.length)   msg += '\n⏳ <b>สัญญาใกล้หมด</b>\n' + exp.join('\n') + '\n';
  if (renew.length) msg += '\n🔁 <b>ต้องแจ้งต่อสัญญา</b>\n' + renew.join('\n') + '\n';
  return msg;
}

// ★ ฟังก์ชันที่ trigger เรียกทุกเช้า — ไม่มีรายการ = ไม่ส่ง (กันสแปม)
function sendDailyContractReminders() {
  const msg = _buildDailyReminderMsg_();
  if (!msg) { Logger.log('ไม่มีรายการสัญญาวันนี้ — ไม่ส่ง'); return; }
  _tgSend_(msg);
}

// ★ เมนู: ทดสอบส่งทันที (ถ้าไม่มีรายการก็ส่งข้อความยืนยันว่าระบบพร้อม)
function testTelegramNow() {
  const cfg = _tgConfig_();
  if (!cfg.token || !cfg.chatId) {
    try { SpreadsheetApp.getUi().alert('❌ ยังไม่ได้ตั้งค่า\nไปที่ Project Settings → Script Properties แล้วใส่\nTELEGRAM_BOT_TOKEN และ TELEGRAM_CHAT_ID'); } catch (e) {}
    return;
  }
  const msg = _buildDailyReminderMsg_() || '🔔 ทดสอบ — ระบบแจ้งเตือน Telegram พร้อมใช้งาน (วันนี้ไม่มีรายการสัญญา)';
  const ok = _tgSend_(msg);
  try { SpreadsheetApp.getUi().alert(ok ? '✅ ส่งทดสอบไป Telegram แล้ว' : '❌ ส่งไม่สำเร็จ — เช็ก token / chat id (ดู Log)'); } catch (e) {}
}

// ★ เมนู: ตั้ง trigger ส่งทุกเช้า 08:00 (ลบของเดิมก่อนกันซ้ำ)
function setupDailyReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { if (t.getHandlerFunction() === 'sendDailyContractReminders') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('sendDailyContractReminders').timeBased().everyDays(1).atHour(8).inTimezone(TZ).create();
  try { SpreadsheetApp.getUi().alert('✅ เปิดแจ้งเตือน Telegram รายวันแล้ว — ส่งทุกเช้า 08:00 น.'); } catch (e) {}
}

// ★ เมนู: ดู chat id — ส่งข้อความหาบอท (หรือเพิ่มบอทเข้ากลุ่ม) ก่อน แล้วรันอันนี้ → อ่าน id จาก Log
function tgGetChatId() {
  const cfg = _tgConfig_();
  if (!cfg.token) { try { SpreadsheetApp.getUi().alert('ใส่ TELEGRAM_BOT_TOKEN ใน Script Properties ก่อน'); } catch (e) {} return; }
  const resp = UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.token + '/getUpdates', { muteHttpExceptions: true });
  const txt = resp.getContentText();
  Logger.log(txt);
  const ids = [];
  (txt.match(/"chat":\{"id":(-?\d+)/g) || []).forEach(function(s) { const m = s.match(/(-?\d+)/); if (m && ids.indexOf(m[1]) < 0) ids.push(m[1]); });
  try { SpreadsheetApp.getUi().alert(ids.length ? ('chat id ที่พบ:\n' + ids.join('\n') + '\n\nเอาไปใส่ TELEGRAM_CHAT_ID') : 'ยังไม่พบ — ส่งข้อความหาบอท (หรือเพิ่มบอทเข้ากลุ่ม) ก่อน แล้วรันใหม่'); } catch (e) {}
}

function doGet(e) {
  try {
    const params  = (e && e.parameter) || {};
    // ★ FIX Bug1: ประกาศ isStaff ก่อนใช้งาน
    const isStaff = (params.token === STAFF_PASSWORD);

    // ★ ดึงเนื้อหา caption {รหัส}-1.txt (staff เท่านั้น) — ใช้เสนอลูกค้า
    if (params.type === 'sale' && params.action === 'caption') return getSaleCaption_(params);
    if (params.action === 'caption') return getCaption_(params);

    // ★ ลบคำว่า "สวย" ใน col U (staff) — หน้า "ตารางโพสทรัพย์" กดปุ่ม 🗑️ บนการ์ด
    if (params.action === 'hideSchedule') return _hideFromSchedule_(params);

    // ★ บันทึกวันโพสวันนี้ลง col S (staff) — หน้า "ตารางโพสทรัพย์" กดปุ่ม ✅ โพสแล้ว
    if (params.action === 'markPosted')   return _markPosted_(params);

    // ★ ฐานข้อมูลลูกค้าหาเช่า (staff) — หน้าเว็บ "ฐานข้อมูลลูกค้า"
    if (params.action === 'custList')     return _custList_(params);
    if (params.action === 'custAdd')      return _custAdd_(params);
    if (params.action === 'custUpdate')   return _custUpdate_(params);
    if (params.action === 'custDelete')   return _custDelete_(params);

    // ★ ระบบสมาชิก (หน้าลูกค้า CRM) — ล็อกอิน / สมัครสมาชิก / จัดการสมาชิก (แอดมิน+)
    if (params.action === 'memberLogin')  return _memberLogin_(params);
    if (params.action === 'memberSignup') return _memberSignup_(params);
    if (params.action === 'memberCheck')  return _memberCheck_(params);
    if (params.action === 'memberList')   return _memberList_(params);
    if (params.action === 'memberDelete') return _memberDelete_(params);
    if (params.action === 'memberSetRole') return _memberSetRole_(params);

    // ★ ระบบสัญญา (ทำสัญญา) — แจ้งเตือนครบกำหนด (login สมาชิกเดียวกัน)
    if (params.action === 'contractList')   return _contractList_(params);
    if (params.action === 'contractAdd')     return _contractAdd_(params);
    if (params.action === 'contractUpdate')  return _contractUpdate_(params);
    if (params.action === 'contractDelete')  return _contractDelete_(params);
    if (params.action === 'contractMarkPaid') return _contractMarkPaid_(params);

    // ★ route ฝั่งขาย
    if (params.type === 'sale') {
      return doGetSale(e);
    }

    if (params.format === 'csv')     return _rentSheetAsCSV_();
    if (params.format === 'folders') return _foldersAsJSON_();
    if (params.refresh === '1') {
      try { clearPhotoCache(); } catch (err) {}
    }

    const ss    = SpreadsheetApp.openById(SS_ID);
    const rentedMap = params.action === 'rentedMap';
    const sheet = ss.getSheetByName(rentedMap ? RENT_ACTION_SHEET : SHEET_LIST);
    if (!sheet) {
      return _json({ ok: false, msg: 'ไม่พบ Sheet: "' + SHEET_LIST + '"' });
    }

    const photoMap = rentedMap ? buildPhotoMap(RENT_ACTION_DESTINATION) : buildPhotoMap();
    const data     = sheet.getDataRange().getValues();
    const result   = [];
    const roomHeaders = (data[0] || []).map(function(value) { return String(value || '').replace(/\s/g, ''); });
    const maidRoomColumn = roomHeaders.indexOf('ห้องแม่บ้าน');
    const downstairsBedroomColumn = roomHeaders.indexOf('ห้องนอนชั้นล่าง');
    const fbMap    = isStaff ? getUploadFbMap_(ss) : {};   // ★ ลิงก์ FB ต่อรหัส (staff เท่านั้น)

    const today    = new Date();
    const todayY   = parseInt(Utilities.formatDate(today, TZ, 'yyyy'), 10);
    const todayKey = parseInt(Utilities.formatDate(today, TZ, 'yyyyMMdd'), 10);

    for (let i = 1; i < data.length; i++) {
      const row  = data[i];
      const code = String(row[1] || '').trim();
      const colA     = String(row[0] || '').trim();
      const isCo     = (colA.toLowerCase() === 'co');
      const isSurvey = (colA.toLowerCase() === 'survey');   // ★ survey อ่านจากคอลัมน์ A เหมือน co
      // ★ ถ้าคอลัมน์ A = "co" → รับทุกรหัส (เช่น CORENT00028); อื่นๆ ต้องตรงฟอร์แมต RXX####
      if (!code) continue;
      if (!isCo && !code.match(CODE_REGEX)) continue;

      const info = rentedMap ? { ready: false, availableDate: null } : parseRentStatus_(row[4], todayKey, todayY);
      if (!info) continue;

      const price    = parseInt(String(row[5] || '').replace(/,/g, '')) || 0;

      const item = {
        code:          code,
        rentalVersion: rentalRowVersion_(row),
        location:      String(row[2] || '').trim(),
        project:       String(row[3] || '').trim(),
        status:        rentedMap ? 'เช่าแล้ว' : (info.ready ? 'พร้อม' : 'ประกาศล่วงหน้า'),
        ready:         info.ready,
        availableDate: info.availableDate,
        coAgent:       isCo,
        survey:        isSurvey,
        price:         price,
        priceStr:      String(row[5] || '').trim(),
        type:          String(row[6] || '').trim(),
        bedroom:       String(row[7] || '').trim(),
        bathroom:      String(row[8] || '').trim(),
        maidRoom:      normalizeRoomFeature_(row[maidRoomColumn]),
        downstairsBedroom: normalizeRoomFeature_(row[downstairsBedroomColumn]),
        pet:           String(row[9] || '').trim(),
        floor:         String(row[14] || '').trim(),   // O ชั้น
        land:          String(row[15] || '').trim(),   // P ขนาดที่ดิน/ห้อง
        usable:        String(row[16] || '').trim(),   // Q พื้นที่ใช้สอย
        grade:         normalizePropertyGrade_(row[20]), // U ทรัพย์งาม (A-D)
        thumb:         (photoMap[code] && photoMap[code].thumb) || null,
        lat:           null,
        lng:           null,
        lastRentedDate: row[26] || null,
        returnedDate:   row[27] || null,
        returnCount:    row[28] || 0
      };
      const latIndex = roomHeaders.indexOf('lat'), lngIndex = roomHeaders.indexOf('lng');
      const lat = parseFloat(row[latIndex]), lng = parseFloat(row[lngIndex]);
      if (isFinite(lat) && isFinite(lng)) { item.lat = lat; item.lng = lng; }

      if (isStaff) {
        item.ownerName = String(row[10] || '').trim();
        item.contact   = String(row[11] || '').trim();
        item.ownerTel  = String(row[12] || '').trim();
        item.facebook  = fbMap[code.toUpperCase()] || '';   // ★ ลิงก์โพส FB (หรือคำว่า "Survey")
        const folderId = photoMap[code] && photoMap[code].folderId;
        if (folderId) {
          item.folderUrl = 'https://drive.google.com/drive/folders/' + folderId;
        }
      }
      result.push(item);
    }

    try {
      if (!rentedMap && typeof getGeoMap === 'function') {
        const geoMap = getGeoMap();
        result.forEach(function(p) {
          const g = geoMap[p.code];
          if (g) { p.lat = g.lat; p.lng = g.lng; }
        });
      }
    } catch (geoErr) {
      Logger.log('Geo enrich error: ' + geoErr);
    }

    return _json({ ok: true, count: result.length, data: result, staff: isStaff });

  } catch (err) {
    return _json({ ok: false, msg: String(err) });
  }
}

// คอลัมน์ U ใช้เป็นเกรดทรัพย์งาม รับเฉพาะ A-D เพื่อไม่ส่งค่าข้อความอื่นมาเป็นเกรด
function normalizeRoomFeature_(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return isFinite(value) && value >= 0 ? value > 0 : null;
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  if (/^(?:ไม่มี|ไม่มีห้องแม่บ้าน|ไม่มีห้องนอนชั้นล่าง|ไม่|ไม่ได้|no|false|✕|✖|❌)$/.test(raw)) return false;
  if (/^(?:มี|มีห้องแม่บ้าน|มีห้องนอนชั้นล่าง|ได้|yes|true|✓|✔|✅)$/.test(raw)) return true;
  if (/^\d+(?:\.\d+)?(?:\s*ห้อง)?$/.test(raw)) return parseFloat(raw) > 0;
  return null;
}

function normalizePropertyGrade_(value) {
  const raw = String(value == null ? '' : value).trim().toUpperCase();
  const match = raw.match(/^(?:เกรด\s*)?([A-D])(?:\s|$)/i);
  return match ? match[1].toUpperCase() : '';
}


// ════════════════════════════════════════════════════════════
//  PHOTO MAP
// ════════════════════════════════════════════════════════════
function rentalPhotoRoots_() {
  const roots = [FOLDER_BAAN, FOLDER_CONDO];
  const it = DriveApp.getFolderById(RENT_ACTION_ROOT).getFolders();
  while (it.hasNext()) {
    const f = it.next();
    if (/business|bussinest|bassinets|ธุรกิจ/i.test(f.getName())) roots.push(f.getId());
  }
  return roots;
}
function buildPhotoMap(archiveRoot) {
  const cache  = CacheService.getScriptCache();
  const cacheKey = archiveRoot ? 'rental_archive_photos_v1' : PHOTO_CACHE_KEY;
  const cached = cache.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (e) {}
  }
  const startTime = Date.now();
  let map, mode;
  try {
    if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.list) {
      map  = _buildPhotoMapFast(archiveRoot ? [archiveRoot] : rentalPhotoRoots_());
      mode = 'FAST (Drive API)';
    } else {
      throw new Error('Drive Advanced Service not enabled');
    }
  } catch (advErr) {
    Logger.log('⚠️ Drive API ไม่พร้อม → ใช้ DriveApp: ' + advErr);
    map  = _buildPhotoMapSlow(archiveRoot ? [archiveRoot] : rentalPhotoRoots_());
    mode = 'SLOW (DriveApp)';
  }
  const elapsed = Math.round((Date.now() - startTime) / 100) / 10;
  Logger.log('📊 buildPhotoMap[' + mode + ']: ' + Object.keys(map).length + ' codes (' + elapsed + 's)');
  try {
    const json = JSON.stringify(map);
    if (json.length < 100000) cache.put(cacheKey, json, PHOTO_CACHE_TTL);
  } catch (e) {}
  return map;
}

function _buildPhotoMapFast(roots) {
  const map = {};
  (roots || [FOLDER_BAAN, FOLDER_CONDO]).forEach(function(parentId) {
    if (!parentId) return;
    const subFolders = [];
    let pageToken = null;
    do {
      const resp = Drive.Files.list({
        q: "'" + parentId + "' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'nextPageToken, files(id,name)',
        pageSize: 1000,
        pageToken: pageToken
      });
      (resp.files || []).forEach(function(f) {
        const m = (f.name || '').trim().match(FOLDER_CODE_REGEX);
        if (m) subFolders.push({ id: f.id, code: m[1] });
      });
      pageToken = resp.nextPageToken;
    } while (pageToken);
    subFolders.forEach(function(folder) {
      var entry = { thumb: null, folderId: folder.id };
      try {
        const resp = Drive.Files.list({
          q: "'" + folder.id + "' in parents and mimeType contains 'image/' and trashed=false",
          fields: 'files(id,name)',
          pageSize: 1,
          orderBy: 'name'
        });
        if (resp.files && resp.files.length > 0) entry.thumb = resp.files[0].id;
      } catch (e) { Logger.log('  ⚠️ ' + folder.code + ': ' + e); }
      map[folder.code] = entry;
    });
  });
  return map;
}

function _buildPhotoMapSlow(roots) {
  const map        = {};
  const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
  const DEADLINE   = Date.now() + 25000;
  (roots || [FOLDER_BAAN, FOLDER_CONDO]).forEach(function(folderId) {
    if (!folderId) return;
    try {
      const subFolders = DriveApp.getFolderById(folderId).getFolders();
      while (subFolders.hasNext()) {
        if (Date.now() > DEADLINE) { Logger.log('⏱️ timeout'); break; }
        const sub = subFolders.next();
        const m   = sub.getName().trim().match(FOLDER_CODE_REGEX);
        if (!m) continue;
        const code   = m[1];
        const images = [];
        const files  = sub.getFiles();
        while (files.hasNext()) {
          const file = files.next();
          if (IMAGE_MIME.indexOf(file.getMimeType()) === -1) continue;
          images.push({ id: file.getId(), name: file.getName() });
        }
        var entry = { thumb: null, folderId: sub.getId() };
        if (images.length > 0) {
          images.sort(function(a, b) { return a.name.localeCompare(b.name, 'th', { numeric: true }); });
          entry.thumb = images[0].id;
        }
        map[code] = entry;
      }
    } catch (e) { Logger.log('❌ folder error: ' + folderId + ' | ' + e); }
  });
  return map;
}


// ════════════════════════════════════════════════════════════
//  PUBLIC PHOTO SHARING
// ════════════════════════════════════════════════════════════
function makeAllPhotosPublic() {
  const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
  const DEADLINE   = Date.now() + 5 * 60 * 1000;
  const props      = PropertiesService.getScriptProperties();
  const done       = JSON.parse(props.getProperty('maphp_done') || '{}');
  let totalFiles = 0, sharedFiles = 0, errorFiles = 0, skipped = 0, timedOut = false;
  const folderList = [FOLDER_BAAN, FOLDER_CONDO].filter(Boolean);
  outer:
  for (let fi = 0; fi < folderList.length; fi++) {
    if (Date.now() > DEADLINE) { timedOut = true; break; }
    const folderId = folderList[fi];
    try {
      const rootFolder = DriveApp.getFolderById(folderId);
      const subFolders = rootFolder.getFolders();
      while (subFolders.hasNext()) {
        if (Date.now() > DEADLINE) { timedOut = true; break outer; }
        const sub  = subFolders.next();
        const name = sub.getName().trim();
        const m    = name.match(FOLDER_CODE_REGEX);
        if (!m) continue;
        const code = m[1];
        const key  = folderId + '_' + code;
        if (done[key]) { skipped++; continue; }
        const files = sub.getFiles();
        while (files.hasNext()) {
          const file = files.next();
          if (IMAGE_MIME.indexOf(file.getMimeType()) === -1) continue;
          totalFiles++;
          try {
            file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            sharedFiles++;
          } catch (shareErr) {
            errorFiles++;
            Logger.log('share failed: ' + file.getName() + ' | ' + shareErr);
          }
        }
        done[key] = true;
      }
    } catch (folderErr) { Logger.log('folder error: ' + folderId + ' | ' + folderErr); }
  }
  props.setProperty('maphp_done', JSON.stringify(done));
  if (timedOut) {
    Logger.log('⏱️ หมดเวลา — รัน makeAllPhotosPublic อีกครั้ง');
  } else {
    props.deleteProperty('maphp_done');
    clearPhotoCache();
    Logger.log('✅ เสร็จสมบูรณ์');
  }
  Logger.log('   แชร์รอบนี้: ' + sharedFiles + ' / ' + totalFiles);
  Logger.log('   ข้ามแล้ว: ' + skipped + ' folder');
  if (errorFiles > 0) Logger.log('   ล้มเหลว: ' + errorFiles);
}

function resetMakeAllPhotosProgress() {
  PropertiesService.getScriptProperties().deleteProperty('maphp_done');
  Logger.log('✅ Progress reset แล้ว');
}

function clearPhotoCache() {
  const c = CacheService.getScriptCache();
  // ★ FIX Bug2: เพิ่ม PHOTO_CACHE_KEY (v5) + ล้าง key เก่าทุก version
  [PHOTO_CACHE_KEY, 'rental_archive_photos_v1',
   'catalog_photoMap_v1', 'catalog_photoMap_v2',
   'catalog_photoMap_v3', 'catalog_photoMap_v4'].forEach(function(k) {
    c.remove(k);
  });
  Logger.log('✅ Photo cache cleared');
}


// ════════════════════════════════════════════════════════════
//  DEBUG / TEST
// ════════════════════════════════════════════════════════════
function testWriteToSaleSheet() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SHEET_SALE_LIST);
  if (!sheet) { SpreadsheetApp.getUi().alert('❌ ไม่พบ Sheet: "' + SHEET_SALE_LIST + '"'); return; }
  const lastRow = sheet.getLastRow() + 1;
  Logger.log('จะเขียนแถว ' + lastRow);
  const testRow = ['TEST','TEST001','สันทราย > สันพระเนตร','พูลวิลล่าทดสอบ','10900000','พูลวิลล่า','ทดสอบ','116','350','1','','4','4','2','','','','','','','TEST OWNER','','098-000-0000','01/05/2026','',''];
  try { sheet.getRange(lastRow, 1, 1, testRow.length).setValues([testRow]); Logger.log('✅ เขียนสำเร็จแถว ' + lastRow); }
  catch (e) { Logger.log('❌ เขียนไม่ได้: ' + e); }
}

function listAllSheets() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const names = ss.getSheets().map(function(s) { return s.getName(); });
  Logger.log('=== Sheets ทั้งหมด ===');
  names.forEach(function(n, i) { Logger.log((i + 1) + '. "' + n + '"'); });
  Logger.log('ตรงกัน: ' + (names.indexOf(SHEET_SALE_LIST) >= 0 ? 'ใช่ ✅' : 'ไม่ตรง ❌'));
}

function debugSaleCodeSheet() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SHEET_SALE_CODE);
  const data  = sheet.getDataRange().getValues();
  let msg = '=== รหัสขาย — 5 แถวแรก ===\n\n';
  for (let i = 0; i < Math.min(6, data.length); i++) {
    msg += 'แถว ' + (i + 1) + ': ';
    data[i].forEach(function(cell, j) { if (String(cell).trim() !== '') msg += '[Col' + (j + 1) + ']="' + cell + '"  '; });
    msg += '\n';
  }
  ['สันทราย', 'สันพระเนตร', 'พระเนตร'].forEach(function(kw) {
    msg += '\n=== ลองหา "' + kw + '" ===\n';
    for (let i = 1; i < data.length; i++) {
      for (let j = 0; j < data[i].length; j++) {
        if (String(data[i][j]).includes(kw)) msg += 'พบที่แถว ' + (i + 1) + ', Col ' + (j + 1) + ' = "' + data[i][j] + '"\n';
      }
    }
  });
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}

function testDoPost() {
  const fakeEvent = { postData: { contents: JSON.stringify({ token: PropertiesService.getScriptProperties().getProperty('API_SECRET'), action: 'ping' }) } };
  Logger.log(doPost(fakeEvent).getContent());
}

function testDoGet() {
  const result = doGet(null);
  const parsed = JSON.parse(result.getContent());
  Logger.log('ok: ' + parsed.ok + ' | count: ' + parsed.count);
  if (parsed.data && parsed.data.length > 0) {
    Logger.log('ตัวอย่าง: ' + JSON.stringify(parsed.data[0]));
    const withPhoto = parsed.data.filter(function(p) { return p.thumb; }).length;
    Logger.log('มีรูป: ' + withPhoto + ' | ไม่มีรูป: ' + (parsed.data.length - withPhoto));
  }
}

function debugPhotoMap() {
  clearPhotoCache();
  const map  = buildPhotoMap();
  const keys = Object.keys(map);
  Logger.log('=== Photo Map (' + keys.length + ' รหัส) ===');
  keys.slice(0, 20).forEach(function(k) { Logger.log('  ' + k + ' → ' + JSON.stringify(map[k])); });
  if (keys.length > 20) Logger.log('  ... และอีก ' + (keys.length - 20));
}


// ════════════════════════════════════════════════════════════
//  HTML FORM — งานเช่า
// ════════════════════════════════════════════════════════════
const FORM_HTML = '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<style>\n  body { font-family: \'Sarabun\', sans-serif; font-size: 14px; margin: 12px; }\n  label { display: block; margin-top: 8px; font-weight: bold; }\n  input, select, textarea { width: 100%; padding: 5px; margin-top: 2px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; transition: border-color .2s, background .2s, box-shadow .2s; }\n  textarea { height: 80px; }\n  .row2 { display: flex; gap: 10px; }\n  .row2 > div { flex: 1; }\n  button { margin-top: 16px; width: 100%; padding: 10px; background: #1a73e8; color: #fff; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; }\n  button:hover { background: #1558b0; }\n  button:disabled { background: #aaa; cursor: not-allowed; }\n  #msg { margin-top: 10px; text-align: center; font-weight: bold; }\n  .ok { color: green; } .err { color: red; }\n  .field-error { border-color:#e53935!important; background:#fff3f3!important; box-shadow:0 0 0 2px rgba(229,57,53,.25)!important; }\n  .field-error-msg { color:#e53935; font-size:12px; margin-top:2px; display:none; }\n  .field-error-msg.show { display:block; }\n  #successBanner { display:none; background:#e6f4ea; border:1px solid #34a853; border-radius:6px; padding:10px 14px; margin-bottom:10px; color:#1e8e3e; font-weight:bold; text-align:center; font-size:15px; }\n  .deposit-wrap { position:relative; }\n  .deposit-wrap input { padding-right:60px; }\n  .deposit-unit { position:absolute; right:8px; top:50%; transform:translateY(-50%); color:#666; font-size:13px; pointer-events:none; }\n</style>\n</head>\n<body>\n<link href="https://fonts.googleapis.com/css2?family=Sarabun&display=swap" rel="stylesheet">\n<div id="successBanner"></div>\n<div class="row2">\n  <div><label>อำเภอ *</label><input id="amphoe" placeholder="เช่น ดอยสะเก็ด"><div class="field-error-msg" id="err-amphoe">กรุณากรอกอำเภอ</div></div>\n  <div><label>ตำบล *</label><input id="tambon" placeholder="เช่น สันปูเลย"><div class="field-error-msg" id="err-tambon">กรุณากรอกตำบล</div></div>\n</div>\n<label>โครงการ / ชื่อทรัพย์ *</label>\n<input id="project" placeholder="เช่น อรสิริน 3"><div class="field-error-msg" id="err-project">กรุณากรอกโครงการ</div>\n<div class="row2">\n  <div><label>ประเภท *</label><select id="type"><option>บ้านเดี่ยว</option><option>ทาวน์เฮ้าส์</option><option>พูลวิลล่า</option><option>คอนโด</option><option>ที่ดิน</option><option>อาคารพาณิชย์</option><option>หอพัก</option><option>สำนักงาน</option><option>โกดัง</option></select></div>\n  <div><label>สถานะ *</label><select id="status" onchange="toggleAvailableDate()"><option>พร้อมเช่า</option><option>ประกาศล่วงหน้า</option><option>ให้เช่า</option><option>ขาย</option><option>ให้เช่า/ขาย</option></select></div>\n</div>\n<div id="availableDateRow" style="margin-top:6px;display:none;">\n  <label>พร้อมเช่าวันที่ *</label><input id="availableDate" type="date"><div class="field-error-msg" id="err-availableDate">กรุณาเลือกวันที่</div>\n</div>\n<label>ประเภทเอเจนต์</label>\n<select id="agentType"><option value="Co-Agent">Co-Agent</option><option value="ติดทรัพย์รับโค">ติดทรัพย์รับโค</option></select>\n<label>ราคา (บาท/เดือน) *</label>\n<input id="price" placeholder="เช่น 28000"><div class="field-error-msg" id="err-price">กรุณากรอกราคา</div>\n<div class="row2">\n  <div><label>ระยะสัญญา</label><input id="contract" placeholder="เช่น 1 ปี"></div>\n  <div><label>เงินประกัน (เดือน)</label><div class="deposit-wrap"><input id="deposit" type="number" placeholder="2" min="1"><span class="deposit-unit">เดือน</span></div></div>\n</div>\n<div class="row2">\n  <div><label>ห้องนอน</label><input id="bedroom" type="number" value="3"></div>\n  <div><label>ห้องน้ำ</label><input id="bathroom" type="number" value="2"></div>\n  <div><label>ขนาดที่ดิน(ตรว.)</label><input id="land" placeholder="50"></div><div><label>ชั้น</label><input id="floor" type="number" placeholder="3"></div><div><label>พื้นที่ใช้สอย(ตรม.)</label><input id="usable" placeholder="120"></div>\n</div>\n<div class="row2">\n  <div><label>สัตว์เลี้ยง</label><select id="pet"><option>ไม่ได้</option><option>ได้</option></select></div>\n  <div><label>เฟอร์นิเจอร์</label><select id="furniture"><option>เฟอร์ครบ</option><option>เฟอร์บางส่วน</option><option>ไม่มีเฟอร์</option></select></div>\n  <div><label>ระยะสั้น</label><select id="shortTerm" onchange="toggleShortTermPrices()"><option value=""></option><option>ได้</option><option>ไม่ได้</option></select></div>\n</div>\n<div id="shortTermPrices" class="row2" style="display:none;">\n  <div><label>ราคาเช่า 3 เดือน (บาท/เดือน)</label><input id="shortTermPrice3" type="number" min="1" placeholder="เช่น 30000"></div>\n  <div><label>ราคาเช่า 6 เดือน (บาท/เดือน)</label><input id="shortTermPrice6" type="number" min="1" placeholder="เช่น 27000"></div>\n</div>\n<label>รายละเอียดห้อง</label><textarea id="roomDetails" placeholder="ห้องโถง, ห้องครัว, จอดรถ 2 คัน"></textarea>\n<label>เฟอร์นิเจอร์ & เครื่องใช้ไฟฟ้า</label><textarea id="furnitureList" placeholder="แอร์ 4 ตัว, โซฟา, เครื่องซักผ้า"></textarea>\n<label>ความปลอดภัย & ส่วนกลาง</label><textarea id="securityInfo" style="height:50px" placeholder="รปภ. 24 ชม. / CCTV"></textarea>\n<label>ไฮไลท์ทำเล</label><textarea id="locationHighlights" placeholder="ใกล้สนามบิน 7 นาที"></textarea>\n<label>ชื่อเจ้าของ *</label>\n<input id="ownerName" placeholder="ชื่อเจ้าของ"><div class="field-error-msg" id="err-ownerName">กรุณากรอกชื่อ</div>\n<div class="row2">\n  <div><label>เบอร์โทรเจ้าของ *</label><input id="ownerTel" placeholder="0812345678"><div class="field-error-msg" id="err-ownerTel">กรุณากรอกเบอร์</div></div>\n  <div><label>ช่องทางติดต่ออื่นๆ</label><input id="contact" placeholder="Line: xxx"></div>\n</div>\n<label>Facebook เจ้าของ</label><input id="facebook" placeholder="ชื่อ Facebook หรือ URL">\n<label>Google Maps</label><input id="mapsUrl" placeholder="วาง link Google Maps">\n<label>โพสต์ต้นฉบับ</label><textarea id="ownerPost" placeholder="วางข้อความโพสต์ของเจ้าของ (ถ้ามี)"></textarea>\n<button id="submitBtn" onclick="submitRent()">ลงทะเบียนทรัพย์เช่า</button>\n<div id="msg"></div>\n<script>\nvar REQ=[{id:"amphoe",label:"อำเภอ"},{id:"tambon",label:"ตำบล"},{id:"project",label:"โครงการ"},{id:"price",label:"ราคา"},{id:"ownerName",label:"ชื่อเจ้าของ"},{id:"ownerTel",label:"เบอร์โทร"}];\nfunction toggleShortTermPrices(){document.getElementById("shortTermPrices").style.display=get("shortTerm")==="ได้"?"flex":"none";}\nfunction toggleAvailableDate(){var s=document.getElementById("status").value;document.getElementById("availableDateRow").style.display=(s==="ประกาศล่วงหน้า")?"block":"none";if(s!=="ประกาศล่วงหน้า")document.getElementById("availableDate").value="";}\nfunction setErr(id,on,msg){var e=document.getElementById(id);var m=document.getElementById("err-"+id);if(!e)return;e.classList.toggle("field-error",on);if(m){if(msg)m.textContent=msg;m.classList.toggle("show",on);}}\nfunction clearErrors(){REQ.forEach(function(f){setErr(f.id,false);});["availableDate"].forEach(function(id){setErr(id,false);});var m=document.getElementById("msg");m.textContent="";m.className="";}\nfunction get(id){return document.getElementById(id).value.trim();}\nfunction submitRent(){\n  clearErrors();document.getElementById("successBanner").style.display="none";\n  var err=false;\n  REQ.forEach(function(f){if(!get(f.id)){setErr(f.id,true,"กรุณากรอก"+f.label);err=true;}});\n  if(get("status")==="ประกาศล่วงหน้า"&&!get("availableDate")){setErr("availableDate",true,"กรุณาเลือกวันที่");err=true;}\n  if(err){return;}\n  if(get("shortTerm")==="ได้"){var p3=get("shortTermPrice3"),p6=get("shortTermPrice6");if((!p3&&!p6)||[p3,p6].some(function(p){return p&&!new RegExp("^[1-9][0-9]*$").test(p);})){document.getElementById("msg").textContent="กรุณากรอกราคา 3 เดือนหรือ 6 เดือนอย่างน้อยหนึ่งช่อง เป็นจำนวนบาทต่อเดือนที่มากกว่า 0";document.getElementById("msg").className="err";return;}}\n  var btn=document.getElementById("submitBtn");btn.disabled=true;btn.textContent="กำลังลงทะเบียน...";\n  document.getElementById("msg").textContent="กำลังลงทะเบียน...";\n  var dep=get("deposit");\n  var d={amphoe:get("amphoe"),tambon:get("tambon"),project:get("project"),type:get("type"),status:get("status"),price:get("price"),bedroom:get("bedroom"),bathroom:get("bathroom"),floor:get("floor"),land:get("land"),usable:get("usable"),pet:get("pet"),furniture:get("furniture"),shortTerm:get("shortTerm"),shortTermPrice3:get("shortTerm")==="ได้"?get("shortTermPrice3"):"",shortTermPrice6:get("shortTerm")==="ได้"?get("shortTermPrice6"):"",agentType:get("agentType"),contract:get("contract"),deposit:dep?"เงินประกัน "+dep+" เดือน":"",roomDetails:get("roomDetails"),furnitureList:get("furnitureList"),securityInfo:get("securityInfo"),locationHighlights:get("locationHighlights"),ownerName:get("ownerName"),ownerTel:get("ownerTel"),contact:get("contact"),facebook:get("facebook"),mapsUrl:get("mapsUrl"),ownerPost:get("ownerPost"),availableDate:get("availableDate")};\n  google.script.run.withSuccessHandler(function(r){btn.disabled=false;btn.textContent="ลงทะเบียนทรัพย์เช่า";if(r.ok){var b=document.getElementById("successBanner");b.textContent="ลงทะเบียนสำเร็จ! รหัส: "+r.code;b.style.display="block";document.getElementById("msg").textContent="";}else{document.getElementById("msg").textContent="Error: "+r.msg;document.getElementById("msg").className="err";}}).withFailureHandler(function(e){btn.disabled=false;btn.textContent="ลงทะเบียนทรัพย์เช่า";document.getElementById("msg").textContent="Error: "+e.message;document.getElementById("msg").className="err";}).registerProperty(d);\n}\nREQ.forEach(function(f){var e=document.getElementById(f.id);if(e)e.addEventListener("input",function(){setErr(f.id,false);});});\nwindow.onload=function(){toggleAvailableDate();toggleShortTermPrices();};\n</script>\n</body>\n</html>';


// ════════════════════════════════════════════════════════════
//  HTML FORM — งานขาย
// ════════════════════════════════════════════════════════════
const SALE_FORM_HTML = "<!DOCTYPE html>\n<html>\n<head>\n<meta charset=\"utf-8\">\n<style>\n  body { font-family: 'Sarabun', sans-serif; font-size: 14px; margin: 12px; }\n  label { display: block; margin-top: 8px; font-weight: bold; }\n  input, select, textarea { width: 100%; padding: 5px; margin-top: 2px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }\n  textarea { height: 70px; }\n  .row2 { display: flex; gap: 10px; } .row2 > div { flex: 1; }\n  .row3 { display: flex; gap: 8px; } .row3 > div { flex: 1; }\n  button { margin-top: 16px; width: 100%; padding: 10px; background: #e67700; color: #fff; border: none; border-radius: 6px; font-size: 15px; cursor: pointer; }\n  button:hover { background: #b35900; }\n  button:disabled { background: #aaa; cursor: not-allowed; }\n  #smsg { margin-top: 10px; text-align: center; font-weight: bold; }\n  .ok { color: green; } .err { color: red; }\n  .field-error { border-color:#e53935!important; background:#fff3f3!important; }\n  .field-error-msg { color:#e53935; font-size:12px; margin-top:2px; display:none; }\n  .field-error-msg.show { display:block; }\n  #sSuccessBanner { display:none; background:#fff3e0; border:1px solid #e67700; border-radius:6px; padding:10px 14px; margin-bottom:10px; color:#b35900; font-weight:bold; text-align:center; }\n  .sec { margin-top:14px; padding:5px 10px; background:#fff3e0; border-left:4px solid #e67700; font-weight:bold; font-size:13px; color:#7c4700; }\n</style>\n</head>\n<body>\n<link href=\"https://fonts.googleapis.com/css2?family=Sarabun&display=swap\" rel=\"stylesheet\">\n<div id=\"sSuccessBanner\"></div>\n<div class=\"sec\">ทำเล</div>\n<div class=\"row2\">\n  <div><label>อำเภอ *</label><input id=\"samphoe\" placeholder=\"เช่น เมืองเชียงใหม่\"><div class=\"field-error-msg\" id=\"serr-samphoe\">กรุณากรอก</div></div>\n  <div><label>ตำบล *</label><input id=\"stambon\" placeholder=\"เช่น สุเทพ\"><div class=\"field-error-msg\" id=\"serr-stambon\">กรุณากรอก</div></div>\n</div>\n<label>โครงการ / ชื่อทรัพย์ *</label>\n<input id=\"sproject\" placeholder=\"เช่น บ้านสิริวิลล์\"><div class=\"field-error-msg\" id=\"serr-sproject\">กรุณากรอก</div>\n<div class=\"sec\">ข้อมูลการขาย</div>\n<div class=\"row2\">\n  <div><label>ประเภทเอเจนต์</label><select id=\"sagentType\"><option value=\"Co-Agent\">Co-Agent</option><option value=\"ติดทรัพย์รับโค\">ติดทรัพย์รับโค</option></select></div>\n  <div><label>ประเภททรัพย์ *</label><select id=\"stype\"><option>บ้านเดี่ยว</option><option>ทาวน์เฮ้าส์</option><option>พูลวิลล่า</option><option>คอนโด</option><option>ที่ดิน</option><option>อาคารพาณิชย์</option><option>หอพัก</option><option>สำนักงาน</option><option>โกดัง</option></select></div>\n</div>\n<label>ราคาขาย (บาท) *</label>\n<input id=\"sprice\" type=\"number\" placeholder=\"เช่น 3500000\"><div class=\"field-error-msg\" id=\"serr-sprice\">กรุณากรอก</div>\n<div class=\"row3\">\n  <div><label>เอกสารสิทธิ์</label><select id=\"stitleDeed\"><option value=\"\">-- ไม่ระบุ --</option><option>โฉนด</option><option>นส.3ก</option><option>นส.3</option><option>สค.1</option></select></div>\n  <div><label>ค่าโอน</label><select id=\"stransfer\"><option value=\"\">-- ไม่ระบุ --</option><option>ผู้ขายออก</option><option>ผู้ซื้อออก</option><option>แบ่งกัน 50/50</option></select></div>\n  <div><label>ต่อรองได้</label><select id=\"snegotiate\"><option value=\"ได้\">ได้</option><option value=\"ไม่ได้\">ไม่ได้</option></select></div>\n</div>\n<div class=\"sec\">รายละเอียดบ้าน</div>\n<div class=\"row3\">\n  <div><label>ห้องนอน</label><input id=\"sbedroom\" type=\"number\" value=\"3\"></div>\n  <div><label>ห้องน้ำ</label><input id=\"sbathroom\" type=\"number\" value=\"2\"></div>\n  <div><label>จอดรถ (คัน)</label><input id=\"sparking\" type=\"number\" placeholder=\"2\"></div>\n</div>\n<div class=\"row2\">\n  <div><label>ขนาดที่ดิน (ตรว.)</label><input id=\"sland\" placeholder=\"50.5\"></div>\n  <div><label>พื้นที่ใช้สอย (ตรม.)</label><input id=\"susable\" placeholder=\"150\"></div>\n</div>\n<div class=\"row3\">\n  <div><label>ชั้น</label><input id=\"sfloor\" placeholder=\"2\"></div>\n  <div><label>ตึก</label><input id=\"sbuilding\" placeholder=\"A\"></div>\n  <div><label>ทิศ</label><select id=\"sdirection\"><option value=\"\">-- ไม่ระบุ --</option><option>เหนือ</option><option>ใต้</option><option>ออก</option><option>ตก</option></select></div>\n</div>\n<div class=\"row2\">\n  <div><label>อายุบ้าน</label><input id=\"shouseAge\" placeholder=\"5 ปี\"></div>\n  <div><label>ค่าส่วนกลาง/ปี (บาท)</label><input id=\"scommonFee\" type=\"number\" placeholder=\"12000\"></div>\n</div>\n<label>รายละเอียดเพิ่มเติม</label><textarea id=\"shouseInfo\" placeholder=\"ซ.สุเทพ 52 ใกล้มหาวิทยาลัย\"></textarea>\n<label>ของแถม / เฟอร์นิเจอร์</label><textarea id=\"sbonus\" placeholder=\"แอร์ 4 ตัว, เตียง, โซฟา\"></textarea>\n<label>ไฮไลท์ทำเล</label><textarea id=\"slocationHighlights\" placeholder=\"ใกล้สนามบิน 7 นาที\"></textarea>\n<div class=\"sec\">ข้อมูลเพิ่มเติมสำหรับการค้นหา</div>\n<div class=\"row2\"><div><label>ห้องแม่บ้าน</label><select id=\"smaidRoom\"><option value=\"\">ยังไม่ระบุ</option><option>มี</option><option>ไม่มี</option></select></div><div><label>ห้องนอนชั้นล่าง</label><select id=\"sdownstairsBedroom\"><option value=\"\">ยังไม่ระบุ</option><option>มี</option><option>ไม่มี</option></select></div></div>\n<div class=\"row2\"><div><label>เกรดทรัพย์</label><select id=\"sgrade\"><option value=\"\">ยังไม่ระบุ</option><option>A</option><option>B</option><option>C</option><option>D</option></select></div><div><label>สัตว์เลี้ยง</label><select id=\"spet\"><option value=\"\">ยังไม่ระบุ</option><option>รับได้</option><option>ไม่รับ</option></select></div></div>\n<div class=\"sec\">ข้อมูลเจ้าของ</div>\n<label>ชื่อเจ้าของ *</label>\n<input id=\"sownerName\" placeholder=\"ชื่อเจ้าของ\"><div class=\"field-error-msg\" id=\"serr-sownerName\">กรุณากรอก</div>\n<div class=\"row2\">\n  <div><label>เบอร์โทร *</label><input id=\"sownerTel\" placeholder=\"0812345678\"><div class=\"field-error-msg\" id=\"serr-sownerTel\">กรุณากรอก</div></div>\n  <div><label>ช่องทางติดต่ออื่นๆ</label><input id=\"scontact\" placeholder=\"Line: xxx\"></div>\n</div>\n<label>Facebook เจ้าของ</label><input id=\"sfacebook\" placeholder=\"ชื่อ Facebook หรือ URL\">\n<label>Google Maps</label><input id=\"smapsUrl\" placeholder=\"วาง link Google Maps\">\n<label>โพสต์ต้นฉบับจากเจ้าของ</label><textarea id=\"sownerPost\" placeholder=\"วางข้อความโพสต์ (ถ้ามี)\"></textarea>\n<button id=\"sSubmitBtn\" onclick=\"submitSale()\">ลงทะเบียนทรัพย์ขาย</button>\n<div id=\"smsg\"></div>\n<script>\nvar SREQ=[{id:\"samphoe\",label:\"อำเภอ\"},{id:\"stambon\",label:\"ตำบล\"},{id:\"sproject\",label:\"โครงการ\"},{id:\"sprice\",label:\"ราคาขาย\"},{id:\"sownerName\",label:\"ชื่อเจ้าของ\"},{id:\"sownerTel\",label:\"เบอร์โทร\"}];\nfunction sSetErr(id,on,msg){var e=document.getElementById(id);var m=document.getElementById(\"serr-\"+id);if(!e)return;e.classList.toggle(\"field-error\",on);if(m){if(msg)m.textContent=msg;m.classList.toggle(\"show\",on);}}\nfunction sClearErrors(){SREQ.forEach(function(f){sSetErr(f.id,false);});var m=document.getElementById(\"smsg\");m.textContent=\"\";m.className=\"\";}\nfunction sGet(id){return document.getElementById(id).value.trim();}\nfunction submitSale(){\n  sClearErrors();document.getElementById(\"sSuccessBanner\").style.display=\"none\";\n  var err=false;\n  SREQ.forEach(function(f){if(!sGet(f.id)){sSetErr(f.id,true,\"กรุณากรอก\"+f.label);err=true;}});\n  if(err){return;}\n  var btn=document.getElementById(\"sSubmitBtn\");btn.disabled=true;btn.textContent=\"กำลังลงทะเบียน...\";\n  document.getElementById(\"smsg\").textContent=\"กำลังลงทะเบียน...\";\n  var d={maidRoom:sGet(\"smaidRoom\"),downstairsBedroom:sGet(\"sdownstairsBedroom\"),grade:sGet(\"sgrade\"),pet:sGet(\"spet\"),agentType:sGet(\"sagentType\"),amphoe:sGet(\"samphoe\"),tambon:sGet(\"stambon\"),project:sGet(\"sproject\"),type:sGet(\"stype\"),price:sGet(\"sprice\"),titleDeed:sGet(\"stitleDeed\"),transfer:sGet(\"stransfer\"),negotiate:sGet(\"snegotiate\"),bedroom:sGet(\"sbedroom\"),bathroom:sGet(\"sbathroom\"),parking:sGet(\"sparking\"),land:sGet(\"sland\"),usable:sGet(\"susable\"),floor:sGet(\"sfloor\"),building:sGet(\"sbuilding\"),direction:sGet(\"sdirection\"),houseAge:sGet(\"shouseAge\"),commonFee:sGet(\"scommonFee\"),houseInfo:sGet(\"shouseInfo\"),bonus:sGet(\"sbonus\"),locationHighlights:sGet(\"slocationHighlights\"),ownerName:sGet(\"sownerName\"),ownerTel:sGet(\"sownerTel\"),contact:sGet(\"scontact\"),facebook:sGet(\"sfacebook\"),mapsUrl:sGet(\"smapsUrl\"),ownerPost:sGet(\"sownerPost\")};\n  google.script.run.withSuccessHandler(function(r){btn.disabled=false;btn.textContent=\"ลงทะเบียนทรัพย์ขาย\";if(r.ok){var b=document.getElementById(\"sSuccessBanner\");b.textContent=\"ลงทะเบียนสำเร็จ! รหัส: \"+r.code;b.style.display=\"block\";document.getElementById(\"smsg\").textContent=\"\";}else{document.getElementById(\"smsg\").textContent=\"Error: \"+r.msg;document.getElementById(\"smsg\").className=\"err\";}}).withFailureHandler(function(e){btn.disabled=false;btn.textContent=\"ลงทะเบียนทรัพย์ขาย\";document.getElementById(\"smsg\").textContent=\"Error: \"+e.message;document.getElementById(\"smsg\").className=\"err\";}).registerSaleProperty(d);\n}\nSREQ.forEach(function(f){var e=document.getElementById(f.id);if(e)e.addEventListener(\"input\",function(){sSetErr(f.id,false);});});\n</script>\n</body>\n</html>";
