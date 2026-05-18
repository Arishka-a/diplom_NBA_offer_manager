import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Offers from './pages/Offers';
import Segments from './pages/Segments';
import Customers from './pages/CustomersFixed';
import Rules from './pages/Rules';
import Logs from './pages/Logs';
import Import from './pages/Import';
import Export from './pages/Export';
import Users from './pages/Users';
import NBARecommendations from './pages/NBARecommendations';
import Reports from './pages/Reports';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Protected routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/offers"
            element={
              <PrivateRoute>
                <Layout>
                  <Offers />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/segments"
            element={
              <PrivateRoute>
                <Layout>
                  <Segments />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <PrivateRoute>
                <Layout>
                  <Customers />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/nba"
            element={
              <PrivateRoute>
                <Layout>
                  <NBARecommendations />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/rules"
            element={
              <PrivateRoute>
                <Layout>
                  <Rules />
                </Layout>
              </PrivateRoute>
            }
          />
          {/* Редирект со старого маршрута статистики на страницу правил */}
          <Route path="/rules-statistics" element={<Navigate to="/rules" replace />} />
          <Route
            path="/logs"
            element={
              <PrivateRoute>
                <Layout>
                  <Logs />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/import"
            element={
              <PrivateRoute>
                <Layout>
                  <Import />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/export"
            element={
              <PrivateRoute>
                <Layout>
                  <Export />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <PrivateRoute>
                <Layout>
                  <Reports />
                </Layout>
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute requiredRole="Administrator">
                <Layout>
                  <Users />
                </Layout>
              </PrivateRoute>
            }
          />

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
