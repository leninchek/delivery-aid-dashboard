// Client-side CSV parser and format validator for bulk user import.
// Only checks format (phone digits, required columns). ID resolution happens server-side.

export const CSV_HEADERS = ['phone', 'levelId', 'parentId', 'cityId', 'communityId', 'routeId'] as const;

export const CSV_TEMPLATE =
  'phone,levelId,parentId,cityId,communityId,routeId\n' +
  '5512345678,<levelId>,,,,\n';

const PHONE_REGEX = /^\d{10}$/;
const MAX_ROWS    = 500;

export type CsvRow = {
  rowNum:      number;
  phone:       string;
  levelId:     string;
  parentId:    string | null;
  cityId:      string | null;
  communityId: string | null;
  routeId:     string | null;
};

export type CsvRowError = {
  row:    number;
  phone:  string;
  reason: string;
};

export type CsvParseResult = {
  valid:     CsvRow[];
  errors:    CsvRowError[];
  totalRows: number;
};

function parseRawCsv(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line =>
      line.split(',').map(cell => {
        const t = cell.trim();
        return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).trim() : t;
      })
    );
}

export function parseCsvImport(content: string): CsvParseResult {
  const rows = parseRawCsv(content);

  if (rows.length === 0) {
    return { valid: [], errors: [], totalRows: 0 };
  }

  const header      = rows[0].map(h => h.toLowerCase().trim());
  const phoneIdx    = header.indexOf('phone');
  const levelIdIdx  = header.indexOf('levelid');
  const parentIdIdx = header.indexOf('parentid');
  const cityIdIdx   = header.indexOf('cityid');
  const commIdx     = header.indexOf('communityid');
  const routeIdx    = header.indexOf('routeid');

  if (phoneIdx === -1 || levelIdIdx === -1) {
    return {
      valid:     [],
      errors:    [{ row: 1, phone: '', reason: 'Faltan columnas obligatorias: phone, levelId' }],
      totalRows: 0,
    };
  }

  const dataRows = rows.slice(1);
  const valid:  CsvRow[]      = [];
  const errors: CsvRowError[] = [];
  const phoneSeen = new Set<string>();

  const capped = dataRows.slice(0, MAX_ROWS + 1);

  for (let i = 0; i < capped.length; i++) {
    const cols   = capped[i];
    const rowNum = i + 2;

    if (i >= MAX_ROWS) {
      errors.push({ row: rowNum, phone: '', reason: `Límite de ${MAX_ROWS} filas superado; las filas adicionales se ignoraron` });
      break;
    }

    const phone   = (cols[phoneIdx] ?? '').replace(/\D/g, '');
    const levelId = cols[levelIdIdx] ?? '';

    if (!PHONE_REGEX.test(phone)) {
      errors.push({ row: rowNum, phone, reason: 'Teléfono inválido (debe tener 10 dígitos)' });
      continue;
    }
    if (!levelId) {
      errors.push({ row: rowNum, phone, reason: 'levelId es obligatorio' });
      continue;
    }
    if (phoneSeen.has(phone)) {
      errors.push({ row: rowNum, phone, reason: 'Teléfono duplicado en el CSV' });
      continue;
    }
    phoneSeen.add(phone);

    valid.push({
      rowNum,
      phone,
      levelId,
      parentId:    parentIdIdx !== -1 ? (cols[parentIdIdx] || null) : null,
      cityId:      cityIdIdx   !== -1 ? (cols[cityIdIdx]   || null) : null,
      communityId: commIdx     !== -1 ? (cols[commIdx]     || null) : null,
      routeId:     routeIdx    !== -1 ? (cols[routeIdx]    || null) : null,
    });
  }

  return { valid, errors, totalRows: dataRows.length };
}

export function downloadCsvTemplate(): void {
  const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'plantilla_usuarios.csv';
  a.click();
  URL.revokeObjectURL(url);
}
