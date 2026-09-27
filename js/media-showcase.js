/* ==================================================
   PEC MEDIA SHOWCASE
   Add/remove objects in PEC_MEDIA — the marquee
   clones the sequence automatically and keeps the
   VIDEO → IMAGE alternation.
   ================================================== */
(function () {
  'use strict';

  var PEC_MEDIA = [
    { type: 'video', src: "media/pec-clip-1.mp4", alt: 'PEC — Programming Excellence Community' },
    { type: 'image', src: 'All Photoes/PEC_1st.jpeg', alt: 'PEC students during a community coding session' },
    { type: 'video', src: "media/pec-clip-2.mp4", alt: 'Code, complete, conquer — PEC animation' },
    { type: 'image', src: "media/pec-mentor-exam.jpeg", alt: 'PEC members collaborating on problem solving' },
    { type: 'video', src: 'media/pec-clip-3.webm', alt: 'Learn, practice, improve — PEC animation' },
    { type: 'image', src: 'All Photoes/PEC_3rd.jpeg', alt: 'PEC coding workshop in progress' },
    { type: 'video', src: 'media/pec-clip-4.webm', alt: 'Problem solving together — PEC animation' },
    { type: 'image', src: 'All Photoes/PEC_4th.jpeg', alt: 'Programming Excellence Community activity at SKIT Jaipur' },
    { type: 'video', src: 'media/pec-clip-5.webm', alt: 'SKIT Jaipur coding community — PEC animation' },
    { type: 'image', src: 'All Photoes/PEC_5th.jpeg', alt: 'PEC community gathering of students and mentors' }
  ];

  function validateSequence(list) {
    for (var i = 1; i < list.length; i++) {
      if (list[i].type === list[i - 1].type) {
        console.warn('[PEC media] Alternation broken at index ' + i +
          ': two "' + list[i].type + '" items in a row. Use video → image → video → image.');
      }
    }
    if (list.length % 2 !== 0) {
      console.warn('[PEC media] Odd number of items (' + list.length +
        ') — the loop seam will show two same-type cards side by side.');
    }
  }

  function createCard(item, reduceMotion) {
    var card = document.createElement('figure');
    card.className = 'media-card';

    if (item.type === 'video') {
      var video = document.createElement('video');
      video.src = item.src;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'metadata';
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.setAttribute('aria-label', item.alt || 'PEC video');
      video.removeAttribute('controls');
      if (reduceMotion) {
        video.preload = 'none';
      } else {
        video.autoplay = true;
        video.setAttribute('autoplay', '');
      }
      card.appendChild(video);
    } else {
      var img = document.createElement('img');
      img.src = item.src;
      img.alt = item.alt || 'PEC photo';
      img.loading = 'lazy';
      img.decoding = 'async';
      card.appendChild(img);
    }
    return card;
  }

  function init() {
    var track = document.getElementById('mediaTrack');
    if (!track) return;

    validateSequence(PEC_MEDIA);

    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* two identical copies → translateX(-50%) loops seamlessly */
    for (var copy = 0; copy < 2; copy++) {
      for (var i = 0; i < PEC_MEDIA.length; i++) {
        track.appendChild(createCard(PEC_MEDIA[i], reduceMotion));
      }
    }

    if (!reduceMotion) {
      var videos = track.querySelectorAll('video');
      for (var v = 0; v < videos.length; v++) {
        var play = videos[v].play();
        if (play && typeof play.catch === 'function') play.catch(function () {});
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
