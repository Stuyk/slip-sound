import { spawn } from 'child_process'
import ffmpegPath from 'ffmpeg-static'

export type ExportFormat = 'wav' | 'ogg'
export type BitDepth = 16 | 24 | 32

export interface ExportParams {
  sourcePath: string
  destPath: string
  format: ExportFormat
  sampleRate: number
  bitDepth?: BitDepth
  oggQuality?: number // 0-10 (libvorbis VBR scale), default 5
  start?: number
  end?: number
}

const WAV_CODECS: Record<BitDepth, string> = {
  16: 'pcm_s16le',
  24: 'pcm_s24le',
  32: 'pcm_f32le'
}

function buildArgs(params: ExportParams): string[] {
  const { sourcePath, destPath, format, sampleRate, bitDepth = 16, oggQuality = 5, start, end } = params
  const args = ['-y', '-i', sourcePath]

  if (start !== undefined) {
    args.push('-ss', start.toFixed(3))
  }
  if (end !== undefined) {
    args.push('-to', end.toFixed(3))
  }

  args.push('-ar', String(sampleRate))

  if (format === 'wav') {
    args.push('-c:a', WAV_CODECS[bitDepth] ?? WAV_CODECS[16])
  } else {
    args.push('-c:a', 'libvorbis', '-q:a', String(Math.min(10, Math.max(0, oggQuality))))
  }

  args.push(destPath)
  return args
}

function getFfmpegPath(): string | null {
  if (!ffmpegPath) return null
  return ffmpegPath.replace('app.asar', 'app.asar.unpacked')
}

export function exportRegion(params: ExportParams): Promise<void> {
  return new Promise((resolve, reject) => {
    const bin = getFfmpegPath()
    if (!bin) {
      reject(new Error('ffmpeg binary not found'))
      return
    }
    const args = buildArgs(params)
    const proc = spawn(bin, args)
    let stderr = ''
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    proc.on('error', reject)
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
    })
  })
}

export type NamingMode = 'original' | 'numeric' | 'alpha'

// Base-26 alphabetic sequence: a, b, ..., z, aa, ab, ..., az, ba, ...
function toAlpha(index: number): string {
  let n = index
  let result = ''
  do {
    result = String.fromCharCode(97 + (n % 26)) + result
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return result
}

export function generateExportFilename(
  originalStem: string,
  index: number,
  total: number,
  mode: NamingMode,
  baseName: string
): string {
  if (mode === 'original') return originalStem

  if (mode === 'numeric') {
    const width = total > 99 ? String(total).length : 2
    return `${baseName}_${String(index + 1).padStart(width, '0')}`
  }

  return `${baseName}_${toAlpha(index)}`
}
