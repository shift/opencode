import { CLI } from "../cli"
import { Config } from "../config"
import { error, info, success } from "../output"
import { templates } from "../templates"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { task } from "./task"
import { Bus } from "../bus"
import { ConfigWatcher } from "../config/watcher"

export function configCommand(cli: CLI) {
  const cmds = cli.command("config")
  cmds.description("Manage opencode.json configuration")

  // Initialize config
  cmds
    .command("init")
    .description("Create a new opencode.json configuration file")
    .action(async () => {
      const configPath = join(process.cwd(), "opencode.json")
      if (existsSync(configPath)) {
        error("opencode.json already exists")
        process.exit(1)
      }

      const template = {
        $schema: "https://opencode.ai/config.json",
        agent: {
          "gap-analysis": {
            description: "Analyzes gaps between current and desired states in codebases, processes, or systems",
            prompt:
              "# Gap Analysis Agent\n\nThis agent specializes in analyzing gaps between current and desired states in codebases, processes, or systems.\n\n## Capabilities\n\n- Analyze current state vs desired state\n- Identify missing features, implementations, or processes\n- Provide actionable recommendations to bridge gaps\n- Prioritize identified gaps based on impact and effort\n\n## Process\n\n1. Assess current state through codebase analysis\n2. Define desired state based on requirements or industry standards\n3. Identify gaps between current and desired states\n4. Provide specific, actionable recommendations\n5. Prioritize recommendations based on impact/effort matrix\n\n## Output Format\n\nThe agent will provide a structured analysis:\n\n```\n# Gap Analysis Report\n\n## Current State\n[Description of current implementation/system]\n\n## Desired State\n[Description of target state]\n\n## Identified Gaps\n1. [Gap description]\n   - Impact: [High/Medium/Low]\n   - Effort: [High/Medium/Low]\n   - Recommendation: [Specific action items]\n\n## Prioritized Recommendations\n1. [High impact, low effort items]\n2. [High impact, high effort items]\n3. [Low impact, low effort items]\n4. [Low impact, high effort items]\n```\n",
          },
          "performance-specialist": {
            mode: "subagent",
            model: "github-copilot/claude-3.5-sonnet",
            prompt: "{file:./prompts/performance-specialist.md}",
            tools: {
              read: true,
              write: true,
              edit: true,
              bash: true,
              grep: true,
              glob: true,
              list: true,
            },
          },
        },
        mcp: {
          context7: {
            type: "remote",
            url: "https://mcp.context7.com/sse",
          },
          weather: {
            type: "local",
            command: ["opencode", "x", "@h1deya/mcp-server-weather"],
          },
        },
        formatter: {
          prettier: {
            disabled: false,
            command: ["npx", "prettier", "--write", "$FILE"],
            extensions: [".js", ".ts", ".jsx", ".tsx", ".json", ".md", ".css", ".html"],
          },
          gofmt: {
            disabled: false,
            command: ["gofmt", "-w", "$FILE"],
            extensions: [".go"],
          },
          ruff: {
            disabled: false,
            command: ["ruff", "format", "$FILE"],
            extensions: [".py", ".pyi"],
          },
        },
        lsp: {
          typescript: {
            command: ["typescript-language-server", "--stdio"],
            extensions: [".ts", ".tsx", ".js", ".jsx"],
          },
          python: {
            command: ["pylsp"],
            extensions: [".py"],
          },
          go: {
            command: ["gopls"],
            extensions: [".go"],
          },
        },
      }

      await Bun.write(configPath, JSON.stringify(template, null, 2))
      success("Created opencode.json")
    })

  // List commands
  cmds
    .command("list-agents")
    .description("List all configured agents")
    .action(async () => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        const template = { agent: {}, mcps: {}, formatters: {} }
        await Bun.write(configPath, JSON.stringify(template, null, 2))
        info("No agents configured")
        return
      }

      const config = await Config.load(configPath)
      const agents = config.agent || {}

      if (Object.keys(agents).length === 0) {
        info("No agents configured")
        return
      }

      console.log("Configured agents:")
      for (const [name, agent] of Object.entries(agents)) {
        console.log(`  ${name}: ${agent.description}`)
      }
    })

  cmds
    .command("list-mcps")
    .description("List all configured MCPs")
    .action(async () => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        const template = { agent: {}, mcps: {}, formatters: {} }
        await Bun.write(configPath, JSON.stringify(template, null, 2))
        info("No MCPs configured")
        return
      }

      const config = await Config.load(configPath)
      const mcps = config.mcps || {}

      if (Object.keys(mcps).length === 0) {
        info("No MCPs configured")
        return
      }

      console.log("Configured MCPs:")
      for (const [name, mcp] of Object.entries(mcps)) {
        console.log(`  ${name}: ${mcp.description} (${mcp.url})`)
      }
    })

  cmds
    .command("list-formatters")
    .description("List all configured formatters")
    .action(async () => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        const template = { agent: {}, mcps: {}, formatters: {} }
        await Bun.write(configPath, JSON.stringify(template, null, 2))
        info("No formatters configured")
        return
      }

      const config = await Config.load(configPath)
      const formatters = config.formatters || {}

      if (Object.keys(formatters).length === 0) {
        info("No formatters configured")
        return
      }

      console.log("Configured formatters:")
      for (const [name, formatter] of Object.entries(formatters)) {
        console.log(`  ${name}: ${formatter.description} (${formatter.command})`)
      }
    })

  // Generate prompt with templates
  cmds
    .command("generate-prompt <path>")
    .description("Generate an agent prompt file")
    .option("-t, --type <type>", "Agent type (e.g. reviewer, formatter, tester)")
    .option("-d, --description <desc>", "Description of what the agent should do")
    .option("--template <template>", "Use predefined template (reviewer, tester, formatter, documenter)")
    .action(async (path: string, opts: { type?: string; description?: string; template?: string }) => {
      if (opts.template) {
        if (!templates[opts.template as keyof typeof templates]) {
          error(`Unknown template: ${opts.template}. Available: ${Object.keys(templates).join(", ")}`)
          process.exit(1)
        }

        const prompt = templates[opts.template as keyof typeof templates]
        await Bun.write(path, prompt)
        success(`Generated prompt file at ${path} using ${opts.template} template`)
        return
      }

      if (!opts.type) {
        error("Agent type is required (or use --template)")
        process.exit(1)
      }

      if (!opts.description) {
        error("Agent description is required (or use --template)")
        process.exit(1)
      }

      info("Generating prompt file...")
      const prompt = await task.run({
        description: `Generate prompt for ${opts.type}`,
        prompt: `Generate a detailed prompt for a ${opts.type} agent that will ${opts.description}.
                 The prompt should include:
                 - Clear description of the agent's role and responsibilities
                 - Guidelines for how to handle different scenarios
                 - Best practices and conventions to follow
                 - Examples of good and bad output
                 - Any limitations or constraints`,
        subagent_type: "general",
      })

      await Bun.write(path, prompt)
      success(`Generated prompt file at ${path}`)
    })

  // Remove commands
  cmds
    .command("remove-agent <name>")
    .description("Remove an agent from configuration")
    .action(async (name: string) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.agent?.[name]) {
        error(`Agent '${name}' not found`)
        process.exit(1)
      }

      delete config.agent[name]
      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Removed agent '${name}'`)
    })

  cmds
    .command("remove-mcp <name>")
    .description("Remove an MCP from configuration")
    .action(async (name: string) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.mcps?.[name]) {
        error(`MCP '${name}' not found`)
        process.exit(1)
      }

      delete config.mcps[name]
      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Removed MCP '${name}'`)
    })

  cmds
    .command("remove-formatter <name>")
    .description("Remove a formatter from configuration")
    .action(async (name: string) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.formatters?.[name]) {
        error(`Formatter '${name}' not found`)
        process.exit(1)
      }

      delete config.formatters[name]
      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Removed formatter '${name}'`)
    })

  // Update commands
  cmds
    .command("update-agent <name>")
    .description("Update an existing agent")
    .option("-d, --description <desc>", "New description")
    .option("-p, --prompt <path>", "New prompt file path")
    .action(async (name: string, opts: { description?: string; prompt?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.agent?.[name]) {
        error(`Agent '${name}' not found`)
        process.exit(1)
      }

      if (opts.description !== undefined) {
        config.agent[name].description = opts.description
      }

      if (opts.prompt) {
        if (!existsSync(opts.prompt)) {
          error(`Prompt file not found: ${opts.prompt}`)
          process.exit(1)
        }
        const promptContent = await Bun.file(opts.prompt).text()
        config.agent[name].prompt = promptContent
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Updated agent '${name}'`)
    })

  cmds
    .command("update-mcp <name>")
    .description("Update an existing MCP")
    .option("-d, --description <desc>", "New description")
    .option("-u, --url <url>", "New URL")
    .action(async (name: string, opts: { description?: string; url?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.mcps?.[name]) {
        error(`MCP '${name}' not found`)
        process.exit(1)
      }

      if (opts.description !== undefined) {
        config.mcps[name].description = opts.description
      }

      if (opts.url !== undefined) {
        config.mcps[name].url = opts.url
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Updated MCP '${name}'`)
    })

  cmds
    .command("update-formatter <name>")
    .description("Update an existing formatter")
    .option("-d, --description <desc>", "New description")
    .option("-c, --command <cmd>", "New command")
    .action(async (name: string, opts: { description?: string; command?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.formatters?.[name]) {
        error(`Formatter '${name}' not found`)
        process.exit(1)
      }

      if (opts.description !== undefined) {
        config.formatters[name].description = opts.description
      }

      if (opts.command !== undefined) {
        config.formatters[name].command = opts.command
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Updated formatter '${name}'`)
    })

  // Test commands
  cmds
    .command("test-agent <name>")
    .description("Test an agent with a sample prompt")
    .option("-p, --prompt <prompt>", "Test prompt to send to agent")
    .action(async (name: string, opts: { prompt?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.agent?.[name]) {
        error(`Agent '${name}' not found`)
        process.exit(1)
      }

      const testPrompt = opts.prompt || "Hello, please introduce yourself and explain your capabilities."
      info(`Testing agent '${name}' with prompt: "${testPrompt}"`)

      const response = await task.run({
        description: `Test agent ${name}`,
        prompt: `${config.agent[name].prompt}\n\nUser: ${testPrompt}`,
        subagent_type: "general",
      })

      console.log("Agent response:")
      console.log(response)
    })

  cmds
    .command("test-formatter <name>")
    .description("Test a formatter with sample code")
    .option("-f, --file <file>", "Test file to format")
    .action(async (name: string, opts: { file?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!config.formatters?.[name]) {
        error(`Formatter '${name}' not found`)
        process.exit(1)
      }

      const testContent = opts.file || "console.log('test')"
      info(`Testing formatter '${name}' with: ${config.formatters[name].command}`)

      // This would normally run the actual formatter command
      console.log(`Would run: ${config.formatters[name].command}`)
      console.log(`Test content: ${testContent}`)
    })

  // Bulk operations
  cmds
    .command("import-agents <directory>")
    .description("Import agents from prompt files in a directory")
    .action(async (directory: string) => {
      if (!existsSync(directory)) {
        error(`Directory not found: ${directory}`)
        process.exit(1)
      }

      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      info(`Importing agents from ${directory}...`)

      const { readdirSync, statSync } = await import("node:fs")
      const { extname } = await import("node:path")

      const files = readdirSync(directory)
      const promptFiles = files.filter((f) => extname(f) === ".md" || extname(f) === ".txt")

      const imported: string[] = []
      const config = await Config.load(configPath)

      for (const file of promptFiles) {
        const filePath = join(directory, file)
        const stat = statSync(filePath)

        if (stat.isFile()) {
          const name = file.replace(/\.(md|txt)$/, "")
          const promptContent = await Bun.file(filePath).text()

          config.agent = config.agent || {}
          config.agent[name] = {
            description: `Imported from ${file}`,
            prompt: promptContent,
          }

          imported.push(name)
        }
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Imported ${imported.length} agents: ${imported.join(", ")}`)
    })

  // Existing commands
  cmds
    .command("validate")
    .description("Validate opencode.json configuration")
    .action(async () => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      await config.validate()
      success("Configuration is valid")
    })

  cmds
    .command("add-agent <name>")
    .description("Add an agent to opencode.json")
    .option("-d, --description <desc>", "Agent description")
    .option("-p, --prompt <path>", "Path to prompt file")
    .action(async (name: string, opts: { description?: string; prompt?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      if (!opts.prompt) {
        error("Prompt file path is required")
        process.exit(1)
      }

      if (!existsSync(opts.prompt)) {
        error(`Prompt file not found: ${opts.prompt}`)
        process.exit(1)
      }

      const promptContent = await Bun.file(opts.prompt).text()
      config.agent = config.agent || {}
      config.agent[name] = {
        description: opts.description || "",
        prompt: promptContent,
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
      Bus.publish(ConfigWatcher.Event.AgentAdded, { name })
      success(`Added agent '${name}' to configuration`)
    })

  cmds
    .command("add-mcp <name>")
    .description("Add an MCP to opencode.json")
    .option("-d, --description <desc>", "MCP description")
    .option("-u, --url <url>", "MCP URL")
    .action(async (name: string, opts: { description?: string; url?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      if (!opts.url) {
        error("MCP URL is required")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      config.mcps = config.mcps || {}
      config.mcps[name] = {
        description: opts.description || "",
        url: opts.url,
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Added MCP '${name}' to configuration`)
    })

  cmds
    .command("add-formatter <name>")
    .description("Add a formatter to opencode.json")
    .option("-d, --description <desc>", "Formatter description")
    .option("-c, --command <cmd>", "Formatter command")
    .action(async (name: string, opts: { description?: string; command?: string }) => {
      const configPath = join(process.cwd(), "opencode.json")
      if (!existsSync(configPath)) {
        error("No opencode.json found in current directory")
        process.exit(1)
      }

      if (!opts.command) {
        error("Formatter command is required")
        process.exit(1)
      }

      const config = await Config.load(configPath)
      config.formatters = config.formatters || {}
      config.formatters[name] = {
        description: opts.description || "",
        command: opts.command,
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
      success(`Added formatter '${name}' to configuration`)
    })
}
