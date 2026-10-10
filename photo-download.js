/* Shared by the catalog and map. The server authenticates both original images and ZIPs. */
window.PropertyPhotos = (function () {
  'use strict';
  var config, pendingCode = null, activeCode = null, controller = null;
  var generation = 0, objectUrl = null, panel = null;
  var readyImages = null;
  var detailCode = null;

  function isMobile() {
    // Include iPads requesting desktop sites; do not classify touch Windows PCs as phones.
    var ua = navigator.userAgent || '';
    return !!(navigator.userAgentData && navigator.userAgentData.mobile) ||
      /Android|iPhone|iPad|iPod/i.test(ua) ||
      (/Macintosh|MacIntel/i.test(ua + ' ' + (navigator.platform || '')) && navigator.maxTouchPoints > 1);
  }

  function escapeAttr(value) {
    return String(value || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function label() {
    if (isMobile()) return config && config.getToken() ? '📲 บันทึกรูปทั้งหมด' : '🔒 บันทึกรูป (ล็อกอิน)';
    return config && config.getToken() ? '⬇ ดาวน์โหลดรูปทั้งหมด (ZIP)' : '🔒 ดาวน์โหลดรูป (ล็อกอิน)';
  }
  function buttonHtml(code) {
    return '<button type="button" class="photo-download-button" data-photo-code="' + escapeAttr(code) +
      '" onclick="event.stopPropagation();PropertyPhotos.download(this.dataset.photoCode)">' + label() + '</button>';
  }
  function refreshButtons() {
    document.querySelectorAll('[data-photo-code]').forEach(function (button) {
      button.disabled = !!activeCode;
      button.textContent = activeCode === button.dataset.photoCode ? '⏳ กำลังรวมรูป…' : label();
    });
  }
  function cleanup() {
    readyImages = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = null;
    if (panel) panel.remove();
    panel = null;
  }
  function reset() {
    generation++;
    if (controller) controller.abort();
    controller = null;
    activeCode = null;
    pendingCode = null;
    cleanup();
    refreshButtons();
  }
  function showPanel(message, isError) {
    cleanup();
    panel = document.createElement('section');
    panel.className = 'photo-download-panel';
    panel.setAttribute('aria-label', 'ดาวน์โหลดรูปภาพ');
    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'photo-download-close';
    close.setAttribute('aria-label', 'ปิดการดาวน์โหลด');
    close.textContent = '×';
    close.onclick = reset;
    var status = document.createElement('p');
    status.setAttribute('role', isError ? 'alert' : 'status');
    status.textContent = message;
    panel.appendChild(close);
    panel.appendChild(status);
    document.getElementById('dStaffSection').appendChild(panel);
    if (panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return status;
  }
  function decodeBytes(base64) {
    var chunks = [];
    // Decode aligned chunks to avoid a second full-size binary string on mobile.
    for (var offset = 0; offset < base64.length; offset += 32768) {
      var binary = atob(base64.slice(offset, offset + 32768));
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      chunks.push(bytes);
    }
    return chunks;
  }
  function decodeZip(base64) {
    var chunks = decodeBytes(base64);
    if (!chunks.length || chunks[0][0] !== 80 || chunks[0][1] !== 75 || chunks[0][2] !== 3 || chunks[0][3] !== 4) {
      throw new Error('invalid_archive');
    }
    return new Blob(chunks, { type: 'application/zip' });
  }
  function zipFallback(code) {
    var zip = document.createElement('button');
    zip.type = 'button';
    zip.className = 'photo-download-save';
    zip.textContent = 'ดาวน์โหลด ZIP แทน';
    zip.onclick = function () { download(code, true); };
    panel.appendChild(zip);
  }
  function showUnsupported(code) {
    showPanel('เครื่องหรือเบราว์เซอร์นี้ไม่รองรับการบันทึกรูปทั้งหมดพร้อมกัน ลองเปิดใน Safari หรือ Chrome หรือใช้ ZIP แทน');
    zipFallback(code);
  }
  function showImages(result, code, token) {
    if (result.format !== 'images' || !Array.isArray(result.images) || !result.count || result.images.length !== result.count) {
      throw new Error('invalid_images');
    }
    var files;
    try {
      files = result.images.map(function (item) {
        if (!/^image\//i.test(item.mimeType) || typeof item.base64 !== 'string' || !item.base64 || !item.name) throw new Error();
        var file = new File(decodeBytes(item.base64), item.name, { type: item.mimeType });
        if (!file.size) throw new Error();
        return file;
      });
    } catch (_) { throw new Error('invalid_images'); }
    var supported = false;
    try { supported = navigator.canShare({ files: files }); } catch (_) {}
    if (!supported) { showUnsupported(code); return; }
    var status = showPanel('เตรียมครบ ' + files.length + ' รูปแล้ว แตะ “บันทึกรูปทั้งหมด” แล้วเลือกบันทึกหรือแอปปลายทางในเมนูของเครื่อง');
    var share = document.createElement('button');
    share.type = 'button';
    share.className = 'photo-download-save';
    share.textContent = '📲 บันทึกรูปทั้งหมด';
    var state = { code: code, token: token, busy: false, share: async function () {
      if (readyImages !== state || state.busy) return;
      if (config.getToken() !== token) { reset(); download(code); return; }
      state.busy = true;
      share.disabled = true;
      try {
        // Call directly in the tap handler: fetching first would lose user activation.
        await navigator.share({ files: files, title: 'รูปทรัพย์ ' + code });
        if (readyImages === state) status.textContent = 'ส่งรูปให้เมนูของเครื่องแล้ว หากต้องการบันทึกอีกครั้ง ให้แตะปุ่มด้านล่าง';
      } catch (err) {
        if (readyImages === state) status.textContent = err.name === 'AbortError' ?
          'ปิดเมนูแล้ว สามารถแตะ “บันทึกรูปทั้งหมด” เพื่อลองอีกครั้งได้' :
          'เครื่องไม่สามารถบันทึกรูปชุดนี้ได้ ลองอีกครั้งหรือดาวน์โหลด ZIP แทน';
      } finally { state.busy = false; share.disabled = false; }
    } };
    readyImages = state;
    share.onclick = state.share;
    panel.appendChild(share);
    zipFallback(code);
  }
  function showReady(blob, filename, count) {
    var status = showPanel('รวมรูปครบ ' + count + ' รูปแล้ว กำลังเริ่มดาวน์โหลด หากไฟล์ไม่เริ่มโหลด ให้แตะ “บันทึก ZIP”');
    objectUrl = URL.createObjectURL(blob);
    var save = document.createElement('a');
    save.className = 'photo-download-save';
    save.href = objectUrl;
    save.download = filename;
    save.textContent = '⬇ บันทึก ZIP';
    panel.appendChild(save);
    // File sharing needs a fresh user gesture (especially on iOS).
    try {
      var file = new File([blob], filename, { type: 'application/zip' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        var share = document.createElement('button');
        share.type = 'button';
        share.className = 'photo-download-save';
        share.textContent = 'บันทึก / แชร์ไฟล์';
        share.onclick = async function () {
          try { await navigator.share({ files: [file], title: filename }); }
          catch (err) {
            if (err.name !== 'AbortError') status.textContent = 'แชร์ไฟล์ไม่ได้ กรุณาใช้ปุ่ม “บันทึก ZIP”';
          }
        };
        panel.appendChild(share);
      }
    } catch (_) { /* File sharing is optional; the download link remains available. */ }
    save.click();
  }
  async function download(code, zipOnly) {
    if (!config || activeCode) return;
    code = String(code || '').trim().toUpperCase();
    if (!/^(?:S[A-Z]{2}|CO[A-Z]*)\d+$/.test(code)) {
      showPanel('รหัสทรัพย์ไม่ถูกต้อง กรุณาโหลดหน้าเว็บใหม่', true);
      return;
    }
    var token = config.getToken();
    if (!token) {
      cleanup();
      pendingCode = { code: code, zipOnly: !!zipOnly };
      config.requestLogin();
      return;
    }
    var mobileImages = isMobile() && !zipOnly;
    if (mobileImages && readyImages && readyImages.code === code && readyImages.token === token) {
      return readyImages.share();
    }
    if (mobileImages && (!navigator.share || !navigator.canShare || typeof File === 'undefined')) {
      showUnsupported(code);
      return;
    }
    pendingCode = null;
    activeCode = code;
    var current = ++generation;
    controller = new AbortController();
    var requestController = controller;
    var signal = controller.signal;
    var timedOut = false;
    var timeout = setTimeout(function () { timedOut = true; requestController.abort(); }, 180000);
    showPanel(mobileImages ? 'กำลังเตรียมรูปทั้งหมดของ ' + code + ' เมื่อพร้อมแล้วให้แตะบันทึกอีกครั้ง…' :
      'กำลังรวมรูปทั้งหมดของ ' + code + ' เป็น ZIP กรุณารอสักครู่…');
    refreshButtons();
    try {
      // text/plain keeps this a CORS simple request supported by Apps Script.
      // Never put the download credential in the URL or persist the generated ZIP.
      var response = await fetch(config.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ action: 'downloadSalePhotos', code: code, token: token, dataset: config.dataset, format: mobileImages ? 'images' : 'zip' }),
        credentials: 'omit', cache: 'no-store', redirect: 'follow', signal: signal
      });
      if (!response.ok) throw new Error('network');
      var result = await response.json();
      if (current !== generation) return;
      if (config.getToken() !== token) { cleanup(); return; }
      if (result.error === 'unauthorized') {
        config.onUnauthorized();
        pendingCode = { code: code, zipOnly: !!zipOnly };
        cleanup();
        config.requestLogin();
        return;
      }
      if (!result.ok) {
        var messages = {
          no_folder: 'ยังไม่พบโฟลเดอร์รูปของทรัพย์นี้',
          no_photos: 'ยังไม่มีรูปภาพในโฟลเดอร์ทรัพย์นี้',
          too_large: 'รูปทั้งหมดเกินขีดจำกัด ' + (Number(result.maxMB) || 50) + ' MB หรือ ' + (Number(result.maxFiles) || 200) + ' รูป จึงยังเตรียมไฟล์ไม่ได้ กรุณาติดต่อผู้ดูแล',
          invalid_code: 'รหัสทรัพย์ไม่ถูกต้อง',
          archive_failed: 'รวมรูปไม่สำเร็จ กรุณาลองอีกครั้ง'
        };
        throw new Error(messages[result.error] || 'ระบบดาวน์โหลดยังไม่พร้อม กรุณาติดต่อผู้ดูแลให้อัปเดตระบบ');
      }
      if (mobileImages) { showImages(result, code, token); return; }
      if (result.mimeType !== 'application/zip' || typeof result.base64 !== 'string' || !result.count) {
        throw new Error('invalid_archive');
      }
      showReady(decodeZip(result.base64), code + '-photos.zip', result.count);
    } catch (err) {
      if (current !== generation) return;
      var message = timedOut ? 'ใช้เวลารวมรูปนานเกินไป กรุณาลองอีกครั้ง' :
        (err instanceof TypeError || err instanceof SyntaxError || err.message === 'network' ?
          'เชื่อมต่อระบบดาวน์โหลดไม่ได้ กรุณาลองอีกครั้ง หากยังไม่ได้ ให้เปิดเว็บใน Safari หรือ Chrome' :
          err.message === 'invalid_images' ? 'ได้รับรูปไม่ครบหรือระบบยังไม่รองรับ กรุณาลองอีกครั้งหรือติดต่อผู้ดูแลให้อัปเดตระบบ' :
          err.message === 'invalid_archive' ? 'ไฟล์ ZIP ไม่สมบูรณ์ กรุณาลองอีกครั้ง' : err.message);
      showPanel(message, true);
      if (mobileImages && err.message === 'invalid_images') zipFallback(code);
    } finally {
      clearTimeout(timeout);
      if (current === generation) {
        activeCode = null;
        controller = null;
        refreshButtons();
      }
    }
  }
  return {
    configure: function (options) { config = options; },
    buttonHtml: buttonHtml,
    refreshButtons: refreshButtons,
    setDetail: function (code) {
      if (detailCode && detailCode !== code) reset();
      detailCode = code;
      var slot = document.getElementById('dPhotoDownload');
      if (slot) slot.innerHTML = buttonHtml(code);
      refreshButtons();
    },
    download: download,
    onLogin: function () {
      var code = pendingCode;
      pendingCode = null;
      refreshButtons();
      if (code) download(code.code, code.zipOnly);
    },
    cancelLogin: function () { pendingCode = null; },
    reset: reset
  };
})();
