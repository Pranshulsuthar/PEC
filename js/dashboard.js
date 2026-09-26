// ========================================
// SECTION 1 - ROLE SWITCHING
// ========================================

function switchRole(role) {
  if (!role) {
    sessionStorage.removeItem('pec_jwt');
    window.location.replace('../index.html');
    return;
  }
  // after switching UI, load role‑specific data from backend
  var token = sessionStorage.getItem('pec_jwt');
  var tokenUser = null;
  if (token) {
    try {
      tokenUser = JSON.parse(atob(token.split('.')[1]));
      if (tokenUser.exp && tokenUser.exp * 1000 <= Date.now()) throw new Error('expired');
    } catch (e) {
      sessionStorage.removeItem('pec_jwt');
    }
  }

  if (!tokenUser || !['student', 'mentor', 'coordinator'].includes(tokenUser.role)) {
    sessionStorage.removeItem('pec_jwt');
    window.location.replace('../pages/auth.html');
    return;
  }
  if (role !== tokenUser.role) {
    role = tokenUser.role;
  }
  window.currentUser = tokenUser;
  var roleLabel = role.charAt(0).toUpperCase() + role.slice(1) + ' Portal';
  document.querySelectorAll('[data-role-context]').forEach(function (el) { el.textContent = roleLabel; });
  if (role === 'student') {
    loadStudentDashboard();
  } else if (role === 'mentor') {
    loadMentorDashboard();
  } else if (role === 'coordinator') {
    loadCoordinatorDashboard();
  }

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
    var defaultPage = role === 'coordinator' ? 'coord-dashboard' : role + '-dashboard';
    navigateTo(defaultPage);
  }
}

// ========================================
// SECTION 2 - HASH ROUTING
// ========================================

function navigateTo(pageId) {
  var activeApp = document.querySelector('[id^="app-"][style*="flex"], [id^="app-"].active');
  if (!activeApp) return;
  var portalRole = activeApp.id.replace('app-', '');
  if ((portalRole === 'student' && pageId.startsWith('student-')) || (portalRole === 'mentor' && pageId.startsWith('mentor-')) || (portalRole === 'coordinator' && pageId.startsWith('coord-'))) {
    sessionStorage.setItem('pec-dashboard-last-page', pageId);
  }

  activeApp.querySelectorAll('.sub-page').forEach(function(p) {
    p.classList.remove('active');
  });

  var target = activeApp.querySelector('#' + pageId);
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

  var mobileTitle = activeApp.querySelector('.mobile-title');
  if (mobileTitle && target) {
    var h = target.querySelector('.dashboard-header h1');
    mobileTitle.textContent = h ? h.textContent.split(',')[0].replace('Good Morning', 'Morning').replace('Good Afternoon', 'Afternoon').replace('Good Evening', 'Evening').trim() : 'Dashboard';
  }

  window.scrollTo(0, 0);

  setTimeout(function() {
    animateProgressBars();
    renderBarCharts();
    animateDashSections(target);
  }, 100);
}

function animateDashSections(container) {
  if (!container) return;
  var sections = container.querySelectorAll('.dashboard-stats, .dashboard-grid, .dashboard-section, .table-responsive, .filter-chips, .dashboard-header');
  sections.forEach(function(el, i) {
    el.classList.remove('dash-animate-in', 'dash-visible');
    el.classList.add('dash-animate-in');
    setTimeout(function() {
      el.classList.add('dash-visible');
    }, 60 * i);
  });
}

window.addEventListener('hashchange', function() {
  var hash = window.location.hash.slice(1);
  if (hash) navigateTo(hash);
});

document.addEventListener('click', function (event) {
  var backButton = event.target.closest('[data-dashboard-back]');
  if (!backButton) return;
  event.preventDefault();
  var referrer = document.referrer;
  if (referrer) {
    try {
      var previousPage = new URL(referrer);
      if (previousPage.origin === window.location.origin && previousPage.href !== window.location.href) {
        window.history.back();
        return;
      }
    } catch (error) {}
  }
  window.location.href = '../index.html';
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
      var app = this.closest('[id^="app-"]');
      if (app) {
        var sidebar = app.querySelector('.sidebar');
        var overlay = app.querySelector('.sidebar-overlay');
        if (sidebar) sidebar.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
      }
    });
  });
}

// ========================================
// SECTION 4 - MOBILE SIDEBAR TOGGLE
// ========================================

function initSidebarToggle() {
  document.querySelectorAll('.sidebar-toggle, .menu-toggle, [data-dashboard-sidebar-toggle]').forEach(function(btn) {
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
        var result = btn.action ? btn.action() : undefined;
        if (result && typeof result.then === 'function') {
          result.then(function (value) { if (value !== false) closeModal(); });
        } else if (result !== false) {
          closeModal();
        }
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
    if (btn.closest('#modal-overlay') || btn.closest('#app-coordinator')) return;

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
      if (!btn.hasAttribute('data-quick-action') && !btn.hasAttribute('data-unassign-id')) {
        btn.addEventListener('click', function() {
          if (!this.hasAttribute('data-toast') && !this.hasAttribute('data-confirm')) showToast('Assigned successfully', 'success');
        });
      }
    }
  });
}

// ========================================
// SECTION 13 - INIT
// ========================================

function apiRequest(path) {
  var token = sessionStorage.getItem('pec_jwt');
  return fetch(path, {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function (response) {
    if (response.status === 401) {
      sessionStorage.removeItem('pec_jwt');
      window.location.replace('../pages/auth.html');
      return null;
    }
    return response.json();
  });
}

function apiMutation(path, method, body) {
  return fetch(path, {
    method: method,
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + sessionStorage.getItem('pec_jwt') },
    body: JSON.stringify(body || {})
  }).then(function (response) { return response.json(); });
}

function initials(name) {
  return (name || 'PEC').split(' ').map(function (part) { return part[0]; }).join('').slice(0, 2).toUpperCase();
}

function setText(selector, value) {
  var el = document.querySelector(selector);
  if (el && value !== undefined && value !== null) el.textContent = value;
}

function renderNews(appSelector, news) {
  var section = Array.from(document.querySelectorAll(appSelector + ' .dashboard-section h3')).find(function (heading) {
    return heading.textContent.toLowerCase().indexOf('news') !== -1;
  });
  if (!section || !news) return;
  var body = section.parentElement.nextElementSibling;
  if (!body) return;
  body.innerHTML = news.length ? news.map(function (item) {
    return '<div class="student-list-item"><div class="student-avatar"><i class="fas fa-newspaper"></i></div><div class="student-info"><div class="student-name">' + escapeHtml(item.title) + '</div><div class="student-meta">' + new Date(item.created_at).toLocaleDateString() + (item.category ? ' · ' + escapeHtml(item.category) : '') + '</div></div></div>';
  }).join('') : '<div class="empty-state">No published news yet.</div>';
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; });
}

function renderRoleIdentity(appSelector, profile, role) {
  var name = profile && profile.name ? profile.name : role;
  document.querySelectorAll(appSelector + ' .user-name, ' + appSelector + ' .coordinator-sidebar-name').forEach(function (el) { el.textContent = name; });
  document.querySelectorAll(appSelector + ' .user-avatar').forEach(function (el) { el.textContent = initials(name); });
  var heading = document.querySelector(appSelector + ' .sub-page.active .dashboard-header h1');
  if (heading) {
    var greeting = getGreeting();
    if (role === 'student') {
      heading.innerHTML = greeting + ', <span class="user-name">' + escapeHtml(name) + '</span>';
    } else {
      heading.textContent = 'Welcome, ' + escapeHtml(name);
    }
  }
}

function renderStudentCollections(data) {
  var resources = document.getElementById('student-resources-list');
  if (resources) resources.innerHTML = (data.resources || []).map(function (item) {
    return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(item.title) + '</h4><p>' + escapeHtml(item.description || item.category || item.resource_type) + '</p><a class="btn btn-primary btn-sm" href="' + escapeHtml(item.resource_url) + '" target="_blank" rel="noopener">Open Resource</a></div></div>';
  }).join('') || '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No published resources yet.</p></div></div>';
  var achievements = document.getElementById('student-achievements-list');
  if (achievements) achievements.innerHTML = (data.achievements || []).map(function (item) {
    return '<div class="dashboard-section"><div class="dashboard-section-body"><div class="stat-icon" style="color:#f59e0b"><i class="fas fa-medal"></i></div><h4>' + escapeHtml(item.title) + '</h4><p>' + escapeHtml(item.description || item.achievement_type || 'Achievement') + '</p></div></div>';
  }).join('') || '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No achievements recorded yet.</p></div></div>';
  var attendance = document.getElementById('student-attendance-list');
  if (attendance) attendance.innerHTML = (data.attendance || []).map(function (item) {
    return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(item.status) + '</h4><div class="stat-value">' + item.count + '</div><p>Recorded sessions</p></div></div>';
  }).join('') || '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No attendance records yet.</p></div></div>';
}

function renderStudentTasks(tasks) {
  var container = document.querySelector('#app-student .student-challenge-list');
  if (!container) return;
  container.innerHTML = tasks.length ? tasks.map(function (task) { return '<div class="dashboard-section"><div class="dashboard-section-body"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><span class="chip">' + escapeHtml(task.difficulty || 'Challenge') + '</span><span class="chip">' + Number(task.max_score || 0) + ' points</span></div><h4 style="margin:0 0 4px;">' + escapeHtml(task.title) + '</h4><p style="font-size:13px;color:var(--text-secondary);margin:0 0 12px;">' + escapeHtml(task.description || 'No description') + '</p>' + (task.deadline ? '<div class="task-meta"><span><i class="fas fa-calendar"></i> Due: ' + new Date(task.deadline).toLocaleDateString() + '</span></div>' : '') + '<button type="button" class="btn btn-primary student-start-challenge" data-task-id="' + escapeHtml(task.id) + '" style="width:100%;margin-top:12px;">Submit Solution</button></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No challenges assigned yet.</p></div></div>';
  var select = document.querySelector('#student-challenge-submission-form select[name="task_id"]');
  if (select) {
    select.innerHTML = '<option value="">Select an assigned challenge</option>' + tasks.map(function (task) { return '<option value="' + escapeHtml(task.id) + '">' + escapeHtml(task.title) + '</option>'; }).join('');
    select.disabled = tasks.length === 0;
    var submitButton = document.querySelector('#student-challenge-submission-form button[type="submit"]');
    if (submitButton) submitButton.disabled = tasks.length === 0;
  }
  container.querySelectorAll('.student-start-challenge').forEach(function (button) { button.addEventListener('click', function () { navigateTo('student-submissions'); var taskSelect = document.querySelector('#student-challenge-submission-form select[name="task_id"]'); if (taskSelect) taskSelect.value = button.dataset.taskId; }); });
}

function renderStudentSubmissions(submissions) {
  var tbody = document.getElementById('student-submissions-list');
  if (tbody) tbody.innerHTML = submissions.length ? submissions.map(function (submission) { return '<tr><td>' + escapeHtml(submission.title) + '</td><td>' + escapeHtml(submission.status) + '</td><td>' + new Date(submission.submitted_at).toLocaleDateString() + '</td><td>' + (submission.score === null ? '—' : Number(submission.score)) + '</td><td>' + escapeHtml(submission.feedback || '—') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="empty-state">No submissions yet.</td></tr>';
}

function initStudentSubmissionForm() {
  var form = document.getElementById('student-challenge-submission-form');
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = 'true';
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var formData = new FormData(form);
    var payload = { task_id: formData.get('task_id'), code: formData.get('code'), submission_url: formData.get('submission_url') };
    var submitButton = form.querySelector('button[type="submit"]');
    if (!payload.task_id) return showToast('Select a challenge first', 'error');
    if (!payload.code && !payload.submission_url) return showToast('Enter a solution or a submission URL', 'error');
    if (submitButton) submitButton.disabled = true;
    apiMutation('/api/submissions', 'POST', payload).then(function (result) {
      if (!result || !result.success) return showToast(result && result.message || 'Unable to submit challenge', 'error');
      showToast('Challenge submitted', 'success');
      form.reset();
      loadStudentDashboard();
    }).finally(function () { if (submitButton) submitButton.disabled = false; });
  });
}

function loadStudentDashboard() {
  initStudentSubmissionForm();
  apiRequest('/api/dashboard/student').then(function (data) {
    if (!data || !data.success) return;
    renderRoleIdentity('#app-student', data.profile, 'Student');
    var stats = data.progress || {};
    renderStudentTasks(data.tasks || []);
    renderStudentSubmissions(data.submissions || []);
    var values = document.querySelectorAll('#app-student .dashboard-stat-card .stat-value');
    if (values[0]) values[0].textContent = data.progress.total_tasks || 0;
    if (values[1]) values[1].textContent = stats.completed_tasks || 0;
    if (values[2]) values[2].textContent = stats.current_streak || 0;
    if (values[3]) values[3].textContent = stats.rank ? '#' + stats.rank : '—';
    var studentHeader = document.querySelector('#app-student .dashboard-student-header h1');
    if (studentHeader) studentHeader.innerHTML = getGreeting() + ', <span class="user-name">' + escapeHtml(data.profile.name || 'Student') + '</span>';
    var profileName = data.profile.name || 'Student';
    document.querySelectorAll('#app-student .user-name').forEach(function (el) { el.textContent = profileName; });
    var profileHeader = document.querySelector('#app-student .student-profile-name');
    if (profileHeader) profileHeader.textContent = profileName;
    var profileAvatar = document.querySelector('#app-student .student-profile-avatar');
    if (profileAvatar) profileAvatar.textContent = initials(profileName);
    var profileMeta = document.querySelector('#app-student .student-profile-meta');
    if (profileMeta) profileMeta.textContent = [data.profile.branch, data.profile.year ? data.profile.year + ' Year' : ''].filter(Boolean).join(' · ') || 'Profile information not added yet';
    var profileContact = document.querySelector('#app-student .student-profile-contact');
    if (profileContact) profileContact.textContent = (data.profile.student_code || 'Student ID unavailable') + ' · ' + (data.profile.email || 'Email unavailable');
    var profileStats = document.querySelectorAll('#app-student .student-profile-stat');
    if (profileStats[0]) profileStats[0].textContent = data.progress.total_tasks || 0;
    if (profileStats[1]) profileStats[1].textContent = data.progress.completed_tasks || 0;
    if (profileStats[2]) profileStats[2].textContent = data.progress.rank ? '#' + data.progress.rank : '—';
    if (profileStats[3]) profileStats[3].textContent = data.progress.points || 0;
    renderNews('#app-student', data.news);
    renderStudentCollections(data);
    var groupId = data.profile.group_id || null;
    var mentorCard = document.querySelector('#app-student .student-mentor-card');
    if (mentorCard) mentorCard.innerHTML = data.mentor ? '<div class="mentor-avatar">' + escapeHtml(initials(data.mentor.name)) + '</div><div><div class="mentor-name">' + escapeHtml(data.mentor.name) + '</div><div class="mentor-spec">' + escapeHtml(data.mentor.specialization || data.mentor.designation || 'Mentor') + '</div><div class="mentor-status">Mentor ID: ' + escapeHtml(data.mentor.mentor_code || 'Assigned') + '</div></div>' : '<div class="mentor-avatar"><i class="fas fa-user-clock"></i></div><div><div class="mentor-name">No mentor assigned</div><div class="mentor-spec">A coordinator will assign your mentor.</div><div class="mentor-status">Waiting for assignment</div></div>';
    var mentorDetails = document.querySelector('#app-student .student-mentor-details .dashboard-section-body');
    var mentorGroup = document.querySelector('#app-student .student-mentor-group');
    if (data.mentor) {
      if (mentorDetails) mentorDetails.innerHTML = '<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;"><div class="mentor-avatar" style="width:72px;height:72px;font-size:28px;">' + escapeHtml(initials(data.mentor.name)) + '</div><div><h3 style="margin:0;">' + escapeHtml(data.mentor.name) + '</h3><p style="color:var(--text-secondary);margin:4px 0;">Mentor ID: ' + escapeHtml(data.mentor.mentor_code || 'Unavailable') + '</p><p style="color:#22c55e;font-size:13px;margin:0;"><i class="fas fa-circle" style="font-size:8px;"></i> Assigned</p></div></div>';
      if (mentorGroup) mentorGroup.innerHTML = '<p><strong>' + escapeHtml(data.mentor.group_name || 'Assigned group') + '</strong></p><p style="color:var(--text-secondary);">Group ID: ' + escapeHtml(data.mentor.group_id || 'Unavailable') + '</p><p class="empty-state">You can access mentor content for this assigned group only.</p>';
    } else {
      if (mentorDetails) mentorDetails.innerHTML = '<p class="empty-state">No mentor assigned yet. A coordinator will assign a mentor to your account.</p>';
      if (mentorGroup) mentorGroup.innerHTML = '<p class="empty-state">No group access until a mentor is assigned.</p>';
    }
    var challengeContainer = document.querySelector('#app-student .student-current-challenge');
    if (challengeContainer) challengeContainer.innerHTML = data.tasks.length ? data.tasks.map(function (task) { return '<div class="task-item"><div class="task-title">' + escapeHtml(task.title) + '</div><div class="task-desc">' + escapeHtml(task.description || 'No description') + '</div></div>'; }).join('') : '<p class="empty-state">No tasks assigned yet. Your mentor will add tasks here.</p>';
  }).catch(function (error) { console.error('Student dashboard failed', error); });
}

function renderMentorStudentProfile(student) {
  var card = document.querySelector('#app-mentor .mentor-student-profile-card .dashboard-section-body');
  var stats = document.querySelector('#app-mentor .mentor-student-stats .dashboard-section-body');
  var progress = document.querySelector('#app-mentor .mentor-student-progress .dashboard-section-body');
  if (!student) {
    if (card) card.innerHTML = '<p class="empty-state">Select an assigned student from My Mentees to view their profile.</p>';
    if (stats) stats.innerHTML = '<p class="empty-state">No student selected.</p>';
    if (progress) progress.innerHTML = '<p class="empty-state">No progress data recorded yet.</p>';
    return;
  }
  if (card) card.innerHTML = '<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;"><div class="user-avatar" style="width:72px;height:72px;font-size:28px;">' + escapeHtml(initials(student.name)) + '</div><div><h3 style="margin:0;">' + escapeHtml(student.name) + '</h3><p style="color:var(--text-secondary);margin:4px 0;">Student ID: ' + escapeHtml(student.student_code || 'Unavailable') + '</p><p style="color:var(--text-secondary);margin:0;">Enrollment: ' + escapeHtml(student.enrollment_no || 'Unavailable') + ' · ' + escapeHtml(student.branch || 'Branch unavailable') + (student.year ? ' · Year ' + escapeHtml(student.year) : '') + '</p><p style="color:#22c55e;font-size:13px;margin:4px 0 0;"><i class="fas fa-circle" style="font-size:8px;"></i> Assigned to you</p><p style="color:var(--text-secondary);margin:4px 0 0;">Skills: ' + escapeHtml(student.skills || 'Not provided') + '</p></div></div>';
  if (stats) stats.innerHTML = '<div class="student-meta">No challenges or points recorded yet.</div>';
  if (progress) progress.innerHTML = '<p class="empty-state">No progress data recorded yet.</p>';
}

function loadMentorDashboard() {
  var initialMenteeList = document.querySelector('#app-mentor .mentor-mentees-list');
  if (initialMenteeList) initialMenteeList.innerHTML = '<div class="dashboard-section mentor-empty-state"><div class="dashboard-section-body"><p class="empty-state">Loading assigned mentees...</p></div></div>';
  apiRequest('/api/dashboard/mentor').then(function (data) {
    if (!data || !data.success) return;
    renderRoleIdentity('#app-mentor', data.profile, 'Mentor');
    var mentorName = document.querySelector('#app-mentor .mentor-dashboard-name');
    if (mentorName) mentorName.textContent = data.profile.name || 'Mentor';
    var values = document.querySelectorAll('#app-mentor .dashboard-stat-card .stat-value');
    if (values[0]) values[0].textContent = data.students.length;
    if (values[1]) values[1].textContent = data.pendingReviews || 0;
    if (values[2]) values[2].textContent = data.capacity.assigned + ' / ' + data.capacity.maximum;
    if (values[3]) values[3].textContent = data.meetings || 0;
    renderNews('#app-mentor', data.news);
    var menteeList = document.querySelector('#app-mentor .mentor-mentees-list');
    if (menteeList) {
      menteeList.innerHTML = data.students.length ? data.students.map(function (student) { return '<div class="dashboard-section"><div class="dashboard-section-body"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;"><div class="student-avatar">' + escapeHtml(initials(student.name)) + '</div><div><h4 style="margin:0;">' + escapeHtml(student.name) + '</h4><p style="margin:0;font-size:12px;color:var(--text-secondary);">' + escapeHtml(student.student_code || 'Student ID unavailable') + '</p><p style="margin:4px 0 0;font-size:12px;color:var(--text-secondary);">' + escapeHtml([student.branch, student.year ? student.year + ' Year' : ''].filter(Boolean).join(' · ') || 'Profile details unavailable') + '</p></div></div><button class="btn btn-primary btn-sm mentor-view-student" data-student-id="' + escapeHtml(student.id) + '" style="margin-top:12px;width:100%;">View Profile</button></div></div>'; }).join('') : '<div class="dashboard-section mentor-empty-state"><div class="dashboard-section-body"><p class="empty-state">No mentees assigned yet. Coordinators can assign students from Mentor Allocation.</p></div></div>';
      menteeList.querySelectorAll('.mentor-view-student').forEach(function (button) { button.addEventListener('click', function () { var student = data.students.find(function (item) { return String(item.id) === String(button.dataset.studentId); }); renderMentorStudentProfile(student); navigateTo('mentor-student-profile'); }); });
    }
    var mentorList = document.querySelector('#app-mentor .mentor-dashboard-mentees');
    if (mentorList) mentorList.innerHTML = data.students.length ? data.students.slice(0, 5).map(function (student) { return '<div class="student-list-item"><div class="student-avatar">' + escapeHtml(initials(student.name)) + '</div><div class="student-info"><div class="student-name">' + escapeHtml(student.name) + '</div><div class="student-meta">' + escapeHtml(student.student_code || 'Student ID unavailable') + '</div></div><span class="student-status status-active">Assigned</span></div>'; }).join('') : '<div class="student-list-item"><div class="student-info"><div class="student-name">No mentees assigned yet.</div><div class="student-meta">Coordinators can assign students from Mentor Allocation.</div></div></div>';
  }).catch(function (error) { console.error('Mentor dashboard failed', error); });
}

function loadCoordinatorDashboard() {
  Promise.all([
    apiRequest('/api/coordinators/dashboard'),
    apiRequest('/api/coordinators/students'),
    apiRequest('/api/coordinators/mentors'),
    apiRequest('/api/coordinators/assignments'),
    apiRequest('/api/coordinators/submissions'),
    apiRequest('/api/tasks'),
    apiRequest('/api/coordinators/events'),
    apiRequest('/api/coordinators/news'),
    apiRequest('/api/coordinators/resources'),
    apiRequest('/api/coordinators/leaderboard')
  ]).then(function (results) {
    var data = results[0];
    if (!data || !data.success) return;
    renderRoleIdentity('#app-coordinator', { name: window.currentUser.name }, 'Coordinator');
    var values = document.querySelectorAll('#app-coordinator .dashboard-stat-card .stat-value');
    if (values[0]) values[0].textContent = data.stats.students;
    if (values[1]) values[1].textContent = data.stats.mentors;
    if (values[2]) values[2].textContent = data.stats.assignedMentees;
    if (values[3]) values[3].textContent = data.stats.tasks;
    if (values[4]) values[4].textContent = data.stats.submissions;
    if (values[5]) values[5].textContent = data.stats.events;
    renderCoordinatorRecentStudents(data.recentStudents || []);
    renderCoordinatorRecentSubmissions(data.recentSubmissions || []);
    renderCoordinatorUpcomingEvents(data.upcomingEvents || []);
    renderCoordinatorStudents(results[1] && results[1].students || []);
    renderCoordinatorMentors(results[2] && results[2].mentors || []);
    renderCoordinatorAssignments(results[3] && results[3].assignments || []);
    renderCoordinatorSubmissions(results[4] && results[4].submissions || []);
    renderCoordinatorChallenges(results[5] && results[5].tasks || []);
    renderCoordinatorEvents(results[6] && results[6].events || []);
    renderCoordinatorNews(results[7] && results[7].news || []);
    renderNews('#app-coordinator', []);
    renderCoordinatorResources(results[8] && results[8].resources || []);
    renderCoordinatorLeaderboard(results[9] && results[9].leaderboard || []);
    renderCoordinatorProfileStats(data.stats);
    refreshCoordinatorAssignmentOptions(results[2] && results[2].mentors || [], results[1] && results[1].students || []);
    initCoordinatorAssignmentForm();
  }).catch(function (error) { console.error('Coordinator dashboard failed', error); });
}

function initCoordinatorReviewActions() {
  document.addEventListener('click', function (event) {
    var button = event.target.closest('[data-review-submission]');
    if (!button || button.dataset.loaded) return;
    button.dataset.loaded = 'true';
    apiRequest('/api/submissions/' + encodeURIComponent(button.dataset.reviewSubmission)).then(function (result) {
      if (!result || !result.success) { button.dataset.loaded = ''; return showToast(result && result.message || 'Unable to load submission', 'error'); }
      openSubmissionReview(result.submission);
    });
  });
}

function renderCoordinatorRecentStudents(students) {
  var container = document.getElementById('coordinator-recent-students');
  if (!container) return;
  container.innerHTML = students.length ? students.map(function (student) { return '<div class="student-list-item"><div class="student-avatar">' + escapeHtml(initials(student.name)) + '</div><div class="student-info"><div class="student-name">' + escapeHtml(student.name) + '</div><div class="student-meta">' + escapeHtml(student.student_code || 'Student ID unavailable') + ' · ' + escapeHtml(student.branch || 'Branch not set') + '</div></div></div>'; }).join('') : '<p class="empty-state">No students registered yet.</p>';
}

function renderCoordinatorRecentSubmissions(submissions) {
  var container = document.getElementById('coordinator-recent-submissions');
  if (!container) return;
  container.innerHTML = submissions.length ? submissions.map(function (submission) { return '<div class="student-list-item"><div class="student-avatar">' + escapeHtml(initials(submission.student_name)) + '</div><div class="student-info"><div class="student-name">' + escapeHtml(submission.title) + '</div><div class="student-meta">' + escapeHtml(submission.student_name) + ' · ' + new Date(submission.submitted_at).toLocaleDateString() + '</div></div><span class="student-status status-pending">' + escapeHtml(submission.status) + '</span></div>'; }).join('') : '<p class="empty-state">No submissions yet.</p>';
}

function renderCoordinatorUpcomingEvents(events) {
  var container = document.getElementById('coordinator-upcoming-events');
  if (!container) return;
  container.innerHTML = events.length ? events.map(function (event) { var date = new Date(event.event_date + 'T00:00:00'); return '<div class="student-list-item"><div class="event-date-box"><span class="day">' + date.getDate() + '</span><span class="month">' + date.toLocaleString(undefined, { month: 'short' }) + '</span></div><div class="student-info"><div class="student-name">' + escapeHtml(event.title) + '</div><div class="student-meta">' + escapeHtml(event.location || 'Location not set') + '</div></div></div>'; }).join('') : '<p class="empty-state">No upcoming events.</p>';
}

function renderCoordinatorProfileStats(stats) {
  var name = document.querySelector('#app-coordinator .coordinator-profile-name');
  var email = document.querySelector('#app-coordinator .coordinator-profile-email');
  var avatar = document.querySelector('#app-coordinator .coordinator-profile-avatar');
  if (name) name.textContent = window.currentUser.name || 'Coordinator';
  if (email) email.textContent = window.currentUser.email || '';
  if (avatar) avatar.textContent = initials(window.currentUser.name || 'Coordinator');
  var sidebarName = document.querySelector('#app-coordinator .coordinator-sidebar-name');
  var sidebarAvatar = document.querySelector('#app-coordinator .coordinator-sidebar-avatar');
  if (sidebarName) sidebarName.textContent = window.currentUser.name || 'Coordinator';
  if (sidebarAvatar) sidebarAvatar.textContent = initials(window.currentUser.name || 'Coordinator');
  var container = document.querySelector('#app-coordinator .coordinator-profile-stats');
  if (container) container.innerHTML = [['Students', stats.students], ['Mentors', stats.mentors], ['Challenges', stats.tasks], ['Submissions', stats.submissions], ['Events', stats.events], ['News', stats.news]].map(function (item) { return '<div><div style="font-size:24px;font-weight:700;color:var(--primary);">' + Number(item[1] || 0) + '</div><div style="font-size:12px;color:var(--text-secondary);">' + item[0] + '</div></div>'; }).join('');
}

function renderCoordinatorStudents(students) {
  var tbody = document.getElementById('coordinator-students');
  var recent = document.getElementById('coordinator-recent-students');
  var rows = students.map(function (student) {
    var mentor = student.mentor_name ? escapeHtml(student.mentor_name) + ' (' + escapeHtml(student.mentor_code || '') + ')' : 'Unassigned';
    return '<tr><td>' + escapeHtml(student.name) + '</td><td>' + escapeHtml(student.student_code || '—') + '</td><td>' + escapeHtml(student.email) + '</td><td>' + escapeHtml(student.roll_number || '—') + '</td><td>' + escapeHtml(student.branch || '—') + '</td><td>' + escapeHtml(student.year || '—') + '</td><td>' + mentor + '</td></tr>';
  }).join('');
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="7" class="empty-state">No students registered yet.</td></tr>';
  if (recent) recent.innerHTML = students.length ? students.slice(0, 6).map(function (student) { return '<div class="student-list-item"><div class="student-avatar">' + escapeHtml(initials(student.name)) + '</div><div class="student-info"><div class="student-name">' + escapeHtml(student.name) + '</div><div class="student-meta">' + escapeHtml(student.student_code || 'Student ID unavailable') + ' · ' + escapeHtml(student.branch || 'Branch not set') + (student.year ? ' · Year ' + escapeHtml(student.year) : '') + '</div></div><span class="student-status ' + (student.mentor_id ? 'status-active' : 'status-pending') + '">' + (student.mentor_id ? 'Assigned' : 'New') + '</span></div>'; }).join('') : '<p class="empty-state">No students registered yet.</p>';
}

function renderCoordinatorSubmissions(submissions) {
  var tbody = document.getElementById('coordinator-submissions');
  var rows = submissions.map(function (submission) {
    var statusClass = submission.status === 'accepted' ? 'status-active' : submission.status === 'rejected' ? 'status-inactive' : 'status-pending';
    var canReview = ['submitted', 'late'].includes(submission.status);
    return '<tr><td>' + escapeHtml(submission.student_name) + '</td><td>' + escapeHtml(submission.title) + '</td><td>' + new Date(submission.submitted_at).toLocaleDateString() + '</td><td><span class="student-status ' + statusClass + '">' + escapeHtml(submission.status) + '</span></td><td>' + (submission.score === null ? '—' : Number(submission.score)) + '</td><td>' + (canReview ? '<button class="btn btn-sm btn-primary" data-review-submission="' + escapeHtml(submission.id) + '">Review</button>' : '—') + '</td></tr>';
  }).join('');
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" class="empty-state">No submissions yet.</td></tr>';
  if (tbody) tbody.querySelectorAll('[data-review-submission]').forEach(function (button) { button.addEventListener('click', function () { var submission = submissions.find(function (item) { return String(item.id) === String(button.dataset.reviewSubmission); }); if (submission) openSubmissionReview(submission); }); });
}

function renderCoordinatorChallenges(challenges) {
  var tbody = document.getElementById('coordinator-challenges');
  var count = document.getElementById('coordinator-challenge-count');
  challenges = challenges.filter(function (challenge) { return challenge.status !== 'archived'; });
  if (count) count.textContent = challenges.length;
  if (!tbody) return;
  tbody.innerHTML = challenges.length ? challenges.map(function (challenge) {
    var closed = challenge.status === 'archived' || (challenge.deadline && new Date(challenge.deadline) < new Date());
    return '<tr><td>' + escapeHtml(challenge.title) + '</td><td>' + escapeHtml(challenge.difficulty) + '</td><td>' + Number(challenge.max_score || 0) + '</td><td>' + (challenge.deadline ? new Date(challenge.deadline).toLocaleDateString() : '—') + '</td><td>' + Number(challenge.submission_count || 0) + '</td><td><span class="student-status ' + (closed ? 'status-inactive' : 'status-active') + '">' + (closed ? 'Closed' : 'Active') + '</span></td><td>' + (!closed ? '<button class="btn btn-sm btn-ghost" data-close-challenge="' + escapeHtml(challenge.id) + '">Close</button>' : '—') + '</td></tr>';
  }).join('') : '<tr><td colspan="7" class="empty-state">No challenges created yet.</td></tr>';
  tbody.querySelectorAll('[data-close-challenge]').forEach(function (button) { button.addEventListener('click', function () { apiMutation('/api/coordinators/tasks/' + encodeURIComponent(button.dataset.closeChallenge), 'PUT', { status: 'archived' }).then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to close challenge', 'error'); showToast('Challenge closed', 'success'); loadCoordinatorDashboard(); }); }); });
}

function renderCoordinatorEvents(events) {
  var tbody = document.getElementById('coordinator-events');
  var upcoming = document.getElementById('coordinator-upcoming-events');
  var now = new Date();
  var visible = events.filter(function (event) { return event.status === 'published' && new Date(event.event_date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()); });
  var rows = visible.map(function (event) { return '<tr><td>' + escapeHtml(event.title) + '</td><td>' + escapeHtml(event.category || 'Event') + '</td><td>' + new Date(event.event_date + 'T00:00:00').toLocaleDateString() + '</td><td>' + escapeHtml(event.location || '—') + '</td><td><span class="student-status status-active">Upcoming</span></td><td><button class="btn btn-sm btn-ghost" data-delete-event="' + escapeHtml(event.id) + '">Delete</button></td></tr>'; }).join('');
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" class="empty-state">No upcoming events.</td></tr>';
  if (upcoming) upcoming.innerHTML = visible.length ? visible.slice(0, 5).map(function (event) { return '<div class="student-list-item"><div class="event-date-box"><span class="day">' + new Date(event.event_date + 'T00:00:00').getDate() + '</span><span class="month">' + new Date(event.event_date + 'T00:00:00').toLocaleString(undefined, { month: 'short' }) + '</span></div><div class="student-info"><div class="student-name">' + escapeHtml(event.title) + '</div><div class="student-meta">' + escapeHtml(event.location || 'Location not set') + (event.start_time ? ' · ' + escapeHtml(String(event.start_time).slice(0, 5)) : '') + '</div></div></div>'; }).join('') : '<p class="empty-state">No upcoming events.</p>';
  if (tbody)   tbody.querySelectorAll('[data-delete-event]').forEach(function (button) { button.addEventListener('click', function () { apiMutation('/api/coordinators/events/' + encodeURIComponent(button.dataset.deleteEvent), 'DELETE').then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to delete event', 'error'); showToast('Event deleted', 'success'); loadCoordinatorDashboard(); }); }); });
}

function renderCoordinatorResources(resources) {
  var container = document.getElementById('coordinator-resources');
  if (!container) return;
  container.innerHTML = resources.length ? resources.map(function (resource) { return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(resource.title) + '</h4><p>' + escapeHtml(resource.description || resource.category || resource.resource_type) + '</p><a class="btn btn-primary btn-sm" href="' + escapeHtml(resource.resource_url) + '" target="_blank" rel="noopener">Open Resource</a> <button class="btn btn-ghost btn-sm" data-delete-resource="' + escapeHtml(resource.id) + '">Archive</button></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No learning resources yet.</p></div></div>';
  container.querySelectorAll('[data-delete-resource]').forEach(function (button) { button.addEventListener('click', function () { apiMutation('/api/coordinators/resources/' + encodeURIComponent(button.dataset.deleteResource), 'DELETE').then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to delete resource', 'error'); showToast('Resource archived', 'success'); loadCoordinatorDashboard(); }); }); });
}

function renderCoordinatorLeaderboard(leaderboard) {
  var tbody = document.getElementById('coordinator-leaderboard');
  if (!tbody) return;
  tbody.innerHTML = leaderboard.length ? leaderboard.map(function (entry, index) { return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(entry.student_name) + '</td><td>' + escapeHtml(entry.mentor_name || 'Unassigned') + '</td><td>' + Number(entry.challenges_completed || 0) + '</td><td>' + Number(entry.points || 0) + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="empty-state">No leaderboard data available yet.</td></tr>';
}

function openSubmissionReview(submission) {
  showModal('Review Submission', '<p><strong>' + escapeHtml(submission.student_name) + '</strong> · ' + escapeHtml(submission.title) + '</p><p>' + escapeHtml(submission.submission_text || 'No text submission') + '</p>' + (submission.submission_url ? '<p><a href="' + escapeHtml(submission.submission_url) + '" target="_blank" rel="noopener">Open submission link</a></p>' : '') + '<label>Score<input class="form-input" type="number" min="0" max="' + Number(submission.max_score || 9999) + '" id="submission-review-score" value="' + (submission.score === null ? '' : Number(submission.score)) + '"></label><label>Feedback<textarea class="form-input" id="submission-review-feedback" rows="3">' + escapeHtml(submission.feedback || '') + '</textarea></label><label>Status<select class="form-input" id="submission-review-status"><option value="reviewed">Reviewed</option><option value="accepted">Accepted</option><option value="rejected">Rejected</option></select></label>', [
    { text: 'Save Review', class: 'btn-primary', action: function () {
      var score = document.getElementById('submission-review-score').value;
      if (score !== '' && Number(score) > Number(submission.max_score || 9999)) return showToast('Score exceeds the challenge points', 'error');
      return apiMutation('/api/submissions/' + encodeURIComponent(submission.id), 'PUT', { score: score, feedback: document.getElementById('submission-review-feedback').value, status: document.getElementById('submission-review-status').value }).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to save review', 'error'); return false; } showToast('Submission reviewed', 'success'); loadCoordinatorDashboard(); return true; });
    } }
  ]);
}

function renderCoordinatorMentors(mentors) {
  var tbody = document.getElementById('coordinator-mentors');
  if (!tbody) return;
  tbody.innerHTML = mentors.length ? mentors.map(function (mentor) { return '<tr><td>' + escapeHtml(mentor.name) + '</td><td>' + escapeHtml(mentor.mentor_code || '—') + '</td><td>' + escapeHtml(mentor.email) + '</td><td>' + escapeHtml(mentor.department || '—') + '</td><td>' + escapeHtml(mentor.designation || '—') + '</td><td>' + escapeHtml([mentor.group_name, mentor.group_id].filter(Boolean).join(' · ') || '—') + '</td><td>' + Number(mentor.assigned_students || 0) + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="empty-state">No mentors registered yet.</td></tr>';
}

function renderCoordinatorAssignments(assignments) {
  var tbody = document.getElementById('coordinator-assignments');
  if (!tbody) return;
  tbody.innerHTML = assignments.length ? assignments.map(function (assignment) { return '<tr><td>' + escapeHtml(assignment.student_name) + '</td><td>' + escapeHtml(assignment.student_code || '—') + '</td><td>' + escapeHtml(assignment.mentor_name) + '</td><td>' + escapeHtml(assignment.mentor_code || '—') + '</td><td>' + new Date(assignment.assigned_at).toLocaleDateString() + '</td><td><button class="btn btn-sm btn-ghost" data-unassign-id="' + escapeHtml(assignment.assignment_id) + '">Remove</button></td></tr>'; }).join('') : '<tr><td colspan="6" class="empty-state">No mentees assigned yet.</td></tr>';
  tbody.querySelectorAll('[data-unassign-id]').forEach(function (button) { button.addEventListener('click', function () { apiMutation('/api/coordinators/assign/' + encodeURIComponent(button.dataset.unassignId), 'DELETE').then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to remove assignment', 'error'); showToast('Assignment removed', 'success'); loadCoordinatorDashboard(); }); }); });
}

function refreshCoordinatorAssignmentOptions(mentors, students) {
  var form = document.getElementById('mentor-assignment-form');
  if (!form) return;
  var mentorSelect = document.getElementById('assignment-mentor');
  var studentSelect = document.getElementById('assignment-student');
  var selectedMentor = mentorSelect.value;
  var selectedStudent = studentSelect.value;
  mentorSelect.innerHTML = '<option value="">Select a mentor</option>' + mentors.map(function (mentor) { return '<option value="' + escapeHtml(mentor.mentor_id) + '">' + escapeHtml(mentor.name) + ' (' + escapeHtml(mentor.mentor_code || 'No ID') + ') · ' + Number(mentor.assigned_students || 0) + '/4</option>'; }).join('');
  var availableStudents = students.filter(function (student) { return !student.mentor_id; });
  studentSelect.innerHTML = '<option value="">Select a student</option>' + availableStudents.map(function (student) { return '<option value="' + escapeHtml(student.student_id) + '">' + escapeHtml(student.name) + ' (' + escapeHtml(student.student_code || 'No ID') + ')</option>'; }).join('');
  if (mentors.some(function (mentor) { return String(mentor.mentor_id) === selectedMentor; })) mentorSelect.value = selectedMentor;
  if (availableStudents.some(function (student) { return String(student.student_id) === selectedStudent; })) studentSelect.value = selectedStudent;
  studentSelect.disabled = availableStudents.length === 0;
  mentorSelect.disabled = mentors.length === 0;
  var submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) submitButton.disabled = availableStudents.length === 0 || mentors.length === 0;
}

function initCoordinatorAssignmentForm() {
  var form = document.getElementById('mentor-assignment-form');
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = 'true';
  Promise.all([apiRequest('/api/coordinators/mentors'), apiRequest('/api/coordinators/students')]).then(function (results) {
    if (!results[0] || !results[1]) return;
    refreshCoordinatorAssignmentOptions(results[0].mentors || [], results[1].students || []);
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      apiMutation('/api/coordinators/assign', 'POST', { mentor_id: document.getElementById('assignment-mentor').value, student_id: document.getElementById('assignment-student').value }).then(function (result) {
        if (!result || !result.success) return showToast(result && result.message || 'Unable to assign student', 'error');
        showToast('Mentee assigned', 'success');
        form.reset();
        loadCoordinatorDashboard();
      });
    });
  }).catch(function (error) { console.error('Coordinator assignment form failed', error); });
}

function showNewsForm() {
  showModal('Post News', '<form id="coordinator-news-form" style="display:grid;gap:12px;"><label>Title<input class="form-input" name="title" required maxlength="255"></label><label>Category<input class="form-input" name="category" maxlength="100"></label><label>Content<textarea class="form-input" name="content" rows="5" required></textarea></label><label>Status<select class="form-input" name="status"><option value="published">Publish now</option><option value="draft">Save as draft</option></select></label></form>', [
    { text: 'Save News', class: 'btn-primary', action: function () {
      var form = document.getElementById('coordinator-news-form');
      if (!form.reportValidity()) return;
      var values = Object.fromEntries(new FormData(form).entries());
      return apiMutation('/api/coordinators/news', 'POST', values).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to save news', 'error'); return false; } showToast('News saved', 'success'); loadCoordinatorDashboard(); return true; });
    } }
  ]);
}

function renderCoordinatorNews(news) {
  var body = document.querySelector('#coord-news .dashboard-table tbody');
  var latest = document.getElementById('coordinator-latest-news');
  var activeNews = (news || []).filter(function (item) { return item.status !== 'archived'; });
  if (body) body.innerHTML = activeNews.map(function (item) {
    var nextStatus = item.status === 'published' ? 'draft' : 'published';
    var actionLabel = item.status === 'published' ? 'Unpublish' : 'Publish';
    return '<tr data-news-id="' + escapeHtml(item.id) + '"><td>' + escapeHtml(item.title) + '</td><td>' + escapeHtml(item.category || 'General') + '</td><td><span class="student-status ' + (item.status === 'published' ? 'status-active' : 'status-pending') + '">' + escapeHtml(item.status) + '</span></td><td>' + new Date(item.created_at).toLocaleDateString() + '</td><td><div style="display:flex;gap:4px"><button class="btn btn-sm btn-ghost" data-news-action="edit">Edit</button><button class="btn btn-sm btn-ghost" data-news-action="toggle" data-next-status="' + nextStatus + '">' + actionLabel + '</button><button class="btn btn-sm btn-ghost" data-news-action="delete">Delete</button></div></td></tr>';
  }).join('') || '<tr><td colspan="5" class="empty-state">No announcements yet.</td></tr>';
  if (latest) {
    var published = activeNews.filter(function (item) { return item.status === 'published'; });
    latest.innerHTML = published.length ? published.slice(0, 5).map(function (item) { return '<div class="student-list-item"><div class="student-avatar"><i class="fas fa-newspaper"></i></div><div class="student-info"><div class="student-name">' + escapeHtml(item.title) + '</div><div class="student-meta">' + new Date(item.created_at).toLocaleDateString() + '</div></div></div>'; }).join('') : '<p class="empty-state">No announcements yet.</p>';
  }
  var counts = { published: 0, draft: 0, archived: 0 };
  (news || []).forEach(function (item) { if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status]++; });
  document.querySelectorAll('[data-news-count]').forEach(function (item) { item.textContent = counts[item.dataset.newsCount] || 0; });
}

function showChallengeForm() {
  showModal('Create Challenge', '<form id="coordinator-challenge-form" style="display:grid;gap:12px;"><label>Challenge Title<input class="form-input" name="title" required maxlength="200"></label><label>Description<textarea class="form-input" name="description" rows="4"></textarea></label><label>Difficulty<select class="form-input" name="difficulty" required><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></label><label>Points<input class="form-input" name="max_score" type="number" min="0" max="9999" value="100" required></label><label>Deadline<input class="form-input" name="deadline" type="datetime-local"></label><label>Instructions<textarea class="form-input" name="instructions" rows="3"></textarea></label><label>Resource URL<input class="form-input" name="resources" type="url" placeholder="https://"></label><label>Status<select class="form-input" name="status"><option value="published">Publish and assign</option><option value="draft">Save as draft</option></select></label></form>', [
    { text: 'Create Challenge', class: 'btn-primary', action: function () {
      var form = document.getElementById('coordinator-challenge-form');
      if (!form.reportValidity()) return;
      var values = Object.fromEntries(new FormData(form).entries());
      values.deadline = values.deadline ? new Date(values.deadline).toISOString().slice(0, 19).replace('T', ' ') : null;
      return apiMutation('/api/coordinators/tasks', 'POST', values).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to create challenge', 'error'); return false; } showToast('Challenge created', 'success'); loadCoordinatorDashboard(); return true; });
    } }
  ]);
}

function showEventForm() {
  showModal('Create Event', '<form id="coordinator-event-form" style="display:grid;gap:12px;"><label>Event Title<input class="form-input" name="title" required maxlength="255"></label><label>Description<textarea class="form-input" name="description" rows="3"></textarea></label><label>Date<input class="form-input" name="event_date" type="date" required></label><label>Start Time<input class="form-input" name="start_time" type="time"></label><label>End Time<input class="form-input" name="end_time" type="time"></label><label>Location<input class="form-input" name="location" maxlength="255"></label><label>Status<select class="form-input" name="status"><option value="published">Publish</option><option value="draft">Save as draft</option></select></label></form>', [
    { text: 'Create Event', class: 'btn-primary', action: function () {
      var form = document.getElementById('coordinator-event-form');
      if (!form.reportValidity()) return;
      return apiMutation('/api/coordinators/events', 'POST', Object.fromEntries(new FormData(form).entries())).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to create event', 'error'); return false; } showToast('Event created', 'success'); loadCoordinatorDashboard(); return true; });
    } }
  ]);
}

function showResourceForm() {
  showModal('Add Learning Resource', '<form id="coordinator-resource-form" style="display:grid;gap:12px;"><label>Title<input class="form-input" name="title" required maxlength="255"></label><label>Description<textarea class="form-input" name="description" rows="3"></textarea></label><label>Type<select class="form-input" name="resource_type" required><option value="link">Link</option><option value="document">Document</option><option value="video">Video</option><option value="tutorial">Tutorial</option><option value="pdf">PDF</option><option value="github">GitHub</option></select></label><label>URL<input class="form-input" name="resource_url" type="url" required></label><label>Category<input class="form-input" name="category" maxlength="100"></label></form>', [
    { text: 'Save Resource', class: 'btn-primary', action: function () {
      var form = document.getElementById('coordinator-resource-form');
      if (!form.reportValidity()) return;
      return apiMutation('/api/coordinators/resources', 'POST', Object.fromEntries(new FormData(form).entries())).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to save resource', 'error'); return false; } showToast('Resource added', 'success'); loadCoordinatorDashboard(); return true; });
    } }
  ]);
}

function initCoordinatorQuickActions() {
  var dashboard = document.getElementById('coord-dashboard');
  if (dashboard && !dashboard.dataset.quickActionsInitialized) {
    dashboard.dataset.quickActionsInitialized = 'true';
    dashboard.addEventListener('click', function (event) {
      var button = event.target.closest('[data-quick-action]');
      if (!button) return;
      var action = button.dataset.quickAction;
      if (action === 'student' || action === 'mentor') window.location.href = '../pages/auth.html?view=' + action + '-signup';
      else if (action === 'challenge') showChallengeForm();
      else if (action === 'event') showEventForm();
      else if (action === 'news') showNewsForm();
      else if (action === 'allocation') navigateTo('coord-allocations');
    });
  }
  var challenges = document.getElementById('coord-challenges');
  if (challenges && !challenges.dataset.createInitialized) {
    challenges.dataset.createInitialized = 'true';
    challenges.addEventListener('click', function (event) { if (event.target.closest('[data-create-challenge]')) showChallengeForm(); });
  }
  var events = document.getElementById('coord-events');
  if (events && !events.dataset.createInitialized) {
    events.dataset.createInitialized = 'true';
    events.addEventListener('click', function (event) { if (event.target.closest('[data-create-event]')) showEventForm(); });
  }
  var resources = document.getElementById('coord-resources');
  if (resources && !resources.dataset.createInitialized) {
    resources.dataset.createInitialized = 'true';
    resources.addEventListener('click', function (event) { if (event.target.closest('[data-create-resource]')) showResourceForm(); });
  }
}

function initCoordinatorNewsActions() {
  var container = document.getElementById('coord-news');
  if (!container || container.dataset.actionsInitialized) return;
  container.dataset.actionsInitialized = 'true';
  container.addEventListener('click', function (event) {
    var button = event.target.closest('[data-news-action], [data-create-news]');
    if (!button) return;
    if (button.hasAttribute('data-create-news')) {
      showNewsForm();
      return;
    }
    var row = button.closest('tr');
    if (!row) return;
    var id = row.getAttribute('data-news-id');
    var action = button.getAttribute('data-news-action');
    if (action === 'delete') {
      if (!window.confirm('Delete this news item?')) return;
      apiMutation('/api/coordinators/news/' + encodeURIComponent(id), 'DELETE').then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to delete news', 'error'); showToast('News deleted', 'success'); loadCoordinatorDashboard(); });
    } else if (action === 'toggle' || action === 'edit') {
      var title = row.cells[0].textContent;
      var currentStatus = row.cells[2].textContent.trim();
      if (action === 'edit') {
        var updatedTitle = window.prompt('News title', title);
        if (updatedTitle === null) return;
        var content = window.prompt('News content');
        if (content === null || !content.trim()) return;
        title = updatedTitle;
        apiMutation('/api/coordinators/news/' + encodeURIComponent(id), 'PUT', { title: title, content: content, category: row.cells[1].textContent, status: currentStatus }).then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to update news', 'error'); showToast('News updated', 'success'); loadCoordinatorDashboard(); });
        return;
      }
      apiMutation('/api/coordinators/news/' + encodeURIComponent(id), 'PUT', { status: button.dataset.nextStatus }).then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to update news', 'error'); showToast('News status updated', 'success'); loadCoordinatorDashboard(); });
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  initSidebarNav();
  initSidebarToggle();
  initSearch();
  initFilterChips();
  animateProgressBars();
  renderBarCharts();
  initToastTriggers();
    initCoordinatorNewsActions();
  initCoordinatorQuickActions();
    initCoordinatorReviewActions();
    initStudentSubmissionForm();

  var greetingEls = document.querySelectorAll('[data-greeting]');
  var greeting = getGreeting();
  greetingEls.forEach(function(el) {
    el.textContent = greeting + ', ' + el.getAttribute('data-greeting');
  });

  var token = sessionStorage.getItem('pec_jwt');
  var hash = window.location.hash.slice(1);
  var role = null;
  if (token) {
    try {
      role = JSON.parse(atob(token.split('.')[1])).role;
    } catch (e) {
      sessionStorage.removeItem('pec_jwt');
    }
  }

  if (role) {
    switchRole(role);
    var rolePrefix = role === 'coordinator' ? 'coord-' : role + '-';
    var lastPortalPage = sessionStorage.getItem('pec-dashboard-last-page');
    if ((!hash || !hash.startsWith(rolePrefix)) && lastPortalPage && lastPortalPage.startsWith(rolePrefix)) hash = lastPortalPage;
    if (hash) navigateTo(hash);
    setTimeout(function() {
      var activeApp = document.querySelector('[id^="app-"][style*="flex"], [id^="app-"].active');
      if (activeApp) {
        var activePage = activeApp.querySelector('.sub-page.active');
        if (activePage) animateDashSections(activePage);
      }
    }, 200);
  }
});
