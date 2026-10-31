// User settings (separate from the save game so "reset save" keeps them).
import { CONFIG } from '../config.js';

const DEFAULTS = { sensitivity: 1, invertY: false, alwaysDay: false, minimap: true };

export function loadSettings() {
  try {
    const d = JSON.parse(localStorage.getItem(CONFIG.settingsKey) || '{}');
    return { ...DEFAULTS, ...d };
  } catch (e) { return { ...DEFAULTS }; }
}

export function saveSettings(s) {
  try { localStorage.setItem(CONFIG.settingsKey, JSON.stringify(s)); } catch (e) { /* ignore */ }
}
