interface TaskResponse {
  result: string
}

class Task {
  async run(params: { description: string; prompt: string; subagent_type: string }): Promise<string> {
    const response: TaskResponse = await this.sendRequest(params)
    return response.result
  }

  private async sendRequest(params: any): Promise<TaskResponse> {
    // This would normally connect to the AI service
    // For testing we'll return a mock response
    return {
      result: `# ${params.description}\n\nThis is a generated prompt for a ${params.prompt.split(" ")[5]} agent.\n`,
    }
  }
}

export const task = new Task()
