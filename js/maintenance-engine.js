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

// Seeded realistic maintenance state for demo (current ODO: 97,245 KM)
export const DEFAULT_MAINTENANCE_STATE = {
  oil_engine: {
    lastServiceOdo: 80000,
    lastServiceDate: "2026-06-25",
    nextServiceOdo: 100000,
    nextServiceDate: "2026-08-25",
    status: "NORMAL"
  },
  oil_filter: {
    lastServiceOdo: 80000,
    lastServiceDate: "2026-06-25",
    nextServiceOdo: 100000,
    nextServiceDate: "2026-08-25",
    status: "NORMAL"
  },
  air_filter: {
    lastServiceOdo: 60000,
    lastServiceDate: "2026-04-10",
    nextServiceOdo: 100000,
    nextServiceDate: "2026-08-10",
    status: "WARNING"
  },
  coolant: {
    lastServiceOdo: 60000,
    lastServiceDate: "2025-08-20",
    nextServiceOdo: 100000,
    nextServiceDate: "2026-08-20",
    status: "DUE"
  },
  spark_plug: {
    lastServiceOdo: 70000,
    lastServiceDate: "2026-01-15",
    nextServiceOdo: 100000,
    nextServiceDate: "2027-01-15",
    status: "NORMAL"
  },
  transmission_oil: {
    lastServiceOdo: 60000,
    lastServiceDate: "2025-05-12",
    nextServiceOdo: 100000,
    nextServiceDate: "2027-05-12",
    status: "NORMAL"
  },
  brake_fluid: {
    lastServiceOdo: 80000,
    lastServiceDate: "2026-02-14",
    nextServiceOdo: 100000,
    nextServiceDate: "2027-02-14",
    status: "NORMAL"
  },
  brake_pad: {
    lastServiceOdo: 70000,
    lastServiceDate: "2025-09-01",
    nextServiceOdo: 100000,
    nextServiceDate: "2027-03-01",
    status: "NORMAL"
  },
  battery: {
    lastServiceOdo: 50000,
    lastServiceDate: "2025-01-10",
    nextServiceOdo: 100000,
    nextServiceDate: "2027-01-10",
    status: "NORMAL"
  },
  tire: {
    lastServiceOdo: 60000,
    lastServiceDate: "2025-06-01",
    nextServiceOdo: 100000,
    nextServiceDate: "2028-06-01",
    status: "NORMAL"
  }
};

// Seeded realistic service history
export const DEFAULT_SERVICE_HISTORY = [
  {
    id: "srv_demo_01",
    type: "oil_engine",
    typeName: "Engine Oil & Filter Service",
    odo: 80000,
    date: "2026-06-25",
    notes: "Full synthetic 5W-30 engine oil replaced, OEM filter installed. Engine sounds smooth.",
    items: ["Engine Oil", "Oil Filter"],
    photoProof: ""
  },
  {
    id: "srv_demo_02",
    type: "air_filter",
    typeName: "Air & Cabin Filter Replacement",
    odo: 60000,
    date: "2026-04-10",
    notes: "High-flow air filter cleaned and replaced. Improved throttle response.",
    items: ["Air Filter"],
    photoProof: ""
  },
  {
    id: "srv_demo_03",
    type: "brake_fluid",
    typeName: "Brake System Flushing",
    odo: 80000,
    date: "2026-02-14",
    notes: "DOT4 brake fluid flushed and bled on all 4 calipers. Firm pedal feel restored.",
    items: ["Brake Fluid"],
    photoProof: ""
  }
];

class MaintenanceEngine {
  constructor() {
    this.settings = this.loadLocal('scada_maintenance_settings', DEFAULT_MAINTENANCE_SETTINGS);
    this.state = this.loadLocal('scada_maintenance_state', DEFAULT_MAINTENANCE_STATE);
    this.history = this.loadLocal('scada_service_history', DEFAULT_SERVICE_HISTORY);
    this.currentOdo = 97245;
  }

  loadLocal(key, fallback) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : JSON.parse(JSON.stringify(fallback));
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
  evaluateItemHealth(typeKey) {
    const itemSetting = this.settings[typeKey];
    const itemState = this.state[typeKey];

    if (!itemSetting || !itemState) {
      return { status: "NORMAL", progressPercent: 0, daysLeft: 0, kmLeft: 0 };
    }

    const currentOdo = this.currentOdo;
    const lastOdo = Number(itemState.lastServiceOdo) || 0;
    const nextOdo = Number(itemState.nextServiceOdo) || (lastOdo + itemSetting.intervalKm);
    const reminderKm = Number(itemSetting.reminderKm) || 500;
    const reminderDays = Number(itemSetting.reminderDays) || 7;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextDate = new Date(itemState.nextServiceDate);
    nextDate.setHours(0, 0, 0, 0);

    const lastDate = new Date(itemState.lastServiceDate || today);
    lastDate.setHours(0, 0, 0, 0);

    // 1. Distance calculations
    const kmLeft = nextOdo - currentOdo;
    const kmCovered = currentOdo - lastOdo;
    const totalKmInterval = nextOdo - lastOdo || itemSetting.intervalKm || 1;
    const odoProgress = Math.max(0, Math.min(100, Math.round((kmCovered / totalKmInterval) * 100)));

    // 2. Time calculations
    const diffTimeMs = nextDate.getTime() - today.getTime();
    const daysLeft = Math.ceil(diffTimeMs / (1000 * 60 * 60 * 24));
    
    const totalDaysInterval = Math.max(1, Math.ceil((nextDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24)));
    const daysPassed = Math.ceil((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    const timeProgress = Math.max(0, Math.min(100, Math.round((daysPassed / totalDaysInterval) * 100)));

    // Max progress drives the visual indicator
    const progressPercent = Math.max(odoProgress, timeProgress);

    // 3. Status Evaluation Logic (Requirement 16)
    let status = "NORMAL";
    
    const isDueByKm = currentOdo >= nextOdo;
    const isDueByDate = today.getTime() >= nextDate.getTime();
    
    const isWarningByKm = currentOdo >= (nextOdo - reminderKm);
    const isWarningByDate = daysLeft <= reminderDays;

    if (isDueByKm || isDueByDate) {
      status = "DUE";
    } else if (isWarningByKm || isWarningByDate) {
      status = "WARNING";
    } else {
      status = "NORMAL";
    }

    return {
      status,
      progressPercent: Math.min(100, progressPercent),
      kmLeft,
      daysLeft,
      nextOdo,
      nextDate: itemState.nextServiceDate
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
