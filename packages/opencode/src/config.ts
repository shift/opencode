export class Config {
  agents?: Record<string, { description: string; prompt: string }>
  mcps?: Record<string, { description: string; url: string }>
  formatters?: Record<string, { description: string; command: string }>

  static async load(path: string): Promise<Config> {
    const content = await Bun.file(path).text()
    const data = JSON.parse(content)
    const config = new Config()
    Object.assign(config, data)
    return config
  }

  async validate(): Promise<void> {
    // Basic validation can be expanded
    return Promise.resolve()
  }
}
