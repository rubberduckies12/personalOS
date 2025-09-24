import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:5001/api/goals';

const Progress = () => {
  const [goals, setGoals] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState('');
  const [progress, setProgress] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(API_URL, { headers: { 'user-id': localStorage.getItem('userId') } })
      .then(res => res.json())
      .then(data => setGoals(data.goals || []));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedGoal) return;
    await fetch(`${API_URL}/${selectedGoal}/progress`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'user-id': localStorage.getItem('userId') },
      body: JSON.stringify({ currentValue: progress })
    });
    setMessage('Progress updated!');
    setProgress('');
  };

  return (
    <div>
      <h2>Log Progress</h2>
      <form onSubmit={handleSubmit}>
        <select value={selectedGoal} onChange={e => setSelectedGoal(e.target.value)}>
          <option value="">Select Goal</option>
          {goals.map(goal => (
            <option key={goal._id} value={goal._id}>{goal.title}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Progress value"
          value={progress}
          onChange={e => setProgress(e.target.value)}
        />
        <button type="submit">Log Progress</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Progress;