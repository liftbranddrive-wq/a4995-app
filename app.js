/* ============================================================
   A $49.95 — App-shell controller
   - Splash fade-out
   - Bottom-nav screen routing
   - Deep-links (?call=nyc, ?call=tollfree)
   - PWA install prompts (Chromium + iOS hint)
   - 3D tilt on the main CALL button (gyroscope on mobile, mouse on desktop)
   - Service worker registration
   ============================================================ */

(function () {
    'use strict';

    // ---------------------------------------------------------
    // 1) SPLASH SCREEN — fade out after a short delay
    // ---------------------------------------------------------
    var splash = document.getElementById('splash');
    if (splash) {
        var minSplash = 700;            // minimum splash visibility
        var start = performance.now();
        var hideSplash = function () {
            var waited = performance.now() - start;
            var delay = Math.max(0, minSplash - waited);
            setTimeout(function () {
                splash.classList.add('fade-out');
                setTimeout(function () { splash.style.display = 'none'; }, 700);
            }, delay);
        };
        if (document.readyState === 'complete') hideSplash();
        else window.addEventListener('load', hideSplash);
    }

    // ---------------------------------------------------------
    // 2) FOOTER YEAR
    // ---------------------------------------------------------
    var yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // ---------------------------------------------------------
    // 3) SCREEN ROUTER (Home / Call / Services / About)
    // ---------------------------------------------------------
    var screens = document.querySelectorAll('.screen');
    var navBtns = document.querySelectorAll('.navbtn');
    var tiles   = document.querySelectorAll('[data-go]');

    function goTo(name) {
        var found = false;
        screens.forEach(function (s) {
            var is = s.dataset.screen === name;
            s.classList.toggle('screen--active', is);
            if (is) found = true;
        });
        navBtns.forEach(function (b) {
            var is = b.dataset.go === name;
            b.classList.toggle('navbtn--active', is);
            b.setAttribute('aria-selected', is ? 'true' : 'false');
        });
        if (found) {
            // Scroll content area back to top on each switch.
            window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
            try { history.replaceState(null, '', '#' + name); } catch (e) {}
            vibrate(8);
        }
    }

    tiles.forEach(function (el) {
        el.addEventListener('click', function (e) {
            // Only intercept when not a link.
            if (el.tagName.toLowerCase() === 'a') return;
            e.preventDefault();
            var name = el.dataset.go;
            if (name) goTo(name);
        });
    });

    // ---------------------------------------------------------
    // 4) DEEP-LINKS (?call=nyc → trigger call, then go to call screen)
    // ---------------------------------------------------------
    var qs = new URLSearchParams(window.location.search);
    var deep = qs.get('call');
    if (deep) {
        var deepMap = {
            nyc:      'tel:+12126874995',
            boroughs: 'tel:+17188454995',
            nassau:   'tel:+15163544995',
            suffolk:  'tel:+16316984995',
            tollfree: 'tel:+18887294995'
        };
        if (deepMap[deep]) {
            // Open the dialer immediately.
            window.location.href = deepMap[deep];
        }
        goTo('call');
    }

    // Default to hash if present.
    var hash = (window.location.hash || '').replace('#', '');
    if (hash && document.querySelector('[data-screen="' + hash + '"]')) {
        goTo(hash);
    }

    // ---------------------------------------------------------
    // 5) HAPTIC HELPER
    // ---------------------------------------------------------
    function vibrate(ms) {
        if (navigator.vibrate) {
            try { navigator.vibrate(ms); } catch (e) {}
        }
    }
    document.addEventListener('click', function (e) {
        var link = e.target && e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
        if (!link) return;
        vibrate(12);
        var region = link.getAttribute('data-region') || 'unknown';
        var num = link.getAttribute('href').replace('tel:', '');
        console.log('[A4995] Call tapped:', region, num);
    });

    // ---------------------------------------------------------
    // 6) 3D TILT for the main CALL button (mouse + device tilt)
    // ---------------------------------------------------------
    var callBtn = document.querySelector('.call-btn-3d');
    if (callBtn) {
        var maxTilt = 6;

        // Mouse / pointer move (desktop preview)
        callBtn.addEventListener('mousemove', function (e) {
            var r = callBtn.getBoundingClientRect();
            var x = (e.clientX - r.left) / r.width  - 0.5;
            var y = (e.clientY - r.top)  / r.height - 0.5;
            callBtn.style.transform =
                'rotateX(' + (-y * maxTilt) + 'deg) rotateY(' + (x * maxTilt) + 'deg)';
        });
        callBtn.addEventListener('mouseleave', function () {
            callBtn.style.transform = '';
        });

        // Device tilt (mobile) — small, subtle
        if (window.DeviceOrientationEvent) {
            var orientHandler = function (e) {
                if (e.beta == null || e.gamma == null) return;
                var ry = Math.max(-maxTilt, Math.min(maxTilt, e.gamma / 6));
                var rx = Math.max(-maxTilt, Math.min(maxTilt, (e.beta - 35) / 6));
                callBtn.style.transform =
                    'rotateX(' + (-rx) + 'deg) rotateY(' + ry + 'deg)';
            };
            window.addEventListener('deviceorientation', orientHandler, { passive: true });
        }
    }

    // ---------------------------------------------------------
    // 7) MENU BUTTON (placeholder — opens "About")
    // ---------------------------------------------------------
    var menuBtn = document.getElementById('open-menu');
    if (menuBtn) {
        menuBtn.addEventListener('click', function () {
            goTo('about');
        });
    }

    // ---------------------------------------------------------
    // 8) PWA INSTALL PROMPT (Android / Edge / Chrome)
    // ---------------------------------------------------------
    function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
    function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
    var DISMISS_KEY = 'a4995-install-dismissed';
    var IOS_DISMISS_KEY = 'a4995-ios-hint-dismissed';

    // Detect "is the app currently being run as an installed PWA?"
    // We check all known signals — different OS/browsers expose different ones.
    function isStandalone() {
        if (typeof navigator !== 'undefined' && 'standalone' in navigator && navigator.standalone) return true;
        if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)            return true;
        if (window.matchMedia && window.matchMedia('(display-mode: fullscreen)').matches)            return true;
        if (window.matchMedia && window.matchMedia('(display-mode: minimal-ui)').matches)            return true;
        // Android TWA / WebAPK referrer is "android-app://"
        if (document.referrer && document.referrer.indexOf('android-app://') === 0) return true;
        return false;
    }

    var installBanner = document.getElementById('install-banner');
    var installBtn    = document.getElementById('install-btn');
    var installX      = document.getElementById('install-dismiss');
    var iosHint       = document.getElementById('ios-install-hint');
    var iosX          = document.getElementById('ios-hint-close');

    var STANDALONE = isStandalone();
    var isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    // If we're already inside the installed app, NUKE the install UI entirely so it can never re-appear.
    if (STANDALONE) {
        if (installBanner) installBanner.parentNode && installBanner.parentNode.removeChild(installBanner);
        if (iosHint)       iosHint.parentNode       && iosHint.parentNode.removeChild(iosHint);
    } else {
        // Not installed yet → wire up the install UX.
        var deferredPrompt = null;

        window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            deferredPrompt = e;
            if (isStandalone()) return;
            if (safeGet(DISMISS_KEY) === '1') return;
            if (installBanner) installBanner.hidden = false;
        });

        if (installBtn) installBtn.addEventListener('click', function () {
            if (!deferredPrompt) return;
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(function () {
                deferredPrompt = null;
                if (installBanner) installBanner.hidden = true;
            });
        });

        if (installX) installX.addEventListener('click', function () {
            if (installBanner) installBanner.hidden = true;
            safeSet(DISMISS_KEY, '1');
        });

        // Hide immediately on install success, and remember.
        window.addEventListener('appinstalled', function () {
            if (installBanner) installBanner.hidden = true;
            if (iosHint)       iosHint.hidden       = true;
            safeSet(DISMISS_KEY, '1');
            safeSet(IOS_DISMISS_KEY, '1');
        });

        // Re-check standalone status when visibility changes (e.g. user installed in another tab).
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden && isStandalone()) {
                if (installBanner) installBanner.hidden = true;
                if (iosHint)       iosHint.hidden       = true;
            }
        });

        // iOS install hint — only on Safari iOS, not in standalone mode, not dismissed before.
        if (isIos && safeGet(IOS_DISMISS_KEY) !== '1' && iosHint) {
            setTimeout(function () {
                if (!isStandalone()) iosHint.hidden = false;
            }, 1800);
        }
        if (iosX) iosX.addEventListener('click', function () {
            if (iosHint) iosHint.hidden = true;
            safeSet(IOS_DISMISS_KEY, '1');
        });
    }

    // ---------------------------------------------------------
    // 9) SERVICE WORKER
    // ---------------------------------------------------------
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
            navigator.serviceWorker.register('service-worker.js').catch(function (err) {
                console.warn('[A4995] SW registration failed:', err);
            });
        });
    }
})();
