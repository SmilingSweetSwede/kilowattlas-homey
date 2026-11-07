'use strict';

/*
 * Base class for every simulated device: a 10-second tick that reads the
 * shared profile and writes capabilities, plus kWh meters integrated from
 * the power and kept in the device store so they survive a restart.
 */

const Homey = require('homey');
const { snapshot, round3 } = require('./profile');

// One second, so a per-second sender sees fresh values; Homey copes with
// five devices writing a handful of capabilities each second.
const TICK_MS = 1000;

module.exports = class SimDevice extends Homey.Device {
  async onInit() {
    this._lastTick = Date.now();
    await this.tick().catch((err) => this.error('first tick', err));
    this._timer = this.homey.setInterval(() => {
      this.tick().catch((err) => this.error('tick', err));
    }, TICK_MS);
  }

  async onUninit() {
    if (this._timer) this.homey.clearInterval(this._timer);
  }

  /** The profile's numbers right now, with this device's settings applied. */
  flows() {
    return snapshot(new Date(), { timezone: this.timezone(), ...this.profileOptions() });
  }

  /** The Homey's time zone, so the simulated day follows the home's clock. */
  timezone() {
    try {
      return this.homey.clock.getTimezone();
    } catch (err) {
      return undefined;
    }
  }

  /** Subclasses map their settings onto profile options. */
  profileOptions() {
    return {};
  }

  /** Hours since the previous tick, for integrating kWh. */
  hoursSinceLastTick() {
    const now = Date.now();
    const h = (now - this._lastTick) / 3600000;
    this._lastTick = now;
    return h;
  }

  /** Add `kw * hours` to a stored kWh meter and write it to `capability`. */
  async meter(capability, kw, hours) {
    const key = `meter:${capability}`;
    const kwh = round3((this.getStoreValue(key) || 0) + Math.max(0, kw) * hours);
    await this.setStoreValue(key, kwh);
    await this.set(capability, kwh);
  }

  async set(capability, value) {
    if (!this.hasCapability(capability)) return;
    await this.setCapabilityValue(capability, value).catch((err) => this.error(capability, err));
  }

  async tick() {
    throw new Error('tick() not implemented');
  }
};
