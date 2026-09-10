import { openSync, readSync, closeSync, fstatSync } from 'fs'

export interface AudioMeta {
  duration: number | null
  channels: number | null
  sampleRate: number | null
}

const EMPTY: AudioMeta = { duration: null, channels: null, sampleRate: null }

export function readAudioMeta(filePath: string): AudioMeta {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase()
  let fd: number
  try {
    fd = openSync(filePath, 'r')
  } catch {
    return EMPTY
  }
  try {
    const size = fstatSync(fd).size
    const head = Buffer.alloc(Math.min(size, 65536))
    readSync(fd, head, 0, head.length, 0)

    switch (ext) {
      case '.wav':
        return parseWav(head, size)
      case '.flac':
        return parseFlac(head)
      case '.ogg':
        return parseOgg(head)
      case '.mp3':
        return parseMp3(head, size)
      default:
        return EMPTY
    }
  } catch {
    return EMPTY
  } finally {
    closeSync(fd)
  }
}

function parseWav(buf: Buffer, fileSize: number): AudioMeta {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    return EMPTY
  }
  let offset = 12
  let channels: number | null = null
  let sampleRate: number | null = null
  let byteRate: number | null = null
  let bitsPerSample: number | null = null
  let dataSize: number | null = null

  while (offset + 8 <= buf.length) {
    const chunkId = buf.toString('ascii', offset, offset + 4)
    const chunkSize = buf.readUInt32LE(offset + 4)
    const bodyStart = offset + 8

    if (chunkId === 'fmt ' && bodyStart + 16 <= buf.length) {
      channels = buf.readUInt16LE(bodyStart + 2)
      sampleRate = buf.readUInt32LE(bodyStart + 4)
      byteRate = buf.readUInt32LE(bodyStart + 8)
      bitsPerSample = buf.readUInt16LE(bodyStart + 14)
    } else if (chunkId === 'data') {
      dataSize = chunkSize > 0 ? chunkSize : fileSize - bodyStart
    }

    offset = bodyStart + chunkSize + (chunkSize % 2)
  }

  let duration: number | null = null
  if (dataSize !== null && byteRate) {
    duration = dataSize / byteRate
  } else if (dataSize !== null && sampleRate && channels && bitsPerSample) {
    duration = dataSize / (sampleRate * channels * (bitsPerSample / 8))
  }

  return { duration, channels, sampleRate }
}

function parseFlac(buf: Buffer): AudioMeta {
  if (buf.length < 42 || buf.toString('ascii', 0, 4) !== 'fLaC') return EMPTY
  let offset = 4
  while (offset + 4 <= buf.length) {
    const header = buf.readUInt8(offset)
    const isLast = (header & 0x80) !== 0
    const blockType = header & 0x7f
    const blockLen = buf.readUIntBE(offset + 1, 3)
    const bodyStart = offset + 4

    if (blockType === 0 && bodyStart + 18 <= buf.length) {
      const b = buf
      const sampleRate = (b.readUInt8(bodyStart + 10) << 12) | (b.readUInt8(bodyStart + 11) << 4) | (b.readUInt8(bodyStart + 12) >> 4)
      const channels = ((b.readUInt8(bodyStart + 12) >> 1) & 0x07) + 1
      const totalSamples =
        ((b.readUInt8(bodyStart + 13) & 0x0f) * 0x100000000) +
        b.readUInt32BE(bodyStart + 14)
      const duration = sampleRate > 0 ? totalSamples / sampleRate : null
      return { duration, channels, sampleRate }
    }

    if (isLast) break
    offset = bodyStart + blockLen
  }
  return EMPTY
}

function parseOgg(buf: Buffer): AudioMeta {
  if (buf.length < 58 || buf.toString('ascii', 0, 4) !== 'OggS') return EMPTY
  const idx = buf.indexOf('vorbis')
  if (idx === -1 || idx + 16 > buf.length) return EMPTY
  const base = idx + 6
  const channels = buf.readUInt8(base + 1)
  const sampleRate = buf.readUInt32LE(base + 2)
  return { duration: null, channels, sampleRate }
}

const MPEG_BITRATES: Record<string, number[]> = {
  V1L1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  V1L2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  V1L3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  V2L1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  V2L23: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
}
const SAMPLE_RATES: Record<string, number[]> = {
  V1: [44100, 48000, 32000],
  V2: [22050, 24000, 16000],
  V25: [11025, 12000, 8000]
}

function parseMp3(buf: Buffer, fileSize: number): AudioMeta {
  let offset = 0
  if (buf.toString('ascii', 0, 3) === 'ID3') {
    const size =
      ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f)
    offset = 10 + size
  }

  while (offset + 4 <= buf.length) {
    if (buf[offset] === 0xff && (buf[offset + 1] & 0xe0) === 0xe0) {
      const b1 = buf[offset + 1]
      const b2 = buf[offset + 2]
      const versionBits = (b1 >> 3) & 0x03
      const layerBits = (b1 >> 1) & 0x03
      const bitrateIdx = (b2 >> 4) & 0x0f
      const sampleRateIdx = (b2 >> 2) & 0x03
      const channelMode = (buf[offset + 3] >> 6) & 0x03

      if (versionBits === 1 || layerBits === 0 || bitrateIdx === 0x0f || sampleRateIdx === 3) {
        offset++
        continue
      }

      const version = versionBits === 3 ? 'V1' : versionBits === 2 ? 'V2' : 'V25'
      const layer = layerBits === 3 ? 1 : layerBits === 2 ? 2 : 3
      const rateTable = version === 'V1' ? SAMPLE_RATES.V1 : version === 'V2' ? SAMPLE_RATES.V2 : SAMPLE_RATES.V25
      const sampleRate = rateTable[sampleRateIdx]

      let bitrateKey: string
      if (version === 'V1') bitrateKey = layer === 1 ? 'V1L1' : layer === 2 ? 'V1L2' : 'V1L3'
      else bitrateKey = layer === 1 ? 'V2L1' : 'V2L23'
      const bitrate = MPEG_BITRATES[bitrateKey][bitrateIdx] * 1000
      const channels = channelMode === 3 ? 1 : 2

      if (!sampleRate || !bitrate) {
        offset++
        continue
      }

      const duration = (fileSize * 8) / bitrate
      return { duration, channels, sampleRate }
    }
    offset++
  }
  return EMPTY
}
