import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:5001/api/goals';

const Overview = () => {
  const [goals, setGoals] = useState([]);

  useEffect(() => {
    fetch(API_URL, { headers: { 'user-id': localStorage.getItem('userId') } })
      .then(res => res.json())
      .then(data => setGoals(data.goals || []));
  }, []);

  return (
    <div>
      <h2>Goals Overview</h2>
      <ul>
        {goals.map(goal => (
          <li key={goal._id}>
            <strong>{goal.title}</strong> ({goal.category})<br />
            Status: {goal.status} | Progress: {goal.progress || 0}%
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Overview;