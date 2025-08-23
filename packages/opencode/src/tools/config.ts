import { Config } from "../config"
import { task } from "../cli/task"
import { templates } from "../templates"
import { existsSync, readdirSync, statSync } from "node:fs"
import { join, extname } from "node:path"

interface GeneratePromptParams {
  agentType: string
  description: string
  path: string
  template?: keyof typeof templates
}

interface AddAgentParams {
  name: string
  description?: string
  promptPath: string
}

interface AddMCPParams {
  name: string
  description?: string
  url: string
}

interface AddFormatterParams {
  name: string
  description?: string
  command: string
}

interface UpdateAgentParams {
  name: string
  description?: string
  promptPath?: string
}

interface UpdateMCPParams {
  name: string
  description?: string
  url?: string
}

interface UpdateFormatterParams {
  name: string
  description?: string
  command?: string
}

interface TestAgentParams {
  name: string
  testPrompt?: string
}

interface TestFormatterParams {
  name: string
  testFile?: string
}

export class ConfigTools {
  static async generatePrompt(params: GeneratePromptParams): Promise<string> {
    let prompt: string

    if (params.template && templates[params.template]) {
      prompt = templates[params.template]
    } else {
      prompt = await task.run({
        description: `Generate prompt for ${params.agentType}`,
        prompt: `Generate a detailed prompt for a ${params.agentType} agent that will ${params.description}.
                 The prompt should include:
                 - Clear description of the agent's role and responsibilities
                 - Guidelines for how to handle different scenarios
                 - Best practices and conventions to follow
                 - Examples of good and bad output
                 - Any limitations or constraints`,
        subagent_type: "general",
      })
    }

    await Bun.write(params.path, prompt)
    return prompt
  }

  static async listAgents(): Promise<Record<string, { description: string; prompt: string }>> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      return {}
    }
    const config = await Config.load(configPath)
    return config.agents || {}
  }

  static async listMCPs(): Promise<Record<string, { description: string; url: string }>> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      return {}
    }
    const config = await Config.load(configPath)
    return config.mcps || {}
  }

  static async listFormatters(): Promise<Record<string, { description: string; command: string }>> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      return {}
    }
    const config = await Config.load(configPath)
    return config.formatters || {}
  }

  static async removeAgent(name: string): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    if (!config.agents?.[name]) {
      throw new Error(`Agent '${name}' not found`)
    }

    delete config.agents[name]
    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async removeMCP(name: string): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    if (!config.mcps?.[name]) {
      throw new Error(`MCP '${name}' not found`)
    }

    delete config.mcps[name]
    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async removeFormatter(name: string): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    if (!config.formatters?.[name]) {
      throw new Error(`Formatter '${name}' not found`)
    }

    delete config.formatters[name]
    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async initConfig(): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (existsSync(configPath)) {
      throw new Error("opencode.json already exists")
    }

    const template = {
      agents: {},
      mcps: {},
      formatters: {},
    }

    await Bun.write(configPath, JSON.stringify(template, null, 2))
  }

  static async updateAgent(params: UpdateAgentParams): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    if (!config.agents?.[params.name]) {
      throw new Error(`Agent '${params.name}' not found`)
    }

    if (params.description !== undefined) {
      config.agents[params.name].description = params.description
    }

    if (params.promptPath) {
      if (!existsSync(params.promptPath)) {
        throw new Error(`Prompt file not found: ${params.promptPath}`)
      }
      const promptContent = await Bun.file(params.promptPath).text()
      config.agents[params.name].prompt = promptContent
    }

    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async updateMCP(params: UpdateMCPParams): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    if (!config.mcps?.[params.name]) {
      throw new Error(`MCP '${params.name}' not found`)
    }

    if (params.description !== undefined) {
      config.mcps[params.name].description = params.description
    }

    if (params.url !== undefined) {
      config.mcps[params.name].url = params.url
    }

    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async updateFormatter(params: UpdateFormatterParams): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    if (!config.formatters?.[params.name]) {
      throw new Error(`Formatter '${params.name}' not found`)
    }

    if (params.description !== undefined) {
      config.formatters[params.name].description = params.description
    }

    if (params.command !== undefined) {
      config.formatters[params.name].command = params.command
    }

    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async testAgent(params: TestAgentParams): Promise<string> {
    const agents = await this.listAgents()
    if (!agents[params.name]) {
      throw new Error(`Agent '${params.name}' not found`)
    }

    const testPrompt = params.testPrompt || "Hello, please introduce yourself and explain your capabilities."

    return await task.run({
      description: `Test agent ${params.name}`,
      prompt: `${agents[params.name].prompt}\n\nUser: ${testPrompt}`,
      subagent_type: "general",
    })
  }

  static async testFormatter(params: TestFormatterParams): Promise<string> {
    const formatters = await this.listFormatters()
    if (!formatters[params.name]) {
      throw new Error(`Formatter '${params.name}' not found`)
    }

    const testContent = params.testFile || "console.log('test')"

    // This would normally run the actual formatter command
    // For now, we'll simulate the test
    return `Formatter '${params.name}' would run: ${formatters[params.name].command}\nTest content: ${testContent}`
  }

  static async importAgents(directoryPath: string): Promise<string[]> {
    if (!existsSync(directoryPath)) {
      throw new Error(`Directory not found: ${directoryPath}`)
    }

    const files = readdirSync(directoryPath)
    const promptFiles = files.filter((f) => extname(f) === ".md" || extname(f) === ".txt")

    const imported: string[] = []

    for (const file of promptFiles) {
      const filePath = join(directoryPath, file)
      const stat = statSync(filePath)

      if (stat.isFile()) {
        const name = file.replace(/\.(md|txt)$/, "")

        await this.addAgent({
          name,
          description: `Imported from ${file}`,
          promptPath: filePath,
        })

        imported.push(name)
      }
    }

    return imported
  }

  static async addAgent(params: AddAgentParams): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    if (!existsSync(params.promptPath)) {
      throw new Error(`Prompt file not found: ${params.promptPath}`)
    }

    const config = await Config.load(configPath)
    const promptContent = await Bun.file(params.promptPath).text()

    config.agents = config.agents || {}
    config.agents[params.name] = {
      description: params.description || "",
      prompt: promptContent,
    }

    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async addMCP(params: AddMCPParams): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    config.mcps = config.mcps || {}
    config.mcps[params.name] = {
      description: params.description || "",
      url: params.url,
    }

    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async addFormatter(params: AddFormatterParams): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    config.formatters = config.formatters || {}
    config.formatters[params.name] = {
      description: params.description || "",
      command: params.command,
    }

    await Bun.write(configPath, JSON.stringify(config, null, 2))
  }

  static async validateConfig(): Promise<void> {
    const configPath = join(process.cwd(), "opencode.json")
    if (!existsSync(configPath)) {
      throw new Error("No opencode.json found in current directory")
    }

    const config = await Config.load(configPath)
    await config.validate()
  }
}
