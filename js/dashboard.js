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
  if (window.currentUser && window.currentUser.user_id === tokenUser.user_id && window.currentUser.role === tokenUser.role) {
    if (role === 'coordinator') loadCoordinatorDashboard();
    else if (role === 'student') loadStudentDashboard();
    else if (role === 'mentor') loadMentorDashboard();
    return;
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

  document.querySelectorAll('.dashboard-topbar-brand, .dashboard-topbar-context').forEach(function (element, index) {
    element.style.setProperty('--brand-entry-order', index);
    element.classList.add('dashboard-brand-entry');
  });

  initCoordinatorAssignmentForm();
  initCoordinatorNewsActions();
  initCoordinatorQuickActions();
  initCoordinatorReviewActions();
  initStudentSubmissionForm();

  if (role === 'student') loadStudentDashboard();
  else if (role === 'mentor') loadMentorDashboard();
  else if (role === 'coordinator') loadCoordinatorDashboard();
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
  var mentorProfile = activeApp.querySelector('#mentor-profile');
  if (pageId === 'mentor-profile' && mentorProfile) loadMentorDashboard();
  if (pageId === 'student-profile') loadStudentDashboard();

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
  var icon = document.createElement('i');
  icon.className = 'fas ' + (icons[type] || icons.info);
  var text = document.createElement('span');
  text.textContent = String(message);
  toast.appendChild(icon);
  toast.appendChild(text);

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
    var values;
    var labels;
    try {
      values = JSON.parse(chart.getAttribute('data-values'));
      labels = JSON.parse(chart.getAttribute('data-labels') || '[]');
    } catch (error) {
      chart.innerHTML = '<p class="empty-state">Unable to load chart data.</p>';
      return;
    }
    if (!Array.isArray(values) || !values.length || !values.some(function (value) { return Number(value) > 0; })) {
      chart.innerHTML = '<p class="empty-state">No activity data yet.</p>';
      return;
    }
    var maxVal = Math.max.apply(null, values.map(Number));
    chart.innerHTML = '';
    values.forEach(function(val, i) {
      var item = document.createElement('div');
      item.className = 'chart-bar-item';
      var height = (Number(val) / maxVal * 100);
      var bar = document.createElement('div');
      bar.className = 'bar';
      bar.style.height = height + '%';
      item.appendChild(bar);
      if (labels[i]) {
        var label = document.createElement('div');
        label.className = 'label';
        label.textContent = labels[i];
        item.appendChild(label);
      }
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
    btn.addEventListener('click', function() { showToast(this.getAttribute('data-toast'), 'success'); });
  });
  document.querySelectorAll('[data-confirm]').forEach(function(btn) {
    btn.addEventListener('click', function() { confirmAction(this.getAttribute('data-confirm'), function() {}); });
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
    return response.json().catch(function () { return {}; }).then(function (data) {
      if (!response.ok) {
        var error = new Error(data.message || 'Request failed (' + response.status + ')');
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    });
  }).catch(function (error) {
    if (error.status === 401 || error.status === 403 && /token/i.test(error.message)) {
      sessionStorage.removeItem('pec_jwt');
      window.location.replace('../pages/auth.html');
    }
    throw error;
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
    return heading.textContent.trim().toLowerCase() === 'latest news';
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
      var greetingLabel = document.createElement('span');
      greetingLabel.textContent = greeting + ', ';
      var nameLabel = document.createElement('span');
      nameLabel.className = 'user-name';
      nameLabel.textContent = name;
      heading.replaceChildren(greetingLabel, nameLabel);
    } else {
      heading.textContent = 'Welcome, ' + name;
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

function renderStudentProgress(data) {
  var total = Number(data.progress.total_tasks || 0);
  var completed = Number(data.progress.completed_tasks || 0);
  var percent = total ? Math.round(completed / total * 100) : 0;
  var overall = document.querySelector('#app-student .student-overall-progress');
  if (overall) overall.innerHTML = '<div class="progress-bar-container"><div class="progress-header"><span class="progress-label">Overall Completion</span><span class="progress-value">' + percent + '%</span></div><div class="progress-bar"><div class="progress-fill blue" style="width:' + percent + '%"></div></div></div>';
  var skills = document.querySelector('#app-student .student-skill-progress');
  if (skills) skills.innerHTML = data.skills && data.skills.length ? data.skills.map(function (skill) { var value = Math.max(0, Math.min(100, Number(skill.progress || 0))); return '<div class="progress-bar-container"><div class="progress-header"><span class="progress-label">' + escapeHtml(skill.name || skill.skill_name || 'Skill') + '</span><span class="progress-value">' + value + '%</span></div><div class="progress-bar"><div class="progress-fill blue" style="width:' + value + '%"></div></div></div>'; }).join('') : '<p class="empty-state">No skill progress recorded yet.</p>';
  var bio = document.querySelector('#app-student .student-profile-bio');
  if (bio) bio.textContent = data.profile.bio || 'No profile bio provided.';
  var profileSkills = document.querySelector('#app-student .student-profile-skills');
  if (profileSkills) profileSkills.innerHTML = data.skills && data.skills.length ? data.skills.map(function (skill) { return '<span class="chip">' + escapeHtml(skill.name || skill.skill_name) + '</span>'; }).join('') : '<p class="empty-state">No skills added yet.</p>';
  var weekly = document.querySelector('#app-student .student-weekly-activity');
  if (weekly) {
    var activityDays = [];
    for (var dayIndex = 6; dayIndex >= 0; dayIndex--) {
      var day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - dayIndex);
      var matching = (data.activity || []).find(function (item) { return new Date(item.activity_date).toDateString() === day.toDateString(); });
      activityDays.push({ label: day.toLocaleDateString(undefined, { weekday: 'short' }), count: Number(matching && matching.submissions || 0) });
    }
    var maxActivity = Math.max.apply(null, activityDays.map(function (item) { return item.count; }));
    weekly.innerHTML = maxActivity ? '<div class="chart-bar">' + activityDays.map(function (item) { return '<div class="chart-bar-item"><div class="bar" style="height:' + Math.max(5, item.count / maxActivity * 100) + '%"></div><div class="label">' + item.label + '</div></div>'; }).join('') + '</div>' : '<p class="empty-state">No accepted challenge activity in the last seven days.</p>';
  }
}

function renderStudentSubmissions(submissions) {
  var tbody = document.getElementById('student-submissions-list');
  if (tbody) tbody.innerHTML = submissions.length ? submissions.map(function (submission) { return '<tr><td>' + escapeHtml(submission.title) + '</td><td>' + escapeHtml(submission.status) + '</td><td>' + new Date(submission.submitted_at).toLocaleDateString() + '</td><td>' + (submission.score === null ? '—' : Number(submission.score)) + '</td><td>' + escapeHtml(submission.feedback || '—') + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="empty-state">No submissions yet.</td></tr>';
}

function initStudentSettingsForm() {
  var form = document.getElementById('student-profile-settings-form');
  if (!form || form.dataset.initialized) return;
  form.dataset.initialized = 'true';
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var user = window.currentUser || JSON.parse(sessionStorage.getItem('pec_user') || '{}');
    var formData = new FormData(form);
    var payload = Object.fromEntries(formData.entries());
    var button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    apiMutation('/api/students/profile/' + encodeURIComponent(user.user_id), 'PUT', payload).then(function (result) {
      if (!result || !result.success) return showToast(result && result.message || 'Unable to save profile', 'error');
      showToast('Profile updated', 'success');
      loadStudentDashboard();
    }).finally(function () { if (button) button.disabled = false; });
  });
}

function markNotificationRead(id) {
  apiMutation('/api/notifications/' + encodeURIComponent(id) + '/read', 'PUT', {}).then(function (result) {
    if (!result || !result.success) return showToast(result && result.message || 'Unable to update notification', 'error');
    loadStudentDashboard();
  });
}

function markNewsRead(id) {
  apiMutation('/api/news/' + encodeURIComponent(id) + '/read', 'PUT', {}).then(function (result) {
    if (!result || !result.success) return;
    loadStudentDashboard();
  });
}

function renderStudentCourses(courses) {
  var container = document.querySelector('#app-student .student-learning-resources');
  if (!container) return;
  container.innerHTML = courses.length ? courses.map(function (course) { return '<div class="dashboard-section"><div class="dashboard-section-body"><span class="chip">' + escapeHtml(course.category || course.resource_type || 'Resource') + '</span><h4>' + escapeHtml(course.title) + '</h4><p>' + escapeHtml(course.description || 'No description provided.') + '</p><a class="btn btn-primary" href="' + escapeHtml(course.resource_url) + '" target="_blank" rel="noopener noreferrer">Open Resource</a></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No learning resources available yet.</p></div></div>';
}

function renderStudentLeaderboard(entries) {
  var tbody = document.getElementById('student-leaderboard-rows');
  if (!tbody) return;
  tbody.innerHTML = entries.length ? entries.map(function (entry, index) { return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(entry.name) + '</td><td>' + Number(entry.completed_challenges || 0) + '</td><td>' + Number(entry.points || 0) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="empty-state">No leaderboard data available yet.</td></tr>';
}

function renderStudentCollections(data) {
  var resources = document.getElementById('student-resources-list');
  if (resources) resources.innerHTML = data.resources && data.resources.length ? data.resources.map(function (resource) { return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(resource.title) + '</h4><p>' + escapeHtml(resource.description || resource.category || resource.resource_type) + '</p><a class="btn btn-primary btn-sm" href="' + escapeHtml(resource.resource_url) + '" target="_blank" rel="noopener noreferrer">Open Resource</a></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No learning resources available yet.</p></div></div>';
  renderStudentCourses(data.courses || []);
  var attendance = document.getElementById('student-attendance-list');
  if (attendance) attendance.innerHTML = data.attendance && data.attendance.total ? '<div class="dashboard-section"><div class="dashboard-section-body"><div class="stat-value">' + Number(data.attendance.present) + ' / ' + Number(data.attendance.total) + '</div><p>Attendance sessions marked present</p></div></div>' : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No attendance records yet.</p></div></div>';
  var achievements = document.getElementById('student-achievements-list');
  if (achievements) achievements.innerHTML = (data.achievements || []).map(function (item) { return '<div class="dashboard-section"><div class="dashboard-section-body"><div class="stat-icon" style="color:#f59e0b"><i class="fas fa-medal"></i></div><h4>' + escapeHtml(item.title) + '</h4><p>' + escapeHtml(item.description || item.achievement_type || 'Achievement') + '</p>' + (item.certificate_url ? '<a class="btn btn-ghost btn-sm" href="' + escapeHtml(item.certificate_url) + '" target="_blank" rel="noopener noreferrer">View Certificate</a>' : '') + '</div></div>'; }).join('') || '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No achievements recorded yet.</p></div></div>';
  var notifications = document.querySelector('#app-student .student-notifications-list');
  if (notifications) notifications.innerHTML = data.notifications && data.notifications.length ? data.notifications.map(function (notification) { return '<div class="notification-item" data-notification-id="' + escapeHtml(notification.id) + '"><div class="notification-icon"><i class="fas fa-bell"></i></div><div class="notification-content"><div class="notification-title">' + escapeHtml(notification.title) + '</div><div class="notification-desc">' + escapeHtml(notification.message || '') + '</div><div class="notification-time">' + new Date(notification.created_at).toLocaleString() + '</div>' + (!notification.is_read ? '<button type="button" class="btn btn-sm btn-ghost" data-mark-notification="' + escapeHtml(notification.id) + '">Mark as read</button>' : '') + '</div></div>'; }).join('') : '<p class="empty-state">No notifications.</p>';
  var count = document.querySelector('#app-student [data-notification-count]');
  if (count) count.textContent = (data.notifications || []).filter(function (notification) { return !notification.is_read; }).length;
  renderStudentLeaderboard(data.leaderboard || []);
    var newsItems = data.news || [];
  var dashboardNews = document.querySelector('#app-student .student-dashboard-news');
  if (dashboardNews) dashboardNews.innerHTML = newsItems.filter(function (item) { return item.status === 'published'; }).slice(0, 5).map(function (item) { return '<div class="student-list-item"><div class="student-avatar"><i class="fas fa-newspaper"></i></div><div class="student-info"><div class="student-name">' + escapeHtml(item.title) + '</div><div class="student-meta">' + new Date(item.published_at || item.created_at).toLocaleDateString() + '</div></div></div>'; }).join('') || '<p class="empty-state">No announcements available.</p>';
  var news = document.querySelector('#app-student .student-news-list');
  if (news) news.innerHTML = newsItems.length ? newsItems.map(function (item) { return '<div class="dashboard-section searchable-item" data-news-id="' + escapeHtml(item.id) + '"><div class="dashboard-section-body"><span class="chip">' + escapeHtml(item.category || 'Announcement') + '</span><h4>' + escapeHtml(item.title) + '</h4><p>' + escapeHtml(item.content || '') + '</p><span class="student-meta">' + new Date(item.published_at || item.created_at).toLocaleDateString() + '</span></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No announcements available.</p></div></div>';
  if (news) news.querySelectorAll('[data-news-id]').forEach(function (card) {
    var item = newsItems.find(function (entry) { return String(entry.id) === card.dataset.newsId; });
    if (item && !item.is_read && !card.querySelector('[data-mark-news-read]')) {
      var read = document.createElement('button');
      read.type = 'button';
      read.className = 'btn btn-sm btn-ghost';
      read.dataset.markNewsRead = item.id;
      read.textContent = 'Mark as read';
      card.querySelector('.dashboard-section-body').appendChild(read);
    }
  });
  if (news && news.dataset.readBound !== 'true') {
    news.dataset.readBound = 'true';
    news.addEventListener('click', function (event) { var button = event.target.closest('[data-mark-news-read]'); if (button) markNewsRead(button.dataset.markNewsRead); });
  }
  var notificationList = document.querySelector('#app-student .student-notifications-list');
  if (notificationList && notificationList.dataset.readBound !== 'true') {
    notificationList.dataset.readBound = 'true';
    notificationList.addEventListener('click', function (event) { var button = event.target.closest('[data-mark-notification]'); if (button) markNotificationRead(button.dataset.markNotification); });
  }
  var eventList = document.querySelector('#app-student .student-events-list');
  var events = data.events || [];
  if (eventList) eventList.innerHTML = events.length ? events.map(function (event) { var date = new Date(event.event_date + 'T00:00:00'); return '<div class="dashboard-section"><div class="dashboard-section-body"><div style="display:flex;gap:16px;"><div class="event-date-box"><span class="day">' + date.getDate() + '</span><span class="month">' + date.toLocaleString(undefined, { month: 'short' }) + '</span></div><div><h4>' + escapeHtml(event.title) + '</h4><p class="student-meta">' + escapeHtml(event.location || 'Location not set') + (event.start_time ? ' · ' + escapeHtml(String(event.start_time).slice(0, 5)) : '') + '</p></div></div><p>' + escapeHtml(event.description || '') + '</p></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No upcoming events.</p></div></div>';
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
  initStudentSettingsForm();
  apiRequest('/api/dashboard/student').then(function (data) {
    if (!data || !data.success) return;
    renderRoleIdentity('#app-student', data.profile, 'Student');
    data.profile = data.profile || {};
    data.progress = data.progress || {};
    data.tasks = data.tasks || [];
    data.submissions = data.submissions || [];
    var stats = data.progress || {};
    renderStudentTasks(data.tasks || []);
    renderStudentSubmissions(data.submissions || []);
    renderStudentProgress(data);
    renderStudentCollections(data);
    var taskTotal = document.querySelector('#app-student .student-dashboard-total-tasks');
    var taskCompleted = document.querySelector('#app-student .student-dashboard-completed');
    var taskStreak = document.querySelector('#app-student .student-dashboard-streak');
    var taskRank = document.querySelector('#app-student .student-dashboard-rank');
    if (taskTotal) taskTotal.textContent = data.progress.total_tasks || 0;
    if (taskCompleted) taskCompleted.textContent = stats.completed_tasks || 0;
    if (taskStreak) taskStreak.textContent = stats.current_streak || 0;
    if (taskRank) taskRank.textContent = stats.rank ? '#' + stats.rank : '—';
    var studentHeader = document.querySelector('#app-student .dashboard-student-header h1');
    if (studentHeader) {
      var greeting = document.createElement('span');
      greeting.textContent = getGreeting() + ', ';
      var studentName = document.createElement('span');
      studentName.className = 'user-name';
      studentName.textContent = data.profile.name || 'Student';
      studentHeader.replaceChildren(greeting, studentName);
    }
    var profileName = data.profile.name || 'Student';
    document.querySelectorAll('#app-student .user-name').forEach(function (el) { el.textContent = profileName; });
    var studentSidebarName = document.querySelector('#app-student .student-dashboard-name');
    var studentSidebarAvatar = document.querySelector('#app-student .student-dashboard-avatar');
    if (studentSidebarName) studentSidebarName.textContent = profileName;
    if (studentSidebarAvatar) studentSidebarAvatar.textContent = initials(profileName);
    var profileHeader = document.querySelector('#app-student .student-profile-name');
    if (profileHeader) profileHeader.textContent = profileName;
    var profileAvatar = document.querySelector('#app-student .student-profile-avatar');
    if (profileAvatar) profileAvatar.textContent = initials(profileName);
    var profileMeta = document.querySelector('#app-student .student-profile-meta');
    if (profileMeta) profileMeta.textContent = [data.profile.branch, data.profile.year ? data.profile.year + ' Year' : ''].filter(Boolean).join(' · ') || 'Profile information not added yet';
    var profileContact = document.querySelector('#app-student .student-profile-contact');
    if (profileContact) profileContact.textContent = 'Student ID: ' + (data.profile.student_code || 'Unavailable') + ' · Enrollment: ' + (data.profile.roll_number || 'Unavailable') + ' · ' + (data.profile.email || 'Email unavailable');
    var settings = document.getElementById('student-profile-settings-form');
    if (settings) {
      ['name', 'email', 'enrollment_no', 'phone', 'branch', 'year', 'skills'].forEach(function (field) {
        if (settings.elements[field]) settings.elements[field].value = field === 'enrollment_no' ? (data.profile.roll_number || '') : (data.profile[field] || '');
      });
    }
    var profileStats = document.querySelector('#app-student .student-profile-challenges');
    var profileCompleted = document.querySelector('#app-student .student-profile-completed');
    var profileRank = document.querySelector('#app-student .student-profile-rank');
    var profilePoints = document.querySelector('#app-student .student-profile-points');
    if (profileStats) profileStats.textContent = data.progress.total_tasks || 0;
    if (profileCompleted) profileCompleted.textContent = data.progress.completed_tasks || 0;
    if (profileRank) profileRank.textContent = data.progress.rank ? '#' + data.progress.rank : '—';
    if (profilePoints) profilePoints.textContent = data.progress.points || 0;
    var attempted = document.querySelector('#app-student .student-stats-attempted');
    var streak = document.querySelector('#app-student .student-stats-streak');
    if (attempted) attempted.textContent = data.submissions.length;
    if (streak) streak.textContent = (stats.current_streak || 0) + ' days';
    renderNews('#app-student', data.news);
    renderStudentCollections(data);
    var assignedMentorPanel = document.querySelector('#app-student .student-mentor-details .dashboard-section-body');
    if (assignedMentorPanel) assignedMentorPanel.innerHTML = data.mentor ? '<div class="mentor-info-card"><div class="mentor-avatar">' + escapeHtml(initials(data.mentor.name)) + '</div><div><div class="mentor-name">' + escapeHtml(data.mentor.name) + '</div><div class="mentor-spec">' + escapeHtml(data.mentor.designation || data.mentor.specialization || 'Mentor') + '</div><div class="mentor-status">' + escapeHtml(data.mentor.email) + '</div></div></div>' : '<p class="empty-state">No mentor assigned yet.</p>';
    var mentorGroup = document.querySelector('#app-student .student-mentor-group');
    if (mentorGroup) mentorGroup.innerHTML = data.mentor && (data.mentor.group_name || data.mentor.group_id) ? '<p><strong>' + escapeHtml(data.mentor.group_name || data.mentor.group_id) + '</strong></p><p>Group ID: ' + escapeHtml(data.mentor.group_id || '—') + '</p>' : '<p class="empty-state">No group assigned yet.</p>';
    var mentorCard = document.querySelector('#app-student .student-mentor-card');
    if (mentorCard) mentorCard.innerHTML = data.mentor ? '<div class="mentor-avatar">' + escapeHtml(initials(data.mentor.name)) + '</div><div><div class="mentor-name">' + escapeHtml(data.mentor.name) + '</div><div class="mentor-spec">' + escapeHtml(data.mentor.specialization || data.mentor.designation || 'Mentor') + '</div><div class="mentor-status">Mentor ID: ' + escapeHtml(data.mentor.mentor_code || 'Assigned') + '</div></div>' : '<div class="mentor-avatar"><i class="fas fa-user-clock"></i></div><div><div class="mentor-name">No mentor assigned</div><div class="mentor-spec">A coordinator will assign your mentor.</div><div class="mentor-status">Waiting for assignment</div></div>';
    var myMentorPage = document.querySelector('#app-student .student-mentor-detail');
    if (myMentorPage) myMentorPage.innerHTML = data.mentor ? '<div class="dashboard-section"><div class="dashboard-section-body"><div class="mentor-info-card"><div class="mentor-avatar">' + escapeHtml(initials(data.mentor.name)) + '</div><div><div class="mentor-name">' + escapeHtml(data.mentor.name) + '</div><div class="mentor-spec">' + escapeHtml(data.mentor.designation || data.mentor.specialization || 'Mentor') + '</div><div class="student-meta">' + escapeHtml(data.mentor.department || '') + '</div><div class="student-meta">Group: ' + escapeHtml(data.mentor.group_name || data.mentor.group_id || 'Not set') + '</div><div class="mentor-status">Mentor ID: ' + escapeHtml(data.mentor.mentor_code || '—') + '</div></div></div></div></div>' : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No mentor assigned yet.</p></div></div>';
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
  if (stats) stats.innerHTML = '<p class="empty-state">Challenge and score stats will appear once this student has submissions.</p>';
  if (progress) progress.innerHTML = '<p class="empty-state">No progress data recorded yet.</p>';
}

function renderMentorProfile(profile, menteeCount, submissionCount, averageScore) {
  var card = document.querySelector('#app-mentor .mentor-profile-card .dashboard-list');
  if (card) card.innerHTML = '<div class="profile-summary"><div class="user-avatar">' + escapeHtml(initials(profile.name)) + '</div><div><h3>' + escapeHtml(profile.name) + '</h3><p>' + escapeHtml(profile.designation || 'Mentor') + ' · ' + escapeHtml(profile.department || 'Department not set') + '</p><p>' + escapeHtml(profile.email) + '</p><p>Mentor ID: ' + escapeHtml(profile.mentor_code || 'Not set') + ' · Group: ' + escapeHtml(profile.group_name || 'Not set') + '</p><p>' + escapeHtml(profile.bio || 'No mentor bio provided.') + '</p></div></div>';
  var stats = document.querySelector('#app-mentor .mentor-profile-stats');
  if (stats) stats.innerHTML = [['Assigned mentees', menteeCount], ['Submissions', submissionCount], ['Average score', Math.round(Number(averageScore || 0))]].map(function (item) { return '<div><div class="stat-value">' + Number(item[1] || 0) + '</div><div class="stat-label">' + item[0] + '</div></div>'; }).join('');
}

function renderMentorStudentProgress(students) {
  var container = document.querySelector('#app-mentor .mentor-progress-list');
  if (!container) return;
  container.innerHTML = students.length ? students.map(function (student) { return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(student.name) + '</h4><p class="student-meta">' + escapeHtml(student.student_code || 'Student ID unavailable') + '</p><div class="progress-bar-container"><div class="progress-header"><span class="progress-label">Assigned task completion</span><span class="progress-value">' + Number(student.progress || 0) + '%</span></div><div class="progress-bar"><div class="progress-fill blue" style="width:' + Number(student.progress || 0) + '%"></div></div></div><p class="student-meta">' + Number(student.completed_tasks || 0) + ' of ' + Number(student.assigned_tasks || 0) + ' assigned tasks accepted · average score ' + Math.round(Number(student.average_score || 0)) + '</p></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No mentees assigned yet.</p></div></div>';
}

function renderMentorFeedbackForSelected(feedback) {
  var container = document.querySelector('#app-mentor .mentor-student-feedback-list');
  if (!container) return;
  container.innerHTML = feedback.length ? feedback.map(function (item) { return '<div class="student-list-item"><div class="student-info"><div class="student-name">' + escapeHtml(item.message) + '</div><div class="student-meta">Rating: ' + Number(item.rating) + ' / 5 · ' + new Date(item.created_at).toLocaleDateString() + '</div></div></div>'; }).join('') : '<p class="empty-state">No feedback for this student yet.</p>';
}

function loadMentorFeedback(studentId) {
  if (!studentId || !window.currentUser) return renderMentorFeedbackForSelected([]);
  apiRequest('/api/mentors/' + encodeURIComponent(window.currentUser.user_id) + '/feedback?student_id=' + encodeURIComponent(studentId)).then(function (result) { renderMentorFeedbackForSelected(result.feedback || []); }).catch(function (error) { showToast(error.message || 'Unable to load feedback', 'error'); });
}

function renderMentorSubmissions(submissions) {
  var target = document.querySelector('#app-mentor .mentor-dashboard-submissions');
  var table = document.getElementById('mentor-review-submissions');
  if (target) target.innerHTML = submissions.length ? submissions.slice(0, 5).map(function (submission) { return '<div class="student-list-item"><div class="student-avatar">' + escapeHtml(initials(submission.student_name)) + '</div><div class="student-info"><div class="student-name">' + escapeHtml(submission.title) + '</div><div class="student-meta">' + escapeHtml(submission.student_name) + ' · ' + new Date(submission.submitted_at).toLocaleDateString() + '</div></div><span class="student-status ' + (submission.status === 'accepted' ? 'status-active' : 'status-pending') + '">' + escapeHtml(submission.status) + '</span></div>'; }).join('') : '<p class="empty-state">No submissions from your mentees yet.</p>';
  var pending = submissions.filter(function (submission) { return submission.status === 'submitted' || submission.status === 'late'; });
  if (table) table.innerHTML = pending.length ? pending.map(function (submission) { return '<tr><td>' + escapeHtml(submission.student_name) + '</td><td>' + escapeHtml(submission.title) + '</td><td>' + new Date(submission.submitted_at).toLocaleDateString() + '</td><td>' + escapeHtml(submission.status) + '</td><td>—</td><td><button type="button" class="btn btn-sm btn-primary" data-mentor-review="' + escapeHtml(submission.id) + '">Review</button></td></tr>'; }).join('') : '<tr><td colspan="6" class="empty-state">No pending submissions.</td></tr>';
}

function renderMentorTasks(tasks) {
  var target = document.querySelector('#app-mentor .mentor-dashboard-tasks');
  var table = document.getElementById('mentor-challenge-rows');
  var active = tasks.filter(function (task) { return task.status !== 'archived'; });
  if (target) target.innerHTML = active.length ? active.slice(0, 5).map(function (task) { return '<div class="student-list-item"><div class="student-info"><div class="student-name">' + escapeHtml(task.title) + '</div><div class="student-meta">' + escapeHtml(task.difficulty || 'Task') + (task.deadline ? ' · Due ' + new Date(task.deadline).toLocaleDateString() : '') + '</div></div><span class="student-status status-active">Published</span></div>'; }).join('') : '<p class="empty-state">No tasks created yet.</p>';
  if (table) table.innerHTML = active.length ? active.map(function (task) { return '<tr><td>' + escapeHtml(task.title) + '</td><td>' + escapeHtml(task.difficulty || 'Task') + '</td><td>' + (task.deadline ? new Date(task.deadline).toLocaleDateString() : '—') + '</td><td>' + Number(task.submission_count || 0) + '</td><td><span class="student-status status-active">Published</span></td></tr>'; }).join('') : '<tr><td colspan="5" class="empty-state">No tasks created yet.</td></tr>';
}

function showMentorTaskForm(students) {
  if (!students.length) return showToast('You need an assigned mentee before creating a task.', 'error');
  var options = students.map(function (student) { return '<option value="' + escapeHtml(student.id) + '">' + escapeHtml(student.name) + ' (' + escapeHtml(student.student_code || 'Student ID') + ')</option>'; }).join('');
  showModal('Assign Task', '<form id="mentor-task-form" style="display:grid;gap:12px;"><label>Student<select class="form-input" name="student_id" required>' + options + '</select></label><label>Task title<input class="form-input" name="title" maxlength="200" required></label><label>Description<textarea class="form-input" name="description" rows="4"></textarea></label><label>Difficulty<select class="form-input" name="difficulty"><option>Easy</option><option>Medium</option><option>Hard</option></select></label><label>Category<input class="form-input" name="category" maxlength="100"></label><label>Deadline<input class="form-input" name="deadline" type="datetime-local"></label></form>', [
    { text: 'Assign Task', class: 'btn-primary', action: function () {
      var form = document.getElementById('mentor-task-form');
      if (!form.reportValidity()) return false;
      var values = Object.fromEntries(new FormData(form).entries());
      values.deadline = values.deadline ? new Date(values.deadline).toISOString().slice(0, 19).replace('T', ' ') : null;
      return apiMutation('/api/tasks', 'POST', values).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to assign task', 'error'); return false; } showToast('Task assigned', 'success'); loadMentorDashboard(); return true; });
    } }
  ]);
}

function loadMentorDashboard() {
  var initialMenteeList = document.querySelector('#app-mentor .mentor-mentees-list');
  if (initialMenteeList) initialMenteeList.innerHTML = '<div class="dashboard-section mentor-empty-state"><div class="dashboard-section-body"><p class="empty-state">Loading assigned mentees...</p></div></div>';
  apiRequest('/api/dashboard/mentor').then(function (data) {
    if (!data || !data.success) return;
    renderRoleIdentity('#app-mentor', data.profile, 'Mentor');
    data.profile = data.profile || {};
    data.students = data.students || [];
    data.submissions = data.submissions || [];
    data.tasks = data.tasks || [];
    data.reportStats = data.reportStats || { assignedTasks: 0, completedTasks: 0, averageScore: 0 };
    var mentorName = document.querySelector('#app-mentor .mentor-dashboard-name');
    var mentorSidebarAvatar = document.querySelector('#app-mentor .mentor-dashboard-avatar');
    if (mentorName) mentorName.textContent = data.profile.name || 'Mentor';
    if (mentorSidebarAvatar) mentorSidebarAvatar.textContent = initials(data.profile.name || 'Mentor');
    var mentorSettingsForm = document.getElementById('mentor-settings-form');
    if (mentorSettingsForm && !mentorSettingsForm.dataset.bound) {
      mentorSettingsForm.dataset.bound = 'true';
      mentorSettingsForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var formValues = Object.fromEntries(new FormData(mentorSettingsForm).entries());
        apiMutation('/api/mentors/' + encodeURIComponent(window.currentUser.user_id), 'PUT', formValues).then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to update mentor profile', 'error'); showToast('Mentor profile updated', 'success'); loadMentorDashboard(); });
      });
    }
    var mentorFeedbackForm = document.getElementById('mentor-feedback-form');
    if (mentorFeedbackForm && !mentorFeedbackForm.dataset.bound) {
      mentorFeedbackForm.dataset.bound = 'true';
      mentorFeedbackForm.addEventListener('submit', function (event) {
        event.preventDefault();
        var studentId = Number(sessionStorage.getItem('pec-mentor-selected-student'));
        if (!studentId) return showToast('Select one of your mentees first', 'error');
        var values = Object.fromEntries(new FormData(mentorFeedbackForm).entries());
        apiMutation('/api/mentors/' + encodeURIComponent(window.currentUser.user_id) + '/feedback', 'POST', { student_id: studentId, message: values.message, rating: Number(values.rating) }).then(function (result) {
          if (!result || !result.success) return showToast(result && result.message || 'Unable to submit feedback', 'error');
          mentorFeedbackForm.reset();
          showToast('Feedback submitted', 'success');
          return apiRequest('/api/mentors/' + encodeURIComponent(window.currentUser.user_id) + '/feedback?student_id=' + encodeURIComponent(studentId)).then(function (response) { renderMentorFeedbackForSelected(response.feedback || []); });
        });
      });
    }
    var mentorChallengesPage = document.getElementById('mentor-challenges');
    if (mentorChallengesPage && !mentorChallengesPage.dataset.createBound) {
      mentorChallengesPage.dataset.createBound = 'true';
      mentorChallengesPage.addEventListener('click', function (event) { if (event.target.closest('[data-mentor-create-task]')) showMentorTaskForm(data.students || []); });
    }
    var reviewContainer = document.getElementById('app-mentor');
    var studentProfilePage = document.getElementById('mentor-student-profile');
    if (studentProfilePage && !studentProfilePage.dataset.feedbackBound) {
      studentProfilePage.dataset.feedbackBound = 'true';
      studentProfilePage.addEventListener('click', function (event) {
        var button = event.target.closest('[data-mentor-feedback]');
        if (!button) return;
        var form = document.getElementById('mentor-feedback-form');
        if (form) form.requestSubmit();
      });
    }
    var reviewContainer = document.getElementById('app-mentor');
    if (reviewContainer && !reviewContainer.dataset.reviewBound) {
      reviewContainer.dataset.reviewBound = 'true';
      reviewContainer.addEventListener('click', function (event) {
        var button = event.target.closest('[data-mentor-review]');
        if (!button) return;
        apiRequest('/api/submissions/' + encodeURIComponent(button.dataset.mentorReview)).then(function (result) { if (result && result.success) openSubmissionReview(result.submission); else showToast(result && result.message || 'Unable to load submission', 'error'); });
      });
    }
    var values = document.querySelectorAll('#app-mentor .dashboard-stat-card .stat-value');
    if (values[0]) values[0].textContent = data.capacity.assigned;
    if (values[1]) values[1].textContent = data.pendingReviews || 0;
    if (values[2]) values[2].textContent = data.capacity.assigned + ' / ' + data.capacity.maximum;
    if (values[3]) values[3].textContent = data.meetings || 0;
    renderMentorProfile(data.profile, data.students.length, data.submissions.length, data.reportStats.averageScore);
    var mentorRecentReviews = document.querySelector('#app-mentor .mentor-dashboard-reviews');
    var pendingSubmissions = (data.submissions || []).filter(function (submission) { return submission.status === 'submitted' || submission.status === 'late'; });
    if (mentorRecentReviews) mentorRecentReviews.innerHTML = pendingSubmissions.length ? pendingSubmissions.slice(0, 5).map(function (submission) { return '<div class="student-list-item"><div class="student-info"><div class="student-name">' + escapeHtml(submission.title) + '</div><div class="student-meta">' + escapeHtml(submission.student_name) + '</div></div><button type="button" class="btn btn-sm btn-primary" data-mentor-review="' + escapeHtml(submission.id) + '">Review</button></div>'; }).join('') : '<p class="empty-state">No pending reviews.</p>';
    renderNews('#app-mentor', data.news);
    var menteeList = document.querySelector('#app-mentor .mentor-mentees-list');
    if (menteeList) {
      menteeList.innerHTML = data.students.length ? data.students.map(function (student) { return '<div class="dashboard-section"><div class="dashboard-section-body"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;"><div class="student-avatar">' + escapeHtml(initials(student.name)) + '</div><div><h4 style="margin:0;">' + escapeHtml(student.name) + '</h4><p style="margin:0;font-size:12px;color:var(--text-secondary);">' + escapeHtml(student.student_code || 'Student ID unavailable') + '</p><p style="margin:4px 0 0;font-size:12px;color:var(--text-secondary);">' + escapeHtml([student.branch, student.year ? student.year + ' Year' : ''].filter(Boolean).join(' · ') || 'Profile details unavailable') + '</p></div></div><button class="btn btn-primary btn-sm mentor-view-student" data-student-id="' + escapeHtml(student.id) + '" style="margin-top:12px;width:100%;">View Profile</button></div></div>'; }).join('') : '<div class="dashboard-section mentor-empty-state"><div class="dashboard-section-body"><p class="empty-state">No mentees assigned yet. Coordinators can assign students from Mentor Allocation.</p></div></div>';
      menteeList.querySelectorAll('.mentor-view-student').forEach(function (button) { button.addEventListener('click', function () { var student = data.students.find(function (item) { return String(item.id) === String(button.dataset.studentId); }); sessionStorage.setItem('pec-mentor-selected-student', student.id); renderMentorStudentProfile(student); loadMentorFeedback(student.id); navigateTo('mentor-student-profile'); }); });
    }
    var mentorList = document.querySelector('#app-mentor .mentor-dashboard-mentees');
    if (mentorList) mentorList.innerHTML = data.students.length ? data.students.slice(0, 5).map(function (student) { return '<div class="student-list-item"><div class="student-avatar">' + escapeHtml(initials(student.name)) + '</div><div class="student-info"><div class="student-name">' + escapeHtml(student.name) + '</div><div class="student-meta">' + escapeHtml(student.student_code || 'Student ID unavailable') + '</div></div><span class="student-status status-active">Assigned</span></div>'; }).join('') : '<div class="student-list-item"><div class="student-info"><div class="student-name">No mentees assigned yet.</div><div class="student-meta">Coordinators can assign students from Mentor Allocation.</div></div></div>';
    var reportStats = document.querySelector('#app-mentor .mentor-report-stats');
    if (reportStats) reportStats.innerHTML = [['Assigned Tasks', data.reportStats.assignedTasks], ['Completed Tasks', data.reportStats.completedTasks], ['Average Score', Math.round(data.reportStats.averageScore)]].map(function (item) { return '<div class="dashboard-stat-card"><div class="stat-value">' + Number(item[1] || 0) + '</div><div class="stat-label">' + item[0] + '</div></div>'; }).join('');
    var mentorSettings = document.getElementById('mentor-settings-form');
    if (mentorSettings) ['name', 'email', 'phone', 'designation', 'department', 'expertise', 'bio'].forEach(function (field) { if (mentorSettings.elements[field]) mentorSettings.elements[field].value = data.profile[field] || ''; });
    renderMentorStudentProgress(data.students || []);
    renderMentorFeedback(data.submissions || []);
    var reportRows = document.getElementById('mentor-report-rows');
    if (reportRows) reportRows.innerHTML = data.students.length ? data.students.map(function (student) { return '<tr><td>' + escapeHtml(student.name) + '</td><td>' + Number(student.assigned_tasks || 0) + '</td><td>' + Number(student.completed_tasks || 0) + '</td><td>' + Math.round(Number(student.average_score || 0)) + '</td><td>' + Number(student.progress || 0) + '%</td></tr>'; }).join('') : '<tr><td colspan="5" class="empty-state">No mentee activity yet.</td></tr>';
    renderMentorSubmissions(data.submissions || []);
    renderMentorTasks(data.tasks || []);
  }).catch(function (error) { console.error('Mentor dashboard failed', error); });
}

function setCoordinatorLoadingMessage(id, message) {
  var target = document.getElementById(id);
  if (target) target.innerHTML = '<p class="empty-state">' + escapeHtml(message) + '</p>';
}

function renderCoordinatorLatestNews(news) {
  var target = document.getElementById('coordinator-latest-news');
  if (!target) return;
  var published = news.filter(function (item) { return item.status === 'published'; }).slice(0, 5);
  target.innerHTML = published.length ? published.map(function (item) { return '<div class="student-list-item"><div class="student-avatar"><i class="fas fa-newspaper"></i></div><div class="student-info"><div class="student-name">' + escapeHtml(item.title) + '</div><div class="student-meta">' + new Date(item.created_at).toLocaleDateString() + '</div></div></div>'; }).join('') : '<p class="empty-state">No announcements yet.</p>';
}

function renderCoordinatorRequestErrors(responses) {
  var checks = [
    { index: 1, id: 'coordinator-students', columns: 7 },
    { index: 2, id: 'coordinator-mentors', columns: 7 },
    { index: 3, id: 'coordinator-assignments', columns: 6 },
    { index: 4, id: 'coordinator-submissions', columns: 6 },
    { index: 5, id: 'coordinator-challenges', columns: 7 },
    { index: 6, id: 'coordinator-events', columns: 6 },
    { index: 7, id: 'coordinator-news', columns: 5 }
  ];
  checks.forEach(function (check) {
    if (responses[check.index].success) return;
    var target = document.getElementById(check.id);
    if (target) target.innerHTML = '<tr><td colspan="' + check.columns + '" class="empty-state">' + escapeHtml(responses[check.index].error.message) + '</td></tr>';
  });
  if (!responses[8].success) {
    var resources = document.getElementById('coordinator-resources');
    if (resources) resources.innerHTML = '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">' + escapeHtml(responses[8].error.message) + '</p></div></div>';
  }
  if (!responses[9].success) {
    var leaderboard = document.getElementById('coordinator-leaderboard');
    if (leaderboard) leaderboard.innerHTML = '<tr><td colspan="5" class="empty-state">' + escapeHtml(responses[9].error.message) + '</td></tr>';
  }
}

function loadCoordinatorDashboard() {
  ['coordinator-recent-students', 'coordinator-recent-submissions', 'coordinator-upcoming-events', 'coordinator-latest-news'].forEach(function (id) { setCoordinatorLoadingMessage(id, 'Loading...'); });
  [['coordinator-students', 7], ['coordinator-mentors', 7], ['coordinator-assignments', 6], ['coordinator-submissions', 6], ['coordinator-challenges', 7], ['coordinator-events', 6], ['coordinator-news', 5], ['coordinator-leaderboard', 5]].forEach(function (item) { var target = document.getElementById(item[0]); if (target) target.innerHTML = '<tr><td colspan="' + item[1] + '" class="empty-state">Loading...</td></tr>'; });
  var resourceContainer = document.getElementById('coordinator-resources');
  if (resourceContainer) resourceContainer.innerHTML = '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">Loading resources...</p></div></div>';
  var endpoints = [
    '/api/coordinators/dashboard',
    '/api/coordinators/students',
    '/api/coordinators/mentors',
    '/api/coordinators/assignments',
    '/api/coordinators/submissions',
    '/api/tasks',
    '/api/coordinators/events',
    '/api/coordinators/news',
    '/api/coordinators/resources',
    '/api/coordinators/leaderboard'
  ];
  Promise.all(endpoints.map(function (path) {
    return apiRequest(path).then(function (data) { return { success: true, data: data }; }).catch(function (error) {
      console.error('Coordinator endpoint failed: ' + path, error);
      return { success: false, error: error };
    });
  })).then(function (responses) {
    var data = responses[0].data;
    if (!data || !data.success) {
      ['coordinator-recent-students', 'coordinator-recent-submissions', 'coordinator-upcoming-events', 'coordinator-latest-news'].forEach(function (id) { setCoordinatorLoadingMessage(id, responses[0].error ? responses[0].error.message : 'Unable to load data. Please refresh and try again.'); });
      return;
    }
    renderRoleIdentity('#app-coordinator', { name: window.currentUser.name }, 'Coordinator');
    var values = document.querySelectorAll('#app-coordinator #coord-dashboard .dashboard-stat-card .stat-value');
    if (values[0]) values[0].textContent = data.stats.students;
    if (values[1]) values[1].textContent = data.stats.mentors;
    if (values[2]) values[2].textContent = data.stats.assignedMentees;
    if (values[3]) values[3].textContent = data.stats.tasks;
    if (values[4]) values[4].textContent = data.stats.submissions;
    if (values[5]) values[5].textContent = data.stats.upcomingEvents;
    renderCoordinatorRecentStudents(data.recentStudents || []);
    renderCoordinatorRecentSubmissions(data.recentSubmissions || []);
    renderCoordinatorUpcomingEvents(data.upcomingEvents || []);
    if (responses[7].success) renderCoordinatorLatestNews(responses[7].data.news || []);
    else setCoordinatorLoadingMessage('coordinator-latest-news', responses[7].error.message);
    if (responses[1].success) renderCoordinatorStudents(responses[1].data.students || []);
    if (responses[2].success) renderCoordinatorMentors(responses[2].data.mentors || []);
    if (responses[3].success) renderCoordinatorAssignments(responses[3].data.assignments || []);
    if (responses[4].success) renderCoordinatorSubmissions(responses[4].data.submissions || []);
    if (responses[5].success) renderCoordinatorChallenges(responses[5].data.tasks || []);
    if (responses[6].success) renderCoordinatorEvents(responses[6].data.events || []);
    if (responses[7].success) renderCoordinatorNews(responses[7].data.news || []);
    if (responses[8].success) renderCoordinatorResources(responses[8].data.resources || []);
    if (responses[9].success) renderCoordinatorLeaderboard(responses[9].data.leaderboard || []);
    renderCoordinatorRequestErrors(responses);
    renderCoordinatorProfileStats(data.stats);
    if (responses[2].success && responses[1].success) refreshCoordinatorAssignmentOptions(responses[2].data.mentors || [], responses[1].data.students || []);

    initCoordinatorAssignmentForm();
  });
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

function renderStudentCollections(data) {
  var resources = document.getElementById('student-resources-list');
  if (resources) resources.innerHTML = data.resources && data.resources.length ? data.resources.map(function (resource) { return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(resource.title) + '</h4><p>' + escapeHtml(resource.description || resource.category || resource.resource_type) + '</p><a href="' + escapeHtml(resource.resource_url) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Open Resource</a></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No resources are available yet.</p></div></div>';
  var attendance = document.getElementById('student-attendance-list');
  if (attendance) attendance.innerHTML = data.attendance && data.attendance.total ? '<p>' + Number(data.attendance.present) + ' of ' + Number(data.attendance.total) + ' sessions attended.</p>' : '<p class="empty-state">No attendance records yet.</p>';
  var achievements = document.getElementById('student-achievements-list');
  if (achievements) achievements.innerHTML = (data.achievements || []).map(function (item) { return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(item.title) + '</h4><p>' + escapeHtml(item.description || '') + '</p></div></div>'; }).join('') || '<p class="empty-state">No achievements available yet.</p>';
  var leaderboard = document.getElementById('student-leaderboard-rows');
  if (leaderboard) leaderboard.innerHTML = (data.leaderboard || []).length ? data.leaderboard.map(function (item, index) { return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(item.name) + '</td><td>' + Number(item.completed_challenges || 0) + '</td><td>' + Number(item.points || 0) + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="empty-state">No leaderboard data available yet.</td></tr>';
  var events = document.querySelector('#app-student .student-events-list');
  if (events) events.innerHTML = (data.events || []).length ? data.events.map(function (event) { return '<div class="dashboard-section"><div class="dashboard-section-body"><h4>' + escapeHtml(event.title) + '</h4><p>' + escapeHtml(event.description || '') + '</p><p class="student-meta">' + new Date(event.event_date).toLocaleDateString() + ' · ' + escapeHtml(event.location || 'Location not set') + '</p><button type="button" class="btn btn-primary student-event-register" data-event-id="' + escapeHtml(event.id) + '"' + (event.registration_status === 'registered' ? ' disabled' : '') + '>' + (event.registration_status === 'registered' ? 'Registered' : 'Register') + '</button></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No upcoming events.</p></div></div>';
  if (events && !events.dataset.registerBound) {
    events.dataset.registerBound = 'true';
    events.addEventListener('click', function (event) {
      var button = event.target.closest('.student-event-register');
      if (!button || button.disabled) return;
      apiMutation('/api/events/' + encodeURIComponent(button.dataset.eventId) + '/register', 'POST', {}).then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to register for event', 'error'); showToast('Registered for event', 'success'); loadStudentDashboard(); });
    });
  }
  renderStudentCollectionsNews(data);
  var notificationList = document.querySelector('#app-student .student-notifications-list');
  if (notificationList) notificationList.innerHTML = (data.notifications || []).length ? data.notifications.map(function (notification) { return '<div class="notification-item"><div class="notification-content"><div class="notification-title">' + escapeHtml(notification.title) + '</div><div class="notification-desc">' + escapeHtml(notification.message || '') + '</div><div class="notification-time">' + new Date(notification.created_at).toLocaleString() + '</div>' + (!notification.is_read ? '<button type="button" class="btn btn-sm btn-ghost" data-mark-notification="' + escapeHtml(notification.id) + '">Mark as read</button>' : '') + '</div></div>'; }).join('') : '<p class="empty-state">No notifications.</p>';
  var unread = (data.notifications || []).filter(function (notification) { return !notification.is_read; }).length;
  document.querySelectorAll('#app-student [data-notification-count]').forEach(function (badge) { badge.textContent = unread; badge.hidden = unread === 0; });
  if (notificationList && !notificationList.dataset.readBound) {
    notificationList.dataset.readBound = 'true';
    notificationList.addEventListener('click', function (event) { var button = event.target.closest('[data-mark-notification]'); if (button) markNotificationRead(button.dataset.markNotification); });
  }
}

function renderStudentCollectionsNews(data) {
  var items = data.news || [];
  var news = document.querySelector('#app-student .student-news-list');
  var dashboardNews = document.querySelector('#app-student .student-dashboard-news');
  var latest = items.filter(function (item) { return item.status === 'published'; });
  if (news) news.innerHTML = latest.length ? latest.map(function (item) { return '<div class="dashboard-section"><div class="dashboard-section-body"><span class="chip">' + escapeHtml(item.category || 'News') + '</span><h4>' + escapeHtml(item.title) + '</h4><p>' + escapeHtml(item.content || '') + '</p><span class="student-meta">' + new Date(item.published_at || item.created_at).toLocaleDateString() + '</span></div></div>'; }).join('') : '<div class="dashboard-section"><div class="dashboard-section-body"><p class="empty-state">No announcements available.</p></div></div>';
  if (dashboardNews) dashboardNews.innerHTML = latest.slice(0, 5).map(function (item) { return '<div class="student-list-item"><div class="student-info"><div class="student-name">' + escapeHtml(item.title) + '</div><div class="student-meta">' + new Date(item.published_at || item.created_at).toLocaleDateString() + '</div></div></div>'; }).join('') || '<p class="empty-state">No announcements available.</p>';
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
  stats = stats || {};
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
  if (tbody) tbody._submissionRows = submissions;
  var rows = submissions.map(function (submission) {
    var statusClass = submission.status === 'accepted' ? 'status-active' : submission.status === 'rejected' ? 'status-inactive' : 'status-pending';
    var canReview = ['submitted', 'late'].includes(submission.status);
    return '<tr><td>' + escapeHtml(submission.student_name) + '</td><td>' + escapeHtml(submission.title) + '</td><td>' + new Date(submission.submitted_at).toLocaleDateString() + '</td><td><span class="student-status ' + statusClass + '">' + escapeHtml(submission.status) + '</span></td><td>' + (submission.score === null ? '—' : Number(submission.score)) + '</td><td>' + (canReview ? '<button class="btn btn-sm btn-primary" data-review-submission="' + escapeHtml(submission.id) + '">Review</button>' : '—') + '</td></tr>';
  }).join('');
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" class="empty-state">No submissions yet.</td></tr>';
  if (tbody && !tbody.dataset.reviewBound) {
    tbody.dataset.reviewBound = 'true';
    tbody.addEventListener('click', function (event) {
      var button = event.target.closest('[data-review-submission]');
      if (!button) return;
      var submission = (tbody._submissionRows || []).find(function (item) { return String(item.id) === String(button.dataset.reviewSubmission); });
      if (submission) apiRequest('/api/submissions/' + encodeURIComponent(submission.id)).then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to load submission', 'error'); openSubmissionReview(result.submission); }).catch(function (error) { showToast(error.message || 'Unable to load submission', 'error'); });
    });
  }
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
  var now = new Date();
  var visible = events.filter(function (event) { return event.status === 'published' && new Date(event.event_date) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()); });
  var rows = visible.map(function (event) { return '<tr><td>' + escapeHtml(event.title) + '</td><td>' + escapeHtml(event.category || 'Event') + '</td><td>' + new Date(event.event_date + 'T00:00:00').toLocaleDateString() + '</td><td>' + escapeHtml(event.location || '—') + '</td><td><span class="student-status status-active">Upcoming</span></td><td><button class="btn btn-sm btn-ghost" data-delete-event="' + escapeHtml(event.id) + '">Delete</button></td></tr>'; }).join('');
  if (tbody) tbody.innerHTML = rows || '<tr><td colspan="6" class="empty-state">No upcoming events.</td></tr>';
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
      return apiMutation('/api/submissions/' + encodeURIComponent(submission.id), 'PUT', { score: score, feedback: document.getElementById('submission-review-feedback').value, status: document.getElementById('submission-review-status').value }).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to save review', 'error'); return false; } showToast('Submission reviewed', 'success'); closeModal(); loadCoordinatorDashboard(); return true; });
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
  var recent = document.getElementById('coordinator-recent-assignments');
  if (recent) recent.innerHTML = assignments.slice(0, 5).map(function (assignment) { return '<div class="student-list-item"><div class="student-avatar">' + escapeHtml(initials(assignment.student_name)) + '</div><div class="student-info"><div class="student-name">' + escapeHtml(assignment.student_name) + '</div><div class="student-meta">Mentor: ' + escapeHtml(assignment.mentor_name) + '</div></div><span class="student-status status-active">Assigned</span></div>'; }).join('') || '<p class="empty-state">No mentees assigned yet.</p>';
  tbody.innerHTML = assignments.length ? assignments.map(function (assignment) { return '<tr><td>' + escapeHtml(assignment.student_name) + '</td><td>' + escapeHtml(assignment.student_code || '—') + '</td><td>' + escapeHtml(assignment.mentor_name) + '</td><td>' + escapeHtml(assignment.mentor_code || '—') + '</td><td>' + new Date(assignment.assigned_at).toLocaleDateString() + '</td><td><button class="btn btn-sm btn-ghost" data-unassign-id="' + escapeHtml(assignment.assignment_id) + '">Remove</button></td></tr>'; }).join('') : '<tr><td colspan="6" class="empty-state">No mentees assigned yet.</td></tr>';
  if (!tbody.dataset.unassignBound) {
    tbody.dataset.unassignBound = 'true';
    tbody.addEventListener('click', function (event) {
      var button = event.target.closest('[data-unassign-id]');
      if (!button) return;
      apiMutation('/api/coordinators/assign/' + encodeURIComponent(button.dataset.unassignId), 'DELETE').then(function (result) { if (!result || !result.success) return showToast(result && result.message || 'Unable to remove assignment', 'error'); showToast('Assignment removed', 'success'); loadCoordinatorDashboard(); });
    });
  }
}

function refreshCoordinatorAssignmentOptions(mentors, students) {
  var form = document.getElementById('mentor-assignment-form');
  if (!form) return;
  var mentorSelect = document.getElementById('assignment-mentor');
  var studentSelect = document.getElementById('assignment-student');
  var selectedMentor = mentorSelect.value;
  var selectedStudent = studentSelect.value;
  mentorSelect.innerHTML = '<option value="">Select a mentor</option>' + mentors.map(function (mentor) { return '<option value="' + escapeHtml(mentor.mentor_id) + '">' + escapeHtml(mentor.name) + ' (' + escapeHtml(mentor.mentor_code || 'No ID') + ') · ' + Number(mentor.assigned_students || 0) + '/7</option>'; }).join('');
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
      if (!form.reportValidity()) return false;
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
      if (!form.reportValidity()) return false;
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
      if (!form.reportValidity()) return false;
      return apiMutation('/api/coordinators/events', 'POST', Object.fromEntries(new FormData(form).entries())).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to create event', 'error'); return false; } showToast('Event created', 'success'); loadCoordinatorDashboard(); return true; });
    } }
  ]);
}

function showResourceForm() {
  showModal('Add Learning Resource', '<form id="coordinator-resource-form" style="display:grid;gap:12px;"><label>Title<input class="form-input" name="title" required maxlength="255"></label><label>Description<textarea class="form-input" name="description" rows="3"></textarea></label><label>Type<select class="form-input" name="resource_type" required><option value="link">Link</option><option value="document">Document</option><option value="video">Video</option><option value="tutorial">Tutorial</option><option value="pdf">PDF</option><option value="github">GitHub</option></select></label><label>URL<input class="form-input" name="resource_url" type="url" required></label><label>Category<input class="form-input" name="category" maxlength="100"></label></form>', [
    { text: 'Save Resource', class: 'btn-primary', action: function () {
      var form = document.getElementById('coordinator-resource-form');
      if (!form.reportValidity()) return false;
      return apiMutation('/api/coordinators/resources', 'POST', Object.fromEntries(new FormData(form).entries())).then(function (result) { if (!result || !result.success) { showToast(result && result.message || 'Unable to save resource', 'error'); return false; } showToast('Resource added', 'success'); loadCoordinatorDashboard(); return true; });
    } }
  ]);
}

function copyTextToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return new Promise(function (resolve, reject) {
    var input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    var copied = document.execCommand('copy');
    input.remove();
    if (copied) resolve();
    else reject(new Error('Unable to copy link'));
  });
}

function showSignupShareDialog(role) {
  var label = role === 'student' ? 'Student' : 'Mentor';
  var signupUrl = new URL('../pages/auth.html?view=' + role + '-signup', window.location.href).href;
  var shareText = 'Register for the PEC ' + label + ' Portal: ' + signupUrl;
  showModal('Share ' + label + ' Signup', '<p>Send this registration link to a ' + label.toLowerCase() + ' or open the form yourself.</p><label>Registration link<input class="form-input" id="signup-share-link" type="text" readonly value="' + escapeHtml(signupUrl) + '" onclick="this.select()"></label><p class="signup-link-note">Anyone with this link can open the public ' + label.toLowerCase() + ' registration form.</p>', [
    { text: 'Copy Link', class: 'btn-secondary', action: function () {
      return copyTextToClipboard(signupUrl).then(function () { showToast('Signup link copied', 'success'); return true; }).catch(function () { showToast('Could not copy link. Select the link and copy it manually.', 'error'); return false; });
    } },
    { text: 'WhatsApp', class: 'btn-secondary', action: function () {
      window.open('https://wa.me/?text=' + encodeURIComponent(shareText), '_blank', 'noopener,noreferrer');
      return true;
    } },
    { text: 'Share…', class: 'btn-secondary', action: function () {
      if (navigator.share) return navigator.share({ title: 'PEC ' + label + ' Registration', text: 'Register for the PEC ' + label + ' Portal', url: signupUrl }).then(function () { return true; }).catch(function (error) { if (error.name === 'AbortError') return false; return copyTextToClipboard(signupUrl).then(function () { showToast('Signup link copied', 'success'); return true; }); });
      return copyTextToClipboard(signupUrl).then(function () { showToast('Signup link copied', 'success'); return true; });
    } },
    { text: 'Open Form', class: 'btn-primary', action: function () {
      window.open(signupUrl, '_blank', 'noopener,noreferrer');
      return true;
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
      if (action === 'student' || action === 'mentor') showSignupShareDialog(action);
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
