function main(): void {
    console.log("[openrct2-bridge] Plugin loaded");
}

registerPlugin({
    name: "openrct2-bridge",
    version: "0.1.0",
    authors: ["TycoonBench"],
    type: "remote",
    licence: "MIT",
    targetApiVersion: 110,
    minApiVersion: 70,
    main: main,
});
