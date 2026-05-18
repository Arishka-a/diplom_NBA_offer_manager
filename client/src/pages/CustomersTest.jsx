import { useState, useEffect } from 'react';
import api from '../services/api';

const CustomersTest = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('Загрузка клиентов...');
        const response = await api.get('/customers', { params: { limit: 10 } });
        console.log('Ответ API:', response.data);
        setData(response.data);
      } catch (err) {
        console.error('Ошибка:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div style={{color: 'red'}}>Ошибка: {error}</div>;

  return (
    <div style={{padding: '20px'}}>
      <h1>Тест API клиентов</h1>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
};

export default CustomersTest;
