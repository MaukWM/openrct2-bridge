/// <reference path="../lib/openrct2.d.ts" />

/**
 * Track placement enrichment module.
 *
 * Intercepts "trackplace" action, executes via the engine, then enriches the
 * response with: cursor (next placement position), validNext (allowed piece
 * types), and endSlope/endBank (current track end state).
 *
 * Stateless per placement — cursor is computed from segment geometry (O(1)).
 * pyrct2 owns piece list, circuit detection, and piece count.
 * The walk-based track_get_state query is kept as a separate endpoint for
 * when the caller needs ground-truth from the engine (e.g. resync after undo).
 */

import {
    getValidNextSegments,
} from "./generated/track-groups";

var TILE_SIZE = 32;
var MAX_STATIONS = 4;
var MAX_TRACK_PIECES = 10000;

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Find a track element on a tile for a given ride.
 * Returns the element index (within the tile's elements array) or -1.
 * When baseZ is provided, only matches elements at that height (needed when
 * multiple pieces from the same ride overlap on one tile, e.g. helix over station).
 */
function findTrackElementOnTile(tileX: number, tileY: number, rideId: number, baseZ?: number): number {
    try {
        var tile = map.getTile(tileX, tileY);
        for (var i = 0; i < tile.numElements; i++) {
            var el = tile.getElement(i);
            if (el.type === "track" && (el as TrackElement).ride === rideId) {
                if (baseZ !== undefined && el.baseZ !== baseZ) continue;
                return i;
            }
        }
    } catch (e) {
        console.log("[track-enrichment] findTrackElementOnTile error at (" + tileX + "," + tileY + "): " + e);
    }
    return -1;
}

/**
 * Walk from a station and return track end state.
 * Only used by track_get_state for ground-truth queries, not on every placement.
 */
function walkFromStation(rideId: number): {
    endSegment: TrackSegment | null;
    nextPosition: CoordsXYZD | null;
    pieceCount: number;
    circuitComplete: boolean;
} | null {
    var ride: Ride;
    try { ride = map.getRide(rideId); } catch (e) { return null; }
    if (!ride) return null;

    var stations = ride.stations;
    if (!stations) return null;

    for (var s = 0; s < Math.min(stations.length, MAX_STATIONS); s++) {
        var start = stations[s].start;
        // d.ts says start is non-nullable but it can be null at runtime
        if (!start || (start.x <= 0 && start.y <= 0)) continue;

        var tileX = Math.floor(start.x / TILE_SIZE);
        var tileY = Math.floor(start.y / TILE_SIZE);
        var elemIdx = findTrackElementOnTile(tileX, tileY, rideId, start.z);
        if (elemIdx < 0) continue;

        var iter: TrackIterator | null;
        try { iter = map.getTrackIterator({ x: tileX, y: tileY }, elemIdx); } catch (e) { continue; }
        if (!iter) continue;

        var startPos = iter.position;
        var lastSegment = iter.segment;
        var count = 1;
        var isCircuit = false;

        while (true) {
            var hasNext: boolean;
            try { hasNext = iter.next(); } catch (e) { break; }
            if (!hasNext) break;
            count++;
            lastSegment = iter.segment;

            if (count > 1) {
                var pos = iter.position;
                if (pos.x === startPos.x && pos.y === startPos.y &&
                    pos.z === startPos.z && pos.direction === startPos.direction) {
                    isCircuit = true;
                    break;
                }
            }
            if (count > MAX_TRACK_PIECES) break;
        }

        return {
            endSegment: lastSegment,
            nextPosition: iter.nextPosition,
            pieceCount: count,
            circuitComplete: isCircuit,
        };
    }
    return null;
}

/**
 * Compute where the next track piece should be placed from segment geometry.
 *
 * The segment's endX/endY are the displacement from the piece origin to its end,
 * in the direction-0 frame. We rotate by the placement direction, then advance
 * one tile in the exit direction to get the connection point.
 *
 * Coordinate system (empirically verified):
 *   dir 0 → -Y,  dir 1 → +X,  dir 2 → +Y,  dir 3 → -X
 *
 * Rotation from direction-0 frame to world frame:
 *   dir 0: rx =  endX, ry =  endY
 *   dir 1: rx = -endY, ry =  endX
 *   dir 2: rx = -endX, ry = -endY
 *   dir 3: rx =  endY, ry = -endX
 */
function computeNextPosition(
    placeX: number, placeY: number, placeZ: number, direction: number,
    trackType: number
): { x: number; y: number; z: number; direction: number } | null {
    var segment = context.getTrackSegment(trackType);
    if (!segment) return null;

    var endX = segment.endX;
    var endY = segment.endY;
    var endZ = segment.endZ;
    var endDir = segment.endDirection;

    // Rotate segment displacement into world frame
    var rx = 0;
    var ry = 0;
    var dir4 = direction & 3;
    if (dir4 === 0) {
        rx = endX;
        ry = endY;
    } else if (dir4 === 1) {
        rx = -endY;
        ry = endX;
    } else if (dir4 === 2) {
        rx = -endX;
        ry = -endY;
    } else {
        rx = endY;
        ry = -endX;
    }

    var nextDir = (direction + endDir) & 3;

    // Connection point = piece end + one tile advance in exit direction
    var nx = placeX + rx;
    var ny = placeY + ry;
    var nz = placeZ + endZ;
    if (nextDir === 0) {
        ny -= TILE_SIZE;
    } else if (nextDir === 1) {
        nx += TILE_SIZE;
    } else if (nextDir === 2) {
        ny += TILE_SIZE;
    } else if (nextDir === 3) {
        nx -= TILE_SIZE;
    }

    return {
        x: nx,
        y: ny,
        z: nz,
        direction: nextDir,
    };
}

// ── Main handler ────────────────────────────────────────────────────

/**
 * Handle enriched track placement.
 * Computes cursor from segment geometry (O(1), no walk).
 */
export function handleTrackPlace(
    endpoint: string,
    params: any,
    reply: (response: object) => void,
): boolean {
    if (endpoint !== "trackplace") {
        return false;
    }

    context.executeAction("trackplace", params || {}, function (result) {
        if (result.error !== 0) {
            var errResp: any = {
                success: false,
                error: "game_error",
                status: result.error,
            };
            if (result.errorTitle) errResp.title = result.errorTitle;
            if (result.errorMessage) errResp.message = result.errorMessage;
            if (result.cost !== undefined) errResp.cost = result.cost;
            if (result.position) errResp.position = result.position;
            reply(errResp);
            return;
        }

        try {
            var rideType: number = params.rideType;
            var trackType: number = params.trackType;

            var enriched: any = {
                success: true,
                cost: result.cost,
            };

            if (result.position) {
                enriched.placedPosition = {
                    x: result.position.x,
                    y: result.position.y,
                    z: result.position.z,
                };
            }

            var segment = context.getTrackSegment(trackType);
            var endSlope = 0;
            var endBank = 0;
            if (segment) {
                endSlope = segment.endSlope;
                endBank = segment.endBank;
            }
            enriched.endSlope = endSlope;
            enriched.endBank = endBank;

            enriched.cursor = computeNextPosition(
                params.x, params.y, params.z, params.direction, trackType
            );

            enriched.validNext = getValidNextSegments(rideType, endSlope, endBank, false);

            reply(enriched);
        } catch (e) {
            reply({
                success: true,
                cost: result.cost,
                enrichmentError: String(e),
                endSlope: 0,
                endBank: 0,
                validNext: [],
                cursor: null,
            });
        }
    });

    return true;
}

/**
 * Handle track state query — walk the full track for ground-truth state.
 * Use for resync, not on every placement.
 */
export function handleTrackQuery(
    endpoint: string,
    params: any,
    reply: (response: object) => void,
): boolean {
    if (endpoint !== "track_get_state") {
        return false;
    }

    if (!params || params.ride === undefined || params.rideType === undefined) {
        reply({ success: false, error: "invalid_params", message: "ride and rideType required" });
        return true;
    }

    try {
        var rideId: number = params.ride;
        var rideType: number = params.rideType;

        var walkResult = walkFromStation(rideId);
        var endSlope = 0;
        var endBank = 0;
        var cursor: any = null;

        if (walkResult) {
            if (walkResult.endSegment) {
                endSlope = walkResult.endSegment.endSlope;
                endBank = walkResult.endSegment.endBank;
            }
            if (walkResult.nextPosition) {
                cursor = {
                    x: walkResult.nextPosition.x,
                    y: walkResult.nextPosition.y,
                    z: walkResult.nextPosition.z,
                    direction: walkResult.nextPosition.direction,
                };
            }
        }

        var validNext = getValidNextSegments(rideType, endSlope, endBank, false);

        reply({
            success: true,
            payload: {
                cursor: cursor,
                endSlope: endSlope,
                endBank: endBank,
                validNext: validNext,
                circuitComplete: walkResult ? walkResult.circuitComplete : false,
                pieceCount: walkResult ? walkResult.pieceCount : 0,
            },
        });
    } catch (e) {
        reply({ success: false, error: "track_query_error", message: String(e) });
    }

    return true;
}
