import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, setAuthToken } from '../lib/api';
import { saveSession } from '../lib/auth';

const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'de', label: 'Deutsch' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
];

function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('fr');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'signup') {
        await authApi.post('/auth/signup', {
          email,
          password,
          preferred_language: preferredLanguage,
        });
      }

      const { data } = await authApi.post('/auth/login', { email, password });

      setAuthToken(data.accessToken);
      saveSession({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
      });

      navigate('/chat');
    } catch (err) {
      const message = err.response?.data?.error || 'Une erreur est survenue';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-text mb-1">
          Kafka Translate Chat
        </h1>
        <p className="text-text-muted mb-6">
          {mode === 'login' ? 'Connecte-toi pour continuer.' : 'Crée ton compte.'}
        </p>

        <div className="flex border border-border rounded-md mb-6 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'login' ? 'bg-sky-strong text-white' : 'bg-surface text-text-muted'
            }`}
          >
            Se connecter
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            className={`flex-1 py-2 text-sm font-medium ${
              mode === 'signup' ? 'bg-sky-strong text-white' : 'bg-surface text-text-muted'
            }`}
          >
            Créer un compte
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-muted mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-border rounded-md px-3 py-2 bg-surface text-text focus:outline-none focus:border-sky-strong"
            />
          </div>

          <div>
            <label className="block text-sm text-text-muted mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full border border-border rounded-md px-3 py-2 bg-surface text-text focus:outline-none focus:border-sky-strong"
            />
          </div>

          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-text-muted mb-1">Langue préférée</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full border border-border rounded-md px-3 py-2 bg-surface text-text focus:outline-none focus:border-sky-strong"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sky-strong text-white py-2 rounded-md font-medium disabled:opacity-50"
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;