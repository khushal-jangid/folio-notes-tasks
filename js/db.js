/**
 * =========================================================
 * FOLIO — LOCAL-FIRST INDEXEDDB STORAGE ENGINE (V2)
 * Supports Notes, Tasks, Habits, PIN Vault, Pomodoro Stats
 * =========================================================
 */

class FolioDB {
  constructor() {
    this.dbName = 'FolioDB';
    this.version = 2;
    this.db = null;
    this.isReady = false;
    this.useLocalStorageFallback = false;
  }

  async init() {
    if (this.isReady && this.db) return this;

    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('[FolioDB] IndexedDB not supported. Using LocalStorage fallback.');
        this.useLocalStorageFallback = true;
        this.isReady = true;
        resolve(this);
        return;
      }

      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Notes Store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('pinned', 'pinned', { unique: false });
          notesStore.createIndex('tags', 'tags', { multiEntry: true, unique: false });
          notesStore.createIndex('locked', 'locked', { unique: false });
        }

        // 2. Tasks Store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('dueDate', 'dueDate', { unique: false });
          tasksStore.createIndex('completed', 'completed', { unique: false });
          tasksStore.createIndex('priority', 'priority', { unique: false });
          tasksStore.createIndex('reminderTime', 'reminderTime', { unique: false });
          tasksStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 3. Habits Store
        if (!db.objectStoreNames.contains('habits')) {
          const habitsStore = db.createObjectStore('habits', { keyPath: 'id' });
          habitsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // 4. Trash Store (for soft delete & recovery)
        if (!db.objectStoreNames.contains('trash')) {
          const trashStore = db.createObjectStore('trash', { keyPath: 'id' });
          trashStore.createIndex('deletedAt', 'deletedAt', { unique: false });
          trashStore.createIndex('type', 'type', { unique: false });
        }

        // 5. Settings Store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        this.isReady = true;
        console.log('[FolioDB v2] IndexedDB initialized successfully.');
        resolve(this);
      };

      request.onerror = (event) => {
        console.warn('[FolioDB] IndexedDB open error, falling back to LocalStorage:', event.target.error);
        this.useLocalStorageFallback = true;
        this.isReady = true;
        resolve(this);
      };
    });
  }

  // Helper to generate UUID-like unique IDs
  generateId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  // ================= NOTE OPERATIONS =================

  async getNotes() {
    await this.init();
    if (this.useLocalStorageFallback) {
      const notes = JSON.parse(localStorage.getItem('folio_notes') || '[]');
      return notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.getAll();

      request.onsuccess = () => {
        const notes = request.result || [];
        notes.sort((a, b) => {
          if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        });
        resolve(notes);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getNoteById(id) {
    await this.init();
    if (this.useLocalStorageFallback) {
      const notes = JSON.parse(localStorage.getItem('folio_notes') || '[]');
      return notes.find(n => n.id === id) || null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('notes', 'readonly');
      const store = tx.objectStore('notes');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveNote(note) {
    await this.init();
    const now = new Date().toISOString();

    const noteRecord = {
      id: note.id || this.generateId('note'),
      title: (note.title || '').trim(),
      content: note.content || '',
      tags: Array.isArray(note.tags) ? note.tags.map(t => t.trim().toLowerCase()).filter(Boolean) : [],
      pinned: Boolean(note.pinned),
      locked: Boolean(note.locked), // Private Vault PIN protection
      createdAt: note.createdAt || now,
      updatedAt: now
    };

    if (this.useLocalStorageFallback) {
      let notes = JSON.parse(localStorage.getItem('folio_notes') || '[]');
      const index = notes.findIndex(n => n.id === noteRecord.id);
      if (index >= 0) notes[index] = noteRecord;
      else notes.push(noteRecord);
      localStorage.setItem('folio_notes', JSON.stringify(notes));
      return noteRecord;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.put(noteRecord);
      request.onsuccess = () => resolve(noteRecord);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteNote(id, soft = true) {
    await this.init();
    const note = await this.getNoteById(id);
    if (!note) return false;

    if (soft) {
      const trashItem = { ...note, type: 'note', deletedAt: new Date().toISOString() };
      await this._addToTrash(trashItem);
    }

    if (this.useLocalStorageFallback) {
      let notes = JSON.parse(localStorage.getItem('folio_notes') || '[]');
      notes = notes.filter(n => n.id !== id);
      localStorage.setItem('folio_notes', JSON.stringify(notes));
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('notes', 'readwrite');
      const store = tx.objectStore('notes');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async togglePinNote(id) {
    const note = await this.getNoteById(id);
    if (!note) return null;
    note.pinned = !note.pinned;
    return await this.saveNote(note);
  }

  async toggleLockNote(id) {
    const note = await this.getNoteById(id);
    if (!note) return null;
    note.locked = !note.locked;
    return await this.saveNote(note);
  }

  // ================= TASK OPERATIONS =================

  async getTasks() {
    await this.init();
    if (this.useLocalStorageFallback) {
      const tasks = JSON.parse(localStorage.getItem('folio_tasks') || '[]');
      return tasks.sort((a, b) => new Date(a.dueDate || '9999') - new Date(b.dueDate || '9999'));
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const request = store.getAll();

      request.onsuccess = () => {
        const tasks = request.result || [];
        tasks.sort((a, b) => {
          if (a.completed !== b.completed) return a.completed ? 1 : -1;
          if (a.dueDate && b.dueDate) {
            const dateCmp = a.dueDate.localeCompare(b.dueDate);
            if (dateCmp !== 0) return dateCmp;
            return (a.dueTime || '').localeCompare(b.dueTime || '');
          }
          if (a.dueDate) return -1;
          if (b.dueDate) return 1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        resolve(tasks);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getTaskById(id) {
    await this.init();
    if (this.useLocalStorageFallback) {
      const tasks = JSON.parse(localStorage.getItem('folio_tasks') || '[]');
      return tasks.find(t => t.id === id) || null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readonly');
      const store = tx.objectStore('tasks');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveTask(task) {
    await this.init();
    const now = new Date().toISOString();

    const taskRecord = {
      id: task.id || this.generateId('task'),
      title: (task.title || '').trim(),
      description: task.description || '',
      completed: Boolean(task.completed),
      completedAt: task.completed ? (task.completedAt || now) : null,
      priority: task.priority || 'medium', // 'low', 'medium', 'high'
      dueDate: task.dueDate || null,      // 'YYYY-MM-DD'
      dueTime: task.dueTime || null,      // 'HH:mm'
      reminderTime: task.reminderTime || null,
      reminderFired: Boolean(task.reminderFired),
      tags: Array.isArray(task.tags) ? task.tags : [],
      createdAt: task.createdAt || now,
      updatedAt: now
    };

    if (this.useLocalStorageFallback) {
      let tasks = JSON.parse(localStorage.getItem('folio_tasks') || '[]');
      const index = tasks.findIndex(t => t.id === taskRecord.id);
      if (index >= 0) tasks[index] = taskRecord;
      else tasks.push(taskRecord);
      localStorage.setItem('folio_tasks', JSON.stringify(tasks));
      return taskRecord;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.put(taskRecord);
      request.onsuccess = () => resolve(taskRecord);
      request.onerror = () => reject(request.error);
    });
  }

  async toggleTaskComplete(id) {
    const task = await this.getTaskById(id);
    if (!task) return null;
    task.completed = !task.completed;
    task.completedAt = task.completed ? new Date().toISOString() : null;
    return await this.saveTask(task);
  }

  async deleteTask(id, soft = true) {
    await this.init();
    const task = await this.getTaskById(id);
    if (!task) return false;

    if (soft) {
      const trashItem = { ...task, type: 'task', deletedAt: new Date().toISOString() };
      await this._addToTrash(trashItem);
    }

    if (this.useLocalStorageFallback) {
      let tasks = JSON.parse(localStorage.getItem('folio_tasks') || '[]');
      tasks = tasks.filter(t => t.id !== id);
      localStorage.setItem('folio_tasks', JSON.stringify(tasks));
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('tasks', 'readwrite');
      const store = tx.objectStore('tasks');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ================= HABIT TRACKER OPERATIONS =================

  async getHabits() {
    await this.init();
    if (this.useLocalStorageFallback) {
      return JSON.parse(localStorage.getItem('folio_habits') || '[]');
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('habits', 'readonly');
      const store = tx.objectStore('habits');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveHabit(habit) {
    await this.init();
    const habitRecord = {
      id: habit.id || this.generateId('habit'),
      title: habit.title.trim(),
      emoji: habit.emoji || '🎯',
      color: habit.color || 'sage',
      history: habit.history || {}, // format: { "2026-08-24": true }
      createdAt: habit.createdAt || new Date().toISOString()
    };

    if (this.useLocalStorageFallback) {
      let habits = JSON.parse(localStorage.getItem('folio_habits') || '[]');
      const index = habits.findIndex(h => h.id === habitRecord.id);
      if (index >= 0) habits[index] = habitRecord;
      else habits.push(habitRecord);
      localStorage.setItem('folio_habits', JSON.stringify(habits));
      return habitRecord;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('habits', 'readwrite');
      const store = tx.objectStore('habits');
      const request = store.put(habitRecord);
      request.onsuccess = () => resolve(habitRecord);
      request.onerror = () => reject(request.error);
    });
  }

  async toggleHabitDay(id, dateStr) {
    await this.init();
    let habit = null;

    if (this.useLocalStorageFallback) {
      const habits = JSON.parse(localStorage.getItem('folio_habits') || '[]');
      habit = habits.find(h => h.id === id);
    } else {
      const tx = this.db.transaction('habits', 'readonly');
      const store = tx.objectStore('habits');
      const req = store.get(id);
      habit = await new Promise((res) => { req.onsuccess = () => res(req.result); });
    }

    if (!habit) return null;

    habit.history = habit.history || {};
    if (habit.history[dateStr]) {
      delete habit.history[dateStr];
    } else {
      habit.history[dateStr] = true;
    }

    return await this.saveHabit(habit);
  }

  async deleteHabit(id) {
    await this.init();
    if (this.useLocalStorageFallback) {
      let habits = JSON.parse(localStorage.getItem('folio_habits') || '[]');
      habits = habits.filter(h => h.id !== id);
      localStorage.setItem('folio_habits', JSON.stringify(habits));
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('habits', 'readwrite');
      const store = tx.objectStore('habits');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // Calculate consecutive active streak for a habit
  calculateHabitStreak(habit) {
    if (!habit || !habit.history) return 0;
    let streak = 0;
    const today = new Date();
    
    // Check today, then count backwards day by day
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      if (habit.history[dateStr]) {
        streak++;
      } else {
        // If today is not checked yet, allow yesterday's streak to continue
        if (i === 0) continue;
        break;
      }
    }
    return streak;
  }

  // ================= SECRET VAULT / PIN OPERATIONS =================

  async getSetting(key) {
    await this.init();
    if (this.useLocalStorageFallback) {
      return localStorage.getItem(`folio_setting_${key}`);
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ? request.result.value : null);
      request.onerror = () => resolve(null);
    });
  }

  async saveSetting(key, value) {
    await this.init();
    if (this.useLocalStorageFallback) {
      localStorage.setItem(`folio_setting_${key}`, value);
      return value;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ key, value });
      request.onsuccess = () => resolve(value);
      request.onerror = () => reject(request.error);
    });
  }

  async setVaultPin(pin) {
    const hash = await this._hashPin(pin);
    await this.saveSetting('vault_pin_hash', hash);
    return true;
  }

  async hasVaultPin() {
    const hash = await this.getSetting('vault_pin_hash');
    return Boolean(hash);
  }

  async verifyVaultPin(pin) {
    const storedHash = await this.getSetting('vault_pin_hash');
    if (!storedHash) return false;
    const testHash = await this._hashPin(pin);
    return storedHash === testHash;
  }

  async _hashPin(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`folio_salt_${pin}`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // ================= TRASH & RESTORE OPERATIONS =================

  async _addToTrash(item) {
    if (this.useLocalStorageFallback) {
      const trash = JSON.parse(localStorage.getItem('folio_trash') || '[]');
      trash.push(item);
      localStorage.setItem('folio_trash', JSON.stringify(trash));
      return item;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trash', 'readwrite');
      const store = tx.objectStore('trash');
      const request = store.put(item);
      request.onsuccess = () => resolve(item);
      request.onerror = () => reject(request.error);
    });
  }

  async getTrashItems() {
    await this.init();
    if (this.useLocalStorageFallback) {
      const trash = JSON.parse(localStorage.getItem('folio_trash') || '[]');
      return trash.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trash', 'readonly');
      const store = tx.objectStore('trash');
      const request = store.getAll();
      request.onsuccess = () => {
        const items = request.result || [];
        items.sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async restoreItem(id) {
    await this.init();
    let item = null;

    if (this.useLocalStorageFallback) {
      let trash = JSON.parse(localStorage.getItem('folio_trash') || '[]');
      item = trash.find(t => t.id === id);
      if (!item) return false;
      trash = trash.filter(t => t.id !== id);
      localStorage.setItem('folio_trash', JSON.stringify(trash));
    } else {
      const tx = this.db.transaction('trash', 'readwrite');
      const store = tx.objectStore('trash');
      const getReq = store.get(id);
      item = await new Promise((res) => {
        getReq.onsuccess = () => res(getReq.result);
      });
      if (!item) return false;
      store.delete(id);
    }

    const { type, deletedAt, ...restoredData } = item;
    if (type === 'note') {
      await this.saveNote(restoredData);
    } else if (type === 'task') {
      await this.saveTask(restoredData);
    }
    return true;
  }

  async permanentDeleteItem(id) {
    await this.init();
    if (this.useLocalStorageFallback) {
      let trash = JSON.parse(localStorage.getItem('folio_trash') || '[]');
      trash = trash.filter(t => t.id !== id);
      localStorage.setItem('folio_trash', JSON.stringify(trash));
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trash', 'readwrite');
      const store = tx.objectStore('trash');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async emptyTrash() {
    await this.init();
    if (this.useLocalStorageFallback) {
      localStorage.setItem('folio_trash', '[]');
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('trash', 'readwrite');
      const store = tx.objectStore('trash');
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // ================= TAGS & AGGREGATIONS =================

  async getAllTags() {
    const notes = await this.getNotes();
    const tagsSet = new Set();
    notes.forEach(note => {
      if (Array.isArray(note.tags)) {
        note.tags.forEach(t => tagsSet.add(t.toLowerCase().trim()));
      }
    });
    return Array.from(tagsSet).sort();
  }

  // ================= STATS FOR DASHBOARD =================

  async getDashboardStats() {
    const notes = await this.getNotes();
    const tasks = await this.getTasks();
    const habits = await this.getHabits();

    const todayStr = new Date().toISOString().split('T')[0];

    const todayTasks = tasks.filter(t => t.dueDate === todayStr);
    const completedTasks = tasks.filter(t => t.completed);
    const pendingTasks = tasks.filter(t => !t.completed);
    const upcomingTasks = tasks.filter(t => t.dueDate && t.dueDate > todayStr && !t.completed);
    const todayNotes = notes.filter(n => n.updatedAt && n.updatedAt.startsWith(todayStr));

    // Calculate habits completed today
    const habitsDoneToday = habits.filter(h => h.history && h.history[todayStr]).length;

    return {
      totalNotes: notes.length,
      todayNotesCount: todayNotes.length,
      recentNotes: notes.slice(0, 4),
      todayTasks,
      upcomingTasks: upcomingTasks.slice(0, 5),
      completedCount: completedTasks.length,
      pendingCount: pendingTasks.length,
      allPendingTasks: pendingTasks,
      totalHabits: habits.length,
      habitsDoneToday,
      habits
    };
  }

  // ================= BACKUP & EXPORT/IMPORT =================

  async exportData() {
    const notes = await this.getNotes();
    const tasks = await this.getTasks();
    const habits = await this.getHabits();
    const trash = await this.getTrashItems();

    return {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      app: 'Folio Notes & Tasks',
      data: { notes, tasks, habits, trash }
    };
  }

  async importData(backupObj) {
    if (!backupObj || !backupObj.data) throw new Error('Invalid backup format');
    const { notes = [], tasks = [], habits = [] } = backupObj.data;

    for (const note of notes) {
      await this.saveNote(note);
    }
    for (const task of tasks) {
      await this.saveTask(task);
    }
    for (const habit of habits) {
      await this.saveHabit(habit);
    }
    return { notesCount: notes.length, tasksCount: tasks.length, habitsCount: habits.length };
  }
}

// Global DB Singleton
window.folioDB = new FolioDB();
