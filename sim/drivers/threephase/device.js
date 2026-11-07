'use strict';

const SimDevice = require('../../lib/simdevice');

// A clamp meter like a Shelly Pro 3EM: a total plus three phases, with no
// energy classification of its own. Where it sits is a setting, so the
// tester's two realistic cases (on the incoming connection next to the P1,
// or on a sub-circuit) can both be reproduced. Homey Energy does not know
// what this device is until the owner says so in its energy settings; the
// Kilowattlas app must not double count it next to the grid device.
const SHARES = [0.5, 0.3, 0.2];

module.exports = class ThreePhaseDevice extends SimDevice {
  async tick() {
    const flows = this.flows();
    const role = this.getSetting('role') || 'grid';
    const total = role === 'evcharger' ? flows.ev : role === 'home' ? flows.home : flows.grid;
    const hours = this.hoursSinceLastTick();
    await this.set('measure_power', total * 1000);
    for (let i = 0; i < 3; i++) {
      await this.set(`measure_power.l${i + 1}`, Math.round(total * SHARES[i] * 1000));
    }
    await this.meter('meter_power', total, hours);
  }
};
