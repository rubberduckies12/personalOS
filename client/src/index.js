import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import Register from './auth/register';
import Login from './auth/login';
import Dashboard from './home/dashboard';
import Finances from './finance/finances';
import Goals from './goals/goals.jsx';
import Projects from './projects/projects';

// Enhanced Protected Route Component
const ProtectedRoute = ({ children }) => {
  console.log('🔐 === PROTECTED ROUTE CHECK ===');
  console.log('🔐 Current URL:', window.location.href);
  console.log('🔐 Current pathname:', window.location.pathname);
  
  const userData = localStorage.getItem('user');
  console.log('🔐 Raw userData from localStorage:', userData);
  
  if (userData) {
    try {
      const parsedUser = JSON.parse(userData);
      console.log('🔐 Parsed user data:', parsedUser);
      console.log('✅ User authenticated, allowing access');
      return children;
    } catch (parseError) {
      console.error('🚨 Error parsing user data:', parseError);
      console.log('❌ Invalid user data, redirecting to login');
      localStorage.removeItem('user');
      return <Navigate to="/auth/login" replace />;
    }
  }
  
  console.log('❌ No user data found, redirecting to login');
  return <Navigate to="/auth/login" replace />;
};

// Placeholder components for other routes
const Terms = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-12">
    <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
      <div className="prose max-w-none">
        <p className="text-gray-600 mb-4">
          Welcome to PersonalOS. By using our service, you agree to these terms...
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">1. Acceptance of Terms</h2>
        <p className="text-gray-600 mb-4">
          By accessing and using PersonalOS, you accept and agree to be bound by the terms and provision of this agreement.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2. Use License</h2>
        <p className="text-gray-600 mb-4">
          Permission is granted to temporarily use PersonalOS for personal, non-commercial transitory viewing only.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3. Privacy</h2>
        <p className="text-gray-600 mb-4">
          Your privacy is important to us. Please review our Privacy Policy, which also governs your use of the service.
        </p>
      </div>
    </div>
  </div>
);

const Privacy = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center px-4 py-12">
    <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
      <div className="prose max-w-none">
        <p className="text-gray-600 mb-4">
          Your privacy is important to us. This policy explains how we collect, use, and protect your data.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Information We Collect</h2>
        <p className="text-gray-600 mb-4">
          We collect information you provide directly to us, such as when you create an account, update your profile, or contact us.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">How We Use Your Information</h2>
        <p className="text-gray-600 mb-4">
          We use the information we collect to provide, maintain, and improve our services.
        </p>
        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Data Security</h2>
        <p className="text-gray-600 mb-4">
          We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
        </p>
      </div>
    </div>
  </div>
);

// Placeholder components for module routes that will be built later
const TasksPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Tasks Module</h2>
      <p className="text-gray-600">Tasks management coming soon...</p>
    </div>
  </div>
);

const ReadingPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Reading Module</h2>
      <p className="text-gray-600">Reading list management coming soon...</p>
    </div>
  </div>
);

const SkillsPage = () => (
  <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
    <div className="bg-white rounded-2xl shadow-xl p-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Skills Module</h2>
      <p className="text-gray-600">Skill tracking coming soon...</p>
    </div>
  </div>
);

// Main App Component
const App = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/auth/register" element={<Register />} />
        <Route path="/auth/login" element={<Login />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        
        {/* Protected Routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        
        {/* Other Module Routes */}
        <Route path="/tasks" element={
          <ProtectedRoute>
            <TasksPage />
          </ProtectedRoute>
        } />
        <Route path="/tasks/new" element={
          <ProtectedRoute>
            <TasksPage />
          </ProtectedRoute>
        } />
        <Route path="/projects" element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        } />
        <Route path="/projects/new" element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        } />
        <Route path="/goals" element={
          <ProtectedRoute>
            <Goals />
          </ProtectedRoute>
        } />
        <Route path="/goals/new" element={
          <ProtectedRoute>
            <Goals />
          </ProtectedRoute>
        } />
        <Route path="/reading" element={
          <ProtectedRoute>
            <ReadingPage />
          </ProtectedRoute>
        } />
        <Route path="/reading/new" element={
          <ProtectedRoute>
            <ReadingPage />
          </ProtectedRoute>
        } />
        <Route path="/skills" element={
          <ProtectedRoute>
            <SkillsPage />
          </ProtectedRoute>
        } />
        <Route path="/skills/new" element={
          <ProtectedRoute>
            <SkillsPage />
          </ProtectedRoute>
        } />
        <Route path="/finances" element={
          <ProtectedRoute>
            <Finances />
          </ProtectedRoute>
        } />
        <Route path="/finances/new" element={
          <ProtectedRoute>
            <Finances />
          </ProtectedRoute>
        } />
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/auth/login" replace />} />
        
        {/* Catch all - redirect to login */}
        <Route path="*" element={<Navigate to="/auth/login" replace />} />
      </Routes>
    </Router>
  );
};

// Render the app
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);