import React, { useState, useEffect } from 'react';
import Landing from './components/Landing';
import HostView from './components/HostView';
import PlayerView from './components/PlayerView';
import HostAuth from './components/HostAuth';
import QuizDashboard from './components/QuizDashboard';
import QuizCreator from './components/QuizCreator';
import { AppState, Quiz } from './types';
import { Sun, Moon } from 'lucide-react';

const App: React.FC = () => {
  // Check for join code in URL to bypass landing
  const [appState, setAppState] = useState<AppState>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('join') ? 'PLAYER_JOIN' : 'LANDING';
  });
  
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [quizToEdit, setQuizToEdit] = useState<Quiz | null>(null);

  // Theme State
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const renderContent = () => {
    switch (appState) {
      case 'PLAYER_JOIN':
        return <PlayerView onBack={() => {
           const url = new URL(window.location.href);
           url.searchParams.delete('join');
           window.history.replaceState({}, '', url);
           setAppState('LANDING');
        }} />;
      
      case 'HOST_AUTH':
        return <HostAuth onSuccess={() => setAppState('HOST_DASHBOARD')} onBack={() => setAppState('LANDING')} />;

      case 'HOST_DASHBOARD':
        return (
          <QuizDashboard 
            onPlay={(quiz) => {
              setSelectedQuiz(quiz);
              setAppState('HOST_LOBBY');
            }}
            onCreate={() => {
              setQuizToEdit(null);
              setAppState('HOST_CREATE');
            }}
            onEdit={(quiz) => {
              setQuizToEdit(quiz);
              setAppState('HOST_CREATE');
            }}
            onBack={() => setAppState('LANDING')}
          />
        );

      case 'HOST_CREATE':
        return (
          <QuizCreator 
            initialQuiz={quizToEdit}
            onSave={() => {
               setQuizToEdit(null);
               setAppState('HOST_DASHBOARD');
            }}
            onCancel={() => {
               setQuizToEdit(null);
               setAppState('HOST_DASHBOARD');
            }}
          />
        );

      case 'HOST_LOBBY':
        if (!selectedQuiz) return <div>Error: No quiz selected</div>;
        return <HostView quiz={selectedQuiz} onBack={() => setAppState('HOST_DASHBOARD')} />;

      case 'LANDING':
      default:
        return <Landing onHost={() => setAppState('HOST_AUTH')} onJoin={() => setAppState('PLAYER_JOIN')} />;
    }
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-white selection:bg-indigo-500 selection:text-white transition-colors duration-300">
      {/* Global Theme Toggle */}
      <button 
        onClick={toggleTheme}
        className="fixed top-4 right-4 z-50 p-3 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur shadow-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all active:scale-95"
        title="Toggle Theme"
      >
        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {renderContent()}
    </div>
  );
};

export default App;