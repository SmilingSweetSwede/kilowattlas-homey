# Homey Energy → Kilowattlas channels

Homey Energy is this app's model of a home, as the Energy dashboard is for the
Home Assistant integration. Every channel is one thing Homey Energy already
classifies; the app adds no classification of its own. The table is the single
source for kinds, keys and signs. **Rows marked *verify* rest on the Apps SDK
documentation only and must be confirmed with `homeyscript/probe.js` on a real
Homey (phase 1) before the app relies on them.**

| Homey Energy | How Homey marks it | Capability read | Homey sign | Kilowattlas kind | channel key | Sign factor | Shown |
|---|---|---|---|---|---|---|---|
| Solar panel | driver `class: solarpanel` | `measure_power` (W) | positive = generating | `gross_production` | `""` (server: `default`), `solar_2`… | +1 | public |
| Grid connection (P1 / clamp on the incoming line) | `energy.cumulative: true` | `measure_power` (W) | positive = import, negative = export (*verify*) | `grid_power` (stored as `net_export`, sign flipped by the server) | `grid`, `grid_2`… | +1 | owner only |
| Home battery | `class: battery`, `energy.homeBattery: true` | `measure_power` (W) | positive = charging, negative = discharging | `battery_power` (positive = discharging) | `battery`… | **−1** | public |
| Home battery state of charge | same device | `measure_battery` (%) | 0–100 | `battery_soc` (percent carried in `power_kw`) | `battery_soc`… | +1 | public |
| Whole home load | Homey Energy's live report (*verify* which field) or cumulative − solar + battery (*verify*) | report field | ≥ 0 | `consumption` | `consumption` | +1 | owner only |
| EV charger | `class: evcharger`, `energy.evCharger: true` | `measure_power` (W) | positive = charging the car | `ev_charger_power` | `ev_charger` | +1 | owner only |
| Heat pump | no Homey class; a `measure_power` device the owner points out | `measure_power` (W) | ≥ 0 | `heat_pump_power` | `heat_pump` | +1 | owner only |
| Any other metered device (plug, 3EM on a sub-circuit) | `measure_power` device, not cumulative | `measure_power` (W) | ≥ 0 | `device_power` with `name` | `device_<homey device id>` | +1 | owner only |

Units: Homey reports W, Kilowattlas takes kW (`power_kw = W / 1000`).
Timestamps: the capability's `lastUpdated`, in ISO 8601 UTC.

## Rules carried over from the Home Assistant integration

- A channel key follows the *slot* (the n-th solar device, the battery), not
  the device, so that swapping an inverter keeps the server-side history.
- The server applies a declared kind only when it creates the channel and
  never relabels an existing one. Declaring a different kind for an existing
  key is harmless; declaring an unknown kind rejects the whole batch.
- `config.disabled_channels` from the server lists what the owner switched
  off on kilowattlas.com; those channels are not sent and not declared.
- Loads are never negative. A negative reading on a load channel is rejected
  by the server (`negative_power`); the app sends the value as is and lets the
  server say so, rather than hiding a sign error by clamping.
- Solar above the declared peak is rejected (`exceeds_capacity`). The owner
  enters the peak on kilowattlas.com; the app never guesses it.

## Double counting

The two realistic traps, both present in the tester's home:

1. **A three-phase clamp meter (Shelly Pro 3EM) on the incoming line next to
   a P1 meter.** Both measure the grid connection. Only the device Homey
   Energy treats as cumulative is `grid_power`; the other is not sent at all
   (or, if the owner wants it, as a named `device_power` for comparison,
   knowing that it is not a load).
2. **A clamp meter on a sub-circuit** (EV charger, heat pump). It is that
   load, not the grid: `ev_charger_power` or `heat_pump_power` with the
   owner's choice, or `device_power` with the meter's name.

A device Homey Energy lists under "cumulative" and a device under "solar",
"battery" or "EV charger" never overlap; everything else is a load the owner
decides about. The simulator's `threephase` driver reproduces both traps.

## What the probe showed (Homey Self-Hosted Server 13.5.3, simulated home, 2026-11-07)

- **`energy.getLiveReport()`** returns one zone with three totals in W:
  `totalGenerated` (solar), `totalCumulative` (the cumulative meter; negative
  while exporting, so Homey's sign is positive = import, as assumed) and
  `totalConsumed`. `items[]` holds one entry per `generator`, one per
  `cumulative` device and one per zone; the battery, the EV charger and
  unclassified meters are not listed separately, only summed into the zone.
  Per-device values therefore come from the devices, not from the report.
- **`totalConsumed` is the sum of the devices Homey counts as loads**, not
  solar + import − battery. In the simulated home it was 2694 W: the battery
  charging at 5000 W plus the unclassified three-phase meter at −2306 W. An
  unclassified meter counts as a load even with a negative value. This is
  the double-counting trap from above, seen in Homey's own numbers.
- Homey has **no figure for the home's own load**. A `consumption` channel
  must be derived: solar + grid import − battery charging + battery
  discharging − EV charging (all in Homey's signs: solar + cumulative −
  battery − evCharger), and only when a cumulative device exists. Whether to
  send a derived channel at all is an open decision; the Home Assistant
  integration sends only what the user configured.
- **Device objects** expose the energy configuration as `energyObj`
  (`cumulative`, `cumulativeImportedCapability`, `homeBattery`, `evCharger`,
  `electricCar`, `generator`, `approximation`, plus the current `W`); the
  `energy` property is null. Values with `lastUpdated` are in
  `capabilitiesObj`. The device `settings` carry no energy keys.
- **`energy.getReportDay({date})`** gives 5-minute mean series for the day
  (`generatedMeasurePower`, `cumulativeMeasurePower`, W) and per-hour kWh in
  `subReports` for imported, exported, generated, consumed, battery charged
  and discharged, EV charged. Solar and grid can thus be back-filled at
  5-minute resolution after an outage; battery and EV only hourly.
- `energy.getState()` returned null; `getCurrency()` returned "SEK".
- **All five simulated devices as Homey sees them** (second run, 15:10
  local): solar `generator: true`; grid `cumulative: true` with the
  imported/exported capabilities named; battery `homeBattery: true`,
  `meterPowerImportedCapability: meter_power.charged`, `measure_power`
  +5000 W while charging, `measure_battery` 99 %; EV charger
  `evCharger: true`, `meterPowerImportedCapability: meter_power`; the
  three-phase meter has every `energyObj` key null, yet its −1442 W is
  inside `totalConsumed` (3558 = 5000 − 1442). The derived home load,
  solar + cumulative − battery − evCharger = 221 W, matches the simulator.
- **`lastUpdated` moves only when the value changes.** The battery's
  `measure_power` kept a timestamp an hour old while charging at a steady
  5000 W. A client must not treat an old timestamp as a dead device; it
  stamps each reading with the time it was read and trusts
  `device.available` instead. `send.js` does this now.

## How `homeyscript/send.js` applies this table

It classifies by `energyObj` and device class, in this order, and puts a
device in the first group it matches: `cumulative` → grid, `homeBattery` or
class `battery` → battery (+ `measure_battery` as state of charge),
`evCharger` or class `evcharger` → EV charger, `generator` or class
`solarpanel` → solar. Within a group, devices are numbered by Homey device
id. A power meter that matches none of them (a plug, a 3EM) is listed and
not sent until the owner adds it to `EXTRA` with a kind. No derived
`consumption` channel is sent.

## Open questions for the probe (remaining)

- The grid device's sign on a real P1 dongle and on the Shelly app's 3EM
  (confirmed only for the simulator so far).
- Where the owner's "what's plugged in" choice for a plug or a clamp meter
  shows up (`virtualClass` was null for every simulated device).
- How a running app is told about capability changes: `devices.connect()` +
  `device.update`, or a per-device capability instance.
- Whether Insights can replay the last days after an outage (the Home
  Assistant integration replays up to 10 days from the recorder).
