/**
 * =========================================================
 * FOLIO — UI COMPONENTS & RENDERERS (V6)
 * Pure CSS High Contrast Classes (No Tailwind JIT dependency)
 * =========================================================
 */

const Components = {
  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    if (dateStr.startsWith(todayStr)) return 'Today';
    if (dateStr.startsWith(yesterdayStr)) return 'Yesterday';
    if (dateStr.startsWith(tomorrowStr)) return 'Tomorrow';

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  },

  formatTime(timeStr) {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    if (isNaN(hour)) return timeStr;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  },

  isOverdue(dueDate, dueTime) {
    if (!dueDate) return false;
    const timeStr = dueTime || '23:59';
    const due = new Date(`${dueDate}T${timeStr}:00`).getTime();
    return !isNaN(due) && due < Date.now();
  },

  stripFormatting(text) {
    if (!text) return '';
    return text
      .replace(/<[^>]*>/g, '')
      .replace(/#+\s?/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/\[ \]|\[x\]/gi, '•')
      .trim();
  },

  // ================= NOTE CARD COMPONENT =================

  renderNoteCard(note) {
    const isLocked = Boolean(note.locked);
    const isUnlockedSession = window.folioApp && window.folioApp.isVaultUnlocked;

    const title = note.title || 'Untitled Note';
    const plainContent = Components.stripFormatting(note.content || '');
    const dateFormatted = Components.formatDate(note.updatedAt);
    const timeFormatted = new Date(note.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    if (isLocked && !isUnlockedSession) {
      return `
        <div class="paper-card p-4 sm:p-5 cursor-pointer flex flex-col justify-between group border-amber-500/40 bg-[var(--bg-card)] ${note.pinned ? 'is-pinned' : ''}" 
             onclick="window.folioApp.promptUnlockNote('${note.id}')"
             data-id="${note.id}">
          
          <div>
            <div class="flex items-start justify-between gap-2 mb-2.5">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[var(--accent-amber)] flex items-center justify-center text-xs">
                  <i class="fa-solid fa-lock"></i>
                </span>
                <h3 class="font-serif font-bold text-sm sm:text-base text-[var(--text-primary)]">Locked Secret Note</h3>
              </div>
              
              <button type="button" 
                      onclick="event.stopPropagation(); window.folioApp.deleteNote('${note.id}')" 
                      class="p-1 rounded text-[var(--text-muted)] hover:text-red-500 transition"
                      title="Move to trash">
                <i class="fa-regular fa-trash-can text-xs"></i>
              </button>
            </div>

            <p class="font-sans text-xs text-[var(--text-muted)] italic leading-relaxed mb-3">
              🔒 This note is protected in your Private Vault. Tap to enter PIN.
            </p>
          </div>

          <div class="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
            <span class="text-[var(--accent-amber)] font-bold">● Protected</span>
            <span>${dateFormatted}</span>
          </div>

        </div>
      `;
    }

    const tagsHtml = (note.tags || []).map(tag => `
      <span class="tag-badge" onclick="event.stopPropagation(); window.folioApp.filterByTag('${encodeURIComponent(tag)}')">
        <i class="fa-solid fa-tag text-[9px] opacity-60"></i>
        <span>#${tag}</span>
      </span>
    `).join('');

    return `
      <div class="paper-card p-4 sm:p-5 cursor-pointer flex flex-col justify-between group ${note.pinned ? 'is-pinned' : ''}" 
           onclick="window.folioApp.openNoteEditor('${note.id}')"
           data-id="${note.id}">
        
        <div>
          <div class="flex items-start justify-between gap-2 mb-1.5">
            <div class="flex items-center gap-1.5 flex-1 min-w-0">
              ${isLocked ? `<i class="fa-solid fa-lock text-[11px] text-[var(--accent-amber)]" title="Locked note"></i>` : ''}
              <h3 class="font-serif font-bold text-sm sm:text-base text-[var(--text-primary)] group-hover:text-[var(--accent-terracotta)] transition-colors line-clamp-1">
                ${title}
              </h3>
            </div>
            
            <div class="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              <button type="button" 
                      onclick="event.stopPropagation(); window.folioApp.togglePinNote('${note.id}')" 
                      class="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] transition"
                      title="${note.pinned ? 'Unpin note' : 'Pin note'}">
                <i class="fa-${note.pinned ? 'solid text-[var(--accent-terracotta)]' : 'regular'} fa-thumbtack text-xs"></i>
              </button>
              
              <button type="button" 
                      onclick="event.stopPropagation(); window.folioApp.deleteNote('${note.id}')" 
                      class="p-1 rounded text-[var(--text-muted)] hover:text-red-500 transition"
                      title="Move to trash">
                <i class="fa-regular fa-trash-can text-xs"></i>
              </button>
            </div>
          </div>

          <p class="font-sans text-xs text-[var(--text-secondary)] line-clamp-3 leading-relaxed mb-3">
            ${plainContent || '<span class="italic text-[var(--text-faint)]">Empty paper note...</span>'}
          </p>
        </div>

        <div class="pt-2.5 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2 flex-wrap text-[11px] font-mono text-[var(--text-muted)]">
          <div class="flex items-center gap-1 flex-wrap">
            ${tagsHtml}
          </div>
          <span title="Last updated">${dateFormatted}, ${timeFormatted}</span>
        </div>

      </div>
    `;
  },

  // ================= TASK CARD COMPONENT =================

  renderTaskCard(task) {
    const isCompleted = Boolean(task.completed);
    const dueDateFormatted = Components.formatDate(task.dueDate);
    const dueTimeFormatted = Components.formatTime(task.dueTime);
    const isOverdue = !isCompleted && Components.isOverdue(task.dueDate, task.dueTime);

    let priorityBadge = '';
    if (task.priority === 'high') {
      priorityBadge = `<span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-[var(--priority-high-bg)] border-[var(--priority-high-border)] text-[var(--priority-high-text)]">High</span>`;
    } else if (task.priority === 'medium') {
      priorityBadge = `<span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-[var(--priority-med-bg)] border-[var(--priority-med-border)] text-[var(--priority-med-text)]">Medium</span>`;
    } else if (task.priority === 'low') {
      priorityBadge = `<span class="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border bg-[var(--priority-low-bg)] border-[var(--priority-low-border)] text-[var(--priority-low-text)]">Low</span>`;
    }

    const hasReminder = task.reminderTime && task.reminderTime !== 'none';

    return `
      <div class="paper-card p-3.5 sm:p-4 flex items-start justify-between gap-3 group transition ${isCompleted ? 'task-completed opacity-65 bg-[var(--bg-app)]' : ''}" 
           data-id="${task.id}">
        
        <div class="flex items-start gap-3 flex-1 min-w-0">
          <input type="checkbox" 
                 class="custom-checkbox mt-0.5" 
                 ${isCompleted ? 'checked' : ''} 
                 onchange="window.folioApp.toggleTaskComplete('${task.id}')"
                 title="Mark as ${isCompleted ? 'pending' : 'completed'}">

          <div class="flex-1 min-w-0 cursor-pointer" onclick="window.folioApp.openTaskEditor('${task.id}')">
            <div class="flex items-center gap-2 flex-wrap mb-0.5">
              <h4 class="task-title font-sans font-semibold text-xs sm:text-sm text-[var(--text-primary)] group-hover:text-[var(--text-accent)] transition">
                ${task.title || 'Untitled Task'}
              </h4>
              ${priorityBadge}
              ${hasReminder ? `<i class="fa-solid fa-bell text-[10px] text-[var(--accent-amber)]" title="Reminder set"></i>` : ''}
            </div>

            ${task.description ? `
              <p class="font-sans text-xs text-[var(--text-secondary)] line-clamp-2 mb-1.5 leading-relaxed">
                ${task.description}
              </p>
            ` : ''}

            <div class="flex items-center gap-3 text-[11px] font-mono text-[var(--text-muted)] flex-wrap">
              ${task.dueDate ? `
                <span class="flex items-center gap-1 ${isOverdue ? 'text-red-500 font-bold' : ''}">
                  <i class="fa-regular fa-calendar text-[10px]"></i>
                  <span>${dueDateFormatted}${dueTimeFormatted ? ' at ' + dueTimeFormatted : ''}</span>
                  ${isOverdue ? '<span>(Overdue)</span>' : ''}
                </span>
              ` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1">
          <button type="button" 
                  onclick="event.stopPropagation(); window.folioApp.startFocusWithTask('${task.id}')"
                  class="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--accent-terracotta)] transition"
                  title="Focus on this task with Pomodoro">
            <i class="fa-solid fa-stopwatch text-xs"></i>
          </button>

          <button type="button" 
                  onclick="window.folioApp.openTaskEditor('${task.id}')" 
                  class="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
                  title="Edit task">
            <i class="fa-solid fa-pen text-xs"></i>
          </button>

          <button type="button" 
                  onclick="window.folioApp.deleteTask('${task.id}')" 
                  class="p-1.5 rounded text-[var(--text-muted)] hover:text-red-500 transition"
                  title="Delete task">
            <i class="fa-regular fa-trash-can text-xs"></i>
          </button>
        </div>

      </div>
    `;
  },

  // ================= 7-DAY HABIT TRACKER MATRIX =================

  renderHabitTrackerCard(habits) {
    const today = new Date();
    const last7Days = [];
    const dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      last7Days.push({
        dateStr,
        dayName: dayNames[d.getDay()],
        dayNum: d.getDate(),
        isToday: i === 0
      });
    }

    return `
      <div class="paper-card p-4 sm:p-5 space-y-3.5">
        <div class="flex items-center justify-between pb-2.5 border-b border-[var(--border-subtle)]">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-fire text-[var(--accent-terracotta)] text-base"></i>
            <h3 class="font-serif font-bold text-sm sm:text-base text-[var(--text-primary)]">Daily Habits & Streaks</h3>
          </div>
          <button type="button" onclick="window.folioApp.openHabitModal()" class="btn-secondary px-2.5 py-1 rounded-xl text-xs flex items-center gap-1.5">
            <i class="fa-solid fa-plus text-[10px]"></i>
            <span>New Habit</span>
          </button>
        </div>

        ${habits.length > 0 ? `
          <div class="space-y-2.5 overflow-x-auto">
            <!-- Day Column Headers -->
            <div class="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] px-1 min-w-[280px]">
              <span class="w-28 sm:w-36 truncate font-bold">Habit</span>
              <div class="flex items-center gap-1.5 sm:gap-3">
                ${last7Days.map(d => `
                  <div class="w-6 sm:w-7 text-center ${d.isToday ? 'font-bold text-[var(--accent-terracotta)]' : ''}">
                    <div>${d.dayName}</div>
                    <div class="text-[9px] opacity-70">${d.dayNum}</div>
                  </div>
                `).join('')}
              </div>
              <span class="w-12 sm:w-14 text-right font-bold">Streak</span>
            </div>

            <!-- Habit Rows -->
            ${habits.map(habit => {
              const streak = window.folioDB.calculateHabitStreak(habit);
              return `
                <div class="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 group min-w-[280px]">
                  
                  <div class="w-28 sm:w-36 flex items-center gap-1.5 min-w-0">
                    <span class="text-sm sm:text-base">${habit.emoji || '🎯'}</span>
                    <span class="font-sans font-semibold text-xs text-[var(--text-primary)] truncate" title="${habit.title}">
                      ${habit.title}
                    </span>
                  </div>

                  <div class="flex items-center gap-1.5 sm:gap-3">
                    ${last7Days.map(d => {
                      const isDone = Boolean(habit.history && habit.history[d.dateStr]);
                      return `
                        <button type="button" 
                                onclick="window.folioApp.toggleHabitDay('${habit.id}', '${d.dateStr}')"
                                class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition ${isDone ? 'bg-[var(--accent-sage)] text-white shadow-sm' : 'bg-[var(--bg-card)] border border-[var(--border-medium)] text-transparent hover:border-[var(--accent-sage)]'}"
                                title="${d.dateStr}: ${isDone ? 'Completed' : 'Click to complete'}">
                          <i class="fa-solid fa-check text-[9px] sm:text-[10px]"></i>
                        </button>
                      `;
                    }).join('')}
                  </div>

                  <div class="w-12 sm:w-14 text-right flex items-center justify-end gap-1">
                    <span class="font-mono text-xs font-bold text-[var(--accent-terracotta)]">🔥 ${streak}d</span>
                    <button type="button" onclick="window.folioApp.deleteHabit('${habit.id}')" class="p-1 text-[var(--text-muted)] hover:text-red-500 transition">
                      <i class="fa-regular fa-trash-can text-[10px]"></i>
                    </button>
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="text-center py-5 text-xs text-[var(--text-muted)] italic">
            No habits yet. Tap + New Habit to start tracking daily streaks!
          </div>
        `}
      </div>
    `;
  },

  // ================= POMODORO FOCUS TIMER WIDGET =================

  renderPomodoroWidget(mode = 'focus', timeLeft = 1500, isRunning = false, activeTaskTitle = '') {
    const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
    const seconds = String(timeLeft % 60).padStart(2, '0');

    return `
      <div class="paper-card p-5 sm:p-6 text-center space-y-4">
        <div class="flex items-center justify-between pb-2.5 border-b border-[var(--border-subtle)]">
          <div class="flex items-center gap-2">
            <i class="fa-solid fa-stopwatch text-[var(--accent-terracotta)] text-base"></i>
            <h3 class="font-serif font-bold text-sm sm:text-base text-[var(--text-primary)]">Focus Timer</h3>
          </div>
          <span class="text-xs font-mono text-[var(--text-muted)] font-bold">25m / 5m</span>
        </div>

        <!-- Mode Tabs -->
        <div class="flex items-center justify-center gap-1.5 p-1 rounded-xl bg-[var(--bg-app)] border border-[var(--border-subtle)] max-w-xs mx-auto">
          <button type="button" onclick="window.folioApp.setPomodoroMode('focus')" class="flex-1 py-1.5 rounded-lg text-xs transition ${mode === 'focus' ? 'pomo-tab-active' : 'pomo-tab-inactive'}">
            Focus
          </button>
          <button type="button" onclick="window.folioApp.setPomodoroMode('short')" class="flex-1 py-1.5 rounded-lg text-xs transition ${mode === 'short' ? 'pomo-tab-active' : 'pomo-tab-inactive'}">
            Short
          </button>
          <button type="button" onclick="window.folioApp.setPomodoroMode('long')" class="flex-1 py-1.5 rounded-lg text-xs transition ${mode === 'long' ? 'pomo-tab-active' : 'pomo-tab-inactive'}">
            Long
          </button>
        </div>

        <!-- Timer Display -->
        <div class="py-1">
          <div class="font-mono font-bold text-4xl sm:text-6xl text-[var(--text-primary)] tracking-tight">
            ${minutes}:${seconds}
          </div>
          ${activeTaskTitle ? `
            <div class="mt-2 text-xs font-sans text-[var(--accent-terracotta)] font-bold flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-thumbtack text-[10px]"></i>
              <span class="truncate max-w-xs">${activeTaskTitle}</span>
            </div>
          ` : `
            <div class="mt-1.5 text-xs text-[var(--text-muted)] italic">
              ${isRunning ? '⚡ Stay focused...' : 'Hit Start to begin'}
            </div>
          `}
        </div>

        <!-- Controls -->
        <div class="flex items-center justify-center gap-2.5">
          <button type="button" 
                  onclick="window.folioApp.togglePomodoro()" 
                  class="btn-primary px-5 py-2 text-xs rounded-xl shadow flex items-center gap-2">
            <i class="fa-solid fa-${isRunning ? 'pause' : 'play'} text-xs"></i>
            <span>${isRunning ? 'Pause' : 'Start Focus'}</span>
          </button>

          <button type="button" 
                  onclick="window.folioApp.resetPomodoro()" 
                  class="btn-secondary p-2 rounded-xl"
                  title="Reset Timer">
            <i class="fa-solid fa-rotate-left text-xs"></i>
          </button>
        </div>

      </div>
    `;
  },

  // ================= MINI CALENDAR COMPONENT =================

  renderMiniCalendar(currentYear, currentMonth, activeDateStr, datesWithTasksSet) {
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let daysHtml = '';

    for (let i = 0; i < firstDayIndex; i++) {
      daysHtml += `<div class="p-1.5 text-center text-xs opacity-0 pointer-events-none">.</div>`;
    }

    for (let d = 1; d <= totalDays; d++) {
      const monthPadded = String(currentMonth + 1).padStart(2, '0');
      const dayPadded = String(d).padStart(2, '0');
      const dateStr = `${currentYear}-${monthPadded}-${dayPadded}`;

      const isToday = dateStr === todayStr;
      const isSelected = dateStr === activeDateStr;
      const hasTasks = datesWithTasksSet.has(dateStr);

      let cellClass = "cal-cell ";
      if (isToday) {
        cellClass += "cal-cell-today";
      } else if (isSelected) {
        cellClass += "cal-cell-selected";
      } else {
        cellClass += "cal-cell-normal";
      }

      daysHtml += `
        <div class="${cellClass}" onclick="window.folioApp.selectCalendarDate('${dateStr}')">
          <span>${d}</span>
          ${hasTasks && !isToday && !isSelected ? '<span class="cal-task-dot"></span>' : ''}
        </div>
      `;
    }

    return `
      <div class="paper-card p-4">
        <div class="flex items-center justify-between mb-2.5">
          <h4 class="font-serif font-bold text-sm text-[var(--text-primary)]">
            ${monthNames[currentMonth]} ${currentYear}
          </h4>
          <div class="flex items-center gap-1 text-xs">
            <button type="button" onclick="window.folioApp.changeCalendarMonth(-1)" class="p-1 rounded-lg hover:bg-[var(--bg-app)] text-[var(--text-secondary)]">
              <i class="fa-solid fa-chevron-left text-[10px]"></i>
            </button>
            <button type="button" onclick="window.folioApp.changeCalendarMonth(1)" class="p-1 rounded-lg hover:bg-[var(--bg-app)] text-[var(--text-secondary)]">
              <i class="fa-solid fa-chevron-right text-[10px]"></i>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1 text-[10px] font-mono text-[var(--text-muted)] text-center mb-1 font-bold">
          <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
        </div>

        <div class="grid grid-cols-7 gap-1">
          ${daysHtml}
        </div>
      </div>
    `;
  },

  // ================= EMPTY STATE COMPONENT =================

  renderEmptyState(title, subtitle, buttonText, buttonAction, iconClass = 'fa-book-open') {
    return `
      <div class="paper-card p-8 sm:p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto my-6 border-dashed">
        <div class="w-12 h-12 rounded-2xl bg-[var(--bg-app)] border border-[var(--border-medium)] flex items-center justify-center text-[var(--accent-terracotta)] text-xl mb-3 shadow-inner">
          <i class="fa-solid ${iconClass}"></i>
        </div>
        <h3 class="font-serif font-bold text-base sm:text-lg text-[var(--text-primary)] mb-1">${title}</h3>
        <p class="font-sans text-xs text-[var(--text-secondary)] max-w-xs mb-4 leading-relaxed">
          ${subtitle}
        </p>
        ${buttonText ? `
          <button type="button" onclick="${buttonAction}" class="btn-primary px-4 py-2 text-xs rounded-xl shadow-sm flex items-center gap-1.5">
            <i class="fa-solid fa-plus text-xs"></i>
            <span>${buttonText}</span>
          </button>
        ` : ''}
      </div>
    `;
  }
};

window.Components = Components;
