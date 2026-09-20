/* ============================================================
   SECTION 1 — VIEW SWITCHING
   ============================================================ */

function showAuth(viewId) {
  document.querySelectorAll('.auth-view').forEach(function (v) {
    v.classList.remove('active');
  });

  document.querySelectorAll('.role-card').forEach(function (card) {
    card.classList.remove('expanding');
    card.style.transform = '';
    card.style.opacity = '';
    card.style.filter = '';
  });

  var targetId = viewId === 'role-selection' ? 'view-role-selection' :
                 (viewId.indexOf('view-') === 0 ? viewId : 'view-' + viewId);
  var target = document.getElementById(targetId) ||
               document.getElementById('view-role-selection');
  if (target) {
    target.classList.add('active');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });

  setTimeout(function () {
    initRoleCardAnimations();
    initRoleCards();
    initMouseParallax();
    initEntryAnimations();
  }, 100);
}

/* ============================================================
   SECTION 2 — ROLE CARD 3D TILT
   ============================================================ */

function initRoleCards() {
  var activeView = document.querySelector('.auth-view.active');
  if (!activeView) return;

  var cards = activeView.querySelectorAll('.role-card');
  if (!cards.length) return;

  var isMobile = window.matchMedia('(max-width: 768px)').matches ||
                 ('ontouchstart' in window) ||
                 (navigator.maxTouchPoints > 0);
  if (isMobile) return;

  cards.forEach(function (card) {
    card.removeEventListener('mousemove', card._mouseMoveHandler);
    card.removeEventListener('mouseleave', card._mouseLeaveHandler);
    card.removeEventListener('click', card._clickHandler);
    card.removeEventListener('keydown', card._keyDownHandler);

    card._mouseMoveHandler = function (e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      var centerX = rect.width / 2;
      var centerY = rect.height / 2;
      var rotateY = ((x - centerX) / centerX) * 7;
      var rotateX = -((y - centerY) / centerY) * 5;

      rotateX = Math.max(-5, Math.min(5, rotateX));
      rotateY = Math.max(-7, Math.min(7, rotateY));

      card.style.transform =
        'perspective(800px) rotateX(' + rotateX + 'deg) rotateY(' + rotateY + 'deg) scale(1.02)';
      card.style.transition = 'transform 0.1s ease-out';
    };

    card._mouseLeaveHandler = function () {
      card.style.transition = 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)';
    };

    card._clickHandler = function () {
      var role = card.getAttribute('data-role');
      if (!role) return;

      card.classList.add('expanding');

      setTimeout(function () {
        showAuth(role + '-login');
      }, 600);
    };

    card._keyDownHandler = function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    };

    card.addEventListener('mousemove', card._mouseMoveHandler);
    card.addEventListener('mouseleave', card._mouseLeaveHandler);
    card.addEventListener('click', card._clickHandler);
    card.addEventListener('keydown', card._keyDownHandler);
  });
}

/* ============================================================
   SECTION 3 — ROLE CARD ENTRY ANIMATIONS
   ============================================================ */

function initRoleCardAnimations() {
  var activeView = document.querySelector('.auth-view.active');
  if (!activeView) return;

  var cards = activeView.querySelectorAll('.role-card-animate');
  if (!cards.length) return;

  cards.forEach(function (card) {
    card.classList.remove('visible');
  });

  setTimeout(function () {
    cards.forEach(function (card, i) {
      setTimeout(function () {
        card.classList.add('visible');
      }, i * 150);
    });
  }, 100);
}

/* ============================================================
   SECTION 4 — STAGGERED ENTRY ANIMATIONS
   ============================================================ */

function initEntryAnimations() {
  var activeView = document.querySelector('.auth-view.active');
  if (!activeView) return;

  var elements = [].concat(
    Array.from(activeView.querySelectorAll('.auth-card')),
    Array.from(activeView.querySelectorAll('.auth-visual')),
    Array.from(activeView.querySelectorAll('.auth-visual-nodes')),
    Array.from(activeView.querySelectorAll('.auth-visual-panels'))
  );

  if (!elements.length) return;

  elements.forEach(function (el) {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      elements.forEach(function (el, i) {
        setTimeout(function () {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }, i * 120);
      });
    });
  });
}

/* ============================================================
   SECTION 5 — MOUSE PARALLAX ON VISUAL
   ============================================================ */

function initMouseParallax() {
  var activeView = document.querySelector('.auth-view.active');
  if (!activeView) return;

  var isMobile = window.matchMedia('(max-width: 768px)').matches ||
                 ('ontouchstart' in window) ||
                 (navigator.maxTouchPoints > 0);
  if (isMobile) return;

  var container = activeView.querySelector('.auth-brand-side') ||
                  activeView.querySelector('.auth-orbital');
  if (!container) return;

  container.removeEventListener('mousemove', container._parallaxMoveHandler);
  container.removeEventListener('mouseleave', container._parallaxLeaveHandler);

  container._parallaxMoveHandler = function (e) {
    var rect = container.getBoundingClientRect();
    var x = (e.clientX - rect.left) / rect.width - 0.5;
    var y = (e.clientY - rect.top) / rect.height - 0.5;

    var core = container.querySelector('.auth-sphere-main, .auth-core, .auth-visual-core');
    var dots = container.querySelectorAll('.auth-sphere-accent, .auth-sphere-small, .auth-visual-dot, .auth-dots > *');
    var particles = container.querySelectorAll('.auth-visual-particle, .auth-particle');

    if (core) {
      core.style.transform = 'translate(' + (x * 10) + 'px, ' + (y * 10) + 'px)';
      core.style.transition = 'transform 0.3s ease-out';
    }

    dots.forEach(function (dot, i) {
      var factor = (i % 2 === 0) ? -1 : 1;
      dot.style.transform = 'translate(' + (x * 8 * factor) + 'px, ' + (y * 8 * factor) + 'px)';
      dot.style.transition = 'transform 0.3s ease-out';
    });

    particles.forEach(function (particle, i) {
      var fx = (i % 3 === 0) ? 12 : (i % 3 === 1) ? -8 : 6;
      var fy = (i % 3 === 0) ? -6 : (i % 3 === 1) ? 10 : -12;
      particle.style.transform = 'translate(' + (x * fx) + 'px, ' + (y * fy) + 'px)';
      particle.style.transition = 'transform 0.3s ease-out';
    });
  };

  container._parallaxLeaveHandler = function () {
    var core = container.querySelector('.auth-sphere-main, .auth-core, .auth-visual-core');
    var dots = container.querySelectorAll('.auth-sphere-accent, .auth-sphere-small, .auth-visual-dot, .auth-dots > *');
    var particles = container.querySelectorAll('.auth-visual-particle, .auth-particle');

    var resetEl = function (el) {
      if (!el) return;
      el.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = 'translate(0, 0)';
    };

    resetEl(core);
    dots.forEach(resetEl);
    particles.forEach(resetEl);
  };

  container.addEventListener('mousemove', container._parallaxMoveHandler);
  container.addEventListener('mouseleave', container._parallaxLeaveHandler);
}

/* ============================================================
   SECTION 6 — PASSWORD TOGGLE
   ============================================================ */

document.addEventListener('click', function (e) {
  var toggle = e.target.closest('.password-toggle');
  if (!toggle) return;

  var wrapper = toggle.closest('.input-group') || toggle.parentElement;
  var input = wrapper ? wrapper.querySelector('input[type="password"], input[type="text"]') : null;
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    toggle.innerHTML = '<i class="fas fa-eye-slash"></i>';
  } else {
    input.type = 'password';
    toggle.innerHTML = '<i class="fas fa-eye"></i>';
  }
});

/* ============================================================
   SECTION 7 — PASSWORD STRENGTH
   ============================================================ */

function checkPasswordStrength(password) {
  var level = 0;
  if (password.length >= 8) level++;
  if (/[A-Z]/.test(password)) level++;
  if (/[0-9]/.test(password)) level++;
  if (/[^A-Za-z0-9]/.test(password)) level++;

  var texts = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  var bars  = level + 1;

  return { level: level, text: texts[level] || texts[0], bars: Math.min(bars, 4) };
}

window.checkPasswordStrength = checkPasswordStrength;

document.addEventListener('input', function (e) {
  if (!e.target.matches('.password-input, input[type="password"]')) return;

  var container = e.target.closest('.input-group, .form-group, .auth-card, .auth-form');
  if (!container) return;

  var strengthEl = container.querySelector('.password-strength');
  if (!strengthEl) return;

  var password = e.target.value;
  var result = checkPasswordStrength(password);

  var bars = strengthEl.querySelectorAll('.strength-bar, span');
  bars.forEach(function (bar, i) {
    if (i < result.bars) {
      bar.classList.add('active');
      bar.style.background =
        result.level <= 1 ? '#e74c3c' :
        result.level === 2 ? '#f39c12' :
        result.level === 3 ? '#27ae60' : '#2ecc71';
    } else {
      bar.classList.remove('active');
      bar.style.background = '#ddd';
    }
  });

  var textEl = strengthEl.querySelector('.strength-text, p');
  if (textEl) textEl.textContent = password.length ? result.text : '';
});

/* ============================================================
   SECTION 8 — VALIDATION HELPERS
   ============================================================ */

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  return password && password.length >= 8;
}

function confirmPasswordMatch(password, confirm) {
  return password === confirm;
}

window.validateEmail = validateEmail;
window.validatePassword = validatePassword;
window.confirmPassword = confirmPasswordMatch;

function showError(input, message) {
  if (!input) return;

  input.classList.add('error');

  var group = input.closest('.input-group, .form-group') || input.parentElement;
  if (!group) return;

  var existing = group.querySelector('.error-message');
  if (existing) existing.remove();

  var err = document.createElement('span');
  err.className = 'error-message';
  err.textContent = message;
  group.appendChild(err);

  input.style.animation = 'shake 0.4s ease';
  input.addEventListener('animationend', function () {
    input.style.animation = '';
  }, { once: true });
}

function clearError(input) {
  if (!input) return;
  input.classList.remove('error');
  var group = input.closest('.input-group, .form-group') || input.parentElement;
  if (group) {
    var msg = group.querySelector('.error-message');
    if (msg) msg.remove();
  }
}

function showSuccess(message) {
  var existing = document.querySelector('.auth-success-message');
  if (existing) existing.remove();

  var el = document.createElement('div');
  el.className = 'auth-success-message';
  el.textContent = message;
  el.style.cssText =
    'background:#27ae60;color:#fff;padding:12px 20px;border-radius:8px;' +
    'text-align:center;margin-bottom:16px;animation:fadeIn 0.3s ease';

  var activeView = document.querySelector('.auth-view.active');
  if (activeView) {
    var card = activeView.querySelector('.auth-card');
    if (card) card.insertBefore(el, card.firstChild);
  }

  return el;
}

function clearAllErrors() {
  document.querySelectorAll('.error').forEach(function (el) {
    el.classList.remove('error');
  });
  document.querySelectorAll('.error-message').forEach(function (el) {
    el.remove();
  });
}

window.clearAllErrors = clearAllErrors;
window.showFieldError = function (fieldId, message) {
  var field = document.getElementById(fieldId);
  if (field) showError(field, message);
};
window.clearFieldError = function (fieldId) {
  var field = document.getElementById(fieldId);
  if (field) clearError(field);
};
window.showFormSuccess = function (message) {
  return showSuccess(message);
};

/* ============================================================
   SECTION 9 — FORM SUBMISSION
   ============================================================ */

document.addEventListener('submit', function (e) {
  var form = e.target;
  if (!form.classList.contains('auth-form') && !form.matches('[id$="-login-form"], [id$="-signup-form"]')) return;

  e.preventDefault();
  clearAllErrors();

  // Helper for POST JSON
  function postJSON(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (response) {
      return response.json().then(function (body) {
        if (!response.ok && !body.message) body.message = 'Request failed';
        return body;
      });
    });
  }
  function storeToken(tok) { sessionStorage.setItem('pec_jwt', tok); }
  function completeAuth(response) {
    if (!response.success) {
      showFormSuccess(response.message || 'Unable to complete request');
      return;
    }
    storeToken(response.token);
    window.location.href = '../pages/dashboard.html';
  }
  function submitLogin(role, emailId, passwordId) {
    var email = document.getElementById(emailId).value.trim();
    var password = document.getElementById(passwordId).value;
    if (!validateEmail(email)) return showFieldError(emailId, 'Invalid email');
    if (!validatePassword(password)) return showFieldError(passwordId, 'Password must be at least 8 characters');
    setLoading(true);
    postJSON('/api/auth/login', { email: email, password: password, role: role })
      .then(completeAuth)
      .catch(function () { showFormSuccess('Unable to connect to PEC server'); })
      .finally(function () { setLoading(false); });
  }

  var formId = form.id;
  function setLoading(active) {
    var button = form.querySelector('button[type="submit"]');
    if (!button) return;
    button.disabled = active;
    button.dataset.label = button.dataset.label || button.textContent;
    button.textContent = active ? 'Please wait...' : button.dataset.label;
  }

  // Login handlers
  if (formId === 'student-login-form') {
    submitLogin('student', 'student-email', 'student-password');
    return;
  }

  if (formId === 'mentor-login-form') {
    submitLogin('mentor', 'mentor-email', 'mentor-password');
    return;
  }

  if (formId === 'coordinator-login-form') {
    submitLogin('coordinator', 'coordinator-email', 'coordinator-password');
    return;
  }

  // Signup handlers
  if (formId === 'student-signup-form') {
    var name = document.getElementById('student-fullname').value.trim();
    var email = document.getElementById('student-signup-email').value.trim();
    var password = document.getElementById('student-signup-password').value;
    var confirm = document.getElementById('student-confirm-password').value;
    var enrollment_no = document.getElementById('student-enrollment').value.trim();
    var branch = document.getElementById('student-branch').value;
    var skills = document.getElementById('student-skills').value.trim();
    if (!name) return showFieldError('student-fullname', 'Name required');
    if (!validateEmail(email)) return showFieldError('student-signup-email', 'Invalid email');
    if (!validatePassword(password)) return showFieldError('student-signup-password', 'Password must be at least 8 characters');
    if (!confirmPasswordMatch(password, confirm)) return showFieldError('student-confirm-password', 'Passwords do not match');
    var year = document.getElementById('student-year').value;
    setLoading(true);
    postJSON('/api/auth/register', { name: name, email: email, password: password, role: 'student', roll_number: enrollment_no, branch: branch, year: year, skills: skills })
      .then(completeAuth)
      .catch(function () { showFormSuccess('Unable to connect to PEC server'); })
      .finally(function () { setLoading(false); });
    return;
  }

  if (formId === 'mentor-signup-form') {
    var name = document.getElementById('mentor-fullname').value.trim();
    var email = document.getElementById('mentor-signup-email').value.trim();
    var password = document.getElementById('mentor-signup-password').value;
    var confirm = document.getElementById('mentor-confirm-password').value;
    var expertise = document.getElementById('mentor-expertise').value.trim();
    var experience = document.getElementById('mentor-experience').value.trim();
    var skills = document.getElementById('mentor-skills').value.trim();
    if (!name) return showFieldError('mentor-fullname', 'Name required');
    if (!validateEmail(email)) return showFieldError('mentor-signup-email', 'Invalid email');
    if (!validatePassword(password)) return showFieldError('mentor-signup-password', 'Password too short');
    if (!confirmPasswordMatch(password, confirm)) return showFieldError('mentor-confirm-password', 'Passwords do not match');
    var department = document.getElementById('mentor-department').value;
    var designation = document.getElementById('mentor-designation').value;
    setLoading(true);
    postJSON('/api/auth/register', { name: name, email: email, password: password, role: 'mentor', specialization: expertise, experience: experience, skills: skills, department: department, designation: designation })
      .then(completeAuth)
      .catch(function () { showFormSuccess('Unable to connect to PEC server'); })
      .finally(function () { setLoading(false); });
    return;
  }

  if (formId === 'coordinator-signup-form') {
    var name = document.getElementById('coordinator-fullname').value.trim();
    var email = document.getElementById('coordinator-signup-email').value.trim();
    var password = document.getElementById('coordinator-signup-password').value;
    var confirm = document.getElementById('coordinator-confirm-password').value;
    var department = document.getElementById('coordinator-department').value;
    var employee_id = document.getElementById('coordinator-id').value.trim();
    if (!name) return showFieldError('coordinator-fullname', 'Name required');
    if (!validateEmail(email)) return showFieldError('coordinator-signup-email', 'Invalid email');
    if (!validatePassword(password)) return showFieldError('coordinator-signup-password', 'Password must be at least 8 characters');
    if (!confirmPasswordMatch(password, confirm)) return showFieldError('coordinator-confirm-password', 'Passwords do not match');
    setLoading(true);
    postJSON('/api/auth/register', { name: name, email: email, password: password, role: 'coordinator', department: department, employee_id: employee_id })
      .then(completeAuth)
      .catch(function () { showFormSuccess('Unable to connect to PEC server'); })
      .finally(function () { setLoading(false); });
    return;
  }

  // Fallback: show generic success (should not reach here)
  showFormSuccess('Form submitted');
});

/* ============================================================
   SECTION 10 — INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  initRoleCards();
  initRoleCardAnimations();
  initEntryAnimations();
  initMouseParallax();
  document.querySelectorAll('.auth-links a').forEach(function (link) {
    if (link.textContent.toLowerCase().indexOf('forgot') === -1) return;
    link.addEventListener('click', function (event) {
      event.preventDefault();
      showFormSuccess('Password reset is not enabled yet. Please contact a PEC coordinator.');
    });
  });
});
