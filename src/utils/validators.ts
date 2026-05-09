export function validateEmail(email: string): string | null {
  const clean = email.trim();
  if (!clean) return "El correo electrónico es obligatorio.";
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!re.test(clean)) return "El formato del correo electrónico no es válido.";
  return null;
}

export function validateMexicanPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "El teléfono es obligatorio.";
  if (digits.length !== 10) return `El teléfono debe tener 10 dígitos (${digits.length}/10).`;
  return null;
}

export function validateCurp(curp: string): string | null {
  const clean = curp.trim().toUpperCase();
  if (!clean) return "El CURP es obligatorio.";
  if (clean.length !== 18) return `El CURP debe tener 18 caracteres (${clean.length}/18).`;
  if (!/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z\d]{2}$/.test(clean))
    return "El formato del CURP no es válido.";
  return null;
}

export function validateBirthDate(
  dateStr: string,
  minAgeYears = 18,
  maxAgeYears = 100
): string | null {
  if (!dateStr) return "La fecha de nacimiento es obligatoria.";

  const date = new Date(dateStr + "T12:00:00");
  const now = new Date();

  const maxDate = new Date(now.getFullYear() - minAgeYears, now.getMonth(), now.getDate());
  const minDate = new Date(now.getFullYear() - maxAgeYears, now.getMonth(), now.getDate());

  if (date > now) return "La fecha de nacimiento no puede ser futura.";
  if (date > maxDate) return `La persona debe tener al menos ${minAgeYears} años.`;
  if (date < minDate) return `La fecha parece incorrecta (más de ${maxAgeYears} años).`;

  return null;
}

const MEMORABLE_WORDS = [
  "AGUA", "LUNA", "NUBE", "ROCA", "FLOR", "MESA", "LAGO", "PINO",
  "TREN", "VELA", "BOCA", "TORO", "PUMA", "ALBA", "DUNA", "CIMA",
  "ONDA", "LOMA", "FARO", "ARCO", "PICO", "HOJA", "NIDO",
  "CAMPO", "MONTE", "VERDE", "PLAYA", "ARENA", "BRISA", "SELVA",
];

const MEMORABLE_SYMBOLS = ["!", "@", "#", "$", "%"];

export function generateMemorablePassword(): string {
  const word   = MEMORABLE_WORDS[Math.floor(Math.random() * MEMORABLE_WORDS.length)];
  const symbol = MEMORABLE_SYMBOLS[Math.floor(Math.random() * MEMORABLE_SYMBOLS.length)];
  const num    = String(Math.floor(Math.random() * 90) + 10); // 10–99
  return `${symbol}${word}${num}`;
}
