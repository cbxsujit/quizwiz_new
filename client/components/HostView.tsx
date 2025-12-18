
import React, { useEffect, useState, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { generateGameId, getYoutubeId } from '../utils';
import { Player, PeerMessage, HostGameState, Quiz, BadgeType, RoundStats, PowerUpType, Question } from '../types';
import { Copy, Wifi, Loader2, Play, ArrowRight, CheckCircle2, Users, Link as LinkIcon, Trophy, Clock, X, Volume2, VolumeX, Check, Medal, Music, Zap, TrendingUp, Award, Flame, Star } from 'lucide-react';
import { saveGameResultToSheet } from '../services/sheetService';
import { audio } from '../services/audioService';

interface HostViewProps {
  onBack: () => void;
  quiz: Quiz;
}

const THEME_MAP: Record<string, { bg: string, border: string, text: string }> = {
    indigo: { bg: 'bg-indigo-100 dark:bg-indigo-500/20', border: 'border-indigo-500', text: 'text-indigo-600 dark:text-indigo-300' },
    red: { bg: 'bg-red-100 dark:bg-red-500/20', border: 'border-red-500', text: 'text-red-600 dark:text-red-300' },
    orange: { bg: 'bg-orange-100 dark:bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-600 dark:text-orange-300' },
    green: { bg: 'bg-emerald-100 dark:bg-emerald-500/20', border: 'border-emerald-500', text: 'text-emerald-600 dark:text-emerald-300' },
    teal: { bg: 'bg-teal-100 dark:bg-teal-500/20', border: 'border-teal-500', text: 'text-teal-600 dark:text-teal-300' },
    blue: { bg: 'bg-blue-100 dark:bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-300' },
    purple: { bg: 'bg-purple-100 dark:bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-300' },
    pink: { bg: 'bg-pink-100 dark:bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-600 dark:text-pink-300' },
};

const HostView: React.FC<HostViewProps> = ({ onBack, quiz }) => {
  const [gameId, setGameId] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  const [isPeerReady, setIsPeerReady] = useState(false);
  const [gameState, setGameState] = useState<HostGameState>('LOBBY');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [playerVotes, setPlayerVotes] = useState<Record<string, { answer: string | number, timestamp: number }>>({});
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<Map<string, DataConnection>>(new Map());
  const timerRef = useRef<number | null>(null);
  const QUESTIONS = quiz.questions;

  useEffect(() => {
    audio.startMusic();
    const newGameId = generateGameId();
    setGameId(newGameId);
    const peer = new Peer(`QWIZ-${newGameId}`, {
        debug: 1,
        config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] }
    });
    peerRef.current = peer;
    peer.on('open', () => setIsPeerReady(true));
    peer.on('connection', (conn) => {
        connectionsRef.current.set(conn.peer, conn);
        conn.on('data', (data: any) => {
            const msg = data as PeerMessage;
            if (msg.type === 'JOIN') {
                setPlayers(prev => [...prev, { id: conn.peer, name: msg.name, avatar: msg.avatar, theme: msg.theme, joinedAt: Date.now(), score: 0, streak: 0, coins: 200 }]);
                audio.playJoin();
            } else if (msg.type === 'VOTE') {
                setPlayerVotes(prev => ({ ...prev, [conn.peer]: { answer: msg.answer, timestamp: Date.now() } }));
                audio.playJoin();
            }
        });
    });
    return () => { peer.destroy(); audio.stopMusic(); };
  }, []);

  const getJoinUrl = () => {
    try {
      const url = new URL(window.location.href);
      url.search = ''; 
      url.searchParams.set('join', gameId);
      return url.toString();
    } catch (e) {
      return `${window.location.protocol}//${window.location.host}${window.location.pathname}?join=${gameId}`;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    audio.playJoin();
  };

  const startGame = () => {
    setGameState('PLAYING');
    broadcastQuestion(0);
  };

  const broadcastQuestion = (index: number) => {
    const q = QUESTIONS[index];
    const now = Date.now();
    setTimeLeft(q.timeLimit || 20);
    setQuestionStartTime(now);
    setCurrentQuestionIndex(index);
    setPlayerVotes({});
    connectionsRef.current.forEach(c => c.send({ 
        type: 'GAME_START', 
        question: q, 
        currentQuestion: index + 1, 
        totalQuestions: QUESTIONS.length, 
        startTime: now 
    }));
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
            if (prev <= 1) { revealAnswer(); return 0; }
            return prev - 1;
        });
    }, 1000);
  };

  const revealAnswer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameState('REVEAL');
    const q = QUESTIONS[currentQuestionIndex];
    let fastestTime = Infinity;
    let fastestPlayerId: string | null = null;
    
    Object.entries(playerVotes).forEach(([pid, vote]) => {
        let isCorrect = false;
        if (q.type === 'MC' || q.type === 'TRUE_FALSE') isCorrect = vote.answer === q.correctOptionId;
        else if (q.type === 'OPEN_ENDED') isCorrect = String(vote.answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
        else if (q.type === 'SLIDER') isCorrect = Math.abs(Number(vote.answer) - (q.correctValue || 0)) < 1;

        if (isCorrect && vote.timestamp < fastestTime) {
            fastestTime = vote.timestamp;
            fastestPlayerId = pid;
        }
    });

    const updatedPlayers = players.map(p => {
        const vote = playerVotes[p.id];
        let earnedPoints = 0;
        let isCorrect = false;

        if (vote) {
            if (q.type === 'MC' || q.type === 'TRUE_FALSE') isCorrect = vote.answer === q.correctOptionId;
            else if (q.type === 'OPEN_ENDED') isCorrect = String(vote.answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
            else if (q.type === 'SLIDER') {
                const range = (q.max || 100) - (q.min || 0);
                const diff = Math.abs(Number(vote.answer) - (q.correctValue || 0));
                const accuracy = Math.max(0, 1 - (diff / range));
                earnedPoints = Math.round(accuracy * 1000);
                if (accuracy > 0.95) isCorrect = true;
            }

            if (isCorrect && q.type !== 'SLIDER') {
                const limit = (q.timeLimit || 20) * 1000;
                const elapsed = vote.timestamp - questionStartTime;
                const speedBonus = Math.max(0, 500 * (1 - (elapsed / limit)));
                earnedPoints = Math.round(500 + speedBonus);
            }
        }

        const newStreak = isCorrect ? p.streak + 1 : 0;
        const streakBonus = Math.min(newStreak, 5) * 100;
        const totalEarned = isCorrect ? earnedPoints + streakBonus : 0;

        return { ...p, score: p.score + totalEarned, streak: newStreak, coins: p.coins + (isCorrect ? 50 : 10) };
    });

    setPlayers(updatedPlayers);

    updatedPlayers.forEach(p => {
        const conn = connectionsRef.current.get(p.id);
        const badges: BadgeType[] = [];
        if (p.id === fastestPlayerId) badges.push('SPEED_DEMON');
        if (p.streak >= 3) badges.push('ON_FIRE');

        if (conn) conn.send({ 
            type: 'RESULT', 
            score: p.score, 
            correctOptionId: q.correctOptionId,
            correctText: q.type === 'OPEN_ENDED' ? q.correctAnswer || '' : q.options?.find(o => o.id === q.correctOptionId)?.text || String(q.correctValue || ''),
            correctValue: q.correctValue,
            coins: p.coins, 
            streak: p.streak, 
            coinsEarned: isCorrectCheck(p.id, q) ? 50 : 10,
            badges: badges,
            rank: [...updatedPlayers].sort((a, b) => b.score - a.score).findIndex(item => item.id === p.id) + 1,
            roundStats: { totalPlayers: players.length, correctCount: 0, voteDistribution: {} } 
        });
    });
    audio.playCorrect();
  };

  const isCorrectCheck = (pid: string, q: Question) => {
    const vote = playerVotes[pid];
    if (!vote) return false;
    if (q.type === 'MC' || q.type === 'TRUE_FALSE') return vote.answer === q.correctOptionId;
    if (q.type === 'OPEN_ENDED') return String(vote.answer).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
    if (q.type === 'SLIDER') return Math.abs(Number(vote.answer) - (q.correctValue || 0)) < 1;
    return false;
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < QUESTIONS.length - 1) {
        setGameState('PLAYING');
        broadcastQuestion(currentQuestionIndex + 1);
    } else {
        setGameState('GAME_OVER');
        const sorted = [...players].sort((a, b) => b.score - a.score);
        sorted.forEach((p, i) => connectionsRef.current.get(p.id)?.send({ type: 'GAME_OVER', rank: i + 1, score: p.score }));
    }
  };

  if (gameState === 'LOBBY') {
    const joinUrl = getJoinUrl();
    const qrUrl = isPeerReady ? `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(joinUrl)}` : '';
    
    return (
      <div className="min-h-screen p-8 flex flex-col items-center bg-indigo-50 dark:bg-slate-900 transition-colors">
        <div className="w-full flex justify-between mb-8">
            <button onClick={onBack} className="text-slate-500 hover:text-red-500 transition-colors">&larr; Quit Lobby</button>
            <div className="flex items-center gap-2">
                <Wifi className={`w-5 h-5 ${isPeerReady ? 'text-green-500' : 'text-yellow-500 animate-pulse'}`} />
                <span className="font-bold text-xs uppercase tracking-widest">{isPeerReady ? 'Server Online' : 'Connecting...'}</span>
            </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 w-full max-w-5xl mb-12">
            <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl animate-pop border border-slate-100">
                {isPeerReady ? (
                    <img src={qrUrl} alt="Join QR" className="w-64 h-64 md:w-80 md:h-80 mix-blend-multiply" />
                ) : (
                    <div className="w-64 h-64 md:w-80 md:h-80 flex items-center justify-center"><Loader2 className="w-12 h-12 animate-spin text-indigo-500" /></div>
                )}
            </div>

            <div className="flex flex-col gap-6 text-center md:text-left">
                <div className="space-y-1">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">Game Code</p>
                    <div onClick={() => copyToClipboard(gameId)} className="cursor-pointer group bg-white dark:bg-slate-800 p-6 rounded-3xl shadow-xl border-2 border-transparent hover:border-indigo-500 transition-all">
                        <h2 className="text-7xl font-mono font-black tracking-widest text-slate-900 dark:text-white group-hover:scale-105 transition-transform">{gameId}</h2>
                        <div className="flex items-center justify-center gap-2 text-indigo-500 text-xs font-bold mt-2 opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-3 h-3" /> Tap to copy code</div>
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em]">Join Link</p>
                    <div onClick={() => copyToClipboard(joinUrl)} className="cursor-pointer group flex items-center gap-3 bg-white/50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-white transition-colors">
                        <LinkIcon className="w-4 h-4 text-indigo-500" />
                        <code className="text-xs text-slate-500 truncate max-w-[200px]">{joinUrl}</code>
                    </div>
                </div>
            </div>
        </div>

        <div className="w-full max-w-5xl mb-32">
            <div className="flex items-center gap-3 mb-6">
                <Users className="w-6 h-6 text-indigo-500" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">Players <span className="text-slate-400 ml-1">({players.length})</span></h2>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                {players.map(p => {
                    const theme = THEME_MAP[p.theme || 'indigo'];
                    return (
                        <div key={p.id} className={`p-4 rounded-2xl animate-pop ${theme.bg} border ${theme.border} text-center flex flex-col items-center gap-1 shadow-sm`}>
                            <div className="text-4xl">{p.avatar}</div>
                            <div className={`font-bold text-sm truncate w-full ${theme.text}`}>{p.name}</div>
                        </div>
                    );
                })}
                {players.length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                        Waiting for challengers to join...
                    </div>
                )}
            </div>
        </div>

        <div className="fixed bottom-8 w-full max-w-md px-6">
            <button 
                onClick={startGame} 
                disabled={players.length === 0} 
                className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-[2rem] text-xl shadow-2xl shadow-indigo-500/40 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
                <Play className="w-6 h-6 fill-current" /> START GAME
            </button>
        </div>
      </div>
    );
  }

  if (gameState === 'GAME_OVER') {
    const top3 = [...players].sort((a, b) => b.score - a.score).slice(0, 3);
    return (
      <div className="min-h-screen flex flex-col items-center pt-12 px-6 bg-indigo-50 dark:bg-slate-900 overflow-hidden">
        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500 mb-12 animate-pop">Final Results</h1>
        <div className="flex items-end justify-center w-full max-w-5xl gap-4 md:gap-8 h-[450px]">
            {top3[1] && (
                <div className="flex flex-col items-center flex-1 max-w-[200px] animate-[slideUp_0.8s_ease-out_0.2s_forwards] opacity-0 translate-y-20">
                    <div className="text-center mb-4">
                        <div className="text-5xl mb-2">{top3[1].avatar}</div>
                        <div className="font-bold text-lg truncate w-full dark:text-white">{top3[1].name}</div>
                        <div className="text-slate-500 font-mono font-bold">{top3[1].score} pts</div>
                    </div>
                    <div className="w-full h-40 bg-gradient-to-t from-slate-300 to-slate-400 rounded-t-2xl flex items-center justify-center border-t-4 border-slate-200 shadow-xl relative overflow-hidden">
                        <span className="text-7xl font-black text-white/20 select-none">2</span>
                    </div>
                </div>
            )}
            {top3[0] && (
                <div className="flex flex-col items-center flex-1 max-w-[250px] z-10 animate-[slideUp_0.8s_ease-out_forwards] translate-y-20">
                    <div className="text-center mb-6 relative">
                        <Trophy className="w-12 h-12 text-yellow-400 absolute -top-12 left-1/2 -translate-x-1/2 animate-bounce" />
                        <div className="text-7xl mb-2">{top3[0].avatar}</div>
                        <div className="font-black text-2xl truncate w-full dark:text-white">{top3[0].name}</div>
                        <div className="text-yellow-600 font-black text-xl">{top3[0].score} pts</div>
                    </div>
                    <div className="w-full h-64 bg-gradient-to-t from-yellow-400 to-yellow-500 rounded-t-3xl flex items-center justify-center border-t-4 border-yellow-200 shadow-[0_0_50px_rgba(250,204,21,0.3)] relative overflow-hidden">
                        <span className="text-9xl font-black text-white/20 select-none">1</span>
                    </div>
                </div>
            )}
            {top3[2] && (
                <div className="flex flex-col items-center flex-1 max-w-[200px] animate-[slideUp_0.8s_ease-out_0.4s_forwards] opacity-0 translate-y-20">
                    <div className="text-center mb-4">
                        <div className="text-5xl mb-2">{top3[2].avatar}</div>
                        <div className="font-bold text-lg truncate w-full dark:text-white">{top3[2].name}</div>
                        <div className="text-slate-500 font-mono font-bold">{top3[2].score} pts</div>
                    </div>
                    <div className="w-full h-32 bg-gradient-to-t from-amber-600 to-amber-700 rounded-t-2xl flex items-center justify-center border-t-4 border-amber-500 shadow-xl relative overflow-hidden">
                        <span className="text-6xl font-black text-white/20 select-none">3</span>
                    </div>
                </div>
            )}
        </div>
        <button onClick={onBack} className="mt-16 px-10 py-4 bg-white dark:bg-slate-800 text-indigo-600 dark:text-white rounded-2xl font-black shadow-lg hover:scale-105 transition-transform">Back to Dashboard</button>
        <style>{`@keyframes slideUp { to { transform: translateY(0); opacity: 1; } }`}</style>
      </div>
    );
  }

  const q = QUESTIONS[currentQuestionIndex];
  return (
    <div className="min-h-screen p-8 bg-indigo-50 dark:bg-slate-900 flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-12">
            <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-xl font-bold dark:text-white">Q{currentQuestionIndex + 1}/{QUESTIONS.length}</div>
            <div className={`text-4xl font-black dark:text-white ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : ''}`}>{timeLeft}s</div>
            <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold">{Object.keys(playerVotes).length} Answers</div>
        </div>
        <h1 className="text-5xl font-black text-center mb-12 dark:text-white">{q.text}</h1>
        {gameState === 'REVEAL' ? (
            <div className="w-full max-w-2xl bg-green-500 p-8 rounded-3xl text-center shadow-2xl animate-pop">
                <p className="text-white/60 text-sm font-bold uppercase tracking-widest mb-2">The Correct Answer is</p>
                <h2 className="text-4xl font-black text-white">
                  {q.type === 'MC' || q.type === 'TRUE_FALSE' ? q.options?.find(o => o.id === q.correctOptionId)?.text : q.type === 'SLIDER' ? q.correctValue : q.correctAnswer}
                </h2>
                <button onClick={nextQuestion} className="mt-8 px-10 py-3 bg-white text-green-600 font-black rounded-xl hover:scale-105 transition-transform">CONTINUE</button>
            </div>
        ) : (
            <div className="flex flex-wrap justify-center gap-4 max-w-4xl">
                {players.map(p => <div key={p.id} className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl transition-all duration-500 ${playerVotes[p.id] ? 'bg-emerald-500 scale-110 shadow-lg' : 'bg-slate-300 opacity-30'}`}>{playerVotes[p.id] ? <Check className="text-white" /> : p.avatar}</div>)}
            </div>
        )}
    </div>
  );
};

export default HostView;
