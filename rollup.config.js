import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import { exec } from "child_process";
import { homedir } from "os";
import { promisify } from "util";

const filename = "openrct2-bridge.js";
const isDev = (process.env.BUILD || "development") === "development";

async function getOutput() {
    if (!isDev) {
        return `./dist/${filename}`;
    }

    const pluginPath = `OpenRCT2/plugin/${filename}`;

    if (process.platform === "win32") {
        const { stdout } = await promisify(exec)(
            "powershell -command \"[Environment]::GetFolderPath('MyDocuments')\""
        );
        return `${stdout.trim()}/${pluginPath}`;
    } else if (process.platform === "darwin") {
        return `${homedir()}/Library/Application Support/${pluginPath}`;
    } else {
        const cfg = process.env.XDG_CONFIG_HOME || `${homedir()}/.config`;
        return `${cfg}/${pluginPath}`;
    }
}

/** @type {import("rollup").RollupOptions} */
const config = {
    input: "./src/plugin.ts",
    output: {
        file: await getOutput(),
        format: "iife",
        compact: true,
    },
    treeshake: "smallest",
    plugins: [
        typescript(),
        terser({
            compress: {
                passes: 5,
                toplevel: true,
                unsafe: true,
            },
            format: {
                comments: false,
                quote_style: 1,
                wrap_iife: true,
                beautify: isDev,
            },
            keep_fnames: isDev,
        }),
    ],
};
export default config;
