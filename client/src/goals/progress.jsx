import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  XMarkIcon,
  EyeIcon,
  PencilIcon,
  ArrowLeftIcon,
  TrophyIcon,
  FlagIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';

const Progress = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [goals, setGoals] = useState([]);
  const [filteredGoals, setFilteredGoals] = useState([]);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all'
  });
  
  // Modal states
  const [showStepModal, setShowStepModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepDescription, setStepDescription] = useState('');

  const categories = ['financial', 'health', 'personal', 'business', 'education', 'awards', 'career', 'relationships', 'travel', 'hobbies', 'spiritual', 'other'];
  const statuses = ['not_started', 'in_progress', 'achieved'];

  // Status info helper
  const getStatusInfo = (status) => {
    const statusInfo = {
      not_started: { color: 'gray', label: 'Not Started', icon: ClockIcon },
      in_progress: { color: 'blue', label: 'In Progress', icon: PlayIcon },
      achieved: { color: 'green', label: 'Achieved', icon: CheckCircleIcon }
    };
    return statusInfo[status] || statusInfo.not_started;
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
        limit: '100'
      });

      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters.category !== 'all') {
        params.append('category', filters.category);
      }

      const response = await fetch(`http://localhost:5001/api/goals?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (response.ok) {
        const data = await response.json();
        const goalsWithRoadmaps = (data.goals || []).filter(goal => goal.roadmap && goal.roadmap.length > 0);
        setGoals(goalsWithRoadmaps);
        setFilteredGoals(goalsWithRoadmaps);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading goals data:', error);
      setLoading(false);
    }
  };

  // Filter goals based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredGoals(goals);
    } else {
      const filtered = goals.filter(goal =>
        goal.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        goal.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        goal.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (goal.tags && goal.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      setFilteredGoals(filtered);
    }
  }, [searchTerm, goals]);

  // Mark roadmap step as complete
  const handleCompleteStep = async (goalId, stepIndex, description) => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/goals/${goalId}/roadmap/${stepIndex}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          completed: true,
          notes: description
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the selected goal in state
        const updatedGoals = goals.map(goal => 
          goal._id === goalId ? data.goal : goal
        );
        setGoals(updatedGoals);
        setFilteredGoals(updatedGoals.filter(goal => goal.roadmap && goal.roadmap.length > 0));
        
        // Update selected goal if it's the same one
        if (selectedGoal && selectedGoal._id === goalId) {
          setSelectedGoal(data.goal);
        }
        
        setShowStepModal(false);
        setSelectedStep(null);
        setStepDescription('');
        
        // Show success message with status info if provided
        if (data.message) {
          // You could implement a toast notification here
          console.log('✅ ' + data.message);
          
          // Simple alert for now - you might want to replace with a proper toast
          if (data.message.includes('achieved') || data.message.includes('in progress')) {
            alert(data.message);
          }
        }
        
        console.log('✅ Roadmap step completed successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to complete step');
      }
    } catch (error) {
      console.error('Error completing step:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open step completion modal
  const openStepModal = (step, stepIndex) => {
    setSelectedStep({ ...step, index: stepIndex });
    setStepDescription(step.description || '');
    setShowStepModal(true);
  };

  // Calculate roadmap progress
  const calculateRoadmapProgress = (roadmap) => {
    if (!roadmap || roadmap.length === 0) return 0;
    const completed = roadmap.filter(step => step.completed).length;
    return Math.round((completed / roadmap.length) * 100);
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

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header with Search */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Roadmap Progress</h2>
              <p className="text-gray-600">Track and complete roadmap steps for your goals</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 lg:w-96">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search goals..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Statuses</option>
              {statuses.map(status => (
                <option key={status} value={status}>
                  {status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1)}
                </option>
              ))}
            </select>

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

            <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg">
              <FlagIcon className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {filteredGoals.length} goal{filteredGoals.length !== 1 ? 's' : ''} with roadmaps
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Goals List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Goals with Roadmaps</h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredGoals.map(goal => {
                const statusInfo = getStatusInfo(goal.status);
                const StatusIcon = statusInfo.icon;
                const progress = calculateRoadmapProgress(goal.roadmap);
                const completedSteps = goal.roadmap.filter(step => step.completed).length;
                const totalSteps = goal.roadmap.length;

                return (
                  <div
                    key={goal._id}
                    onClick={() => setSelectedGoal(goal)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedGoal && selectedGoal._id === goal._id ? 'bg-blue-50 border-r-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">{goal.title}</h4>
                        <p className="text-sm text-gray-600 line-clamp-2">{goal.description}</p>
                      </div>
                      <div className="ml-3 flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {goal.category}
                        </span>
                        <div className="flex items-center text-gray-500 text-sm">
                          <FlagIcon className="w-4 h-4 mr-1" />
                          <span>{completedSteps}/{totalSteps} steps</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{progress}%</div>
                        <div className="w-20 bg-gray-200 rounded-full h-1.5 mt-1">
                          <div 
                            className={`bg-${statusInfo.color}-500 h-1.5 rounded-full transition-all duration-300`}
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredGoals.length === 0 && (
                <div className="p-12 text-center">
                  <FlagIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No roadmaps found</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try adjusting your search terms' : 'Create goals with roadmaps to track your progress'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Selected Goal Roadmap */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedGoal ? 'Roadmap Steps' : 'Select a Goal'}
                </h3>
                {selectedGoal && (
                  <button
                    onClick={() => setSelectedGoal(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <ArrowLeftIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {selectedGoal ? (
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">{selectedGoal.title}</h4>
                    <p className="text-gray-600 mb-4">{selectedGoal.description}</p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                          {selectedGoal.category}
                        </span>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                          {selectedGoal.priority} priority
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600">
                          {calculateRoadmapProgress(selectedGoal.roadmap)}%
                        </div>
                        <div className="text-sm text-gray-500">Complete</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-lg font-medium text-gray-900 mb-4">Roadmap Steps</h5>
                    {selectedGoal.roadmap.map((step, index) => (
                      <div
                        key={index}
                        className={`p-4 border rounded-lg transition-colors ${
                          step.completed 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3 flex-1">
                            <div className="mt-1">
                              {step.completed ? (
                                <CheckCircleIcon className="w-6 h-6 text-green-500" />
                              ) : (
                                <ClockIcon className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h6 className={`font-medium ${step.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                                  {step.step}
                                </h6>
                                {/* Show step number and special indicators */}
                                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                  Step {index + 1}
                                </span>
                                {index === 0 && step.completed && selectedGoal.status === 'in_progress' && (
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                    🚀 Started Goal
                                  </span>
                                )}
                                {step.completed && index === selectedGoal.roadmap.length - 1 && selectedGoal.status === 'achieved' && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                                    🎉 Goal Complete!
                                  </span>
                                )}
                              </div>
                              {step.description && (
                                <p className={`mt-2 text-sm ${step.completed ? 'text-green-700' : 'text-gray-600'}`}>
                                  {step.description}
                                </p>
                              )}
                              {step.completedAt && (
                                <p className="mt-2 text-xs text-green-600">
                                  Completed on {new Date(step.completedAt).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {!step.completed && (
                            <button
                              onClick={() => openStepModal(step, index)}
                              className="ml-3 px-3 py-1 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 transition-colors"
                            >
                              Complete
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <TrophyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Goal</h3>
                  <p className="text-gray-600">Choose a goal from the list to view and manage its roadmap steps</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step Completion Modal */}
      {showStepModal && selectedStep && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Complete Roadmap Step</h3>
                <button
                  onClick={() => { setShowStepModal(false); setSelectedStep(null); setStepDescription(''); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-blue-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-blue-900 mb-2">Step to Complete:</h4>
                  <p className="text-blue-800">{selectedStep.step}</p>
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (stepDescription.trim().split(/\s+/).length < 200) {
                  alert('Please provide at least 200 words describing how you achieved this step.');
                  return;
                }
                handleCompleteStep(selectedGoal._id, selectedStep.index, stepDescription);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Describe how you achieved this step
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    value={stepDescription}
                    onChange={(e) => setStepDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="8"
                    placeholder="Provide a detailed description of how you completed this step. Include specific actions taken, challenges overcome, resources used, and outcomes achieved. Minimum 200 words required."
                    required
                  />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className={`${
                      stepDescription.trim().split(/\s+/).length >= 200 
                        ? 'text-green-600' 
                        : stepDescription.trim().split(/\s+/).filter(word => word.length > 0).length >= 150
                        ? 'text-orange-600'
                        : 'text-red-600'
                    }`}>
                      {stepDescription.trim() ? stepDescription.trim().split(/\s+/).filter(word => word.length > 0).length : 0} words
                      {stepDescription.trim().split(/\s+/).filter(word => word.length > 0).length >= 200 && ' ✓'}
                    </span>
                    <span className="text-gray-500">Minimum 200 words required</span>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowStepModal(false); setSelectedStep(null); setStepDescription(''); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || stepDescription.trim().split(/\s+/).filter(word => word.length > 0).length < 200}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Completing...' : 'Mark as Completed'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default Progress;