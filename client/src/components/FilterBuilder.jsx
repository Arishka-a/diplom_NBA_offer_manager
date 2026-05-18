import './FilterBuilder.css';

const NUMBER_OPS = [
  { value: 'eq',      label: '=' },
  { value: 'neq',     label: '≠' },
  { value: 'gt',      label: '>' },
  { value: 'gte',     label: '≥' },
  { value: 'lt',      label: '<' },
  { value: 'lte',     label: '≤' },
  { value: 'between', label: 'между' },
];

const DATE_OPS = NUMBER_OPS;

const newId = () => Date.now() + Math.random();

const NumberValue = ({ value, op = 'eq', onValueChange, onOpChange, ops = NUMBER_OPS, inputType = 'number' }) => {
  if (op === 'between') {
    const [a, b] = Array.isArray(value) ? value : ['', ''];
    return (
      <>
        <select className="fb-op" value={op} onChange={(e) => onOpChange(e.target.value)}>
          {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input
          type={inputType}
          className="fb-value fb-value-narrow"
          placeholder="от"
          value={a ?? ''}
          onChange={(e) => onValueChange([e.target.value, b])}
        />
        <input
          type={inputType}
          className="fb-value fb-value-narrow"
          placeholder="до"
          value={b ?? ''}
          onChange={(e) => onValueChange([a, e.target.value])}
        />
      </>
    );
  }
  return (
    <>
      <select className="fb-op" value={op} onChange={(e) => onOpChange(e.target.value)}>
        {ops.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <input
        type={inputType}
        className="fb-value"
        placeholder="значение"
        value={value ?? ''}
        onChange={(e) => onValueChange(e.target.value)}
      />
    </>
  );
};

const StringValue = ({ value, exact, onValueChange, onExactChange }) => (
  <>
    <input
      type="text"
      className="fb-value"
      placeholder="значение"
      value={value ?? ''}
      onChange={(e) => onValueChange(e.target.value)}
    />
    <label className="fb-exact" title="Сравнивать целиком, без поиска подстроки">
      <input
        type="checkbox"
        checked={!!exact}
        onChange={(e) => onExactChange(e.target.checked)}
      />
      точное
    </label>
  </>
);

const SelectValue = ({ value, options, onValueChange, multi = true }) => {
  if (multi) {
    const selected = Array.isArray(value) ? value : [];
    const handleChange = (e) => {
      const opts = Array.from(e.target.selectedOptions).map((o) => o.value);
      onValueChange(opts);
    };
    return (
      <select
        multiple
        className="fb-value fb-value-multi"
        value={selected}
        onChange={handleChange}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  return (
    <select
      className="fb-value"
      value={value ?? ''}
      onChange={(e) => onValueChange(e.target.value)}
    >
      <option value="">— выберите —</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
};

const BooleanValue = ({ value, onValueChange }) => (
  <select
    className="fb-value"
    value={value === true ? 'true' : value === false ? 'false' : ''}
    onChange={(e) => {
      const v = e.target.value;
      onValueChange(v === '' ? undefined : v === 'true');
    }}
  >
    <option value="">— выберите —</option>
    <option value="true">да</option>
    <option value="false">нет</option>
  </select>
);

const FilterValue = ({ field, filter, onChange }) => {
  if (!field) return null;
  switch (field.type) {
    case 'number':
      return (
        <NumberValue
          value={filter.value}
          op={filter.op || 'eq'}
          onValueChange={(v) => onChange({ ...filter, value: v })}
          onOpChange={(newOp) => {
            let nextValue = filter.value;
            if (newOp === 'between' && !Array.isArray(filter.value)) nextValue = ['', ''];
            if (newOp !== 'between' && Array.isArray(filter.value)) nextValue = '';
            onChange({ ...filter, op: newOp, value: nextValue });
          }}
        />
      );
    case 'date':
      return (
        <NumberValue
          value={filter.value}
          op={filter.op || 'eq'}
          ops={DATE_OPS}
          inputType="date"
          onValueChange={(v) => onChange({ ...filter, value: v })}
          onOpChange={(newOp) => {
            let nextValue = filter.value;
            if (newOp === 'between' && !Array.isArray(filter.value)) nextValue = ['', ''];
            if (newOp !== 'between' && Array.isArray(filter.value)) nextValue = '';
            onChange({ ...filter, op: newOp, value: nextValue });
          }}
        />
      );
    case 'boolean':
      return (
        <BooleanValue
          value={filter.value}
          onValueChange={(v) => onChange({ ...filter, value: v })}
        />
      );
    case 'select':
      return (
        <SelectValue
          value={filter.value}
          options={field.options || []}
          multi={field.multi !== false}
          onValueChange={(v) => onChange({ ...filter, value: v })}
        />
      );
    case 'string':
    default:
      return (
        <StringValue
          value={filter.value}
          exact={filter.exact}
          onValueChange={(v) => onChange({ ...filter, value: v })}
          onExactChange={(ex) => onChange({ ...filter, exact: ex })}
        />
      );
  }
};

const FilterRow = ({ index, filter, fields, onChange, onRemove }) => {
  const field = fields.find((f) => f.key === filter.field);
  const handleFieldChange = (key) => {
    const meta = fields.find((f) => f.key === key);
    onChange({
      id: filter.id,
      field: key,
      op: meta?.type === 'number' || meta?.type === 'date' ? 'eq' : undefined,
      value: meta?.type === 'select' && meta?.multi !== false ? [] : '',
      exact: false,
    });
  };

  return (
    <div className="fb-row">
      <span className="fb-tag">{index + 1}</span>
      <select
        className="fb-field"
        value={filter.field || ''}
        onChange={(e) => handleFieldChange(e.target.value)}
      >
        {fields.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
      </select>
      <FilterValue field={field} filter={filter} onChange={onChange} />
      <button
        type="button"
        className="fb-remove"
        title="Удалить условие"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
};

const FilterBuilder = ({
  fields = [],
  value = [],
  onChange,
  logic = 'AND',
  onLogicChange,
  onApply,
  onReset,
}) => {
  const addRow = () => {
    const first = fields[0];
    if (!first) return;
    const initialValue = first.type === 'select' && first.multi !== false ? [] : '';
    const initialOp = first.type === 'number' || first.type === 'date' ? 'eq' : undefined;
    onChange([
      ...value,
      { id: newId(), field: first.key, op: initialOp, value: initialValue, exact: false },
    ]);
  };

  const updateRow = (idx, next) => {
    const arr = value.slice();
    arr[idx] = next;
    onChange(arr);
  };

  const removeRow = (idx) => {
    const next = value.filter((_, i) => i !== idx);
    onChange(next);
    // Immediately apply the new filter set so the user does not need to
    // press "Применить" after removing a row. Pass `next` explicitly because
    // parent's filterRows state has not been flushed yet at this point.
    onApply?.(next);
  };

  return (
    <div className="filter-builder">
      {value.length > 1 && (
        <div className="fb-logic">
          <span className="fb-logic-label">Совпадение:</span>
          <label>
            <input
              type="radio"
              name="fb-logic"
              checked={logic === 'AND'}
              onChange={() => onLogicChange?.('AND')}
            />
            все условия (И)
          </label>
          <label>
            <input
              type="radio"
              name="fb-logic"
              checked={logic === 'OR'}
              onChange={() => onLogicChange?.('OR')}
            />
            любое условие (ИЛИ)
          </label>
        </div>
      )}

      {value.map((f, i) => (
        <FilterRow
          key={f.id}
          index={i}
          filter={f}
          fields={fields}
          onChange={(next) => updateRow(i, next)}
          onRemove={() => removeRow(i)}
        />
      ))}

      <div className="fb-actions">
        <button
          type="button"
          className="fb-btn fb-btn-add"
          onClick={addRow}
          disabled={fields.length === 0}
        >
          + Добавить фильтр
        </button>
        <button type="button" className="fb-btn fb-btn-primary" onClick={() => onApply?.(value)}>
          Применить
        </button>
        {value.length > 0 && (
          <button type="button" className="fb-btn fb-btn-secondary" onClick={onReset}>
            Сбросить
          </button>
        )}
      </div>
    </div>
  );
};

export default FilterBuilder;
