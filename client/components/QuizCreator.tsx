
import React, { useState } from 'react';
import { Quiz, Question, QuestionType, MediaType } from '../types';
import { Save, Plus, Trash2, X, AlertCircle, Clock, Loader2, Upload, Download, FileText, MessageSquare, PieChart, Image as ImageIcon, Youtube, Settings, Sparkles, Bot, Brain, Key } from 'lucide-react';
import { saveQuizToSheet } from '../services/sheetService';
import { getYoutubeId } from '../utils';
import { GoogleGenAI, Type } from "@google/genai";

interface QuizCreatorProps {
  onSave: () => void;
  onCancel: () => void;
  initialQuiz?: Quiz | null;
}

type AIProvider = 'gemini' | 'openai' | 'claude';

const QuizCreator: React.FC<QuizCreatorProps> = ({ onSave, onCancel, initialQuiz }) => {
  const [title, setTitle] = useState(initialQuiz?.title || '');
  const [description, setDescription] = useState(initialQuiz?.description || '');
  const [coverImageUrl, setCoverImageUrl] = useState(initialQuiz?.coverImageUrl || '');
  
  const [questions, setQuestions] = useState<Question[]>(initialQuiz?.questions || [
    {
      id: Date.now(),
      type: 'MC',
      text: '',
      timeLimit: 20,
      correctOptionId: 'opt1',
      options: [
        { id: 'opt1', color: 'red', text: '' },
        { id: 'opt2', color: 'blue', text: '' },
        { id: 'opt3', color: 'green', text: '' },
        { id: 'opt4', color: 'yellow', text: '' },
      ]
    }
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // AI Generation State
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiProvider, setAiProvider] = useState<AIProvider>('gemini');
  const [customApiKey, setCustomApiKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleAddQuestion = () => {
    setQuestions([
      ...questions,
      {
        id: Date.now(),
        type: 'MC',
        text: '',
        timeLimit: 20,
        correctOptionId: 'opt1',
        options: [
          { id: 'opt1', color: 'red', text: '' },
          { id: 'opt2', color: 'blue', text: '' },
          { id: 'opt3', color: 'green', text: '' },
          { id: 'opt4', color: 'yellow', text: '' },
        ]
      }
    ]);
  };

  const handleRemoveQuestion = (id: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter(q => q.id !== id));
  };

  const updateQuestionType = (id: number, type: QuestionType) => {
    setQuestions(questions.map(q => {
      if (q.id !== id) return q;

      const base = { ...q, type };
      
      switch (type) {
        case 'MC':
        case 'POLL':
          return {
            ...base,
            options: [
              { id: 'opt1', color: 'red', text: '' },
              { id: 'opt2', color: 'blue', text: '' },
              { id: 'opt3', color: 'green', text: '' },
              { id: 'opt4', color: 'yellow', text: '' },
            ],
            correctOptionId: 'opt1'
          };
        case 'TRUE_FALSE':
          return {
            ...base,
            options: [
              { id: 'true', color: 'blue', text: 'True' },
              { id: 'false', color: 'red', text: 'False' },
            ],
            correctOptionId: 'true'
          };
        case 'OPEN_ENDED':
          return { ...base, correctAnswer: '', options: undefined };
        case 'WORD_CLOUD':
          return { ...base, options: undefined };
        case 'SLIDER':
          return { ...base, min: 0, max: 100, step: 1, correctValue: 50, options: undefined };
        default:
          return base;
      }
    }));
  };

  const updateQuestionField = (id: number, field: keyof Question, value: any) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, [field]: value } : q));
  };

  const updateOptionText = (qId: number, optId: string, text: string) => {
    setQuestions(questions.map(q => {
      if (q.id === qId && q.options) {
        return {
          ...q,
          options: q.options.map(o => o.id === optId ? { ...o, text } : o)
        };
      }
      return q;
    }));
  };

  const updateCorrectOption = (qId: number, optId: string) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, correctOptionId: optId } : q));
  };

  // --- AI Generation Logic ---
  const handleAIGenerate = async () => {
    if (!aiTopic.trim()) {
        setError("Please enter a topic.");
        return;
    }
    if (aiProvider !== 'gemini' && !customApiKey.trim()) {
        setError("API Key is required for the selected provider.");
        return;
    }
    
    setIsGenerating(true);
    setError(null);

    try {
        let generatedData: any[] = [];

        // --- GEMINI STRATEGY ---
        if (aiProvider === 'gemini') {
            // Fix: Initializing GoogleGenAI using the correct named parameter.
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            // Fix: Using gemini-3-flash-preview for the quiz generation task as recommended for basic text tasks.
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Generate ${aiCount} quiz questions about "${aiTopic}". 
                Mix types between Multiple Choice (MC), TRUE_FALSE, and OPEN_ENDED. 
                For MC, provide 4 options. 
                For TRUE_FALSE, the answer must be 'True' or 'False'.
                For OPEN_ENDED, provide a short text answer.`,
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                text: { type: Type.STRING },
                                type: { type: Type.STRING, enum: ["MC", "TRUE_FALSE", "OPEN_ENDED"] },
                                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                                correctAnswer: { type: Type.STRING }
                            },
                            required: ["text", "type", "correctAnswer"]
                        }
                    }
                }
            });
            // Fix: Accessing .text property directly instead of calling it as a function.
            generatedData = JSON.parse(response.text);
        } 
        
        // --- OPENAI STRATEGY ---
        else if (aiProvider === 'openai') {
            const prompt = `Generate ${aiCount} quiz questions about "${aiTopic}". 
            Return a JSON object with a key "questions" containing an array. 
            Each question object must have:
            - text: string
            - type: "MC" | "TRUE_FALSE" | "OPEN_ENDED"
            - options: string[] (4 options for MC)
            - correctAnswer: string
            For TRUE_FALSE, options are implied.`;

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${customApiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo-0125", // Cost effective, supports JSON mode
                    messages: [
                        { role: "system", content: "You are a quiz generation assistant. You only output valid JSON." },
                        { role: "user", content: prompt }
                    ],
                    response_format: { type: "json_object" }
                })
            });
            
            const data = await res.json();
            if (data.error) throw new Error(data.error.message);
            const parsed = JSON.parse(data.choices[0].message.content);
            generatedData = parsed.questions || parsed;
        }

        // --- CLAUDE STRATEGY ---
        else if (aiProvider === 'claude') {
            const prompt = `Generate ${aiCount} quiz questions about "${aiTopic}". 
            Return ONLY a JSON array. Do not include any other text.
            Structure:
            [
              {
                "text": "Question?",
                "type": "MC" (or TRUE_FALSE or OPEN_ENDED),
                "options": ["A", "B", "C", "D"],
                "correctAnswer": "A"
              }
            ]`;

            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': customApiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: "claude-3-haiku-20240307",
                    max_tokens: 1500,
                    messages: [{ role: "user", content: prompt }]
                })
            });

            if (!res.ok) {
                throw new Error("Anthropic API request failed. Note: Claude API often blocks browser requests (CORS).");
            }

            const data = await res.json();
            const content = data.content[0].text;
            const jsonStr = content.substring(content.indexOf('['), content.lastIndexOf(']') + 1);
            generatedData = JSON.parse(jsonStr);
        }

        // --- PROCESSING ---
        if (!Array.isArray(generatedData)) throw new Error("Invalid format received from AI");

        const newQuestions: Question[] = generatedData.map((item: any, index: number) => {
             // Strict Type Normalization
             let normalizedType: QuestionType = 'MC'; // Default
             const rawType = String(item.type).toUpperCase();
             if (rawType.includes('TRUE') || rawType.includes('FALSE') || rawType === 'TF') normalizedType = 'TRUE_FALSE';
             else if (rawType.includes('OPEN') || rawType === 'text') normalizedType = 'OPEN_ENDED';
             else if (rawType.includes('POLL')) normalizedType = 'POLL';
             // Defaulting others to MC

             const baseQ: Question = {
                 id: Date.now() + index,
                 text: item.text,
                 type: normalizedType,
                 timeLimit: 20
             };

             if (baseQ.type === 'MC') {
                 const opts = item.options && Array.isArray(item.options) ? item.options : ["A", "B", "C", "D"];
                 // Ensure we have 4 options if possible, or pad/slice
                 const paddedOpts = [...opts, "Option", "Option", "Option"].slice(0, 4);
                 
                 baseQ.options = [
                     { id: 'opt1', color: 'red', text: String(paddedOpts[0] || '') },
                     { id: 'opt2', color: 'blue', text: String(paddedOpts[1] || '') },
                     { id: 'opt3', color: 'green', text: String(paddedOpts[2] || '') },
                     { id: 'opt4', color: 'yellow', text: String(paddedOpts[3] || '') }
                 ];

                 // Find correct option index
                 const correctIndex = paddedOpts.findIndex((o: string) => o === item.correctAnswer);
                 const idMap = ['opt1', 'opt2', 'opt3', 'opt4'];
                 baseQ.correctOptionId = correctIndex !== -1 ? idMap[correctIndex] : 'opt1';
             
             } else if (baseQ.type === 'TRUE_FALSE') {
                 baseQ.options = [
                     { id: 'true', color: 'blue', text: 'True' },
                     { id: 'false', color: 'red', text: 'False' },
                 ];
                 const isTrue = String(item.correctAnswer).toLowerCase().includes('true');
                 baseQ.correctOptionId = isTrue ? 'true' : 'false';
             
             } else if (baseQ.type === 'OPEN_ENDED') {
                 baseQ.correctAnswer = item.correctAnswer || '';
             }

             return baseQ;
        });

        if (questions.length === 1 && questions[0].text === '') {
            setQuestions(newQuestions);
        } else {
            setQuestions([...questions, ...newQuestions]);
        }

        setShowAIModal(false);
        setAiTopic(''); 
        if (!title) setTitle(`${aiTopic} Quiz`);

    } catch (e: any) {
        console.error(e);
        setError(e.message || "Failed to generate questions.");
    } finally {
        setIsGenerating(false);
    }
  };


  // --- CSV Import/Export Logic ---
  const downloadSampleCSV = () => {
    const headers = ['Type', 'Question Text', 'Time Limit', 'Correct Answer/Value', 'Option 1 / Min', 'Option 2 / Max', 'Option 3', 'Option 4'];
    const rows = [
      ['MC', 'Which planet is the Red Planet?', '20', 'Mars', 'Mars', 'Venus', 'Jupiter', 'Saturn'],
      ['TRUE_FALSE', 'The earth is flat.', '15', 'False', '', '', '', ''],
      ['OPEN_ENDED', 'Who wrote Romeo and Juliet?', '30', 'Shakespeare', '', '', '', ''],
      ['SLIDER', 'Days in a leap year?', '20', '366', '300', '400', '', ''],
      ['POLL', 'Favorite Color?', '20', '', 'Red', 'Blue', 'Green', 'Yellow'],
      ['WORD_CLOUD', 'Describe space in one word', '30', '', '', '', '', '']
    ];

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
          if (cell.includes(',') || cell.includes('"')) {
              return `"${cell.replace(/"/g, '""')}"`;
          }
          return cell;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'quizwiz_sample.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const splitCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
              if (inQuotes && line[i+1] === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
          } else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; } else { current += char; }
      }
      result.push(current.trim());
      return result;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { parseCSV(event.target?.result as string); };
    reader.readAsText(file);
    e.target.value = '';
  };

  const parseCSV = (csvText: string) => {
    try {
      const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
      const newQuestions: Question[] = [];
      const startIdx = lines[0].toLowerCase().includes('type') ? 1 : 0;
      for (let i = startIdx; i < lines.length; i++) {
        const parts = splitCSVLine(lines[i]);
        if (parts.length < 2) continue;
        const typeStr = parts[0].toUpperCase();
        const text = parts[1];
        const timeLimit = parseInt(parts[2]) || 20;
        const correctRaw = parts[3];

        let type: QuestionType = 'MC';
        if (typeStr.includes('MC') || typeStr.includes('MULTIPLE')) type = 'MC';
        else if (typeStr.includes('TRUE') || typeStr.includes('TF')) type = 'TRUE_FALSE';
        else if (typeStr.includes('OPEN')) type = 'OPEN_ENDED';
        else if (typeStr.includes('POLL')) type = 'POLL';
        else if (typeStr.includes('CLOUD')) type = 'WORD_CLOUD';
        else if (typeStr.includes('SLIDER')) type = 'SLIDER';

        const baseQ: Question = { id: Date.now() + i, type, text, timeLimit };
        if (type === 'MC' || type === 'POLL') {
             baseQ.options = [
                 { id: 'opt1', color: 'red', text: parts[4] || '' },
                 { id: 'opt2', color: 'blue', text: parts[5] || '' },
                 { id: 'opt3', color: 'green', text: parts[6] || '' },
                 { id: 'opt4', color: 'yellow', text: parts[7] || '' },
             ];
             if (type === 'MC') {
                 const match = baseQ.options.find(o => o.text.toLowerCase() === correctRaw.toLowerCase());
                 baseQ.correctOptionId = match ? match.id : 'opt1';
             }
        } else if (type === 'TRUE_FALSE') {
            baseQ.options = [{ id: 'true', color: 'blue', text: 'True' }, { id: 'false', color: 'red', text: 'False' }];
            baseQ.correctOptionId = correctRaw.toLowerCase().includes('true') ? 'true' : 'false';
        } else if (type === 'OPEN_ENDED') { baseQ.correctAnswer = correctRaw; }
        else if (type === 'SLIDER') { baseQ.correctValue = Number(correctRaw) || 50; baseQ.min = Number(parts[4]) || 0; baseQ.max = Number(parts[5]) || 100; baseQ.step = 1; }
        newQuestions.push(baseQ);
      }
      if (newQuestions.length > 0) { setQuestions([...questions, ...newQuestions]); setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 100); }
      else { setError("Could not parse any questions. Check format."); }
    } catch (e) { console.error(e); setError("Failed to process CSV file."); }
  };

  const handleSave = async () => {
    if (!title.trim()) { setError('Please enter a quiz title.'); return; }
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.text.trim()) { setError(`Question ${i + 1} is missing text.`); return; }
      if ((q.type === 'MC' || q.type === 'POLL') && q.options?.some(o => !o.text.trim())) { setError(`Question ${i + 1} has empty options.`); return; }
      if (q.type === 'OPEN_ENDED' && !q.correctAnswer?.trim()) { setError(`Question ${i + 1} needs a correct answer.`); return; }
    }
    setIsSaving(true);
    const saved = localStorage.getItem('quizwiz_quizzes');
    let existing = saved ? JSON.parse(saved) : [];
    let finalQuiz: Quiz;
    if (initialQuiz) {
        finalQuiz = { ...initialQuiz, title: title.trim(), description, coverImageUrl, questions };
        existing = existing.map((q: Quiz) => q.id === initialQuiz.id ? finalQuiz : q);
    } else {
        finalQuiz = { id: 'quiz-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5), title: title.trim(), description, coverImageUrl, questions, createdAt: Date.now() };
        existing.push(finalQuiz);
    }
    localStorage.setItem('quizwiz_quizzes', JSON.stringify(existing));
    await saveQuizToSheet(finalQuiz);
    setIsSaving(false);
    onSave();
  };

  return (
    <div className="min-h-screen bg-indigo-50 dark:bg-slate-900 pb-20 transition-colors">
      <div className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 p-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{initialQuiz ? 'Edit Quiz' : 'Create New Quiz'}</h1>
          <div className="flex gap-3">
             <button onClick={onCancel} className="px-4 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg shadow-lg shadow-indigo-500/20 active:scale-95 transition-all">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {isSaving ? 'Saving...' : 'Save Quiz'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        
        {/* Basic Information Section */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700 animate-pop">
            <h2 className="text-xl font-bold mb-6 text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-500" /> Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Quiz Title</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={e => setTitle(e.target.value)} 
                            placeholder="Enter a catchy title..." 
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-lg font-bold text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400" 
                        />
                    </div>
                    
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description (Optional)</label>
                        <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            placeholder="Provide a short description for your quiz to increase visibility." 
                            rows={4} 
                            maxLength={500}
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-3 text-slate-700 dark:text-slate-300 outline-none transition-colors placeholder-slate-400 resize-none"
                        />
                        <div className="text-right text-xs text-slate-400">{description.length}/500</div>
                    </div>
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cover Image</label>
                   <div className="aspect-video bg-slate-100 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden relative group">
                      {coverImageUrl ? (
                         <>
                           <img src={coverImageUrl} className="w-full h-full object-cover" alt="Cover" />
                           <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                             <button onClick={() => setCoverImageUrl('')} className="text-white bg-red-500 p-2 rounded-full hover:bg-red-600 transition-colors"><Trash2 className="w-5 h-5" /></button>
                           </div>
                         </>
                      ) : (
                         <div className="text-center p-4">
                            <ImageIcon className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                            <p className="text-xs text-slate-500">Preview Area</p>
                         </div>
                      )}
                   </div>
                   <input 
                        type="text" 
                        value={coverImageUrl} 
                        onChange={(e) => setCoverImageUrl(e.target.value)}
                        placeholder="Paste image URL here..." 
                        className="w-full text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 transition-colors" 
                   />
                </div>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center">
                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 mr-auto">Actions:</span>
                
                <button 
                  onClick={() => setShowAIModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white rounded-lg transition-colors text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                    <Sparkles className="w-4 h-4" /> Magic Generate
                </button>

                <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg cursor-pointer transition-colors text-slate-600 dark:text-slate-300 text-sm font-semibold">
                    <Upload className="w-4 h-4" /> Import CSV
                    <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
                <button onClick={downloadSampleCSV} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors text-slate-600 dark:text-slate-300 text-sm font-semibold">
                    <Download className="w-4 h-4" /> Sample CSV
                </button>
            </div>
        </div>

        <div className="space-y-8">
           {questions.map((q, index) => (
             <div key={q.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 relative group animate-pop shadow-sm">
               <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
                 <div className="flex flex-wrap items-center gap-4">
                    <h3 className="text-indigo-600 dark:text-indigo-400 font-bold text-lg">Q{index + 1}</h3>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <select value={q.type} onChange={(e) => updateQuestionType(q.id, e.target.value as QuestionType)} className="bg-transparent text-slate-700 dark:text-white text-sm outline-none cursor-pointer font-semibold">
                            <option value="MC">Multiple Choice</option>
                            <option value="TRUE_FALSE">True / False</option>
                            <option value="POLL">Poll (No Score)</option>
                            <option value="OPEN_ENDED">Open Ended</option>
                            <option value="WORD_CLOUD">Word Cloud</option>
                            <option value="SLIDER">Slider</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <select value={q.timeLimit || 20} onChange={(e) => updateQuestionField(q.id, 'timeLimit', Number(e.target.value))} className="bg-transparent text-slate-700 dark:text-white text-sm outline-none cursor-pointer">
                            <option value={10}>10s</option>
                            <option value={20}>20s</option>
                            <option value={30}>30s</option>
                            <option value={60}>60s</option>
                        </select>
                    </div>
                 </div>
                 {questions.length > 1 && <button onClick={() => handleRemoveQuestion(q.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors self-end md:self-auto"><Trash2 className="w-5 h-5" /></button>}
               </div>

               <div className="space-y-4 mb-6">
                 <input type="text" value={q.text} onChange={(e) => updateQuestionField(q.id, 'text', e.target.value)} placeholder="Type your question here..." className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-lg px-4 py-3 text-lg text-slate-900 dark:text-white outline-none transition-colors" />

                 {/* Media Input */}
                 <div className="flex gap-4">
                     <div className="flex-1">
                        <div className="relative">
                            <input 
                                type="text" 
                                value={q.mediaUrl || ''} 
                                onChange={(e) => updateQuestionField(q.id, 'mediaUrl', e.target.value)} 
                                placeholder="Paste Image URL or YouTube Link (Optional)" 
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-indigo-500 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white outline-none"
                            />
                            <div className="absolute left-3 top-2.5 text-slate-400">
                                {q.mediaUrl && (q.mediaUrl.includes('youtube') || q.mediaUrl.includes('youtu.be')) ? <Youtube className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                            </div>
                        </div>
                     </div>
                     <div className="w-32">
                        <select 
                            value={q.mediaType || 'image'} 
                            onChange={(e) => updateQuestionField(q.id, 'mediaType', e.target.value)} 
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none cursor-pointer"
                        >
                            <option value="image">Image</option>
                            <option value="youtube">YouTube</option>
                        </select>
                     </div>
                 </div>
                 {/* Media Preview */}
                 {q.mediaUrl && (
                     <div className="mt-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 max-h-48 w-full flex justify-center">
                        {q.mediaType === 'youtube' || (q.mediaUrl.includes('youtube') || q.mediaUrl.includes('youtu.be')) ? (
                            <div className="text-slate-500 flex items-center gap-2 p-4 text-sm"><Youtube className="w-5 h-5 text-red-500" /> Video will be embedded</div>
                        ) : (
                            <img src={q.mediaUrl} alt="Preview" className="h-full object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        )}
                     </div>
                 )}
               </div>

               <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700/50">
                 {(q.type === 'MC' || q.type === 'POLL') && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {q.options?.map((opt) => (
                       <div key={opt.id} className="flex items-center gap-3 bg-white dark:bg-slate-900/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700/50 shadow-sm">
                         <div className={`relative shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${q.type === 'MC' ? 'cursor-pointer' : ''}`} onClick={() => q.type === 'MC' && updateCorrectOption(q.id, opt.id)}>
                           <div className={`absolute inset-0 rounded-full opacity-20 ${opt.color === 'red' ? 'bg-red-500' : opt.color === 'blue' ? 'bg-blue-500' : opt.color === 'green' ? 'bg-emerald-500' : 'bg-yellow-400'}`}></div>
                           {q.type === 'MC' && <div className={`w-4 h-4 rounded-full border-2 ${q.correctOptionId === opt.id ? 'border-indigo-500 bg-indigo-500 dark:border-white dark:bg-white' : 'border-slate-300 dark:border-white/50 bg-transparent'}`}></div>}
                           {q.type === 'POLL' && <PieChart className="w-4 h-4 text-slate-400" />}
                         </div>
                         <input type="text" value={opt.text} onChange={(e) => updateOptionText(q.id, opt.id, e.target.value)} placeholder={`Option ${opt.color.charAt(0).toUpperCase() + opt.color.slice(1)}`} className={`w-full bg-transparent border-b-2 border-transparent focus:border-${opt.color === 'green' ? 'emerald' : opt.color}-500 px-2 py-1 text-slate-900 dark:text-white outline-none transition-colors placeholder-slate-400`} />
                       </div>
                     ))}
                   </div>
                 )}

                 {q.type === 'TRUE_FALSE' && (
                   <div className="flex gap-4">
                     {q.options?.map((opt) => (
                        <button key={opt.id} onClick={() => updateCorrectOption(q.id, opt.id)} className={`flex-1 py-4 rounded-xl border-2 font-bold text-lg transition-all ${q.correctOptionId === opt.id ? opt.id === 'true' ? 'bg-blue-100 border-blue-500 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' : 'bg-red-100 border-red-500 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-500 bg-white dark:bg-slate-900'}`}>{opt.text}</button>
                     ))}
                   </div>
                 )}

                 {q.type === 'OPEN_ENDED' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Correct Answer (Exact Match)</label>
                      <input type="text" value={q.correctAnswer || ''} onChange={(e) => updateQuestionField(q.id, 'correctAnswer', e.target.value)} placeholder="e.g. Paris" className="w-full bg-white dark:bg-slate-900 border border-emerald-500/50 rounded-lg px-4 py-3 text-emerald-600 dark:text-emerald-400 font-bold outline-none" />
                    </div>
                 )}

                 {q.type === 'SLIDER' && (
                   <div className="grid grid-cols-3 gap-4">
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Min</label><input type="number" value={q.min ?? 0} onChange={(e) => updateQuestionField(q.id, 'min', Number(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none" /></div>
                      <div><label className="text-xs font-bold text-slate-500 uppercase">Max</label><input type="number" value={q.max ?? 100} onChange={(e) => updateQuestionField(q.id, 'max', Number(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white outline-none" /></div>
                      <div><label className="text-xs font-bold text-emerald-500 uppercase">Correct Value</label><input type="number" value={q.correctValue ?? 50} onChange={(e) => updateQuestionField(q.id, 'correctValue', Number(e.target.value))} className="w-full bg-white dark:bg-slate-900 border border-emerald-500 rounded-lg px-3 py-2 text-emerald-600 dark:text-emerald-400 font-bold outline-none" /></div>
                   </div>
                 )}

                 {q.type === 'WORD_CLOUD' && (
                    <div className="flex items-center justify-center p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
                       <p className="text-slate-500 flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Players will type a short answer. No scoring.</p>
                    </div>
                 )}
               </div>
               
               {q.type !== 'POLL' && q.type !== 'WORD_CLOUD' && (<p className="mt-3 text-xs text-slate-500 text-center">{q.type === 'MC' || q.type === 'TRUE_FALSE' ? 'Select the correct option bubble.' : 'Ensure the correct answer is set.'}</p>)}
             </div>
           ))}
        </div>

        <button onClick={handleAddQuestion} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white rounded-xl transition-all flex items-center justify-center gap-2 font-semibold"><Plus className="w-5 h-5" /> Add Question</button>
      </div>
      
      {/* AI Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-pop">
           <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-indigo-600 flex items-center gap-2">
                     <Sparkles className="w-6 h-6 text-purple-500 fill-current" /> Magic Generate
                  </h2>
                  <button onClick={() => !isGenerating && setShowAIModal(false)} className="text-slate-500 hover:text-red-500"><X className="w-6 h-6" /></button>
              </div>
              
              <div className="space-y-4">
                  {/* Provider Selection */}
                  <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">AI Model</label>
                      <div className="grid grid-cols-3 gap-2">
                          <button onClick={() => setAiProvider('gemini')} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${aiProvider === 'gemini' ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500'}`}>
                              <Sparkles className="w-5 h-5" />
                              <span className="text-xs font-bold">Gemini</span>
                          </button>
                          <button onClick={() => setAiProvider('openai')} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${aiProvider === 'openai' ? 'border-green-500 bg-green-50 dark:bg-green-500/20 text-green-600 dark:text-green-300' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500'}`}>
                              <Bot className="w-5 h-5" />
                              <span className="text-xs font-bold">OpenAI</span>
                          </button>
                          <button onClick={() => setAiProvider('claude')} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${aiProvider === 'claude' ? 'border-purple-500 bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300' : 'border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500'}`}>
                              <Brain className="w-5 h-5" />
                              <span className="text-xs font-bold">Claude</span>
                          </button>
                      </div>
                  </div>

                  {/* API Key Input (Hidden for Gemini) */}
                  {aiProvider !== 'gemini' && (
                      <div className="animate-pop">
                          <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase flex items-center gap-2">
                              <Key className="w-3 h-3" /> API Key <span className="text-xs font-normal normal-case text-slate-400">(Stored locally only)</span>
                          </label>
                          <input 
                             type="password" 
                             value={customApiKey}
                             onChange={e => setCustomApiKey(e.target.value)}
                             placeholder={`Enter your ${aiProvider === 'openai' ? 'OpenAI' : 'Anthropic'} API Key`}
                             className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                          />
                          {aiProvider === 'claude' && <p className="text-[10px] text-amber-500 mt-1">Note: Anthropic API may require a proxy due to strict browser CORS policies.</p>}
                      </div>
                  )}

                  <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Topic</label>
                      <input 
                         type="text" 
                         value={aiTopic}
                         onChange={e => setAiTopic(e.target.value)}
                         placeholder="e.g., 1980s Pop Music, Quantum Physics"
                         className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-xl px-4 py-3 outline-none focus:border-indigo-500 text-slate-900 dark:text-white"
                         autoFocus
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase">Number of Questions</label>
                      <div className="flex items-center gap-4">
                          <input 
                             type="range" 
                             min="1" max="10" 
                             value={aiCount}
                             onChange={e => setAiCount(Number(e.target.value))}
                             className="flex-1 accent-indigo-500"
                          />
                          <span className="font-mono text-xl font-bold text-indigo-500">{aiCount}</span>
                      </div>
                  </div>
                  
                  <button 
                     onClick={handleAIGenerate}
                     disabled={isGenerating || !aiTopic.trim() || (aiProvider !== 'gemini' && !customApiKey.trim())}
                     className="w-full py-4 mt-4 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                      {isGenerating ? <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</> : <><Sparkles className="w-5 h-5" /> Generate Quiz</>}
                  </button>
              </div>
           </div>
        </div>
      )}

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-6 py-3 bg-red-500 text-white rounded-full shadow-2xl animate-pop z-50">
           <AlertCircle className="w-5 h-5" /> <span>{error}</span> <button onClick={() => setError(null)} className="ml-2 hover:bg-white/20 rounded-full p-1"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

export default QuizCreator;
