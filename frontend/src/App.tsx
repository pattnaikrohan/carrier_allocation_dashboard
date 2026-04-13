import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ContractDashboard from './pages/ContractDashboard';
import ContractDataExplorer from './pages/ContractDataExplorer';
import ProcurementDashboard from './pages/ProcurementDashboard';
import './index.css';

function App() {
  return (
    <Router>
      <div className="min-h-screen relative overflow-x-hidden">
        {/* Global Aurora Background */}
        <div className="bg-aurora-blobs pointer-events-none">
          <div className="blob blob-1" />
          <div className="blob blob-2" />
          <div className="blob blob-3" />
        </div>

        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/contract" element={<ContractDashboard />} />
          <Route path="/contract/explorer" element={<ContractDataExplorer />} />
          <Route path="/procurement" element={<ProcurementDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
