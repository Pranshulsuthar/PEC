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
    } catch (e) {
      sessionStorage.removeItem('pec_jwt');
    }
  }

  if (!tokenUser || !['student', 'mentor', 'coordinator'].includes(tokenUser.role)) {
    sessionStorage.removeItem('pec_jwt');
    window.location.replace('auth.html');
    return;
  }
  if (role !== tokenUser.role) {
    role = tokenUser.role;
  }
  window.currentUser = tokenUser;
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

function apiRequest(path) {
  var token = sessionStorage.getItem('pec_jwt');
  return fetch(path, {
    headers: { 'Authorization': 'Bearer ' + token }
  }).then(function (response) {
    if (response.status === 401 || response.status === 403) {
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
  document.querySelectorAll(appSelector + ' .user-name').forEach(function (el) { el.textContent = name; });
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

function loadStudentDashboard() {
  apiRequest('/api/dashboard/student').then(function (data) {
    if (!data || !data.success) return;
    renderRoleIdentity('#app-student', data.profile, 'Student');
    var stats = data.progress || {};
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
    var mentorCard = document.querySelector('#app-student .mentor-info-card');
    if (mentorCard) mentorCard.innerHTML = data.mentor ? '<div class="mentor-avatar">' + escapeHtml(initials(data.mentor.name)) + '</div><div><div class="mentor-name">' + escapeHtml(data.mentor.name) + '</div><div class="mentor-spec">' + escapeHtml(data.mentor.specialization || 'Mentor') + '</div><div class="mentor-status">Mentor ID: ' + escapeHtml(data.mentor.mentor_code || 'Assigned') + '</div></div>' : '<div class="mentor-avatar"><i class="fas fa-user-clock"></i></div><div><div class="mentor-name">No mentor assigned</div><div class="mentor-spec">A coordinator will assign your mentor.</div><div class="mentor-status">Waiting for assignment</div></div>';
    var mentorDetails = document.querySelector('#app-student .student-mentor-details .dashboard-section-body');
    var mentorGroup = document.querySelector('#app-student .student-mentor-group');
    if (data.mentor) {
      if (mentorDetails) mentorDetails.innerHTML = '<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;"><div class="mentor-avatar" style="width:72px;height:72px;font-size:28px;">' + escapeHtml(initials(data.mentor.name)) + '</div><div><h3 style="margin:0;">' + escapeHtml(data.mentor.name) + '</h3><p style="color:var(--text-secondary);margin:4px 0;">Mentor ID: ' + escapeHtml(data.mentor.mentor_code || 'Unavailable') + '</p><p style="color:#22c55e;font-size:13px;margin:0;"><i class="fas fa-circle" style="font-size:8px;"></i> Assigned</p></div></div>';
      if (mentorGroup) mentorGroup.innerHTML = '<p><strong>' + escapeHtml(data.mentor.group_name || 'Assigned group') + '</strong></p><p style="color:var(--text-secondary);">Group ID: ' + escapeHtml(data.mentor.group_id || 'Unavailable') + '</p><p class="empty-state">You can access mentor content for this assigned group only.</p>';
    } else {
      if (mentorDetails) mentorDetails.innerHTML = '<p class="empty-state">No mentor assigned yet. A coordinator will assign a mentor to your account.</p>';
      if (mentorGroup) mentorGroup.innerHTML = '<p class="empty-state">No group access until a mentor is assigned.</p>';
    }
    var currentChallenge = Array.from(document.querySelectorAll('#app-student .dashboard-section h3')).find(function (heading) { return heading.textContent.trim() === 'Current Challenge'; });
    if (currentChallenge) { var body = currentChallenge.parentElement.nextElementSibling; body.innerHTML = data.tasks.length ? data.tasks.map(function (task) { return '<div class="task-item"><div class="task-title">' + escapeHtml(task.title) + '</div><div class="task-desc">' + escapeHtml(task.description || 'No description') + '</div></div>'; }).join('') : '<p class="empty-state">No tasks assigned yet. Your mentor will add tasks here.</p>'; }
  }).catch(function (error) { console.error('Student dashboard failed', error); });
}

function renderMentorStudentProfile(student) {
  var card = document.querySelector('#app-mentor .mentor-student-profile-card .dashboard-section-body');
  var stats = document.querySelector('#app-mentor .mentor-student-stats .dashboard-section-body');
  var progress = document.querySelector('#app-mentor .mentor-student-progress .dashboard-section-body');
  var notes = document.querySelector('#app-mentor .mentor-student-notes .dashboard-section-body');
  if (!student) {
    if (card) card.innerHTML = '<p class="empty-state">Select an assigned student from My Mentees to view their profile.</p>';
    if (stats) stats.innerHTML = '<p class="empty-state">No student selected.</p>';
    if (progress) progress.innerHTML = '<p class="empty-state">No progress data recorded yet.</p>';
    return;
  }
  if (card) card.innerHTML = '<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;"><div class="user-avatar" style="width:72px;height:72px;font-size:28px;">' + escapeHtml(initials(student.name)) + '</div><div><h3 style="margin:0;">' + escapeHtml(student.name) + '</h3><p style="color:var(--text-secondary);margin:4px 0;">Student ID: ' + escapeHtml(student.student_code || 'Unavailable') + '</p><p style="color:#22c55e;font-size:13px;margin:0;"><i class="fas fa-circle" style="font-size:8px;"></i> Assigned to you</p></div></div>';
  if (stats) stats.innerHTML = '<div class="student-meta">No challenges or points recorded yet.</div>';
  if (progress) progress.innerHTML = '<p class="empty-state">No progress data recorded yet.</p>';
}

function loadMentorDashboard() {
  var initialMenteeList = document.querySelector('#app-mentor .mentor-mentees-list');
  if (initialMenteeList) initialMenteeList.innerHTML = '<div class="dashboard-section mentor-empty-state"><div class="dashboard-section-body"><p class="empty-state">Loading assigned mentees...</p></div></div>';
  apiRequest('/api/dashboard/mentor').then(function (data) {
    if (!data || !data.success) return;
    renderRoleIdentity('#app-mentor', data.profile, 'Mentor');
    var values = document.querySelectorAll('#app-mentor .dashboard-stat-card .stat-value');
    if (values[0]) values[0].textContent = data.students.length;
    if (values[1]) values[1].textContent = data.students.length;
    if (values[2]) values[2].textContent = data.pendingReviews || 0;
    if (values[3]) values[3].textContent = data.capacity.assigned + ' / ' + data.capacity.maximum;
    var capacityLabel = document.querySelector('#app-mentor .dashboard-stat-card:nth-child(1) .stat-label');
    if (capacityLabel) capacityLabel.textContent = data.capacity.full ? 'Mentor Capacity Full' : 'Mentees';
    renderNews('#app-mentor', data.news);
    var menteeList = document.querySelector('#app-mentor .mentor-mentees-list');
    if (menteeList) {
      menteeList.innerHTML = data.students.length ? data.students.map(function (student) { return '<div class="dashboard-section"><div class="dashboard-section-body"><div style="display:flex;gap:12px;align-items:center;margin-bottom:12px;"><div class="student-avatar">' + escapeHtml(initials(student.name)) + '</div><div><h4 style="margin:0;">' + escapeHtml(student.name) + '</h4><p style="margin:0;font-size:12px;color:var(--text-secondary);">' + escapeHtml(student.student_code || 'Student ID unavailable') + '</p></div></div><div class="student-meta">No progress data recorded yet.</div><button class="btn btn-primary btn-sm mentor-view-student" data-student-id="' + escapeHtml(student.id) + '" style="margin-top:12px;width:100%;">View Profile</button></div></div>'; }).join('') : '<div class="dashboard-section mentor-empty-state"><div class="dashboard-section-body"><p class="empty-state">No mentees assigned yet. Coordinators can assign students from Mentor Allocation.</p></div></div>';
      menteeList.querySelectorAll('.mentor-view-student').forEach(function (button) { button.addEventListener('click', function () { var student = data.students.find(function (item) { return String(item.id) === String(button.dataset.studentId); }); renderMentorStudentProfile(student); navigateTo('mentor-student-profile'); }); });
    }
  }).catch(function (error) { console.error('Mentor dashboard failed', error); });
}

function loadCoordinatorDashboard() {
  apiRequest('/api/dashboard/coordinator').then(function (data) {
    if (!data || !data.success) return;
    renderRoleIdentity('#app-coordinator', { name: window.currentUser.name }, 'Coordinator');
    var values = document.querySelectorAll('#app-coordinator .dashboard-stat-card .stat-value');
    if (values[0]) values[0].textContent = data.stats.students;
    if (values[1]) values[1].textContent = data.stats.mentors;
    if (values[2]) values[2].textContent = data.stats.activeStudents;
    if (values[4]) values[4].textContent = data.stats.tasks;
    if (values[5]) values[5].textContent = data.stats.solved;
    renderNews('#app-coordinator', data.news);
    renderCoordinatorNews(data.news);
  }).catch(function (error) { console.error('Coordinator dashboard failed', error); });
}

function renderCoordinatorNews(news) {
  var body = document.querySelector('#coord-news .dashboard-table tbody');
  if (!body) return;
  body.innerHTML = (news || []).map(function (item) {
    var nextStatus = item.status === 'published' ? 'draft' : 'published';
    var actionLabel = item.status === 'published' ? 'Unpublish' : 'Publish';
    return '<tr data-news-id="' + item.id + '"><td>' + escapeHtml(item.title) + '</td><td>' + escapeHtml(item.category || 'General') + '</td><td><span class="student-status ' + (item.status === 'published' ? 'status-active' : 'status-pending') + '">' + escapeHtml(item.status) + '</span></td><td>' + new Date(item.created_at).toLocaleDateString() + '</td><td><div style="display:flex;gap:4px"><button class="btn btn-sm btn-ghost" data-news-action="edit">Edit</button><button class="btn btn-sm btn-ghost" data-news-action="toggle" data-next-status="' + nextStatus + '">' + actionLabel + '</button><button class="btn btn-sm btn-ghost" data-news-action="delete">Delete</button></div></td></tr>';
  }).join('') || '<tr><td colspan="5">No news items yet.</td></tr>';
}

function initCoordinatorNewsActions() {
  var container = document.getElementById('coord-news');
  if (!container) return;
  container.addEventListener('click', function (event) {
    var button = event.target.closest('[data-news-action], .btn-primary');
    if (!button) return;
    if (button.textContent.toLowerCase().indexOf('create news') !== -1) {
      var title = window.prompt('News title');
      var content = title && window.prompt('News content');
      if (!title || !content) return;
      apiMutation('/api/news', 'POST', { title: title, content: content, status: 'published' }).then(function (result) {
        if (!result.success) return showToast(result.message, 'error');
        showToast('News published', 'success');
        loadCoordinatorDashboard();
      });
      return;
    }
    var row = button.closest('tr');
    if (!row) return;
    var id = row.getAttribute('data-news-id');
    var action = button.getAttribute('data-news-action');
    if (action === 'delete') {
      if (!window.confirm('Delete this news item?')) return;
      apiMutation('/api/news/' + id, 'DELETE').then(function (result) { if (result.success) { showToast('News deleted', 'success'); loadCoordinatorDashboard(); } });
    } else if (action === 'toggle') {
      apiMutation('/api/news/' + id, 'PUT', { title: row.cells[0].textContent, content: row.cells[0].textContent, category: row.cells[1].textContent, status: button.getAttribute('data-next-status') }).then(function (result) { if (result.success) { showToast('News status updated', 'success'); loadCoordinatorDashboard(); } });
    } else if (action === 'edit') {
      var title = window.prompt('News title', row.cells[0].textContent);
      var content = title && window.prompt('News content', row.cells[0].textContent);
      if (!title || !content) return;
      apiMutation('/api/news/' + id, 'PUT', { title: title, content: content, category: row.cells[1].textContent, status: row.cells[2].textContent.trim() }).then(function (result) { if (result.success) { showToast('News updated', 'success'); loadCoordinatorDashboard(); } });
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
