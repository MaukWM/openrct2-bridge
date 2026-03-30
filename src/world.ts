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
        case "get_map_size":
            reply({ success: true, payload: { x: map.size.x, y: map.size.y } });
            return true;
        default:
            return false;
    }
}
