import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
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
import './RulesStatistics.css';

const RulesStatistics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [statistics, setStatistics] = useState({
    rules: [],
    typeStatistics: [],
    activityByDate: []
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/rules/statistics/all');

      if (response.data.success) {
        setStatistics(response.data.data);
      } else {
        setError('Не удалось загрузить статистику');
      }
    } catch (err) {
      console.error('Ошибка загрузки статистики:', err);
      setError(err.response?.data?.message || 'Ошибка загрузки статистики');
    } finally {
      setLoading(false);
    }
  };

  // Цвета для графиков
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF6B9D'];

  // Подсчет общей статистики
  const totalExecutions = statistics.rules.reduce((sum, rule) => sum + parseInt(rule.total_executions || 0), 0);
  const totalApplied = statistics.rules.reduce((sum, rule) => sum + parseInt(rule.applied_count || 0), 0);
  const avgSuccessRate = statistics.rules.length > 0
    ? (statistics.rules.reduce((sum, rule) => sum + parseFloat(rule.success_rate || 0), 0) / statistics.rules.length).toFixed(2)
    : 0;

  // Подготовка данных для графика активности по времени
  const activityData = statistics.activityByDate.map(item => ({
    date: new Date(item.date).toLocaleDateString('ru-RU', { month: 'short', day: 'numeric' }),
    'Всего выполнений': parseInt(item.executions),
    'Применено': parseInt(item.applied),
    'Средний impact': parseFloat(item.avg_impact || 0).toFixed(2)
  })).reverse();

  // Подготовка данных для pie chart типов правил
  const typeData = statistics.typeStatistics.map(item => ({
    name: item.rule_type,
    value: parseInt(item.total_executions || 0)
  }));

  if (loading) {
    return (
      <div className="rules-statistics">
        <div className="loading">Загрузка статистики...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rules-statistics">
        <div className="error-message">{error}</div>
        <button onClick={loadStatistics} className="btn btn-primary">
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="rules-statistics">
      <div className="statistics-header">
        <h1>Статистика NBA-правил</h1>
        <button onClick={loadStatistics} className="btn btn-secondary">
          Обновить
        </button>
      </div>

      {/* Сводные метрики */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{statistics.rules.length}</div>
          <div className="metric-label">Всего правил</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{statistics.rules.filter(r => r.is_active).length}</div>
          <div className="metric-label">Активных правил</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{totalExecutions.toLocaleString()}</div>
          <div className="metric-label">Всего выполнений</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{totalApplied.toLocaleString()}</div>
          <div className="metric-label">Применено</div>
        </div>
        <div className="metric-card">
          <div className="metric-value">{avgSuccessRate}%</div>
          <div className="metric-label">Средний Success Rate</div>
        </div>
      </div>

      {/* График активности по времени */}
      {activityData.length > 0 && (
        <div className="chart-container">
          <h2>Активность правил за последние 30 дней</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="Всего выполнений" stroke="#8884d8" strokeWidth={2} />
              <Line type="monotone" dataKey="Применено" stroke="#82ca9d" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* График по типам правил */}
      <div className="charts-row">
        {typeData.length > 0 && (
          <div className="chart-container half-width">
            <h2>Выполнения по типам правил</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={typeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {typeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Статистика по типам правил (таблица) */}
        {statistics.typeStatistics.length > 0 && (
          <div className="chart-container half-width">
            <h2>Статистика по типам</h2>
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Тип правила</th>
                  <th>Кол-во правил</th>
                  <th>Выполнений</th>
                  <th>Применено</th>
                  <th>Avg Impact</th>
                </tr>
              </thead>
              <tbody>
                {statistics.typeStatistics.map((type, index) => (
                  <tr key={index}>
                    <td>{type.rule_type}</td>
                    <td>{type.rules_count}</td>
                    <td>{parseInt(type.total_executions || 0).toLocaleString()}</td>
                    <td>{parseInt(type.applied_count || 0).toLocaleString()}</td>
                    <td>{parseFloat(type.avg_score_impact || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Детальная таблица по каждому правилу */}
      <div className="rules-detail-section">
        <h2>Детальная статистика правил</h2>

        <div className="table-responsive">
          <table className="rules-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Название</th>
                <th>Тип</th>
                <th>Статус</th>
                <th>Приоритет</th>
                <th>Выполнений</th>
                <th>Применено</th>
                <th>Пропущено</th>
                <th>Success Rate</th>
                <th>Avg Impact</th>
                <th>Последнее выполнение</th>
              </tr>
            </thead>
            <tbody>
              {statistics.rules.map((rule) => (
                <tr key={rule.id}>
                  <td>{rule.id}</td>
                  <td className="rule-name">{rule.name}</td>
                  <td>
                    <span className={`badge badge-${rule.rule_type}`}>
                      {rule.rule_type}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${rule.is_active ? 'active' : 'inactive'}`}>
                      {rule.is_active ? 'Активно' : 'Неактивно'}
                    </span>
                  </td>
                  <td>{rule.priority}</td>
                  <td>{parseInt(rule.total_executions || 0).toLocaleString()}</td>
                  <td className="text-success">{parseInt(rule.applied_count || 0).toLocaleString()}</td>
                  <td className="text-muted">{parseInt(rule.skipped_count || 0).toLocaleString()}</td>
                  <td>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${rule.success_rate || 0}%` }}
                      ></div>
                      <span className="progress-text">{parseFloat(rule.success_rate || 0).toFixed(1)}%</span>
                    </div>
                  </td>
                  <td>{parseFloat(rule.avg_score_impact || 0).toFixed(2)}</td>
                  <td>
                    {rule.last_execution
                      ? new Date(rule.last_execution).toLocaleString('ru-RU')
                      : 'Нет данных'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RulesStatistics;
