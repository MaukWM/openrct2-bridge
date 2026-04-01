/// <reference path="../lib/openrct2.d.ts" />

/**
 * Time control module — pause, unpause, advance_ticks.
 */

var PROGRESS_INTERVAL = 100;
var _advancing = false;
var _scenarioStartTick = 0;
var _scenarioStartRecorded = false;

/** Track when the scenario starts. */
export function initScenarioTracking(): void {
    context.subscribe("interval.tick", function () {
        if (!_scenarioStartRecorded) {
            _scenarioStartRecorded = true;
            _scenarioStartTick = date.ticksElapsed;
            console.log("[openrct2-bridge] Scenario start tick: " + _scenarioStartTick);
        }
    });

    // Reset on scenario change so we re-record on the next scenario
    context.subscribe("map.changed", function () {
        _scenarioStartRecorded = false;
        _scenarioStartTick = 0;
    });
}

/** Unpause, count N ticks, re-pause, then reply. */
function advanceTicks(params: { ticks?: number } | undefined, reply: (response: object) => void): void {
    var ticks = params && params.ticks;
    if (typeof ticks !== "number" || ticks < 1 || Math.floor(ticks) !== ticks) {
        reply({ success: false, error: "invalid_params", message: "params.ticks must be a positive integer" });
        return;
    }
    if (_advancing) {
        reply({ success: false, error: "already_in_progress", message: "advance_ticks already in progress" });
        return;
    }

    _advancing = true;
    var startTick = date.ticksElapsed;
    var targetTick = startTick + ticks;
    var lastProgressTick = 0;

    function onTick(): void {
        var elapsed = date.ticksElapsed - startTick;

        // Send progress heartbeat every PROGRESS_INTERVAL ticks (but not on the final tick).
        // Uses >= instead of modulo so a skipped tick doesn't silently miss a heartbeat.
        if (elapsed - lastProgressTick >= PROGRESS_INTERVAL && date.ticksElapsed < targetTick) {
            lastProgressTick = elapsed;
            reply({ type: "progress", ticksElapsed: elapsed, target: ticks });
        }

        if (date.ticksElapsed >= targetTick) {
            sub.dispose();
            // Re-pause the game
            context.executeAction("pausetoggle", {}, function () {
                _advancing = false;
                reply({
                    success: true,
                    payload: {
                        ticksAdvanced: date.ticksElapsed - startTick,
                        startTick: startTick,
                        endTick: date.ticksElapsed,
                        paused: context.paused,
                    },
                });
            });
        }
    }

    var sub = context.subscribe("interval.tick", onTick);

    // Unpause to start ticking
    if (context.paused) {
        context.executeAction("pausetoggle", {}, function () {
            // Ticks will now fire, onTick counts them down
        });
    }
}

/** Ticks elapsed since the current scenario was loaded. */
export function getScenarioTicks(): number {
    return date.ticksElapsed - _scenarioStartTick;
}

export function handleTimeControl(endpoint: string, params: object | undefined, reply: (response: object) => void): boolean {
    switch (endpoint) {
        case "pause":
            if (context.paused) {
                reply({ success: true, payload: { paused: true } });
            } else {
                context.executeAction("pausetoggle", {}, function () {
                    reply({ success: true, payload: { paused: context.paused } });
                });
            }
            return true;
        case "unpause":
            if (!context.paused) {
                reply({ success: true, payload: { paused: false } });
            } else {
                context.executeAction("pausetoggle", {}, function () {
                    reply({ success: true, payload: { paused: context.paused } });
                });
            }
            return true;
        case "advance_ticks":
            advanceTicks(params as { ticks?: number } | undefined, reply);
            return true;
        default:
            return false; // not handled by this module
    }
}
