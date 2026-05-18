/**
 * Convert UI filters [{field, op, value, exact}] → backend rows
 * [{field, operator, value}]. Skips empty rows.
 */
export function toBackendFilters(filters, fields) {
  const result = [];
  for (const f of filters) {
    if (!f || !f.field) continue;
    const meta = fields.find((x) => x.key === f.field);
    if (!meta) continue;
    const v = f.value;

    switch (meta.type) {
      case 'boolean':
        if (v === true) result.push({ field: f.field, operator: 'is_true' });
        else if (v === false) result.push({ field: f.field, operator: 'is_false' });
        break;
      case 'select':
        if (meta.multi !== false) {
          if (Array.isArray(v) && v.length > 0) {
            result.push({ field: f.field, operator: 'in', value: v });
          }
        } else if (v !== undefined && v !== null && v !== '') {
          result.push({ field: f.field, operator: 'eq', value: v });
        }
        break;
      case 'number': {
        const op = f.op || 'eq';
        if (op === 'between') {
          if (Array.isArray(v) && v.length === 2 && v[0] !== '' && v[1] !== '') {
            result.push({ field: f.field, operator: 'between', value: v.map(Number) });
          }
        } else if (v !== undefined && v !== null && v !== '') {
          result.push({ field: f.field, operator: op, value: Number(v) });
        }
        break;
      }
      case 'date': {
        const op = f.op || 'eq';
        if (op === 'between') {
          if (Array.isArray(v) && v.length === 2 && v[0] && v[1]) {
            result.push({ field: f.field, operator: 'between', value: v });
          }
        } else if (v) {
          result.push({ field: f.field, operator: op, value: v });
        }
        break;
      }
      case 'string':
      default:
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          result.push({
            field: f.field,
            operator: f.exact ? 'equals' : 'contains',
            value: v,
          });
        }
        break;
    }
  }
  return result;
}

/**
 * Convenience: collapse filter rows into a flat {field: value} query object,
 * picking the LAST equality/contains filter per field (multiple rows on the
 * same field overwrite). Compatible with the existing simple backend params.
 */
export function toFlatParams(filters, fields) {
  const out = {};
  const rows = toBackendFilters(filters, fields);
  for (const row of rows) {
    if (row.operator === 'in' && Array.isArray(row.value)) {
      out[row.field] = row.value.join(',');
    } else if (row.operator === 'is_true') {
      out[row.field] = 'true';
    } else if (row.operator === 'is_false') {
      out[row.field] = 'false';
    } else if (row.operator === 'between' && Array.isArray(row.value)) {
      out[`${row.field}_from`] = row.value[0];
      out[`${row.field}_to`] = row.value[1];
    } else if (row.operator === 'contains') {
      out[`${row.field}_like`] = row.value;
    } else if (row.operator === 'gte') {
      out[`${row.field}_from`] = row.value;
    } else if (row.operator === 'lte') {
      out[`${row.field}_to`] = row.value;
    } else {
      out[row.field] = row.value;
    }
  }
  return out;
}
