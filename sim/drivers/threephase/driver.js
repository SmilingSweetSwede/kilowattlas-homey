'use strict';

const Homey = require('homey');

module.exports = class ThreePhaseDriver extends Homey.Driver {
  async onPairListDevices() {
    return [{ name: 'Simulated three-phase meter (3EM)', data: { id: 'sim-threephase' } }];
  }
};
