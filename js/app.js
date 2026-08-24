/**
 * =========================================================
 * FOLIO — MOBILE-FIRST MAIN APPLICATION CONTROLLER (V7)
 * First-Launch Permission Onboarding, Persistent Storage,
 * Background Notification Sync, Bottom Tabs & Safe Areas
 * =========================================================
 */

class FolioApp {
  constructor() {
    this.currentView = 'dashboard';
    this.activeTag = null;
    this.activeCalendarDate = null;
    this.calYear = new Date().getFullYear();
    this.calMonth = new Date().getMonth();
    this.editingNoteId = null;
    this.editingTaskId = null;
    this.noteAutosaveTimer = null;
    this.searchQuery = '';
    this.searchFilter = 'all';
    this.installPromptEvent = null;

    // Vault & PIN Lock State
    this.isVaultUnlocked = false;
    this.pendingUnlockNoteId = null;

    // Pomodoro Timer State
    this.pomodoroMode = 'focus';
    this.pomodoroTimeLeft = 1500;
    this.pomodoroIsRunning = false;
    this.pomodoroInterval = null;
    this.pomodoroActiveTaskId = null;
    this.pomodoroActiveTaskTitle = '';
  }

  async init() {
    await window.folioDB.init();
    await window.notificationManager.init();

    const savedTheme = localStorage.getItem('folio_theme') || 'paper';
    this.setTheme(savedTheme);

    this.registerPWA();
    this.setupGlobalShortcuts();

    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get('view');
    const actionParam = urlParams.get('action');
    const taskIdParam = urlParams.get('id');

    if (actionParam === 'complete-task' && taskIdParam) {
      await this.toggleTaskComplete(taskIdParam);
    }

    if (viewParam) {
      this.navigate(viewParam);
    } else {
      this.renderCurrentView();
    }

    if (actionParam === 'new-note') {
      this.openNoteEditor();
    } else if (actionParam === 'new-task') {
      this.openTaskEditor();
    }

    this.updateNotificationPermissionUI();
    window.notificationManager.syncAlarmsToServiceWorker();

    // Check first-time user onboarding
    if (!localStorage.getItem('folio_onboarded')) {
      setTimeout(() => {
        const obModal = document.getElementById('onboardingModal');
        if (obModal) obModal.classList.remove('hidden');
      }, 400);
    }

    console.log('[FolioApp v7] App initialized & ready.');
  }

  // ================= FIRST-LAUNCH PERMISSIONS ONBOARDING =================

  async grantAllPermissionsAndStart() {
    // 1. Notification Permission
    await window.notificationManager.requestPermission();

    // 2. Persistent Storage (Browser will never wipe offline notes)
    if (navigator.storage && navigator.storage.persist) {
      try {
        const isPersisted = await navigator.storage.persist();
        console.log('[Folio] Persistent storage granted:', isPersisted);
      } catch (e) {
        console.warn('[Folio] Storage persist error:', e);
      }
    }

    // 3. Audio Warmup
    window.notificationManager.playChime('bell');

    // 4. Mark onboarded
    localStorage.setItem('folio_onboarded', 'true');

    // 5. Close modal
    const obModal = document.getElementById('onboardingModal');
    if (obModal) obModal.classList.add('hidden');

    this.showToast('All permissions active! Welcome to Folio 🚀');
    this.updateNotificationPermissionUI();
    window.notificationManager.syncAlarmsToServiceWorker();
  }

  dismissOnboarding() {
    localStorage.setItem('folio_onboarded', 'true');
    const obModal = document.getElementById('onboardingModal');
    if (obModal) obModal.classList.add('hidden');
  }

  // ================= VIEW NAVIGATION =================

  navigate(viewName, param = null) {
    this.currentView = viewName;
    this.activeTag = viewName === 'tag' ? param : null;
    
    // Update Desktop Sidebar Links
    document.querySelectorAll('.sidebar-nav-link').forEach(link => {
      const target = link.getAttribute('data-view');
      if (target === viewName) {
        link.classList.add('bg-[var(--border-subtle)]', 'font-bold', 'text-[var(--text-primary)]');
        link.classList.remove('text-[var(--text-secondary)]');
      } else {
        link.classList.remove('bg-[var(--border-subtle)]', 'font-bold', 'text-[var(--text-primary)]');
        link.classList.add('text-[var(--text-secondary)]');
      }
    });

    // Update Mobile Bottom Bar Tabs
    document.querySelectorAll('.mobile-nav-tab').forEach(tab => {
      const tabName = tab.getAttribute('data-tab');
      if (tabName === viewName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Update Mobile Top View Title
    const titleEl = document.getElementById('appViewTitle');
    if (titleEl) {
      const titles = {
        dashboard: 'Folio',
        notes: 'All Notes',
        tasks: 'Daily Tasks',
        today: 'Today’s Focus',
        habits: 'Habits & Streaks',
        focus: 'Focus Timer',
        upcoming: 'Upcoming Tasks',
        completed: 'Completed',
        trash: 'Trash Bin',
        settings: 'Settings',
        tag: param ? `#${param}` : 'Tag Filter'
      };
      titleEl.textContent = titles[viewName] || 'Folio';
    }

    this.renderCurrentView();
  }

  // ================= MOBILE QUICK ACTION BOTTOM SHEET =================

  openQuickActionSheet() {
    const sheet = document.getElementById('mobileActionSheet');
    if (sheet) sheet.classList.remove('hidden');
  }

  closeQuickActionSheet() {
    const sheet = document.getElementById('mobileActionSheet');
    if (sheet) sheet.classList.add('hidden');
  }

  async renderCurrentView() {
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) return;

    window.scrollTo({ top: 0, behavior: 'smooth' });

    switch (this.currentView) {
      case 'dashboard':
        await this.renderDashboardView(mainContent);
        break;
      case 'notes':
        await this.renderNotesView(mainContent);
        break;
      case 'tasks':
        await this.renderTasksView(mainContent);
        break;
      case 'today':
        await this.renderTodayView(mainContent);
        break;
      case 'upcoming':
        await this.renderUpcomingView(mainContent);
        break;
      case 'completed':
        await this.renderCompletedView(mainContent);
        break;
      case 'habits':
        await this.renderHabitsView(mainContent);
        break;
      case 'focus':
        await this.renderFocusView(mainContent);
        break;
      case 'settings':
        await this.renderSettingsView(mainContent);
        break;
      case 'trash':
        await this.renderTrashView(mainContent);
        break;
      case 'tag':
        await this.renderTagFilteredView(mainContent, this.activeTag);
        break;
      default:
        await this.renderDashboardView(mainContent);
    }

    this.renderSidebarTags();
    this.renderSidebarCounters();
  }

  // ================= 1. DASHBOARD VIEW =================

  async renderDashboardView(container) {
    const stats = await window.folioDB.getDashboardStats();
    const tasks = await window.folioDB.getTasks();
    const habits = await window.folioDB.getHabits();

    const now = new Date();
    const greeting = this.getGreeting(now.getHours());
    const dateFormatted = now.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });

    const taskDatesSet = new Set();
    tasks.forEach(t => {
      if (t.dueDate && !t.completed) taskDatesSet.add(t.dueDate);
    });

    const todayStr = now.toISOString().split('T')[0];
    const todayTasks = stats.todayTasks;
    const pendingCount = stats.pendingCount;
    const completedCount = stats.completedCount;
    const recentNotes = stats.recentNotes;

    container.innerHTML = `
      <div class="space-y-6 sm:space-y-8">
        
        <!-- Header & Quick Actions -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">
              ${dateFormatted}
            </div>
            <h1 class="font-serif font-bold text-2xl sm:text-3xl text-[var(--text-primary)]">
              ${greeting}
            </h1>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <button type="button" onclick="window.folioApp.openNoteEditor()" class="btn-secondary px-3.5 py-2 text-xs rounded-xl shadow-sm flex items-center gap-1.5">
              <i class="fa-solid fa-file-pen text-xs text-[var(--accent-terracotta)]"></i>
              <span>+ Note</span>
            </button>

            <button type="button" onclick="window.folioApp.openTaskEditor()" class="btn-primary px-3.5 py-2 text-xs rounded-xl shadow-sm flex items-center gap-1.5">
              <i class="fa-solid fa-plus text-xs"></i>
              <span>+ Task</span>
            </button>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          
          <div class="paper-card p-3.5">
            <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-0.5 font-bold">Today's Tasks</div>
            <div class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">${todayTasks.length}</div>
            <div class="text-[10px] text-[var(--text-secondary)] mt-0.5">${todayTasks.filter(t => t.completed).length} done</div>
          </div>

          <div class="paper-card p-3.5">
            <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-0.5 font-bold">Pending</div>
            <div class="font-serif font-bold text-xl sm:text-2xl text-[var(--accent-terracotta)]">${pendingCount}</div>
            <div class="text-[10px] text-[var(--text-secondary)] mt-0.5">To do</div>
          </div>

          <div class="paper-card p-3.5">
            <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-0.5 font-bold">Habits Done</div>
            <div class="font-serif font-bold text-xl sm:text-2xl text-[var(--accent-sage)]">${stats.habitsDoneToday} / ${stats.totalHabits}</div>
            <div class="text-[10px] text-[var(--text-secondary)] mt-0.5">Today</div>
          </div>

          <div class="paper-card p-3.5">
            <div class="text-[10px] font-mono text-[var(--text-muted)] uppercase mb-0.5 font-bold">Notes</div>
            <div class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">${stats.totalNotes}</div>
            <div class="text-[10px] text-[var(--text-secondary)] mt-0.5">${stats.todayNotesCount} updated</div>
          </div>

        </div>


        <!-- HABIT TRACKER MATRIX -->
        <div>
          ${Components.renderHabitTrackerCard(habits)}
        </div>


        <!-- Main Grid: Center Tasks & Notes / Right Pomodoro & Calendar -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          
          <div class="lg:col-span-2 space-y-6 sm:space-y-8">
            
            <!-- Today's Tasks -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-calendar-day text-[var(--accent-terracotta)]"></i>
                  <h2 class="font-serif font-bold text-base sm:text-lg text-[var(--text-primary)]">Today's Agenda</h2>
                  <span class="text-xs font-mono text-[var(--text-muted)] font-bold">(${todayTasks.length})</span>
                </div>
                <button type="button" onclick="window.folioApp.navigate('today')" class="text-xs font-sans font-bold text-[var(--accent-terracotta)] hover:underline">
                  View All →
                </button>
              </div>

              <div class="space-y-2.5">
                ${todayTasks.length > 0 ? 
                  todayTasks.map(t => Components.renderTaskCard(t)).join('') : 
                  Components.renderEmptyState("Clear Slate for Today", "No scheduled tasks for today.", "Create a Task", "window.folioApp.openTaskEditor()", "fa-circle-check")
                }
              </div>
            </div>

            <!-- Recent Notes -->
            <div>
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <i class="fa-solid fa-book-open text-[var(--accent-leather)]"></i>
                  <h2 class="font-serif font-bold text-base sm:text-lg text-[var(--text-primary)]">Recent Notes</h2>
                  <span class="text-xs font-mono text-[var(--text-muted)] font-bold">(${stats.totalNotes})</span>
                </div>
                <button type="button" onclick="window.folioApp.navigate('notes')" class="text-xs font-sans font-bold text-[var(--accent-terracotta)] hover:underline">
                  All Notes →
                </button>
              </div>

              ${recentNotes.length > 0 ? `
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  ${recentNotes.map(n => Components.renderNoteCard(n)).join('')}
                </div>
              ` : Components.renderEmptyState("Notebook is Fresh", "Capture thoughts, ideas, or meeting notes.", "Write Note", "window.folioApp.openNoteEditor()", "fa-pen-nib")}
            </div>

          </div>


          <!-- Right Column -->
          <div class="space-y-6">
            
            <div id="pomodoroWidgetContainer">
              ${Components.renderPomodoroWidget(this.pomodoroMode, this.pomodoroTimeLeft, this.pomodoroIsRunning, this.pomodoroActiveTaskTitle)}
            </div>

            <div id="miniCalendarWidget">
              ${Components.renderMiniCalendar(this.calYear, this.calMonth, this.activeCalendarDate || todayStr, taskDatesSet)}
            </div>

            <div class="paper-card p-4 space-y-3">
              <div class="flex items-center justify-between pb-2 border-b border-[var(--border-subtle)]">
                <h3 class="font-serif font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
                  <i class="fa-regular fa-clock text-[var(--accent-amber)]"></i>
                  <span>Upcoming Due</span>
                </h3>
                <span class="text-[11px] font-mono text-[var(--text-muted)] font-bold">${stats.upcomingTasks.length}</span>
              </div>

              ${stats.upcomingTasks.length > 0 ? `
                <div class="space-y-2">
                  ${stats.upcomingTasks.map(t => Components.renderTaskCard(t)).join('')}
                </div>
              ` : `
                <p class="text-xs text-[var(--text-muted)] italic py-2 text-center">No upcoming tasks scheduled.</p>
              `}
            </div>

          </div>

        </div>

      </div>
    `;
  }

  // ================= 2. NOTES VIEW =================

  async renderNotesView(container) {
    const notes = await window.folioDB.getNotes();

    container.innerHTML = `
      <div class="space-y-4 sm:space-y-6">
        
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Notebook</div>
            <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">All Notes</h1>
          </div>

          <button type="button" onclick="window.folioApp.openNoteEditor()" class="btn-primary px-3.5 py-2 text-xs rounded-xl shadow-sm flex items-center gap-1.5">
            <i class="fa-solid fa-plus text-xs"></i>
            <span>New Note</span>
          </button>
        </div>

        ${notes.length > 0 ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            ${notes.map(n => Components.renderNoteCard(n)).join('')}
          </div>
        ` : Components.renderEmptyState("No Notes in Notebook", "Create your first note to capture ideas and checklists.", "Create Note", "window.folioApp.openNoteEditor()", "fa-book-open")}

      </div>
    `;
  }

  // ================= 3. TASKS VIEW =================

  async renderTasksView(container) {
    const tasks = await window.folioDB.getTasks();

    container.innerHTML = `
      <div class="space-y-4 sm:space-y-6">
        
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Action Items</div>
            <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">All Tasks</h1>
          </div>

          <button type="button" onclick="window.folioApp.openTaskEditor()" class="btn-primary px-3.5 py-2 text-xs rounded-xl shadow-sm flex items-center gap-1.5">
            <i class="fa-solid fa-plus text-xs"></i>
            <span>Add Task</span>
          </button>
        </div>

        ${tasks.length > 0 ? `
          <div class="space-y-2.5">
            ${tasks.map(t => Components.renderTaskCard(t)).join('')}
          </div>
        ` : Components.renderEmptyState("No Tasks Found", "Stay organized by adding your daily to-dos.", "Add New Task", "window.folioApp.openTaskEditor()", "fa-list-check")}

      </div>
    `;
  }

  // ================= 4. TODAY VIEW =================

  async renderTodayView(container) {
    const todayStr = new Date().toISOString().split('T')[0];
    const allTasks = await window.folioDB.getTasks();
    const allNotes = await window.folioDB.getNotes();

    const todayTasks = allTasks.filter(t => t.dueDate === todayStr);
    const todayNotes = allNotes.filter(n => n.updatedAt && n.updatedAt.startsWith(todayStr));

    container.innerHTML = `
      <div class="space-y-6">
        
        <div class="pb-3 border-b border-[var(--border-subtle)]">
          <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Daily Agenda</div>
          <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">Today's Focus</h1>
        </div>

        <!-- Today's Tasks -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-serif font-bold text-base text-[var(--text-primary)]">Tasks for Today (${todayTasks.length})</h2>
            <button type="button" onclick="window.folioApp.openTaskEditor(null, '${todayStr}')" class="text-xs font-bold text-[var(--accent-terracotta)] hover:underline flex items-center gap-1">
              <i class="fa-solid fa-plus text-[10px]"></i> Add Task
            </button>
          </div>

          <div class="space-y-2.5">
            ${todayTasks.length > 0 ? todayTasks.map(t => Components.renderTaskCard(t)).join('') : Components.renderEmptyState("No Tasks Today", "All clear! Add a task to stay on track.", "Schedule Task", `window.folioApp.openTaskEditor(null, '${todayStr}')`, "fa-calendar-check")}
          </div>
        </div>

        <!-- Notes Edited Today -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="font-serif font-bold text-base text-[var(--text-primary)]">Notes Modified Today (${todayNotes.length})</h2>
            <button type="button" onclick="window.folioApp.openNoteEditor()" class="text-xs font-bold text-[var(--accent-terracotta)] hover:underline flex items-center gap-1">
              <i class="fa-solid fa-plus text-[10px]"></i> New Note
            </button>
          </div>

          ${todayNotes.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              ${todayNotes.map(n => Components.renderNoteCard(n)).join('')}
            </div>
          ` : `
            <p class="text-xs text-[var(--text-muted)] italic">No notes created or edited today yet.</p>
          `}
        </div>

      </div>
    `;
  }

  // ================= 5. UPCOMING VIEW =================

  async renderUpcomingView(container) {
    const todayStr = new Date().toISOString().split('T')[0];
    const tasks = await window.folioDB.getTasks();
    const upcomingTasks = tasks.filter(t => t.dueDate && t.dueDate > todayStr && !t.completed);

    const grouped = {};
    upcomingTasks.forEach(t => {
      grouped[t.dueDate] = grouped[t.dueDate] || [];
      grouped[t.dueDate].push(t);
    });

    const dates = Object.keys(grouped).sort();

    container.innerHTML = `
      <div class="space-y-5">
        
        <div class="pb-3 border-b border-[var(--border-subtle)]">
          <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Forward Planning</div>
          <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">Upcoming Tasks</h1>
        </div>

        ${dates.length > 0 ? dates.map(dateKey => `
          <div class="space-y-2.5">
            <h3 class="font-mono text-xs uppercase font-bold text-[var(--text-secondary)] flex items-center gap-2 border-b border-[var(--border-subtle)] pb-1">
              <i class="fa-regular fa-calendar text-[var(--accent-terracotta)]"></i>
              <span>${Components.formatDate(dateKey)} (${dateKey})</span>
            </h3>
            <div class="space-y-2">
              ${grouped[dateKey].map(t => Components.renderTaskCard(t)).join('')}
            </div>
          </div>
        `).join('') : Components.renderEmptyState("No Upcoming Tasks", "You have no upcoming deadlines.", "Plan a Task", "window.folioApp.openTaskEditor()", "fa-calendar-days")}

      </div>
    `;
  }

  // ================= 6. COMPLETED VIEW =================

  async renderCompletedView(container) {
    const tasks = await window.folioDB.getTasks();
    const completedTasks = tasks.filter(t => t.completed);

    container.innerHTML = `
      <div class="space-y-5">
        
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Archive</div>
            <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">Completed Tasks</h1>
          </div>

          ${completedTasks.length > 0 ? `
            <span class="text-xs font-mono text-[var(--accent-sage)] font-bold">
              🎉 ${completedTasks.length} done
            </span>
          ` : ''}
        </div>

        ${completedTasks.length > 0 ? `
          <div class="space-y-2.5">
            ${completedTasks.map(t => Components.renderTaskCard(t)).join('')}
          </div>
        ` : Components.renderEmptyState("No Completed Tasks", "Check off tasks as you finish them to see progress here.", "View Tasks", "window.folioApp.navigate('tasks')", "fa-circle-check")}

      </div>
    `;
  }

  // ================= 7. HABITS VIEW =================

  async renderHabitsView(container) {
    const habits = await window.folioDB.getHabits();

    container.innerHTML = `
      <div class="space-y-5">
        
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Routines & Streaks</div>
            <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">Daily Habits</h1>
          </div>

          <button type="button" onclick="window.folioApp.openHabitModal()" class="btn-primary px-3.5 py-2 text-xs rounded-xl shadow-sm flex items-center gap-1.5">
            <i class="fa-solid fa-plus text-xs"></i>
            <span>New Habit</span>
          </button>
        </div>

        <div>
          ${Components.renderHabitTrackerCard(habits)}
        </div>

      </div>
    `;
  }

  // ================= 8. FOCUS / POMODORO VIEW =================

  async renderFocusView(container) {
    const tasks = await window.folioDB.getTasks();
    const pendingTasks = tasks.filter(t => !t.completed);

    container.innerHTML = `
      <div class="space-y-6 max-w-2xl mx-auto">
        
        <div class="text-center pb-3 border-b border-[var(--border-subtle)]">
          <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Deep Work Mode</div>
          <h1 class="font-serif font-bold text-2xl sm:text-3xl text-[var(--text-primary)]">Pomodoro Focus Timer</h1>
        </div>

        <div id="pomodoroViewWidget">
          ${Components.renderPomodoroWidget(this.pomodoroMode, this.pomodoroTimeLeft, this.pomodoroIsRunning, this.pomodoroActiveTaskTitle)}
        </div>

        <div class="paper-card p-4 space-y-3">
          <h3 class="font-serif font-bold text-sm text-[var(--text-primary)] flex items-center gap-2">
            <i class="fa-solid fa-link text-[var(--accent-terracotta)] text-xs"></i>
            <span>Select a Task to Focus On:</span>
          </h3>

          ${pendingTasks.length > 0 ? `
            <div class="space-y-2 max-h-60 overflow-y-auto">
              ${pendingTasks.map(t => `
                <div onclick="window.folioApp.startFocusWithTask('${t.id}')" class="p-2.5 rounded-xl border border-[var(--border-subtle)] hover:border-[var(--accent-terracotta)] bg-[var(--bg-app)] cursor-pointer flex items-center justify-between text-xs transition">
                  <span class="font-semibold text-[var(--text-primary)] truncate">${t.title}</span>
                  <span class="font-mono text-[10px] text-[var(--text-muted)] font-bold">${t.dueDate ? Components.formatDate(t.dueDate) : 'No due date'}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-xs text-[var(--text-muted)] italic">No pending tasks. You can focus freely!</p>
          `}
        </div>

      </div>
    `;
  }

  // ================= 9. SETTINGS VIEW =================

  async renderSettingsView(container) {
    const currentTheme = localStorage.getItem('folio_theme') || 'paper';
    const currentPreset = window.notificationManager.currentPreset;
    const currentVol = Math.round(window.notificationManager.volume * 100);
    const hasCustomAudio = Boolean(window.notificationManager.customAudioSrc);

    container.innerHTML = `
      <div class="space-y-6 max-w-3xl mx-auto">
        
        <div class="pb-3 border-b border-[var(--border-subtle)]">
          <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Preferences</div>
          <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">Folio Settings</h1>
        </div>

        <!-- Themes -->
        <div class="paper-card p-4 sm:p-6 space-y-3.5">
          <div>
            <h3 class="font-serif font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
              <i class="fa-solid fa-palette text-[var(--accent-terracotta)] text-sm"></i>
              <span>Notebook Theme</span>
            </h3>
            <p class="font-sans text-xs text-[var(--text-secondary)] mt-0.5">Select paper style and mood.</p>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            
            <div onclick="window.folioApp.setThemePalette('paper')" class="p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between h-20 ${currentTheme === 'paper' ? 'border-[var(--accent-terracotta)] shadow-md' : 'border-[var(--border-medium)]'}" style="background: #f7f4ed; color: #231f1d;">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold font-serif text-[#231f1d]">📜 Warm Paper</span>
                ${currentTheme === 'paper' ? '<i class="fa-solid fa-check text-xs text-orange-600"></i>' : ''}
              </div>
              <span class="text-[9px] font-mono text-[#8c8276] font-bold">Default</span>
            </div>

            <div onclick="window.folioApp.setThemePalette('sage')" class="p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between h-20 ${currentTheme === 'sage' ? 'border-green-700 shadow-md' : 'border-[var(--border-medium)]'}" style="background: #f2f6f3; color: #192a20;">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold font-serif text-[#192a20]">🌲 Sage Forest</span>
                ${currentTheme === 'sage' ? '<i class="fa-solid fa-check text-xs text-green-700"></i>' : ''}
              </div>
              <span class="text-[9px] font-mono text-[#6e8878] font-bold">Linen Green</span>
            </div>

            <div onclick="window.folioApp.setThemePalette('indigo')" class="p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between h-20 ${currentTheme === 'indigo' ? 'border-blue-700 shadow-md' : 'border-[var(--border-medium)]'}" style="background: #f2f5f9; color: #172437;">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold font-serif text-[#172437]">🌊 Nordic Indigo</span>
                ${currentTheme === 'indigo' ? '<i class="fa-solid fa-check text-xs text-blue-700"></i>' : ''}
              </div>
              <span class="text-[9px] font-mono text-[#6f829e] font-bold">Slate Blue</span>
            </div>

            <div onclick="window.folioApp.setThemePalette('sakura')" class="p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between h-20 ${currentTheme === 'sakura' ? 'border-rose-600 shadow-md' : 'border-[var(--border-medium)]'}" style="background: #fcf6f7; color: #34191d;">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold font-serif text-[#34191d]">🌸 Sakura Rose</span>
                ${currentTheme === 'sakura' ? '<i class="fa-solid fa-check text-rose-600"></i>' : ''}
              </div>
              <span class="text-[9px] font-mono text-[#9e7278] font-bold">Soft Blossom</span>
            </div>

            <div onclick="window.folioApp.setThemePalette('dark')" class="p-3 rounded-xl border-2 cursor-pointer transition flex flex-col justify-between h-20 ${currentTheme === 'dark' ? 'border-amber-400 shadow-md' : 'border-[var(--border-medium)]'}" style="background: #141210; color: #ede7dc;">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold font-serif text-[#ede7dc]">🌙 Dark Mode</span>
                ${currentTheme === 'dark' ? '<i class="fa-solid fa-check text-xs text-amber-400"></i>' : ''}
              </div>
              <span class="text-[9px] font-mono text-[#8e8372] font-bold">Midnight</span>
            </div>

          </div>
        </div>

        <!-- Sounds -->
        <div class="paper-card p-4 sm:p-6 space-y-4">
          <div>
            <h3 class="font-serif font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
              <i class="fa-solid fa-bell text-[var(--accent-amber)] text-sm"></i>
              <span>Reminder Sound & Chimes</span>
            </h3>
            <p class="font-sans text-xs text-[var(--text-secondary)] mt-0.5">Customize audio chime for task alerts.</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="block text-[11px] font-mono text-[var(--text-secondary)] uppercase font-bold">Sound Preset</label>
              <select id="soundPresetSelect" onchange="window.folioApp.changeSoundPreset(this.value)" class="w-full bg-[var(--bg-input)] border border-[var(--border-medium)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none font-semibold">
                <option value="bell" ${currentPreset === 'bell' ? 'selected' : ''}>🔔 Acoustic Bell (Harmonic)</option>
                <option value="zen" ${currentPreset === 'zen' ? 'selected' : ''}>🧘 Zen Singing Bowl (Deep)</option>
                <option value="marimba" ${currentPreset === 'marimba' ? 'selected' : ''}>🪵 Wooden Marimba (Arpeggio)</option>
                <option value="typewriter" ${currentPreset === 'typewriter' ? 'selected' : ''}>📠 Vintage Typewriter (Ding)</option>
                <option value="digital" ${currentPreset === 'digital' ? 'selected' : ''}>⚡ Modern Digital (Ping)</option>
                ${hasCustomAudio ? `<option value="custom" ${currentPreset === 'custom' ? 'selected' : ''}>🎵 Custom Uploaded Sound</option>` : ''}
              </select>
            </div>

            <div class="space-y-1">
              <label class="block text-[11px] font-mono text-[var(--text-secondary)] uppercase font-bold">Test Sound</label>
              <button type="button" onclick="window.folioApp.testCurrentSound()" class="w-full btn-secondary py-2 px-3 text-xs rounded-xl flex items-center justify-center gap-2">
                <i class="fa-solid fa-volume-high text-[var(--accent-terracotta)] text-xs"></i>
                <span>Play Sound Preview</span>
              </button>
            </div>
          </div>

          <div class="space-y-1 pt-1">
            <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-secondary)] font-bold">
              <span>Chime Volume</span>
              <span id="volumeValueLabel">${currentVol}%</span>
            </div>
            <input type="range" min="0" max="100" value="${currentVol}" oninput="window.folioApp.updateSoundVolume(this.value)" class="w-full accent-[var(--btn-primary-bg)] cursor-pointer">
          </div>

          <div class="pt-2 border-t border-[var(--border-subtle)] space-y-1.5">
            <label class="block text-[11px] font-mono text-[var(--text-secondary)] uppercase font-bold">
              Upload Custom Audio (.mp3 / .wav)
            </label>
            <div class="flex items-center gap-2 flex-wrap">
              <input type="file" id="customAudioFileInput" accept="audio/*" onchange="window.folioApp.handleCustomAudioUpload(event)" class="text-xs text-[var(--text-muted)] cursor-pointer">
              
              ${hasCustomAudio ? `
                <button type="button" onclick="window.folioApp.removeCustomAudioFile()" class="px-2.5 py-1 text-red-500 text-xs font-bold hover:underline">
                  Remove Custom
                </button>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Security -->
        <div class="paper-card p-4 sm:p-6 space-y-3">
          <div>
            <h3 class="font-serif font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
              <i class="fa-solid fa-shield-halved text-[var(--accent-indigo)] text-sm"></i>
              <span>Private Vault Security</span>
            </h3>
            <p class="font-sans text-xs text-[var(--text-secondary)] mt-0.5">Protect secret personal notes with a 4-digit PIN.</p>
          </div>

          <button type="button" onclick="window.folioApp.openSetPinModal()" class="btn-secondary px-4 py-2 text-xs rounded-xl flex items-center gap-2">
            <i class="fa-solid fa-key text-xs"></i>
            <span>Set / Change 4-Digit PIN</span>
          </button>
        </div>

        <!-- Backup -->
        <div class="paper-card p-4 sm:p-6 space-y-3">
          <div>
            <h3 class="font-serif font-bold text-base text-[var(--text-primary)] flex items-center gap-2">
              <i class="fa-solid fa-database text-[var(--accent-sage)] text-sm"></i>
              <span>Backup & Data Management</span>
            </h3>
            <p class="font-sans text-xs text-[var(--text-secondary)] mt-0.5">Export or restore your offline notebook data.</p>
          </div>

          <div class="flex items-center gap-2.5 flex-wrap">
            <button type="button" onclick="window.folioApp.exportFullBackup()" class="btn-primary px-4 py-2 text-xs rounded-xl shadow-sm flex items-center gap-2">
              <i class="fa-solid fa-download text-xs"></i>
              <span>Export Backup (JSON)</span>
            </button>

            <label class="btn-secondary px-4 py-2 text-xs rounded-xl cursor-pointer flex items-center gap-2">
              <i class="fa-solid fa-upload text-xs"></i>
              <span>Restore Backup</span>
              <input type="file" accept=".json" onchange="window.folioApp.importBackupFile(event)" class="hidden">
            </label>
          </div>
        </div>

      </div>
    `;
  }

  // ================= THEMES & SOUND CONTROLLERS =================

  setThemePalette(themeName) {
    this.setTheme(themeName);
    this.showToast(`Theme changed to ${themeName}`);
    this.renderCurrentView();
  }

  changeSoundPreset(preset) {
    window.notificationManager.setSoundPreset(preset);
    window.notificationManager.playChime(preset);
    this.showToast(`Sound preset updated`);
  }

  testCurrentSound() {
    window.notificationManager.playChime();
  }

  updateSoundVolume(val) {
    const numeric = parseInt(val, 10) / 100;
    window.notificationManager.setVolume(numeric);
    const label = document.getElementById('volumeValueLabel');
    if (label) label.textContent = `${val}%`;
  }

  handleCustomAudioUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Audio file must be under 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target.result;
      window.notificationManager.setCustomAudio(base64Data);
      window.notificationManager.playChime('custom');
      this.showToast('Custom audio sound uploaded and active! 🎵');
      this.renderCurrentView();
    };
    reader.readAsDataURL(file);
  }

  removeCustomAudioFile() {
    window.notificationManager.removeCustomAudio();
    this.showToast('Custom audio removed. Reset to default bell.');
    this.renderCurrentView();
  }

  // ================= BACKUP & RESTORE =================

  async exportFullBackup() {
    const data = await window.folioDB.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `folio-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    this.showToast('Backup JSON file downloaded');
  }

  importBackupFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const res = await window.folioDB.importData(json);
        window.notificationManager.syncAlarmsToServiceWorker();
        this.showToast(`Restored ${res.notesCount} notes and ${res.tasksCount} tasks!`);
        this.renderCurrentView();
      } catch (err) {
        alert('Invalid backup JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  // ================= 10. TRASH VIEW =================

  async renderTrashView(container) {
    const trashItems = await window.folioDB.getTrashItems();

    container.innerHTML = `
      <div class="space-y-4">
        
        <div class="flex items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div class="text-xs font-mono uppercase tracking-widest text-red-500 mb-0.5 font-bold">Recycle Bin</div>
            <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)]">Trash</h1>
          </div>

          ${trashItems.length > 0 ? `
            <button type="button" onclick="window.folioApp.confirmEmptyTrash()" class="px-3.5 py-2 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900 text-xs font-bold rounded-xl transition flex items-center gap-1.5">
              <i class="fa-solid fa-trash-can text-xs"></i>
              <span>Empty Trash</span>
            </button>
          ` : ''}
        </div>

        ${trashItems.length > 0 ? `
          <div class="space-y-2.5">
            ${trashItems.map(item => `
              <div class="paper-card p-3.5 flex items-center justify-between gap-3 bg-[var(--bg-card)]">
                <div>
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[var(--bg-app)] border border-[var(--border-subtle)] text-[var(--text-muted)] font-bold">
                      ${item.type}
                    </span>
                    <h4 class="font-serif font-bold text-sm text-[var(--text-primary)]">${item.title || 'Untitled'}</h4>
                  </div>
                  <div class="text-[10px] text-[var(--text-muted)] font-mono">Deleted on ${new Date(item.deletedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>

                <div class="flex items-center gap-1.5">
                  <button type="button" onclick="window.folioApp.restoreTrashItem('${item.id}')" class="btn-secondary px-3 py-1.5 text-xs rounded-lg flex items-center gap-1">
                    <i class="fa-solid fa-rotate-left text-[10px]"></i>
                    <span>Restore</span>
                  </button>
                  <button type="button" onclick="window.folioApp.permanentDeleteTrashItem('${item.id}')" class="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition" title="Delete permanently">
                    <i class="fa-solid fa-xmark text-sm"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : Components.renderEmptyState("Trash is Empty", "Items moved to trash will appear here.", null, null, "fa-trash-can")}

      </div>
    `;
  }

  // ================= 11. TAG FILTERED VIEW =================

  async renderTagFilteredView(container, tag) {
    const allNotes = await window.folioDB.getNotes();
    const filteredNotes = allNotes.filter(n => Array.isArray(n.tags) && n.tags.includes(tag.toLowerCase()));

    container.innerHTML = `
      <div class="space-y-4">
        
        <div class="pb-3 border-b border-[var(--border-subtle)]">
          <div class="text-xs font-mono uppercase tracking-widest text-[var(--text-muted)] mb-0.5 font-bold">Tag Filter</div>
          <h1 class="font-serif font-bold text-xl sm:text-2xl text-[var(--text-primary)] flex items-center gap-2">
            <i class="fa-solid fa-tag text-[var(--accent-terracotta)] text-base"></i>
            <span>#${tag}</span>
            <span class="text-xs font-mono text-[var(--text-muted)] font-normal">(${filteredNotes.length} notes)</span>
          </h1>
        </div>

        ${filteredNotes.length > 0 ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            ${filteredNotes.map(n => Components.renderNoteCard(n)).join('')}
          </div>
        ` : Components.renderEmptyState(`No notes tagged #${tag}`, "No notes currently have this tag.", "View All Notes", "window.folioApp.navigate('notes')", "fa-tags")}

      </div>
    `;
  }

  filterByTag(tag) {
    this.navigate('tag', decodeURIComponent(tag));
  }

  // ================= POMODORO TIMER ENGINE =================

  setPomodoroMode(mode) {
    this.pomodoroMode = mode;
    this.pausePomodoro();

    if (mode === 'focus') this.pomodoroTimeLeft = 1500;
    else if (mode === 'short') this.pomodoroTimeLeft = 300;
    else if (mode === 'long') this.pomodoroTimeLeft = 900;

    this.renderPomodoroUI();
  }

  togglePomodoro() {
    if (this.pomodoroIsRunning) {
      this.pausePomodoro();
    } else {
      this.startPomodoro();
    }
  }

  startPomodoro() {
    if (this.pomodoroIsRunning) return;
    this.pomodoroIsRunning = true;

    this.pomodoroInterval = setInterval(() => {
      this.pomodoroTimeLeft--;
      if (this.pomodoroTimeLeft <= 0) {
        this.completePomodoroSession();
      } else {
        this.renderPomodoroUI();
      }
    }, 1000);

    this.renderPomodoroUI();
  }

  pausePomodoro() {
    this.pomodoroIsRunning = false;
    if (this.pomodoroInterval) {
      clearInterval(this.pomodoroInterval);
      this.pomodoroInterval = null;
    }
    this.renderPomodoroUI();
  }

  resetPomodoro() {
    this.pausePomodoro();
    this.setPomodoroMode(this.pomodoroMode);
  }

  completePomodoroSession() {
    this.pausePomodoro();
    window.notificationManager.playChime();

    const title = this.pomodoroMode === 'focus' ? 'Focus Session Completed! ☕' : 'Break Finished! 🚀';
    const message = this.pomodoroMode === 'focus' ? 'Great work! Take a well-deserved break.' : 'Ready to resume focus?';

    this.showToast(`${title} ${message}`);

    if (window.notificationManager.hasPermission()) {
      new Notification(title, { body: message, icon: './icons/icon.svg' });
    }

    if (this.pomodoroMode === 'focus') {
      this.setPomodoroMode('short');
    } else {
      this.setPomodoroMode('focus');
    }
  }

  async startFocusWithTask(taskId) {
    const task = await window.folioDB.getTaskById(taskId);
    if (!task) return;

    this.pomodoroActiveTaskId = taskId;
    this.pomodoroActiveTaskTitle = task.title;
    this.setPomodoroMode('focus');
    this.startPomodoro();
    this.showToast(`Focus session started for "${task.title}"`);
    this.navigate('focus');
  }

  renderPomodoroUI() {
    const html = Components.renderPomodoroWidget(this.pomodoroMode, this.pomodoroTimeLeft, this.pomodoroIsRunning, this.pomodoroActiveTaskTitle);
    const widgetEl = document.getElementById('pomodoroWidgetContainer');
    if (widgetEl) widgetEl.innerHTML = html;

    const viewWidgetEl = document.getElementById('pomodoroViewWidget');
    if (viewWidgetEl) viewWidgetEl.innerHTML = html;
  }

  // ================= HABITS ACTIONS =================

  openHabitModal() {
    document.getElementById('habitModal').classList.remove('hidden');
    document.getElementById('habitTitleInput').value = '';
    document.getElementById('habitEmojiInput').value = '🎯';
    document.getElementById('habitTitleInput').focus();
  }

  closeHabitModal() {
    document.getElementById('habitModal').classList.add('hidden');
  }

  async saveHabitFromModal(e) {
    if (e) e.preventDefault();
    const title = document.getElementById('habitTitleInput').value.trim();
    if (!title) return;

    const emoji = document.getElementById('habitEmojiInput').value.trim() || '🎯';
    await window.folioDB.saveHabit({ title, emoji, history: {} });
    this.closeHabitModal();
    this.showToast('Habit added! Build your streak 🔥');
    this.renderCurrentView();
  }

  async toggleHabitDay(habitId, dateStr) {
    await window.folioDB.toggleHabitDay(habitId, dateStr);
    window.notificationManager.playChime();
    this.renderCurrentView();
  }

  async deleteHabit(habitId) {
    if (confirm('Delete this habit tracker?')) {
      await window.folioDB.deleteHabit(habitId);
      this.showToast('Habit removed');
      this.renderCurrentView();
    }
  }

  // ================= PIN LOCK & SECRET VAULT =================

  async promptUnlockNote(noteId) {
    const hasPin = await window.folioDB.hasVaultPin();
    if (!hasPin) {
      this.openSetPinModal(noteId);
      return;
    }

    this.pendingUnlockNoteId = noteId;
    document.getElementById('pinVerifyModal').classList.remove('hidden');
    document.getElementById('vaultPinInput').value = '';
    document.getElementById('vaultPinInput').focus();
  }

  closePinVerifyModal() {
    document.getElementById('pinVerifyModal').classList.add('hidden');
    this.pendingUnlockNoteId = null;
  }

  async verifyPinSubmission(e) {
    if (e) e.preventDefault();
    const enteredPin = document.getElementById('vaultPinInput').value.trim();
    const isValid = await window.folioDB.verifyVaultPin(enteredPin);

    if (isValid) {
      this.isVaultUnlocked = true;
      this.closePinVerifyModal();
      this.showToast('Vault unlocked! 🔓');

      if (this.pendingUnlockNoteId) {
        this.openNoteEditor(this.pendingUnlockNoteId);
      } else {
        this.renderCurrentView();
      }
    } else {
      this.showToast('Incorrect PIN. Please try again.', 'warning');
      document.getElementById('vaultPinInput').value = '';
      document.getElementById('vaultPinInput').focus();
    }
  }

  openSetPinModal(targetNoteId = null) {
    this.pendingUnlockNoteId = targetNoteId;
    document.getElementById('setPinModal').classList.remove('hidden');
    document.getElementById('newPinInput').value = '';
    document.getElementById('newPinInput').focus();
  }

  closeSetPinModal() {
    document.getElementById('setPinModal').classList.add('hidden');
  }

  async saveNewVaultPin(e) {
    if (e) e.preventDefault();
    const newPin = document.getElementById('newPinInput').value.trim();
    if (newPin.length < 4) {
      alert('Please enter at least 4 digits for your security PIN');
      return;
    }

    await window.folioDB.setVaultPin(newPin);
    this.isVaultUnlocked = true;
    this.closeSetPinModal();
    this.showToast('Security PIN set & vault unlocked! 🔐');

    if (this.pendingUnlockNoteId) {
      this.openNoteEditor(this.pendingUnlockNoteId);
    }
  }

  toggleNoteLockInEditor() {
    const lockBtn = document.getElementById('noteLockToggleBtn');
    const isCurrentlyLocked = lockBtn.getAttribute('data-locked') === 'true';
    const newLockState = !isCurrentlyLocked;

    lockBtn.setAttribute('data-locked', newLockState ? 'true' : 'false');
    lockBtn.innerHTML = `<i class="fa-${newLockState ? 'solid text-[var(--accent-amber)]' : 'solid'} fa-lock mr-1"></i> <span>${newLockState ? 'Locked' : 'Lock'}</span>`;
    this.handleNoteInput();
    this.showToast(newLockState ? 'Note locked in Private Vault 🔒' : 'Note unlocked 🔓');
  }

  // ================= 1-CLICK PDF & MARKDOWN EXPORT =================

  exportCurrentNoteAsPDF() {
    const title = document.getElementById('noteTitleInput').value.trim() || 'Untitled Note';
    const content = document.getElementById('noteContentInput').value;
    const tags = document.getElementById('noteTagsInput').value;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${title} — Folio Export</title>
        <style>
          body { font-family: 'Georgia', serif; padding: 40px; color: #1e293b; line-height: 1.8; max-width: 700px; margin: auto; }
          h1 { font-size: 28px; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 6px; }
          .meta { font-family: sans-serif; font-size: 11px; color: #64748b; margin-bottom: 24px; text-transform: uppercase; letter-spacing: 0.5px; }
          .content { font-size: 14px; white-space: pre-wrap; word-break: break-word; }
          .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; font-family: sans-serif; color: #94a3b8; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="meta">Exported from Folio • ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} ${tags ? '• Tags: #' + tags : ''}</div>
        <div class="content">${content}</div>
        <div class="footer">Folio — Paper Notes & Daily Tasks • folio-notes-tasks.surge.sh</div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  exportCurrentNoteAsMarkdown() {
    const title = document.getElementById('noteTitleInput').value.trim() || 'Untitled';
    const content = document.getElementById('noteContentInput').value;
    const tags = document.getElementById('noteTagsInput').value;

    const mdContent = `# ${title}\n\n*Created in Folio on ${new Date().toISOString().split('T')[0]}*\n${tags ? '*Tags: #' + tags + '*\n\n' : '\n'}---\n\n${content}`;
    const blob = new Blob([mdContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.md`;
    a.click();
    this.showToast('Downloaded Markdown (.md) file');
  }

  // ================= NOTE EDITOR MODAL & AUTOSAVE =================

  async openNoteEditor(noteId = null) {
    this.editingNoteId = noteId;
    let note = { title: '', content: '', tags: [], pinned: false, locked: false };

    if (noteId) {
      const existing = await window.folioDB.getNoteById(noteId);
      if (existing) {
        if (existing.locked && !this.isVaultUnlocked) {
          this.promptUnlockNote(noteId);
          return;
        }
        note = existing;
      }
    }

    document.getElementById('noteEditorModal').classList.remove('hidden');
    document.getElementById('noteTitleInput').value = note.title || '';
    document.getElementById('noteContentInput').value = note.content || '';
    document.getElementById('noteTagsInput').value = (note.tags || []).join(', ');
    
    const pinBtn = document.getElementById('notePinToggleBtn');
    pinBtn.setAttribute('data-pinned', note.pinned ? 'true' : 'false');
    pinBtn.innerHTML = `<i class="fa-${note.pinned ? 'solid text-[var(--accent-terracotta)]' : 'regular'} fa-thumbtack mr-1"></i> <span>${note.pinned ? 'Pinned' : 'Pin'}</span>`;

    const lockBtn = document.getElementById('noteLockToggleBtn');
    lockBtn.setAttribute('data-locked', note.locked ? 'true' : 'false');
    lockBtn.innerHTML = `<i class="fa-${note.locked ? 'solid text-[var(--accent-amber)]' : 'solid'} fa-lock mr-1"></i> <span>${note.locked ? 'Locked' : 'Lock'}</span>`;

    document.getElementById('noteSavedStatus').textContent = noteId ? 'Saved' : 'New Note';

    setTimeout(() => {
      if (!noteId) document.getElementById('noteTitleInput').focus();
      else document.getElementById('noteContentInput').focus();
    }, 100);
  }

  closeNoteEditor() {
    this.saveNoteImmediately();
    document.getElementById('noteEditorModal').classList.add('hidden');
    this.editingNoteId = null;
    this.renderCurrentView();
  }

  handleNoteInput() {
    document.getElementById('noteSavedStatus').textContent = 'Editing...';
    if (this.noteAutosaveTimer) clearTimeout(this.noteAutosaveTimer);
    this.noteAutosaveTimer = setTimeout(() => {
      this.saveNoteImmediately();
    }, 600);
  }

  async saveNoteImmediately() {
    const title = document.getElementById('noteTitleInput').value.trim();
    const content = document.getElementById('noteContentInput').value;
    const rawTags = document.getElementById('noteTagsInput').value;
    const isPinned = document.getElementById('notePinToggleBtn').getAttribute('data-pinned') === 'true';
    const isLocked = document.getElementById('noteLockToggleBtn').getAttribute('data-locked') === 'true';

    if (!title && !content.trim() && !this.editingNoteId) return;

    const tags = rawTags.split(',').map(t => t.trim().replace(/^#/, '').toLowerCase()).filter(Boolean);

    const noteToSave = {
      id: this.editingNoteId || undefined,
      title: title || (content ? content.slice(0, 30).split('\n')[0] : 'Untitled Note'),
      content: content,
      tags: tags,
      pinned: isPinned,
      locked: isLocked
    };

    const saved = await window.folioDB.saveNote(noteToSave);
    this.editingNoteId = saved.id;
    document.getElementById('noteSavedStatus').textContent = 'Saved';
  }

  toggleNotePinInEditor() {
    const pinBtn = document.getElementById('notePinToggleBtn');
    const isCurrentlyPinned = pinBtn.getAttribute('data-pinned') === 'true';
    const newPinnedState = !isCurrentlyPinned;

    pinBtn.setAttribute('data-pinned', newPinnedState ? 'true' : 'false');
    pinBtn.innerHTML = `<i class="fa-${newPinnedState ? 'solid text-[var(--accent-terracotta)]' : 'regular'} fa-thumbtack mr-1"></i> <span>${newPinnedState ? 'Pinned' : 'Pin'}</span>`;
    this.handleNoteInput();
  }

  insertNoteFormatting(prefix, suffix = '') {
    const textarea = document.getElementById('noteContentInput');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);

    const replacement = prefix + selected + suffix;
    textarea.value = text.substring(0, start) + replacement + text.substring(end);
    textarea.focus();
    textarea.selectionStart = start + prefix.length;
    textarea.selectionEnd = end + prefix.length;
    this.handleNoteInput();
  }

  insertChecklist() {
    this.insertNoteFormatting('[ ] ');
  }

  // ================= TASK EDITOR MODAL =================

  async openTaskEditor(taskId = null, defaultDueDate = null) {
    this.editingTaskId = taskId;
    let task = {
      title: '',
      description: '',
      priority: 'medium',
      dueDate: defaultDueDate || new Date().toISOString().split('T')[0],
      dueTime: '10:00',
      reminderTime: '0'
    };

    if (taskId) {
      const existing = await window.folioDB.getTaskById(taskId);
      if (existing) task = existing;
    }

    document.getElementById('taskEditorModal').classList.remove('hidden');
    document.getElementById('taskTitleInput').value = task.title || '';
    document.getElementById('taskDescInput').value = task.description || '';
    document.getElementById('taskPrioritySelect').value = task.priority || 'medium';
    document.getElementById('taskDueDateInput').value = task.dueDate || '';
    document.getElementById('taskDueTimeInput').value = task.dueTime || '';
    document.getElementById('taskReminderSelect').value = task.reminderTime || '0';

    setTimeout(() => {
      document.getElementById('taskTitleInput').focus();
    }, 100);
  }

  closeTaskEditor() {
    document.getElementById('taskEditorModal').classList.add('hidden');
    this.editingTaskId = null;
  }

  async saveTaskFromModal(e) {
    if (e) e.preventDefault();

    const title = document.getElementById('taskTitleInput').value.trim();
    if (!title) return;

    const description = document.getElementById('taskDescInput').value.trim();
    const priority = document.getElementById('taskPrioritySelect').value;
    const dueDate = document.getElementById('taskDueDateInput').value || null;
    const dueTime = document.getElementById('taskDueTimeInput').value || null;
    const reminderTime = document.getElementById('taskReminderSelect').value;

    let existingTask = null;
    if (this.editingTaskId) {
      existingTask = await window.folioDB.getTaskById(this.editingTaskId);
    }

    const taskObj = {
      id: this.editingTaskId || undefined,
      title,
      description,
      priority,
      dueDate,
      dueTime,
      reminderTime,
      reminderFired: false,
      completed: existingTask ? existingTask.completed : false
    };

    await window.folioDB.saveTask(taskObj);
    window.notificationManager.syncAlarmsToServiceWorker();

    if (reminderTime !== 'none' && window.notificationManager.permission === 'default') {
      window.notificationManager.requestPermission();
    }

    this.closeTaskEditor();
    this.showToast(this.editingTaskId ? 'Task updated' : 'Task created successfully');
    this.renderCurrentView();
  }

  // ================= TASK & NOTE ACTIONS =================

  async toggleTaskComplete(taskId) {
    const updated = await window.folioDB.toggleTaskComplete(taskId);
    window.notificationManager.syncAlarmsToServiceWorker();
    if (updated && updated.completed) {
      window.notificationManager.playChime();
      this.showToast('Task completed! 🎉');
    }
    this.renderCurrentView();
  }

  async togglePinNote(noteId) {
    await window.folioDB.togglePinNote(noteId);
    this.renderCurrentView();
  }

  async deleteNote(noteId) {
    await window.folioDB.deleteNote(noteId, true);
    this.showToast('Note moved to trash', 'info', async () => {
      await window.folioDB.restoreItem(noteId);
      this.renderCurrentView();
    });
    this.renderCurrentView();
  }

  async deleteTask(taskId) {
    await window.folioDB.deleteTask(taskId, true);
    window.notificationManager.syncAlarmsToServiceWorker();
    this.showToast('Task moved to trash', 'info', async () => {
      await window.folioDB.restoreItem(taskId);
      this.renderCurrentView();
    });
    this.renderCurrentView();
  }

  async restoreTrashItem(id) {
    await window.folioDB.restoreItem(id);
    window.notificationManager.syncAlarmsToServiceWorker();
    this.showToast('Item restored');
    this.renderCurrentView();
  }

  async permanentDeleteTrashItem(id) {
    if (confirm('Permanently delete this item? This action cannot be undone.')) {
      await window.folioDB.permanentDeleteItem(id);
      window.notificationManager.syncAlarmsToServiceWorker();
      this.showToast('Item permanently deleted');
      this.renderCurrentView();
    }
  }

  async confirmEmptyTrash() {
    if (confirm('Are you sure you want to empty the trash? All deleted items will be permanently erased.')) {
      await window.folioDB.emptyTrash();
      window.notificationManager.syncAlarmsToServiceWorker();
      this.showToast('Trash emptied');
      this.renderCurrentView();
    }
  }

  // ================= CALENDAR INTERACTIONS =================

  changeCalendarMonth(delta) {
    this.calMonth += delta;
    if (this.calMonth < 0) {
      this.calMonth = 11;
      this.calYear -= 1;
    } else if (this.calMonth > 11) {
      this.calMonth = 0;
      this.calYear += 1;
    }
    this.renderCurrentView();
  }

  selectCalendarDate(dateStr) {
    this.activeCalendarDate = dateStr;
    this.openTaskEditor(null, dateStr);
  }

  // ================= GLOBAL SEARCH & FILTER =================

  openSearchPalette() {
    const modal = document.getElementById('searchModal');
    modal.classList.remove('hidden');
    const input = document.getElementById('globalSearchInput');
    input.value = '';
    input.focus();
    this.performSearch('');
  }

  closeSearchPalette() {
    document.getElementById('searchModal').classList.add('hidden');
  }

  setSearchFilter(filterType) {
    this.searchFilter = filterType;
    document.querySelectorAll('.search-filter-btn').forEach(btn => {
      if (btn.getAttribute('data-filter') === filterType) {
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-secondary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    });
    this.performSearch(document.getElementById('globalSearchInput').value);
  }

  async performSearch(query) {
    const q = (query || '').trim().toLowerCase();
    const resultsContainer = document.getElementById('searchResultsContainer');
    if (!resultsContainer) return;

    const allNotes = await window.folioDB.getNotes();
    const allTasks = await window.folioDB.getTasks();

    let matchedNotes = [];
    let matchedTasks = [];

    if (!q) {
      matchedNotes = allNotes.slice(0, 6);
      matchedTasks = allTasks.filter(t => !t.completed).slice(0, 6);
    } else {
      matchedNotes = allNotes.filter(n => 
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (Array.isArray(n.tags) && n.tags.some(t => t.includes(q)))
      );

      matchedTasks = allTasks.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.dueDate && t.dueDate.includes(q))
      );
    }

    let html = '';

    if (this.searchFilter === 'all' || this.searchFilter === 'notes') {
      if (matchedNotes.length > 0) {
        html += `
          <div class="mb-3">
            <div class="text-[11px] font-mono uppercase font-bold text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
              <i class="fa-solid fa-book-open text-[var(--accent-leather)]"></i>
              <span>Notes (${matchedNotes.length})</span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              ${matchedNotes.map(n => `
                <div class="paper-card p-3 cursor-pointer hover:border-[var(--accent-terracotta)]" onclick="window.folioApp.closeSearchPalette(); window.folioApp.openNoteEditor('${n.id}')">
                  <div class="font-serif font-bold text-sm text-[var(--text-primary)] line-clamp-1">${n.title || 'Untitled'}</div>
                  <div class="text-xs text-[var(--text-secondary)] line-clamp-2 mt-0.5">${Components.stripFormatting(n.content) || 'Empty'}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    if (this.searchFilter === 'all' || this.searchFilter === 'tasks' || this.searchFilter === 'pending' || this.searchFilter === 'completed') {
      let filteredTasks = matchedTasks;
      if (this.searchFilter === 'pending') filteredTasks = matchedTasks.filter(t => !t.completed);
      if (this.searchFilter === 'completed') filteredTasks = matchedTasks.filter(t => t.completed);

      if (filteredTasks.length > 0) {
        html += `
          <div>
            <div class="text-[11px] font-mono uppercase font-bold text-[var(--text-muted)] mb-1.5 flex items-center gap-1.5">
              <i class="fa-solid fa-check-circle text-[var(--accent-sage)]"></i>
              <span>Tasks (${filteredTasks.length})</span>
            </div>
            <div class="space-y-2">
              ${filteredTasks.map(t => Components.renderTaskCard(t)).join('')}
            </div>
          </div>
        `;
      }
    }

    if (!html) {
      html = `<div class="text-center py-6 text-xs text-[var(--text-muted)] italic font-mono">No matching notes or tasks found for "${q}"</div>`;
    }

    resultsContainer.innerHTML = html;
  }

  // ================= TOAST NOTIFICATIONS =================

  showToast(message, type = 'info', undoAction = null) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toastId = 'toast_' + Date.now();
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'paper-card p-3.5 shadow-lg border-[var(--border-strong)] bg-[var(--bg-card)] flex items-center justify-between gap-3 text-xs text-[var(--text-primary)] transform translate-y-2 opacity-0 transition-all duration-200 w-full max-w-sm';

    toast.innerHTML = `
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-circle-check text-[var(--accent-sage)] text-sm"></i>
        <span class="font-semibold">${message}</span>
      </div>
      ${undoAction ? `
        <button type="button" class="text-[var(--accent-terracotta)] font-bold hover:underline ml-2 uppercase font-mono text-[10px]" id="${toastId}_undo">
          Undo
        </button>
      ` : ''}
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    if (undoAction) {
      document.getElementById(`${toastId}_undo`).addEventListener('click', () => {
        undoAction();
        toast.remove();
      });
    }

    setTimeout(() => {
      toast.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  showReminderToast(task) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'paper-card p-4 shadow-xl border-2 border-[var(--accent-amber)] bg-[var(--bg-card)] text-xs text-[var(--text-primary)] space-y-2 w-full max-w-sm';

    toast.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-bell text-[var(--accent-amber)] text-sm animate-bounce"></i>
          <span class="font-serif font-bold text-sm">Task Reminder</span>
        </div>
        <button type="button" onclick="this.closest('.paper-card').remove()" class="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <p class="font-sans text-xs text-[var(--text-secondary)] font-semibold">${task.title}</p>
      <div class="flex items-center gap-2 pt-1">
        <button type="button" onclick="window.folioApp.toggleTaskComplete('${task.id}'); this.closest('.paper-card').remove()" class="btn-primary px-2.5 py-1 text-[11px] rounded-lg">
          ✓ Done
        </button>
        <button type="button" onclick="window.notificationManager.snoozeTask('${task.id}', 10); this.closest('.paper-card').remove()" class="btn-secondary px-2.5 py-1 text-[11px] rounded-lg">
          Snooze 10m
        </button>
      </div>
    `;

    container.appendChild(toast);
  }

  // ================= THEME TOGGLE =================

  toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'paper';
    const next = current === 'dark' ? 'paper' : 'dark';
    this.setTheme(next);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('folio_theme', theme);
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      themeBtn.innerHTML = theme === 'dark' ? 
        `<i class="fa-solid fa-sun text-xs text-[var(--accent-amber)]"></i>` : 
        `<i class="fa-regular fa-moon text-xs"></i>`;
    }
  }

  // ================= SIDEBAR COUNTERS & TAGS =================

  async renderSidebarCounters() {
    const stats = await window.folioDB.getDashboardStats();
    const allNotes = await window.folioDB.getNotes();
    const trash = await window.folioDB.getTrashItems();

    const setCounter = (id, count) => {
      const el = document.getElementById(id);
      if (el) el.textContent = count > 0 ? count : '';
    };

    setCounter('sidebarCountAllNotes', allNotes.length);
    setCounter('sidebarCountTasks', stats.allPendingTasks.length);
    setCounter('sidebarCountToday', stats.todayTasks.length);
    setCounter('sidebarCountUpcoming', stats.upcomingTasks.length);
    setCounter('sidebarCountCompleted', stats.completedCount);
    setCounter('sidebarCountHabits', stats.totalHabits);
    setCounter('sidebarCountTrash', trash.length);
  }

  async renderSidebarTags() {
    const tags = await window.folioDB.getAllTags();
    const container = document.getElementById('sidebarTagsList');
    if (!container) return;

    if (tags.length === 0) {
      container.innerHTML = `<span class="text-[11px] text-[var(--text-muted)] italic px-3">No tags yet</span>`;
      return;
    }

    container.innerHTML = tags.map(tag => `
      <a href="javascript:void(0)" onclick="window.folioApp.filterByTag('${encodeURIComponent(tag)}')" class="tag-badge flex items-center justify-between text-xs py-1 px-2.5 rounded-lg hover:bg-[var(--border-subtle)] text-[var(--text-secondary)]">
        <span class="truncate">#${tag}</span>
      </a>
    `).join('');
  }

  // ================= NOTIFICATION UI =================

  updateNotificationPermissionUI() {
    const banner = document.getElementById('notificationPermissionBanner');
    if (!banner) return;

    if (window.notificationManager.permission === 'default') {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  async enableNotifications() {
    const res = await window.notificationManager.requestPermission();
    this.updateNotificationPermissionUI();
    if (res === 'granted') {
      this.showToast('Reminders & notifications enabled!');
      window.notificationManager.playChime();
    } else {
      this.showToast('Notification permission denied', 'warning');
    }
  }

  // ================= PWA REGISTRATION =================

  registerPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('[Folio PWA] Service worker registered:', reg.scope);
          window.notificationManager.syncAlarmsToServiceWorker();
        }).catch((err) => {
          console.warn('[Folio PWA] SW registration failed:', err);
        });
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPromptEvent = e;
      const installBtn = document.getElementById('pwaInstallBtn');
      if (installBtn) installBtn.classList.remove('hidden');
    });
  }

  async promptPWAInstall() {
    if (this.installPromptEvent) {
      this.installPromptEvent.prompt();
      const { outcome } = await this.installPromptEvent.userChoice;
      console.log('[Folio PWA] User install choice:', outcome);
      this.installPromptEvent = null;
      document.getElementById('pwaInstallBtn')?.classList.add('hidden');
    }
  }

  // ================= SHORTCUTS =================

  setupGlobalShortcuts() {
    window.addEventListener('keydown', (e) => {
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      const isContentEditable = document.activeElement?.isContentEditable;

      if (e.key === 'Escape') {
        this.closeNoteEditor();
        this.closeTaskEditor();
        this.closeSearchPalette();
        this.closeHabitModal();
        this.closePinVerifyModal();
        this.closeSetPinModal();
        this.closeQuickActionSheet();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!document.getElementById('noteEditorModal').classList.contains('hidden')) {
          this.closeNoteEditor();
        } else if (!document.getElementById('taskEditorModal').classList.contains('hidden')) {
          this.saveTaskFromModal();
        }
        return;
      }

      if (!isInput && !isContentEditable) {
        if (e.key === '/') {
          e.preventDefault();
          this.openSearchPalette();
        } else if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          this.openNoteEditor();
        } else if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          this.openTaskEditor();
        }
      }
    });
  }

  getGreeting(hour) {
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}

// Global App Instance & Boot
window.folioApp = new FolioApp();

window.showToast = (msg, type, undo) => window.folioApp.showToast(msg, type, undo);
window.showReminderToast = (task) => window.folioApp.showReminderToast(task);

document.addEventListener('DOMContentLoaded', () => {
  window.folioApp.init();
});
