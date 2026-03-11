/// <reference path="../lib/openrct2.d.ts" />

/**
 * Time control module — pause, unpause, advance_ticks.
 */

var _autoPaused = false;
var _advancing = false;
var _scenarioStartTick = 0;

/** Auto-pause on first tick so no pre-paused save file is needed. */
export function initAutoPause(): void {
    context.subscribe("interval.tick", function () {
        if (!_autoPaused) {
            _autoPaused = true;
            _scenarioStartTick = date.ticksElapsed;
            context.executeAction("pausetoggle", {}, function () {
                console.log("[openrct2-bridge] Auto-paused on first tick");
            });
        }
    });

    // Reset flag on scenario change so auto-pause fires again
    context.subscribe("map.changed", function () {
        _autoPaused = false;
        _scenarioStartTick = 0;
    });
}

/** Unpause, count N ticks, re-pause, then reply. */
function advanceTicks(params: { ticks?: number } | undefined, reply: (response: object) => void): void {
    var ticks = params && params.ticks;
    if (typeof ticks !== "number" || ticks < 1 || Math.floor(ticks) !== ticks) {
        reply({ success: false, error: "params.ticks must be a positive integer" });
        return;
    }
    if (_advancing) {
        reply({ success: false, error: "advance_ticks already in progress" });
        return;
    }

    _advancing = true;
    var startTick = date.ticksElapsed;
    var targetTick = startTick + ticks;

    function onTick(): void {
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
