/**
 * MAINTENANCE ENGINE & BUSINESS LOGIC
 * 
 * Manages maintenance schedules, dynamic interval recalculations,
 * date and distance threshold status evaluations (NORMAL, WARNING, DUE),
 * progress bar percentages, service recording, and local persistence.
 */

import { writeServiceRecord, writeMaintenanceSettings, dispatchLocalUpdate } from './telemetry-service.js';

// Default initial catalog
export const DEFAULT_MAINTENANCE_SETTINGS = {
  oil_engine: {
    name: "Engine Oil",
    category: "engine",
    intervalKm: 20000,
    intervalMonths: 2,
    reminderKm: 500,
    reminderDays: 7,
    sensorNodeId: "node-engine"
  },
  oil_filter: {
    name: "Oil Filter",
    category: "engine",
    intervalKm: 20000,
    intervalMonths: 2,
    reminderKm: 500,
    reminderDays: 7,
    sensorNodeId: "node-oil-filter"
  },
  air_filter: {
    name: "Air Filter",
    category: "engine",
    intervalKm: 40000,
    intervalMonths: 4,
    reminderKm: 1000,
    reminderDays: 14,
    sensorNodeId: "node-air-filter"
  },
  coolant: {
    name: "Radiator Coolant",
    category: "cooling",
    intervalKm: 40000,
    intervalMonths: 12,
    reminderKm: 1000,
    reminderDays: 14,
    sensorNodeId: "node-coolant"
  },
  spark_plug: {
    name: "Spark Plugs",
    category: "engine",
    intervalKm: 30000,
    intervalMonths: 12,
    reminderKm: 1000,
    reminderDays: 14,
    sensorNodeId: "node-engine"
  },
  transmission_oil: {
    name: "Transmission Fluid",
    category: "transmission",
    intervalKm: 40000,
    intervalMonths: 24,
    reminderKm: 1500,
    reminderDays: 20,
    sensorNodeId: "node-transmission"
  },
  brake_fluid: {
    name: "Brake Fluid",
    category: "brakes",
    intervalKm: 20000,
    intervalMonths: 12,
    reminderKm: 500,
    reminderDays: 10,
    sensorNodeId: "node-brakes-front"
  },
  brake_pad: {
    name: "Brake Pads",
    category: "brakes",
    intervalKm: 30000,
    intervalMonths: 18,
    reminderKm: 1000,
    reminderDays: 14,
    sensorNodeId: "node-brakes-rear"
  },
  battery: {
    name: "12V Battery",
    category: "electrical",
    intervalKm: 50000,
    intervalMonths: 24,
    reminderKm: 2000,
    reminderDays: 30,
    sensorNodeId: "node-battery"
  },
  tire: {
    name: "Tire Rotation / Wear",
    category: "wheels",
    intervalKm: 40000,
    intervalMonths: 36,
    reminderKm: 1000,
    reminderDays: 30,
    sensorNodeId: "node-tire-front"
  }
};

// Initial clean maintenance state
export const DEFAULT_MAINTENANCE_STATE = {
  oil_engine: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 10000, nextServiceDate: "", status: "NORMAL" },
  oil_filter: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 10000, nextServiceDate: "", status: "NORMAL" },
  air_filter: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 20000, nextServiceDate: "", status: "NORMAL" },
  coolant: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 40000, nextServiceDate: "", status: "NORMAL" },
  spark_plug: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 30000, nextServiceDate: "", status: "NORMAL" },
  transmission_oil: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 40000, nextServiceDate: "", status: "NORMAL" },
  brake_fluid: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 20000, nextServiceDate: "", status: "NORMAL" },
  brake_pad: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 30000, nextServiceDate: "", status: "NORMAL" },
  battery: { lastServiceOdo: 0, lastServiceDate: "", nextServiceOdo: 50000, nextServiceDate: "", status: "NORMAL" },
  tire: { lastServiceOdo: 0, lastServiceDate: "", nextServiceDate: "", nextServiceOdo: 40000, status: "NORMAL" }
};

// Clean service history (no dummy records)
export const DEFAULT_SERVICE_HISTORY = [];

class MaintenanceEngine {
  constructor() {
    this.settings = this.loadLocal('scada_maintenance_settings', DEFAULT_MAINTENANCE_SETTINGS);
    this.state = this.loadLocal('scada_maintenance_state', DEFAULT_MAINTENANCE_STATE);
    this.history = this.loadLocal('scada_service_history', DEFAULT_SERVICE_HISTORY);
    this.currentOdo = 0;
  }

  loadLocal(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        // If it contains old demo dummy items, reset to clean fallback
        if (key === 'scada_service_history' && Array.isArray(parsed) && parsed.some(x => x.id && x.id.startsWith('srv_demo'))) {
          localStorage.removeItem(key);
          return fallback;
        }
        return parsed;
      }
      return JSON.parse(JSON.stringify(fallback));
    } catch (e) {
      return JSON.parse(JSON.stringify(fallback));
    }
  }

  saveLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn("LocalStorage save error:", e);
    }
  }

  setCurrentOdo(odo) {
    this.currentOdo = Number(odo) || 0;
    this.recalculateAllStatuses();
  }

  /**
   * Helper: Add months to a date string (YYYY-MM-DD)
   */
  addMonthsToDate(dateStr, months) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
    
    d.setMonth(d.getMonth() + parseInt(months, 10));
    return d.toISOString().split('T')[0];
  }

  /**
   * Format date for human display (e.g. 23 Aug 2026)
   */
  formatDisplayDate(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  /**
   * Format number with comma separators (e.g. 100,250)
   */
  formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return "0";
    return Number(num).toLocaleString('en-US');
  }

  /**
   * Calculate exact next service values based on dynamic settings
   */
  calculateNextService(typeKey, lastOdo, lastDate) {
    const setting = this.settings[typeKey] || { intervalKm: 20000, intervalMonths: 2 };
    const nextOdo = Number(lastOdo) + Number(setting.intervalKm);
    const nextDate = this.addMonthsToDate(lastDate, setting.intervalMonths);
    return { nextOdo, nextDate };
  }

  /**
   * Evaluate Status (NORMAL, WARNING, DUE) and progress % for an item
   */
  evaluateItemHealth(key) {
    const itemSetting = this.settings[key];
    if (!itemSetting) {
      return { status: "NORMAL", progressPercent: 0, percentUsed: 0, kmLeft: 0, daysLeft: 30, nextOdo: 0, nextDate: "" };
    }

    const itemState = this.state[key] || {};
    const currentOdo = Number(this.currentOdo) || 0;
    const intervalKm = Number(itemSetting.intervalKm) || 20000;
    const intervalMonths = Number(itemSetting.intervalMonths) || 6;
    const reminderKm = Number(itemSetting.reminderKm) || 500;
    const reminderDays = Number(itemSetting.reminderDays) || 7;

    const lastOdo = Number(itemState.lastServiceOdo) || 0;
    let nextOdo = Number(itemState.nextServiceOdo) || (lastOdo + intervalKm);

    if (nextOdo <= lastOdo) {
      nextOdo = lastOdo + intervalKm;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let lastDate = new Date(itemState.lastServiceDate);
    if (isNaN(lastDate.getTime())) {
      lastDate = new Date(today);
    }

    let nextDate = new Date(itemState.nextServiceDate);
    if (isNaN(nextDate.getTime())) {
      nextDate = new Date(today);
      nextDate.setMonth(nextDate.getMonth() + intervalMonths);
    }

    // 1. Distance calculations
    const kmLeft = Math.max(0, nextOdo - currentOdo);
    const kmCovered = Math.max(0, currentOdo - lastOdo);
    const totalKmInterval = Math.max(1, nextOdo - lastOdo);
    const odoProgress = Math.max(0, Math.min(100, Math.round((kmCovered / totalKmInterval) * 100)));

    // 2. Time calculations
    const diffTimeMs = nextDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTimeMs / (1000 * 60 * 60 * 24));
    
    const totalDaysInterval = Math.max(1, Math.ceil((nextDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysPassed = Math.max(0, Math.ceil((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
    const timeProgress = Math.max(0, Math.min(100, Math.round((daysPassed / totalDaysInterval) * 100)));

    // Max progress drives the visual indicator
    const progressPercent = Math.max(0, Math.min(100, Math.max(odoProgress, timeProgress) || 0));

    // 3. Status Evaluation Logic
    let status = "NORMAL";
    
    const isDueByKm = currentOdo > 0 && currentOdo >= nextOdo;
    const isDueByDate = today.getTime() >= nextDate.getTime() && daysPassed >= totalDaysInterval;
    
    const isWarningByKm = currentOdo > 0 && currentOdo >= (nextOdo - reminderKm);
    const isWarningByDate = daysLeft <= reminderDays && daysLeft > 0;

    if (isDueByKm || isDueByDate) {
      status = "DUE";
    } else if (isWarningByKm || isWarningByDate) {
      status = "WARNING";
    } else {
      status = "NORMAL";
    }

    return {
      status,
      progressPercent,
      percentUsed: progressPercent,
      kmLeft,
      daysLeft,
      nextOdo,
      nextDate: nextDate.toISOString().split('T')[0]
    };
  }

  /**
   * Recalculate all item health statuses and return summary count
   */
  recalculateAllStatuses() {
    let normalCount = 0;
    let warningCount = 0;
    let dueCount = 0;

    Object.keys(this.settings).forEach(key => {
      // Ensure state exists
      if (!this.state[key]) {
        const { nextOdo, nextDate } = this.calculateNextService(key, this.currentOdo, new Date().toISOString().split('T')[0]);
        this.state[key] = {
          lastServiceOdo: this.currentOdo,
          lastServiceDate: new Date().toISOString().split('T')[0],
          nextServiceOdo: nextOdo,
          nextServiceDate: nextDate,
          status: "NORMAL"
        };
      }

      const health = this.evaluateItemHealth(key);
      this.state[key].status = health.status;

      if (health.status === "NORMAL") normalCount++;
      else if (health.status === "WARNING") warningCount++;
      else if (health.status === "DUE") dueCount++;
    });

    this.saveLocal('scada_maintenance_state', this.state);
    dispatchLocalUpdate('maintenance', this.state);

    return {
      total: Object.keys(this.settings).length,
      normal: normalCount,
      warning: warningCount,
      due: dueCount
    };
  }

  /**
   * Record a new service log (Requirement 13)
   */
  async logService(record) {
    const { type, odo, date, notes, items, photoProof } = record;
    const serviceOdo = Number(odo) || this.currentOdo;
    const serviceDate = date || new Date().toISOString().split('T')[0];

    // 1. Create history item
    const typeName = this.settings[type] ? this.settings[type].name : "General Service";
    const historyItem = {
      id: "srv_" + Date.now(),
      type,
      typeName,
      odo: serviceOdo,
      date: serviceDate,
      notes: notes || "",
      items: items && items.length > 0 ? items : [typeName],
      photoProof: photoProof || "",
      createdAt: new Date().toISOString()
    };

    this.history.unshift(historyItem);
    this.saveLocal('scada_service_history', this.history);

    // 2. Update all affected maintenance items (if multi-item selected or single type)
    const affectedKeys = new Set([type]);
    
    // Check if items array matched other known maintenance keys
    if (items && items.length) {
      items.forEach(itemName => {
        Object.keys(this.settings).forEach(k => {
          if (this.settings[k].name.toLowerCase() === itemName.toLowerCase()) {
            affectedKeys.add(k);
          }
        });
      });
    }

    const updatedStateMap = {};

    affectedKeys.forEach(k => {
      if (this.settings[k]) {
        // Calculate new nextService according to latest interval settings (Requirement 12 & 13)
        const { nextOdo, nextDate } = this.calculateNextService(k, serviceOdo, serviceDate);
        
        this.state[k] = {
          lastServiceOdo: serviceOdo,
          lastServiceDate: serviceDate,
          nextServiceOdo: nextOdo,
          nextServiceDate: nextDate,
          status: "NORMAL"
        };
        updatedStateMap[k] = this.state[k];
      }
    });

    this.saveLocal('scada_maintenance_state', this.state);
    this.recalculateAllStatuses();

    // 3. Persist service record & broadcast update
    await writeServiceRecord(historyItem, updatedStateMap);
    dispatchLocalUpdate('history', this.history);

    return historyItem;
  }

  /**
   * Update or Add Maintenance Setting (Requirement 12 & 15)
   */
  async updateSetting(key, settingData) {
    const isNew = !this.settings[key];
    this.settings[key] = {
      ...this.settings[key],
      ...settingData,
      intervalKm: Number(settingData.intervalKm) || 20000,
      intervalMonths: Number(settingData.intervalMonths) || 2,
      reminderKm: Number(settingData.reminderKm) || 500,
      reminderDays: Number(settingData.reminderDays) || 7
    };

    this.saveLocal('scada_maintenance_settings', this.settings);

    // If existing item interval changed, dynamically recalculate its next service (Requirement 12)
    if (this.state[key]) {
      const lastOdo = this.state[key].lastServiceOdo || this.currentOdo;
      const lastDate = this.state[key].lastServiceDate || new Date().toISOString().split('T')[0];
      const { nextOdo, nextDate } = this.calculateNextService(key, lastOdo, lastDate);
      
      this.state[key].nextServiceOdo = nextOdo;
      this.state[key].nextServiceDate = nextDate;
    } else {
      const { nextOdo, nextDate } = this.calculateNextService(key, this.currentOdo, new Date().toISOString().split('T')[0]);
      this.state[key] = {
        lastServiceOdo: this.currentOdo,
        lastServiceDate: new Date().toISOString().split('T')[0],
        nextServiceOdo: nextOdo,
        nextServiceDate: nextDate,
        status: "NORMAL"
      };
    }

    this.saveLocal('scada_maintenance_state', this.state);
    this.recalculateAllStatuses();

    await writeMaintenanceSettings(this.settings);
    dispatchLocalUpdate('settings', this.settings);

    return this.settings[key];
  }

  /**
   * Delete custom maintenance item
   */
  async deleteSetting(key) {
    delete this.settings[key];
    delete this.state[key];
    this.saveLocal('scada_maintenance_settings', this.settings);
    this.saveLocal('scada_maintenance_state', this.state);
    this.recalculateAllStatuses();

    await writeMaintenanceSettings(this.settings);
    dispatchLocalUpdate('settings', this.settings);
  }

  getAllCardsData() {
    return Object.keys(this.settings).map(key => {
      const setting = this.settings[key];
      const itemState = this.state[key] || {};
      const health = this.evaluateItemHealth(key);

      return {
        key,
        name: setting.name,
        category: setting.category || "general",
        intervalKm: setting.intervalKm,
        intervalMonths: setting.intervalMonths,
        reminderKm: setting.reminderKm,
        reminderDays: setting.reminderDays,
        sensorNodeId: setting.sensorNodeId,
        lastServiceOdo: itemState.lastServiceOdo || 0,
        lastServiceDate: itemState.lastServiceDate || "-",
        nextServiceOdo: health.nextOdo,
        nextServiceDate: health.nextDate,
        status: health.status,
        progressPercent: health.progressPercent,
        kmLeft: health.kmLeft,
        daysLeft: health.daysLeft
      };
    });
  }
}

export const maintenanceEngine = new MaintenanceEngine();
