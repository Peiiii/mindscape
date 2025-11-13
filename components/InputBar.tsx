import React, { useState, useRef } from 'react';
import { SendIcon, UploadIcon } from './Icons';

interface InputBarProps {
  onSubmit: (prompt: string, file: File | null) => void;
  isLoading: boolean;
}

const InputBar: React.FC<InputBarProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || (!prompt.trim() && !file)) return;
    onSubmit(prompt, file);
    setPrompt('');
    setFile(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };
  
  const handleUploadClick = () => {
      fileInputRef.current?.click();
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl p-4 z-10">
      <div className="relative">
        <form onSubmit={handleSubmit} className="relative group">
          {file && (
            <div className="absolute -top-10 left-2 bg-gray-800 text-white text-xs rounded-full px-3 py-1 flex items-center gap-2 shadow-lg border border-cyan-500/30">
              <span>{file.name}</span>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-red-400 hover:text-red-300 font-bold"
              >
                &times;
              </button>
            </div>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入一个新想法，开启您的创意宇宙..."
            className="w-full bg-black/60 backdrop-blur-xl border border-cyan-400/30 rounded-lg text-white p-3 pr-24 pl-12 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-500 transition-all shadow-lg"
            rows={1}
            disabled={isLoading}
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center">
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
            />
            <button type="button" onClick={handleUploadClick} disabled={isLoading} className="text-gray-400 hover:text-cyan-400 transition-colors">
                <UploadIcon className="w-6 h-6" />
            </button>
          </div>
          <button
            type="submit"
            disabled={isLoading || (!prompt.trim() && !file)}
            className="absolute right-3 top-1/2 -translate-y-1/2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-full p-2 text-white transition-colors"
          >
            {isLoading ? (
                <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"></div>
            ) : (
                <SendIcon className="w-5 h-5" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default InputBar;
