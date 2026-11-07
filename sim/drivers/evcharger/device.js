'use strict';

const SimDevice = require('../../lib/simdevice');

// Homey Energy EV charger: measure_power positive while the car charges.
module.exports = class EvChargerDevice extends SimDevice {
  profileOptions() {
    return { evChargeKw: Number(this.getSetting('charge_kw')) || 11 };
  }

  async tick() {
    const { ev } = this.flows();
    const hours = this.hoursSinceLastTick();
    const charging = ev > 0;
    await this.set('measure_power', ev * 1000);
    await this.set('evcharger_charging', charging);
    await this.set('evcharger_charging_state', charging ? 'plugged_in_charging' : 'plugged_in');
    await this.meter('meter_power', ev, hours);
  }
};
