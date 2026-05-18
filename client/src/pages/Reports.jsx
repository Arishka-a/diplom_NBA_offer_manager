import { useState, useEffect } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  getDashboardStats,
  getOfferPerformanceReport,
  getOfferTypeReport,
  getSegmentPerformanceReport,
  getInteractionsTrendReport,
  getTopOffersByConversion,
  getTopOffersByViews,
  getCustomerSegmentDistribution,
  getCustomerStatsReport,
  exportToPdf
} from '../services/reportService';
import './Reports.css';

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // Статистика
  const [dashboardStats, setDashboardStats] = useState(null);
  const [offerTypeStats, setOfferTypeStats] = useState([]);
  const [topOffersByConversion, setTopOffersByConversion] = useState([]);
  const [topOffersByViews, setTopOffersByViews] = useState([]);
  const [segmentPerformance, setSegmentPerformance] = useState([]);
  const [interactionsTrend, setInteractionsTrend] = useState([]);
  const [segmentDistribution, setSegmentDistribution] = useState([]);
  const [customerStats, setCustomerStats] = useState(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82ca9d'];

  const offerTypeLabels = {
    discount: 'Скидка',
    bonus: 'Бонус',
    retention: 'Удержание',
    upgrade: 'Повышение',
    recommendation: 'Рекомендация'
  };

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        dashboard,
        offerTypes,
        topConversion,
        topViews,
        segments,
        trend,
        distribution,
        customers
      ] = await Promise.all([
        getDashboardStats(),
        getOfferTypeReport(dateRange.startDate, dateRange.endDate),
        getTopOffersByConversion(10, dateRange.startDate, dateRange.endDate),
        getTopOffersByViews(10, dateRange.startDate, dateRange.endDate),
        getSegmentPerformanceReport(dateRange.startDate, dateRange.endDate),
        getInteractionsTrendReport(dateRange.startDate, dateRange.endDate, 'day'),
        getCustomerSegmentDistribution(),
        getCustomerStatsReport()
      ]);

      setDashboardStats(dashboard.data);
      setOfferTypeStats(offerTypes.data);
      setTopOffersByConversion(topConversion.data);
      setTopOffersByViews(topViews.data);
      setSegmentPerformance(segments.data);
      setInteractionsTrend(trend.data);
      setSegmentDistribution(distribution.data);
      setCustomerStats(customers.data);
    } catch (err) {
      console.error('Error loading reports:', err);
      setError('Ошибка загрузки отчетов');
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyFilter = () => {
    loadReports();
  };

  const handleExportPdf = async () => {
    try {
      setExporting(true);
      await exportToPdf(dateRange.startDate, dateRange.endDate);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Ошибка экспорта в PDF');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return <div className="reports-page"><div className="loading">Загрузка отчетов...</div></div>;
  }

  if (error) {
    return <div className="reports-page"><div className="error-message">{error}</div></div>;
  }

  return (
    <div className="reports-page">
      <div className="page-header">
        <div>
          <h1>Аналитика и отчеты</h1>
          <p className="page-description">Комплексный анализ эффективности NBA-системы</p>
        </div>
        <button
          className="btn btn-export"
          onClick={handleExportPdf}
          disabled={exporting || loading}
        >
          {exporting ? 'Экспорт...' : 'Экспорт в PDF'}
        </button>
      </div>

      {/* Фильтр по датам */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Начальная дата:</label>
          <input
            type="date"
            name="startDate"
            value={dateRange.startDate}
            onChange={handleDateRangeChange}
          />
        </div>
        <div className="filter-group">
          <label>Конечная дата:</label>
          <input
            type="date"
            name="endDate"
            value={dateRange.endDate}
            onChange={handleDateRangeChange}
          />
        </div>
        <button className="btn btn-primary" onClick={applyFilter}>
          Применить
        </button>
      </div>

      {/* Общая статистика */}
      {dashboardStats && (
        <div className="stats-overview">
          <h2>Общая статистика</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{dashboardStats.offers?.total_offers || 0}</div>
              <div className="stat-label">Всего офферов</div>
              <div className="stat-detail">
                Активных: {dashboardStats.offers?.active_offers || 0}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboardStats.segments?.total_segments || 0}</div>
              <div className="stat-label">Всего сегментов</div>
              <div className="stat-detail">
                Активных: {dashboardStats.segments?.active_segments || 0}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboardStats.customers?.total_customers || 0}</div>
              <div className="stat-label">Клиентов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboardStats.interactions?.total_views || 0}</div>
              <div className="stat-label">Показов офферов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{dashboardStats.interactions?.total_accepts || 0}</div>
              <div className="stat-label">Принятых офферов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {dashboardStats.interactions?.conversion_rate || 0}%
              </div>
              <div className="stat-label">Конверсия</div>
            </div>
          </div>
        </div>
      )}

      {/* Статистика по клиентам */}
      {customerStats && (
        <div className="report-section">
          <h2>Статистика по клиентам</h2>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{customerStats.total_customers || 0}</div>
              <div className="stat-label">Всего клиентов</div>
            </div>
            <div className="stat-card">
              <div className="stat-value churn-low">{customerStats.low_churn || 0}</div>
              <div className="stat-label">Низкий риск оттока</div>
            </div>
            <div className="stat-card">
              <div className="stat-value churn-medium">{customerStats.medium_churn || 0}</div>
              <div className="stat-label">Средний риск оттока</div>
            </div>
            <div className="stat-card">
              <div className="stat-value churn-high">{customerStats.high_churn || 0}</div>
              <div className="stat-label">Высокий риск оттока</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">${customerStats.avg_arpu || 0}</div>
              <div className="stat-label">Средний ARPU</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{customerStats.avg_tenure || 0}</div>
              <div className="stat-label">Средняя длительность (мес)</div>
            </div>
          </div>
        </div>
      )}

      {/* График типов офферов */}
      {offerTypeStats && offerTypeStats.length > 0 && (
        <div className="report-section">
          <h2>Эффективность по типам офферов</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={offerTypeStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="offer_type" tickFormatter={(value) => offerTypeLabels[value] || value} />
              <YAxis />
              <Tooltip labelFormatter={(value) => offerTypeLabels[value] || value} />
              <Legend />
              <Bar dataKey="total_views" fill="#8884d8" name="Просмотры" />
              <Bar dataKey="total_accepts" fill="#82ca9d" name="Принятия" />
              <Bar dataKey="conversion_rate" fill="#ffc658" name="Конверсия %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Топ офферов по конверсии */}
      {topOffersByConversion && topOffersByConversion.length > 0 && (
        <div className="report-section">
          <h2>Топ-10 офферов по конверсии</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topOffersByConversion} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="title" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="conversion_rate" fill="#82ca9d" name="Конверсия %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Топ офферов по просмотрам */}
      {topOffersByViews && topOffersByViews.length > 0 && (
        <div className="report-section">
          <h2>Топ-10 офферов по просмотрам</h2>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topOffersByViews} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="title" type="category" width={150} />
              <Tooltip />
              <Legend />
              <Bar dataKey="views" fill="#8884d8" name="Просмотры" />
              <Bar dataKey="accepts" fill="#82ca9d" name="Принятия" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Тренд взаимодействий */}
      {interactionsTrend && interactionsTrend.length > 0 && (
        <div className="report-section">
          <h2>Динамика взаимодействий</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={interactionsTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="period"
                tickFormatter={(value) => formatDate(value)}
              />
              <YAxis />
              <Tooltip labelFormatter={(value) => formatDate(value)} />
              <Legend />
              <Line type="monotone" dataKey="views" stroke="#8884d8" name="Просмотры" />
              <Line type="monotone" dataKey="accepts" stroke="#82ca9d" name="Принятия" />
              <Line type="monotone" dataKey="conversion_rate" stroke="#ffc658" name="Конверсия %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Распределение клиентов по сегментам */}
      {segmentDistribution && segmentDistribution.length > 0 && (
        <div className="report-section">
          <h2>Распределение клиентов по сегментам</h2>
          <div className="chart-row">
            <div className="chart-container">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={segmentDistribution}
                    dataKey="customer_count"
                    nameKey="segment_name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label
                  >
                    {segmentDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Сегмент</th>
                    <th>Клиентов</th>
                    <th>Ср. ARPU</th>
                    <th>Ср. Churn</th>
                  </tr>
                </thead>
                <tbody>
                  {segmentDistribution.map((segment, index) => (
                    <tr key={index}>
                      <td>{segment.segment_name}</td>
                      <td>{segment.customer_count}</td>
                      <td>${segment.avg_arpu}</td>
                      <td>{segment.avg_churn_score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Производительность сегментов */}
      {segmentPerformance && segmentPerformance.length > 0 && (
        <div className="report-section">
          <h2>Эффективность сегментов</h2>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Сегмент</th>
                  <th>Клиентов</th>
                  <th>Офферов</th>
                  <th>Просмотров</th>
                  <th>Принятий</th>
                  <th>Конверсия</th>
                  <th>Ср. ARPU</th>
                  <th>Ср. Churn</th>
                </tr>
              </thead>
              <tbody>
                {segmentPerformance.map((segment) => (
                  <tr key={segment.id}>
                    <td>
                      {segment.name}
                      {!segment.is_active && <span className="badge inactive">Неактивен</span>}
                    </td>
                    <td>{segment.customer_count}</td>
                    <td>{segment.offer_count}</td>
                    <td>{segment.total_views || 0}</td>
                    <td>{segment.total_accepts || 0}</td>
                    <td>{segment.conversion_rate || 0}%</td>
                    <td>${segment.avg_arpu || 0}</td>
                    <td>{segment.avg_churn_score || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
