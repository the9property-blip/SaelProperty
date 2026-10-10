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
