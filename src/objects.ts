/// <reference path="../lib/openrct2.d.ts" />

// Hand-written object management endpoints.
// Uses ObjectManager API to query loaded objects and load new ones.

function serializeLoadedObject(obj: LoadedObject, objType: string): object {
    if (objType === "ride") {
        var ro = obj as RideObject;
        return {
            index: ro.index,
            identifier: ro.identifier,
            name: ro.name,
            rideType: ro.rideType,
            carsPerFlatRide: ro.carsPerFlatRide,
        };
    }
    return {
        index: obj.index,
        identifier: obj.identifier,
        name: obj.name,
    };
}

/**
 * Handle object management endpoints.
 *
 * Returns true if the endpoint was handled, false otherwise.
 */
export function handleObjectQuery(endpoint: string, params: any, reply: (response: object) => void): boolean {
    switch (endpoint) {
        case "get_objects": {
            var objType = params.type as string;
            var allObjects = objectManager.getAllObjects(objType as ObjectType);
            var result: object[] = [];
            for (var i = 0; i < allObjects.length; i++) {
                if (allObjects[i] != null) {
                    result.push(serializeLoadedObject(allObjects[i], objType));
                }
            }
            reply({ success: true, payload: result });
            return true;
        }
        case "get_object": {
            var getObjType = params.type as string;
            var getObjId = params.identifier as string;
            var searchObjects = objectManager.getAllObjects(getObjType as ObjectType);
            var found = false;
            for (var si = 0; si < searchObjects.length; si++) {
                if (searchObjects[si] != null && searchObjects[si].identifier === getObjId) {
                    reply({ success: true, payload: serializeLoadedObject(searchObjects[si], getObjType) });
                    found = true;
                    break;
                }
            }
            if (!found) {
                reply({
                    success: false,
                    error: "not_loaded",
                    message: "Object not loaded: " + getObjId,
                });
            }
            return true;
        }
        case "load_object": {
            var identifier = params.identifier as string;
            var loaded = objectManager.load(identifier);
            if (loaded != null) {
                reply({
                    success: true,
                    payload: {
                        index: loaded.index,
                        identifier: loaded.identifier,
                        name: loaded.name,
                        type: loaded.type,
                    },
                });
            } else {
                reply({
                    success: false,
                    error: "load_failed",
                    message: "Could not load object: " + identifier,
                });
            }
            return true;
        }
        case "unload_object": {
            var unloadId = params.identifier as string;
            try {
                objectManager.unload(unloadId);
                reply({ success: true, payload: { identifier: unloadId } });
            } catch (e) {
                reply({
                    success: false,
                    error: "unload_failed",
                    message: "Could not unload object: " + unloadId + " (" + String(e) + ")",
                });
            }
            return true;
        }
        default:
            return false;
    }
}
