'use strict';

const Homey = require('homey');

module.exports = class SolarDriver extends Homey.Driver {
  async onPairListDevices() {
    return [{ name: 'Simulated solar', data: { id: 'sim-solar' } }];
  }
};
