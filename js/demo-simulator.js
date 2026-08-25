/**
 * DEMO SIMULATOR & TELEMETRY ENGINE
 * 
 * Provides smooth, realistic telemetry matching the dashboard overview
 * (Speed 42 km/h, Trip 128.6 km, Odometer 97,128 km, Speed limit 60 km/h).
 */

import { dispatchLocalUpdate } from './firebase.js';
import { maintenanceEngine } from './maintenance-engine.js';

class DemoSimulator {
  constructor() {
    this.speed = 42;
    this.odo = 97128.0;
    this.trip = 128.6;
    this.speedLimit = 60;
    this.gpsStatus = "Connected";
    this.esp32Status = "Online";
    this.vehicleStatus = "Normal";
    this.isCruising = true;
    this.intervalTimer = null;
    
    maintenanceEngine.setCurrentOdo(this.odo);
  }

  start() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);

    // Subtle realtime telemetry fluctuation every 2 seconds
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 2000);
  }

  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  tick() {
    if (this.isCruising) {
      // Gentle cruise fluctuation around 40-44 km/h
      const variation = (Math.random() - 0.48) * 2;
      this.speed = Math.max(0, Math.min(140, Math.round(this.speed + variation)));
      
      const distanceInc = (this.speed / 3600) * 2;
      this.trip = parseFloat((this.trip + distanceInc).toFixed(1));
      this.odo = Math.round(this.odo + distanceInc);
    }

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toISOString().split('T')[0];

    const telemetry = {
      speed: this.speed,
      odo: Math.round(this.odo),
      trip: this.trip,
      speedLimit: this.speedLimit,
      gps: this.gpsStatus,
      esp32: this.esp32Status,
      status: this.vehicleStatus,
      date: dateStr,
      time: timeStr,
      lastUpdate: timeStr
    };

    maintenanceEngine.setCurrentOdo(this.odo);
    dispatchLocalUpdate('vehicle', telemetry);
    dispatchLocalUpdate('speedLimit', this.speedLimit);
  }

  setSpeed(val) {
    this.speed = Number(val);
    this.tick();
  }

  setSpeedLimit(val) {
    this.speedLimit = Number(val);
    dispatchLocalUpdate('speedLimit', this.speedLimit);
    this.tick();
  }

  setOdo(val) {
    this.odo = Number(val);
    maintenanceEngine.setCurrentOdo(this.odo);
    this.tick();
  }

  resetTrip() {
    this.trip = 0.0;
    this.tick();
  }
}

export const demoSimulator = new DemoSimulator();
