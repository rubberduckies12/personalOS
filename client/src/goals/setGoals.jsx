import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  TrophyIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  CalendarIcon,
  TagIcon,
  FlagIcon
} from '@heroicons/react/24/outline';

const SetGoals = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);
  const [filters, setFilters] = useState({
    category: 'all',
    priority: 'all'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [viewingGoal, setViewingGoal] = useState(null);
  const [draggedGoal, setDraggedGoal] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    targetDate: '',
    tags: '',
    roadmap: ''
  });

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    targetDate: '',
    tags: '',
    roadmap: ''
  });

  // Schema-based categories and priorities
  const categories = [
    'financial', 'health', 'personal', 'business', 
    'education', 'awards', 'career', 'relationships', 
    'travel', 'hobbies', 'spiritual', 'other'
  ];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['not_started', 'in_progress', 'achieved'];

  // Status columns configuration
  const statusColumns = {
    not_started: {
      title: 'Not Started',
      icon: ClockIcon,
      color: 'gray',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    },
    in_progress: {
      title: 'In Progress',
      icon: PlayIcon,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    achieved: {
      title: 'Achieved',
      icon: CheckCircleIcon,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    }
  };

  // Get priority info
  const getPriorityInfo = (priority) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      critical: 'bg-red-100 text-red-600'
    };
    return priorityColors[priority] || priorityColors.medium;
  };

  // Reset forms
  const resetForms = () => {
    setCreateForm({
      title: '',
      description: '',
      category: 'personal',
      priority: 'medium',
      targetDate: '',
      tags: '',
      roadmap: ''
    });
    setEditForm({
      title: '',
      description: '',
      category: 'personal',
      priority: 'medium',
      targetDate: '',
      tags: '',
      roadmap: ''
    });
  };

  // Load goals data
  const loadGoalsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
    
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const params = new URLSearchParams({
        limit: '50'
      });

      if (filters.category !== 'all') {
        params.append('category', filters.category);
      }
      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }

      const response = await fetch(`http://localhost:5001/api/goals?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGoals(data.goals || []);
      } else if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
      } else {
        console.error('Failed to load goals');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading goals:', error);
      setLoading(false);
    }
  };

  // Create goal
  const handleCreateGoal = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      // Parse roadmap steps
      const roadmapSteps = createForm.roadmap
        .split('\n')
        .map(step => step.trim())
        .filter(step => step)
        .map((step, index) => ({
          step,
          description: '',
          completed: false,
          order: index + 1
        }));

      const goalData = {
        title: createForm.title,
        description: createForm.description,
        category: createForm.category,
        priority: createForm.priority,
        targetDate: createForm.targetDate || undefined,
        tags: createForm.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag),
        roadmap: roadmapSteps
      };

      const response = await fetch('http://localhost:5001/api/goals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(goalData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForms();
        loadGoalsData();
        console.log('✅ Goal created successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create goal');
      }
    } catch (error) {
      console.error('Error creating goal:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update goal status (for drag and drop)
  const updateGoalStatus = async (goalId, newStatus) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`http://localhost:5001/api/goals/${goalId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        loadGoalsData();
        console.log(`✅ Goal status updated to ${newStatus}`);
      } else {
        console.error('Failed to update goal status');
        loadGoalsData(); // Reload to reset UI
      }
    } catch (error) {
      console.error('Error updating goal status:', error);
      loadGoalsData(); // Reload to reset UI
    }
  };

  // Edit goal
  const handleEditGoal = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      // Parse roadmap steps
      const roadmapSteps = editForm.roadmap
        .split('\n')
        .map(step => step.trim())
        .filter(step => step)
        .map((step, index) => ({
          step,
          description: '',
          completed: false,
          order: index + 1
        }));

      const goalData = {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        priority: editForm.priority,
        targetDate: editForm.targetDate || undefined,
        tags: editForm.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag),
        roadmap: roadmapSteps
      };

      const response = await fetch(`http://localhost:5001/api/goals/${editingGoal._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(goalData)
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingGoal(null);
        resetForms();
        loadGoalsData();
        console.log('✅ Goal updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update goal');
      }
    } catch (error) {
      console.error('Error updating goal:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete goal
  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Are you sure you want to delete this goal? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/goals/${goalId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadGoalsData();
        console.log('✅ Goal deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete goal');
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Network error. Please try again.');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, goal) => {
    setDraggedGoal(goal);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (draggedGoal && draggedGoal.status !== newStatus) {
      updateGoalStatus(draggedGoal._id, newStatus);
    }
    setDraggedGoal(null);
  };

  // Open modals
  const openEditModal = (goal) => {
    setEditingGoal(goal);
    setEditForm({
      title: goal.title,
      description: goal.description,
      category: goal.category,
      priority: goal.priority,
      targetDate: goal.targetDate ? new Date(goal.targetDate).toISOString().split('T')[0] : '',
      tags: goal.tags ? goal.tags.join(', ') : '',
      roadmap: goal.roadmap ? goal.roadmap.map(step => step.step).join('\n') : ''
    });
    setShowEditModal(true);
  };

  const openViewModal = (goal) => {
    setViewingGoal(goal);
    setShowViewModal(true);
  };

  // Group goals by status
  const goalsByStatus = goals.reduce((acc, goal) => {
    const status = goal.status || 'not_started';
    if (!acc[status]) acc[status] = [];
    acc[status].push(goal);
    return acc;
  }, {});

  // Calculate totals
  const calculateTotals = () => {
    const total = goals.length;
    const achieved = goals.filter(goal => goal.status === 'achieved').length;
    const inProgress = goals.filter(goal => goal.status === 'in_progress').length;
    const notStarted = goals.filter(goal => goal.status === 'not_started').length;

    return { total, achieved, inProgress, notStarted };
  };

  useEffect(() => {
    loadGoalsData();
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const totals = calculateTotals();

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <TrophyIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Goals</h3>
            <p className="text-3xl font-bold text-blue-600">{totals.total}</p>
            <div className="mt-3 text-sm text-gray-600">All your goals</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-gray-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Not Started</h3>
            <p className="text-3xl font-bold text-gray-600">{totals.notStarted}</p>
            <div className="mt-3 text-sm text-gray-600">Ready to begin</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                <PlayIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">In Progress</h3>
            <p className="text-3xl font-bold text-orange-600">{totals.inProgress}</p>
            <div className="mt-3 text-sm text-gray-600">Active goals</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Achieved</h3>
            <p className="text-3xl font-bold text-green-600">{totals.achieved}</p>
            <div className="mt-3 text-sm text-gray-600">Completed goals</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4">
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
              
              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Priorities</option>
                {priorities.map(priority => (
                  <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Goal</span>
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {statuses.map(status => {
            const column = statusColumns[status];
            const Icon = column.icon;
            const statusGoals = goalsByStatus[status] || [];

            return (
              <div
                key={status}
                className={`${column.bgColor} rounded-xl shadow-sm min-h-96`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, status)}
              >
                <div className={`p-4 border-b ${column.borderColor} bg-white rounded-t-xl`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className={`w-5 h-5 text-${column.color}-600`} />
                      <h3 className="text-lg font-semibold text-gray-900">{column.title}</h3>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-sm font-medium bg-${column.color}-100 text-${column.color}-600`}>
                      {statusGoals.length}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {statusGoals.map(goal => (
                    <div
                      key={goal._id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, goal)}
                      className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900 mb-1">{goal.title}</h4>
                          <p className="text-sm text-gray-600 line-clamp-2">{goal.description}</p>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <button 
                            onClick={() => openViewModal(goal)}
                            className="p-1 text-gray-400 hover:text-blue-600"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => openEditModal(goal)}
                            className="p-1 text-gray-400 hover:text-emerald-600"
                          >
                            <PencilIcon className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteGoal(goal._id)}
                            className="p-1 text-gray-400 hover:text-red-600"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityInfo(goal.priority)}`}>
                            {goal.priority}
                          </span>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            {goal.category}
                          </span>
                        </div>
                        {goal.targetDate && (
                          <div className="flex items-center text-gray-500">
                            <CalendarIcon className="w-3 h-3 mr-1" />
                            <span className="text-xs">
                              {new Date(goal.targetDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}
                      </div>

                      {goal.roadmap && goal.roadmap.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xs text-gray-500 mb-1">Roadmap Progress</div>
                          <div className="flex items-center space-x-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                                style={{ 
                                  width: `${goal.roadmapProgress || 0}%` 
                                }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {goal.roadmap.filter(step => step.completed).length}/{goal.roadmap.length}
                            </span>
                          </div>
                        </div>
                      )}

                      {goal.tags && goal.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {goal.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
                              #{tag}
                            </span>
                          ))}
                          {goal.tags.length > 3 && (
                            <span className="text-xs text-gray-500">+{goal.tags.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {statusGoals.length === 0 && (
                    <div className="text-center py-8">
                      <Icon className={`w-12 h-12 text-${column.color}-300 mx-auto mb-2`} />
                      <p className="text-sm text-gray-500">No goals in this status</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Create New Goal</h3>
                <button
                  onClick={() => { setShowCreateModal(false); resetForms(); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateGoal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Learn Spanish fluently"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    placeholder="Describe your goal in detail..."
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={createForm.priority}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {priorities.map(priority => (
                        <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={createForm.targetDate}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, targetDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (Optional)</label>
                  <input
                    type="text"
                    value={createForm.tags}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="language, skill, 2024 (comma separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Roadmap Steps (Optional)</label>
                  <textarea
                    value={createForm.roadmap}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, roadmap: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="Enter each step on a new line:&#10;Complete Spanish course&#10;Practice with native speaker&#10;Take proficiency test"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowCreateModal(false); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Goal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Goal</h3>
                <button
                  onClick={() => { setShowEditModal(false); setEditingGoal(null); resetForms(); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditGoal} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Goal Title</label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                    <select
                      value={editForm.priority}
                      onChange={(e) => setEditForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {priorities.map(priority => (
                        <option key={priority} value={priority}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Target Date (Optional)</label>
                  <input
                    type="date"
                    value={editForm.targetDate}
                    onChange={(e) => setEditForm(prev => ({ ...prev, targetDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (Optional)</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="language, skill, 2024 (comma separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Roadmap Steps (Optional)</label>
                  <textarea
                    value={editForm.roadmap}
                    onChange={(e) => setEditForm(prev => ({ ...prev, roadmap: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="Enter each step on a new line"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingGoal(null); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Goal'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingGoal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Goal Details</h3>
                <button
                  onClick={() => { setShowViewModal(false); setViewingGoal(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{viewingGoal.title}</h4>
                  <p className="text-gray-600 mt-2">{viewingGoal.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Category</label>
                    <p className="text-gray-900 capitalize">{viewingGoal.category}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Priority</label>
                    <p className="text-gray-900 capitalize">{viewingGoal.priority}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500">Status</label>
                  <p className="text-gray-900 capitalize">{viewingGoal.status.replace('_', ' ')}</p>
                </div>

                {viewingGoal.targetDate && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Target Date</label>
                    <p className="text-gray-900">{new Date(viewingGoal.targetDate).toLocaleDateString()}</p>
                  </div>
                )}

                {viewingGoal.roadmap && viewingGoal.roadmap.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Roadmap</label>
                    <div className="mt-2 space-y-2">
                      {viewingGoal.roadmap.map((step, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircleIcon 
                            className={`w-4 h-4 ${step.completed ? 'text-green-500' : 'text-gray-300'}`} 
                          />
                          <span className={step.completed ? 'line-through text-gray-500' : 'text-gray-900'}>
                            {step.step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewingGoal.tags && viewingGoal.tags.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Tags</label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {viewingGoal.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-gray-900">{new Date(viewingGoal.createdAt).toLocaleDateString()}</p>
                  </div>
                  {viewingGoal.achievedAt && (
                    <div>
                      <label className="text-sm font-medium text-gray-500">Achieved</label>
                      <p className="text-gray-900">{new Date(viewingGoal.achievedAt).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3 pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowViewModal(false); openEditModal(viewingGoal); }}
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center space-x-2"
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={() => { setShowViewModal(false); setViewingGoal(null); }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default SetGoals;