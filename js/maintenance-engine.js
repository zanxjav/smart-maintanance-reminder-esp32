/**
 * ULTRA LIGHTWEIGHT VEHICLE MAINTENANCE ENGINE (0ms UI LATENCY - ZERO LAG)
 * 
 * Pure Add & Delete Maintenance System.
 * Clean, super-fast in-memory arithmetic with no recursion or heavy loops.
 */

import { dispatchLocalUpdate } from './telemetry-service.js';

const STORAGE_KEY = 'vmon_maintenance_items_v2';
const HISTORY_KEY = 'vmon_service_history_v2';

// 2 Clean Initial Items (Can be deleted or edited anytime)
const DEFAULT_ITEMS = [
  {
    id: 'maint_oli_mesin',
    name: 'Oli Mesin',
    category: 'engine',
    intervalKm: 10000,
    intervalMonths: 6,
    lastServiceOdo: 97248,
    lastServiceDate: '2026-08-28',
    reminderKm: 500
  },
  {
    id: 'maint_kampas_rem',
    name: 'Kampas Rem',
    category: 'brakes',
    intervalKm: 30000,
    intervalMonths: 18,
    lastServiceOdo: 97248,
    lastServiceDate: '2026-08-28',
    reminderKm: 1000
  }
];

class MaintenanceEngine {
  constructor() {
    this.cleanLegacyStorage();
    this.items = this.loadItems();
    this.history = this.loadHistory();
    this.currentOdo = 97248;
  }

  // Wipe old bloated keys from previous versions
  cleanLegacyStorage() {
    try {
      const legacyKeys = [
        'scada_maintenance_settings',
        'scada_maintenance_state',
        'scada_service_history',
        'vehicle_scada_maintenance_settings',
        'vehicle_scada_service_history'
      ];
      legacyKeys.forEach(k => localStorage.removeItem(k));
    } catch (e) {}
  }

  loadItems() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return JSON.parse(JSON.stringify(DEFAULT_ITEMS));
  }

  loadHistory() {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch (e) {}
    dispatchLocalUpdate('settings', this.items);
  }

  saveHistory() {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history));
    } catch (e) {}
    dispatchLocalUpdate('history', this.history);
  }

  setCurrentOdo(odo) {
    if (odo > 0) {
      this.currentOdo = Number(odo);
    }
  }

  addMonthsToDate(dateStr, months) {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr || '-';
      d.setMonth(d.getMonth() + parseInt(months || 6, 10));
      return d.toISOString().split('T')[0];
    } catch (e) {
      return dateStr || '-';
    }
  }

  formatDisplayDate(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    } catch (e) {
      return dateStr;
    }
  }

  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return Number(num).toLocaleString('id-ID');
  }

  getCategoryInfo(cat) {
    const category = (cat || 'general').toLowerCase();
    switch (category) {
      case 'engine':
        return { label: 'Mesin', colorClass: 'green', colorHex: '#10b981', iconSvg: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' };
      case 'transmission':
        return { label: 'Transmisi', colorClass: 'orange', colorHex: '#f59e0b', iconSvg: '<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>' };
      case 'cooling':
        return { label: 'Pendingin', colorClass: 'purple', colorHex: '#a855f7', iconSvg: '<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>' };
      case 'brakes':
        return { label: 'Pengereman', colorClass: 'red', colorHex: '#ef4444', iconSvg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="3" x2="12" y2="7"/>' };
      case 'electrical':
        return { label: 'Kelistrikan', colorClass: 'yellow', colorHex: '#eab308', iconSvg: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' };
      case 'wheels':
        return { label: 'Roda & Ban', colorClass: 'blue', colorHex: '#38bdf8', iconSvg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>' };
      default:
        return { label: 'Umum', colorClass: 'blue', colorHex: '#38bdf8', iconSvg: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' };
    }
  }

  // ADD Maintenance Item
  addItem(data) {
    const id = 'maint_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const item = {
      id,
      name: data.name || 'Komponen Baru',
      category: data.category || 'general',
      intervalKm: Math.max(500, Number(data.intervalKm) || 10000),
      intervalMonths: Math.max(1, Number(data.intervalMonths) || 6),
      lastServiceOdo: Number(data.lastServiceOdo !== undefined ? data.lastServiceOdo : this.currentOdo) || this.currentOdo,
      lastServiceDate: data.lastServiceDate || new Date().toISOString().split('T')[0],
      reminderKm: Math.max(50, Number(data.reminderKm) || 500)
    };

    this.items.push(item);
    this.saveItems();
    return item;
  }

  // DELETE Maintenance Item
  deleteItem(id) {
    const idx = this.items.findIndex(i => i.id === id);
    if (idx !== -1) {
      const removed = this.items.splice(idx, 1);
      this.saveItems();
      return true;
    }
    return false;
  }

  // UPDATE Interval
  updateInterval(id, intervalKm, intervalMonths) {
    const item = this.items.find(i => i.id === id);
    if (item) {
      item.intervalKm = Math.max(500, Number(intervalKm) || 10000);
      item.intervalMonths = Math.max(1, Number(intervalMonths) || 6);
      this.saveItems();
      return item;
    }
    return null;
  }

  // RECORD Service (Reset Cycle)
  recordService(id, serviceOdo, serviceDate, notes = '') {
    const item = this.items.find(i => i.id === id);
    const odo = Number(serviceOdo) || this.currentOdo;
    const date = serviceDate || new Date().toISOString().split('T')[0];

    if (item) {
      item.lastServiceOdo = odo;
      item.lastServiceDate = date;
      this.saveItems();
    }

    const logEntry = {
      id: 'log_' + Date.now(),
      itemId: id,
      name: item ? item.name : 'Servis Kendaraan',
      odo,
      date,
      notes,
      timestamp: new Date().toISOString()
    };
    this.history.unshift(logEntry);
    this.saveHistory();

    return logEntry;
  }

  // CALCULATE Health Data for All Items (Super Fast In-Memory Arithmetic)
  getAllCardsData() {
    const currentOdo = this.currentOdo;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dueCount = 0;
    let warningCount = 0;
    let normalCount = 0;

    const cards = this.items.map(item => {
      const catInfo = this.getCategoryInfo(item.category);
      const lastOdo = Number(item.lastServiceOdo) || 0;
      const intervalKm = Number(item.intervalKm) || 10000;
      const nextServiceOdo = lastOdo + intervalKm;
      const nextServiceDate = this.addMonthsToDate(item.lastServiceDate, item.intervalMonths);
      
      const kmCovered = Math.max(0, currentOdo - lastOdo);
      const kmLeft = Math.max(0, nextServiceOdo - currentOdo);
      const progressPercent = Math.max(0, Math.min(100, Math.round((kmCovered / intervalKm) * 100)));

      // Status calculation
      let status = 'NORMAL';
      if (currentOdo >= nextServiceOdo) {
        status = 'DUE';
        dueCount++;
      } else if (kmLeft <= (item.reminderKm || 500)) {
        status = 'WARNING';
        warningCount++;
      } else {
        status = 'NORMAL';
        normalCount++;
      }

      return {
        id: item.id,
        key: item.id,
        name: item.name,
        category: item.category,
        categoryLabel: catInfo.label,
        colorClass: catInfo.colorClass,
        colorHex: catInfo.colorHex,
        iconSvg: catInfo.iconSvg,
        intervalKm,
        intervalMonths: item.intervalMonths,
        lastServiceOdo: lastOdo,
        lastServiceDate: item.lastServiceDate,
        nextServiceOdo,
        nextServiceDate,
        kmLeft,
        progressPercent,
        status
      };
    });

    return {
      cards,
      summary: {
        total: this.items.length,
        due: dueCount,
        warning: warningCount,
        normal: normalCount
      }
    };
  }
}

export const maintenanceEngine = new MaintenanceEngine();
