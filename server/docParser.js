import { Buffer } from 'node:buffer'
import zlib from 'node:zlib'

function decodePdfLiteralString(raw) {
  let out = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === '\\' && i + 1 < raw.length) {
      const next = raw[++i]
      if (next === 'n') out += '\n'
      else if (next === 'r') out += '\r'
      else if (next === 't') out += '\t'
      else if (next === 'b') out += '\b'
      else if (next === 'f') out += '\f'
      else if (next === '(' || next === ')' || next === '\\') out += next
      else if (/[0-7]/.test(next)) {
        let oct = next
        if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i]
        if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i]
        out += String.fromCharCode(parseInt(oct, 8))
      } else {
        out += next
      }
    } else {
      out += ch
    }
  }
  return out
}

function decodePdfHexString(hex) {
  const clean = hex.replace(/\s+/g, '')
  if (!clean) return ''
  const bytes = []
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2).padEnd(2, '0'), 16)
    if (!Number.isNaN(byte)) bytes.push(byte)
  }
  // Check UTF-16BE BOM
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let str = ''
    for (let i = 2; i + 1 < bytes.length; i += 2) {
      str += String.fromCharCode((bytes[i] << 8) | bytes[i + 1])
    }
    return str
  }
  return Buffer.from(bytes).toString('latin1')
}

function extractTextFromPdfStream(content) {
  const lines = []
  const btEtRegex = /BT[\s\S]*?ET/g
  const blocks = content.match(btEtRegex) || [content]

  for (const block of blocks) {
    let currentLine = ''
    // Match (...) Tj, [(...)] TJ, <...> Tj, or Td/TD/T* line breaks
    const tokenRegex = /\(((?:\\.|[^\\()])*)\)\s*Tj|\[((?:[\s\S]*?))\]\s*TJ|<([0-9A-Fa-f\s]+)>\s*Tj|(T\*|Td|TD|')\b/g
    let match
    while ((match = tokenRegex.exec(block)) !== null) {
      if (match[1] !== undefined) {
        currentLine += decodePdfLiteralString(match[1])
      } else if (match[2] !== undefined) {
        const arrContent = match[2]
        const subRegex = /\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]+)>|(-?\d+(?:\.\d+)?)/g
        let sub
        while ((sub = subRegex.exec(arrContent)) !== null) {
          if (sub[1] !== undefined) {
            currentLine += decodePdfLiteralString(sub[1])
          } else if (sub[2] !== undefined) {
            currentLine += decodePdfHexString(sub[2])
          } else if (sub[3] !== undefined) {
            const kerning = parseFloat(sub[3])
            if (kerning < -120 && !currentLine.endsWith(' ')) {
              currentLine += ' '
            }
          }
        }
      } else if (match[3] !== undefined) {
        currentLine += decodePdfHexString(match[3])
      } else if (match[4] !== undefined) {
        if (currentLine.trim()) {
          lines.push(currentLine.trim())
          currentLine = ''
        }
      }
    }
    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }
  }

  return lines.join('\n')
}

export function extractTextFromPdfBuffer(buffer) {
  const rawStr = buffer.toString('latin1')
  const extractedChunks = []

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match
  while ((match = streamRegex.exec(rawStr)) !== null) {
    const streamBody = match[1]
    const streamBuf = Buffer.from(streamBody, 'latin1')
    let decodedText

    try {
      const inflated = zlib.inflateSync(streamBuf)
      decodedText = inflated.toString('latin1')
    } catch {
      try {
        const inflatedRaw = zlib.inflateRawSync(streamBuf)
        decodedText = inflatedRaw.toString('latin1')
      } catch {
        decodedText = streamBody
      }
    }

    if (decodedText.includes('Tj') || decodedText.includes('TJ')) {
      const text = extractTextFromPdfStream(decodedText)
      if (text && text.trim()) {
        extractedChunks.push(text.trim())
      }
    }
  }

  // eslint-disable-next-line no-control-regex
  const controlCharPattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g
  const combined = extractedChunks
    .join('\n')
    .replace(controlCharPattern, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return combined
}
