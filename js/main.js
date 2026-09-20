/* ============================================
   SECTION 1 - THEME TOGGLE
   ============================================ */
(function () {
  'use strict';
  var THEME_KEY = 'pec-theme';

  function getPreferredTheme() {
    var saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateToggleButtons(theme);
  }

  function updateToggleButtons(theme) {
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      var icon = theme === 'dark' ? '☀' : '☾';
      btn.innerHTML = '<span aria-hidden="true">' + icon + '</span>';
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
    });
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  applyTheme(getPreferredTheme());

  window.PECTheme = {
    toggle: toggleTheme,
    set: applyTheme,
    get: function () {
      return document.documentElement.getAttribute('data-theme') || 'light';
    }
  };

  document.addEventListener('click', function (e) {
    if (e.target.closest('.theme-toggle')) {
      e.preventDefault();
      toggleTheme();
    }
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    if (!localStorage.getItem(THEME_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      updateToggleButtons(getPreferredTheme());
    });
  } else {
    updateToggleButtons(getPreferredTheme());
  }
})();

/* ============================================
   SECTION 2 - MOBILE MENU
   ============================================ */
function initMobileMenu() {
  var hamburger = document.querySelector('.hamburger');
  var mobileMenu = document.querySelector('.mobile-menu');
  if (!hamburger || !mobileMenu) return;

  hamburger.addEventListener('click', function () {
    hamburger.classList.toggle('active');
    mobileMenu.classList.toggle('active');
    document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
  });

  mobileMenu.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    });
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 768) {
      hamburger.classList.remove('active');
      mobileMenu.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
}

function setActiveNavLink() {
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navbar-nav a, .mobile-menu a').forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
}

/* ============================================
   SECTION 3 - ACTIVITIES DATA & RENDERING
   ============================================ */
var activities = [
  { title: "Weekly DSA Challenge", difficulty: "Medium", status: "Active", description: "Solve this week's algorithmic challenge focused on data structures and algorithms.", icon: "fas fa-code", category: "DSA" },
  { title: "Debugging Challenge", difficulty: "Easy", status: "Active", description: "Find and fix bugs in the given code snippets. Test your debugging skills.", icon: "fas fa-bug", category: "Debugging" },
  { title: "Speed Coding", difficulty: "Hard", status: "Upcoming", description: "Solve coding problems under time pressure. Race against the clock.", icon: "fas fa-bolt", category: "Contest" },
  { title: "Code of the Week", difficulty: "Medium", status: "Active", description: "Write clean, efficient code for the weekly coding prompt and earn recognition.", icon: "fas fa-trophy", category: "Challenge" },
  { title: "Mini Coding Contest", difficulty: "Hard", status: "Upcoming", description: "A short coding contest with multiple problems. Compete with peers.", icon: "fas fa-flag-checkered", category: "Contest" },
  { title: "Problem Solving Session", difficulty: "Easy", status: "Active", description: "Collaborative problem-solving session to build algorithmic thinking.", icon: "fas fa-lightbulb", category: "Session" }
];

function renderActivities() {
  var container = document.getElementById('activitiesGrid');
  if (!container) return;
  container.innerHTML = '';
  activities.forEach(function (activity) {
    var card = document.createElement('div');
    card.className = 'card activity-card fade-in';
    card.innerHTML =
      '<div class="card-top"><div class="card-icon blue"><i class="' + activity.icon + '"></i></div><div class="card-badges"><span class="badge badge-' + activity.difficulty.toLowerCase() + '">' + activity.difficulty + '</span><span class="badge badge-' + activity.status.toLowerCase() + '">' + activity.status + '</span></div></div>' +
      '<h3>' + activity.title + '</h3><p>' + activity.description + '</p>' +
      '<div class="card-footer"><span style="font-size:0.8rem;color:var(--text-muted)">' + activity.category + '</span><button class="btn btn-sm btn-secondary">View Details</button></div>';
    container.appendChild(card);
  });
}

/* ============================================
   SECTION 4 - EVENTS DATA & RENDERING
   ============================================ */
var events = [
  { title: "DSA Workshop", date: "October 5, 2026", type: "workshop", typeLabel: "Workshop", description: "An interactive workshop on advanced data structures and algorithms with hands-on practice.", icon: "fas fa-chalkboard-teacher" },
  { title: "Coding Competition", date: "October 12, 2026", type: "competition", typeLabel: "Competition", description: "Compete with fellow students in a timed coding competition with exciting problems.", icon: "fas fa-medal" },
  { title: "Technical Session: Web Dev", date: "October 18, 2026", type: "session", typeLabel: "Session", description: "Learn modern web development concepts and build a project from scratch.", icon: "fas fa-laptop-code" },
  { title: "Project Showcase", date: "October 25, 2026", type: "showcase", typeLabel: "Showcase", description: "Present your projects to the community and get feedback from mentors.", icon: "fas fa-presentation" },
  { title: "Debugging Challenge", date: "November 1, 2026", type: "challenge", typeLabel: "Challenge", description: "A community-wide debugging challenge. Find bugs faster than everyone else.", icon: "fas fa-search" }
];

function renderEvents() {
  var container = document.getElementById('eventsGrid');
  if (!container) return;
  container.innerHTML = '';
  events.forEach(function (event) {
    var card = document.createElement('div');
    card.className = 'card event-card fade-in';
    card.innerHTML =
      '<span class="event-type ' + event.type + '">' + event.typeLabel + '</span>' +
      '<div class="event-date"><i class="far fa-calendar-alt"></i> ' + event.date + '</div>' +
      '<h3>' + event.title + '</h3><p>' + event.description + '</p>' +
      '<button class="btn btn-sm btn-secondary">View Details</button>';
    container.appendChild(card);
  });
}

/* ============================================
   SECTION 5 - LEADERBOARD DATA & RENDERING
   ============================================ */
var leaderboardData = {
  weekly: [
    { rank: 1, name: "Arjun Mehta", points: 320, solved: 28, streak: "7 days" },
    { rank: 2, name: "Priya Sharma", points: 295, solved: 25, streak: "6 days" },
    { rank: 3, name: "Rahul Verma", points: 280, solved: 24, streak: "5 days" },
    { rank: 4, name: "Sneha Patel", points: 265, solved: 22, streak: "5 days" },
    { rank: 5, name: "Vikram Singh", points: 250, solved: 21, streak: "4 days" },
    { rank: 6, name: "Ananya Gupta", points: 235, solved: 19, streak: "4 days" },
    { rank: 7, name: "Karthik Nair", points: 220, solved: 18, streak: "3 days" },
    { rank: 8, name: "Meera Reddy", points: 210, solved: 17, streak: "3 days" },
    { rank: 9, name: "Aditya Kumar", points: 195, solved: 16, streak: "2 days" },
    { rank: 10, name: "Nisha Joshi", points: 180, solved: 15, streak: "2 days" }
  ],
  monthly: [
    { rank: 1, name: "Priya Sharma", points: 1280, solved: 95, streak: "24 days" },
    { rank: 2, name: "Arjun Mehta", points: 1190, solved: 88, streak: "22 days" },
    { rank: 3, name: "Rahul Verma", points: 1050, solved: 78, streak: "19 days" },
    { rank: 4, name: "Sneha Patel", points: 980, solved: 72, streak: "17 days" },
    { rank: 5, name: "Vikram Singh", points: 920, solved: 68, streak: "16 days" },
    { rank: 6, name: "Ananya Gupta", points: 860, solved: 62, streak: "14 days" },
    { rank: 7, name: "Karthik Nair", points: 810, solved: 58, streak: "13 days" },
    { rank: 8, name: "Meera Reddy", points: 750, solved: 54, streak: "12 days" },
    { rank: 9, name: "Aditya Kumar", points: 700, solved: 50, streak: "11 days" },
    { rank: 10, name: "Nisha Joshi", points: 650, solved: 46, streak: "10 days" }
  ],
  overall: [
    { rank: 1, name: "Priya Sharma", points: 4520, solved: 340, streak: "45 days" },
    { rank: 2, name: "Arjun Mehta", points: 4280, solved: 318, streak: "42 days" },
    { rank: 3, name: "Rahul Verma", points: 3950, solved: 290, streak: "38 days" },
    { rank: 4, name: "Sneha Patel", points: 3720, solved: 272, streak: "35 days" },
    { rank: 5, name: "Vikram Singh", points: 3500, solved: 255, streak: "32 days" },
    { rank: 6, name: "Ananya Gupta", points: 3280, solved: 238, streak: "30 days" },
    { rank: 7, name: "Karthik Nair", points: 3050, solved: 220, streak: "28 days" },
    { rank: 8, name: "Meera Reddy", points: 2850, solved: 205, streak: "25 days" },
    { rank: 9, name: "Aditya Kumar", points: 2640, solved: 190, streak: "23 days" },
    { rank: 10, name: "Nisha Joshi", points: 2420, solved: 175, streak: "20 days" }
  ]
};

var currentTab = 'weekly';

function renderLeaderboard(tab) {
  var tbody = document.getElementById('leaderboardBody');
  if (!tbody) return;
  var data = leaderboardData[tab] || [];
  tbody.innerHTML = '';
  data.forEach(function (student) {
    var rankClass = student.rank <= 3 ? 'rank-' + student.rank : '';
    var rankBadge = student.rank <= 3
      ? '<span class="rank-badge ' + rankClass + '">' + student.rank + '</span>'
      : '<span style="font-weight:600;color:var(--text-muted)">' + student.rank + '</span>';
    var initials = student.name.split(' ').map(function (n) { return n[0]; }).join('');
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + rankBadge + '</td>' +
      '<td><div style="display:flex;align-items:center;gap:10px"><div style="width:36px;height:36px;border-radius:50%;background:var(--primary-bg);display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--primary);font-size:0.8rem">' + initials + '</div><span style="font-weight:600">' + student.name + '</span></div></td>' +
      '<td><span style="font-weight:700;color:var(--primary)">' + student.points + '</span></td>' +
      '<td>' + student.solved + '</td><td>' + student.streak + '</td>';
    tbody.appendChild(tr);
  });
}

function renderTopStudents(tab) {
  var container = document.getElementById('topStudents');
  if (!container) return;
  var data = leaderboardData[tab] || [];
  var top3 = data.slice(0, 3);
  container.innerHTML = '';
  var labels = ['Gold', 'Silver', 'Bronze'];
  var classes = ['first', 'second', 'third'];
  var displayOrder = [1, 0, 2];
  displayOrder.forEach(function (idx) {
    var student = top3[idx];
    if (!student) return;
    var initials = student.name.split(' ').map(function (n) { return n[0]; }).join('');
    var div = document.createElement('div');
    div.className = 'top-student ' + classes[idx];
    div.innerHTML =
      '<div class="rank-number">' + labels[idx] + '</div>' +
      '<div class="avatar">' + initials + '</div>' +
      '<div class="student-name">' + student.name + '</div>' +
      '<div class="student-points">' + student.points + '</div>' +
      '<div class="student-label">points</div>';
    container.appendChild(div);
  });
}

function initLeaderboardTabs() {
  document.querySelectorAll('.leaderboard-tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.leaderboard-tab').forEach(function (t) {
        t.classList.remove('active');
      });
      tab.classList.add('active');
      currentTab = tab.getAttribute('data-tab');
      renderLeaderboard(currentTab);
      renderTopStudents(currentTab);
    });
  });
}

/* ============================================
   SECTION 6 - SCROLL REVEAL ANIMATIONS
   ============================================ */
function initScrollReveal() {
  var revealElements = document.querySelectorAll('.reveal, .fade-in');
  if (!revealElements.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  revealElements.forEach(function (el) {
    observer.observe(el);
  });

  var staggerSections = ['#about', '#activities', '#coordinators', '#events', '#leaderboard', '#contact'];
  staggerSections.forEach(function (selector) {
    var section = document.querySelector(selector);
    if (!section) return;
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var children = entry.target.querySelectorAll('.reveal, .fade-in');
          children.forEach(function (child, i) {
            child.style.transitionDelay = (i * 0.1) + 's';
            setTimeout(function () {
              child.classList.add('visible');
            }, i * 100);
          });
          sectionObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    sectionObserver.observe(section);
  });
}

/* ============================================
   SECTION 7 - SCROLL EFFECTS
   ============================================ */
function initScrollEffects() {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  window.addEventListener('scroll', function () {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  });

  var parallaxElements = document.querySelectorAll('.decorative-shape, .hero-visual, .floating-element');
  if (parallaxElements.length) {
    window.addEventListener('scroll', function () {
      var scrollY = window.scrollY;
      parallaxElements.forEach(function (el, index) {
        var speed = 0.3;
        var maxOffset = index % 2 === 0 ? 15 : 20;
        var offset = Math.min(scrollY * speed, maxOffset);
        el.style.transform = 'translateY(' + offset + 'px)';
      });
    });
  }
}

/* ============================================
   SECTION 8 - SMOOTH SCROLL
   ============================================ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = this.getAttribute('href');
      if (targetId === '#') return;
      var target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        var navHeight = document.querySelector('.navbar') ? document.querySelector('.navbar').offsetHeight : 72;
        window.scrollTo({
          top: target.getBoundingClientRect().top + window.pageYOffset - navHeight,
          behavior: 'smooth'
        });
      }
    });
  });
}

/* ============================================
   SECTION 9 - CONTACT FORM
   ============================================ */
function initContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (validateContactForm()) {
      var successMsg = document.getElementById('formSuccess');
      if (successMsg) {
        successMsg.classList.add('show');
        form.reset();
        setTimeout(function () {
          successMsg.classList.remove('show');
        }, 5000);
      }
    }
  });
}

function validateContactForm() {
  var valid = true;
  var name = document.getElementById('contactName');
  var email = document.getElementById('contactEmail');
  var subject = document.getElementById('contactSubject');
  var message = document.getElementById('contactMessage');
  clearContactErrors();
  if (!name.value.trim()) { showContactError(name, 'Name is required'); valid = false; }
  if (!email.value.trim()) { showContactError(email, 'Email is required'); valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) { showContactError(email, 'Please enter a valid email'); valid = false; }
  if (!subject.value.trim()) { showContactError(subject, 'Subject is required'); valid = false; }
  if (!message.value.trim()) { showContactError(message, 'Message is required'); valid = false; }
  return valid;
}

function showContactError(input, message) {
  var errorEl = document.createElement('div');
  errorEl.className = 'form-error';
  errorEl.textContent = message;
  errorEl.style.display = 'block';
  input.style.borderColor = '#ef4444';
  input.parentNode.appendChild(errorEl);
}

function clearContactErrors() {
  document.querySelectorAll('#contactForm .form-error').forEach(function (el) { el.remove(); });
  document.querySelectorAll('#contactForm .form-control').forEach(function (input) { input.style.borderColor = ''; });
}

/* ============================================
   SECTION 10 - COUNTER ANIMATION
   ============================================ */
function animateCounters() {
  var counters = document.querySelectorAll('.stat-number[data-count]');
  if (!counters.length) return;

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        var el = entry.target;
        var target = parseInt(el.getAttribute('data-count'), 10);
        var current = 0;
        var duration = 2000;
        var startTime = null;

        function step(timestamp) {
          if (!startTime) startTime = timestamp;
          var progress = Math.min((timestamp - startTime) / duration, 1);
          var eased = 1 - Math.pow(1 - progress, 3);
          current = Math.floor(eased * target);
          el.textContent = current.toLocaleString();
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            el.textContent = target.toLocaleString();
          }
        }

        requestAnimationFrame(step);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });

  counters.forEach(function (counter) {
    observer.observe(counter);
  });
}

/* ============================================
   SECTION 11 - BUTTON MICRO-INTERACTIONS
   ============================================ */
function initButtonInteractions() {
  var buttons = document.querySelectorAll('.btn-primary, .btn-secondary');
  buttons.forEach(function (btn) {
    var arrow = btn.querySelector('.btn-arrow, .arrow, i.fa-arrow-right, i.fas.fa-arrow-right');
    btn.addEventListener('mouseenter', function () {
      if (arrow) {
        arrow.style.transform = 'translateX(4px)';
        arrow.style.transition = 'transform 0.3s ease';
      }
    });
    btn.addEventListener('mouseleave', function () {
      if (arrow) {
        arrow.style.transform = 'translateX(0)';
      }
    });
    btn.addEventListener('mousedown', function () {
      btn.style.transform = 'scale(0.97)';
      btn.style.transition = 'transform 0.15s ease';
    });
    btn.addEventListener('mouseup', function () {
      btn.style.transform = 'scale(1)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = 'scale(1)';
    });
  });
}

/* ============================================
   SECTION 12 - NAVBAR ANIMATION
   ============================================ */
function initNavbarAnimation() {
  var navbar = document.querySelector('.navbar');
  if (!navbar) return;

  navbar.style.opacity = '0';
  navbar.style.transition = 'opacity 0.6s ease, transform 0.3s ease, background-color 0.3s ease, box-shadow 0.3s ease';

  setTimeout(function () {
    navbar.style.opacity = '1';
  }, 100);

  var lastScroll = 0;
  window.addEventListener('scroll', function () {
    var scrollY = window.scrollY;
    if (scrollY > 60) {
      navbar.style.padding = '0.5rem 0';
    } else {
      navbar.style.padding = '';
    }
    lastScroll = scrollY;
  });
}

/* ============================================
   SECTION 13 - SECTION TRANSITIONS
   ============================================ */
function initSectionTransitions() {
  var sections = document.querySelectorAll('section');
  sections.forEach(function (section, index) {
    if (index === 0 || section.classList.contains('stats-bar')) return;
    var divider = document.createElement('div');
    divider.className = 'section-divider';
    divider.innerHTML = '<svg viewBox="0 0 1200 32" preserveAspectRatio="none" aria-hidden="true"><path class="shape-fill" d="M0,16 C180,4 360,28 600,16 C840,4 1020,28 1200,16 L1200,32 L0,32 Z"/><path class="shape-line shape-line-pool" d="M0,16 C180,4 360,28 600,16 C840,4 1020,28 1200,16"/><path class="shape-line shape-line-tangerine" d="M0,20 C180,8 360,32 600,20 C840,8 1020,32 1200,20"/></svg>';
    divider.style.cssText = 'width:100%;height:28px;overflow:hidden;line-height:0;margin:-1px 0;position:relative;z-index:1;';
    section.parentNode.insertBefore(divider, section);
  });
}

/* ============================================
   SECTION 14 - HERO ANIMATION
   ============================================ */
function initHeroAnimation() {
  var heroLabel = document.querySelector('.hero-label, .hero .badge, .hero-tag');
  var heroHeading = document.querySelector('.hero h1, .hero-title');
  var heroSubtitle = document.querySelector('.hero .subtitle, .hero-subtitle');
  var heroDescription = document.querySelector('.hero p, .hero-description');
  var heroButtons = document.querySelector('.hero .btn-group, .hero-buttons, .hero .cta-buttons');
  var heroVisual = document.querySelector('.hero-visual, .hero .visual, .hero-image');

  var elements = [
    { el: heroLabel, delay: 100 },
    { el: heroHeading, delay: 300 },
    { el: heroSubtitle, delay: 500 },
    { el: heroDescription, delay: 700 },
    { el: heroButtons, delay: 900 },
    { el: heroVisual, delay: 1100 }
  ];

  elements.forEach(function (item) {
    if (!item.el) return;
    item.el.style.opacity = '0';
    item.el.style.transform = 'translateY(20px)';
    item.el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    setTimeout(function () {
      item.el.style.opacity = '1';
      item.el.style.transform = 'translateY(0)';
    }, item.delay);
  });
}

function initCoordinatorCardTilt() {
  var cards = document.querySelectorAll('.coordinator-profile');
  if (!cards.length || window.matchMedia('(max-width: 768px)').matches) return;

  cards.forEach(function (card) {
    card.addEventListener('mousemove', function (event) {
      var rect = card.getBoundingClientRect();
      var x = event.clientX - rect.left;
      var y = event.clientY - rect.top;
      var rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 5;
      var rotateX = -((y - rect.height / 2) / (rect.height / 2)) * 4;
      card.style.transition = 'transform 0.1s ease-out, box-shadow 0.25s ease, border-color 0.25s ease';
      card.style.transform = 'perspective(900px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) translateY(-6px) scale(1.015)';
    });

    card.addEventListener('mouseleave', function () {
      card.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, border-color 0.3s ease';
      card.style.transform = 'translateY(0) scale(1)';
    });
  });
}

function initHeroCodeEditor() {
  var linesEl = document.getElementById('hero-code-lines');
  var roleEl = document.getElementById('hero-code-role');
  if (!linesEl || !roleEl) return;

  var roles = [
    { name: 'STUDENT', color: 'string', lines: ['const community = "PEC";', 'community.connect();', 'community.learn();', 'community.build();', 'community.grow();'] },
    { name: 'MENTOR', color: 'function', lines: ['const community = "PEC";', 'community.guide();', 'community.review();', 'community.inspire();', 'community.grow();'] },
    { name: 'COORDINATOR', color: 'keyword', lines: ['const community = "PEC";', 'community.organize();', 'community.connect();', 'community.enable();', 'community.grow();'] }
  ];
  var roleIndex = 0;
  var lineIndex = 0;
  var characterIndex = 0;
  var deleting = false;

  function highlight(line) {
    return escapeCode(line)
      .replace(/(".*?")/g, '<span class="string">$1</span>')
      .replace(/\b(const|function|return)\b/g, '<span class="keyword">$1</span>')
      .replace(/([a-z]+)(?=\()/g, '<span class="function">$1</span>');
  }

  function escapeCode(value) {
    return value.replace(/[&<>]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char]; });
  }

  function tick() {
    var role = roles[roleIndex];
    var visibleLines = role.lines.slice(0, lineIndex);
    if (!deleting) visibleLines.push(role.lines[lineIndex].slice(0, characterIndex));
    linesEl.innerHTML = visibleLines.map(function (line) { return '<div class="code-line">' + highlight(line) + '</div>'; }).join('');
    roleEl.textContent = role.name;

    if (!deleting) {
      characterIndex += 1;
      if (characterIndex > role.lines[lineIndex].length) {
        characterIndex = 0;
        lineIndex += 1;
        if (lineIndex >= role.lines.length) { lineIndex = role.lines.length - 1; deleting = true; }
      }
    } else {
      characterIndex = Math.max(0, characterIndex - 1);
      if (characterIndex === 0) {
        lineIndex -= 1;
        if (lineIndex < 0) { roleIndex = (roleIndex + 1) % roles.length; lineIndex = 0; deleting = false; }
        else characterIndex = roles[roleIndex].lines[lineIndex].length;
      }
    }
    setTimeout(tick, deleting ? 28 : 54);
  }

  tick();
}

/* ============================================
   SECTION 15 - MAIN INIT
   ============================================ */
document.addEventListener('DOMContentLoaded', function () {
  initMobileMenu();
  setActiveNavLink();
  initScrollReveal();
  initScrollEffects();
  initSmoothScroll();
  initContactForm();
  animateCounters();
  initButtonInteractions();
  initNavbarAnimation();
  initSectionTransitions();
  initHeroAnimation();
  initCoordinatorCardTilt();
  renderActivities();
  renderEvents();
  renderLeaderboard(currentTab);
  renderTopStudents(currentTab);
  initLeaderboardTabs();
});
