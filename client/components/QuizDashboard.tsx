import React, { useEffect, useState } from 'react';
import { Quiz } from '../types';
import { Plus, Play, Trash2, LayoutGrid, Trophy, Pencil, Cloud, Link, RefreshCw, UploadCloud, Check, HelpCircle, X, Copy } from 'lucide-react';
import { getQuizzesFromSheet, getSheetUrl, setSheetUrl, clearSheetUrl, saveQuizToSheet } from '../services/sheetService';

interface QuizDashboardProps {
  onPlay: (quiz: Quiz) => void;
  onCreate: () => void;
  onEdit: (quiz: Quiz) => void;
  onBack: () => void;
}

const DEFAULT_QUIZ: Quiz = {
  id: 'demo-mixed-1',
  title: 'Diverse Question Types Demo',
  description: 'A showcase of all the different question types available in QuizWiz.',
  createdAt: Date.now(),
  questions: [
    {
      id: 1,
      type: 'MC',
      text: "Which planet is known as the Red Planet?",
      timeLimit: 20,
      options: [
        { id: 'opt1', color: 'red', text: 'Mars' },
        { id: 'opt2', color: 'blue', text: 'Venus' },
        { id: 'opt3', color: 'green', text: 'Jupiter' },
        { id: 'opt4', color: 'yellow', text: 'Saturn' }
      ],
      correctOptionId: 'opt1'
    },
    {
      id: 2,
      type: 'TRUE_FALSE',
      text: "Is the Earth flat?",
      timeLimit: 15,
      options: [
          { id: 'true', color: 'blue', text: 'True' },
          { id: 'false', color: 'red', text: 'False' },
      ],
      correctOptionId: 'false'
    },
    {
      id: 3,
      type: 'SLIDER',
      text: "How many days are in a leap year?",
      timeLimit: 20,
      min: 300,
      max: 400,
      correctValue: 366,
      step: 1
    },
    {
      id: 4,
      type: 'OPEN_ENDED',
      text: "What is the capital of France?",
      timeLimit: 30,
      correctAnswer: "Paris"
    },
    {
        id: 5,
        type: 'POLL',
        text: "What is your favorite season?",
        timeLimit: 20,
        options: [
            { id: 'opt1', color: 'red', text: 'Summer' },
            { id: 'opt2', color: 'blue', text: 'Winter' },
            { id: 'opt3', color: 'green', text: 'Spring' },
            { id: 'opt4', color: 'yellow', text: 'Autumn' }
        ]
    },
    {
        id: 6,
        type: 'WORD_CLOUD',
        text: "Describe this app in one word",
        timeLimit: 30
    }
  ]
};

const GAS_CODE = `function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = doc.getSheetByName('Quizzes') || doc.insertSheet('Quizzes');
    const resultsSheet = doc.getSheetByName('Results') || doc.insertSheet('Results');

    // Ensure Headers exist for readability
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['ID', 'Title', 'Description', 'JSON_Data', 'Last_Updated']);
      sheet.setFrozenRows(1);
    }
    if (resultsSheet.getLastRow() === 0) {
      resultsSheet.appendRow(['Game_ID', 'Quiz_Title', 'Winner', 'Score', 'Full_Rankings', 'Date_Played']);
      resultsSheet.setFrozenRows(1);
    }

    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    
    let result = { status: 'success' };

    if (action === 'SAVE_QUIZ') {
      const quiz = data.quiz;
      const lastRow = sheet.getLastRow();
      let rowIndex = -1;
      
      // Check if ID exists in Column A (Index 0)
      if (lastRow > 1) {
         const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
         const foundIdx = ids.indexOf(quiz.id);
         if (foundIdx !== -1) rowIndex = foundIdx + 2; // +2 because of header and 0-based index
      }

      // Structure: ID | Title | Description | JSON | Date
      const rowData = [
        quiz.id,
        quiz.title,
        quiz.description || '',
        JSON.stringify(quiz),
        new Date().toISOString()
      ];

      if (rowIndex !== -1) {
        // Update existing row (1 row, 5 columns)
        sheet.getRange(rowIndex, 1, 1, 5).setValues([rowData]);
      } else {
        sheet.appendRow(rowData);
      }
    } else if (action === 'GET_QUIZZES') {
      const rows = sheet.getDataRange().getValues();
      const quizzes = [];
      // Row 1 is header, start from 2 (index 1)
      for (let i = 1; i < rows.length; i++) {
        // The JSON data is now in Column D (Index 3)
        // We fallback to Index 1 (Col B) to support older sheet versions if needed, 
        // but prefer the new structure.
        let jsonStr = rows[i][3]; 
        
        // Fallback for old structure where JSON was in Col B
        if (!jsonStr || !jsonStr.startsWith('{')) {
             if (rows[i][1] && rows[i][1].startsWith('{')) {
                 jsonStr = rows[i][1];
             }
        }

        if (jsonStr) {
           try {
             quizzes.push(JSON.parse(jsonStr));
           } catch (e) {}
        }
      }
      result.quizzes = quizzes;
      result.result = 'success';
    } else if (action === 'SAVE_RESULT') {
       resultsSheet.appendRow([
         data.gameId, 
         data.quizTitle, 
         data.winnerName, 
         data.winnerScore, 
         JSON.stringify(data.fullRankings), 
         new Date().toISOString()
       ]);
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (e) {
    return ContentService
      .createTextOutput(JSON.stringify({ 'result': 'error', 'error': e.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}`;

const QuizDashboard: React.FC<QuizDashboardProps> = ({ onPlay, onCreate, onEdit, onBack }) => {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    loadQuizzes();
    const existingUrl = getSheetUrl();
    if (existingUrl) {
      setSheetUrlInput(existingUrl);
      setIsConnected(true);
    }
  }, []);

  const loadQuizzes = async () => {
    setIsLoading(true);
    const sheetUrl = getSheetUrl();
    
    // 1. Load Local
    const localSaved = localStorage.getItem('quizwiz_quizzes');
    let localQuizzes: Quiz[] = [];

    if (localSaved) {
        try {
            localQuizzes = JSON.parse(localSaved);
        } catch (e) {
            console.error("Error parsing local quizzes", e);
            localQuizzes = [DEFAULT_QUIZ];
            localStorage.setItem('quizwiz_quizzes', JSON.stringify(localQuizzes));
        }
    } else {
        localQuizzes = [DEFAULT_QUIZ];
        localStorage.setItem('quizwiz_quizzes', JSON.stringify(localQuizzes));
    }
    
    // 2. If connected, try to fetch cloud
    if (sheetUrl) {
      try {
        const cloudQuizzes = await getQuizzesFromSheet();
        if (cloudQuizzes) {
          const cloudIds = new Set(cloudQuizzes.map(q => q.id));
          const uniqueLocal = localQuizzes.filter((q: Quiz) => !cloudIds.has(q.id));
          setQuizzes([...cloudQuizzes, ...uniqueLocal]);
          setIsConnected(true);
        } else {
           setQuizzes(localQuizzes);
        }
      } catch (e) {
        console.error(e);
        setQuizzes(localQuizzes);
      }
    } else {
      setQuizzes(localQuizzes);
    }
    setIsLoading(false);
  };

  const handleConnect = () => {
    if (sheetUrlInput.trim()) {
      setSheetUrl(sheetUrlInput);
      setIsConnected(true);
      loadQuizzes();
    }
  };

  const handleDisconnect = () => {
    clearSheetUrl();
    setSheetUrlInput('');
    setIsConnected(false);
    loadQuizzes();
  };

  const handleSyncLocalToCloud = async () => {
    if (!isConnected && sheetUrlInput.trim()) {
        setSheetUrl(sheetUrlInput);
        setIsConnected(true);
    }
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      const localSaved = localStorage.getItem('quizwiz_quizzes');
      if (localSaved) {
        const localQuizzes: Quiz[] = JSON.parse(localSaved);
        for (const quiz of localQuizzes) {
            await saveQuizToSheet(quiz);
        }
        await loadQuizzes();
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    } catch (e) {
      console.error("Sync failed", e);
      alert("Sync failed. Check console or verify your Script URL.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this quiz?')) {
      const updated = quizzes.filter(q => q.id !== id);
      setQuizzes(updated);
      localStorage.setItem('quizwiz_quizzes', JSON.stringify(updated));
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(GAS_CODE);
    alert("Code copied to clipboard!");
  };

  return (
    <div className="min-h-screen p-6 md:p-12 max-w-7xl mx-auto bg-indigo-50 dark:bg-slate-900 transition-colors">
      
      {/* Instructions Modal */}
      {showInstructions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-pop">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                  <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Google Sheets Integration Setup</h2>
                      <button onClick={() => setShowInstructions(false)} className="text-slate-500 hover:text-red-500 transition-colors"><X className="w-6 h-6" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4 text-slate-600 dark:text-slate-300">
                      <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-500/30">
                        <p className="font-bold text-indigo-700 dark:text-indigo-300">Update Available!</p>
                        <p className="text-sm">The script has been updated to make the Google Sheet more readable. Please re-copy the code below and update your script in Apps Script.</p>
                      </div>
                      <p>To enable cloud saving and multiplayer results tracking, follow these steps:</p>
                      <ol className="list-decimal pl-5 space-y-2">
                          <li>Create a new <strong>Google Sheet</strong>.</li>
                          <li>Go to <strong>Extensions &gt; Apps Script</strong>.</li>
                          <li>Delete any code in <code>Code.gs</code> and paste the script below.</li>
                          <li>Click <strong>Deploy &gt; New Deployment</strong>.</li>
                          <li>Select type: <strong>Web app</strong>.</li>
                          <li>Set <strong>Who has access</strong> to <strong>"Anyone"</strong> (Important!).</li>
                          <li>Click <strong>Deploy</strong>, copy the <strong>Web App URL</strong>, and paste it in the Dashboard.</li>
                      </ol>
                      <div className="relative mt-4">
                          <button onClick={copyCode} className="absolute top-2 right-2 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded-md text-sm font-bold flex items-center gap-2"><Copy className="w-4 h-4" /> Copy</button>
                          <pre className="bg-slate-900 text-slate-300 p-4 rounded-xl text-xs overflow-x-auto font-mono border border-slate-700">
                              {GAS_CODE}
                          </pre>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
        <div>
           <button onClick={onBack} className="text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white mb-2 transition-colors">
            &larr; Back to Landing
          </button>
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LayoutGrid className="text-indigo-600 dark:text-indigo-500 w-10 h-10" /> Quiz Studio
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your quiz library</p>
        </div>
        
        <div className="flex gap-3">
            <button 
                onClick={() => setShowUrlInput(!showUrlInput)}
                className={`flex items-center gap-2 px-4 py-3 border rounded-xl font-bold transition-all ${isConnected ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'border-slate-300 dark:border-slate-600 hover:border-indigo-500 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
            >
                <Cloud className="w-5 h-5" /> {isConnected ? 'Synced' : 'Connect Cloud'}
            </button>

            <button 
                onClick={onCreate}
                className="group flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
            >
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Create New
            </button>
        </div>
      </div>

      {showUrlInput && (
          <div className="mb-8 p-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl animate-pop shadow-md">
              <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-slate-900 dark:text-white font-bold mb-2 flex items-center gap-2">
                        <Link className="w-4 h-4 text-indigo-500" /> Connect Google Sheet
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Paste your Google Apps Script Web App URL here to save quizzes and results to a spreadsheet.
                    </p>
                  </div>
                  <button onClick={() => setShowInstructions(true)} className="flex items-center gap-2 text-indigo-500 text-sm font-bold hover:underline"><HelpCircle className="w-4 h-4" /> Setup Guide</button>
              </div>
              
              <div className="flex flex-col gap-4">
                <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={sheetUrlInput}
                      onChange={(e) => setSheetUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/..."
                      className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button 
                      onClick={handleConnect}
                      className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors"
                    >
                      Connect
                    </button>
                    {isConnected && (
                      <button 
                          onClick={handleDisconnect}
                          className="px-4 py-2 bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400 border border-red-200 dark:border-red-500/30 font-bold rounded-lg transition-colors"
                      >
                          Disconnect
                      </button>
                    )}
                </div>

                {(isConnected || sheetUrlInput.trim().length > 0) && (
                  <div className="flex items-center gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                     <button
                        onClick={handleSyncLocalToCloud}
                        disabled={isSyncing}
                        className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                     >
                        {isSyncing ? (
                           <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : syncStatus === 'success' ? (
                           <Check className="w-4 h-4 text-green-500" />
                        ) : (
                           <UploadCloud className="w-4 h-4" />
                        )}
                        {isSyncing ? 'Uploading...' : syncStatus === 'success' ? 'Synced!' : 'Sync Local Library to Cloud'}
                     </button>
                     <span className="text-xs text-slate-400 italic">Click sync to ensure your local quizzes are available on other devices.</span>
                  </div>
                )}
              </div>
          </div>
      )}

      {isLoading ? (
          <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
            <div 
                key={quiz.id}
                className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col"
            >
                {/* Cover Image */}
                <div className="h-40 w-full bg-slate-100 dark:bg-slate-700 relative overflow-hidden">
                    {quiz.coverImageUrl ? (
                        <img 
                            src={quiz.coverImageUrl} 
                            alt={quiz.title} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                            <Trophy className="w-12 h-12 text-indigo-500/30" />
                        </div>
                    )}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button 
                            onClick={(e) => { e.stopPropagation(); onEdit(quiz); }}
                            className="p-2 bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg shadow-sm backdrop-blur"
                            title="Edit"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={(e) => handleDelete(quiz.id, e)}
                            className="p-2 bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 hover:text-red-500 rounded-lg shadow-sm backdrop-blur"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 line-clamp-1" title={quiz.title}>
                        {quiz.title}
                    </h3>
                    
                    {quiz.description && (
                        <p className="text-slate-500 dark:text-slate-400 text-sm mb-4 line-clamp-2 flex-1">
                            {quiz.description}
                        </p>
                    )}
                    
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mt-auto mb-4 pt-4 border-t border-slate-100 dark:border-slate-700/50">
                        <span>{quiz.questions.length} Questions</span>
                        <span>{new Date(quiz.createdAt).toLocaleDateString()}</span>
                    </div>

                    <button 
                        onClick={() => onPlay(quiz)}
                        className="w-full py-3 bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-600 text-slate-700 dark:text-white group-hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Play className="w-4 h-4 fill-current" /> Play Now
                    </button>
                </div>
            </div>
            ))}

            {quizzes.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-500 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
                <p>No quizzes found. Create one to get started!</p>
            </div>
            )}
        </div>
      )}
    </div>
  );
};

export default QuizDashboard;