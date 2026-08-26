/**
 * DEMO SIMULATOR & REALTIME TELEMETRY ENGINE
 * 
 * Provides ultra-smooth 60fps telemetry interpolation, realistic cruising physics,
 * and instant responsive updates matching the dashboard overview.
 */

import { dispatchLocalUpdate } from './firebase.js';
import { maintenanceEngine } from './maintenance-engine.js';

class DemoSimulator {
  constructor() {
    this.speed = 42;
    this.targetSpeed = 42;
    this.odo = 97128.0;
    this.trip = 128.6;
    this.speedLimit = 60;
    this.gpsStatus = "Connected";
    this.esp32Status = "Online";
    this.vehicleStatus = "Normal";
    this.isCruising = true;
    this.rafId = null;
    this.cruisingInterval = null;
    this.lastTime = performance.now();
    
    maintenanceEngine.setCurrentOdo(this.odo);
  }

  start() {
    this.stop();

    // Subtle cruise speed adjustments every 2.5s for natural behavior
    this.cruisingInterval = setInterval(() => {
      if (this.isCruising) {
        // Natural speed variation around 38 - 46 km/h
        const target = 42 + (Math.sin(Date.now() / 1500) * 3.5) + ((Math.random() - 0.5) * 2);
        this.targetSpeed = Math.max(0, Math.min(140, target));
      }
    }, 2000);

    // 60FPS fluid physics loop
    const loop = (now) => {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      // Smooth exponential lerp towards target speed
      if (this.isCruising) {
        this.speed += (this.targetSpeed - this.speed) * Math.min(dt * 3.5, 1);
        
        // Progressively advance trip & odo
        const distanceKm = (this.speed / 3600) * dt;
        this.trip += distanceKm;
        this.odo += distanceKm;
      }

      this.broadcastTelemetry();
      this.rafId = requestAnimationFrame(loop);
    };

    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.cruisingInterval) {
      clearInterval(this.cruisingInterval);
      this.cruisingInterval = null;
    }
  }

  broadcastTelemetry() {
    const roundedSpeed = Math.round(this.speed * 10) / 10;
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];
    const dateStr = now.toISOString().split('T')[0];

    const telemetry = {
      speed: roundedSpeed,
      rawSpeed: this.speed,
      odo: Math.round(this.odo),
      trip: parseFloat(this.trip.toFixed(1)),
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
  }

  setSpeed(val) {
    this.targetSpeed = Number(val);
    this.speed = Number(val);
    this.broadcastTelemetry();
  }

  setSpeedLimit(val) {
    this.speedLimit = Number(val);
    dispatchLocalUpdate('speedLimit', this.speedLimit);
  }

  setOdo(val) {
    this.odo = Number(val);
    maintenanceEngine.setCurrentOdo(this.odo);
    this.broadcastTelemetry();
  }

  resetTrip() {
    this.trip = 0.0;
    this.broadcastTelemetry();
  }
}

export const demoSimulator = new DemoSimulator();

