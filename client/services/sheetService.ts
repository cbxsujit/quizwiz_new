import { Quiz } from '../types';

// We store the URL in localStorage so the user only has to enter it once
const STORAGE_KEY = 'quizwiz_sheet_url';

export const getSheetUrl = (): string | null => {
  return localStorage.getItem(STORAGE_KEY);
};

export const setSheetUrl = (url: string) => {
  localStorage.setItem(STORAGE_KEY, url);
};

export const clearSheetUrl = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const saveQuizToSheet = async (quiz: Quiz) => {
  const url = getSheetUrl();
  if (!url) return; // Fallback to local storage handling in components

  try {
    // We removed 'no-cors' to allow reading the response status.
    // Ensure your Google Apps Script returns proper JSON.
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // 'text/plain' avoids preflight OPTIONS request in simple CORS
      body: JSON.stringify({
        action: 'SAVE_QUIZ',
        quiz: quiz
      })
    });
    
    if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to save quiz to sheet", error);
    throw error;
  }
};

export const getQuizzesFromSheet = async (): Promise<Quiz[] | null> => {
  const url = getSheetUrl();
  if (!url) return null;

  try {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'GET_QUIZZES' })
    });
    
    const data = await response.json();
    if (data.result === 'success' && Array.isArray(data.quizzes)) {
        return data.quizzes;
    }
    return null;
  } catch (error) {
    console.error("Failed to fetch quizzes from sheet", error);
    return null;
  }
};

export const saveGameResultToSheet = async (
  gameId: string, 
  quizTitle: string, 
  winnerName: string, 
  winnerScore: number, 
  fullRankings: any[]
) => {
  const url = getSheetUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'SAVE_RESULT',
        gameId,
        quizTitle,
        winnerName,
        winnerScore,
        fullRankings
      })
    });
  } catch (error) {
    console.error("Failed to save results", error);
  }
};