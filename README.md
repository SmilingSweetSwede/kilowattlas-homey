# Kilowattlas · Homey app

Share what [Homey Energy](https://homey.app/en-se/energy/) measures with
[Kilowattlas](https://kilowattlas.com), the public live map of Swedish home
energy. The Homey counterpart of the
[Home Assistant integration](https://github.com/SmilingSweetSwede/kilowattlas-homeassistant):
same server, same channels, same privacy rules.

**Status: pre-release.** The app itself is not written yet. This repository
holds what comes first:

| Path | What |
|---|---|
| `homeyscript/probe.js` | Read-only HomeyScript that prints what Homey Energy knows about a home. Phase 1. |
| `homeyscript/send.js` | HomeyScript that sends Homey Energy's readings to Kilowattlas before the app exists. Finds the devices itself, links with a device code and keeps its key in HomeyScript; nothing to fill in. Phase 1. |
| `sim/` | A Homey app with simulated solar, grid (P1), home battery, EV charger and three-phase (3EM-like) devices, so the real app can be developed on a Homey without hardware. Never published. |
| `docs/energy-mapping.md` | Homey Energy kinds → Kilowattlas kinds, keys and signs. The one place this is defined. |
| `docs/tester-onboarding.md` | What the beta tester gets (Swedish). |
| `scripts/check_shipped_source.py` | Everything that ships is plain source kept here. Runs in CI. |

## Development

Requirements: Node.js 24 or newer, Docker, the Homey CLI
(`npm install --global homey`), an Athom account (`homey login`).

A Homey to run against: a Homey Pro, or
[Homey Self-Hosted Server](https://homey.app/en-se/homey-self-hosted-server/)
in Docker (30 days free, then a licence). The Kilowattlas dev stack starts one
with `docker compose --profile homey up -d homey-shs`, with ports 4859–4862
published. Open the firewall for them (`sudo ufw allow 4859:4862/tcp`), then
activate it from the Homey phone app on the same Wi-Fi ("Add Homey →
Self-Hosted Server", enter `http://<laptop-ip>:4859` by hand; a guest or
office network with client isolation will not work), then:

```bash
homey login
homey list            # the Self-Hosted Server shows up like any Homey
homey select          # pick it

cd sim
homey app run         # the simulator; Ctrl+C removes it again
# or: homey app install, to leave it running
```

Pair one device of each simulated driver (Devices → + → Kilowattlas
Simulator). Homey Energy sorts them under solar, home battery, EV charger and
the cumulative meter by itself; the three-phase meter is a plain sensor whose
role (incoming line or a sub-circuit) is a device setting, for the
double-counting cases in `docs/energy-mapping.md`. Every device follows one
deterministic day (`sim/lib/profile.js`), so the grid meter always equals home
+ EV + battery charging − solar − battery discharging.

Then run `homeyscript/probe.js` in HomeyScript against the simulated home and
compare with a real one.

To send from the simulated home to the dev backend,
`./scripts/make_send_local.sh [--fast]` writes `homeyscript/send.dev.local.js`
(API base `http://backend:8050`). Paste it into a HomeyScript, run it, and
approve the code it prints on the dev stack's `/link` page.

The real app (planned layout: `app.js`, `lib/mapping.js`, `lib/client.js`,
`settings/`) will talk to the Kilowattlas API the way
[aiokilowattlas](https://github.com/SmilingSweetSwede/aiokilowattlas) does:
device-code linking, `POST /api/v1/contrib/solar`, `config.disabled_channels`.
Its API base is a setting so it can point at a local backend.

## Rules for changes

- Everything the Homey CLI packages is plain, readable JavaScript kept in
  this repository: no bundles, no minified or generated files, nothing built
  from another repository. `scripts/check_shipped_source.py` enforces this.
- Homey Energy is the model of the home. The app reads what Homey Energy
  already classifies; `docs/energy-mapping.md` is the one mapping.
- Measurement only: nothing here ever switches or sets a device.
- The owner decides per channel. A channel the server lists in
  `config.disabled_channels` is not sent.

## Before a release

1. `python3 scripts/check_shipped_source.py`
2. `node --test` and `homey app validate --level publish`
3. Review the whole repository as an Athom reviewer would: every shipped file
   readable source, no secrets, version bumped in `.homeycompose/app.json`.
4. The Kilowattlas API accepts every kind the release declares; then publish.

## Privacy

Sent: the home's position once at linking, each reading of the shared
channels with its timestamp, the battery capacity, and a revoke request when
the app is disconnected. Shown publicly, at about 100 m, without name or
account: production and battery. Only to the owner: grid, home and devices.
Each channel can be set to public, only you, or off on kilowattlas.com. The
service is free and does not sell data.

## Limitations

Measurements only: no control of any device and no market bidding. Prices are
added server-side; nothing is read from Homey's dynamic electricity prices.

## Licence

MIT. Not affiliated with Athom B.V.; Homey is their trademark.
