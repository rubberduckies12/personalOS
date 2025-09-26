import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon,
  EyeIcon,
  PencilIcon,
  ArrowLeftIcon,
  TrophyIcon,
  FlagIcon,
  DocumentTextIcon,
  CubeIcon,
  BoltIcon,
  CalendarIcon,
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';

const SetProgress = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    priority: 'all'
  });
  
  // Modal states
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [milestoneNotes, setMilestoneNotes] = useState('');
  const [actualHours, setActualHours] = useState('');

  const categories = ['personal', 'work', 'business', 'education', 'research', 'creative', 'technical', 'health', 'home', 'travel', 'other'];
  const statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
  const priorities = ['low', 'medium', 'high', 'critical'];

  // Status info helper
  const getStatusInfo = (status) => {
    const statusInfo = {
      planning: { color: 'gray', label: 'Planning', icon: ClipboardDocumentListIcon },
      active: { color: 'blue', label: 'Active', icon: PlayIcon },
      on_hold: { color: 'yellow', label: 'On Hold', icon: PauseIcon },
      completed: { color: 'green', label: 'Completed', icon: CheckCircleIcon },
      cancelled: { color: 'red', label: 'Cancelled', icon: XMarkIcon }
    };
    return statusInfo[status] || statusInfo.planning;
  };

  // Priority info helper
  const getPriorityInfo = (priority) => {
    const priorityColors = {
      low: 'bg-gray-100 text-gray-600',
      medium: 'bg-blue-100 text-blue-600',
      high: 'bg-orange-100 text-orange-600',
      critical: 'bg-red-100 text-red-600'
    };
    return priorityColors[priority] || priorityColors.medium;
  };

  // Load projects data
  const loadProjectsData = async () => {
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
      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }

      const response = await fetch(`http://localhost:5001/api/projects?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-ID': localStorage.getItem('userId') || '',
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
        const projectsWithMilestones = (data.projects || []).filter(project => project.milestones && project.milestones.length > 0);
        setProjects(projectsWithMilestones);
        setFilteredProjects(projectsWithMilestones);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading projects data:', error);
      setLoading(false);
    }
  };

  // Filter projects based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredProjects(projects);
    } else {
      const filtered = projects.filter(project =>
        project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (project.tags && project.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
      );
      setFilteredProjects(filtered);
    }
  }, [searchTerm, projects]);

  // Load specific project with full details
  const loadProjectDetails = async (projectId) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-ID': localStorage.getItem('userId') || '',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const projectData = await response.json();
        setSelectedProject(projectData);
      } else {
        console.error('Failed to load project details');
      }
    } catch (error) {
      console.error('Error loading project details:', error);
    }
  };

  // Mark milestone as complete
  const handleCompleteMilestone = async (projectId, milestoneIndex, notes, hours) => {
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      // Get the current project
      const currentProject = selectedProject;
      const updatedMilestones = [...currentProject.milestones];
      
      // Update the specific milestone
      updatedMilestones[milestoneIndex] = {
        ...updatedMilestones[milestoneIndex],
        completed: true,
        completedAt: new Date().toISOString(),
        actualHours: parseFloat(hours) || updatedMilestones[milestoneIndex].actualHours || 0,
        notes: updatedMilestones[milestoneIndex].notes || []
      };

      // Add the completion note
      if (notes.trim()) {
        updatedMilestones[milestoneIndex].notes.push({
          content: notes.trim(),
          createdAt: new Date().toISOString()
        });
      }

      const response = await fetch(`http://localhost:5001/api/projects/${projectId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'User-ID': localStorage.getItem('userId') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          milestones: updatedMilestones
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the projects in state
        const updatedProjects = projects.map(project => 
          project._id === projectId ? data : project
        );
        setProjects(updatedProjects);
        setFilteredProjects(updatedProjects.filter(project => project.milestones && project.milestones.length > 0));
        
        // Update selected project
        setSelectedProject(data);
        
        setShowMilestoneModal(false);
        setSelectedMilestone(null);
        setMilestoneNotes('');
        setActualHours('');
        
        console.log('✅ Milestone completed successfully');
        
        // Show success message based on project completion
        const completedMilestones = data.milestones.filter(m => m.completed).length;
        const totalMilestones = data.milestones.length;
        
        if (completedMilestones === totalMilestones) {
          alert('🎉 Congratulations! All milestones completed. Project is ready for completion!');
        } else {
          alert(`✅ Milestone completed! ${completedMilestones}/${totalMilestones} milestones done.`);
        }
        
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to complete milestone');
      }
    } catch (error) {
      console.error('Error completing milestone:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open milestone completion modal
  const openMilestoneModal = (milestone, milestoneIndex) => {
    setSelectedMilestone({ ...milestone, index: milestoneIndex });
    setMilestoneNotes('');
    setActualHours(milestone.estimatedHours?.toString() || '');
    setShowMilestoneModal(true);
  };

  // Open milestone notes modal
  const openNotesModal = (milestone) => {
    setSelectedMilestone(milestone);
    setShowNotesModal(true);
  };

  // Calculate project progress
  const calculateProjectProgress = (milestones) => {
    if (!milestones || milestones.length === 0) return 0;
    const completed = milestones.filter(milestone => milestone.completed).length;
    return Math.round((completed / milestones.length) * 100);
  };

  // Check if milestone is overdue
  const isMilestoneOverdue = (milestone) => {
    if (!milestone.dueDate || milestone.completed) return false;
    return new Date(milestone.dueDate) < new Date();
  };

  // Get milestone status color
  const getMilestoneStatusColor = (milestone) => {
    if (milestone.completed) return 'green';
    if (isMilestoneOverdue(milestone)) return 'red';
    if (milestone.dueDate) {
      const daysUntilDue = Math.ceil((new Date(milestone.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue <= 3) return 'orange';
    }
    return 'blue';
  };

  useEffect(() => {
    loadProjectsData();
  }, [filters]);

  // Auto-select first project when data loads
  useEffect(() => {
    if (filteredProjects.length > 0 && !selectedProject) {
      loadProjectDetails(filteredProjects[0]._id);
    }
  }, [filteredProjects]);

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
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Project Milestones</h2>
              <p className="text-gray-600">Track and complete milestones for your projects</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 lg:w-96">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search projects..."
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

            <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 rounded-lg">
              <FlagIcon className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} with milestones
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Projects List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Projects with Milestones</h3>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredProjects.map(project => {
                const statusInfo = getStatusInfo(project.status);
                const StatusIcon = statusInfo.icon;
                const progress = calculateProjectProgress(project.milestones);
                const completedMilestones = project.milestones.filter(m => m.completed).length;
                const totalMilestones = project.milestones.length;
                const overdueMilestones = project.milestones.filter(m => isMilestoneOverdue(m)).length;

                return (
                  <div
                    key={project._id}
                    onClick={() => loadProjectDetails(project._id)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedProject && selectedProject._id === project._id ? 'bg-purple-50 border-r-4 border-purple-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h4 className="font-medium text-gray-900">{project.title}</h4>
                          {overdueMilestones > 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              {overdueMilestones} overdue
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                      </div>
                      <div className="ml-3 flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium text-${statusInfo.color}-600 bg-${statusInfo.color}-100`}>
                          {statusInfo.label}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                          {project.category}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getPriorityInfo(project.priority)}`}>
                          {project.priority}
                        </span>
                        <div className="flex items-center text-gray-500 text-sm">
                          <FlagIcon className="w-4 h-4 mr-1" />
                          <span>{completedMilestones}/{totalMilestones}</span>
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

                    {project.targetCompletionDate && (
                      <div className="mt-2 flex items-center text-xs text-gray-500">
                        <CalendarIcon className="w-3 h-3 mr-1" />
                        <span>Due: {new Date(project.targetCompletionDate).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredProjects.length === 0 && (
                <div className="p-12 text-center">
                  <CubeIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No milestones found</h3>
                  <p className="text-gray-600">
                    {searchTerm ? 'Try adjusting your search terms' : 'Create projects with milestones to track your progress'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Selected Project Milestones */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedProject ? 'Project Milestones' : 'Select a Project'}
                </h3>
                {selectedProject && (
                  <button
                    onClick={() => setSelectedProject(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <ArrowLeftIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {selectedProject ? (
                <div className="p-6">
                  <div className="mb-6">
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">{selectedProject.title}</h4>
                    <p className="text-gray-600 mb-4">{selectedProject.description}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                            {selectedProject.category}
                          </span>
                          <span className={`px-3 py-1 text-sm rounded-full ${getPriorityInfo(selectedProject.priority)}`}>
                            {selectedProject.priority}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-purple-600">
                            {calculateProjectProgress(selectedProject.milestones)}%
                          </div>
                          <div className="text-sm text-gray-500">Complete</div>
                        </div>
                      </div>
                    </div>

                    {/* Project Stats */}
                    <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-gray-900">
                          {selectedProject.milestones.filter(m => m.completed).length}
                        </div>
                        <div className="text-sm text-gray-500">Completed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-orange-600">
                          {selectedProject.milestones.filter(m => !m.completed && !isMilestoneOverdue(m)).length}
                        </div>
                        <div className="text-sm text-gray-500">Remaining</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-red-600">
                          {selectedProject.milestones.filter(m => isMilestoneOverdue(m)).length}
                        </div>
                        <div className="text-sm text-gray-500">Overdue</div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-lg font-medium text-gray-900 mb-4">Milestones</h5>
                    {selectedProject.milestones
                      .sort((a, b) => a.order - b.order)
                      .map((milestone, index) => {
                        const statusColor = getMilestoneStatusColor(milestone);
                        const isOverdue = isMilestoneOverdue(milestone);
                        
                        return (
                          <div
                            key={index}
                            className={`p-4 border rounded-lg transition-colors ${
                              milestone.completed 
                                ? 'bg-green-50 border-green-200' 
                                : isOverdue
                                ? 'bg-red-50 border-red-200'
                                : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1">
                                <div className="mt-1">
                                  {milestone.completed ? (
                                    <CheckCircleIcon className="w-6 h-6 text-green-500" />
                                  ) : isOverdue ? (
                                    <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                                  ) : (
                                    <ClockIcon className="w-6 h-6 text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-1">
                                    <h6 className={`font-medium ${milestone.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                                      {milestone.title}
                                    </h6>
                                    <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded-full">
                                      #{milestone.order}
                                    </span>
                                    {isOverdue && !milestone.completed && (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                                        Overdue
                                      </span>
                                    )}
                                  </div>
                                  
                                  {milestone.description && (
                                    <p className={`text-sm mb-2 ${milestone.completed ? 'text-green-700' : 'text-gray-600'}`}>
                                      {milestone.description}
                                    </p>
                                  )}
                                  
                                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                                    {milestone.dueDate && (
                                      <div className="flex items-center">
                                        <CalendarIcon className="w-4 h-4 mr-1" />
                                        <span className={isOverdue && !milestone.completed ? 'text-red-600' : ''}>
                                          {new Date(milestone.dueDate).toLocaleDateString()}
                                        </span>
                                      </div>
                                    )}
                                    
                                    {milestone.estimatedHours && (
                                      <div className="flex items-center">
                                        <ClockIcon className="w-4 h-4 mr-1" />
                                        <span>{milestone.estimatedHours}h estimated</span>
                                        {milestone.actualHours && (
                                          <span className="text-green-600"> • {milestone.actualHours}h actual</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {milestone.completedAt && (
                                    <p className="mt-2 text-xs text-green-600">
                                      Completed on {new Date(milestone.completedAt).toLocaleDateString()}
                                    </p>
                                  )}
                                  
                                  {milestone.dependencies && milestone.dependencies.length > 0 && (
                                    <div className="mt-2">
                                      <span className="text-xs text-gray-500">
                                        Depends on milestones: {milestone.dependencies.join(', ')}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="ml-3 flex items-center space-x-2">
                                {milestone.notes && milestone.notes.length > 0 && (
                                  <button
                                    onClick={() => openNotesModal(milestone)}
                                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                                    title="View notes"
                                  >
                                    <DocumentTextIcon className="w-4 h-4" />
                                  </button>
                                )}
                                
                                {!milestone.completed && (
                                  <button
                                    onClick={() => openMilestoneModal(milestone, index)}
                                    className="px-3 py-1 bg-purple-500 text-white text-sm rounded-md hover:bg-purple-600 transition-colors"
                                  >
                                    Complete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <TrophyIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Project</h3>
                  <p className="text-gray-600">Choose a project from the list to view and manage its milestones</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Milestone Completion Modal */}
      {showMilestoneModal && selectedMilestone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Complete Milestone</h3>
                <button
                  onClick={() => { 
                    setShowMilestoneModal(false); 
                    setSelectedMilestone(null); 
                    setMilestoneNotes(''); 
                    setActualHours('');
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6">
                <div className="bg-purple-50 p-4 rounded-lg mb-4">
                  <h4 className="font-medium text-purple-900 mb-2">Milestone to Complete:</h4>
                  <p className="text-purple-800 font-medium">{selectedMilestone.title}</p>
                  {selectedMilestone.description && (
                    <p className="text-purple-700 text-sm mt-1">{selectedMilestone.description}</p>
                  )}
                </div>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                if (milestoneNotes.trim().split(/\s+/).length < 100) {
                  alert('Please provide at least 100 words describing how you achieved this milestone.');
                  return;
                }
                handleCompleteMilestone(selectedProject._id, selectedMilestone.index, milestoneNotes, actualHours);
              }} className="space-y-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Hours Spent
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={actualHours}
                    onChange={(e) => setActualHours(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder={`Estimated: ${selectedMilestone.estimatedHours || 0} hours`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Completion Notes
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <textarea
                    value={milestoneNotes}
                    onChange={(e) => setMilestoneNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    rows="8"
                    placeholder="Describe how you completed this milestone. Include specific actions taken, challenges overcome, resources used, and outcomes achieved. Minimum 100 words required."
                    required
                  />
                  <div className="mt-2 flex justify-between text-sm">
                    <span className={`${
                      milestoneNotes.trim().split(/\s+/).length >= 100 
                        ? 'text-green-600' 
                        : milestoneNotes.trim().split(/\s+/).filter(word => word.length > 0).length >= 75
                        ? 'text-orange-600'
                        : 'text-red-600'
                    }`}>
                      {milestoneNotes.trim() ? milestoneNotes.trim().split(/\s+/).filter(word => word.length > 0).length : 0} words
                      {milestoneNotes.trim().split(/\s+/).filter(word => word.length > 0).length >= 100 && ' ✓'}
                    </span>
                    <span className="text-gray-500">Minimum 100 words required</span>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { 
                      setShowMilestoneModal(false); 
                      setSelectedMilestone(null); 
                      setMilestoneNotes(''); 
                      setActualHours('');
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || milestoneNotes.trim().split(/\s+/).filter(word => word.length > 0).length < 100}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Completing...' : 'Mark as Completed'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Milestone Notes Modal */}
      {showNotesModal && selectedMilestone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Milestone Notes</h3>
                <button
                  onClick={() => { setShowNotesModal(false); setSelectedMilestone(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    <h4 className="font-medium text-green-900">Completed Milestone</h4>
                  </div>
                  <p className="text-green-800 font-medium">{selectedMilestone.title}</p>
                  {selectedMilestone.completedAt && (
                    <p className="text-sm text-green-600 mt-1">
                      Completed on {new Date(selectedMilestone.completedAt).toLocaleDateString()}
                    </p>
                  )}
                  {selectedMilestone.actualHours && (
                    <p className="text-sm text-green-600 mt-1">
                      Time spent: {selectedMilestone.actualHours} hours
                    </p>
                  )}
                </div>

                {selectedMilestone.notes && selectedMilestone.notes.length > 0 && (
                  <div>
                    <h5 className="text-lg font-medium text-gray-900 mb-3">Notes:</h5>
                    <div className="space-y-3">
                      {selectedMilestone.notes.map((note, index) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {note.content}
                          </p>
                          <div className="mt-3 flex justify-between text-sm text-gray-500">
                            <span>{note.content.trim().split(/\s+/).length} words</span>
                            <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowNotesModal(false); setSelectedMilestone(null); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
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

export default SetProgress;