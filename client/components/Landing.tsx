import React from 'react';
import { Play, Users, Sparkles, Zap, Trophy } from 'lucide-react';

interface LandingProps {
  onHost: () => void;
  onJoin: () => void;
}

const Landing: React.FC<LandingProps> = ({ onHost, onJoin }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-16 relative overflow-hidden bg-indigo-50 dark:bg-slate-900 transition-colors duration-500">
      
      {/* Background Blobs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-200/50 dark:bg-indigo-600/20 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-200/50 dark:bg-purple-600/20 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 animate-pulse [animation-delay:1s]"></div>

      <div className="space-y-6 z-10 animate-pop">
        <div className="inline-flex items-center justify-center p-5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl mb-4 shadow-lg shadow-indigo-500/20 rotate-3">
          <Sparkles className="w-12 h-12 text-white" />
        </div>
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-slate-900 dark:text-white drop-shadow-sm">
          Quiz<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-cyan-400">Wiz</span>
        </h1>
        <p className="text-slate-600 dark:text-indigo-200 text-xl font-medium max-w-lg mx-auto leading-relaxed">
          The ultimate real-time multiplayer quiz showdown. 
          <br/>Compete, conquer, and claim the crown!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-3xl z-10">
        <button
          onClick={onHost}
          className="group relative flex flex-col items-center p-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/50 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-3xl transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-2 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
          <div className="p-5 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl mb-6 group-hover:bg-indigo-500 group-hover:text-white text-indigo-500 dark:text-indigo-400 transition-colors duration-300">
            <Trophy className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-3">Host a Game</h2>
          <p className="text-slate-500 dark:text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-200 transition-colors">Launch a lobby & challenge friends</p>
        </button>

        <button
          onClick={onJoin}
          className="group relative flex flex-col items-center p-10 bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/50 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl transition-all duration-300 hover:shadow-xl hover:shadow-emerald-500/10 hover:-translate-y-2 overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-600"></div>
          <div className="p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl mb-6 group-hover:bg-emerald-500 group-hover:text-white text-emerald-500 dark:text-emerald-400 transition-colors duration-300">
            <Zap className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-3">Join a Game</h2>
          <p className="text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 dark:group-hover:text-emerald-200 transition-colors">Enter a code & jump into action</p>
        </button>
      </div>
      
      <div className="z-10 text-slate-400 dark:text-slate-600 text-sm font-bold tracking-widest uppercase">
        Ready • Set • Quiz
      </div>
    </div>
  );
};

export default Landing;