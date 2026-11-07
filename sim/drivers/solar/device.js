'use strict';

const SimDevice = require('../../lib/simdevice');

// Homey Energy: class solarpanel, measure_power positive while generating.
module.exports = class SolarDevice extends SimDevice {
  profileOptions() {
    return { solarPeakKw: Number(this.getSetting('peak_kw')) || 9.6 };
  }

  async tick() {
    const { solar } = this.flows();
    const hours = this.hoursSinceLastTick();
    await this.set('measure_power', solar * 1000);
    await this.meter('meter_power', solar, hours);
  }
};
