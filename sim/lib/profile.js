'use strict';

/*
 * One deterministic day of a Swedish home, as a pure function of the clock.
 *
 * All powers are in kW. Signs follow Homey Energy, so that the devices can
 * write them straight into measure_power:
 *   solar      >= 0   generating
 *   home       >= 0   the whole home's load, EV excluded
 *   ev         >= 0   the charger's load
 *   battery    signed positive = charging, negative = discharging (Homey's
 *              sign for a home battery; Kilowattlas' battery_power is the
 *              opposite, positive = discharging; see docs/energy-mapping.md)
 *   grid       signed positive = import from the grid, negative = export
 *
 * The battery follows a simple self-consumption policy: charge from solar
 * surplus during the day, discharge into the evening deficit. Both are
 * capped by maxKw and do not look at the state of charge, so that every
 * device can compute the same numbers from the time alone; the battery
 * device integrates its own SoC for display and clamps it.
 */

const DEFAULTS = {
  solarPeakKw: 9.6,
  batteryMaxKw: 5,
  evChargeKw: 11,
};

// Small, smooth, deterministic "weather" so values are not perfectly flat.
function wobble(minuteOfDay, period, amplitude) {
  return 1 + amplitude * Math.sin((2 * Math.PI * minuteOfDay) / period);
}

// Clouds only ever take away: solar never exceeds the declared peak, so the
// server's exceeds_capacity check stays a real check and not simulator noise.
function clouds(minuteOfDay, period, depth) {
  return 1 - depth * (0.5 + 0.5 * Math.sin((2 * Math.PI * minuteOfDay) / period));
}

function solarKw(hourFloat, minuteOfDay, peakKw) {
  if (hourFloat <= 6 || hourFloat >= 18) return 0;
  const bell = Math.sin((Math.PI * (hourFloat - 6)) / 12) ** 1.5;
  return round3(peakKw * bell * clouds(minuteOfDay, 37, 0.25));
}

function homeKw(hourFloat, minuteOfDay) {
  let kw = 0.35;
  if (hourFloat >= 6.5 && hourFloat < 9) kw += 1.4; // breakfast, showers
  if (hourFloat >= 17 && hourFloat < 22) kw += 1.9; // cooking, evening
  if (hourFloat >= 11 && hourFloat < 13) kw += 0.6; // lunch
  return round3(kw * wobble(minuteOfDay, 11, 0.08));
}

function evKw(hourFloat, chargeKw) {
  // Plugged in after work, charging 22:00 to 01:00.
  return hourFloat >= 22 || hourFloat < 1 ? chargeKw : 0;
}

function batteryKw(solar, home, hourFloat, maxKw) {
  const surplus = solar - home;
  if (surplus > 0.1) return round3(Math.min(surplus, maxKw)); // charging
  if (hourFloat >= 17 && hourFloat < 23.5) return round3(-Math.min(-surplus, maxKw)); // discharging
  return 0;
}

function round3(x) {
  return Math.round(x * 1000) / 1000;
}

// Wall-clock time of `date` in `timezone` (an IANA name such as
// Europe/Stockholm). Apps on Homey run with the process clock in UTC, so the
// day must be placed in the home's own time zone or the sun shines at 18:00.
function localClock(date, timezone) {
  if (!timezone) {
    return { h: date.getHours(), m: date.getMinutes(), s: date.getSeconds() };
  }
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { h: get('hour') % 24, m: get('minute'), s: get('second') };
}

/**
 * Snapshot of every flow at `date`, read as wall-clock time in
 * `opts.timezone` (the Homey's time zone; the process clock when omitted).
 * The other `opts` override DEFAULTS.
 */
function snapshot(date, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const { h, m, s } = localClock(date, o.timezone);
  const hourFloat = h + m / 60 + s / 3600;
  const minuteOfDay = h * 60 + m;
  const solar = solarKw(hourFloat, minuteOfDay, o.solarPeakKw);
  const home = homeKw(hourFloat, minuteOfDay);
  const ev = evKw(hourFloat, o.evChargeKw);
  const battery = batteryKw(solar, home, hourFloat, o.batteryMaxKw);
  const grid = round3(home + ev + battery - solar);
  return { solar, home, ev, battery, grid };
}

module.exports = { DEFAULTS, snapshot, round3 };
