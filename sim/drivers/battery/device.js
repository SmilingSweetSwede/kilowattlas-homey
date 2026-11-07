'use strict';

const SimDevice = require('../../lib/simdevice');

// Homey Energy home battery: measure_power positive = charging, negative =
// discharging; measure_battery is the state of charge in percent.
// NOTE the sign is the opposite of Kilowattlas' battery_power.
module.exports = class BatteryDevice extends SimDevice {
  profileOptions() {
    return { batteryMaxKw: Number(this.getSetting('max_kw')) || 5 };
  }

  async tick() {
    const { battery } = this.flows();
    const hours = this.hoursSinceLastTick();
    const capacity = Number(this.getSetting('capacity_kwh')) || 10;

    // Integrate the state of charge, clamped so a long simulated day never
    // drives it out of range; the power itself is not limited by it.
    let soc = this.getStoreValue('soc');
    if (typeof soc !== 'number') soc = 50;
    soc = Math.min(100, Math.max(5, soc + ((battery * hours) / capacity) * 100));
    await this.setStoreValue('soc', soc);

    await this.set('measure_power', battery * 1000);
    await this.set('measure_battery', Math.round(soc));
    await this.meter('meter_power.charged', battery, hours);
    await this.meter('meter_power.discharged', -battery, hours);
  }
};
