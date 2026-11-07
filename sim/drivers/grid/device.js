'use strict';

const SimDevice = require('../../lib/simdevice');

// Homey Energy's cumulative device: the whole home's connection point.
// measure_power positive = import from the grid, negative = export.
module.exports = class GridDevice extends SimDevice {
  async tick() {
    const { grid } = this.flows();
    const hours = this.hoursSinceLastTick();
    await this.set('measure_power', grid * 1000);
    await this.meter('meter_power.imported', grid, hours);
    await this.meter('meter_power.exported', -grid, hours);
  }
};
