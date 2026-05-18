import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const offerTypeLabels = {
    discount: 'Скидка',
    bonus: 'Бонус',
    retention: 'Удержание',
    upgrade: 'Повышение',
    recommendation: 'Рекомендация'
  };

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/dashboard/stats');
      if (response.data.success) {
        setStats(response.data.data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
      setError('Не удалось загрузить статистику');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="dashboard"><div className="loading">Загрузка...</div></div>;
  }

  if (error || !stats) {
    return <div className="dashboard"><div className="error">{error || 'Ошибка загрузки'}</div></div>;
  }

  // Prepare activity chart data
  const activityData = stats.activityByDay.map(day => ({
    date: new Date(day.date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }),
    'Показано': parseInt(day.total_shown),
    'Принято': parseInt(day.accepted),
    'Кликнуто': parseInt(day.clicked)
  }));

  // Prepare offers by type data
  const offerTypeData = stats.offersByType.map(item => ({
    name: offerTypeLabels[item.offer_type] || item.offer_type,
    value: parseInt(item.count)
  }));

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Панель управления NBA-OfferManager</h1>
        <p>Добро пожаловать, {user?.username}!</p>
      </div>

      {/* Main Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-content">
            <div className="metric-value">{stats.offers.total}</div>
            <div className="metric-label">Всего офферов</div>
            <div className="metric-detail">{stats.offers.active} активных</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <div className="metric-value">{stats.customers.total}</div>
            <div className="metric-label">Клиентов</div>
            <div className="metric-detail">{stats.customers.active} активных</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <div className="metric-value">{stats.segments.total}</div>
            <div className="metric-label">Сегментов</div>
            <div className="metric-detail">{stats.segments.active} активных</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <div className="metric-value">{stats.rules.total}</div>
            <div className="metric-label">NBA Правил</div>
            <div className="metric-detail">{stats.rules.active} активных</div>
          </div>
        </div>

        <div className="metric-card metric-highlight">
          <div className="metric-content">
            <div className="metric-value">{stats.customers.avg_arpu}₽</div>
            <div className="metric-label">Средний ARPU</div>
            <div className="metric-detail">за месяц</div>
          </div>
        </div>

        <div className="metric-card metric-highlight">
          <div className="metric-content">
            <div className="metric-value">{stats.offerHistory.conversion_rate}%</div>
            <div className="metric-label">Конверсия</div>
            <div className="metric-detail">за 30 дней</div>
          </div>
        </div>

        <div className="metric-card metric-warning">
          <div className="metric-content">
            <div className="metric-value">{stats.customers.high_risk}</div>
            <div className="metric-label">Риск оттока</div>
            <div className="metric-detail">клиентов</div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-content">
            <div className="metric-value">{stats.customers.avg_tenure}</div>
            <div className="metric-label">Средний стаж</div>
            <div className="metric-detail">месяцев</div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="charts-row">
        {/* Activity Chart */}
        {activityData.length > 0 && (
          <div className="chart-card">
            <h3>Активность за 7 дней</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Показано" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="Принято" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Offers by Type */}
        {offerTypeData.length > 0 && (
          <div className="chart-card">
            <h3>Офферы по типам</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={offerTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {offerTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Charts Row 2 */}
      <div className="charts-row">
        {/* Customer Value Distribution */}
        {stats.customerValueDistribution.length > 0 && (
          <div className="chart-card">
            <h3>Распределение клиентов по ценности</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.customerValueDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="value_category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Churn Risk Distribution */}
        {stats.churnRiskDistribution.length > 0 && (
          <div className="chart-card">
            <h3>Распределение по риску оттока</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats.churnRiskDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="risk_category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#ff8042" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top Offers Table */}
      {stats.topOffers.length > 0 && (
        <div className="top-offers-section">
          <h3>Топ офферов за 30 дней</h3>
          <table className="top-offers-table">
            <thead>
              <tr>
                <th>Название</th>
                <th>Тип</th>
                <th>Показано</th>
                <th>Принято</th>
                <th>Конверсия</th>
              </tr>
            </thead>
            <tbody>
              {stats.topOffers.map((offer) => (
                <tr key={offer.id}>
                  <td className="offer-title">{offer.title}</td>
                  <td><span className={`badge badge-${offer.offer_type}`}>{offerTypeLabels[offer.offer_type] || offer.offer_type}</span></td>
                  <td className="text-center">{offer.shown_count}</td>
                  <td className="text-center">{offer.accepted_count}</td>
                  <td className="text-center">
                    <span className="conversion-rate">{offer.conversion_rate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3>Быстрые действия</h3>
        <div className="actions-grid">
          <Link to="/offers" className="action-card">
            <div className="action-title">Офферы</div>
          </Link>
          <Link to="/segments" className="action-card">
            <div className="action-title">Сегменты</div>
          </Link>
          <Link to="/customers" className="action-card">
            <div className="action-title">Клиенты</div>
          </Link>
          <Link to="/rules" className="action-card">
            <div className="action-title">Правила NBA</div>
          </Link>
          <Link to="/rules-statistics" className="action-card">
            <div className="action-title">Статистика</div>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
