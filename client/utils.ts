export const generateGameId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking chars (I, 1, 0, O)
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const ADJECTIVES = ['Happy', 'Lucky', 'Sunny', 'Cool', 'Super', 'Mega', 'Hyper', 'Swift', 'Brave', 'Clever', 'Neon', 'Turbo', 'Epic', 'Wild', 'Cosmic', 'Funky', 'Retro', 'Magic'];
const NOUNS = ['Panda', 'Tiger', 'Eagle', 'Rocket', 'Wizard', 'Ninja', 'Star', 'Comet', 'Dragon', 'Fox', 'Wolf', 'Bear', 'Falcon', 'Rider', 'Hero', 'Pixel', 'Ghost', 'Cat'];

export const generateRandomName = (): string => {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const num = Math.floor(Math.random() * 99) + 1;
  return `${adj}${noun}${num}`;
};

export const getYoutubeId = (url: string): string | null => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

export const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return url;
    
    // Remove any whitespace
    url = url.trim();
    
    // Convert Google Drive share links to direct image URLs
    // Pattern 1: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const driveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (driveMatch) {
        const fileId = driveMatch[1];
        // Using Google'susercontent domain - most reliable for images
        return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    
    // Pattern 2: Already converted format
    const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (idMatch && !url.includes('lh3.googleusercontent.com')) {
        return `https://lh3.googleusercontent.com/d/${idMatch[1]}`;
    }
    
    // Pattern 3: Open format https://drive.google.com/open?id=FILE_ID
    const openMatch = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
    if (openMatch) {
        return `https://lh3.googleusercontent.com/d/${openMatch[1]}`;
    }
    
    return url;
};