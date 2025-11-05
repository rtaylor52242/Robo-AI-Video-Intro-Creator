import React, { useState, useEffect, useCallback, useRef } from 'react';
import { generateVideo } from './services/geminiService';
import type { ImageFile, AspectRatio } from './types';
import { LOADING_MESSAGES, RANDOM_PROMPTS } from './constants';

// Fix: Define AIStudio type to resolve declaration conflicts, as suggested by the error message.
interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
}

declare global {
    interface Window {
        aistudio: AIStudio;
    }
}

const UploadIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-10 h-10 text-gray-400"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
);

const FilmIcon: React.FC<{className?: string}> = ({className}) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className || "w-6 h-6"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9A2.25 2.25 0 0 0 4.5 18.75Z" />
    </svg>
);

const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-80 backdrop-blur-sm flex flex-col items-center justify-center z-50">
        <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-indigo-500"></div>
        <p className="text-xl text-white mt-6 font-semibold">{message}</p>
    </div>
);

const ApiKeyPrompt: React.FC<{ onSelectKey: () => void }> = ({ onSelectKey }) => (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 p-4">
        <div className="text-center max-w-lg p-8 bg-gray-800 rounded-2xl shadow-2xl border border-gray-700">
            <FilmIcon className="w-16 h-16 mx-auto text-indigo-400" />
            <h2 className="text-3xl font-bold text-white mt-6 mb-2">Welcome to Robo AI Video Creator</h2>
            <p className="text-gray-300 mb-6">To generate stunning AI videos, you need to select a Gemini API key. Your key is used securely and only for your requests.</p>
            <p className="text-sm text-gray-400 mb-6">For information about billing, please visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">ai.google.dev/gemini-api/docs/billing</a>.</p>
            <button
                onClick={onSelectKey}
                className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-500 transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-indigo-500"
            >
                Select API Key to Begin
            </button>
        </div>
    </div>
);


export default function App() {
    const [image, setImage] = useState<ImageFile | null>(null);
    const [prompt, setPrompt] = useState<string>('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [loadingMessage, setLoadingMessage] = useState<string>('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isKeySelected, setIsKeySelected] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const checkApiKey = useCallback(async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setIsKeySelected(hasKey);
        } else {
             // Fallback for when aistudio is not available
            setTimeout(checkApiKey, 500);
        }
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    useEffect(() => {
        // Fix: Use ReturnType<typeof setInterval> for browser compatibility instead of NodeJS.Timeout.
        let interval: ReturnType<typeof setInterval>;
        if (isLoading) {
            setLoadingMessage(LOADING_MESSAGES[0]);
            interval = setInterval(() => {
                setLoadingMessage(prev => {
                    const currentIndex = LOADING_MESSAGES.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % LOADING_MESSAGES.length;
                    return LOADING_MESSAGES[nextIndex];
                });
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    const handleSelectKey = async () => {
        try {
            await window.aistudio.openSelectKey();
            // Optimistically assume selection was successful.
            setIsKeySelected(true);
        } catch (e) {
            console.error("Error opening API key selection:", e);
            setError("Could not open API key selection. Please try again.");
        }
    };
    
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataUrl = e.target?.result as string;
                setImage({ id: Date.now().toString(), dataUrl, name: file.name });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerate = async () => {
        if (!image) {
            setError("Please upload an image to generate a video.");
            return;
        }

        setError(null);
        setVideoUrl(null);
        setIsLoading(true);

        const finalPrompt = prompt || RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
        if(!prompt){
            setPrompt(finalPrompt);
        }

        try {
            const url = await generateVideo(finalPrompt, image.dataUrl, aspectRatio, setLoadingMessage);
            setVideoUrl(url);
        } catch (e: any) {
            console.error(e);
            let errorMessage = e.message || "An unknown error occurred.";
            if (errorMessage.includes("Requested entity was not found")) {
                errorMessage = "API Key is invalid or not found. Please select a valid key.";
                setIsKeySelected(false);
            }
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isKeySelected) {
        return <ApiKeyPrompt onSelectKey={handleSelectKey} />;
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
            {isLoading && <LoadingOverlay message={loadingMessage} />}
            <div className="max-w-4xl mx-auto">
                <header className="text-center mb-8">
                    <div className="flex items-center justify-center gap-3">
                         <FilmIcon className="w-10 h-10 text-indigo-400"/>
                        <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-500">
                            Robo AI Video Intro Creator
                        </h1>
                    </div>
                    <p className="mt-4 text-lg text-gray-300">Turn your image into a cinematic masterpiece.</p>
                </header>

                <main className="space-y-8">
                     <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 text-indigo-300">1. Upload Your Inspiration</h2>
                        <div 
                            className="relative border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 hover:bg-gray-700/50 transition-all duration-300"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                            {image ? (
                                <div className="relative group">
                                    <img src={image.dataUrl} alt="Preview" className="mx-auto max-h-48 rounded-md shadow-md" />
                                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <p className="text-white font-semibold">Click to change image</p>
                                    </div>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setImage(null); }}
                                        className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-500 transition-transform transform group-hover:scale-110"
                                        aria-label="Remove image"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center">
                                    <UploadIcon />
                                    <p className="mt-2 text-gray-400">Click to upload an image</p>
                                    <p className="text-sm text-gray-500">PNG, JPG, WEBP</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-lg">
                        <h2 className="text-2xl font-semibold mb-4 text-indigo-300">2. Describe Your Vision</h2>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g., An epic cinematic intro for a sci-fi blockbuster..."
                            className="w-full h-24 p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        />
                        <p className="text-sm text-gray-400 mt-2">Or leave blank for a randomly generated prompt!</p>
                    </div>
                    
                    <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-lg">
                         <h2 className="text-2xl font-semibold mb-4 text-indigo-300">3. Choose Aspect Ratio</h2>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <button onClick={() => setAspectRatio('16:9')} className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${aspectRatio === '16:9' ? 'border-indigo-500 bg-indigo-900/50' : 'border-gray-600 bg-gray-700 hover:border-indigo-600'}`}>
                                <div className="w-16 h-9 bg-gray-500 rounded-sm mb-2"></div>
                                <span className="font-semibold">16:9 (Landscape)</span>
                            </button>
                             <button onClick={() => setAspectRatio('9:16')} className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${aspectRatio === '9:16' ? 'border-indigo-500 bg-indigo-900/50' : 'border-gray-600 bg-gray-700 hover:border-indigo-600'}`}>
                                <div className="w-9 h-16 bg-gray-500 rounded-sm mb-2"></div>
                                <span className="font-semibold">9:16 (Portrait)</span>
                            </button>
                         </div>
                    </div>

                    <div className="pt-4">
                        <button
                            onClick={handleGenerate}
                            disabled={!image || isLoading}
                            className="w-full flex items-center justify-center gap-3 text-xl font-bold py-4 px-6 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 focus:ring-indigo-500"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" /></svg>
                            Generate Video
                        </button>
                    </div>

                    {error && (
                        <div className="bg-red-900/50 border border-red-500 text-red-300 p-4 rounded-lg text-center">
                            <strong>Error:</strong> {error}
                        </div>
                    )}

                    {videoUrl && (
                        <div className="bg-gray-800 border border-gray-700 p-6 rounded-2xl shadow-lg">
                            <h2 className="text-2xl font-semibold mb-4 text-indigo-300">Your Video Intro is Ready!</h2>
                            <div className="aspect-w-16 aspect-h-9 bg-black rounded-lg overflow-hidden">
                                <video src={videoUrl} controls autoPlay loop className="w-full h-full object-contain" />
                            </div>
                            <a 
                                href={videoUrl} 
                                download="robo-ai-intro.mp4"
                                className="mt-4 inline-block w-full text-center py-3 px-6 rounded-lg bg-green-600 hover:bg-green-500 font-semibold transition-colors"
                            >
                                Download Video
                            </a>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}