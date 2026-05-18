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
        <Routes>
          <Route path="/" element={<ContractDashboard />} />
          <Route path="/contract" element={<Navigate to="/" replace />} />
          <Route path="/contract/explorer" element={<ContractDataExplorer />} />
          <Route path="/procurement" element={<ProcurementDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
