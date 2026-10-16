const BOOKING_REFERENCE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
    return bytes;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return bytes;
}

function randomBlock(length: number) {
  return Array.from(randomBytes(length), (byte) => BOOKING_REFERENCE_ALPHABET[byte % BOOKING_REFERENCE_ALPHABET.length]).join("");
}

export function createBookingReference(date = new Date()) {
  const datePart = date.toISOString().slice(2, 10).replaceAll("-", "");
  return `LDA-${datePart}-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`;
}

export function isLdaBookingReference(value: string) {
  return /^LDA-\d{6}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(value.trim().toUpperCase());
}
