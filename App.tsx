import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dock from './components/Dock';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import ScenarioSelect from './pages/ScenarioSelect';
import CallRoom from './pages/CallRoom';
import FeedbackReport from './pages/FeedbackReport';
import Configuration from './pages/Configuration';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-obsidian text-slate-200 relative overflow-x-hidden">
        {/* Global Aurora Background */}
        <div className="bg-aurora-blobs pointer-events-none">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>

        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="*"
            element={
              <>
                <main className="min-h-screen w-full lg:px-8 px-4 pb-32 pt-8 relative z-10 transition-all duration-500 ease-in-out">
                  <Routes>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/scenarios" element={<ScenarioSelect />} />
                    <Route path="/call/:sessionId" element={<CallRoom />} />
                    <Route path="/feedback/:sessionId" element={<FeedbackReport />} />
                    <Route path="/settings" element={<Configuration />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </main>
                <Dock />
              </>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
