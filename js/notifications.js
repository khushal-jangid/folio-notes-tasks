/**
 * =========================================================
 * FOLIO — NOTIFICATION & SOUND MANAGER (V6)
 * Real Background Notifications, Dedicated Web Worker Tick,
 * Service Worker Alarm Sync & Synthesizer Presets
 * =========================================================
 */

class NotificationManager {
  constructor() {
    this.checkInterval = null;
    this.audioCtx = null;
    this.permission = 'default';
    this.currentPreset = 'bell'; // 'bell', 'zen', 'marimba', 'typewriter', 'digital', 'custom'
    this.customAudioSrc = null;
    this.volume = 0.8;
    this.bgWorker = null;
  }

  async init() {
    if ('Notification' in window) {
      this.permission = Notification.permission;
    }

    // Load saved sound preferences
    const savedPreset = localStorage.getItem('folio_sound_preset') || 'bell';
    const savedCustom = localStorage.getItem('folio_custom_audio');
    const savedVol = localStorage.getItem('folio_sound_volume');

    this.currentPreset = savedPreset;
    this.customAudioSrc = savedCustom || null;
    this.volume = savedVol !== null ? parseFloat(savedVol) : 0.8;

    this.startBackgroundWorker();
    this.startScheduler();
    this.setupServiceWorkerBridge();

    console.log('[NotificationManager v6] Background worker & scheduler active.');
  }

  // ================= BACKGROUND WEB WORKER TICK ENGINE =================
  // Web Workers run in a separate OS thread and are NOT throttled like main UI tabs
  startBackgroundWorker() {
    try {
      const workerCode = `
        let timer = null;
        self.onmessage = function(e) {
          if (e.data === 'START') {
            if (timer) clearInterval(timer);
            timer = setInterval(() => {
              self.postMessage('TICK');
            }, 5000); // 5s precise background tick
          } else if (e.data === 'STOP') {
            if (timer) clearInterval(timer);
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      this.bgWorker = new Worker(workerUrl);

      this.bgWorker.onmessage = (e) => {
        if (e.data === 'TICK') {
          this.checkReminders();
        }
      };

      this.bgWorker.postMessage('START');
    } catch (err) {
      console.warn('[NotificationManager] Web worker fallback to setInterval:', err);
    }
  }

  setupServiceWorkerBridge() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (!event.data) return;

        if (event.data.type === 'NOTIFICATION_FIRED') {
          const taskId = event.data.taskId;
          if (taskId && window.folioDB) {
            const task = await window.folioDB.getTaskById(taskId);
            if (task) {
              task.reminderFired = true;
              await window.folioDB.saveTask(task);
            }
          }
          if (window.folioApp && window.folioApp.renderCurrentView) {
            window.folioApp.renderCurrentView();
          }
        } else if (event.data.type === 'COMPLETE_TASK_FROM_SW') {
          const taskId = event.data.taskId;
          if (taskId && window.folioApp) {
            window.folioApp.toggleTaskComplete(taskId);
          }
        }
      });
    }
  }

  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('[NotificationManager] Notifications not supported.');
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      this.permission = result;
      if (result === 'granted') {
        this.syncAlarmsToServiceWorker();
      }
      return result;
    } catch (err) {
      console.warn('[NotificationManager] Permission error:', err);
      return 'denied';
    }
  }

  hasPermission() {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // ================= SOUND PRESETS & SYNTHESIS =================

  setSoundPreset(preset) {
    this.currentPreset = preset;
    localStorage.setItem('folio_sound_preset', preset);
  }

  setCustomAudio(base64Data) {
    this.customAudioSrc = base64Data;
    this.currentPreset = 'custom';
    localStorage.setItem('folio_custom_audio', base64Data);
    localStorage.setItem('folio_sound_preset', 'custom');
  }

  removeCustomAudio() {
    this.customAudioSrc = null;
    this.currentPreset = 'bell';
    localStorage.removeItem('folio_custom_audio');
    localStorage.setItem('folio_sound_preset', 'bell');
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, parseFloat(vol) || 0.8));
    localStorage.setItem('folio_sound_volume', this.volume);
  }

  // Main Audio Playback Router
  playChime(presetOverride = null) {
    const preset = presetOverride || this.currentPreset;

    if (preset === 'custom' && this.customAudioSrc) {
      try {
        const audio = new Audio(this.customAudioSrc);
        audio.volume = this.volume;
        audio.play().catch(e => console.warn('Custom audio playback blocked:', e));
        return;
      } catch (e) {
        console.warn('Fallback to synth bell:', e);
      }
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const masterGain = this.audioCtx.createGain();
      masterGain.gain.setValueAtTime(this.volume, now);
      masterGain.connect(this.audioCtx.destination);

      switch (preset) {
        case 'zen':
          this._playZenBowl(now, masterGain);
          break;
        case 'marimba':
          this._playMarimba(now, masterGain);
          break;
        case 'typewriter':
          this._playTypewriterDing(now, masterGain);
          break;
        case 'digital':
          this._playDigitalBeep(now, masterGain);
          break;
        case 'bell':
        default:
          this._playAcousticBell(now, masterGain);
          break;
      }
    } catch (e) {
      console.warn('[NotificationManager] Audio synth error:', e);
    }
  }

  // 1. Acoustic Bell (E5 & B5)
  _playAcousticBell(now, dest) {
    const osc1 = this.audioCtx.createOscillator();
    const gain1 = this.audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.04);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc1.connect(gain1);
    gain1.connect(dest);
    osc1.start(now);
    osc1.stop(now + 1.2);

    const osc2 = this.audioCtx.createOscillator();
    const gain2 = this.audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
    osc2.connect(gain2);
    gain2.connect(dest);
    osc2.start(now + 0.12);
    osc2.stop(now + 1.6);
  }

  // 2. Zen Singing Bowl
  _playZenBowl(now, dest) {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(293.66, now);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 2.5);

    const oscHarm = this.audioCtx.createOscillator();
    const gainHarm = this.audioCtx.createGain();
    oscHarm.type = 'sine';
    oscHarm.frequency.setValueAtTime(880.0, now);
    gainHarm.gain.setValueAtTime(0, now);
    gainHarm.gain.linearRampToValueAtTime(0.08, now + 0.04);
    gainHarm.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
    oscHarm.connect(gainHarm);
    gainHarm.connect(dest);
    oscHarm.start(now);
    oscHarm.stop(now + 1.8);
  }

  // 3. Wooden Marimba
  _playMarimba(now, dest) {
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.09;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.35, startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + 0.6);
    });
  }

  // 4. Vintage Typewriter
  _playTypewriterDing(now, dest) {
    const bellOsc = this.audioCtx.createOscillator();
    const bellGain = this.audioCtx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(1975.53, now);
    bellGain.gain.setValueAtTime(0, now);
    bellGain.gain.linearRampToValueAtTime(0.4, now + 0.01);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    bellOsc.connect(bellGain);
    bellGain.connect(dest);
    bellOsc.start(now);
    bellOsc.stop(now + 1.1);
  }

  // 5. Modern Digital
  _playDigitalBeep(now, dest) {
    const notes = [880.0, 1108.73];
    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.07;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
      osc.connect(gain);
      gain.connect(dest);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }

  // ================= REMINDER SCHEDULER & SW SYNC =================

  computeReminderTimestamp(task) {
    if (!task || task.completed || !task.dueDate) return null;

    if (task.reminderTime && typeof task.reminderTime === 'string' && task.reminderTime.includes('T')) {
      const ts = new Date(task.reminderTime).getTime();
      return isNaN(ts) ? null : ts;
    }

    const timeStr = task.dueTime || '09:00';
    const dueDateTimeStr = `${task.dueDate}T${timeStr}:00`;
    const dueTimeMs = new Date(dueDateTimeStr).getTime();

    if (isNaN(dueTimeMs)) return null;

    const offsetPreset = task.reminderTime || '0';
    let offsetMinutes = 0;

    switch (offsetPreset) {
      case '0': offsetMinutes = 0; break;
      case '5': offsetMinutes = 5; break;
      case '15': offsetMinutes = 15; break;
      case '30': offsetMinutes = 30; break;
      case '60': offsetMinutes = 60; break;
      case 'none': return null;
      default:
        offsetMinutes = parseInt(offsetPreset) || 0;
    }

    return dueTimeMs - (offsetMinutes * 60 * 1000);
  }

  startScheduler() {
    if (this.checkInterval) clearInterval(this.checkInterval);
    this.checkReminders();
    this.checkInterval = setInterval(() => this.checkReminders(), 10000);
  }

  // Sync all upcoming task alarms directly to Service Worker
  async syncAlarmsToServiceWorker() {
    if (!window.folioDB || !window.folioDB.isReady) return;

    try {
      const tasks = await window.folioDB.getTasks();
      const alarms = [];
      const now = Date.now();

      for (const task of tasks) {
        if (task.completed || task.reminderFired) continue;

        const reminderTimestamp = this.computeReminderTimestamp(task);
        if (reminderTimestamp && reminderTimestamp > now - 60000) {
          alarms.push({
            id: task.id,
            title: task.title,
            time: reminderTimestamp,
            dueTime: task.dueTime,
            description: task.description
          });
        }
      }

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_ALARMS',
          alarms: alarms
        });
      }
    } catch (err) {
      console.warn('[NotificationManager] Error syncing alarms to SW:', err);
    }
  }

  async checkReminders() {
    if (!window.folioDB || !window.folioDB.isReady) return;

    try {
      const tasks = await window.folioDB.getTasks();
      const now = Date.now();

      for (const task of tasks) {
        if (task.completed || task.reminderFired) continue;

        const reminderTimestamp = this.computeReminderTimestamp(task);
        if (!reminderTimestamp) continue;

        const diff = now - reminderTimestamp;
        // Fire if within 30 seconds of due or just passed
        if (diff >= 0 && diff <= 30 * 60 * 1000) {
          await this.triggerNotification(task);
        }
      }
    } catch (err) {
      console.warn('[NotificationManager] Error checking reminders:', err);
    }
  }

  async triggerNotification(task) {
    console.log('[NotificationManager] Triggering reminder for task:', task.title);

    this.playChime();

    task.reminderFired = true;
    await window.folioDB.saveTask(task);

    const title = `Folio Task Reminder`;
    const options = {
      body: `"${task.title}" is due ${task.dueTime ? 'at ' + task.dueTime : 'today'}!`,
      icon: './icons/icon.svg',
      badge: './icons/icon.svg',
      tag: `task-${task.id}`,
      vibrate: [200, 100, 200, 100, 200],
      requireInteraction: true,
      data: { url: './index.html?view=today', taskId: task.id }
    };

    if (this.hasPermission()) {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(reg => {
          reg.showNotification(title, options);
        }).catch(() => {
          new Notification(title, options);
        });
      } else {
        new Notification(title, options);
      }
    }

    if (window.showReminderToast) {
      window.showReminderToast(task);
    }

    if (window.folioApp && window.folioApp.renderCurrentView) {
      window.folioApp.renderCurrentView();
    }
  }

  async snoozeTask(taskId, minutes = 10) {
    const task = await window.folioDB.getTaskById(taskId);
    if (!task) return;

    const snoozeTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    task.reminderTime = snoozeTime;
    task.reminderFired = false;
    await window.folioDB.saveTask(task);

    this.syncAlarmsToServiceWorker();

    if (window.showToast) {
      window.showToast(`Task snoozed for ${minutes} minutes`);
    }

    if (window.folioApp && window.folioApp.renderCurrentView) {
      window.folioApp.renderCurrentView();
    }
  }
}

// Global Singleton
window.notificationManager = new NotificationManager();
