import { useState } from 'react';
import './FilterPanel.css';

const FilterPanel = ({ filters, onApply, onReset }) => {
  const [filterValues, setFilterValues] = useState({});
  const [isExpanded, setIsExpanded] = useState(false);

  const handleChange = (name, value) => {
    setFilterValues(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleApply = () => {
    onApply(filterValues);
  };

  const handleReset = () => {
    setFilterValues({});
    onReset();
  };

  const hasActiveFilters = Object.values(filterValues).some(v => v);

  return (
    <div className={`filter-panel ${isExpanded ? 'expanded' : ''}`}>
      <div className="filter-header">
        <button
          className="filter-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span>Фильтры</span>
          {hasActiveFilters && <span className="filter-badge">{Object.values(filterValues).filter(v => v).length}</span>}
          <span className={`toggle-arrow ${isExpanded ? 'up' : 'down'}`}>▼</span>
        </button>
      </div>

      {isExpanded && (
        <div className="filter-content">
          <div className="filter-grid">
            {filters.map((filter) => (
              <div key={filter.name} className="filter-item">
                <label className="filter-label">{filter.label}</label>
                {filter.type === 'select' && (
                  <select
                    className="filter-select"
                    value={filterValues[filter.name] || ''}
                    onChange={(e) => handleChange(filter.name, e.target.value)}
                  >
                    <option value="">Все</option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
                {filter.type === 'date' && (
                  <input
                    type="date"
                    className="filter-input"
                    value={filterValues[filter.name] || ''}
                    onChange={(e) => handleChange(filter.name, e.target.value)}
                  />
                )}
                {filter.type === 'number' && (
                  <input
                    type="number"
                    className="filter-input"
                    placeholder={filter.placeholder}
                    value={filterValues[filter.name] || ''}
                    onChange={(e) => handleChange(filter.name, e.target.value)}
                    min={filter.min}
                    max={filter.max}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="filter-actions">
            <button className="btn-secondary" onClick={handleReset}>
              Сбросить
            </button>
            <button className="btn-primary" onClick={handleApply}>
              Применить
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
