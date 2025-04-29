import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ProjectProvider } from './contexts/ProjectContext';
import TokenEntry from './pages/Login';
import Dashboard from './pages/Dashboard';
import Pages from './pages/Pages';
import Collections from './pages/Collections';
import Assets from './pages/Assets';
import ActivityLogs from './pages/ActivityLogs';
import CMSEditor from './pages/CMSEditor';
import Layout from './components/Layout';
import PrivateRoute from './components/PrivateRoute';
import Register from './pages/Register';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <ProjectProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<TokenEntry />} />
              
              <Route
                path="/"
                element={
                  <PrivateRoute>
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </PrivateRoute>
                }
              />
              
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
                path="/pages"
                element={
                  <PrivateRoute>
                    <Layout>
                      <Pages />
                    </Layout>
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/collections"
                element={
                  <PrivateRoute>
                    <Layout>
                      <Collections />
                    </Layout>
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/cms-editor"
                element={
                  <PrivateRoute>
                    <Layout>
                      <CMSEditor />
                    </Layout>
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/assets"
                element={
                  <PrivateRoute>
                    <Layout>
                      <Assets />
                    </Layout>
                  </PrivateRoute>
                }
              />
              
              <Route
                path="/activity"
                element={
                  <PrivateRoute>
                    <Layout>
                      <ActivityLogs />
                    </Layout>
                  </PrivateRoute>
                }
              />
              
              <Route path="/register" element={<Register />} />
              
              {/* Redirect to dashboard for any unknown routes */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Router>
        </ProjectProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App; 