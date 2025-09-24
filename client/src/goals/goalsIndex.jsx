import React, { useState } from 'react';
import Goals from './goals';
import Progress from './progress';
import Overview from './overview';

const tabs = [
  { id: 'goals', label: 'Goals' },
  { id: 'progress', label: 'Progress' },
  { id: 'overview', label: 'Overview' }
];

const GoalsIndex = () => {
  const [activeTab, setActiveTab] = useState('goals');

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Goals</h1>
      <div className="flex space-x-4 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`px-4 py-2 rounded ${activeTab === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow-sm p-6">
        {activeTab === 'goals' && <Goals />}
        {activeTab === 'progress' && <Progress />}
        {activeTab === 'overview' && <Overview />}
      </div>
    </main>
  );
};

export default GoalsIndex;