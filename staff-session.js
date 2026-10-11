/* Shared Staff authentication for this site's browser session. */
(function () {
  'use strict';
  var name = 'sale_staff_session';
  var path = location.pathname.slice(0, location.pathname.lastIndexOf('/') + 1) || '/';
  var attributes = '; Path=' + path + '; SameSite=Strict' + (location.protocol === 'https:' ? '; Secure' : '');
  function get() {
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].trim();
      if (cookie.indexOf(name + '=') === 0) {
        try { return decodeURIComponent(cookie.slice(name.length + 1)); } catch (e) { return ''; }
      }
    }
    return '';
  }
  function set(token) {
    // No expiry or Max-Age: the browser owns the session lifetime.
    document.cookie = name + '=' + encodeURIComponent(token) + attributes;
    try { sessionStorage.removeItem('staff_token'); } catch (e) {}
  }
  function clear() {
    document.cookie = name + '=; Max-Age=0' + attributes;
    try { sessionStorage.removeItem('staff_token'); } catch (e) {}
  }
  // Carry an existing tab's login into the shared session during this upgrade.
  try {
    var previous = sessionStorage.getItem('staff_token');
    if (previous && !get()) set(previous);
    sessionStorage.removeItem('staff_token');
  } catch (e) {}
  window.StaffSession = { get: get, set: set, clear: clear };
})();

/* Explicit API routing, shared by all sale pages. Never overrides window.fetch. */
window.SaleApi = {
  create: function (endpoint, dataset) {
    async function request(params, token, signal) {
      var controller = new AbortController(), timeout = setTimeout(function () { controller.abort(); }, 60000);
      function abort() { controller.abort(); }
      if (signal) { if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true }); }
      try {
        var query = new URLSearchParams(Object.assign({type:'sale',dataset:dataset,_t:String(Date.now())},params));
        if (token) query.set('token', token);
        var response = await fetch(endpoint + '?' + query.toString(), {cache:'no-store',credentials:'omit',signal:controller.signal});
        if (!response.ok) throw new Error('connection_failed');
        var result;
        try { result = await response.json(); } catch (e) { throw new Error('invalid_response'); }
        if (!result || typeof result.ok !== 'boolean') throw new Error('invalid_response');
        if (!result.ok) throw new Error(result.error || 'server_error');
        return result;
      } finally {
        clearTimeout(timeout);
        if (signal) signal.removeEventListener('abort', abort);
      }
    }
    return {
      catalog: async function (token, refresh, signal) {
        var result = await request(Object.assign(soldParams(), refresh ? {refresh:'1'} : {}), token, signal);
        if (token && result.staff !== true) throw new Error('unauthorized');
        if (!Array.isArray(result.data)) throw new Error('invalid_response');
        if (result.dataset && result.dataset !== dataset) throw new Error('wrong_dataset');
        if (dataset === 'sold' && result.dataset !== 'sold') throw new Error('backend_update_required');
        // Older active catalogs may be displayed, but missing action versions stay disabled.
        if (result.data.some(function(p){return !p || !/^(?:S[A-Z]{2}|CO[A-Z]*)\d+$/i.test(String(p.code||''));})) throw new Error('wrong_dataset');
        return result;
      },
      caption: function (code, token, refresh, signal) { return request({action:'caption',code:code,refresh:refresh?'1':'0'},token,signal); }
    };
    function soldParams() { return dataset === 'sold' ? {action:'soldMap'} : {}; }
  }
};
