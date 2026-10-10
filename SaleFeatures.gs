// Optional sale features are appended by header, never put in owner/transfer columns.
// Tokens change after a sale/restore cycle without changing any original sale cells.
function saleRequestVersion_(row, dataset) {
  const hash = saleRowVersion_(row), code = String(row[1] || '').trim().toUpperCase();
  const revision = PropertiesService.getScriptProperties().getProperty('sale_revision_' + dataset + '_' + code);
  return revision ? saleRowVersion_([hash, revision]) : hash;
}
function setSaleRevision_(props, code, id) {
  if (!id) return;
  ['active','sold'].forEach(function(dataset) { props.setProperty('sale_revision_' + dataset + '_' + code, JSON.stringify(id)); });
}
function saleExtraFields_(d) {
  const fields = _roomFeatureValues_(d);
  const grade = String(d.grade || '').trim().toUpperCase();
  if (grade && !/^[A-D]$/.test(grade)) throw new Error('กรุณาเลือกเกรด A, B, C หรือ D');
  [['grade','เกรด'],['pet','สัตว์เลี้ยง'],['negotiate','ต่อรอง'],['titleDeed','โฉนด']].forEach(function(pair) {
    const value = pair[0] === 'grade' ? grade : String(d[pair[0]] || '').trim();
    if (value) fields.push({name:pair[1],value:value});
  });
  return fields;
}
function writeSaleExtraFields_(sheet, row, fields) {
  if (!fields.length) return;
  const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0];
  let next = Math.max(headers.length,29);
  const writes = fields.map(function(field) {
    const found=[];
    const aliases={'ห้องแม่บ้าน':['ห้องแม่บ้าน','maidroom'],'ห้องนอนชั้นล่าง':['ห้องนอนชั้นล่าง','downstairsbedroom'],'เกรด':['เกรด','เกรดทรัพย์','grade'],'สัตว์เลี้ยง':['สัตว์เลี้ยง','pet'],'ต่อรอง':['ต่อรอง','ต่อรองได้','negotiate'],'โฉนด':['โฉนด','titledeed']}[field.name] || [field.name];
    headers.forEach(function(h,i) { if (aliases.indexOf(String(h||'').trim().toLowerCase())!==-1) found.push(i+1); });
    if (found.length>1 || (found.length && found[0]<=26)) throw new Error('หัวคอลัมน์เพิ่มเติมทับข้อมูลขายเดิม: '+field.name);
    return {column:found[0] || ++next,name:field.name,value:field.value,header:!found.length};
  });
  if (sheet.getMaxColumns()<next) sheet.insertColumnsAfter(sheet.getMaxColumns(),next-sheet.getMaxColumns());
  writes.forEach(function(w) {if(w.header)sheet.getRange(1,w.column).setValue(w.name);sheet.getRange(row,w.column).setValue(w.value);});
}

// Complete breadth-first scans use Advanced Drive when available, DriveApp otherwise.
// Shortcuts, rental trees, and sold archives are never followed by the active dataset.
function scanSalePhotos_(archiveRoot) {
  const map={}, queue=archiveRoot ? [archiveRoot] : salePhotoRoots_(), seen={}, properties=[];
  const archiveId=saleArchiveFolderId_(false), deadline=Date.now()+45000;
  const fast=typeof Drive!=='undefined' && Drive.Files && Drive.Files.list;
  let visited=0;
  function check() { if(Date.now()>deadline || visited>5000) throw new Error('folder_scan_timeout'); }
  function accept(id,name,parent) {
    check();
    if(seen[id] || id===FOLDER_BAAN || id===FOLDER_CONDO || (!archiveRoot && (id===archiveId || name===SALE_ARCHIVE_NAME))) return;
    seen[id]=true;visited++;
    const code=saleFolderCode_(name);
    if(code) {
      if(map[code] && map[code].folderId!==id) throw new Error('duplicate_photo_folder:'+code);
      map[code]={folderId:id,thumb:null};properties.push({id:id,code:code,images:[]});
    } else queue.push(id);
  }
  while(queue.length) {
    check();
    if(fast) {
      const batch=queue.splice(0,20);let token=null;
      do {
        check();
        const result=Drive.Files.list({q:'('+batch.map(function(id){return "'"+id+"' in parents";}).join(' or ')+") and mimeType='application/vnd.google-apps.folder' and trashed=false",fields:'nextPageToken,files(id,name,parents)',pageSize:1000,pageToken:token});
        (result.files||[]).forEach(function(f){const parent=(f.parents||[]).filter(function(id){return batch.indexOf(id)!==-1;})[0];if(!parent)throw new Error('outside_sale');accept(f.id,f.name,parent);});
        token=result.nextPageToken;
      } while(token);
    } else {
      const parent=queue.shift(), folders=DriveApp.getFolderById(parent).getFolders();
      while(folders.hasNext()) {check();const f=folders.next();if(!f.isTrashed())accept(f.getId(),f.getName(),parent);}
    }
  }
  if(fast) {
    const pending=properties.slice(), byId={};properties.forEach(function(p){byId[p.id]=p;});
    while(pending.length) {
      const batch=pending.splice(0,20);let token=null;
      do {
        check();const result=Drive.Files.list({q:'('+batch.map(function(p){return "'"+p.id+"' in parents";}).join(' or ')+") and mimeType contains 'image/' and trashed=false",fields:'nextPageToken,files(id,name,parents)',pageSize:1000,pageToken:token});
        (result.files||[]).forEach(function(f){(f.parents||[]).forEach(function(id){if(byId[id])byId[id].images.push({id:f.id,name:f.name});});});token=result.nextPageToken;
      }while(token);
    }
  } else {
    properties.forEach(function(p){const files=DriveApp.getFolderById(p.id).getFiles();while(files.hasNext()){check();const f=files.next();if(f.getMimeType().indexOf('image/')===0)p.images.push({id:f.getId(),name:f.getName()});}});
  }
  properties.forEach(function(p){p.images.sort(function(a,b){return a.name.localeCompare(b.name,'th',{numeric:true});});map[p.code].thumb=p.images.length?p.images[0].id:null;});
  return map;
}
