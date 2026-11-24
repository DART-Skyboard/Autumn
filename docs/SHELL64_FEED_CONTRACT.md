# Shell 64 → LEATR activity feed: contract v1

One feed drives the Shell 64 x-ray node on every client (Autumn web, Autumn iOS, JOTS, Session Cube).
Shell 64 prompt text never enters the feed. It carries op names and numbers only.

## 1. Producer: shell64.dartmeadow.com (`js/leatr-beacon.js`)
- **Throttled POST**, at most 1 every 2 s per tab, to the shared Apps Script `AUTUMN_GAS_URL`
  (`…/AKfycbyzkQ…/exec`). Sent as `Content-Type: text/plain` because Apps Script can't answer a CORS preflight.
  ```json
  {"action":"shell64event","sid":"s64_k3j9x2ab1c2d","n":3,"total":17,
   "events":[{"op":"weight|convert|preset|reflex","mode":"weight|reflex","ts":1795480000000,
              "stats":{"params":7000000000,"qbits":4,"baseBits":32,"group":128,"quantBytes":3758096384,
                       "denseBytes":28000000000,"ratio":7.45,"precision":1,"shellBytes":2702392,
                       "tokens":4,"shell":"GEO","emotion":"joy"}}]}
  ```
  `sid` matches `^s64_[a-z0-9]{6,24}$` (random, one per tab). Up to 20 events per batch; `n` = calcs since the last batch.
- **BroadcastChannel `'leatr-shell64'`** sends `{type:'shell64calc', sid, total, ev}` per calc and `{type:'shell64idle', sid}` on pagehide.
  BroadcastChannel is **same-origin only**, so it doesn't cross from shell64.dartmeadow.com to leatr.xyz.
  It only helps same-origin embeds and tests. The Apps Script path is the real global path.

## 2. Server: Apps Script `gas/presence.gs` (leatr-ash)
**`readnodes`** (both scopes) and **`GET ?action=shell64activity`** return this summary as `shell64`:
```json
{"v":1,"ts":1795480001234,"active":2,
 "sessions":[{"sid":"s64_k3j9x2ab1c2d","ts":1795480001000,"n":17,"op":"weight","mode":"weight"}],
 "calcsPerMin":42,"lastTs":1795480001000,"total":1234,
 "recent":[{"op":"preset","mode":"weight","detail":"70B INT4 -> 34.92 GiB","ts":1795480000900,"s":"k3j9"}]}
```
- A session is `active` while its last batch is under **15 s** old. `sessions` lists up to 12, newest first.
- `n` is the session's cumulative calc count. **A client treats a session as calculating whenever its `n` changes.**
- `calcsPerMin` is a sliding 60 s estimate. `total` is a cache-lifetime total (best effort).

**Persisted file** `ashtree/analytics-live/shell64/live.json`. It's read through the existing allow-listed `?action=ashread&path=…`,
written at most every 2 min, and only when there was new activity.
```json
{"schema":"leatr.shell64.live/1","updatedAt":"2026-11-24T02:00:00.000Z","totalCalcs":5321,"activeSessions":2,
 "calcsPerMin":42,"lastActivityAt":"…","minutes":[{"t":1795479960000,"n":31}],
 "recent":[{"ts":"…","op":"weight","mode":"weight","detail":"7B INT4 -> 3.50 GiB"}]}
```
At most every 10 min, an aggregated `{ts, category:"shell64", label:"calc_<op>", detail:"<count>x · <last detail>"}`
is appended to the shared analytics chunk `ashtree/analytics-live/<mazeId>/chunk-<i>.json`.

## 3. Consumer behaviour (match the web: `Autumn/js/shell64-node-module.js`)
| Rule | Value |
|---|---|
| Poll | Reuse the existing 5 s `readnodes` poll; read `.shell64` (no extra request) |
| Visible groups | One per session whose `n` changed recently; newest first; **max 6** |
| Idle → fade | No `n` change for **6 s** → fade over **3 s** → remove (gone ~9 s after the last calc) |
| LIVE FEED off | Hide all Shell 64 groups immediately |
| Rate drive | `rate = clamp(ln(1+calcsPerMin)/ln(121), 0, 1)` drives scanline speed, static grain, sparkle twinkle, pulse speed and emblem spin |
| Scale | Group's largest dimension = **1/6 of the outer buoyancy shell diameter** (r 1.9 → **0.633** scene units) |
| Seat | The rail runs straight through the centre of the 4-figure ring, its top just under the lowest thigh underside |
| Emblem | Rests low in the ring centre (`emblemRestY`, scale 0.35); while active it rises ~2 s to `emblemHoverY` (scale 1), bobs ±0.06·k, counter-rotates Outer (+Y), Middle (−Y·1.4, +Z), Core (X, Y), and the Gem spins and pulses; on idle it eases back down as the group fades |
| Slots | Slot 0 anchor (1.55, 1.30, 0.65); others spread around the upper hemisphere just outside the outer shell |

## 4. Asset (`ios-asset/`)
- `shell64-node.usdz` (ARKit/SceneKit/RealityKit; `SCNScene(url:)` loads it). Scene units, Y up. Origin = the curve centre at the seat; **+Z = curve tangent**.
  - `/Shell64Node/Figures/Figure_0…3`: the four huddled figures, baked into the seat frame (~194k tris total).
  - `/Shell64Node/Emblem` (translate `emblemRestY`, scale 0.35) holds the separately animatable nodes `Outer`, `Middle` and `Core`, plus `Core/Gem`.
  - The prim's customData carries `groupMaxDim`, `curveRadius`, `emblemRestY`, `emblemHoverY`, `emblemRestScale`.
  - The materials are placeholder UsdPreviewSurface (translucent + emissive). Replace them with the x-ray Fresnel/scanline shader modifier to match the web.
- `s64-meshopt-safe.glb` is the exact web asset (meshopt). `shell64-node-source.glb` is Justin's uncompressed Nomad export.
- Web x-ray shader: `rim = pow(1-|N·V|, 2.2)`; scanlines `smoothstep(.86,1,sin(y/k*420 - t*(6+10·rate))·.5+.5)`;
  grain `step(.985-.03·act-.02·rate, hash(floor(fragCoord*.7)+floor(t*24)))`; additive blend, no depth write, double-sided.
  Palette per figure: cyan `#7cf6ff`, violet `#9b7bff`, green `#39ff9c`, pink `#ff6ad5` (rim tint toward white).
  Emblem: outer `#7f93a8`, middle `#c8923a`, core `#1f9c98`, gold seam/arc `#e0b04f`, gem `#37e8ff`.
