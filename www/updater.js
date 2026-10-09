/* Manual OTA updates from GitHub Releases. */
(function () {
  try {
    var updater = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorUpdater;
    if (!updater) return;
    updater.notifyAppReady().catch(function () {});

    var MANIFEST_URL = 'https://github.com/sashamorecode/SimpleScore/releases/latest/download/latest.json';
    var busy = false;
    var queuedVersion = null;

    function parseVersion(version) {
      if (typeof version !== 'string') return null;
      var match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?$/.exec(version);
      if (!match) return null;
      var parts = [Number(match[1]), Number(match[2]), Number(match[3] || 0)];
      return parts.every(Number.isSafeInteger) ? parts : null;
    }

    function isHigher(a, b) {
      for (var i = 0; i < 3; i++) {
        if (a[i] !== b[i]) return a[i] > b[i];
      }
      return false;
    }

    async function loadManifest() {
      var http = window.Capacitor.Plugins.CapacitorHttp;
      if (http && typeof http.get === 'function') {
        var result = await http.get({ url: MANIFEST_URL, headers: { 'Cache-Control': 'no-cache' } });
        if (!result || !(result.status >= 200 && result.status < 300)) return null;
        return typeof result.data === 'string' ? JSON.parse(result.data) : result.data;
      }
      var response = await fetch(MANIFEST_URL, { cache: 'no-store' });
      return response.ok ? await response.json() : null;
    }

    async function check() {
      if (busy) return;
      busy = true;
      try {
        var manifest = await loadManifest();
        if (!manifest || typeof manifest.url !== 'string' || !manifest.url) return;
        var version = parseVersion(manifest.version);
        if (!version || manifest.version === queuedVersion) return;
        var cur = await updater.current();
        var current = parseVersion(cur && cur.bundle && cur.bundle.version) || parseVersion(cur && cur.native);
        if (!current || !isHigher(version, current)) return;
        if (queuedVersion && !isHigher(version, parseVersion(queuedVersion))) return;
        var options = { version: manifest.version, url: manifest.url };
        if (typeof manifest.checksum === 'string' && manifest.checksum) options.checksum = manifest.checksum;
        var bundle = await updater.download(options);
        await updater.next({ id: bundle.id });
        queuedVersion = manifest.version;
      } catch (e) {} finally {
        busy = false;
      }
    }

    function visibilityFallback() {
      try {
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) check();
        });
      } catch (e) {}
    }

    var app = window.Capacitor.Plugins.App;
    if (app && typeof app.addListener === 'function') {
      try {
        Promise.resolve(app.addListener('appStateChange', function (state) {
          if (state && state.isActive) check();
        })).catch(visibilityFallback);
      } catch (e) {
        visibilityFallback();
      }
    } else {
      visibilityFallback();
    }
    check();
  } catch (e) {}
})();
