/**
 * DEMO SIMULATOR & TELEMETRY ENGINE
 * 
 * Provides smooth, realistic cruising telemetry in Demo Mode
 * (Speed fluctuations, subtle ODO/Trip increment, GPS & ESP32 heartbeat)
 * and interactive simulation controls.
 */

import { dispatchLocalUpdate } from './firebase.js';
import { maintenanceEngine } from './maintenance-engine.js';

class DemoSimulator {
  constructor() {
    this.speed = 72;
    this.targetSpeed = 72;
    this.odo = 97245.0;
    this.trip = 124.6;
    this.speedLimit = 60;
    this.gpsStatus = "CONNECTED";
    this.esp32Status = "ONLINE";
    this.latitude = -6.2088;
    this.longitude = 106.8456;
    this.isCruising = true;
    this.intervalTimer = null;
    this.clockTimer = null;
    
    // Notify maintenance engine of initial odo
    maintenanceEngine.setCurrentOdo(this.odo);
  }

  start() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);

    // Realistic telemetry tick every 1.5 seconds
    this.intervalTimer = setInterval(() => {
      this.tick();
    }, 1500);
  }

  stop() {
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  tick() {
    if (this.isCruising) {
      // Gentle cruise variance between 68 and 75 km/h
      const variation = (Math.random() - 0.48) * 3;
      this.speed = Math.max(0, Math.min(180, Math.round(this.speed + variation)));
      
      // Increment trip and odo slightly (72 km/h ~ 0.03 km per 1.5s)
      const distanceIncrement = (this.speed / 3600) * 1.5;
      this.trip = parseFloat((this.trip + distanceIncrement).toFixed(1));
      this.odo = Math.round(this.odo + distanceIncrement);
      
      // Micro GPS drift for realism
      this.latitude += (Math.random() - 0.5) * 0.00005;
      this.longitude += (Math.random() - 0.5) * 0.00005;
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
      latitude: this.latitude.toFixed(5),
      longitude: this.longitude.toFixed(5),
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

  setGpsStatus(status) {
    this.gpsStatus = status;
    this.tick();
  }

  setEsp32Status(status) {
    this.esp32Status = status;
    this.tick();
  }

  toggleCruising() {
    this.isCruising = !this.isCruising;
    return this.isCruising;
  }
}

export const demoSimulator = new DemoSimulator();
