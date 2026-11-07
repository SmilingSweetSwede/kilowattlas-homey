'use strict';

const Homey = require('homey');

module.exports = class BatteryDriver extends Homey.Driver {
  async onPairListDevices() {
    return [{ name: 'Simulated home battery', data: { id: 'sim-battery' } }];
  }
};
