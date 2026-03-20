# openrct2-bridge

OpenRCT2 plugin exposing game actions, state queries, and tick-stepping over TCP for programmatic control.

## Protocol

JSON-over-TCP, newline-delimited. The plugin binds to the first available port starting at `20020`, incrementing until a free port is found. The bound port is logged to console.

```
Send:  {"endpoint": "park.cash"}\n
Recv:  {"success": true, "payload": 10000}\n
```

## Endpoints

| Group | Endpoints |
|-------|-----------|
| Built-in | `health`, `get_version`, `get_status` |
| Time control | `pause`, `unpause`, `advance_ticks` |
| Actions | 82 game actions (rides, staff, park, scenery, terraform) |
| State | 77 read endpoints across `park`, `cheats`, `date`, `scenario`, `climate` |

## Generated code

`src/actions.ts` and `src/state.ts` are auto-generated from OpenRCT2 source by [openrct2-codegen](https://github.com/TycoonBench/openrct2-codegen). Do not edit manually.

## pyrct2

[pyrct2](https://github.com/TycoonBench/pyrct2) is the Python client library for this plugin — typed Pydantic models and a full action/state API over this TCP protocol.
