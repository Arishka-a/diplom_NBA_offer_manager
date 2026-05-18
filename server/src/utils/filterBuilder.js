/**
 * Generic SQL WHERE-clause builder for list endpoints.
 *
 * Accepts a flat req.query object and a whitelist of allowed columns.
 * Recognises these suffix conventions on the query keys:
 *   field        → "<col> = $n"           (equality)
 *   field_from   → "<col> >= $n"          (range lower bound)
 *   field_to     → "<col> <= $n"          (range upper bound)
 *   field_like   → "<col>::text ILIKE $n" (substring, %value%)
 *
 * `allowed` maps the public field key to a fully-qualified SQL identifier
 * (e.g. { id: 'o.id', title: 'o.title' }). Anything not in `allowed` is
 * silently ignored to keep the SQL injection surface tight.
 *
 * Returns { whereSql, params } where:
 *   whereSql — fragment WITHOUT leading "WHERE"/"AND" (caller composes)
 *   params   — array of bound parameter values, in order
 *
 * `paramOffset` lets the caller continue from an existing $n index when
 * additional clauses (search, joins) already consumed parameter slots.
 */
function buildWhere(allowed, query, paramOffset = 0) {
  const parts = [];
  const params = [];
  let idx = paramOffset + 1;

  for (const [rawKey, rawVal] of Object.entries(query || {})) {
    if (rawVal === undefined || rawVal === null || rawVal === '') continue;

    let baseKey = rawKey;
    let op = 'eq';

    if (rawKey.endsWith('_from')) {
      baseKey = rawKey.slice(0, -'_from'.length);
      op = 'gte';
    } else if (rawKey.endsWith('_to')) {
      baseKey = rawKey.slice(0, -'_to'.length);
      op = 'lte';
    } else if (rawKey.endsWith('_like')) {
      baseKey = rawKey.slice(0, -'_like'.length);
      op = 'like';
    }

    const col = allowed[baseKey];
    if (!col) continue;

    let value = rawVal;
    let fragment;
    switch (op) {
      case 'gte':
        fragment = `${col} >= $${idx}`;
        break;
      case 'lte':
        fragment = `${col} <= $${idx}`;
        break;
      case 'like':
        fragment = `${col}::text ILIKE $${idx}`;
        value = `%${rawVal}%`;
        break;
      case 'eq':
      default:
        // Booleans coming over the wire are 'true'/'false' strings.
        if (rawVal === 'true' || rawVal === 'false') value = rawVal === 'true';
        fragment = `${col} = $${idx}`;
        break;
    }

    parts.push(fragment);
    params.push(value);
    idx++;
  }

  return { whereSql: parts.join(' AND '), params };
}

module.exports = { buildWhere };
