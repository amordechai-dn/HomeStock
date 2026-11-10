/* PWA glue: register the service worker, auto-update, and surface VERSION.
   Reloads exactly once when a new SW takes control (guarded). */
(function () {
  'use strict';

  // Fallback shown before the SW reports its authoritative VERSION.
  // Keep in sync with sw.js on deploy; the SW value overrides this at runtime.
  var FALLBACK_VERSION = 'v4.5.4';
  window.APP_VERSION = FALLBACK_VERSION;

  function setVersion(v) {
    window.APP_VERSION = v;
    var el = document.getElementById('version');
    if (el) el.textContent = 'v.' + String(v).replace(/^v/, '');
    if(document.querySelectorAll)document.querySelectorAll('[data-app-version]').forEach(function(node){node.textContent='v.'+String(v).replace(/^v/,'');});
  }

  if (!('serviceWorker' in navigator)) return;

  // Reload once when the new SW takes over.
  var refreshing = false,reloadPending=false;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if(refreshing||reloadPending)return;reloadPending=true;
    function reloadWhenIdle(){
      if(document.querySelector&&document.querySelector('.overlay,.profile-inline,.scanner-page video')){setTimeout(reloadWhenIdle,1000);return;}
      refreshing=true;window.location.reload();
    }
    reloadWhenIdle();
  });

  // Receive broadcasts (e.g. version) from the SW.
  navigator.serviceWorker.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'VERSION' && e.data.version) {
      setVersion(e.data.version);
    }
  });

  function askVersion(sw) {
    if (!sw) return;
    try {
      var mc = new MessageChannel();
      mc.port1.onmessage = function (e) {
        if (e.data && e.data.version) setVersion(e.data.version);
      };
      sw.postMessage({ type: 'GET_VERSION' }, [mc.port2]);
    } catch (err) {
      /* ignore */
    }
  }

  // Ask a newly-installed waiting worker to activate immediately.
  function promote(sw) {
    if (sw && sw.state === 'installed' && navigator.serviceWorker.controller) {
      sw.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  function trackUpdates(reg) {
    if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    function watch(sw){if(!sw)return;promote(sw);sw.addEventListener('statechange',function(){promote(sw);});}
    watch(reg.installing);
    reg.addEventListener('updatefound',function(){watch(reg.installing);});
  }

  function registerUpdates() {
    navigator.serviceWorker
      .register('./sw.js', { updateViaCache: 'none' })
      .then(function (reg) {
        trackUpdates(reg);

        if (navigator.serviceWorker.controller) {
          askVersion(navigator.serviceWorker.controller);
        }
        navigator.serviceWorker.ready.then(function (r) {
          askVersion(r.active);
        });

        var checking=false;
        var update = function () {
          if(checking||navigator.onLine===false||document.visibilityState==='hidden')return;
          checking=true;
          reg.update().catch(function () {}).then(function(){checking=false;if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});});
        };
        setInterval(update,30000);
        window.addEventListener('online',update);
        update();
        window.addEventListener('focus', update);
        document.addEventListener('visibilitychange', function () {
          if (document.visibilityState === 'visible') update();
        });
      })
      .catch(function (err) {
        console.warn('SW registration failed:', err);
      });
  }
  if(document.readyState==='complete')registerUpdates();
  else window.addEventListener('load',registerUpdates,{once:true});
})();
