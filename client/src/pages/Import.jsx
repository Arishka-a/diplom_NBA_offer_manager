import { useState } from 'react';
import { importOffers, importSegments } from '../services/importExportService';
import './DataPage.css';

const Import = () => {
  const [importType, setImportType] = useState('offers');
  const [selectedFile, setSelectedFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Проверка типа файла
      const validTypes = [
        'text/csv',
        'application/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel'
      ];

      if (!validTypes.includes(file.type) && !file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
        setError('Неподдерживаемый формат файла. Используйте CSV или Excel (.xlsx)');
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setError('');
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Выберите файл для импорта');
      return;
    }

    setImporting(true);
    setError('');
    setResults(null);

    try {
      let response;
      if (importType === 'offers') {
        response = await importOffers(selectedFile);
      } else {
        response = await importSegments(selectedFile);
      }

      setResults(response.results);

      // Очистить выбранный файл после успешного импорта
      setSelectedFile(null);
      document.getElementById('file-input').value = '';
    } catch (err) {
      console.error('Import error:', err);
      setError(err.response?.data?.error || err.message || 'Ошибка при импорте данных');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResults(null);
    setError('');
    document.getElementById('file-input').value = '';
  };

  return (
    <div className="data-page">
      <div className="page-header">
        <h1>Импорт данных</h1>
      </div>

      <div className="import-container">
        {/* Выбор типа импорта */}
        <div className="import-section">
          <h3>1. Выберите тип данных</h3>
          <div className="import-type-selector">
            <label className={`import-type-option ${importType === 'offers' ? 'active' : ''}`}>
              <input
                type="radio"
                name="importType"
                value="offers"
                checked={importType === 'offers'}
                onChange={(e) => setImportType(e.target.value)}
              />
              <div className="option-content">
                <h4>Офферы</h4>
                <p>Импорт списка офферов из CSV или Excel</p>
              </div>
            </label>

            <label className={`import-type-option ${importType === 'segments' ? 'active' : ''}`}>
              <input
                type="radio"
                name="importType"
                value="segments"
                checked={importType === 'segments'}
                onChange={(e) => setImportType(e.target.value)}
              />
              <div className="option-content">
                <h4>Сегменты</h4>
                <p>Импорт списка сегментов из CSV или Excel</p>
              </div>
            </label>
          </div>
        </div>

        {/* Формат файла */}
        <div className="import-section">
          <h3>2. Формат файла</h3>
          <div className="format-info">
            {importType === 'offers' ? (
              <div className="format-description">
                <p><strong>Обязательные колонки:</strong></p>
                <ul>
                  <li><code>title</code> - Название оффера</li>
                  <li><code>offer_type</code> - Тип: discount, bonus, recommendation, upgrade, retention</li>
                </ul>
                <p><strong>Дополнительные колонки:</strong></p>
                <ul>
                  <li><code>description</code> - Описание</li>
                  <li><code>status</code> - Статус: draft, active, inactive, archived</li>
                  <li><code>priority</code> - Приоритет (1-100)</li>
                  <li><code>start_date</code> - Дата начала (YYYY-MM-DD)</li>
                  <li><code>end_date</code> - Дата окончания (YYYY-MM-DD)</li>
                  <li><code>segment_ids</code> - ID сегментов через запятую (1,2,3)</li>
                </ul>
                <p className="format-note">
                  <strong>Важно:</strong> Колонки <code>id</code>, <code>created_by</code> и <code>created_at</code>
                  НЕ нужны в CSV - они заполняются автоматически!
                </p>
                <p className="format-example">
                  <strong>Пример CSV:</strong><br/>
                  <code>title,description,offer_type,status,priority,start_date,end_date,segment_ids</code><br/>
                  <code>&quot;Скидка 20%&quot;,&quot;Специальное предложение&quot;,discount,active,80,2025-01-01,2025-12-31,&quot;1,2&quot;</code>
                </p>
              </div>
            ) : (
              <div className="format-description">
                <p><strong>Обязательные колонки:</strong></p>
                <ul>
                  <li><code>name</code> - Название сегмента</li>
                </ul>
                <p><strong>Дополнительные колонки:</strong></p>
                <ul>
                  <li><code>description</code> - Описание</li>
                  <li><code>criteria</code> - JSON объект с критериями</li>
                  <li><code>is_active</code> - Активен (true/false)</li>
                </ul>
                <p className="format-note">
                  <strong>Важно:</strong> Колонки <code>id</code>, <code>created_by</code> и <code>created_at</code>
                  НЕ нужны в CSV - они заполняются автоматически!
                </p>
                <p className="format-example">
                  <strong>Пример CSV:</strong><br/>
                  <code>name,description,is_active,criteria</code><br/>
                  <code>&quot;VIP клиенты&quot;,&quot;Клиенты с высоким ARPU&quot;,true,&quot;&#123;&quot;&quot;min_arpu&quot;&quot;: 5000&#125;&quot;</code>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Выбор файла */}
        <div className="import-section">
          <h3>3. Выберите файл</h3>
          <div className="file-upload">
            <input
              id="file-input"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              disabled={importing}
            />
            {selectedFile && (
              <div className="file-info">
                Выбран файл: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(2)} КБ)
              </div>
            )}
          </div>
        </div>

        {/* Ошибки */}
        {error && (
          <div className="page-error">
            {error}
          </div>
        )}

        {/* Результаты импорта */}
        {results && (
          <div className="import-results">
            <h3>Результаты импорта</h3>
            <div className="results-summary">
              <div className="result-item success">
                <span className="result-label">Успешно:</span>
                <span className="result-value">{results.success}</span>
              </div>
              <div className="result-item failed">
                <span className="result-label">Ошибки:</span>
                <span className="result-value">{results.failed}</span>
              </div>
              <div className="result-item total">
                <span className="result-label">Всего строк:</span>
                <span className="result-value">{results.total}</span>
              </div>
            </div>

            {results.errors && results.errors.length > 0 && (
              <div className="error-details">
                <h4>Ошибки импорта:</h4>
                <div className="error-list">
                  {results.errors.map((err, index) => (
                    <div key={index} className="error-item">
                      <strong>Строка {err.row}:</strong> {err.error}
                      {err.data && (
                        <pre className="error-data">{JSON.stringify(err.data, null, 2)}</pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Кнопки действий */}
        <div className="import-actions">
          <button
            className="btn-secondary"
            onClick={handleReset}
            disabled={importing}
          >
            Сбросить
          </button>
          <button
            className="btn-primary"
            onClick={handleImport}
            disabled={!selectedFile || importing}
          >
            {importing ? 'Импортирование...' : 'Импортировать'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .import-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .import-section {
          background: var(--background-white);
          padding: 24px;
          margin-bottom: 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color-light);
        }

        .import-section h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: var(--text-dark);
          font-weight: 600;
        }

        .import-type-selector {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .import-type-option {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--background-white);
        }

        .import-type-option:hover {
          border-color: var(--primary-blue);
        }

        .import-type-option.active {
          border-color: var(--primary-blue);
          background: #e6f4ff;
        }

        .import-type-option input[type="radio"] {
          display: none;
        }

        .option-content h4 {
          margin: 0 0 6px 0;
          font-size: 14px;
          color: var(--text-dark);
          font-weight: 600;
        }

        .option-content p {
          margin: 0;
          font-size: 13px;
          color: var(--text-medium);
        }

        .format-info {
          background: var(--background-light);
          padding: 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color-light);
        }

        .format-description ul {
          margin: 8px 0;
          padding-left: 20px;
        }

        .format-description li {
          margin: 4px 0;
          font-size: 14px;
          color: var(--text-medium);
        }

        .format-description code {
          background: var(--background-white);
          border: 1px solid var(--border-color-light);
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          font-family: 'Consolas', 'Monaco', monospace;
          font-size: 13px;
          color: var(--primary-blue);
        }

        .format-note {
          margin: 16px 0;
          padding: 8px 12px;
          background: var(--status-action-bg);
          border: 1px solid var(--status-action-border);
          border-radius: var(--radius-md);
          font-size: 14px;
          color: #ad4e00;
        }

        .format-example {
          margin: 16px 0;
          padding: 8px 12px;
          background: #e6f4ff;
          border: 1px solid #91caff;
          border-radius: var(--radius-md);
          font-size: 13px;
          color: #0958d9;
        }

        .format-example code {
          display: block;
          margin: 4px 0;
          padding: 4px 8px;
          background: var(--background-white);
          border-radius: var(--radius-sm);
          overflow-x: auto;
          color: var(--text-dark);
        }

        .file-upload {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .file-upload input[type="file"] {
          padding: 10px;
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-md);
          cursor: pointer;
          background: var(--background-light);
        }

        .file-info {
          padding: 8px 12px;
          background: var(--status-active-bg);
          border: 1px solid var(--status-active-border);
          border-radius: var(--radius-md);
          font-size: 14px;
          color: #237804;
        }

        .import-results {
          background: var(--background-white);
          padding: 24px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color-light);
          margin-bottom: 16px;
        }

        .results-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
          margin-top: 16px;
        }

        .result-item {
          padding: 16px;
          border-radius: var(--radius-md);
          text-align: center;
          border: 1px solid transparent;
        }

        .result-item.success {
          background: var(--status-active-bg);
          border-color: var(--status-active-border);
        }

        .result-item.failed {
          background: var(--status-error-bg);
          border-color: var(--status-error-border);
        }

        .result-item.total {
          background: #e6f4ff;
          border-color: #91caff;
        }

        .result-label {
          display: block;
          font-size: 13px;
          color: var(--text-medium);
          margin-bottom: 6px;
        }

        .result-value {
          display: block;
          font-size: 28px;
          font-weight: 600;
          color: var(--text-dark);
        }

        .error-details {
          margin-top: 24px;
        }

        .error-list {
          max-height: 400px;
          overflow-y: auto;
        }

        .error-item {
          padding: 8px 12px;
          background: var(--status-action-bg);
          border: 1px solid var(--status-action-border);
          margin-bottom: 8px;
          border-radius: var(--radius-md);
          color: #ad4e00;
        }

        .error-data {
          margin-top: 8px;
          padding: 8px;
          background: var(--background-white);
          border-radius: var(--radius-sm);
          font-size: 12px;
          overflow-x: auto;
          color: var(--text-dark);
        }

        .import-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
};

export default Import;
