'use strict';

const Homey = require('homey');

module.exports = class GridDriver extends Homey.Driver {
  async onPairListDevices() {
    return [{ name: 'Simulated grid meter (P1)', data: { id: 'sim-grid' } }];
  }
};
