import { Log } from "../util/log"
import { App } from "../app/app"
import { Bus } from "../bus"
import { ConfigWatcher } from "./watcher"

export namespace ServiceReloader {
  const log = Log.create({ service: "service.reloader" })

  export function init() {
    log.info("initializing service reloader")

    Bus.subscribe(ConfigWatcher.Event.ConfigReloaded, async (event) => {
      const { changedSections } = event.properties

      log.info("handling config reload", { changedSections })

      for (const section of changedSections) {
        await reloadSection(section)
      }
    })
  }

  async function reloadSection(section: string) {
    log.info("reloading section", { section })

    try {
      switch (section) {
        case "lsp":
          await reloadLSP()
          break
        case "mcp":
          await reloadMCP()
          break
        case "formatter":
          await reloadFormatter()
          break
        case "agent":
          await reloadAgents()
          break
        case "provider":
          log.info("provider config changed - will take effect on next model request")
          break
        case "model":
          log.info("default model changed")
          break
        case "theme":
          log.info("theme changed - restart required for full effect")
          break
        case "keybinds":
          log.info("keybinds changed - restart required for full effect")
          break
        default:
          log.debug("unhandled section", { section })
      }
    } catch (error) {
      log.error("failed to reload section", { section, error })
    }
  }

  async function reloadLSP() {
    log.info("reloading LSP servers")

    const app = App.use()

    // Get current LSP state before clearing it
    const currentState = app.services.get("lsp")
    if (currentState) {
      // Gracefully shutdown existing LSP processes
      try {
        const state = await currentState.state

        // Clean up processes
        if (state.processPool) {
          for (const [key, processInfo] of state.processPool.entries()) {
            log.info("stopping LSP process", { key, pid: processInfo.pid })
            try {
              processInfo.process.kill("SIGTERM")
              // Give process time to shutdown gracefully
              setTimeout(() => {
                if (!processInfo.process.killed) {
                  processInfo.process.kill("SIGKILL")
                }
              }, 2000)
            } catch (error) {
              log.warn("error stopping LSP process", { key, error })
            }
          }
        }

        // Clear cleanup interval
        if (state.cleanupInterval) {
          clearInterval(state.cleanupInterval)
        }

        log.info("stopped existing LSP processes")
      } catch (error) {
        log.warn("error during LSP cleanup", { error })
      }
    }

    // Clear LSP state to force reinitialization
    app.services.delete("lsp")

    // Force reload by accessing LSP service
    const { LSP } = await import("../lsp")
    await LSP.getProcessStats() // This will reinitialize LSP with new config

    log.info("LSP servers reloaded")
  }

  async function reloadMCP() {
    log.info("reloading MCP servers")

    const app = App.use()

    // Get current MCP state before clearing it
    const currentState = app.services.get("mcp")
    if (currentState) {
      try {
        const state = await currentState.state

        // Close existing MCP clients
        for (const [key, clientInfo] of Object.entries(state.clients || {})) {
          log.info("closing MCP client", { key })
          try {
            ;(clientInfo as any).client.close()
          } catch (error) {
            log.warn("error closing MCP client", { key, error })
          }
        }

        // Clear health check interval
        if (state.healthCheckInterval) {
          clearInterval(state.healthCheckInterval)
        }

        log.info("closed existing MCP clients")
      } catch (error) {
        log.warn("error during MCP cleanup", { error })
      }
    }

    // Clear MCP state to force reinitialization
    app.services.delete("mcp")

    // Force reload by accessing MCP service
    const { MCP } = await import("../mcp")
    await MCP.getClientStats() // This will reinitialize MCP with new config

    log.info("MCP servers reloaded")
  }

  async function reloadFormatter() {
    log.info("reloading formatters")

    const app = App.use()

    // Clear formatter state to force reinitialization
    app.services.delete("format")

    // Force reload by accessing Format service
    const { Format } = await import("../format")
    Format.init() // Reinitialize with new config

    log.info("formatters reloaded")
  }

  async function reloadAgents() {
    log.info("agent config changed - agents will use new config on next invocation")
    // Agents don't maintain persistent state, so no cleanup needed
    // The config change will be picked up automatically on next agent use
  }
}
