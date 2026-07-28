import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  onClose: () => void;
}

export const MasterUploadModal: React.FC<Props> = ({ onClose }) => {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePasscodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcode === '3579') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect passcode.');
      setPasscode('');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);

    const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? '' : 'https://carrier-allocation-dashboard.azurewebsites.net');

    try {
      const response = await fetch(`${API_BASE}/api/upload-master`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setUploadSuccess(true);
      } else {
        setError(data.message || 'Failed to upload file.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md"
      >
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-display text-white mb-2">Master File Portal</h2>
          <p className="text-slate-400 text-sm">Secure upload access for Compass Master Data.</p>
        </div>

        <AnimatePresence mode="wait">
          {!isAuthenticated ? (
            <motion.form 
              key="passcode"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              onSubmit={handlePasscodeSubmit}
              className="flex flex-col gap-4"
            >
              <div className="relative">
                <input
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Enter Passcode"
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-center text-xl tracking-[0.5em] text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
                  autoFocus
                />
              </div>
              
              {error && <p className="text-rose-400 text-sm text-center font-medium">{error}</p>}

              <button
                type="submit"
                className="w-full py-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 font-bold tracking-widest uppercase rounded-xl transition-all"
              >
                Authenticate
              </button>
            </motion.form>
          ) : uploadSuccess ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              </div>
              <h3 className="text-xl font-bold text-white">Upload Successful</h3>
              <p className="text-slate-400 text-sm mb-4">
                The Master Data file has been securely written to Azure Blob Storage.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold tracking-widest uppercase rounded-xl transition-all"
              >
                Close & Click Sync
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-6"
            >
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/50 bg-slate-800/30 hover:bg-slate-800/50 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group"
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                />
                <svg className="w-10 h-10 text-slate-500 group-hover:text-cyan-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                <div className="text-center">
                  <p className="text-slate-300 font-medium mb-1">
                    {file ? file.name : 'Click to select Master File'}
                  </p>
                  <p className="text-slate-500 text-xs">
                    {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'Supports .xlsx format'}
                  </p>
                </div>
              </div>

              {error && <p className="text-rose-400 text-sm text-center font-medium bg-rose-500/10 py-2 rounded-lg">{error}</p>}

              <button
                onClick={handleUpload}
                disabled={!file || isUploading}
                className="w-full flex items-center justify-center gap-2 py-3 bg-cyan-500 hover:bg-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold tracking-widest uppercase rounded-xl transition-all"
              >
                {isUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    Uploading...
                  </>
                ) : (
                  'Upload to Azure'
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
