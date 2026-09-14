import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './pages/AuthPage';
import ChatPage from './pages/ChatPage';
import { loadSession } from './lib/auth';

function ProtectedRoute({ children }) {
  const session = loadSession();
  if (!session) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:contactId"
        element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;