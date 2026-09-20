// ========================================
// SECTION 1 - ROLE SWITCHING
// ========================================

function switchRole(role) {
  document.querySelectorAll('[id^="app-"]').forEach(function(el) {
    el.style.display = 'none';
    el.classList.remove('active');
  });

  if (!role) {
    document.getElementById('app-role-select').style.display = 'flex';
    document.getElementById('app-role-select').classList.add('active');
    return;
  }

  var app = document.getElementById('app-' + role);
  if (app) {
    app.style.display = 'flex';
    app.classList.add('active');
    var defaultPage = role.charAt(0) + role.slice(1) + '-dashboard';
    navigateTo(defaultPage);
  }
}

// ========================================
// SECTION 2 - HASH ROUTING
// ========================================

function navigateTo(pageId) {
  var activeApp = document.querySelector('[id^="app-"][style*="flex"], [id^="app-"].active');
  if (!activeApp) return;

  activeApp.querySelectorAll('.sub-page').forEach(function(p) {
    p.classList.remove('active');
  });

  var target = document.getElementById(pageId);
  if (target) {
    target.classList.add('active');
  }

  activeApp.querySelectorAll('.sidebar-nav a').forEach(function(link) {
    link.classList.remove('active');
    if (link.getAttribute('href') === '#' + pageId) {
      link.classList.add('active');
    }
  });

  if (history.replaceState) {
    history.replaceState(null, null, '#' + pageId);
  }

  var sidebar = activeApp.querySelector('.sidebar');
  var overlay = activeApp.querySelector('.sidebar-overlay');
  if (sidebar) sidebar.classList.remove('active');
  if (overlay) overlay.classList.remove('active');

  window.scrollTo(0, 0);

  setTimeout(function() {
    animateProgressBars();
    renderBarCharts();
  }, 100);
}

window.addEventListener('hashchange', function() {
  var hash = window.location.hash.slice(1);
  if (hash) navigateTo(hash);
});

// ========================================
// SECTION 3 - SIDEBAR NAVIGATION
// ========================================

function initSidebarNav() {
  document.querySelectorAll('.sidebar-nav a').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      var href = this.getAttribute('href');
      if (href && href.startsWith('#') && href.length > 1) {
        navigateTo(href.slice(1));
      }
    });
  });
}

// ========================================
// SECTION 4 - MOBILE SIDEBAR TOGGLE
// ========================================

function initSidebarToggle() {
  document.querySelectorAll('.sidebar-toggle, .menu-toggle').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var app = this.closest('[id^="app-"]');
      if (!app) return;
      var sidebar = app.querySelector('.sidebar');
      var overlay = app.querySelector('.sidebar-overlay');
      if (sidebar) sidebar.classList.toggle('active');
      if (overlay) overlay.classList.toggle('active');
    });
  });

  document.querySelectorAll('.sidebar-overlay').forEach(function(overlay) {
    overlay.addEventListener('click', function() {
      this.classList.remove('active');
      var sidebar = this.previousElementSibling;
      if (sidebar && sidebar.classList.contains('sidebar')) {
        sidebar.classList.remove('active');
      }
    });
  });
}

// ========================================
// SECTION 5 - TOAST NOTIFICATIONS
// ========================================

function showToast(message, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:24px;right:24px;z-index:10000;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }

  var toast = document.createElement('div');
  toast.className = 'toast ' + type;

  var icons = {
    success: 'fa-check-circle',
    error: 'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  toast.innerHTML = '<i class="fas ' + (icons[type] || icons.info) + '"></i><span>' + message + '</span>';

  container.appendChild(toast);

  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() {
    toast.classList.remove('show');
    setTimeout(function() { toast.remove(); }, 300);
  }, 3000);
}

// ========================================
// SECTION 6 - MODAL
// ========================================

function showModal(title, bodyHtml, buttons) {
  var overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;';
    overlay.innerHTML = '<div style="background:var(--bg-card);border-radius:12px;padding:24px;max-width:480px;width:90%;max-height:80vh;overflow:auto;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 id="modal-title"></h3><button class="btn-close" onclick="closeModal()" style="background:none;border:none;font-size:18px;cursor:pointer;">&times;</button></div><div id="modal-body"></div><div id="modal-footer" style="display:flex;gap:8px;justify-content:flex-end;margin-top:24px;"></div></div>';
    document.body.appendChild(overlay);
  }

  var titleEl = document.getElementById('modal-title');
  var bodyEl = document.getElementById('modal-body');
  var footerEl = document.getElementById('modal-footer');

  if (!overlay || !titleEl) return;

  titleEl.textContent = title;
  bodyEl.innerHTML = bodyHtml;
  footerEl.innerHTML = '';

  if (buttons) {
    buttons.forEach(function(btn) {
      var el = document.createElement('button');
      el.className = 'btn ' + (btn.class || 'btn-ghost');
      el.textContent = btn.text;
      el.addEventListener('click', function() {
        if (btn.action) btn.action();
        closeModal();
      });
      footerEl.appendChild(el);
    });
  }

  overlay.style.display = 'flex';
}

function closeModal() {
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ========================================
// SECTION 7 - PROGRESS BAR ANIMATION
// ========================================

function animateProgressBars() {
  document.querySelectorAll('.progress-fill[data-width]').forEach(function(fill) {
    var width = fill.getAttribute('data-width');
    setTimeout(function() { fill.style.width = width; }, 300);
  });
}

// ========================================
// SECTION 8 - CHART RENDERING
// ========================================

function renderBarCharts() {
  document.querySelectorAll('.chart-bar[data-values]').forEach(function(chart) {
    var values = JSON.parse(chart.getAttribute('data-values'));
    var labels = JSON.parse(chart.getAttribute('data-labels') || '[]');
    var maxVal = Math.max.apply(null, values);

    chart.innerHTML = '';
    values.forEach(function(val, i) {
      var item = document.createElement('div');
      item.className = 'chart-bar-item';
      var height = (val / maxVal * 100);
      item.innerHTML = '<div class="bar" style="height:' + height + '%"></div>' +
        (labels[i] ? '<div class="label">' + labels[i] + '</div>' : '');
      chart.appendChild(item);
    });
  });
}

// ========================================
// SECTION 9 - SEARCH/FILTER
// ========================================

function initSearch() {
  document.querySelectorAll('.search-input').forEach(function(input) {
    input.addEventListener('input', function() {
      var query = this.value.toLowerCase();
      var container = this.getAttribute('data-target');
      var items = document.querySelectorAll((container || '') + ' .searchable-item');
      items.forEach(function(item) {
        var text = item.textContent.toLowerCase();
        item.style.display = text.indexOf(query) > -1 ? '' : 'none';
      });
    });
  });
}

function initFilterChips() {
  document.querySelectorAll('.filter-chips .chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var group = this.closest('.filter-chips');
      if (group) group.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('active'); });
      this.classList.add('active');

      var filter = this.getAttribute('data-filter');
      var target = this.getAttribute('data-target');
      var items = document.querySelectorAll((target || '') + ' .filterable-item');

      items.forEach(function(item) {
        if (!filter || filter === 'all') {
          item.style.display = '';
        } else {
          item.style.display = item.getAttribute('data-category') === filter ? '' : 'none';
        }
      });
    });
  });
}

// ========================================
// SECTION 10 - CONFIRMATION DIALOG
// ========================================

function confirmAction(message, onConfirm) {
  showModal('Confirm Action', '<p>' + message + '</p>', [
    { text: 'Cancel', class: 'btn-ghost' },
    { text: 'Confirm', class: 'btn-primary', action: onConfirm }
  ]);
}

// ========================================
// SECTION 11 - GREETING TIME
// ========================================

function getGreeting() {
  var hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// ========================================
// SECTION 12 - TOAST TRIGGER BUTTONS
// ========================================

function initToastTriggers() {
  document.querySelectorAll('[data-toast]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      showToast(this.getAttribute('data-toast'), 'success');
    });
  });

  document.querySelectorAll('[data-confirm]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var msg = this.getAttribute('data-confirm');
      confirmAction(msg, function() { showToast('Action completed', 'success'); });
    });
  });

  document.querySelectorAll('.btn').forEach(function(btn) {
    var text = btn.textContent.trim().toLowerCase();
    if (btn.closest('#modal-overlay')) return;

    if (text === 'save' || text.indexOf('save') > -1) {
      btn.addEventListener('click', function() {
        if (!this.hasAttribute('data-toast') && !this.hasAttribute('data-confirm')) {
          showToast('Saved successfully', 'success');
        }
      });
    } else if (text === 'delete' || text.indexOf('delete') > -1) {
      btn.addEventListener('click', function() {
        if (!this.hasAttribute('data-toast') && !this.hasAttribute('data-confirm')) {
          confirmAction('Are you sure you want to delete this?', function() {
            showToast('Deleted successfully', 'success');
          });
        }
      });
    } else if (text === 'publish' || text.indexOf('publish') > -1) {
      btn.addEventListener('click', function() {
        if (!this.hasAttribute('data-toast') && !this.hasAttribute('data-confirm')) {
          showToast('Published successfully', 'success');
        }
      });
    } else if (text === 'assign' || text.indexOf('assign') > -1) {
      btn.addEventListener('click', function() {
        if (!this.hasAttribute('data-toast') && !this.hasAttribute('data-confirm')) {
          showToast('Assigned successfully', 'success');
        }
      });
    }
  });
}

// ========================================
// SECTION 13 - INIT
// ========================================

document.addEventListener('DOMContentLoaded', function() {
  initSidebarNav();
  initSidebarToggle();
  initSearch();
  initFilterChips();
  animateProgressBars();
  renderBarCharts();
  initToastTriggers();

  var greetingEls = document.querySelectorAll('[data-greeting]');
  var greeting = getGreeting();
  greetingEls.forEach(function(el) {
    el.textContent = greeting + ', ' + el.getAttribute('data-greeting');
  });

  var hash = window.location.hash.slice(1);
  if (hash) {
    if (hash.startsWith('student-')) switchRole('student');
    else if (hash.startsWith('mentor-')) switchRole('mentor');
    else if (hash.startsWith('coord-')) switchRole('coordinator');
    navigateTo(hash);
  }
});
