import { useState } from 'react';
import {
  exportOffers,
  exportSegments,
  exportRules,
  exportLogs,
  downloadFile
} from '../services/importExportService';
import './DataPage.css';

const Export = () => {
  const [exportType, setExportType] = useState('offers');
  const [format, setFormat] = useState('csv');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const exportOptions = [
    {
      value: 'offers',
      label: 'Офферы',
      description: 'Экспорт всех офферов с их параметрами'
    },
    {
      value: 'segments',
      label: 'Сегменты',
      description: 'Экспорт всех сегментов с критериями'
    },
    {
      value: 'rules',
      label: 'Правила',
      description: 'Экспорт всех правил NBA системы'
    },
    {
      value: 'logs',
      label: 'Логи',
      description: 'Экспорт журнала действий пользователей'
    }
  ];

  const formatOptions = [
    {
      value: 'csv',
      label: 'CSV',
      description: 'Comma-separated values (универсальный формат)'
    },
    {
      value: 'xlsx',
      label: 'Excel',
      description: 'Microsoft Excel (.xlsx)'
    }
  ];

  const handleExport = async () => {
    setExporting(true);
    setError('');
    setSuccess('');

    try {
      let blob;
      let filename;

      switch (exportType) {
        case 'offers':
          blob = await exportOffers(format);
          filename = `offers_${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
          break;
        case 'segments':
          blob = await exportSegments(format);
          filename = `segments_${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
          break;
        case 'rules':
          blob = await exportRules(format);
          filename = `rules_${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
          break;
        case 'logs':
          blob = await exportLogs(format);
          filename = `logs_${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'csv'}`;
          break;
        default:
          throw new Error('Неизвестный тип экспорта');
      }

      downloadFile(blob, filename);
      setSuccess(`Файл ${filename} успешно скачан!`);
    } catch (err) {
      console.error('Export error:', err);
      setError(err.response?.data?.error || err.message || 'Ошибка при экспорте данных');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="data-page">
      <div className="page-header">
        <h1>Экспорт данных</h1>
      </div>

      <div className="export-container">
        {/* Выбор типа экспорта */}
        <div className="export-section">
          <h3>1. Выберите тип данных</h3>
          <div className="export-type-grid">
            {exportOptions.map((option) => (
              <label
                key={option.value}
                className={`export-type-option ${exportType === option.value ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="exportType"
                  value={option.value}
                  checked={exportType === option.value}
                  onChange={(e) => setExportType(e.target.value)}
                />
                <div className="option-content">
                  <h4>{option.label}</h4>
                  <p>{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Выбор формата */}
        <div className="export-section">
          <h3>2. Выберите формат файла</h3>
          <div className="format-selector">
            {formatOptions.map((option) => (
              <label
                key={option.value}
                className={`format-option ${format === option.value ? 'active' : ''}`}
              >
                <input
                  type="radio"
                  name="format"
                  value={option.value}
                  checked={format === option.value}
                  onChange={(e) => setFormat(e.target.value)}
                />
                <div className="option-content">
                  <h4>{option.label}</h4>
                  <p>{option.description}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Информация */}
        <div className="export-section">
          <h3>3. Информация об экспорте</h3>
          <div className="export-info">
            <div className="info-item">
              <strong>Тип данных:</strong> {exportOptions.find(o => o.value === exportType)?.label}
            </div>
            <div className="info-item">
              <strong>Формат:</strong> {formatOptions.find(f => f.value === format)?.label}
            </div>
            <div className="info-item">
              <strong>Размер:</strong> Зависит от количества данных
            </div>
          </div>
        </div>

        {/* Сообщения */}
        {error && (
          <div className="page-error">
            {error}
          </div>
        )}

        {success && (
          <div className="page-success">
            {success}
          </div>
        )}

        {/* Кнопка экспорта */}
        <div className="export-actions">
          <button
            className="btn-primary btn-large"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? (
              <>
                <span className="spinner"></span>
                Экспортирование...
              </>
            ) : (
              <>
                Скачать {formatOptions.find(f => f.value === format)?.label}
              </>
            )}
          </button>
        </div>
      </div>

      <style jsx>{`
        .export-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .export-section {
          background: var(--background-white);
          padding: 24px;
          margin-bottom: 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color-light);
        }

        .export-section h3 {
          margin: 0 0 16px 0;
          font-size: 16px;
          color: var(--text-dark);
          font-weight: 600;
        }

        .export-type-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .export-type-option,
        .format-option {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 16px;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--background-white);
        }

        .export-type-option:hover,
        .format-option:hover {
          border-color: var(--primary-blue);
        }

        .export-type-option.active,
        .format-option.active {
          border-color: var(--primary-blue);
          background: #e6f4ff;
        }

        .export-type-option input[type="radio"],
        .format-option input[type="radio"] {
          display: none;
        }

        .option-icon {
          font-size: 28px;
          display: block;
          margin-bottom: 10px;
          color: var(--primary-blue);
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

        .format-selector {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }

        .export-info {
          background: var(--background-light);
          padding: 16px;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-color-light);
        }

        .info-item {
          padding: 8px 0;
          border-bottom: 1px solid var(--border-color-light);
          font-size: 14px;
          color: var(--text-dark);
        }

        .info-item:last-child {
          border-bottom: none;
        }

        .info-item strong {
          display: inline-block;
          min-width: 120px;
          color: var(--text-medium);
          font-weight: 500;
        }

        .page-success {
          background: var(--status-active-bg);
          border: 1px solid var(--status-active-border);
          color: #237804;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          margin-bottom: 16px;
        }

        .export-actions {
          display: flex;
          justify-content: center;
          padding: 16px 0;
        }

        .btn-large {
          font-size: 14px;
          padding: 8px 32px;
          min-width: 250px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid #ffffff;
          border-top-color: transparent;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default Export;
