'use strict';

const Homey = require('homey');

module.exports = class EvChargerDriver extends Homey.Driver {
  async onPairListDevices() {
    return [{ name: 'Simulated EV charger', data: { id: 'sim-evcharger' } }];
  }
};
