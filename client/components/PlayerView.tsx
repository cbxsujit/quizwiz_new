
import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { ArrowRight, Loader2, CheckCircle2, XCircle, Trophy, Ban, Dices, Coins, WifiOff, Send } from 'lucide-react';
import { PeerMessage, PlayerGameState, Question, PowerUpType } from '../types';
import { audio } from '../services/audioService';
import { generateRandomName } from '../utils';

interface PlayerViewProps {
  onBack: () => void;
}

const AVATARS = ['😎', '👻', '👽', '🤖', '🦊', '🐼', '🐯', '🦁', '🦄', '🐲', '🌵', '🍕', '🚀', '⭐', '🔥', '💎'];
const THEMES = [
  { id: 'indigo', color: 'bg-indigo-500' },
  { id: 'red', color: 'bg-red-500' },
  { id: 'orange', color: 'bg-orange-500' },
  { id: 'green', color: 'bg-emerald-500' },
  { id: 'blue', color: 'bg-blue-500' },
  { id: 'purple', color: 'bg-purple-500' },
];

const PlayerView: React.FC<PlayerViewProps> = ({ onBack }) => {
  const [playerState, setPlayerState] = useState<PlayerGameState>('LOBBY');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [theme, setTheme] = useState(THEMES[0].id);
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | number | null>(null);
  const [textInput, setTextInput] = useState('');
  const [sliderValue, setSliderValue] = useState(0);
  const [coins, setCoins] = useState(200);
  const [resultData, setResultData] = useState<any | null>(null);
  const [finalRank, setFinalRank] = useState<{rank: number, score: number} | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  
  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) {
      setJoinCode(code.toUpperCase().trim());
      setIsLocked(true);
    }
    setName(generateRandomName());
    return () => { 
        peerRef.current?.destroy(); 
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = joinCode.trim().toUpperCase();
    if (!name.trim() || cleanCode.length !== 4) return setError("Enter name and code.");
    
    if (peerRef.current) peerRef.current.destroy();
    setIsConnecting(true);
    setError(null);

    const playerPeerId = `QWIZ-PLY-${Math.random().toString(36).substr(2, 9)}`;
    const peer = new Peer(playerPeerId, { debug: 1, config: { 'iceServers': [{ urls: 'stun:stun.l.google.com:19302' }] } });
    peerRef.current = peer;

    peer.on('open', () => {
        const hostId = `QWIZ-${cleanCode}`;
        const conn = peer.connect(hostId, { reliable: true });
        connRef.current = conn;

        const timeout = setTimeout(() => { if (!conn.open) handleJoin(e); }, 6000);

        conn.on('open', () => {
          clearTimeout(timeout);
          conn.send({ type: 'JOIN', name: name.trim(), avatar, theme });
          setPlayerState('LOBBY');
          setIsConnecting(false);
        });

        conn.on('data', (data: any) => {
          const msg = data as PeerMessage;
          switch (msg.type) {
            case 'GAME_START':
              setCurrentQuestion(msg.question);
              setPlayerState('ANSWERING');
              setSelectedOption(null);
              setTextInput('');
              setSliderValue(msg.question.min || 0);
              setResultData(null);
              setTimeLeft(msg.question.timeLimit || 20);
              if (timerRef.current) clearInterval(timerRef.current);
              timerRef.current = window.setInterval(() => { setTimeLeft(prev => prev > 0 ? prev - 1 : 0); }, 1000);
              break;
            case 'RESULT':
              if (timerRef.current) clearInterval(timerRef.current);
              setCoins(msg.coins);
              setResultData(msg);
              setPlayerState('RESULT');
              break;
            case 'GAME_OVER':
              setFinalRank({ rank: msg.rank, score: msg.score });
              setPlayerState('GAME_OVER');
              break;
            case 'KICK':
              setPlayerState('KICKED');
              break;
          }
        });

        conn.on('close', () => { if (playerState !== 'GAME_OVER') { setError("Dropped. Re-Join."); setIsConnecting(false); } });
    });
    peer.on('error', () => { setIsConnecting(false); setError("Error. Try again."); });
  };

  const handleVote = (answer: string | number) => {
    if (connRef.current?.open) {
      connRef.current.send({ type: 'VOTE', answer });
      setSelectedOption(answer);
      setPlayerState('SUBMITTED');
    }
  };

  const handleSpinName = () => {
      if (isSpinning) return;
      setIsSpinning(true);
      let count = 0;
      const interval = setInterval(() => { setName(generateRandomName()); count++; if (count > 8) { clearInterval(interval); setIsSpinning(false); } }, 50);
  };

  const checkIsCorrect = () => {
    if (!resultData || !currentQuestion) return false;
    const ans = selectedOption;
    if (currentQuestion.type === 'MC' || currentQuestion.type === 'TRUE_FALSE') return ans === resultData.correctOptionId;
    if (currentQuestion.type === 'OPEN_ENDED') return String(ans).trim().toLowerCase() === String(resultData.correctText).trim().toLowerCase();
    if (currentQuestion.type === 'SLIDER') return Math.abs(Number(ans) - (resultData.correctValue || 0)) < 1;
    return false;
  };

  if (playerState === 'ANSWERING' && currentQuestion) {
    return (
      <div className="h-screen w-full flex flex-col p-4 bg-indigo-50 dark:bg-slate-900">
        <div className="flex justify-between items-center mb-4">
            <div className="bg-yellow-400/20 text-yellow-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                <Coins className="w-4 h-4" /> {coins}
            </div>
            <div className="text-indigo-600 dark:text-indigo-400 font-black text-xl">{timeLeft}s</div>
        </div>
        <div className="mb-6 flex-1 flex items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-xl">
           <p className="text-slate-900 dark:text-white text-center font-bold text-2xl leading-tight">{currentQuestion.text}</p>
        </div>
        
        <div className="space-y-4 pb-8">
            {currentQuestion.type === 'MC' && (
                <div className="grid grid-cols-1 gap-3">
                    {currentQuestion.options?.map((opt) => (
                        <button key={opt.id} onClick={() => handleVote(opt.id)} className={`py-5 rounded-xl text-white font-bold text-xl shadow-lg active:scale-95 transition-all ${opt.color === 'red' ? 'bg-red-500' : opt.color === 'blue' ? 'bg-blue-500' : opt.color === 'green' ? 'bg-emerald-500' : 'bg-yellow-500'}`}>
                            {opt.text}
                        </button>
                    ))}
                </div>
            )}
            {currentQuestion.type === 'TRUE_FALSE' && (
                <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => handleVote('true')} className="bg-blue-600 py-10 rounded-2xl text-2xl font-black text-white active:scale-95">TRUE</button>
                    <button onClick={() => handleVote('false')} className="bg-red-600 py-10 rounded-2xl text-2xl font-black text-white active:scale-95">FALSE</button>
                </div>
            )}
            {currentQuestion.type === 'OPEN_ENDED' && (
                <div className="flex gap-2">
                    <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)} placeholder="Type your answer..." className="flex-1 px-4 py-4 rounded-xl border-2 border-indigo-200 outline-none focus:border-indigo-500 text-lg" autoFocus />
                    <button onClick={() => handleVote(textInput)} className="p-4 bg-indigo-600 text-white rounded-xl"><Send /></button>
                </div>
            )}
            {currentQuestion.type === 'SLIDER' && (
                <div className="space-y-6 px-4">
                    <div className="text-center text-4xl font-black text-indigo-600">{sliderValue}</div>
                    <input type="range" min={currentQuestion.min} max={currentQuestion.max} step={currentQuestion.step || 1} value={sliderValue} onChange={(e) => setSliderValue(Number(e.target.value))} className="w-full h-4 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    <button onClick={() => handleVote(sliderValue)} className="w-full py-4 bg-indigo-600 text-white font-bold rounded-xl shadow-lg">Submit Guess</button>
                </div>
            )}
        </div>
      </div>
    );
  }

  if (playerState === 'RESULT' && resultData) {
      const isCorrect = checkIsCorrect();
      if (isCorrect) audio.playCorrect(); else audio.playWrong();
      return (
          <div className={`min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-500 ${isCorrect ? 'bg-green-600' : 'bg-red-600'}`}>
              <div className="bg-white/20 p-8 rounded-full mb-6 backdrop-blur-md animate-pop">
                  {isCorrect ? <CheckCircle2 className="w-20 h-20 text-white" /> : <XCircle className="w-20 h-20 text-white" />}
              </div>
              <h1 className="text-5xl font-black text-white mb-2">{isCorrect ? 'YES!' : 'NO!'}</h1>
              <p className="text-white/80 text-xl mb-4">Score: {resultData.score}</p>
              <div className="bg-black/20 p-6 rounded-2xl w-full max-w-sm backdrop-blur-lg">
                  <p className="text-white/60 text-xs uppercase font-black mb-1">Correct Answer</p>
                  <p className="text-white text-2xl font-bold">{resultData.correctText || '???'}</p>
              </div>
          </div>
      );
  }

  if (playerState === 'GAME_OVER' && finalRank) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-indigo-50 dark:bg-slate-900">
             <Trophy className={`w-24 h-24 mb-6 ${finalRank.rank === 1 ? 'text-yellow-500 animate-bounce' : 'text-slate-400'}`} />
             <h1 className="text-4xl font-bold mb-2 dark:text-white">Game Over!</h1>
             <div className="text-9xl font-black text-indigo-600 mb-8">#{finalRank.rank}</div>
             <button onClick={() => window.location.reload()} className="px-8 py-3 bg-slate-800 text-white rounded-xl font-bold">New Game</button>
        </div>
      );
  }

  if (playerState === 'LOBBY' && !isConnecting && connRef.current?.open) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-indigo-50 dark:bg-slate-900">
         <div className={`mb-8 p-10 rounded-[3rem] shadow-2xl ${THEMES.find(t => t.id === theme)?.color || 'bg-indigo-500'} text-white animate-pop`}>
             <div className="text-9xl mb-4">{avatar}</div>
             <div className="font-bold text-3xl">{name}</div>
         </div>
         <h2 className="text-3xl font-black mb-2 dark:text-white">You're In!</h2>
         <p className="text-slate-500 text-lg">Watch the Host screen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-indigo-50 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="text-slate-500 mb-8">&larr; Back</button>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl">
          <form onSubmit={handleJoin} className="space-y-6">
            <div className="text-center">
                <h1 className="text-3xl font-black mb-2 dark:text-white">Join Quiz</h1>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-2xl">
                {AVATARS.slice(0, 12).map(a => (
                    <button key={a} type="button" onClick={() => setAvatar(a)} className={`aspect-square flex items-center justify-center text-2xl rounded-xl transition-all ${avatar === a ? 'bg-white dark:bg-slate-700 shadow-md ring-2 ring-indigo-500' : 'opacity-40'}`}>
                        {a}
                    </button>
                ))}
            </div>
            <div className="space-y-4">
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Display Name" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none text-slate-900 dark:text-white" maxLength={12} />
                <input type="text" value={joinCode} onChange={(e) => !isLocked && setJoinCode(e.target.value.toUpperCase())} placeholder="4-Letter Code" maxLength={4} readOnly={isLocked} className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-mono text-3xl tracking-widest text-slate-900 dark:text-white" />
            </div>
            {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2"><WifiOff className="w-4 h-4" /> {error}</div>}
            <button type="submit" disabled={isConnecting} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-black rounded-2xl shadow-xl transition-all active:scale-95">
              {isConnecting ? <Loader2 className="animate-spin mx-auto" /> : "ENTER LOBBY"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PlayerView;
