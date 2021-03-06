import * as fs from "fs"
import * as path from "path"

import * as Log from "./../Log"

import * as Capabilities from "./Api/Capabilities"
import { Oni } from "./Api/Oni"

import * as PackageMetadataParser from "./PackageMetadataParser"

export class Plugin {
    private _oniPluginMetadata: Capabilities.IPluginMetadata
    private _oni: Oni

    public get metadata(): Capabilities.IPluginMetadata {
        return this._oniPluginMetadata
    }

    constructor(
        private _pluginRootDirectory: string,
    ) {
        const packageJsonPath = path.join(this._pluginRootDirectory, "package.json")

        if (fs.existsSync(packageJsonPath)) {
            this._oniPluginMetadata = PackageMetadataParser.readMetadata(packageJsonPath)
        }
    }

    public activate(): void {

        if (!this._oniPluginMetadata || !this._oniPluginMetadata.main) {
            return
        }

        this._oni = new Oni()
        const vm = require("vm")
        Log.info(`[PLUGIN] Activating: ${this._oniPluginMetadata.name}`)

        let moduleEntryPoint = path.normalize(path.join(this._pluginRootDirectory, this._oniPluginMetadata.main))
        moduleEntryPoint = moduleEntryPoint.split("\\").join("/")

        try {
            vm.runInNewContext(`debugger; const pluginEntryPoint = require('${moduleEntryPoint}').activate; if (!pluginEntryPoint) { console.warn('No activate method found for: ${moduleEntryPoint}'); } else { pluginEntryPoint(Oni); } `, {
                Oni: this._oni,
                require: window["require"], // tslint:disable-line no-string-literal
                console,
            })
            Log.info(`[PLUGIN] Activation successful.`)
        } catch (ex) {
            Log.error(`[PLUGIN] Failed to load plugin: ${this._oniPluginMetadata.name}`, ex)
        }
    }
}
