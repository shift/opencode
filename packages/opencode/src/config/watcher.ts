import { Log } from "../util/log"
import { App } from "../app/app"
import { Config } from "./config"
import { Bus } from "../bus"
import { watch } from "fs"
import path from "path"
import { Filesystem } from "../util/filesystem"
import { Flag } from "../flag/flag"
import { z } from "zod"

export namespace ConfigWatcher {
  const log = Log.create({ service: "config.watcher" })

  export const Event = {
    ConfigReloaded: Bus.event(
      "config.reloaded",
      z.object({
        oldConfig: z.any(),
        newConfig: z.any(),
        changedSections: z.array(z.string()),
      }),
    ),
    AgentAdded: Bus.event(
      "config.agent.added",
      z.object({
        name: z.string(),
      }),
    ),
  }

  export const state = App.state(
    "config-watcher",
    async (app) => {
      const watchers: ReturnType<typeof watch>[] = []
      let debounceTimer: Timer | null = null
      const debounceMs = 500
      const watchedFiles = new Set<string>()

      // Function to watch a specific file
      function watchFile(file: string) {
        if (watchedFiles.has(file)) return

        try {
          const watcher = watch(file, { persistent: false }, (_eventType, filename) => {
            log.info("config file changed", { file: filename || file })

            // Debounce multiple rapid changes
            if (debounceTimer) {
              clearTimeout(debounceTimer)
            }

            debounceTimer = setTimeout(async () => {
              await reloadConfig()
            }, debounceMs)
          })

          watchers.push(watcher)
          watchedFiles.add(file)
        } catch (error) {
          log.warn("failed to watch config file", { file, error })
        }
      }

      // Watch directories for new config files
      function watchDir(dir: string) {
        try {
          const watcher = watch(dir, { persistent: false }, async (_eventType, filename) => {
            if (filename === "opencode.json" || filename === "opencode.jsonc") {
              const filePath = path.join(dir, filename)
              if (await Bun.file(filePath).exists()) {
                watchFile(filePath)
                await reloadConfig()
              }
            }
          })
          watchers.push(watcher)
        } catch (error) {
          log.warn("failed to watch directory", { dir, error })
        }
      }

      // Watch project directory
      watchDir(app.path.cwd)

      // Watch global config directory
      watchDir(app.path.config)

      // Watch existing config files
      const configFiles = await getConfigFiles(app)
      log.info("watching config files", { files: configFiles })

      for (const file of configFiles) {
        watchFile(file)
      }

      return {
        watchers,
        stop: () => {
          watchers.forEach((watcher) => watcher.close())
          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
        },
      }
    },
    async (state) => {
      // Cleanup on shutdown
      state.stop()
    },
  )

  async function getConfigFiles(app: App.Info): Promise<string[]> {
    const files: string[] = []

    // Global config files
    files.push(
      path.join(app.path.config, "config.json"),
      path.join(app.path.config, "opencode.json"),
      path.join(app.path.config, "opencode.jsonc"),
    )

    // Find local config files
    for (const file of ["opencode.jsonc", "opencode.json"]) {
      const found = await Filesystem.findUp(file, app.path.cwd, app.path.root)
      files.push(...found)
    }

    // Add custom config if specified
    if (Flag.OPENCODE_CONFIG) {
      files.push(Flag.OPENCODE_CONFIG)
    }

    // Return only existing files
    const existingFiles: string[] = []
    for (const file of files) {
      try {
        await Bun.file(file).text()
        existingFiles.push(file)
      } catch {
        // File doesn't exist, skip
      }
    }

    return existingFiles
  }

  async function reloadConfig() {
    try {
      log.info("reloading config...")

      // Get current config before reload
      const oldConfig = await Config.get()

      // Clear config state to force reload
      const app = App.use()
      app.services.delete("config")

      // Load new config
      const newConfig = await Config.get()

      // Compare configs to determine what changed
      const changedSections = getChangedSections(oldConfig, newConfig)

      if (changedSections.length === 0) {
        log.info("no significant config changes detected")
        return
      }

      log.info("config reloaded", { changedSections })

      // Emit reload event
      Bus.publish(Event.ConfigReloaded, {
        oldConfig,
        newConfig,
        changedSections,
      })
    } catch (error) {
      log.error("config reload failed", { error })
      // Don't crash the app on config errors, just log them
    }
  }

  function getChangedSections(oldConfig: Config.Info, newConfig: Config.Info): string[] {
    const changed: string[] = []

    // Check each major section for changes
    if (JSON.stringify(oldConfig.lsp) !== JSON.stringify(newConfig.lsp)) {
      changed.push("lsp")
    }

    if (JSON.stringify(oldConfig.mcp) !== JSON.stringify(newConfig.mcp)) {
      changed.push("mcp")
    }

    if (JSON.stringify(oldConfig.formatter) !== JSON.stringify(newConfig.formatter)) {
      changed.push("formatter")
    }

    if (JSON.stringify(oldConfig.agent) !== JSON.stringify(newConfig.agent)) {
      changed.push("agent")
    }

    if (JSON.stringify(oldConfig.provider) !== JSON.stringify(newConfig.provider)) {
      changed.push("provider")
    }

    if (oldConfig.model !== newConfig.model) {
      changed.push("model")
    }

    if (oldConfig.theme !== newConfig.theme) {
      changed.push("theme")
    }

    if (JSON.stringify(oldConfig.keybinds) !== JSON.stringify(newConfig.keybinds)) {
      changed.push("keybinds")
    }

    return changed
  }

  export function init() {
    log.info("initializing config watcher")
    state()
  }
}
