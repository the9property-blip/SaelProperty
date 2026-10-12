/* Sale-specific parity layer. Original sale fields and pricing are unchanged. */
(function () {
  'use strict';
  var isMap = !!document.getElementById('map');
  if(isMap)document.body.classList.add('sale-map');
  var sold = document.body.dataset.saleDataset === 'sold';
  var fields = ['floorMin','floorMax','landMin','landMax','usableMin','usableMax'];
  var selections = ['selMaidRoom','selDownstairsBedroom','selGrade','selPet'];
  var currentDetail = null, captionGeneration = 0;
  function el(id) { return document.getElementById(id); }
  function value(id) { return el(id) ? el(id).value : ''; }
  function number(v) { var m = String(v == null ? '' : v).replace(/,/g,'').match(/\d+(?:\.\d+)?/); return m ? Number(m[0]) : NaN; }
  function optionSelect(id, label, options) {
    var select = document.createElement('select'); select.id = id; select.className = 'filter-select'; select.setAttribute('aria-label', label);
    options.forEach(function(o) { var option = document.createElement('option'); option.value = o[0]; option.textContent = o[1]; select.appendChild(option); });
    select.onchange = function() { applyFilters(); }; return select;
  }
  var toolbar = document.querySelector('.header-row2');
  var other = optionSelect('selOtherType','ประเภททรัพย์อื่น',[['','ประเภทอื่น'],['ที่ดิน','🌳 ที่ดิน'],['อาคารพาณิชย์','🏬 อาคารพาณิชย์'],['หอพัก','🏢 หอพัก'],['สำนักงาน','🏢 สำนักงาน'],['โกดัง','📦 โกดัง'],['ธุรกิจ','🏪 ธุรกิจ']]); other.classList.add('other-type-select');
  other.onchange = function() { if (this.value) setType(this.value); this.value = ''; }; toolbar.appendChild(other);
  fields.forEach(function(id, i) {
    var input = document.createElement('input'); input.type='number'; input.id=id; input.className='filter-select filter-num'; input.min='0'; input.step='any'; input.inputMode='decimal';
    input.placeholder = ['ชั้นต่ำสุด','ชั้นสูงสุด','ที่ดินต่ำ (ตรว.)','ที่ดินสูง (ตรว.)','ใช้สอยต่ำ (ตรม.)','ใช้สอยสูง (ตรม.)'][i]; input.setAttribute('aria-label',input.placeholder); input.oninput=function(){applyFilters();}; toolbar.appendChild(input);
  });
  var maidRoom = optionSelect('selMaidRoom','ห้องแม่บ้าน',[['all','ห้องแม่บ้าน: ทั้งหมด'],['yes','มีห้องแม่บ้าน'],['no','ไม่มีห้องแม่บ้าน']]); maidRoom.classList.add('room-feature-select'); toolbar.appendChild(maidRoom);
  var downstairsBedroom = optionSelect('selDownstairsBedroom','ห้องนอนชั้นล่าง',[['all','นอนชั้นล่าง: ทั้งหมด'],['yes','มีห้องนอนชั้นล่าง'],['no','ไม่มีห้องนอนชั้นล่าง']]); downstairsBedroom.classList.add('room-feature-select'); toolbar.appendChild(downstairsBedroom);
  toolbar.appendChild(optionSelect('selGrade','เกรดทรัพย์',[['all','⭐ ทุกเกรด'],['A','เกรด A'],['B','เกรด B'],['C','เกรด C'],['D','เกรด D']]));
  toolbar.appendChild(optionSelect('selPet','สัตว์เลี้ยง',[['all','🐾 สัตว์เลี้ยง'],['yes','รับได้'],['no','ไม่รับ']]));
  var separators = Array.prototype.slice.call(toolbar.querySelectorAll('.filter-sep'));
  separators.slice(3).forEach(function(separator) { separator.remove(); });
  var orderedControls = [
    el('selMin'), el('selMax'),
    toolbar.querySelector('[data-type="all"]'),
    toolbar.querySelector('[data-type="บ้านเดี่ยว"]'),
    toolbar.querySelector('[data-type="ทาวน์เฮ้าส์"]'),
    toolbar.querySelector('[data-type="คอนโด"]'),
    toolbar.querySelector('[data-type="พูลวิลล่า"]'), other,
    separators[0], el('btnAgentDirect'), el('btnAgentCo'), el('btnAgentSurvey'),
    separators[1], el('selNeg'), separators[2],
    el('floorMin'), el('floorMax'), el('landMin'), el('landMax'),
    el('usableMin'), el('usableMax'), el('selBed'), el('selBath'),
    maidRoom, downstairsBedroom, el('selGrade'), el('selPet')
  ];
  orderedControls.forEach(function(control) { if (control) toolbar.appendChild(control); });
  var search = document.querySelector('.search-wrap'), geo = document.querySelector('.geo-search-container');
  var tools = document.createElement('div'); tools.className='search-tools'; search.parentNode.insertBefore(tools,search);
  tools.appendChild(search); tools.appendChild(geo); tools.appendChild(el('btnClearFilters')); el('btnClearFilters').classList.add('search-clear-btn');
  function updateSearchHint(){var hint=isStaffLoggedIn()?'รหัส / โครงการ / เจ้าของ / เบอร์โทร':'รหัส / โครงการ / ทำเล';el('searchInput').placeholder=hint;el('searchInput').setAttribute('aria-label','ค้นหา '+hint);el('searchInput').title=hint;}
  updateSearchHint();
  window.saleSearchMatch=function(p,query){
    var publicFields=[p.code,p.project,p.location,p.type];
    if(searchMatch(publicFields.join(' '),query))return true;
    if(!isStaffLoggedIn())return false;
    var staffFields=[p.ownerName,p.contact,p.ownerTel,p.ownerTelRaw];
    if(searchMatch(publicFields.concat(staffFields).join(' '),query))return true;
    var digits=String(query).replace(/\D/g,'');
    return !!digits&&/^[\d\s()+.\-]+$/.test(query)&&[p.ownerTel,p.ownerTelRaw].some(function(phone){return String(phone||'').replace(/\D/g,'').includes(digits);});
  };
  el('geoInput').placeholder='📍 สถานที่ / พิกัด'; el('geoInput').setAttribute('aria-label','ค้นหาสถานที่หรือพิกัด'); el('geoInput').oninput=onGeoInput;
  var staff = document.querySelector('.staff-controls');
  if (!staff) { staff=document.createElement('div'); staff.className='staff-controls'; el('staffBtn').parentNode.insertBefore(staff,el('staffBtn')); staff.appendChild(el('staffBtn')); }
  var nav=document.createElement('div'); nav.className='staff-nav'; staff.appendChild(nav);
  document.querySelectorAll('.rent-link-btn, a[href*="rental-house"], #scheduleBtn, #customerBtn').forEach(function(a){nav.appendChild(a);});
  var staffSection=el('dStaffSection'), photoSlot=document.createElement('div'), actionSlot=document.createElement('div');
  photoSlot.id='dPhotoDownload'; actionSlot.id='dSaleAction'; staffSection.appendChild(photoSlot); staffSection.appendChild(actionSlot);
  var close= document.querySelector('.modal-close');
  if (close) { var bar=document.createElement('div'); bar.className='modal-closebar'; bar.textContent='รายละเอียดทรัพย์'; document.querySelector('#detailOverlay .modal').prepend(bar); bar.appendChild(close); close.type='button'; close.setAttribute('aria-label','ปิดรายละเอียด'); }
  var pageNav=document.createElement('nav');pageNav.className='sale-page-nav';pageNav.setAttribute('aria-label','หน้าเว็บขาย');
  [['index.html','รายการขาย'],['map.html','แผนที่ขาย'],['map-sold.html','ขายแล้ว']].forEach(function(item){var a=document.createElement('a');a.href=item[0];a.textContent=item[1];if(item[0]===(sold?'map-sold.html':isMap?'map.html':'index.html'))a.setAttribute('aria-current','page');pageNav.appendChild(a);});
  staff.prepend(pageNav);staff.appendChild(el('staffBtn'));
  document.querySelector('.header-row1').after(tools);
  document.querySelectorAll('.geo-map-btn').forEach(function(link){link.remove();});
  var advanced=document.createElement('div');advanced.className='sale-advanced';advanced.setAttribute('role','group');advanced.setAttribute('aria-label','ตัวกรองทรัพย์');
  var advancedGrid=document.createElement('div');advancedGrid.className='sale-filter-grid';advanced.appendChild(advancedGrid);
  toolbar.after(advanced);
  var labels={selMin:'ราคาต่ำสุด (บาท)',selMax:'ราคาสูงสุด (บาท)',floorMin:'ชั้นต่ำสุด',floorMax:'ชั้นสูงสุด',landMin:'ที่ดินต่ำสุด (ตร.ว.)',landMax:'ที่ดินสูงสุด (ตร.ว.)',usableMin:'ใช้สอยต่ำสุด (ตร.ม.)',usableMax:'ใช้สอยสูงสุด (ตร.ม.)',selBed:'ห้องนอน',selBath:'ห้องน้ำ',selNeg:'การต่อรอง',selMaidRoom:'ห้องแม่บ้าน',selDownstairsBedroom:'ห้องนอนชั้นล่าง',selGrade:'เกรดทรัพย์',selPet:'สัตว์เลี้ยง'};
  fields.concat(['selBed','selBath','selNeg']).concat(selections).forEach(function(id){var label=document.createElement('label');label.className='sale-filter-field';var text=document.createElement('span');text.textContent=labels[id];label.appendChild(text);label.appendChild(el(id));advancedGrid.appendChild(label);});
  ['btnAgentDirect','btnAgentCo','btnAgentSurvey'].forEach(function(id){advancedGrid.appendChild(el(id));});
  ['selMin','selMax'].forEach(function(id){var label=document.createElement('label');label.className='sale-price-field';var text=document.createElement('span');text.textContent=labels[id];var input=el(id);input.before(label);label.appendChild(text);label.appendChild(input);});
  if(isMap){toolbar.prepend(tools);Array.from(advancedGrid.children).forEach(function(control){toolbar.appendChild(control);});advanced.remove();}
  ['detailOverlay','staffLoginModal'].forEach(function(id){var dialog=el(id);dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',id==='detailOverlay'?'รายละเอียดทรัพย์':'เข้าสู่ระบบ Staff');});
  document.addEventListener('keydown',function(event){if(event.key!=='Tab')return;var dialog=el('staffLoginModal').classList.contains('open')?el('staffLoginModal'):el('detailOverlay').classList.contains('open')?el('detailOverlay'):null;if(!dialog)return;var items=Array.from(dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled)')).filter(function(node){return node.getClientRects().length;});if(!items.length)return;var first=items[0],last=items[items.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});
  window.saleExtraPass = function(p) {
    for (var i=0;i<fields.length;i+=2) {
      var lo=value(fields[i]), hi=value(fields[i+1]);
      if (lo === '' && hi === '') continue;
      var n=number(p[['floor','land','usable'][i/2]]);
      if (!Number.isFinite(n) || (lo!=='' && n<Number(lo)) || (hi!=='' && n>Number(hi))) return false;
    }
    if (value('selGrade')!=='all' && String(p.grade||'').toUpperCase()!==value('selGrade')) return false;
    if (value('selMaidRoom')!=='all' && p.maidRoom!==(value('selMaidRoom')==='yes')) return false;
    if (value('selDownstairsBedroom')!=='all' && p.downstairsBedroom!==(value('selDownstairsBedroom')==='yes')) return false;
    var pet=String(p.pet||'');
    if (value('selPet')==='yes' && (!pet.includes('รับ') || pet.includes('ไม่'))) return false;
    if (value('selPet')==='no' && !pet.includes('ไม่')) return false;
    return true;
  };
  window.updateClearButton=function() {
    var ids=fields.concat(['selMin','selMax','searchInput','geoInput']);
    var on=activeTypes.length>0 || activeAgent!=='all' || ids.some(function(id){return value(id).trim()!=='';}) || selections.concat(['selBed','selBath','selNeg']).some(function(id){return value(id)!=='all';}) || (isMap?!!geoPlace:!!geoOrigin) || (!isMap && value('selSort')!=='price_asc');
    el('btnClearFilters').classList.toggle('visible',on);
  };
  var baseApply=window.applyFilters;
  window.applyFilters=function(){baseApply();updateClearButton();var selected=activeTypes.filter(function(type){return ['บ้านเดี่ยว','ทาวน์เฮ้าส์','คอนโด','พูลวิลล่า'].indexOf(type)===-1;});other.options[0].textContent=selected.length?'ประเภทอื่น: '+selected.join(', '):'ประเภทอื่น';document.querySelectorAll('.type-btn').forEach(function(button){button.setAttribute('aria-pressed',button.classList.contains('active')?'true':'false');});};
  var baseClear=window.clearAllFilters;
  window.clearAllFilters=function(){fields.forEach(function(id){el(id).value='';});selections.forEach(function(id){el(id).value='all';});if(el('selSort'))el('selSort').value='price_asc';clearGeoSearch(true);baseClear();updateClearButton();};
  function featureHtml(p) {
    var labels=[];
    if(p.grade)labels.push('⭐ เกรด '+p.grade);
    if(p.maidRoom===true)labels.push('ห้องแม่บ้าน');
    if(p.downstairsBedroom===true)labels.push('นอนชั้นล่าง');
    return labels.map(function(s){return '<span class="sale-feature-tag">'+escapeHtml(s)+'</span>';}).join('');
  }
  if (isMap) {
    var baseTags=window.tagsHtml;
    window.tagsHtml=function(p,cls){return baseTags(p,cls)+featureHtml(p);};
    var basePopup=window.buildPopup;
    window.buildPopup=function(p){return basePopup(p)+'<div class="sale-popup-download">'+PropertyPhotos.buttonHtml(p.code)+'</div>';};
  } else {
    var baseGrid=window.showGrid;
    window.showGrid=function(data){baseGrid(data);document.querySelectorAll('#grid .card').forEach(function(card,i){var p=data[i];card.querySelector('.card-tags').insertAdjacentHTML('beforeend',featureHtml(p));card.querySelector('.card-footer').insertAdjacentHTML('beforeend',PropertyPhotos.buttonHtml(p.code));});};
  }
  PropertyPhotos.configure({endpoint:SCRIPT_URL,dataset:sold?'sold':'active',getToken:getStaffToken,requestLogin:openStaffModal,onUnauthorized:unauthorized});
  PropertySale.configure({endpoint:SCRIPT_URL,action:sold?'restoreSale':'markSold',getToken:getStaffToken,requestLogin:openStaffModal,notify:showToast,onUnauthorized:unauthorized,onDetailReady:function(p){if(!currentDetail||String(currentDetail.code).toUpperCase()!==String(p.code).toUpperCase())return;allData=allData.map(function(item){return String(item.code).toUpperCase()===String(p.code).toUpperCase()?p:item;});openDetail(p);},onComplete:function(code){PropertyPhotos.reset();allData=allData.filter(function(p){return p.code.toUpperCase()!==code.toUpperCase();});closeDetail();if(isMap)buildEntries(allData);applyFilters();loadData(false);}});
  function unauthorized(){try{StaffSession.clear();}catch(e){}updateStaffBtn();closeDetail();loadData(false);}
  var baseDetail=window.openDetail;
  window.openDetail=function(p){p=allData.find(function(item){return String(item.code).toUpperCase()===String(p.code).toUpperCase();})||p;currentDetail=p;baseDetail(p);staffSection.style.display=isStaffLoggedIn()?'':'none';PropertyPhotos.setDetail(p.code);PropertySale.setDetail(p);var old=el('dSaleFeatures');if(old)old.remove();var extra=document.createElement('div');extra.id='dSaleFeatures';extra.className='sale-detail-features';extra.innerHTML=featureHtml(p);(el('dPricePer')||document.querySelector('#detailOverlay .modal-price')).insertAdjacentElement('afterend',extra);if(close)close.focus({preventScroll:true});};
  var baseClose=window.closeDetail;
  window.closeDetail=function(){currentDetail=null;captionGeneration++;PropertySale.setDetail(null);PropertyPhotos.reset();baseClose();};
  var baseStaff=window.updateStaffBtn;
  window.updateStaffBtn=function(){baseStaff();updateSearchHint();PropertyPhotos.refreshButtons();if(!isStaffLoggedIn()){closeDetail();allData=allData.map(function(p){var clean=Object.assign({},p);['ownerName','ownerTel','ownerTelRaw','contact','facebook','folderUrl','saleVersion'].forEach(function(k){delete clean[k];});return clean;});if(sold){allData=[];if(isMap&&map){buildEntries([]);applyFilters();}el('cardStrip').textContent='🔒 กรุณาเข้าสู่ระบบทีมงานเพื่อดูทรัพย์ขายแล้ว';}}};
  // One lifecycle for catalog, map, sold map and login; requests never patch global fetch.
  var api=SaleApi.create(SCRIPT_URL,sold?'sold':'active');
  var statusBar=document.createElement('div');statusBar.className='sale-status';
  var statusText=document.createElement('span');statusText.id='saleStatusText';statusText.setAttribute('role','status');statusText.setAttribute('aria-live','polite');
  var reload=document.createElement('button');reload.type='button';reload.id='saleReload';reload.textContent='โหลดข้อมูลใหม่';reload.onclick=function(){loadData(true);};
  statusBar.appendChild(statusText);statusBar.appendChild(reload);document.querySelector('.header').after(statusBar);
  function status(message,kind){statusText.textContent=message;statusBar.dataset.state=kind||'ready';}
  function errorText(error){return ({unauthorized:'รหัส Staff ไม่ถูกต้องหรือสิทธิ์หมดอายุ',backend_update_required:'ระบบออนไลน์ยังไม่รองรับหน้านี้ กรุณาอัปเดตระบบก่อนใช้งาน',wrong_dataset:'ระบบส่งข้อมูลผิดชุด กรุณาติดต่อผู้ดูแล',invalid_response:'ระบบตอบข้อมูลไม่ถูกต้อง กรุณาตรวจการเผยแพร่ระบบ',server_error:'ระบบอ่านข้อมูลไม่สำเร็จ กรุณาลองใหม่',AbortError:'การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่'})[error.message||error.name]||'เชื่อมต่อข้อมูลไม่สำเร็จ กรุณาลองใหม่';}
  window.SaleApp=(function(){
    var sequence=0,controller=null,loginSequence=0,firstLoad=true;
    function cancel(){sequence++;if(controller)controller.abort();controller=null;reload.disabled=false;var refresh=el('btnRefresh');if(refresh){refresh.disabled=false;refresh.classList.remove('spinning');}}
    function render(result,fit){
      allData=result.data;
      if(isMap){buildEntries(allData);buildLandmarks();}
      applyFilters();
      if(isMap&&(firstLoad||fit))fitAll();firstLoad=false;
      var unsupported=getStaffToken()&&allData.some(function(p){return !/^[a-f0-9]{64}$/.test(String(p.saleVersion||''));});
      status(unsupported?'ดูข้อมูลได้ แต่ระบบออนไลน์ยังไม่พร้อมขาย/ลบ กรุณาอัปเดต Apps Script':(sold?'ทรัพย์ขายแล้ว':'ทรัพย์กำลังขาย')+' · '+allData.length+' รายการ · '+(getStaffToken()?'Staff':'ผู้เข้าชม'),unsupported?'warning':'ready');
    }
    function clear(){allData=[];closeDetail();if(isMap&&map)buildEntries([]);applyFilters();}
    async function load(refresh){
      cancel();var seq=sequence,token=getStaffToken();
      if(sold&&!token){clear();status('เข้าสู่ระบบ Staff เพื่อดูทรัพย์ขายแล้ว','locked');el('cardStrip').textContent='กรุณากด Staff เพื่อเข้าสู่ระบบ';return false;}
      controller=new AbortController();reload.disabled=true;status('กำลังโหลดข้อมูล…','loading');
      var oldRefresh=el('btnRefresh');if(oldRefresh)oldRefresh.disabled=true;
      try{
        var result=await api.catalog(token,refresh,controller.signal);
        if(seq!==sequence||token!==getStaffToken())return false;
        render(result,refresh);return true;
      }catch(error){
        if(seq!==sequence||token!==getStaffToken())return false;
        if(error.message==='unauthorized'){StaffSession.clear();lastStaffToken='';clear();updateStaffBtn();}
        status(errorText(error),'error');
        if(!allData.length){if(isMap){el('cardStrip').textContent=errorText(error);el('countPill').textContent='ยังไม่ได้โหลดข้อมูล';}else showError(errorText(error));}
        return false;
      }finally{if(seq===sequence){controller=null;reload.disabled=false;if(oldRefresh){oldRefresh.disabled=false;oldRefresh.classList.remove('spinning');}}}
    }
    async function login(){
      var input=el('staffPasswordInput'),password=input.value,err=el('staffLoginErr'),seq=++loginSequence;
      if(!password){err.textContent='กรุณาใส่รหัสผ่าน';return false;}
      cancel();var initialToken=getStaffToken(),submit=document.querySelector('.btn-login-go');if(submit)submit.disabled=true;
      err.textContent='กำลังตรวจสอบสิทธิ์…';
      try{
        var result=await api.catalog(password,false);
        if(seq!==loginSequence||getStaffToken()!==initialToken)return false;
        StaffSession.set(password);
        if(getStaffToken()!==password)throw new Error('cookies_blocked');
        lastStaffToken=password;input.value='';updateStaffBtn();render(result,true);closeStaffModal();showToast('เข้าสู่ระบบ Staff แล้ว');return true;
      }catch(error){if(seq===loginSequence)err.textContent=error.message==='cookies_blocked'?'กรุณาอนุญาตคุกกี้ของเว็บไซต์เพื่อเข้าสู่ระบบ':errorText(error);return false;}
      finally{if(seq===loginSequence&&submit)submit.disabled=false;reload.disabled=false;}
    }
    return {load:load,login:login,cancelLogin:function(){loginSequence++;var submit=document.querySelector('.btn-login-go');if(submit)submit.disabled=false;},sync:function(){cancel();clear();updateStaffBtn();return load(false);}};
  })();
  window.loadCaption=function(code,refresh){
    var seq=++captionGeneration,token=getStaffToken(),block=el('dCaptionBlock'),pre=el('dCaptionText'),retry=el('dCaptionRetry');
    if(retry)retry.remove();
    _captionText='';block.style.display='none';if(!token)return;block.style.display='';pre.textContent='กำลังโหลดข้อความประกาศ…';
    function failed(message){
      pre.textContent=message;
      var button=document.createElement('button');button.id='dCaptionRetry';button.type='button';button.className='sale-action-button';button.textContent='โหลดประกาศใหม่';
      button.onclick=function(){loadCaption(code,true);};block.appendChild(button);
    }
    var messages={
      unauthorized:'สิทธิ์ Staff หมดอายุ กรุณาเข้าสู่ระบบใหม่',
      no_sale_folder:'ไม่พบโฟลเดอร์ของทรัพย์นี้ กรุณาตรวจลิงก์ Drive',
      caption_missing:'ไม่พบไฟล์ประกาศของทรัพย์นี้ใน Drive',
      caption_empty:'ไฟล์ประกาศไม่มีข้อความ',
      duplicate_caption:'พบไฟล์ประกาศชื่อเดียวกันซ้ำ กรุณาตรวจไฟล์ใน Drive',
      caption_failed:'อ่านไฟล์ประกาศไม่สำเร็จ กรุณาตรวจสิทธิ์ Drive ของ Apps Script แล้วลองใหม่'
    };
    var url=SCRIPT_URL+'?type=sale&action=caption&dataset='+(sold?'sold':'active')+'&code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token)+'&_t='+Date.now()+(refresh?'&refresh=1':'');
    fetch(url,{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('network');return r.json();}).then(function(j){
      if(seq!==captionGeneration||getStaffToken()!==token)return;
      if(!j.ok){
        if(j.error==='unauthorized'){unauthorized();return;}
        var error=j.error||(j.msg==='no caption'?'caption_missing':j.msg==='no folder'?'no_sale_folder':'');
        failed(messages[error]||'ระบบออนไลน์ยังไม่พร้อมอ่านประกาศ กรุณาให้ผู้ดูแลอัปเดตระบบ');return;
      }
      if(typeof j.caption!=='string'){failed('ระบบออนไลน์ยังไม่ส่งข้อความประกาศ กรุณาให้ผู้ดูแลอัปเดตระบบ');return;}
      _captionText=j.caption.trim();
      if(!_captionText){failed('ยังไม่ได้รับข้อความประกาศ กรุณาโหลดประกาศใหม่หรือตรวจไฟล์ใน Drive');return;}
      pre.textContent=_captionText;
    }).catch(function(){if(seq===captionGeneration&&getStaffToken()===token)failed('เชื่อมต่อเพื่อโหลดประกาศไม่สำเร็จ กรุณาลองใหม่');});
  };
  // Deauthentication cancels downloads and pending confirmations immediately.
  var lastStaffToken=getStaffToken();
  window.addEventListener('focus',function(){var token=getStaffToken();if(token!==lastStaffToken){lastStaffToken=token;SaleApp.sync();}});
  var baseStaffClick=window.staffBtnClick;
  window.staffBtnClick=function(){baseStaffClick();if(!getStaffToken()){PropertyPhotos.reset();PropertySale.setDetail(null);}};
  var baseStaffClose=window.closeStaffModal;
  window.closeStaffModal=function(){SaleApp.cancelLogin();baseStaffClose();if(getStaffToken()){PropertyPhotos.onLogin();}else{PropertyPhotos.cancelLogin();}};
})();
