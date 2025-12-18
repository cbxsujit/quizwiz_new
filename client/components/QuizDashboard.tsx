import React, { useEffect, useState } from 'react';
import { Quiz } from '../types';
import { Plus, Play, Trash2, LayoutGrid, Trophy, Pencil, Cloud, Link, RefreshCw, UploadCloud, Check, HelpCircle, X, Copy } from 'lucide-react';
import { getQuizzesFromSheet, getSheetUrl, setSheetUrl, clearSheetUrl, saveQuizToSheet, deleteQuizFromSheet } from '../services/sheetService';
import { convertGoogleDriveUrl } from '../utils';

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
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // Define column headers
    const QUIZ_HEADERS = ['Quiz_ID','Title','Description','Cover_Image','Created_At','Question_ID','Question_Type','Question_Text','Time_Limit','Option_1','Option_2','Option_3','Option_4','Correct_Option_ID','Correct_Answer','Min','Max','Step','Correct_Value','Media_Type','Media_URL'];
    const RESULT_HEADERS = ['Game_ID','Quiz_ID','Quiz_Title','Winner_Name','Winner_Score','Player_ID','Player_Name','Rank','Score','Saved_At'];

    if (action === 'SAVE_QUIZ') {
      let sheet = ss.getSheetByName('Quizzes');
      if (!sheet) {
        sheet = ss.insertSheet('Quizzes');
        sheet.appendRow(QUIZ_HEADERS);
        sheet.setFrozenRows(1);
      } else if (sheet.getLastRow() === 0) {
        sheet.appendRow(QUIZ_HEADERS);
        sheet.setFrozenRows(1);
      }

      const quiz = data.quiz;
      
      // Remove existing rows for this quiz ID
      const allData = sheet.getDataRange().getValues();
      const rowsToKeep = allData.filter((row, idx) => idx === 0 || row[0] !== quiz.id);
      
      if (rowsToKeep.length < allData.length) {
        sheet.clear();
        if (rowsToKeep.length > 0) {
          sheet.getRange(1, 1, rowsToKeep.length, QUIZ_HEADERS.length).setValues(rowsToKeep);
        }
      }

      // Add new rows - one per question
      const questions = quiz.questions || [];
      const newRows = questions.map(q => [
        quiz.id,
        quiz.title || '',
        quiz.description || '',
        quiz.coverImageUrl || '',
        new Date(quiz.createdAt || Date.now()),
        q.id,
        q.type,
        q.text || '',
        q.timeLimit || 20,
        q.options && q.options[0] ? q.options[0].text : '',
        q.options && q.options[1] ? q.options[1].text : '',
        q.options && q.options[2] ? q.options[2].text : '',
        q.options && q.options[3] ? q.options[3].text : '',
        q.correctOptionId || '',
        q.correctAnswer || '',
        q.min !== undefined ? q.min : '',
        q.max !== undefined ? q.max : '',
        q.step !== undefined ? q.step : '',
        q.correctValue !== undefined ? q.correctValue : '',
        q.mediaType || '',
        q.mediaUrl || ''
      ]);

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, QUIZ_HEADERS.length).setValues(newRows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'GET_QUIZZES') {
      const sheet = ss.getSheetByName('Quizzes');
      if (!sheet || sheet.getLastRow() <= 1) {
        return ContentService.createTextOutput(JSON.stringify({result: 'success', quizzes: []})).setMimeType(ContentService.MimeType.JSON);
      }

      const rows = sheet.getDataRange().getValues();
      const quizzesMap = {};

      // Skip header row
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        const quizId = r[0];
        if (!quizId) continue;

        // Create quiz object if not exists
        if (!quizzesMap[quizId]) {
          quizzesMap[quizId] = {
            id: quizId,
            title: r[1] || '',
            description: r[2] || '',
            coverImageUrl: r[3] || '',
            createdAt: r[4] ? new Date(r[4]).getTime() : Date.now(),
            questions: []
          };
        }

        // Build question object
        const qType = r[6] || 'MC';
        const question = {
          id: r[5],
          type: qType,
          text: r[7] || '',
          timeLimit: Number(r[8]) || 20
        };

        // Add options for MC, POLL, TRUE_FALSE
        if (qType === 'TRUE_FALSE') {
          question.options = [
            { id: 'true', color: 'blue', text: r[9] || 'True' },
            { id: 'false', color: 'red', text: r[10] || 'False' }
          ];
          question.correctOptionId = r[13] || 'true';
        } else if (qType === 'MC' || qType === 'POLL') {
          const colors = ['red','blue','green','yellow'];
          question.options = [];
          for (let j = 0; j < 4; j++) {
            if (r[9 + j]) {
              question.options.push({
                id: 'opt' + (j + 1),
                color: colors[j],
                text: r[9 + j]
              });
            }
          }
          if (qType === 'MC') question.correctOptionId = r[13] || 'opt1';
        } else if (qType === 'OPEN_ENDED') {
          question.correctAnswer = r[14] || '';
        } else if (qType === 'SLIDER') {
          question.min = r[15] !== '' ? Number(r[15]) : 0;
          question.max = r[16] !== '' ? Number(r[16]) : 100;
          question.step = r[17] !== '' ? Number(r[17]) : 1;
          question.correctValue = r[18] !== '' ? Number(r[18]) : 50;
        }

        // Add media if present
        if (r[19]) question.mediaType = r[19];
        if (r[20]) question.mediaUrl = r[20];

        quizzesMap[quizId].questions.push(question);
      }

      return ContentService.createTextOutput(JSON.stringify({result: 'success', quizzes: Object.values(quizzesMap)})).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'DELETE_QUIZ') {
      const quizId = data.quizId;
      if (!quizId) throw new Error('Missing quizId');

      const sheet = ss.getSheetByName('Quizzes');
      if (!sheet || sheet.getLastRow() <= 1) {
        return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
      }

      // Remove all rows with this quiz ID
      const allData = sheet.getDataRange().getValues();
      const rowsToKeep = allData.filter((row, idx) => idx === 0 || row[0] !== quizId);
      
      sheet.clear();
      if (rowsToKeep.length > 0) {
        sheet.getRange(1, 1, rowsToKeep.length, QUIZ_HEADERS.length).setValues(rowsToKeep);
      }
      
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'SAVE_RESULT') {
      let sheet = ss.getSheetByName('Results');
      if (!sheet) {
        sheet = ss.insertSheet('Results');
        sheet.appendRow(RESULT_HEADERS);
        sheet.setFrozenRows(1);
      } else if (sheet.getLastRow() === 0) {
        sheet.appendRow(RESULT_HEADERS);
        sheet.setFrozenRows(1);
      }

      const rankings = data.fullRankings || [];
      const now = new Date();
      
      // One row per player
      const rows = rankings.map(player => [
        data.gameId || '',
        data.quizId || '',
        data.quizTitle || '',
        data.winnerName || '',
        data.winnerScore || 0,
        player.id || '',
        player.name || '',
        player.rank || 0,
        player.score || 0,
        now
      ]);

      if (rows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RESULT_HEADERS.length).setValues(rows);
      }
      
      return ContentService.createTextOutput(JSON.stringify({result: 'success'})).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({result: 'error', error: e.toString()})).setMimeType(ContentService.MimeType.JSON);
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
    
    // If connected, fetch from cloud only
    if (sheetUrl) {
      try {
        const cloudQuizzes = await getQuizzesFromSheet();
        if (cloudQuizzes && cloudQuizzes.length > 0) {
          setQuizzes(cloudQuizzes);
          setIsConnected(true);
        } else {
          // If cloud is empty, show default quiz
          setQuizzes([DEFAULT_QUIZ]);
          setIsConnected(true);
        }
      } catch (e) {
        console.error(e);
        // On error, fallback to local
        const localSaved = localStorage.getItem('quizwiz_quizzes');
        if (localSaved) {
          try {
            setQuizzes(JSON.parse(localSaved));
          } catch (err) {
            setQuizzes([DEFAULT_QUIZ]);
          }
        } else {
          setQuizzes([DEFAULT_QUIZ]);
        }
      }
    } else {
      // Not connected - use local storage
      const localSaved = localStorage.getItem('quizwiz_quizzes');
      if (localSaved) {
        try {
          setQuizzes(JSON.parse(localSaved));
        } catch (e) {
          console.error("Error parsing local quizzes", e);
          setQuizzes([DEFAULT_QUIZ]);
          localStorage.setItem('quizwiz_quizzes', JSON.stringify([DEFAULT_QUIZ]));
        }
      } else {
        setQuizzes([DEFAULT_QUIZ]);
        localStorage.setItem('quizwiz_quizzes', JSON.stringify([DEFAULT_QUIZ]));
      }
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this quiz?')) {
      const updated = quizzes.filter(q => q.id !== id);
      setQuizzes(updated);
      
      // Delete from local storage
      localStorage.setItem('quizwiz_quizzes', JSON.stringify(updated));
      
      // Delete from sheet if connected
      if (isConnected && getSheetUrl()) {
        try {
          await deleteQuizFromSheet(id);
        } catch (error) {
          console.error('Failed to delete from sheet', error);
          alert('Quiz deleted locally, but failed to delete from Google Sheet. Please check your connection.');
        }
      }
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
                            src={convertGoogleDriveUrl(quiz.coverImageUrl)} 
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