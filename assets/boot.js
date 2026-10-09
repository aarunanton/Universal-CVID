/* Loaded first on every page. Locks the page down so that, even if something went wrong
   elsewhere, CV data could not be sent to another server and no outside script could run.
   The one exception is Cloudflare Web Analytics (anonymous visit counts, no cookies). */
(function () {
  document.documentElement.dataset.theme = 'light';
  if (/claude/.test(location.hostname)) return; // the Claude preview window applies its own policy
  var m = document.createElement('meta');
  m.httpEquiv = 'Content-Security-Policy';
  m.content = "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'";
  document.head.insertBefore(m, document.head.firstChild);
})();
