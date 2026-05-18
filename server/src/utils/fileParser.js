const XLSX = require('xlsx');
const Papa = require('papaparse');

/**
 * Парсит CSV файл из буфера
 * @param {Buffer} buffer - Буфер файла
 * @returns {Array} Массив объектов
 */
const parseCSV = (buffer) => {
  const csvString = buffer.toString('utf-8');
  const result = Papa.parse(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
    dynamicTyping: true
  });

  if (result.errors.length > 0) {
    throw new Error(`CSV parsing errors: ${result.errors.map(e => e.message).join(', ')}`);
  }

  return result.data;
};

/**
 * Парсит Excel файл из буфера
 * @param {Buffer} buffer - Буфер файла
 * @returns {Array} Массив объектов
 */
const parseExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  return XLSX.utils.sheet_to_json(worksheet, {
    raw: false,
    defval: null
  });
};

/**
 * Парсит файл в зависимости от типа
 * @param {Buffer} buffer - Буфер файла
 * @param {String} mimetype - MIME тип файла
 * @returns {Array} Массив объектов
 */
const parseFile = (buffer, mimetype) => {
  if (mimetype === 'text/csv' || mimetype === 'application/csv') {
    return parseCSV(buffer);
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimetype === 'application/vnd.ms-excel'
  ) {
    return parseExcel(buffer);
  } else {
    throw new Error('Неподдерживаемый формат файла. Используйте CSV или Excel (xlsx)');
  }
};

/**
 * Генерирует CSV из массива объектов
 * @param {Array} data - Массив объектов
 * @returns {String} CSV строка
 */
const generateCSV = (data) => {
  return Papa.unparse(data, {
    header: true,
    quotes: true
  });
};

/**
 * Генерирует Excel из массива объектов
 * @param {Array} data - Массив объектов
 * @param {String} sheetName - Название листа
 * @returns {Buffer} Excel буфер
 */
const generateExcel = (data, sheetName = 'Sheet1') => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
};

module.exports = {
  parseFile,
  parseCSV,
  parseExcel,
  generateCSV,
  generateExcel
};
