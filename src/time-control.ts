/// <reference path="../lib/openrct2.d.ts" />

/**
 * Time control module — pause, unpause, advance_ticks.
 */

var _autoPaused = false;

/** Auto-pause on first tick so no pre-paused save file is needed. */
export function initAutoPause(): void {
    context.subscribe("interval.tick", function () {
        if (!_autoPaused) {
            _autoPaused = true;
            context.executeAction("pausetoggle", {}, function () {
                console.log("[openrct2-bridge] Auto-paused on first tick");
            });
        }
    });

    // Reset flag on scenario change so auto-pause fires again
    context.subscribe("map.changed", function () {
        _autoPaused = false;
    });
}

export function handleTimeControl(endpoint: string, _params: object | undefined, reply: (response: object) => void): boolean {
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
        default:
            return false; // not handled by this module
    }
}
