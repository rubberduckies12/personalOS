import React, { useEffect, useState } from 'react';

const API_URL = 'http://localhost:5001/api/goals';

const Goals = () => {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ title: '', description: '', category: 'personal', priority: 'medium' });
  const [editingGoal, setEditingGoal] = useState(null);

  // Fetch all goals
  const fetchGoals = async () => {
    setLoading(true);
    const res = await fetch(API_URL, {
      headers: { 'user-id': localStorage.getItem('userId') }
    });
    const data = await res.json();
    setGoals(data.goals || []);
    setLoading(false);
  };

  useEffect(() => { fetchGoals(); }, []);

  // Create or update goal
  const handleSubmit = async (e) => {
    e.preventDefault();
    const method = editingGoal ? 'PUT' : 'POST';
    const url = editingGoal ? `${API_URL}/${editingGoal._id}` : API_URL;
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'user-id': localStorage.getItem('userId') },
      body: JSON.stringify(form)
    });
    setForm({ title: '', description: '', category: 'personal', priority: 'medium' });
    setEditingGoal(null);
    fetchGoals();
  };

  // Delete goal
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return;
    await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: { 'user-id': localStorage.getItem('userId') }
    });
    fetchGoals();
  };

  // Mark as achieved
  const handleAchieve = async (goal) => {
    await fetch(`${API_URL}/${goal._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'user-id': localStorage.getItem('userId') },
      body: JSON.stringify({ status: 'achieved' })
    });
    fetchGoals();
  };

  return (
    <div>
      <h2>Goals</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Title"
          value={form.title}
          onChange={e => setForm({ ...form, title: e.target.value })}
          required
        />
        <input
          placeholder="Description"
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
        />
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
          <option value="personal">Personal</option>
          <option value="financial">Financial</option>
          <option value="health">Health</option>
          <option value="business">Business</option>
          <option value="education">Education</option>
          <option value="awards">Awards</option>
          <option value="career">Career</option>
          <option value="relationships">Relationships</option>
          <option value="travel">Travel</option>
          <option value="hobbies">Hobbies</option>
          <option value="spiritual">Spiritual</option>
          <option value="other">Other</option>
        </select>
        <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        <button type="submit">{editingGoal ? 'Update' : 'Add'} Goal</button>
        {editingGoal && <button onClick={() => { setEditingGoal(null); setForm({ title: '', description: '', category: 'personal', priority: 'medium' }); }}>Cancel</button>}
      </form>
      {loading ? <p>Loading...</p> : (
        <ul>
          {goals.map(goal => (
            <li key={goal._id}>
              <strong>{goal.title}</strong> ({goal.category}) - {goal.status}
              <button onClick={() => { setEditingGoal(goal); setForm(goal); }}>Edit</button>
              <button onClick={() => handleDelete(goal._id)}>Delete</button>
              {goal.status !== 'achieved' && <button onClick={() => handleAchieve(goal)}>Mark as Achieved</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default Goals;