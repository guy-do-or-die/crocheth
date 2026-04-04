declare module '@arx-research/libhalo/api/web' {
  export function execHaloCmdWeb(command: {
    name: string
    message?: string
    keyNo?: number
    [key: string]: unknown
  }): Promise<Record<string, unknown>>
}
