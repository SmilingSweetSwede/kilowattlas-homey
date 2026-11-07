// Kilowattlas · Homey Energy probe. Read-only: it sends nothing anywhere.
//
// Paste into a new HomeyScript and press Run. It prints what Homey Energy
// knows about your home, so we can check how your devices should be mapped.
// Copy the output to us; remove any line you do not want to share. Nothing
// here is secret: device names, classes and power values.

// Devices that measure power or a battery level, with Homey Energy's
// classification of each (energyObj: cumulative = grid meter, homeBattery,
// evCharger, generator = solar). The 'values' are what Homey reads now.
log(`Kilowattlas probe ${new Date().toISOString()}`);
const sys = await Homey.system.getInfo();
log(`Homey ${sys.homeyModelName} ${sys.homeyVersion}`);

const devices = Object.values(await Homey.devices.getDevices())
  .filter((d) => (d.capabilities || []).some((c) => /^(measure_power|meter_power|measure_battery)/.test(c)))
  .map((d) => ({
    id: d.id,
    name: d.name,
    class: d.class,
    virtualClass: d.virtualClass, // what the owner said is plugged in, if anything
    available: d.available,
    energyObj: d.energyObj,
    values: Object.fromEntries(Object.entries(d.capabilitiesObj || {})
      .filter(([id]) => /^(measure_power|meter_power|measure_battery)/.test(id))
      .map(([id, c]) => [id, c.value])),
  }));
log(JSON.stringify(devices, null, 2));

// What the Energy tab shows right now: totals in W for solar, the grid meter
// (positive = import) and what Homey counts as consumption.
const live = await Homey.energy.getLiveReport();
log(JSON.stringify(live, null, 2));
