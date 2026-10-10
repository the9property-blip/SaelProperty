// ============================================================
//  SaleCatalogScript.gs  —  Sale Catalog API (companion file)
//
//  วิธีใช้:
//    1) ใน Apps Script editor ของโปรเจกต์เดียวกัน → กดปุ่ม + (File)
//       → Script → ตั้งชื่อไฟล์ "SaleCatalogScript" → วางโค้ดนี้ทั้งหมด
//    2) แก้ doGet() ใน PropertyAllScript.gs ตามที่อธิบายท้ายไฟล์นี้
//       (เพิ่ม 4 บรรทัด ก่อน block อ่านชีตเช่า)
//    3) Save → Deploy → New deployment → Web app → Anyone
//       (หรือถ้า deploy เก่ายังอยู่: Manage deployments → ✏ Edit → New version)
//    4) เปิด index_sale_FIXED.html → แก้ SCRIPT_URL เป็น Web App URL ที่ได้
//
//  หลักการ:
//    • ใช้ค่าคงที่/utility จากไฟล์หลัก (SS_ID, SHEET_SALE_LIST,
//      FOLDER_SALE_BAAN, _json, _todayStr, getGeoMap ฯลฯ)
//    • เพิ่ม cache key 'catalog_salePhotoMap_v2' แยกจากของเช่า
//    • รหัสขายอาจมี 1-3 หลัก (SXM01, SSP042, SSS036) — ใช้ regex
//      ครอบคลุมทั้ง R/S prefix
//    • mapsUrl อ่านจาก col AC (mapsUrl) ก่อน ถ้าว่าง fallback col T
// ============================================================

// ─── CONFIG ─────────────────────────────────────────────────
// regex จับรหัสทรัพย์ — รองรับทั้งเช่า (R__####) และขาย (S__##/###/####)
const SALE_CODE_REGEX = /^(?:S[A-Z]{2}|CO[A-Z]*)\d+$/;

// cache key สำหรับ photo map ฝั่งขาย
const SALE_PHOTO_CACHE_KEY = 'catalog_salePhotoMap_v1';
const SALE_PHOTO_CACHE_TTL = 21600;  // 6 ชั่วโมง

// header names ที่ใช้ค้นใน row (กันชื่อสลับ index ตามที่ AddLatLngScript เพิ่มท้าย)
const SALE_HEADER_LAT      = 'lat';
const SALE_HEADER_LNG      = 'lng';
const SALE_HEADER_MAPS_URL = 'mapsUrl';
const SALE_HEADER_MAPS_OLD = 'Google map Location';


// ════════════════════════════════════════════════════════════
//  ENTRY POINT — เรียกจาก doGet เดิม เมื่อ params.type === 'sale'
// ════════════════════════════════════════════════════════════
/**
 * คืน JSON ของบ้านขายทั้งหมด + thumb + lat/lng (+ staff fields ถ้า login)
 * URL query params ที่รองรับ:
 *   ?type=sale           — บังคับ — ทำให้ doGet เรียกมาที่นี่
 *   ?token=<password>    — แสดง ownerName / ownerTel / folderUrl
 *   ?refresh=1           — ล้าง cache แล้ว scan รูปใหม่
 *   ?format=csv          — dump ทั้งชีตเป็น CSV (สำหรับ debug)
 */
function doGetSale(e) {
  try {
    const params  = (e && e.parameter) || {};
    // STAFF_PASSWORD ประกาศใน PropertyAllScript.gs — ใช้ร่วมกันได้ในโปรเจกต์เดียวกัน
    const isStaff = (params.token === STAFF_PASSWORD);

    const sold = params.action === 'soldMap' || params.dataset === 'sold';
    if (sold && !isStaff) return _json({ok:false,error:'unauthorized'});
    if (params.format === 'csv' && !isStaff) return _json({ok:false,error:'unauthorized'});
    if (params.format === 'csv') {
      return _saleSheetAsCSV_();
    }
    if (params.refresh === '1') {
      try { clearSalePhotoCache(); clearSoldPhotoCache_(); } catch (err) {}
    }

    const ss    = SpreadsheetApp.openById(SS_ID);
    const sheet = sold ? getSaleArchiveSheet_(ss) : ss.getSheetByName(SHEET_SALE_LIST);
    if (!sheet) {
      return _json({ ok: false, msg: 'ไม่พบ Sheet: "' + SHEET_SALE_LIST + '"' });
    }

    const photoMap = buildSalePhotoMap(sold ? saleArchiveFolderId_(true) : undefined);
    const data     = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return _json({ ok: true, count: 0, data: [], staff: isStaff, dataset: sold ? 'sold' : 'active' });
    }

    const headers = data[0];
    function headerValue(row, names) {
      const i = headers.findIndex(function(h) { return names.indexOf(String(h || '').trim().toLowerCase()) !== -1; });
      return i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim();
    }
    function feature(row, names) {
      const v = headerValue(row, names).toLowerCase();
      return /^(?:มี|ใช่|yes|true|1|✓)$/.test(v) ? true : /^(?:ไม่มี|ไม่|no|false|0|✗)$/.test(v) ? false : null;
    }
    // หา index ของ field พิเศษโดยอ่านจาก header (ทนทานต่อการเลื่อนคอลัมน์)
    const idxLat     = headers.indexOf(SALE_HEADER_LAT);
    const idxLng     = headers.indexOf(SALE_HEADER_LNG);
    const idxMapsNew = headers.indexOf(SALE_HEADER_MAPS_URL);
    const idxMapsOld = headers.indexOf(SALE_HEADER_MAPS_OLD);

    const result = [];
    const fbMap  = isStaff ? getUploadFbMap_(ss) : {};   // ★ ลิงก์ FB ต่อรหัส (staff) — ใช้ helper ร่วมจาก PropertyAllScript.gs

    for (let i = 1; i < data.length; i++) {
      const row  = data[i];
      const code = String(row[1] || '').trim().toUpperCase();
      if (!code || !code.match(SALE_CODE_REGEX)) continue;

      const colA     = String(row[0] || '').trim();
      const isCo     = (colA.toLowerCase() === 'co');
      const isSurvey = (colA.toLowerCase() === 'survey');   // ★ survey อ่านจากคอลัมน์ A เหมือน co
      const price    = parseInt(String(row[4] || '').replace(/,/g, '')) || 0;

      // คำนวณ price per area
      const land   = _parseNum_(row[7]);   // col H — ขนาดที่ดิน ตรว.
      const usable = _parseNum_(row[8]);   // col I — พื้นที่ใช้สอย ตรม.
      const pricePerSqw = (price > 0 && land   > 0) ? Math.round(price / land)   : null;
      const pricePerSqm = (price > 0 && usable > 0) ? Math.round(price / usable) : null;

      // lat/lng จาก header lookup
      const latVal = idxLat >= 0 ? parseFloat(row[idxLat]) : NaN;
      const lngVal = idxLng >= 0 ? parseFloat(row[idxLng]) : NaN;
      const hasGeo = !isNaN(latVal) && !isNaN(lngVal);

      // mapsUrl: ใช้ AC (mapsUrl) ก่อน — ถ้าว่าง fallback T (Google map Location)
      let mapsUrl = '';
      if (idxMapsNew >= 0) mapsUrl = String(row[idxMapsNew] || '').trim();
      if (!mapsUrl && idxMapsOld >= 0) mapsUrl = String(row[idxMapsOld] || '').trim();

      const item = {
        code:         code,
        location:     String(row[2] || '').trim(),
        project:      String(row[3] || '').trim(),
        price:        price,
        priceStr:     String(row[4] || '').trim(),
        pricePerSqw:  pricePerSqw,
        pricePerSqm:  pricePerSqm,
        type:         String(row[5] || '').trim(),
        houseInfo:    String(row[6] || '').trim(),
        land:         String(row[7] || '').trim(),
        usable:       String(row[8] || '').trim(),
        floor:        String(row[9] || '').trim(),
        building:     String(row[10] || '').trim(),
        bedroom:      String(row[11] || '').trim(),
        bathroom:     String(row[12] || '').trim(),
        parking:      String(row[13] || '').trim(),
        direction:    String(row[14] || '').trim(),
        houseAge:     String(row[15] || '').trim(),
        commonFee:    String(row[16] || '').trim(),
        bonus:        String(row[17] || '').trim(),
        transfer:     String(row[18] || '').trim(),
        coAgent:      isCo,
        survey:       isSurvey,
        negotiate:    headerValue(row, ['negotiate','ต่อรอง','ต่อรองได้']),
        grade: normalizePropertyGrade_(headerValue(row, ['grade','เกรด','เกรดทรัพย์'])),
        maidRoom: feature(row, ['maidroom','ห้องแม่บ้าน']),
        downstairsBedroom: feature(row, ['downstairsbedroom','ห้องนอนชั้นล่าง']),
        pet: headerValue(row, ['pet','สัตว์เลี้ยง']),   // ชีตปัจจุบันยังไม่เก็บ field นี้แยก — frontend จะข้าม
        thumb:        (photoMap[code] && photoMap[code].thumb) || null,
        lat:          hasGeo ? latVal : null,
        lng:          hasGeo ? lngVal : null,
        mapsUrl:      mapsUrl
      };

      // STAFF เท่านั้นที่เห็นข้อมูลเจ้าของ + folder ใน Drive
      if (isStaff) {
        item.saleVersion = saleRequestVersion_(row, sold ? 'sold' : 'active');
        item.ownerName = String(row[20] || '').trim();   // col U
        item.contact   = String(row[21] || '').trim();   // col V
        item.ownerTel  = _cleanPhone_(String(row[22] || ''));   // col W — strip text
        item.ownerTelRaw = String(row[22] || '').trim();        // raw (มี text แนบ)
        item.facebook  = fbMap[code.toUpperCase()] || '';       // ★ ลิงก์โพส FB (หรือคำว่า "Survey")
        const folderId = photoMap[code] && photoMap[code].folderId;
        if (folderId) {
          item.folderUrl = 'https://drive.google.com/drive/folders/' + folderId;
        }
      }

      result.push(item);
    }

    return _json({ ok: true, count: result.length, data: result, staff: isStaff, dataset: sold ? 'sold' : 'active' });

  } catch (err) {
    return _json({ ok: false, msg: 'doGetSale error: ' + err });
  }
}


// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════

/** parse number — รองรับ "116", "116.5", "1,234" */
function _parseNum_(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

/** ตัดอักษรไม่ใช่ตัวเลขออกจากเบอร์โทร — '098-696-1422 (คุณนิน)' → '0986961422' */
function _cleanPhone_(s) {
  if (!s) return '';
  // ตัดทุกอย่างที่อยู่ในวงเล็บออกก่อน
  const noParen = String(s).replace(/\([^)]*\)/g, '').trim();
  // เก็บแค่ตัวเลข
  const digits  = noParen.replace(/\D/g, '');
  return digits || String(s).trim();
}

/** CSV dump ของชีต "รายชื่อบ้านขาย" — สำหรับ debug ฝั่ง client */
function _saleSheetAsCSV_() {
  const ss    = SpreadsheetApp.openById(SS_ID);
  const sheet = ss.getSheetByName(SHEET_SALE_LIST);
  if (!sheet) {
    return ContentService.createTextOutput('ERROR,Sheet not found: ' + SHEET_SALE_LIST)
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
      if (s.indexOf(',')  !== -1 || s.indexOf('"')  !== -1 ||
          s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
        s = '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    }).join(',');
  }).join('\n');
  return ContentService.createTextOutput(csv).setMimeType(ContentService.MimeType.CSV);
}


// ════════════════════════════════════════════════════════════
//  SALE PHOTO MAP  —  scan โฟลเดอร์รูปขาย → { code: {thumb, folderId} }
//
//  เก็บแค่รูปแรกของแต่ละ folder (ไม่เก็บ photos[] ทั้งหมด) — เพื่อ
//   • scan เร็วขึ้น (~10 เท่า)
//   • cache เล็กลง (~30 เท่า)
//   • ส่ง JSON ขนาดเล็ก
//
//  FOLDER_SALE_BAAN = FOLDER_SALE_CONDO ในไฟล์หลัก — scan ครั้งเดียวก็พอ
// ════════════════════════════════════════════════════════════
function buildSalePhotoMap(archiveRoot) {
  const cache = CacheService.getScriptCache(), key = archiveRoot ? 'catalog_soldPhotoMap_v2' : SALE_PHOTO_CACHE_KEY;
  const cached = cache.get(key); if (cached) { try { return JSON.parse(cached); } catch(e) {} }
  const map = scanSalePhotos_(archiveRoot);
  try { cache.put(key, JSON.stringify(map), SALE_PHOTO_CACHE_TTL); } catch(e) {}
  return map;
}
function clearSalePhotoCache() { CacheService.getScriptCache().remove(SALE_PHOTO_CACHE_KEY); }

function testDoGetSale() {
  const result = doGetSale({ parameter: {} });
  const parsed = JSON.parse(result.getContent());
  Logger.log('ok: '    + parsed.ok);
  Logger.log('count: ' + parsed.count);
  if (parsed.data && parsed.data.length > 0) {
    Logger.log('ตัวอย่าง: ' + JSON.stringify(parsed.data[0], null, 2));
    const withPhoto    = parsed.data.filter(function(p) { return p.thumb; }).length;
    const withoutPhoto = parsed.data.length - withPhoto;
    Logger.log('มีรูป: ' + withPhoto + ' | ไม่มีรูป: ' + withoutPhoto);
  }
}

function testDoGetSaleStaff() {
  const result = doGetSale({ parameter: { token: STAFF_PASSWORD } });
  const parsed = JSON.parse(result.getContent());
  Logger.log('staff: ' + parsed.staff);
  if (parsed.data && parsed.data.length > 0) {
    Logger.log('ตัวอย่าง (มี owner): ' + JSON.stringify(parsed.data[0], null, 2));
  }
}

function debugSalePhotoMap() {
  clearSalePhotoCache();
  const map  = buildSalePhotoMap();
  const keys = Object.keys(map);
  Logger.log('=== Sale Photo Map (' + keys.length + ' รหัส) ===');
  keys.slice(0, 20).forEach(function(k) {
    const e = map[k];
    Logger.log('  ' + k + ': thumb=' + (e.thumb || '-') +
               ' folder=' + e.folderId);
  });
  if (keys.length > 20) Logger.log('  ... และอีก ' + (keys.length - 20));
}


// ════════════════════════════════════════════════════════════
// ═══ วิธี patch doGet() ใน PropertyAllScript.gs (เดิม) ═══════
// ════════════════════════════════════════════════════════════
//
// เปิด PropertyAllScript.gs → หา function doGet(e) { ... }
// → หาบล็อกที่เขียนว่า:
//
//     // ?refresh=1 → ล้าง cache แล้ว scan ใหม่
//     if (params.refresh === '1') {
//       try { clearPhotoCache(); } catch (err) {}
//     }
//
// → **ก่อนหน้า** บล็อกนั้น (และก่อน if format=csv ก็ได้) เพิ่ม 4 บรรทัด:
//
//     // ★ NEW: route ไปฝั่งขายถ้า ?type=sale
//     if (params.type === 'sale') {
//       return doGetSale(e);
//     }
//
// — แค่นี้พอ —
// ─────────────────────────────────────────────────────────────
// ตัวอย่าง doGet เต็ม (หลัง patch):
//
// function doGet(e) {
//   try {
//     const params  = (e && e.parameter) || {};
//     const isStaff = (params.token === STAFF_PASSWORD);
//
//     // ★ NEW: route ฝั่งขาย
//     if (params.type === 'sale') {
//       return doGetSale(e);
//     }
//
//     if (params.format === 'csv')      return _rentSheetAsCSV_();
//     if (params.format === 'folders')  return _foldersAsJSON_();
//     if (params.refresh === '1') {
//       try { clearPhotoCache(); } catch (err) {}
//     }
//     ... (โค้ดเดิมทั้งหมดต่อ)
//   } catch (err) { ... }
// }
//
// ════════════════════════════════════════════════════════════
