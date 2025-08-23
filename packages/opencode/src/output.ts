import chalk from "chalk"

export const success = (msg: string) => console.log(`✔ ${msg}`)
export const error = (msg: string) => console.error(`✖ ${msg}`)
export const info = (msg: string) => console.log(`${chalk.dim("•")} ${msg}`)
