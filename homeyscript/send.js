// Kilowattlas · HomeyScript sender, until the Homey app exists.
//
// Use: paste this file into a new HomeyScript named "kilowattlas" and press
// Run. It lists the devices it will read, then prints a link and a code.
// Approve the code on kilowattlas.com; the script fetches its key by itself
// and keeps it in HomeyScript on this Homey. Then add a Flow:
//   WHEN Date & Time "Every 1 minute"  THEN HomeyScript "Run a script" -> kilowattlas
//
// Sent: a timestamp and a kW value (or battery %) per channel. Nothing else:
// no device names, no other devices, no Flows. It only reads; it never
// switches anything. To stop: set UNLINK = true, run once, delete the Flow
// and this script.

// ---- settings ---------------------------------------------------------------

const API_BASE = 'https://api.kilowattlas.com';
const UNLINK = false; // true: disconnect from Kilowattlas and forget the key

// Meters Homey Energy does not classify (a plug, a Shelly 3EM on a
// sub-circuit, a heat pump) are listed on the first run but not sent. To send
// one, add it here with kind heat_pump_power, ev_charger_power or
// device_power (+ a name). A 3EM on the incoming line duplicates the P1 meter:
// leave it out.
const EXTRA = [
  // { device: 'device-id', kind: 'device_power', name: 'Garage' },
];

// One reading per run (the Flow runs every minute). For faster readings, let
// each run loop: INTERVAL_SECONDS = 10, RUN_SECONDS = 55.
const INTERVAL_SECONDS = 60;
const RUN_SECONDS = 0;

// ---- code -------------------------------------------------------------------

// What this script remembers between runs, on this Homey only. Kept per
// server, so a test server and the real one never mix.
const STORE = `kilowattlas:${API_BASE}`;
const state = global.get(STORE) || {};
const save = () => global.set(STORE, state);

async function post(path, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(API_BASE + path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

// Homey Energy's own classification decides what is a channel
// (docs/energy-mapping.md). A device counts in the first group it matches,
// so it is never sent twice. `sign` turns Homey's convention into
// Kilowattlas': a Homey battery is positive while charging, ours while
// discharging.
const GROUPS = [
  { key: 'grid', kind: 'grid_power', sign: 1, is: (d, e) => e.cumulative },
  { key: 'battery', kind: 'battery_power', sign: -1, is: (d, e) => e.homeBattery || d.class === 'battery' },
  { key: 'ev_charger', kind: 'ev_charger_power', sign: 1, is: (d, e) => e.evCharger || d.class === 'evcharger' },
  { key: 'solar', kind: 'gross_production', sign: 1, is: (d, e) => e.generator || d.class === 'solarpanel' },
];

// Returns the channels to send and the power meters left out. Keys follow
// the slot (solar, solar_2...), not the device, so a replaced inverter keeps
// its history; the first solar device is the site's default channel.
function channels(devices) {
  const out = [];
  const left = [];
  const count = {};
  const add = (d, base, kind, sign, cap, name) => {
    const n = (count[base] = (count[base] || 0) + 1);
    const key = base === 'solar' && n === 1 ? 'default' : n === 1 ? base : `${base}_${n}`;
    out.push({ d, key, kind, sign, cap, name });
  };
  for (const d of Object.values(devices).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (!(d.capabilities || []).includes('measure_power')) continue;
    const extra = EXTRA.find((x) => x.device === d.id);
    const group = GROUPS.find((g) => g.is(d, d.energyObj || {}));
    if (extra) {
      const base = extra.kind === 'device_power' ? `device_${d.id}` : extra.kind.replace('_power', '');
      add(d, base, extra.kind, 1, 'measure_power', extra.name);
    } else if (group) {
      add(d, group.key, group.kind, group.sign, 'measure_power');
      if (group.key === 'battery' && d.capabilities.includes('measure_battery')) {
        add(d, 'battery_soc', 'battery_soc', 1, 'measure_battery'); // percent, not kW
      }
    } else {
      left.push(d);
    }
  }
  return { out, left };
}

// A reading in Kilowattlas units: W -> kW with the sign applied, percent as
// is. Homey moves `lastUpdated` only when a value changes, so an old
// timestamp is not a dead device; only `available === false` is skipped.
function value(devices, c) {
  const d = devices[c.d.id];
  const v = d && d.available !== false && d.capabilitiesObj[c.cap] && d.capabilitiesObj[c.cap].value;
  if (typeof v !== 'number') return null;
  return c.cap === 'measure_battery' ? v : Math.round(v * c.sign) / 1000;
}

// Device-code linking, as in the Home Assistant integration (RFC 8628).
// The code survives between runs, so approving later is fine: the next run
// (by hand or from the Flow) picks it up.
async function link() {
  if (!state.code || Date.now() > state.codeExpires) {
    const r = await post('/api/v1/contrib/device/code', { device_brand: 'homey' });
    if (r.status !== 200) throw new Error(`could not start linking (${r.status})`);
    state.code = r.data.device_code;
    state.codeExpires = Date.now() + r.data.expires_in * 1000;
    state.url = `${r.data.verification_uri}?user_code=${r.data.user_code}`;
    save();
  }
  log(`\nTo connect this Homey, open ${state.url} and approve.`);
  // A run by hand and a Flow run can wait here at the same time. The server
  // hands the key out once, so only one of them gets it; the other must pick
  // it up from the store instead of overwriting it with its own older copy.
  const keyFromOtherRun = () => {
    const now = global.get(STORE) || {};
    if (now.token) Object.assign(state, now);
    return Boolean(now.token);
  };
  for (let i = 0; i < 9; i++) { // wait up to 45 s here
    if (keyFromOtherRun()) return true;
    const r = await post('/api/v1/contrib/device/token', { device_code: state.code });
    if (r.status === 200) {
      Object.assign(state, { token: r.data.token, code: null, disabled: (r.data.config || {}).disabled_channels || [] });
      save();
      return log(`Connected: installation ${r.data.site_id}.`) || true;
    }
    if (r.data.error !== 'authorization_pending') {
      if (keyFromOtherRun()) return true; // the other run won the race
      state.code = null; save(); // expired or used: the next run gets a new code
      throw new Error(`linking failed: ${r.data.error || r.status}. Run again.`);
    }
    await wait(5000);
  }
  log('Not approved yet. Run again after approving.');
  return false;
}

// One batch: every channel's current value, declared with its kind (the
// server uses the kind only when it creates the channel). Channels the owner
// switched off on kilowattlas.com are not sent.
async function sendOnce(list) {
  const devices = await Homey.devices.getDevices();
  const ts = new Date().toISOString();
  const send = list.filter((c) => !state.disabled.includes(c.key) && value(devices, c) !== null);
  const r = await post('/api/v1/contrib/solar', {
    channels: send.map((c) => ({ channel_key: c.key, measurement_kind: c.kind, name: c.name })),
    samples: send.map((c) => ({ ts, channel_key: c.key, power_kw: value(devices, c) })),
    donor: { measured_sample_interval_seconds: INTERVAL_SECONDS },
  }, state.token);
  if (r.status === 401) { // disconnected on the web: forget the key, link anew next run
    state.token = null; save();
    throw new Error('Kilowattlas no longer accepts this Homey. Run again to connect anew.');
  }
  if (r.status !== 200) throw new Error(`sending failed (${r.status})`);
  state.disabled = (r.data.config || {}).disabled_channels || state.disabled; save();
  log(`sent ${send.length}, accepted ${r.data.accepted}, rejected ${(r.data.rejected || []).length}`);
  for (const x of r.data.rejected || []) log(`  rejected ${x.channel_key}: ${x.reason}`);
}

// ---- run --------------------------------------------------------------------

if (UNLINK) {
  if (state.token) await post('/api/v1/contrib/revoke', {}, state.token);
  global.set(STORE, null);
  return log('Disconnected. Delete the Flow and this script too.');
}

const devices = await Homey.devices.getDevices();
const { out, left } = channels(devices);

if (!state.token) { // first run: show what will be sent before asking for approval
  log('Will send (kW, battery % for battery_soc; a charging battery is negative):');
  for (const c of out) log(`  ${c.key.padEnd(12)} ${c.d.name}  now ${value(devices, c)}`);
  for (const d of left) log(`Not sent (not classified by Homey Energy): ${d.name}, id ${d.id}`);
  if (!out.length || !(await link())) return;
}

const end = Date.now() + RUN_SECONDS * 1000;
do {
  await sendOnce(out);
  if (Date.now() + INTERVAL_SECONDS * 1000 > end) break;
  await wait(INTERVAL_SECONDS * 1000);
} while (true);
