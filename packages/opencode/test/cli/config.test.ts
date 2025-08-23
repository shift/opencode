import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { join } from "node:path"
import { mkdirSync, rmSync } from "node:fs"
import { CLI } from "../../src/cli"
import { fileURLToPath } from "node:url"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const TEMP_DIR = join(__dirname, "temp")
const FIXTURES_DIR = join(__dirname, "fixtures")

describe("config command", () => {
  let cli: CLI

  beforeEach(() => {
    mkdirSync(TEMP_DIR, { recursive: true })
    cli = new CLI()
  })

  afterEach(() => {
    rmSync(TEMP_DIR, { recursive: true, force: true })
  })

  test("generate-prompt - creates prompt file", async () => {
    process.chdir(TEMP_DIR)
    const promptPath = join(TEMP_DIR, "test-prompt.md")

    cli.parse([
      "config",
      "generate-prompt",
      promptPath,
      "--type",
      "reviewer",
      "--description",
      "review code for best practices",
    ])

    const content = await Bun.file(promptPath).text()
    expect(content).toContain("reviewer")
    expect(content).toContain("Generate prompt for reviewer")
  })

  test("validate - fails when no config exists", async () => {
    process.chdir(TEMP_DIR)
    const mockExit = spyOn(process, "exit")
    cli.parse(["config", "validate"])
    expect(mockExit).toHaveBeenCalledWith(1)
    mockExit.mockRestore()
  })

  test("validate - succeeds with valid config", async () => {
    process.chdir(TEMP_DIR)
    const config = {
      agents: {
        test: {
          description: "Test agent",
          prompt: "Test prompt",
        },
      },
    }
    await Bun.write(join(TEMP_DIR, "opencode.json"), JSON.stringify(config))
    cli.parse(["config", "validate"])
  })

  test("add-agent - adds agent to config", async () => {
    process.chdir(TEMP_DIR)
    const promptPath = join(FIXTURES_DIR, "sample-prompt.md")
    cli.parse(["config", "add-agent", "test-agent", "--description", "Test agent", "--prompt", promptPath])

    const config = JSON.parse(await Bun.file(join(TEMP_DIR, "opencode.json")).text())
    expect(config.agents["test-agent"]).toBeDefined()
    expect(config.agents["test-agent"].description).toBe("Test agent")
    expect(config.agents["test-agent"].prompt).toBe("You are a test agent")
  })

  test("add-mcp - adds MCP to config", async () => {
    process.chdir(TEMP_DIR)
    cli.parse(["config", "add-mcp", "test-mcp", "--description", "Test MCP", "--url", "http://localhost:3000"])

    const config = JSON.parse(await Bun.file(join(TEMP_DIR, "opencode.json")).text())
    expect(config.mcps["test-mcp"]).toBeDefined()
    expect(config.mcps["test-mcp"].description).toBe("Test MCP")
    expect(config.mcps["test-mcp"].url).toBe("http://localhost:3000")
  })

  test("add-formatter - adds formatter to config", async () => {
    process.chdir(TEMP_DIR)
    cli.parse(["config", "add-formatter", "test-fmt", "--description", "Test formatter", "--command", "prettier"])

    const config = JSON.parse(await Bun.file(join(TEMP_DIR, "opencode.json")).text())
    expect(config.formatters["test-fmt"]).toBeDefined()
    expect(config.formatters["test-fmt"].description).toBe("Test formatter")
    expect(config.formatters["test-fmt"].command).toBe("prettier")
  })
})
