'use strict';

/*
 * Kilowattlas Simulator: fills Homey Energy with devices that behave like a
 * real home (solar, grid meter, home battery, EV charger, a three-phase meter
 * like a Shelly Pro 3EM) so the Kilowattlas app can be developed and tested
 * on a Homey without any hardware, e.g. Homey Self-Hosted Server in Docker.
 *
 * Every device derives its value from the same clock-driven profile in
 * lib/profile.js, so the devices agree with each other: what the grid meter
 * shows is home + EV + battery charging - solar - battery discharging.
 *
 * This app is a test fixture. It is never published and must never be paired
 * on a Homey that also runs the real Kilowattlas app against production.
 */

const Homey = require('homey');

module.exports = class SimApp extends Homey.App {
  async onInit() {
    this.log('Kilowattlas Simulator started');
  }
};
