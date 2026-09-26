/* ============================================================
   PEC Logout Overlay
   Reusable animated logout sequence (door + character).
   Vanilla JS + CSS keyframes from css/logout-overlay.css.
   No extra dependencies.

   Usage:
     PECLogoutOverlay.play(function () {
       // called once the animation is finished and the
       // overlay has been removed from the DOM
     });
   ============================================================ */
(function () {
  'use strict';

  var ANIMATION_MS = 2450;
  var FADE_MS = 200;

  var active = false;
  var overlayEl = null;
  var timers = [];

  function clearTimers() {
    timers.forEach(function (id) { clearTimeout(id); });
    timers = [];
  }

  function characterMarkup() {
    return [
      '<span class="lo-person-shadow"></span>',
      '<span class="lo-person-figure">',
        '<span class="lo-head">',
          '<i class="lo-eye lo-eye--l"></i>',
          '<i class="lo-eye lo-eye--r"></i>',
          '<i class="lo-smile"></i>',
        '</span>',
        '<span class="lo-torso">',
          '<i class="lo-arm lo-arm--l"></i>',
          '<i class="lo-arm lo-arm--r"></i>',
        '</span>',
        '<span class="lo-legs">',
          '<i class="lo-leg lo-leg--l"></i>',
          '<i class="lo-leg lo-leg--r"></i>',
        '</span>',
      '</span>'
    ].join('');
  }

  function buildOverlay() {
    var el = document.createElement('div');
    el.className = 'pec-logout-overlay';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="pec-logout-stage">' +
        '<div class="pec-logout-scene">' +
          '<span class="lo-door-floor"></span>' +
          '<span class="lo-door-mat"></span>' +
          '<span class="lo-land-shadow"></span>' +
          '<div class="lo-door">' +
            '<div class="lo-door-frame">' +
              '<div class="lo-door-opening"><span class="lo-door-glow"></span></div>' +
            '</div>' +
            '<div class="lo-door-panel"><span class="lo-door-knob"></span></div>' +
          '</div>' +
          '<div class="lo-person lo-person--walk">' + characterMarkup() + '</div>' +
          '<div class="lo-person lo-person--fall">' + characterMarkup() + '</div>' +
          '<span class="lo-dust lo-dust--1"></span>' +
          '<span class="lo-dust lo-dust--2"></span>' +
        '</div>' +
        '<div class="pec-logout-text">Logging out<span class="lo-dots"><i>.</i><i>.</i><i>.</i></span></div>' +
      '</div>';
    return el;
  }

  function finish(onDone) {
    clearTimers();
    if (overlayEl && overlayEl.parentNode) {
      overlayEl.parentNode.removeChild(overlayEl);
    }
    overlayEl = null;
    active = false;
    if (typeof onDone === 'function') onDone();
  }

  function play(onDone) {
    if (active) return; // prevent multiple logout clicks
    active = true;
    clearTimers();

    if (!document.body) {
      active = false;
      if (typeof onDone === 'function') onDone();
      return;
    }

    overlayEl = buildOverlay();
    document.body.appendChild(overlayEl);

    // If the stylesheet is missing, skip the animation instead of hanging.
    if (window.getComputedStyle(overlayEl).position !== 'fixed') {
      finish(onDone);
      return;
    }

    timers.push(setTimeout(function () {
      if (overlayEl) overlayEl.classList.add('is-leaving');
    }, ANIMATION_MS));

    timers.push(setTimeout(function () {
      finish(onDone);
    }, ANIMATION_MS + FADE_MS));
  }

  window.PECLogoutOverlay = {
    play: play,
    isActive: function () { return active; }
  };
})();
