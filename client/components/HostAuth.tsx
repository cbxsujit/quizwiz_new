import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldAlert } from 'lucide-react';

interface HostAuthProps {
  onSuccess: () => void;
  onBack: () => void;
}

const HostAuth: React.FC<HostAuthProps> = ({ onSuccess, onBack }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234') {
      onSuccess();
    } else {
      setError(true);
      setPin('');
      setTimeout(() => setError(false), 500);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-indigo-50 dark:bg-slate-900 transition-colors">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white mb-8 transition-colors">
          &larr; Back
        </button>

        <div className="bg-white dark:bg-slate-800/80 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/50 dark:border-slate-700">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-500/20 mb-4 text-indigo-600 dark:text-indigo-400">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Quiz Studio</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Enter PIN to access admin dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN"
                maxLength={4}
                className={`w-full px-4 py-4 bg-slate-50 dark:bg-slate-900/50 border rounded-xl focus:ring-2 focus:outline-none text-slate-900 dark:text-white text-center font-mono text-3xl tracking-[0.5em] transition-all
                  ${error 
                    ? 'border-red-500 ring-red-500/50 animate-[shake_0.5s_ease-in-out]' 
                    : 'border-slate-200 dark:border-slate-600 focus:ring-indigo-500 focus:border-transparent'
                  }
                `}
                autoFocus
              />
              {error && (
                <div className="absolute -bottom-6 left-0 w-full flex justify-center items-center gap-1 text-red-500 dark:text-red-400 text-xs mt-2 animate-bounce">
                  <ShieldAlert className="w-3 h-3" /> Access Denied
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4"
            >
              Unlock <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
};

export default HostAuth;