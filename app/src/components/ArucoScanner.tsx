import { useRef, useEffect, useState, useCallback } from 'react'
import { AR } from 'js-aruco2'
import 'js-aruco2/src/dictionaries/aruco_4x4_1000'

interface DetectedMarker {
  id: number
  corners: { x: number; y: number }[]
}

interface ArucoScannerProps {
  onMarkerDetected: (markerId: number) => void
  active: boolean
}

export function ArucoScanner({ onMarkerDetected, active }: ArucoScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number>(0)
  const detectorRef = useRef<AR.Detector | null>(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [lastDetected, setLastDetected] = useState<DetectedMarker | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (err) {
      setError('Camera access denied. Please allow camera permissions.')
      console.error('Camera error:', err)
    }
  }, [])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    setCameraReady(false)
    setLastDetected(null)
  }, [])

  const detect = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!video || !canvas || !overlay || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(detect)
      return
    }

    const ctx = canvas.getContext('2d')!
    const octx = overlay.getContext('2d')!

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    overlay.width = video.videoWidth
    overlay.height = video.videoHeight

    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    if (!detectorRef.current) {
      detectorRef.current = new AR.Detector({ dictionaryName: 'ARUCO_4X4_1000' })
    }

    const markers = detectorRef.current.detect(imageData)

    // Clear overlay
    octx.clearRect(0, 0, overlay.width, overlay.height)

    if (markers.length > 0) {
      const marker = markers[0]
      setLastDetected({ id: marker.id, corners: marker.corners })
      onMarkerDetected(marker.id)

      // Draw marker outline on overlay
      octx.strokeStyle = '#a855f7'
      octx.lineWidth = 3
      octx.beginPath()
      for (let i = 0; i < marker.corners.length; i++) {
        const c = marker.corners[i]
        if (i === 0) octx.moveTo(c.x, c.y)
        else octx.lineTo(c.x, c.y)
      }
      octx.closePath()
      octx.stroke()

      // Draw ID label
      const cx = marker.corners.reduce((s: number, c: { x: number }) => s + c.x, 0) / 4
      const cy = marker.corners.reduce((s: number, c: { y: number }) => s + c.y, 0) / 4
      octx.fillStyle = '#a855f7'
      octx.font = 'bold 16px monospace'
      octx.textAlign = 'center'
      octx.fillText(`#${marker.id}`, cx, cy - 10)
    } else {
      setLastDetected(null)
    }

    rafRef.current = requestAnimationFrame(detect)
  }, [onMarkerDetected])

  useEffect(() => {
    if (active) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [active, startCamera, stopCamera])

  useEffect(() => {
    if (cameraReady && active) {
      rafRef.current = requestAnimationFrame(detect)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [cameraReady, active, detect])

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 rounded-lg border border-destructive/30 bg-destructive/5">
        <p className="text-destructive text-sm text-center px-4">{error}</p>
      </div>
    )
  }

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-black">
      <video
        ref={videoRef}
        className="w-full rounded-lg"
        playsInline
        muted
        style={{ display: cameraReady ? 'block' : 'none' }}
      />
      {/* Hidden canvas for pixel processing */}
      <canvas ref={canvasRef} className="hidden" />
      {/* Overlay canvas for marker visualization */}
      <canvas
        ref={overlayRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
      />

      {!cameraReady && active && (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground text-sm animate-pulse">
            Starting camera...
          </div>
        </div>
      )}

      {cameraReady && (
        <div className="absolute bottom-3 left-3 right-3">
          <div className={`rounded-md px-3 py-1.5 text-xs font-mono backdrop-blur-sm ${
            lastDetected
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
              : 'bg-black/40 text-neutral-400 border border-white/10'
          }`}>
            {lastDetected
              ? `✓ Marker #${lastDetected.id} detected`
              : '◎ Point camera at an ArUco marker'}
          </div>
        </div>
      )}
    </div>
  )
}
