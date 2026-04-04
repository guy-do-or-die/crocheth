declare module '@arx-research/libhalo/api/web' {
  export function execHaloCmdWeb(command: {
    name: string
    message?: string
    keyNo?: number
    [key: string]: unknown
  }, options?: {
    method?: 'credential' | 'webnfc'
    statusCallback?: (cause: string, stepInfo: any) => void
  }): Promise<Record<string, unknown>>
}
