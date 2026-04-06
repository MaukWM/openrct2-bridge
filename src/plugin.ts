/// <reference path="../lib/openrct2.d.ts" />

import * as actions from "./actions";
import * as objects from "./objects";
import * as timeControl from "./time-control";
import * as state from "./state";
import * as world from "./world";

var BASE_PORT = 20020;
var MAX_PORT = 65535;
var PLUGIN_NAME = "openrct2-bridge";
var PLUGIN_VERSION = "1.5.0";

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

    // State queries (sync reads)
    if (state.handleQuery(request.endpoint, request.params, reply)) {
        return;
    }

    // World queries (hand-written, uses generated serializers)
    if (world.handleWorldQuery(request.endpoint, request.params, reply)) {
        return;
    }

    // Object management (hand-written)
    if (objects.handleObjectQuery(request.endpoint, request.params, reply)) {
        return;
    }

    reply({ success: false, error: "unknown_endpoint", message: "Unknown endpoint: " + request.endpoint });
}

// ── TCP server ───────────────────────────────────────────────────────

function startServer(): void {
    var port = BASE_PORT;
    var server = network.createListener();

    // Try ports incrementally until one binds.
    // listen() throws a C++ exception if the port is taken — catch and retry.
    var bound = false;
    while (port <= MAX_PORT) {
        try {
            server.listen(port);
            bound = true;
            break;
        } catch (e) {
            console.log("[" + PLUGIN_NAME + "] Port " + port + " in use, trying next...");
            server = network.createListener();
            port++;
        }
    }

    if (!bound) {
        console.log("[" + PLUGIN_NAME + "] ERROR: Could not bind to any port from " + BASE_PORT + " upward");
        return;
    }

    console.log("[" + PLUGIN_NAME + "] TCP server listening on port " + port);

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
                    conn.write(JSON.stringify({ success: false, error: "parse_error", message: String(e) }) + "\n");
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
}

// ── Entry point ──────────────────────────────────────────────────────

function main(): void {
    console.log("[" + PLUGIN_NAME + "] Plugin loaded");
    timeControl.initScenarioTracking();
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
