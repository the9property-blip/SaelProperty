// Staff-only sales actions. All sale columns are copied unchanged.
const SALE_ACTION_SHEET = 'ขายแล้ว';
const SALE_ACTION_SHEET_ID = 1411184326;
const SALE_ACTION_DESTINATION = '1ghhVmgpI-1N72aorou0Au72el3dqyNg2';
const SALE_ARCHIVE_NAME = '01-ขายแล้ว';
function getSaleArchiveSheet_(ss) {
  const sheet = ss.getSheetByName(SALE_ACTION_SHEET);
  if (!sheet) saleActionError_('missing_sheet');
  if (sheet.getSheetId() !== SALE_ACTION_SHEET_ID) saleActionError_('wrong_archive_sheet');
  return sheet;
}
function salePhotoRoots_() { return [FOLDER_SALE_BAAN, FOLDER_SALE_CONDO].filter(function(id, i, arr) { return id && arr.indexOf(id) === i; }); }
function saleArchiveFolderId_(required) {
  const id = PropertiesService.getScriptProperties().getProperty('SALE_ARCHIVE_FOLDER_ID') || SALE_ACTION_DESTINATION;
  if (!id) { if (required) saleActionError_('destination_mismatch'); return ''; }
  const folder = DriveApp.getFolderById(id), parents = saleFolderParents_(folder);
  if (folder.isTrashed() || folder.getName() !== SALE_ARCHIVE_NAME || parents.length !== 1 || salePhotoRoots_().indexOf(parents[0]) === -1)
    saleActionError_('destination_mismatch');
  return id;
}
// Run once explicitly from Apps Script. Does not move any property.
function setupSaleArchive() {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SS_ID), source = ss.getSheetByName(SHEET_SALE_LIST);
    if (!source) throw new Error('missing_sheet');
    const archive = getSaleArchiveSheet_(ss);
    const width = source.getLastColumn();
    if (archive.getMaxColumns() < width) archive.insertColumnsAfter(archive.getMaxColumns(), width - archive.getMaxColumns());
    if (archive.getLastRow() === 0) source.getRange(1, 1, 1, width).copyTo(archive.getRange(1, 1, 1, width));
    saleArchiveFolderId_(true);
    Logger.log('Sale archive ready');
  } finally { lock.releaseLock(); }
}
function saleRowVersion_(row) {
  const values = row.slice();
  while (values.length && (values[values.length - 1] === '' || values[values.length - 1] == null)) values.pop();
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(values))
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
}
function saleActionError_(code) { const e = new Error(code); e.saleActionError = code; throw e; }
function saleFolderCode_(name) {
  const m = String(name || '').trim().toUpperCase().match(/^((?:S[A-Z]{2}|CO[A-Z]*)\d+)(?=$|[^A-Z0-9])/);
  return m ? m[1] : '';
}
function saleFolderParents_(folder) {
  const it = folder.getParents(), ids = [];
  while (it.hasNext()) ids.push(it.next().getId());
  return ids;
}
function saleFolderInScope_(folder) {
  const seen = {};
  for (let depth = 0; depth < 100; depth++) {
    const id = folder.getId();
    if (salePhotoRoots_().indexOf(id) !== -1) return !folder.isTrashed();
    if (id === saleArchiveFolderId_(false) || id === FOLDER_BAAN || id === FOLDER_CONDO || seen[id]) return false;
    seen[id] = true;
    if (folder.isTrashed()) return false;
    const parents = saleFolderParents_(folder);
    if (parents.length !== 1) return false;
    folder = DriveApp.getFolderById(parents[0]);
  }
  return false;
}
// Breadth-first search. Drive shortcuts are not followed; the archived/sale subtrees are skipped.
function findSaleActionFolders_(code) {
  const queue = salePhotoRoots_(), seen = {}, matches = [], deadline = Date.now() + 45000;
  const fast = typeof Drive !== 'undefined' && Drive.Files && Drive.Files.list;
  let visited = 0;
  const archiveId = saleArchiveFolderId_(false);
  function accept(id, name, parentId) {
    if (seen[id] || id === archiveId || id === FOLDER_BAAN || id === FOLDER_CONDO) return;
    seen[id] = true;
    if (++visited > 5000 || Date.now() > deadline) saleActionError_('folder_scan_timeout');
    if (saleFolderCode_(name) === code) {
      matches.push({ id: id, parentId: parentId });
      if (matches.length > 25) saleActionError_('too_many_folders');
    } else queue.push(id);
  }
  while (queue.length) {
    if (Date.now() > deadline) saleActionError_('folder_scan_timeout');
    if (fast) {
      const batch = queue.splice(0, 20);
      let pageToken = null;
      do {
        if (Date.now() > deadline) saleActionError_('folder_scan_timeout');
        const response = Drive.Files.list({
          q: '(' + batch.map(function(id) { return "'" + id + "' in parents"; }).join(' or ') +
            ") and mimeType='application/vnd.google-apps.folder' and trashed=false",
          fields: 'nextPageToken,files(id,name,parents)', pageSize: 1000, pageToken: pageToken
        });
        (response.files || []).forEach(function(f) {
          const parent = (f.parents || []).filter(function(id) { return batch.indexOf(id) !== -1; })[0];
          if (!parent) saleActionError_('outside_sale');
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
function findSaleSheetRow_(sheet, code) {
  const data = sheet.getDataRange().getValues(), found = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim().toUpperCase() === code) found.push(i + 1);
  }
  if (found.length > 1) saleActionError_('duplicate_code');
  return found.length ? found[0] : 0;
}
function saleArchiveRow_(sheet, job) {
  const marker = 'sale-action:' + job.id, last = sheet.getLastRow();
  if (last > 1) {
    const notes = sheet.getRange(2, 2, last - 1, 1).getNotes();
    const found = [];
    notes.forEach(function(row, i) { if (String(row[0] || '').split('\n').indexOf(marker) !== -1) found.push(i + 2); });
    if (found.length > 1) saleActionError_('archive_conflict');
    if (found.length) return found[0];
  }
  // Completed actions no longer have a tracking note. Match the saved snapshot
  // so a retry can still find the row after rows are inserted or reordered.
  if (job.phase === 'done') {
    const data = last > 1 ? sheet.getRange(2, 1, last - 1, job.width).getValues() : [];
    const found = [];
    data.forEach(function(row, i) {
      if (String(row[1] || '').trim().toUpperCase() === job.code && saleRowVersion_(row) === (job.targetVersion || job.version)) found.push(i + 2);
    });
    if (found.length !== 1) saleActionError_('archive_conflict');
    return found[0];
  }
  return job.archiveRow;
}
function verifySaleArchive_(sheet, row, job) {
  const values = sheet.getRange(row, 1, 1, job.width).getValues()[0];
  if (String(values[1] || '').trim().toUpperCase() !== job.code || saleRowVersion_(values) !== (job.targetVersion || job.version))
    saleActionError_('archive_conflict');
}
function finishSaleAction_(sheet, row, job, props, key) {
  // Save completion BEFORE removing the marker so a lost response can recover.
  job.archiveRow = row;
  job.phase = 'done'; props.setProperty(key, JSON.stringify(job));
  setSaleRevision_(props, job.code, job.id);
  const cell = sheet.getRange(row, 2), marker = 'sale-action:' + job.id;
  const note = cell.getNote() || '';
  const cleaned = note.split('\n').filter(function(line) { return line !== marker; }).join('\n');
  if (cleaned !== note) {
    cell.setNote(cleaned);
    SpreadsheetApp.flush();
  }
}
function markPropertySold_(params) { return transferSaleProperty_(params, false); }

// Restore only to the sales root for the property's original category.
function saleReturnDestination_(type) {
  const id = String(type || '').trim() === 'คอนโด' ? FOLDER_SALE_CONDO : FOLDER_SALE_BAAN;
  if (!saleFolderInScope_(DriveApp.getFolderById(id))) saleActionError_('destination_mismatch');
  return id;
}
function saleTransferValues_(snapshot) { return snapshot.slice(); }
function transferSaleProperty_(params, returning) {
  if (!params || !params.token || params.token !== STAFF_PASSWORD) return _json({ ok: false, error: 'unauthorized' });
  if (params.confirmed !== true) return _json({ ok: false, error: 'confirmation_required' });
  const code = String(params.code || '').trim().toUpperCase();
  if (!/^(?:S[A-Z]{2}|CO[A-Z]*)\d+$/.test(code)) return _json({ ok: false, error: 'invalid_code' });
  if (!/^[a-f0-9]{64}$/.test(String(params.version || ''))) return _json({ ok: false, error: 'invalid_version' });
  let lock, held = false;
  try {
    lock = LockService.getScriptLock();
    held = lock.tryLock(1000);
    if (!held) return _json({ ok: false, error: 'busy' });
    const ss = SpreadsheetApp.openById(SS_ID), source = ss.getSheetByName(returning ? SALE_ACTION_SHEET : SHEET_SALE_LIST), archive = ss.getSheetByName(returning ? SHEET_SALE_LIST : SALE_ACTION_SHEET);
    if (!source || !archive) saleActionError_('missing_sheet');
    getSaleArchiveSheet_(ss);
    assertNoPendingSaleDelete_(code);
    let destination = DriveApp.getFolderById(saleArchiveFolderId_(true));
    const destParents = saleFolderParents_(destination);
    if (destination.isTrashed() || destination.getName() !== '01-ขายแล้ว' ||
        destParents.length !== 1 || salePhotoRoots_().indexOf(destParents[0]) === -1) saleActionError_('destination_mismatch');
    const props = PropertiesService.getScriptProperties(), key = (returning ? 'sale_return_' : 'sale_action_') + code;
    let job = JSON.parse(props.getProperty(key) || 'null');
    let sourceRow = findSaleSheetRow_(source, code);
    if (!sourceRow) {
      if (!job || job.version !== params.version) saleActionError_('source_missing');
      const savedRow = saleArchiveRow_(archive, job);
      verifySaleArchive_(archive, savedRow, job);
      job.folders.forEach(function(f) {
        const folder = DriveApp.getFolderById(f.id), parents = saleFolderParents_(folder);
        if (folder.isTrashed() || saleFolderCode_(folder.getName()) !== code || parents.length !== 1 || parents[0] !== (job.destinationId || saleArchiveFolderId_(true)))
          saleActionError_('sale_incomplete');
      });
      finishSaleAction_(archive, savedRow, job, props, key);
      try { clearSalePhotoCache(); clearSoldPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache(); } catch (e) {}
      return _json({ ok: true, code: code, alreadyDone: true });
    }
    const width = source.getMaxColumns(), snapshot = source.getRange(sourceRow, 1, 1, width).getValues()[0];
    if (saleRequestVersion_(snapshot, returning ? 'sold' : 'active') !== params.version) saleActionError_('source_changed');
    if (job && job.phase !== 'done' && job.version !== params.version) saleActionError_('archive_conflict');
    if (job && job.phase === 'done' && job.version === params.version) saleActionError_('archive_conflict');
    if (!job || job.phase === 'done') {
      if (findSaleSheetRow_(archive, code)) saleActionError_('archive_conflict');
      const destinationId = returning ? saleReturnDestination_(snapshot[5]) : saleArchiveFolderId_(true);
      const folders = [];
      if (returning) {
        const it = DriveApp.getFolderById(saleArchiveFolderId_(true)).getFolders();
        while (it.hasNext()) { const f = it.next(); if (saleFolderCode_(f.getName()) === code) folders.push({ id: f.getId(), parentId: saleArchiveFolderId_(true) }); }
        if (folders.length > 25) saleActionError_('too_many_folders');
      } else folders.push.apply(folders, findSaleActionFolders_(code));
      if (!folders.length) saleActionError_('no_sale_folder');
      folders.forEach(function(f) {
        const folder = DriveApp.getFolderById(f.id);
        if (returning ? saleFolderParents_(folder).length !== 1 || saleFolderParents_(folder)[0] !== saleArchiveFolderId_(true) : !saleFolderInScope_(folder)) saleActionError_('outside_sale');
      });
      const timestamp = new Date().toISOString();
      const targetValues = saleTransferValues_(snapshot, returning, timestamp);
      job = { id: Utilities.getUuid(), code: code, version: params.version, rowVersion: saleRowVersion_(snapshot), targetVersion: saleRowVersion_(targetValues), timestamp: timestamp, destinationId: destinationId, width: width,
        archiveRow: archive.getLastRow() + 1, folders: folders, phase: 'reserved' };
      // Persist the reservation BEFORE writing. Retries reuse the same archive row and folders.
      props.setProperty(key, JSON.stringify(job));
    }
    destination = DriveApp.getFolderById(job.destinationId || saleArchiveFolderId_(true));
    if (returning && !saleFolderInScope_(destination)) saleActionError_('destination_mismatch');
    if (archive.getMaxColumns() < job.width) archive.insertColumnsAfter(archive.getMaxColumns(), job.width - archive.getMaxColumns());
    const archiveRow = saleArchiveRow_(archive, job);
    if (archive.getMaxRows() < archiveRow) archive.insertRowsAfter(archive.getMaxRows(), archiveRow - archive.getMaxRows());
    const target = archive.getRange(archiveRow, 1, 1, job.width), previous = target.getValues()[0];
    if (previous.some(function(v) { return v !== '' && v != null; })) {
      // Recover a copyTo that succeeded before the history write failed.
      if (job.timestamp && job.phase === 'reserved' && saleRowVersion_(previous) === (job.rowVersion || job.version)) {
        target.setValues([saleTransferValues_(snapshot, returning, job.timestamp).map(function(v) { return typeof v === 'string' && v.charAt(0) === '=' ? "'" + v : v; })]);
        SpreadsheetApp.flush();
      }
      verifySaleArchive_(archive, archiveRow, job);
    } else {
      if (job.phase !== 'reserved') saleActionError_('archive_conflict');
      source.getRange(sourceRow, 1, 1, job.width).copyTo(target);
      // Freeze the original values; relative formulas must not recalculate against archive rows.
      target.setValues([(job.timestamp ? saleTransferValues_(snapshot, returning, job.timestamp) : snapshot).slice(0, job.width).map(function(v) { return typeof v === 'string' && v.charAt(0) === '=' ? "'" + v : v; })]);
      SpreadsheetApp.flush();
      verifySaleArchive_(archive, archiveRow, job);
    }
    const codeCell = archive.getRange(archiveRow, 2), marker = 'sale-action:' + job.id;
    const note = codeCell.getNote() || '';
    if (note.split('\n').indexOf(marker) === -1) codeCell.setNote(note + (note ? '\n' : '') + marker);
    job.phase = 'copied'; props.setProperty(key, JSON.stringify(job));
    job.folders.forEach(function(f) {
      const folder = DriveApp.getFolderById(f.id), parents = saleFolderParents_(folder);
      if (folder.isTrashed() || saleFolderCode_(folder.getName()) !== code) saleActionError_('outside_sale');
      if (parents.length === 1 && parents[0] === (job.destinationId || saleArchiveFolderId_(true))) return;
      if (returning ? parents.length !== 1 || parents[0] !== saleArchiveFolderId_(true) : !saleFolderInScope_(folder)) saleActionError_('outside_sale');
      folder.moveTo(destination);
      const movedParents = saleFolderParents_(folder);
      if (movedParents.length !== 1 || movedParents[0] !== (job.destinationId || saleArchiveFolderId_(true))) saleActionError_('sale_incomplete');
    });
    // Locate by code again because editors may have inserted/reordered rows while Drive moved.
    sourceRow = findSaleSheetRow_(source, code);
    if (!sourceRow || saleRowVersion_(source.getRange(sourceRow, 1, 1, job.width).getValues()[0]) !== (job.rowVersion || job.version))
      saleActionError_('source_changed');
    verifySaleArchive_(archive, archiveRow, job);
    source.deleteRow(sourceRow);
    SpreadsheetApp.flush();
    finishSaleAction_(archive, archiveRow, job, props, key);
    try { clearSalePhotoCache(); clearSoldPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache(); } catch (e) {}
    return _json({ ok: true, code: code });
  } catch (err) {
    return _json({ ok: false, error: err.saleActionError || 'sale_incomplete' });
  } finally {
    if (held) lock.releaseLock();
  }
}

function assertNoPendingSaleDelete_(code) {
  const props = PropertiesService.getScriptProperties();
  ['active', 'sold'].forEach(function(dataset) {
    const job = JSON.parse(props.getProperty('sale_delete_' + dataset + '_' + code) || 'null');
    if (job && job.phase !== 'done') saleActionError_('deletion_pending');
  });
}

// Delete only the selected sheet's row and its exact-code sale folders.
// Trash is recoverable; the journal makes retries safe after a lost response.
function deleteSaleProperty_(params) {
  if (!params || !params.token || params.token !== STAFF_PASSWORD) return _json({ ok: false, error: 'unauthorized' });
  if (params.confirmed !== true) return _json({ ok: false, error: 'confirmation_required' });
  if (String(params.deleteCode || '') !== '1140') return _json({ ok: false, error: 'invalid_delete_code' });
  const code = String(params.code || '').trim().toUpperCase();
  if (!/^(?:S[A-Z]{2}|CO[A-Z]*)\d+$/.test(code)) return _json({ ok: false, error: 'invalid_code' });
  if (!/^[a-f0-9]{64}$/.test(String(params.version || ''))) return _json({ ok: false, error: 'invalid_version' });
  if (params.dataset !== 'active' && params.dataset !== 'sold') return _json({ ok: false, error: 'invalid_dataset' });
  let lock, held = false;
  try {
    lock = LockService.getScriptLock(); held = lock.tryLock(1000);
    if (!held) return _json({ ok: false, error: 'busy' });
    const props = PropertiesService.getScriptProperties();
    ['sale_action_', 'sale_return_'].forEach(function(prefix) {
      const transfer = JSON.parse(props.getProperty(prefix + code) || 'null');
      if (transfer && transfer.phase !== 'done') saleActionError_('archive_conflict');
    });
    const ss = SpreadsheetApp.openById(SS_ID);
    const sheet = params.dataset === 'sold' ? getSaleArchiveSheet_(ss) : ss.getSheetByName(SHEET_SALE_LIST);
    if (!sheet) saleActionError_('missing_sheet');
    const key = 'sale_delete_' + params.dataset + '_' + code;
    let job = JSON.parse(props.getProperty(key) || 'null');
    let row = findSaleSheetRow_(sheet, code);
    if (!row) {
      if (!job || job.version !== params.version) saleActionError_('source_missing');
      job.folders.forEach(function(f) { if (!DriveApp.getFolderById(f.id).isTrashed()) saleActionError_('deletion_incomplete'); });
      job.phase = 'done'; props.setProperty(key, JSON.stringify(job));
      setSaleRevision_(props, code, job.id);
      clearSalePhotoCache(); clearSoldPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache();
      return _json({ ok: true, code: code, alreadyDone: true });
    }
    const width = sheet.getMaxColumns();
    const snapshot = sheet.getRange(row, 1, 1, width).getValues()[0];
    if (saleRequestVersion_(snapshot, params.dataset) !== params.version) saleActionError_('source_changed');
    if (job && job.phase !== 'done' && job.version !== params.version) saleActionError_('archive_conflict');
    if (job && job.phase === 'done' && job.version === params.version) saleActionError_('source_changed');
    if (!job || job.phase === 'done') {
      let folders;
      if (params.dataset === 'active') folders = findSaleActionFolders_(code);
      else {
        folders = []; const root = DriveApp.getFolderById(saleArchiveFolderId_(true));
        const parents = saleFolderParents_(root);
        if (root.isTrashed() || parents.length !== 1 || salePhotoRoots_().indexOf(parents[0]) === -1) saleActionError_('destination_mismatch');
        const it = root.getFolders(), deadline = Date.now() + 45000;
        while (it.hasNext()) {
          if (Date.now() > deadline) saleActionError_('folder_scan_timeout');
          const f = it.next();
          if (saleFolderCode_(f.getName()) === code) folders.push({ id: f.getId(), parentId: saleArchiveFolderId_(true) });
          if (folders.length > 25) saleActionError_('too_many_folders');
        }
      }
      job = { id: Utilities.getUuid(), version: params.version, rowVersion: saleRowVersion_(snapshot), folders: folders, phase: 'reserved' };
      props.setProperty(key, JSON.stringify(job));
    }
    function validate(folder, saved) {
      const parents = saleFolderParents_(folder);
      if (saleFolderCode_(folder.getName()) !== code || parents.length !== 1 || parents[0] !== saved.parentId) saleActionError_('outside_sale');
      if (!folder.isTrashed() && (params.dataset === 'active' ? !saleFolderInScope_(folder) : parents[0] !== saleArchiveFolderId_(true))) saleActionError_('outside_sale');
    }
    // Validate every folder before deleting any, including on retries.
    job.folders.forEach(function(f) { validate(DriveApp.getFolderById(f.id), f); });
    job.folders.forEach(function(f) {
      row = findSaleSheetRow_(sheet, code);
      if (!row || saleRowVersion_(sheet.getRange(row, 1, 1, width).getValues()[0]) !== (job.rowVersion || job.version)) saleActionError_('source_changed');
      const folder = DriveApp.getFolderById(f.id); validate(folder, f);
      if (!folder.isTrashed()) folder.setTrashed(true);
      if (!folder.isTrashed()) saleActionError_('deletion_incomplete');
    });
    row = findSaleSheetRow_(sheet, code);
    if (!row || saleRowVersion_(sheet.getRange(row, 1, 1, width).getValues()[0]) !== (job.rowVersion || job.version)) saleActionError_('source_changed');
    sheet.deleteRow(row); SpreadsheetApp.flush();
    job.phase = 'done'; props.setProperty(key, JSON.stringify(job));
    setSaleRevision_(props, code, job.id);
    clearSalePhotoCache(); clearSoldPhotoCache_(); if (typeof clearGeoCache === 'function') clearGeoCache();
    return _json({ ok: true, code: code });
  } catch (err) {
    return _json({ ok: false, error: err.saleActionError || 'deletion_incomplete' });
  } finally { if (held) lock.releaseLock(); }
}

const SALE_PHOTO_MAX_BYTES = 50 * 1024 * 1024;
const SALE_PHOTO_MAX_FILES = 200;
function downloadSalePropertyPhotos_(params) {
  if (!params || !params.token || params.token !== STAFF_PASSWORD) {
    return _json({ ok: false, error: 'unauthorized' });
  }
  const code = String(params.code || '').trim().toUpperCase();
  if (!/^(?:S[A-Z]{2}|CO[A-Z]*)\d+$/.test(code)) {
    return _json({ ok: false, error: 'invalid_code' });
  }
  try {
    // Resolve only known property folders; never accept a folder ID from the browser.
    const map = buildSalePhotoMap(params.dataset === 'sold' ? saleArchiveFolderId_(true) : undefined);
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
      if (totalBytes > SALE_PHOTO_MAX_BYTES || files.length > SALE_PHOTO_MAX_FILES) {
        return _json({ ok: false, error: 'too_large', maxMB: SALE_PHOTO_MAX_BYTES / (1024 * 1024), maxFiles: SALE_PHOTO_MAX_FILES });
      }
    }
    if (!files.length) return _json({ ok: false, error: 'no_photos' });
    files.sort(function(a, b) { return a.getName().localeCompare(b.getName(), 'th', { numeric: true }); });
    let actualBytes = 0;
    const blobs = files.map(function(file, index) {
      const blob = file.getBlob();
      actualBytes += blob.getBytes().length;
      if (actualBytes > SALE_PHOTO_MAX_BYTES) throw new Error('PHOTO_ZIP_TOO_LARGE');
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
      return _json({ ok: false, error: 'too_large', maxMB: SALE_PHOTO_MAX_BYTES / (1024 * 1024), maxFiles: SALE_PHOTO_MAX_FILES });
    }
    // Do not expose Drive IDs or internal exception details in download responses.
    return _json({ ok: false, error: 'archive_failed' });
  }
}


function clearSoldPhotoCache_() { CacheService.getScriptCache().remove('catalog_soldPhotoMap_v2'); }
function getSaleCaption_(params) {
  if (!params.token || params.token !== STAFF_PASSWORD) return _json({ok:false,error:'unauthorized'});
  const code = String(params.code || '').trim().toUpperCase();
  if (!SALE_CODE_REGEX.test(code)) return _json({ok:false,error:'invalid_code'});
  try {
    const map = buildSalePhotoMap(params.dataset === 'sold' ? saleArchiveFolderId_(true) : undefined), entry = map[code];
    if (!entry) return _json({ok:true,caption:''});
    const files = DriveApp.getFolderById(entry.folderId).getFilesByName(code + '-1.txt');
    return _json({ok:true,caption:files.hasNext() ? files.next().getBlob().getDataAsString('UTF-8') : ''});
  } catch(e) { return _json({ok:false,error:'caption_failed'}); }
}
