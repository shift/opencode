import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { join } from "node:path"
import { mkdirSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { existsSync } from "node:fs"
import * as ConfigTools from "../../src/tools/tools"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const TEMP_DIR = join(__dirname, "temp")
const FIXTURES_DIR = join(__dirname, "fixtures")

async function initConfig() {
  const configPath = join(process.cwd(), "opencode.json")
  if (!existsSync(configPath)) {
    const template = { agent: {}, mcps: {}, formatters: {} }
    await Bun.write(configPath, JSON.stringify(template, null, 2))
  }
}

describe("config tools", () => {
  beforeEach(() => {
    mkdirSync(TEMP_DIR, { recursive: true })
    process.chdir(TEMP_DIR)
  })

  afterEach(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true })
  })

  test("listAgents - returns empty when no config", async () => {
    await initConfig()
    const result = await ConfigTools.listAgents()
    expect(result.agents).toEqual({})
  })

  test("addAgent - adds agent to config", async () => {
    await initConfig()
    const promptPath = join(FIXTURES_DIR, "sample-prompt.md")

    await ConfigTools.addAgent("test-agent", "Test agent", promptPath)

    const result = await ConfigTools.listAgents()
    expect(result.agents["test-agent"]).toBeDefined()
    expect(result.agents["test-agent"].description).toBe("Test agent")
    expect(result.agents["test-agent"].prompt).toBe("You are a test agent\n")
  })

  test("removeAgent - removes agent from config", async () => {
    await initConfig()
    const promptPath = join(FIXTURES_DIR, "sample-prompt.md")

    await ConfigTools.addAgent("test-agent", "Test agent", promptPath)

    await ConfigTools.removeAgent("test-agent")
    const result = await ConfigTools.listAgents()
    expect(result.agents["test-agent"]).toBeUndefined()
  })

  test("addMCP - adds MCP to config", async () => {
    await initConfig()

    await ConfigTools.addMCP("test-mcp", "Test MCP", "http://localhost:3000")

    const result = await ConfigTools.listMCPs()
    expect(result.mcps["test-mcp"]).toBeDefined()
    expect(result.mcps["test-mcp"].description).toBe("Test MCP")
    expect(result.mcps["test-mcp"].url).toBe("http://localhost:3000")
  })

  test("addFormatter - adds formatter to config", async () => {
    await initConfig()

    await ConfigTools.addFormatter("test-fmt", "Test formatter", "prettier")

    const result = await ConfigTools.listFormatters()
    expect(result.formatters["test-fmt"]).toBeDefined()
    expect(result.formatters["test-fmt"].description).toBe("Test formatter")
    expect(result.formatters["test-fmt"].command).toBe("prettier")
  })
})
