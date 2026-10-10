/* Sale-specific parity layer. Original sale fields and pricing are unchanged. */
(function () {
  'use strict';
  var isMap = !!document.getElementById('map');
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
  var other = optionSelect('selOtherType','ประเภททรัพย์อื่น',[['','ประเภทอื่น'],['ที่ดิน','🌳 ที่ดิน'],['อาคารพาณิชย์','🏬 อาคารพาณิชย์'],['หอพัก','🏢 หอพัก'],['สำนักงาน','🏢 สำนักงาน'],['โกดัง','📦 โกดัง'],['ธุรกิจ','🏪 ธุรกิจ']]);
  other.onchange = function() { if (this.value) setType(this.value); this.value = ''; }; toolbar.appendChild(other);
  fields.forEach(function(id, i) {
    var input = document.createElement('input'); input.type='number'; input.id=id; input.className='filter-select filter-num'; input.min='0'; input.step='any'; input.inputMode='decimal';
    input.placeholder = ['ชั้นต่ำสุด','ชั้นสูงสุด','ที่ดินต่ำ (ตรว.)','ที่ดินสูง (ตรว.)','ใช้สอยต่ำ (ตรม.)','ใช้สอยสูง (ตรม.)'][i]; input.setAttribute('aria-label',input.placeholder); input.oninput=function(){applyFilters();}; toolbar.appendChild(input);
  });
  toolbar.appendChild(optionSelect('selMaidRoom','ห้องแม่บ้าน',[['all','ห้องแม่บ้าน: ทั้งหมด'],['yes','มีห้องแม่บ้าน'],['no','ไม่มีห้องแม่บ้าน']]));
  toolbar.appendChild(optionSelect('selDownstairsBedroom','ห้องนอนชั้นล่าง',[['all','นอนชั้นล่าง: ทั้งหมด'],['yes','มีห้องนอนชั้นล่าง'],['no','ไม่มีห้องนอนชั้นล่าง']]));
  toolbar.appendChild(optionSelect('selGrade','เกรดทรัพย์',[['all','⭐ ทุกเกรด'],['A','เกรด A'],['B','เกรด B'],['C','เกรด C'],['D','เกรด D']]));
  toolbar.appendChild(optionSelect('selPet','สัตว์เลี้ยง',[['all','🐾 สัตว์เลี้ยง'],['yes','รับได้'],['no','ไม่รับ']]));
  var search = document.querySelector('.search-wrap'), geo = document.querySelector('.geo-search-container');
  var tools = document.createElement('div'); tools.className='search-tools'; search.parentNode.insertBefore(tools,search);
  tools.appendChild(search); tools.appendChild(geo); tools.appendChild(el('btnClearFilters')); el('btnClearFilters').classList.add('search-clear-btn');
  el('searchInput').placeholder='หมู่บ้าน / รหัส'; el('searchInput').setAttribute('aria-label','ค้นหาหมู่บ้าน โครงการ ทำเล หรือรหัสทรัพย์');
  el('geoInput').placeholder='📍 สถานที่ / พิกัด'; el('geoInput').setAttribute('aria-label','ค้นหาสถานที่หรือพิกัด'); el('geoInput').oninput=onGeoInput;
  var staff = document.querySelector('.staff-controls');
  if (!staff) { staff=document.createElement('div'); staff.className='staff-controls'; el('staffBtn').parentNode.insertBefore(staff,el('staffBtn')); staff.appendChild(el('staffBtn')); }
  var nav=document.createElement('div'); nav.className='staff-nav'; staff.appendChild(nav);
  document.querySelectorAll('.rent-link-btn, #scheduleBtn, #customerBtn').forEach(function(a){nav.appendChild(a);});
  var archiveLink=document.createElement('a'); archiveLink.id='soldMapLink'; archiveLink.className='nav-link-btn'; archiveLink.href=sold?'map.html':'map-sold.html'; archiveLink.textContent=sold?'🏷️ ทรัพย์กำลังขาย':'🗺️ ทรัพย์ขายแล้ว'; nav.prepend(archiveLink);
  var staffSection=el('dStaffSection'), photoSlot=document.createElement('div'), actionSlot=document.createElement('div');
  photoSlot.id='dPhotoDownload'; actionSlot.id='dSaleAction'; staffSection.appendChild(photoSlot); staffSection.appendChild(actionSlot);
  var close= document.querySelector('.modal-close');
  if (close) { var bar=document.createElement('div'); bar.className='modal-closebar'; bar.textContent='รายละเอียดทรัพย์'; document.querySelector('#detailOverlay .modal').prepend(bar); bar.appendChild(close); close.type='button'; close.setAttribute('aria-label','ปิดรายละเอียด'); }
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
  window.applyFilters=function(){baseApply();updateClearButton();};
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
  PropertySale.configure({endpoint:SCRIPT_URL,action:sold?'restoreSale':'markSold',getToken:getStaffToken,requestLogin:openStaffModal,notify:showToast,onUnauthorized:unauthorized,onComplete:function(code){PropertyPhotos.reset();allData=allData.filter(function(p){return p.code.toUpperCase()!==code.toUpperCase();});closeDetail();if(isMap)buildEntries(allData);applyFilters();loadData(false);}});
  function unauthorized(){try{sessionStorage.removeItem('staff_token');}catch(e){}updateStaffBtn();closeDetail();loadData(false);}
  var baseDetail=window.openDetail;
  window.openDetail=function(p){currentDetail=p;baseDetail(p);staffSection.style.display=isStaffLoggedIn()?'':'none';PropertyPhotos.setDetail(p.code);PropertySale.setDetail(p);var old=el('dSaleFeatures');if(old)old.remove();var extra=document.createElement('div');extra.id='dSaleFeatures';extra.className='sale-detail-features';extra.innerHTML=featureHtml(p);(el('dPricePer')||document.querySelector('#detailOverlay .modal-price')).insertAdjacentElement('afterend',extra);};
  var baseClose=window.closeDetail;
  window.closeDetail=function(){currentDetail=null;captionGeneration++;PropertySale.cancelConfirmation();PropertyPhotos.reset();baseClose();};
  var baseStaff=window.updateStaffBtn;
  window.updateStaffBtn=function(){baseStaff();archiveLink.style.display=isStaffLoggedIn()?'':'none';PropertyPhotos.refreshButtons();if(!isStaffLoggedIn()){closeDetail();allData=allData.map(function(p){var clean=Object.assign({},p);['ownerName','ownerTel','ownerTelRaw','contact','facebook','folderUrl','saleVersion'].forEach(function(k){delete clean[k];});return clean;});if(sold){allData=[];if(isMap&&map){buildEntries([]);applyFilters();}el('cardStrip').textContent='🔒 กรุณาเข้าสู่ระบบทีมงานเพื่อดูทรัพย์ขายแล้ว';}}};
  // Keep archive routing and staff token rules consistent for loading and login.
  var originalFetch=window.fetch.bind(window);
  window.fetch=function(input,options){var catalogRequest=typeof input==='string'&&input.indexOf(SCRIPT_URL+'?')===0&&input.indexOf('type=sale')!==-1;var requestedToken=getStaffToken();if(sold&&catalogRequest){input+='&dataset=sold';}var result=originalFetch(input,options);if(!catalogRequest)return result;return result.then(function(response){var originalJson=response.json.bind(response);response.json=function(){return originalJson().then(function(data){if(getStaffToken()!==requestedToken)return {ok:false,error:'session_changed'};if(requestedToken&&data.staff===false){try{sessionStorage.removeItem('staff_token');}catch(e){}updateStaffBtn();}return data;});};return response;});};
  window.loadCaption=function(code){var seq=++captionGeneration,token=getStaffToken(),block=el('dCaptionBlock'),pre=el('dCaptionText');_captionText='';block.style.display='none';if(!token)return;block.style.display='';pre.textContent='กำลังโหลด…';fetch(SCRIPT_URL+'?type=sale&action=caption&code='+encodeURIComponent(code)+'&token='+encodeURIComponent(token)+(sold?'&dataset=sold':'')).then(function(r){return r.json();}).then(function(j){if(seq!==captionGeneration||getStaffToken()!==token)return;_captionText=j.ok?j.caption||'':'';pre.textContent=_captionText||'— ยังไม่มีไฟล์ประกาศ';}).catch(function(){if(seq===captionGeneration)pre.textContent='— โหลดไม่สำเร็จ';});};
  if (sold) { el('cardStrip').textContent='🔒 กรุณาเข้าสู่ระบบทีมงานเพื่อดูทรัพย์ขายแล้ว'; var baseLoad=window.loadData; window.loadData=function(){if(!getStaffToken())return;baseLoad.apply(this,arguments);}; }
  // Deauthentication cancels downloads and pending confirmations immediately.
  var baseStaffClick=window.staffBtnClick;
  window.staffBtnClick=function(){baseStaffClick();if(!getStaffToken()){PropertyPhotos.reset();PropertySale.setDetail(null);}};
  var baseStaffClose=window.closeStaffModal;
  window.closeStaffModal=function(){baseStaffClose();if(getStaffToken()){PropertyPhotos.onLogin();}else{PropertyPhotos.cancelLogin();}};
})();
