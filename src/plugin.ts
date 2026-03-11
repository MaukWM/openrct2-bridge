function main(): void {
    console.log("[openrct2-time-control] Hello from time control plugin!");
}

registerPlugin({
    name: "openrct2-time-control",
    version: "0.1.0",
    authors: ["TycoonBench"],
    type: "remote",
    licence: "MIT",
    targetApiVersion: 110,
    minApiVersion: 70,
    main: main,
});
