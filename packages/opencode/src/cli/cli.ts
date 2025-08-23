import { Command } from "commander"

export class CLI extends Command {
  constructor() {
    super()
    this.name("opencode").description("CLI tool for managing opencode.json").version("0.0.0")
  }
}
