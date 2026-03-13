/// <reference path="../lib/openrct2.d.ts" />

import * as actions from "./actions";
import * as timeControl from "./time-control";

var PORT = 9090;
var PLUGIN_NAME = "openrct2-bridge";
var PLUGIN_VERSION = "0.1.0";

// ── Built-in endpoints ───────────────────────────────────────────────

function getVersion(): object {
    return {
        pluginName: PLUGIN_NAME,
        pluginVersion: PLUGIN_VERSION,
        apiVersion: context.apiVersion,
    };
}

function getStatus(): object {
    return {
        paused: context.paused,
        date: {
            day: date.day,
            month: date.month,
            year: date.year,
            engineTicks: date.ticksElapsed,
            scenarioTicks: timeControl.getScenarioTicks(),
        },
    };
}

// ── Request routing ──────────────────────────────────────────────────

function handleRequest(request: { endpoint: string; params?: object }, reply: (response: object) => void): void {
    // Built-in endpoints (sync — reply immediately)
    switch (request.endpoint) {
        case "health":
            reply({ success: true, payload: { healthy: true } });
            return;
        case "get_version":
            reply({ success: true, payload: getVersion() });
            return;
        case "get_status":
            reply({ success: true, payload: getStatus() });
            return;
    }

    // Time control module (may be async)
    if (timeControl.handleTimeControl(request.endpoint, request.params, reply)) {
        return;
    }

    // Game actions (auto-generated)
    if (actions.handleActions(request.endpoint, request.params, reply)) {
        return;
    }

    reply({ success: false, error: "unknown_endpoint", message: "Unknown endpoint: " + request.endpoint });
}

// ── TCP server ───────────────────────────────────────────────────────

function startServer(): void {
    var server = network.createListener();

    server.on("connection", function (conn) {
        console.log("[" + PLUGIN_NAME + "] Client connected");
        var buffer = "";

        conn.on("data", function (data) {
            buffer += data;
            var lines = buffer.split("\n");

            // Keep the last incomplete chunk in the buffer
            if (lines[lines.length - 1] !== "") {
                buffer = lines.pop() as string;
            } else {
                buffer = "";
                lines.pop();
            }

            for (var i = 0; i < lines.length; i++) {
                if (lines[i].length === 0) {
                    continue;
                }
                try {
                    var request = JSON.parse(lines[i]);
                    handleRequest(request, function (response) {
                        conn.write(JSON.stringify(response) + "\n");
                    });
                } catch (e) {
                    conn.write(JSON.stringify({ success: false, error: String(e) }) + "\n");
                }
            }
        });

        conn.on("close", function () {
            console.log("[" + PLUGIN_NAME + "] Client disconnected");
        });

        conn.on("error", function () {
            console.log("[" + PLUGIN_NAME + "] Connection error");
        });
    });

    server.listen(PORT);
    console.log("[" + PLUGIN_NAME + "] TCP server listening on port " + PORT);
}

// ── Entry point ──────────────────────────────────────────────────────

function main(): void {
    console.log("[" + PLUGIN_NAME + "] Plugin loaded");
    timeControl.initAutoPause();
    startServer();
}

registerPlugin({
    name: PLUGIN_NAME,
    version: PLUGIN_VERSION,
    authors: ["TycoonBench"],
    type: "intransient",
    licence: "MIT",
    targetApiVersion: 110,
    minApiVersion: 70,
    main: main,
});
