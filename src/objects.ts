/// <reference path="../lib/openrct2.d.ts" />

// Hand-written object management endpoints.
// Uses ObjectManager API to query loaded objects and load new ones.

/**
 * Handle object management endpoints.
 *
 * Returns true if the endpoint was handled, false otherwise.
 */
export function handleObjectQuery(endpoint: string, params: any, reply: (response: object) => void): boolean {
    switch (endpoint) {
        case "get_objects": {
            var objType = params.type as string;
            if (objType === "ride") {
                var allRideObjects = objectManager.getAllObjects("ride");
                var result: object[] = [];
                for (var i = 0; i < allRideObjects.length; i++) {
                    var ro = allRideObjects[i];
                    if (ro != null) {
                        result.push({
                            index: ro.index,
                            identifier: ro.identifier,
                            name: ro.name,
                            rideType: ro.rideType,
                            carsPerFlatRide: ro.carsPerFlatRide,
                        });
                    }
                }
                reply({ success: true, payload: result });
            } else {
                // Generic path for non-ride object types
                var allObjects = objectManager.getAllObjects(objType as ObjectType);
                var genericResult: object[] = [];
                for (var j = 0; j < allObjects.length; j++) {
                    var obj = allObjects[j];
                    if (obj != null) {
                        genericResult.push({
                            index: obj.index,
                            identifier: obj.identifier,
                            name: obj.name,
                        });
                    }
                }
                reply({ success: true, payload: genericResult });
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
