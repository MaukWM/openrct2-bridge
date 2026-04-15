/// <reference path="../lib/openrct2.d.ts" />

// Hand-written world query endpoints.
// Serializers (serializeTileElement etc.) are auto-generated in state.ts.

import { serializeTileElement } from "./state";

/**
 * Handle world query endpoints.
 *
 * Returns true if the endpoint was handled, false otherwise.
 */
export function handleWorldQuery(endpoint: string, params: any, reply: (response: object) => void): boolean {
    switch (endpoint) {
        case "get_tile": {
            var tile = map.getTile(params.x, params.y);
            var elements: object[] = [];
            for (var i = 0; i < tile.numElements; i++) {
                elements.push(serializeTileElement(tile.getElement(i)));
            }
            reply({ success: true, payload: { x: params.x, y: params.y, elements: elements } });
            return true;
        }
        case "get_tiles": {
            var x1 = params.x1 as number;
            var y1 = params.y1 as number;
            var x2 = params.x2 as number;
            var y2 = params.y2 as number;
            var tiles: object[] = [];
            for (var tx = x1; tx <= x2; tx++) {
                for (var ty = y1; ty <= y2; ty++) {
                    var t = map.getTile(tx, ty);
                    var elems: object[] = [];
                    for (var ei = 0; ei < t.numElements; ei++) {
                        elems.push(serializeTileElement(t.getElement(ei)));
                    }
                    tiles.push({ x: tx, y: ty, elements: elems });
                }
            }
            reply({ success: true, payload: tiles });
            return true;
        }
        case "get_elements_by_type": {
            // Flat list of serialized elements with tile coords attached.
            var eType = params.type as string;
            var mapSize = map.size;
            var elements: object[] = [];
            for (var etx = 0; etx < mapSize.x; etx++) {
                for (var ety = 0; ety < mapSize.y; ety++) {
                    var et = map.getTile(etx, ety);
                    for (var ei = 0; ei < et.numElements; ei++) {
                        var ee = et.getElement(ei);
                        if (ee.type === eType) {
                            var serialized = serializeTileElement(ee) as any;
                            serialized.tileX = etx;
                            serialized.tileY = ety;
                            elements.push(serialized);
                        }
                    }
                }
            }
            reply({ success: true, payload: elements });
            return true;
        }
        case "get_map_size":
            reply({ success: true, payload: { x: map.size.x, y: map.size.y } });
            return true;
        default:
            return false;
    }
}
