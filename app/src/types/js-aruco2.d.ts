declare module 'js-aruco2' {
  export namespace AR {
    const DICTIONARIES: Record<string, unknown>
    class Detector {
      constructor(config?: { dictionaryName?: string })
      detect(imageData: ImageData): Array<{
        id: number
        corners: Array<{ x: number; y: number }>
      }>
    }
  }
}

declare module 'js-aruco2/src/dictionaries/aruco_4x4_1000' {}
