import QRCode from 'qrcode'

export const MERCHANT_STATIC_QRIS =
  '00020101021126610014COM.GO-JEK.WWW01189360091431792577940210G1792577940303UMI51440014ID.CO.QRIS.WWW0215ID10264739919860303UMI5204899953033605802ID5920Digital Creativa-Jog6012GUNUNG KIDUL61055588162070703A016304D7ED'

export const MERCHANT_INFO = {
  name: 'Digital Creativa-Jog',

  nmid: 'ID1026473991986',
}

/**
 * Menghitung checksum CRC-16/CCITT-FALSE standar EMVCo QRIS
 */
export function calculateCRC16(str) {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff
      } else {
        crc = (crc << 1) & 0xffff
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/**
 * Mengubah QRIS Statis menjadi QRIS Dinamis sesuai nominal Rupiah (Tag 54)
 * @param {number|string} nominal - Nominal dalam Rupiah (contoh: 1000, 2000, 5000, 10000)
 * @param {string} staticQris - Payload QRIS statis dasar
 */
export function generateDynamicQRIS(nominal, staticQris = MERCHANT_STATIC_QRIS) {
  const rawAmount = Math.round(Number(String(nominal).replace(/[^0-9]/g, '')) || 0)

  if (!rawAmount || rawAmount <= 0) {
    return staticQris
  }

  const cleanAmount = Math.min(5000000, Math.max(1000, rawAmount))

  // 1. Buang 4 karakter CRC lama di ujung (menyisakan ...6304)
  const withoutCrc = staticQris.slice(0, -4)

  // 2. Ubah Point of Initiation Method dari 010211 (Statis) ke 010212 (Dinamis)
  const stepDynamic = withoutCrc.replace('010211', '010212')

  // 3. Susun Tag 54 (Transaction Amount): "54" + 2 digit panjang + nominal
  const amountStr = String(cleanAmount)
  const amountLen = String(amountStr.length).padStart(2, '0')
  const tag54 = `54${amountLen}${amountStr}`

  // 4. Sisipkan Tag 54 tepat sebelum Tag 58 (5802ID)
  const splitTarget = '5802ID'
  const parts = stepDynamic.split(splitTarget)
  if (parts.length < 2) {
    return staticQris
  }

  const payloadWithAmount = `${parts[0]}${tag54}${splitTarget}${parts.slice(1).join(splitTarget)}`

  // 5. Hitung CRC16 baru dan gabungkan
  const newCrc = calculateCRC16(payloadWithAmount)
  return `${payloadWithAmount}${newCrc}`
}

/**
 * Menghasilkan Data URL gambar QR Code dari string QRIS
 */
export async function createQRISDataUrl(qrisPayload, width = 320) {
  return QRCode.toDataURL(qrisPayload, {
    width,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#2d0912',
      light: '#ffffff',
    },
  })
}

export function formatRupiah(nominal) {
  const num = Math.round(Number(String(nominal).replace(/[^0-9]/g, '')) || 0)
  return `Rp ${num.toLocaleString('id-ID')}`
}
