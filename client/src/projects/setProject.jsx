import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusIcon,
  CubeIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  PlayIcon,
  PauseIcon,
  CalendarIcon,
  TagIcon,
  FlagIcon,
  ClipboardDocumentListIcon,
  BanknotesIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
  BuildingOffice2Icon,
  LinkIcon,
  XMarkIcon as UnlinkIcon,
  ArrowTopRightOnSquareIcon
} from '@heroicons/react/24/outline';

const SetProject = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState([]);
  const [filters, setFilters] = useState({
    category: 'all',
    priority: 'all',
    status: 'all'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showMilestoneModal, setShowMilestoneModal] = useState(false);
  const [showBusinessLinkModal, setShowBusinessLinkModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [viewingProject, setViewingProject] = useState(null);
  const [draggedProject, setDraggedProject] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [availableBusinesses, setAvailableBusinesses] = useState([]);
  const [linkedBusinesses, setLinkedBusinesses] = useState([]);

  // Form states
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    status: 'planning',
    startDate: '',
    targetCompletionDate: '',
    estimatedTotalHours: '',
    estimatedBudget: '',
    currency: 'GBP',
    tags: '',
    milestones: ''
  });

  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    category: 'personal',
    priority: 'medium',
    status: 'planning',
    startDate: '',
    targetCompletionDate: '',
    estimatedTotalHours: '',
    estimatedBudget: '',
    currency: 'GBP',
    tags: '',
    milestones: ''
  });

  const [businessLinkForm, setBusinessLinkForm] = useState({
    businessId: '',
    role: 'related',
    priority: 'medium',
    businessPhase: 'development',
    expectedImpact: 'medium'
  });

  // Schema-based options
  const categories = [
    'personal', 'work', 'business', 'education', 'research', 
    'creative', 'technical', 'health', 'home', 'travel', 'other'
  ];
  const priorities = ['low', 'medium', 'high', 'critical'];
  const statuses = ['planning', 'active', 'on_hold', 'completed', 'cancelled'];
  const currencies = ['GBP', 'USD', 'EUR', 'CAD', 'AUD'];

  // Status columns configuration
  const statusColumns = {
    planning: {
      title: 'Planning',
      icon: ClipboardDocumentListIcon,
      color: 'gray',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    },
    active: {
      title: 'Active',
      icon: PlayIcon,
      color: 'blue',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    on_hold: {
      title: 'On Hold',
      icon: PauseIcon,
      color: 'yellow',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200'
    },
    completed: {
      title: 'Completed',
      icon: CheckCircleIcon,
      color: 'green',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    cancelled: {
      title: 'Cancelled',
      icon: XMarkIcon,
      color: 'red',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
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
      status: 'planning',
      startDate: '',
      targetCompletionDate: '',
      estimatedTotalHours: '',
      estimatedBudget: '',
      currency: 'GBP',
      tags: '',
      milestones: ''
    });
    setEditForm({
      title: '',
      description: '',
      category: 'personal',
      priority: 'medium',
      status: 'planning',
      startDate: '',
      targetCompletionDate: '',
      estimatedTotalHours: '',
      estimatedBudget: '',
      currency: 'GBP',
      tags: '',
      milestones: ''
    });
    setBusinessLinkForm({
      businessId: '',
      role: 'related',
      priority: 'medium',
      businessPhase: 'development',
      expectedImpact: 'medium'
    });
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
        limit: '50'
      });

      if (filters.category !== 'all') {
        params.append('category', filters.category);
      }
      if (filters.priority !== 'all') {
        params.append('priority', filters.priority);
      }
      if (filters.status !== 'all') {
        params.append('status', filters.status);
      }

      const response = await fetch(`http://localhost:5001/api/projects?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      } else if (response.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
      } else {
        console.error('Failed to load projects');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading projects:', error);
      setLoading(false);
    }
  };

  // Create project
  const handleCreateProject = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      // Parse milestone steps
      const milestoneSteps = createForm.milestones
        .split('\n')
        .map(milestone => milestone.trim())
        .filter(milestone => milestone)
        .map((milestone, index) => ({
          title: milestone,
          description: '',
          completed: false,
          order: index + 1
        }));

      const projectData = {
        title: createForm.title,
        description: createForm.description,
        category: createForm.category,
        priority: createForm.priority,
        status: createForm.status,
        startDate: createForm.startDate || undefined,
        targetCompletionDate: createForm.targetCompletionDate || undefined,
        estimatedTotalHours: createForm.estimatedTotalHours ? Number(createForm.estimatedTotalHours) : undefined,
        budget: createForm.estimatedBudget ? {
          estimated: Number(createForm.estimatedBudget),
          currency: createForm.currency
        } : undefined,
        tags: createForm.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag),
        milestones: milestoneSteps
      };

      const response = await fetch('http://localhost:5001/api/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForms();
        loadProjectsData();
        console.log('✅ Project created successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Update project status (for drag and drop)
  const updateProjectStatus = async (projectId, newStatus) => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      const response = await fetch(`http://localhost:5001/api/projects/${projectId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        loadProjectsData();
        console.log(`✅ Project status updated to ${newStatus}`);
      } else {
        console.error('Failed to update project status');
        loadProjectsData(); // Reload to reset UI
      }
    } catch (error) {
      console.error('Error updating project status:', error);
      loadProjectsData(); // Reload to reset UI
    }
  };

  // Edit project
  const handleEditProject = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        navigate('/auth/login');
        return;
      }

      // Parse milestone steps
      const milestoneSteps = editForm.milestones
        .split('\n')
        .map(milestone => milestone.trim())
        .filter(milestone => milestone)
        .map((milestone, index) => ({
          title: milestone,
          description: '',
          completed: false,
          order: index + 1
        }));

      const projectData = {
        title: editForm.title,
        description: editForm.description,
        category: editForm.category,
        priority: editForm.priority,
        status: editForm.status,
        startDate: editForm.startDate || undefined,
        targetCompletionDate: editForm.targetCompletionDate || undefined,
        estimatedTotalHours: editForm.estimatedTotalHours ? Number(editForm.estimatedTotalHours) : undefined,
        budget: editForm.estimatedBudget ? {
          estimated: Number(editForm.estimatedBudget),
          currency: editForm.currency
        } : undefined,
        tags: editForm.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag),
        milestones: milestoneSteps
      };

      const response = await fetch(`http://localhost:5001/api/projects/${editingProject._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(projectData)
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingProject(null);
        resetForms();
        loadProjectsData();
        console.log('✅ Project updated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to update project');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      alert('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId) => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadProjectsData();
        console.log('✅ Project deleted successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Network error. Please try again.');
    }
  };

  // Duplicate project
  const handleDuplicateProject = async (project) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/projects/${project._id}/duplicate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          newTitle: `${project.title} (Copy)`,
          includeActiveTasks: false
        })
      });

      if (response.ok) {
        loadProjectsData();
        console.log('✅ Project duplicated successfully');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to duplicate project');
      }
    } catch (error) {
      console.error('Error duplicating project:', error);
      alert('Network error. Please try again.');
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, project) => {
    setDraggedProject(project);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    if (draggedProject && draggedProject.status !== newStatus) {
      updateProjectStatus(draggedProject._id, newStatus);
    }
    setDraggedProject(null);
  };

  // Load available businesses for linking
  const loadAvailableBusinesses = async () => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('http://localhost:5001/api/businesses', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAvailableBusinesses(data.businesses || []);
      }
    } catch (error) {
      console.error('Error loading available businesses:', error);
    }
  };

  // Load businesses linked to a project
  const loadLinkedBusinesses = async (projectId) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/projects/${projectId}/businesses`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setLinkedBusinesses(data.linkedBusinesses || []);
      }
    } catch (error) {
      console.error('Error loading linked businesses:', error);
    }
  };

  // Link project to business
  const handleLinkToBusiness = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/projects/${selectedProject._id}/link-business`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(businessLinkForm)
      });

      if (response.ok) {
        setShowBusinessLinkModal(false);
        setBusinessLinkForm({
          businessId: '',
          role: 'related',
          priority: 'medium',
          businessPhase: 'development',
          expectedImpact: 'medium'
        });
        console.log('✅ Project linked to business successfully');
        // Optionally reload projects or show success message
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to link project to business');
      }
    } catch (error) {
      console.error('Error linking project to business:', error);
      alert('Network error. Please try again.');
    }
  };

  // Unlink project from business
  const handleUnlinkFromBusiness = async (projectId, businessId) => {
    if (!window.confirm('Are you sure you want to unlink this project from the business?')) {
      return;
    }

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/projects/${projectId}/unlink-business/${businessId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        console.log('✅ Project unlinked from business successfully');
        loadLinkedBusinesses(projectId); // Refresh the list
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to unlink project from business');
      }
    } catch (error) {
      console.error('Error unlinking project from business:', error);
      alert('Network error. Please try again.');
    }
  };

  // Open business link modal
  const openBusinessLinkModal = (project) => {
    setSelectedProject(project);
    setShowBusinessLinkModal(true);
    loadAvailableBusinesses();
    loadLinkedBusinesses(project._id);
  };

  // Open modals
  const openEditModal = (project) => {
    setEditingProject(project);
    setEditForm({
      title: project.title,
      description: project.description,
      category: project.category,
      priority: project.priority,
      status: project.status,
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : '',
      targetCompletionDate: project.targetCompletionDate ? new Date(project.targetCompletionDate).toISOString().split('T')[0] : '',
      estimatedTotalHours: project.estimatedTotalHours || '',
      estimatedBudget: project.budget?.estimated || '',
      currency: project.budget?.currency || 'GBP',
      tags: project.tags ? project.tags.join(', ') : '',
      milestones: project.milestones ? project.milestones.map(milestone => milestone.title).join('\n') : ''
    });
    setShowEditModal(true);
  };

  const openViewModal = async (project) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`http://localhost:5001/api/projects/${project._id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const detailedProject = await response.json();
        setViewingProject(detailedProject);
        setShowViewModal(true);
      } else {
        console.error('Failed to load project details');
      }
    } catch (error) {
      console.error('Error loading project details:', error);
    }
  };

  // Group projects by status
  const projectsByStatus = projects.reduce((acc, project) => {
    const status = project.status || 'planning';
    if (!acc[status]) acc[status] = [];
    acc[status].push(project);
    return acc;
  }, {});

  // Calculate totals
  const calculateTotals = () => {
    const total = projects.length;
    const planning = projects.filter(project => project.status === 'planning').length;
    const active = projects.filter(project => project.status === 'active').length;
    const onHold = projects.filter(project => project.status === 'on_hold').length;
    const completed = projects.filter(project => project.status === 'completed').length;
    const cancelled = projects.filter(project => project.status === 'cancelled').length;

    return { total, planning, active, onHold, completed, cancelled };
  };

  // Calculate completion percentage for a project
  const calculateCompletion = (project) => {
    if (!project.milestones || project.milestones.length === 0) return 0;
    const completed = project.milestones.filter(m => m.completed).length;
    return Math.round((completed / project.milestones.length) * 100);
  };

  useEffect(() => {
    loadProjectsData();
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <CubeIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Total Projects</h3>
            <p className="text-3xl font-bold text-purple-600">{totals.total}</p>
            <div className="mt-3 text-sm text-gray-600">All projects</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-gray-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-gray-500 to-gray-600 rounded-lg flex items-center justify-center">
                <ClipboardDocumentListIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Planning</h3>
            <p className="text-3xl font-bold text-gray-600">{totals.planning}</p>
            <div className="mt-3 text-sm text-gray-600">Being planned</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                <PlayIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Active</h3>
            <p className="text-3xl font-bold text-blue-600">{totals.active}</p>
            <div className="mt-3 text-sm text-gray-600">In progress</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-lg flex items-center justify-center">
                <PauseIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">On Hold</h3>
            <p className="text-3xl font-bold text-yellow-600">{totals.onHold}</p>
            <div className="mt-3 text-sm text-gray-600">Paused</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Completed</h3>
            <p className="text-3xl font-bold text-green-600">{totals.completed}</p>
            <div className="mt-3 text-sm text-gray-600">Finished</div>
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

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:from-purple-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Add Project</span>
            </button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {statuses.map(status => {
            const column = statusColumns[status];
            const Icon = column.icon;
            const statusProjects = projectsByStatus[status] || [];

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
                      {statusProjects.length}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  {statusProjects.map(project => {
                    const completion = calculateCompletion(project);
                    
                    return (
                      <div
                        key={project._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, project)}
                        className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing min-h-[200px]"
                      >
                        {/* Title */}
                        <div className="mb-3">
                          <h4 className="font-medium text-gray-900 mb-2">{project.title}</h4>
                          
                          {/* Action Buttons - Enhanced with business linking */}
                          <div className="flex items-center space-x-1 mb-3">
                            <button 
                              onClick={() => openViewModal(project)}
                              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                              title="View project"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openEditModal(project)}
                              className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Edit project"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => openBusinessLinkModal(project)}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Link to business"
                            >
                              <BuildingOffice2Icon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDuplicateProject(project)}
                              className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="Duplicate project"
                            >
                              <DocumentDuplicateIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProject(project._id)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete project"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Description */}
                          <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">{project.description}</p>
                        </div>

                        {/* Priority and Category badges */}
                        <div className="flex flex-col space-y-2 mb-3">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityInfo(project.priority)}`}>
                              {project.priority}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                              {project.category}
                            </span>
                          </div>
                          {project.targetCompletionDate && (
                            <div className="flex items-center text-gray-500">
                              <CalendarIcon className="w-3 h-3 mr-1" />
                              <span className="text-xs">
                                Due: {new Date(project.targetCompletionDate).toLocaleDateString('en-GB', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: '2-digit'
                                })}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Milestone Progress */}
                        {project.milestones && project.milestones.length > 0 && (
                          <div className="mb-4">
                            <div className="text-xs text-gray-500 mb-2">Milestone Progress</div>
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${completion}%` }}
                                ></div>
                              </div>
                              <span className="text-xs text-gray-500 font-medium min-w-[3rem]">
                                {project.milestones.filter(m => m.completed).length}/{project.milestones.length}
                              </span>
                            </div>
                            <div className="text-xs text-purple-600 font-medium mt-1">
                              {completion}% Complete
                            </div>
                          </div>
                        )}

                        {/* Footer with Budget and Tags */}
                        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                          {project.budget?.estimated && (
                            <div className="flex items-center text-gray-500">
                              <BanknotesIcon className="w-4 h-4 mr-1" />
                              <span className="text-xs font-medium">
                                {project.budget.currency} {project.budget.estimated.toLocaleString()}
                              </span>
                            </div>
                          )}
                          
                          {project.tags && project.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {project.tags.slice(0, 2).map(tag => (
                                <span key={tag} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded font-medium">
                                  #{tag}
                                </span>
                              ))}
                              {project.tags.length > 2 && (
                                <span className="text-xs text-gray-500 font-medium">+{project.tags.length - 2}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {statusProjects.length === 0 && (
                    <div className="text-center py-8">
                      <Icon className={`w-12 h-12 text-${column.color}-300 mx-auto mb-2`} />
                      <p className="text-sm text-gray-500">No projects in this status</p>
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
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Create New Project</h3>
                <button
                  onClick={() => { setShowCreateModal(false); resetForms(); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Title</label>
                  <input
                    type="text"
                    value={createForm.title}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Build mobile app"
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
                    placeholder="Describe your project in detail..."
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date (Optional)</label>
                    <input
                      type="date"
                      value={createForm.startDate}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Completion (Optional)</label>
                    <input
                      type="date"
                      value={createForm.targetCompletionDate}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, targetCompletionDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Hours (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={createForm.estimatedTotalHours}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, estimatedTotalHours: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="40"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget & Currency (Optional)</label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        min="0"
                        value={createForm.estimatedBudget}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, estimatedBudget: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="1000"
                      />
                      <select
                        value={createForm.currency}
                        onChange={(e) => setCreateForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {currencies.map(currency => (
                          <option key={currency} value={currency}>{currency}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (Optional)</label>
                  <input
                    type="text"
                    value={createForm.tags}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="react, mobile, ios (comma separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Milestones (Optional)</label>
                  <textarea
                    value={createForm.milestones}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, milestones: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="Enter each milestone on a new line:&#10;Design UI mockups&#10;Set up development environment&#10;Implement core features&#10;Testing and deployment"
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
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Project</h3>
                <button
                  onClick={() => { setShowEditModal(false); setEditingProject(null); resetForms(); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Project Title</label>
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

                <div className="grid grid-cols-3 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {statuses.map(status => (
                        <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Start Date (Optional)</label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) => setEditForm(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Completion (Optional)</label>
                    <input
                      type="date"
                      value={editForm.targetCompletionDate}
                      onChange={(e) => setEditForm(prev => ({ ...prev, targetCompletionDate: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Hours (Optional)</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.estimatedTotalHours}
                      onChange={(e) => setEditForm(prev => ({ ...prev, estimatedTotalHours: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Budget & Currency (Optional)</label>
                    <div className="flex space-x-2">
                      <input
                        type="number"
                        min="0"
                        value={editForm.estimatedBudget}
                        onChange={(e) => setEditForm(prev => ({ ...prev, estimatedBudget: e.target.value }))}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <select
                        value={editForm.currency}
                        onChange={(e) => setEditForm(prev => ({ ...prev, currency: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {currencies.map(currency => (
                          <option key={currency} value={currency}>{currency}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags (Optional)</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="react, mobile, ios (comma separated)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Milestones (Optional)</label>
                  <textarea
                    value={editForm.milestones}
                    onChange={(e) => setEditForm(prev => ({ ...prev, milestones: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="4"
                    placeholder="Enter each milestone on a new line"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingProject(null); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-lg hover:from-purple-600 hover:to-indigo-600 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold text-gray-900">Project Details</h3>
                <button
                  onClick={() => { setShowViewModal(false); setViewingProject(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Project Info */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xl font-semibold text-gray-900 mb-2">{viewingProject.title}</h4>
                    <p className="text-gray-600 mb-4">{viewingProject.description}</p>
                    
                    <div className="flex flex-wrap gap-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityInfo(viewingProject.priority)}`}>
                        {viewingProject.priority} priority
                      </span>
                      <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                        {viewingProject.category}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium bg-${statusColumns[viewingProject.status]?.color}-100 text-${statusColumns[viewingProject.status]?.color}-600`}>
                        {viewingProject.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {viewingProject.startDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Start Date</label>
                        <p className="text-gray-900">{new Date(viewingProject.startDate).toLocaleDateString()}</p>
                      </div>
                    )}
                    {viewingProject.targetCompletionDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Target Completion</label>
                        <p className="text-gray-900">{new Date(viewingProject.targetCompletionDate).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {viewingProject.estimatedTotalHours && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Estimated Hours</label>
                        <p className="text-gray-900">{viewingProject.estimatedTotalHours} hours</p>
                      </div>
                    )}
                    {viewingProject.budget?.estimated && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Budget</label>
                        <p className="text-gray-900">
                          {viewingProject.budget.currency} {viewingProject.budget.estimated.toLocaleString()}
                        </p>
                      </div>
                    )}
                  </div>

                  {viewingProject.tags && viewingProject.tags.length > 0 && (
                    <div>
                      <label className="text-sm font-medium text-gray-500 mb-2 block">Tags</label>
                      <div className="flex flex-wrap gap-2">
                        {viewingProject.tags.map(tag => (
                          <span key={tag} className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Created</label>
                      <p className="text-gray-900">{new Date(viewingProject.createdAt).toLocaleDateString()}</p>
                    </div>
                    {viewingProject.actualCompletionDate && (
                      <div>
                        <label className="text-sm font-medium text-gray-500">Completed</label>
                        <p className="text-gray-900">{new Date(viewingProject.actualCompletionDate).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Milestones */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h5 className="text-lg font-semibold text-gray-900">Milestones</h5>
                    {viewingProject.milestones && viewingProject.milestones.length > 0 && (
                      <div className="text-right">
                        <div className="text-xl font-bold text-purple-600">
                          {calculateCompletion(viewingProject)}%
                        </div>
                        <div className="text-sm text-gray-500">Complete</div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    {viewingProject.milestones && viewingProject.milestones.length > 0 ? (
                      viewingProject.milestones.map((milestone, index) => (
                        <div
                          key={index}
                          className={`p-4 border rounded-lg transition-colors ${
                            milestone.completed 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <div className="mt-0.5">
                                {milestone.completed ? (
                                  <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                ) : (
                                  <ClockIcon className="w-5 h-5 text-gray-400" />
                                )}
                              </div>
                              <div className="flex-1">
                                <h6 className={`font-medium text-sm ${milestone.completed ? 'text-green-900 line-through' : 'text-gray-900'}`}>
                                  {milestone.title}
                                </h6>
                                {milestone.description && (
                                  <p className="text-sm text-gray-600 mt-1">{milestone.description}</p>
                                )}
                                {milestone.completedAt && (
                                  <p className="mt-1 text-xs text-green-600">
                                    Completed on {new Date(milestone.completedAt).toLocaleDateString()}
                                  </p>
                                )}
                                {milestone.dueDate && !milestone.completed && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Due: {new Date(milestone.dueDate).toLocaleDateString()}
                                  </p>
                                )}
                                {milestone.estimatedHours && (
                                  <p className="mt-1 text-xs text-gray-500">
                                    Est: {milestone.estimatedHours}h
                                    {milestone.actualHours && ` | Actual: ${milestone.actualHours}h`}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8">
                        <FlagIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-500">No milestones defined</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowViewModal(false); openEditModal(viewingProject); }}
                  className="px-6 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center space-x-2"
                >
                  <PencilIcon className="w-4 h-4" />
                  <span>Edit Project</span>
                </button>
                <button
                  onClick={() => { setShowViewModal(false); setViewingProject(null); }}
                  className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Business Link Modal */}
      {showBusinessLinkModal && selectedProject && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Link "{selectedProject.title}" to Business
                </h3>
                <button
                  onClick={() => { 
                    setShowBusinessLinkModal(false); 
                    setSelectedProject(null);
                    setLinkedBusinesses([]);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Link New Business */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">Link to New Business</h4>
                  
                  <form onSubmit={handleLinkToBusiness} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Business
                      </label>
                      <select
                        value={businessLinkForm.businessId}
                        onChange={(e) => setBusinessLinkForm(prev => ({ ...prev, businessId: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        required
                      >
                        <option value="">Choose a business...</option>
                        {availableBusinesses
                          .filter(business => !linkedBusinesses.some(linked => linked.businessId === business._id))
                          .map(business => (
                            <option key={business._id} value={business._id}>
                              {business.name} ({business.industry})
                            </option>
                          ))
                        }
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                        <select
                          value={businessLinkForm.role}
                          onChange={(e) => setBusinessLinkForm(prev => ({ ...prev, role: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="primary">Primary</option>
                          <option value="supporting">Supporting</option>
                          <option value="related">Related</option>
                          <option value="dependency">Dependency</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                        <select
                          value={businessLinkForm.priority}
                          onChange={(e) => setBusinessLinkForm(prev => ({ ...prev, priority: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Business Phase</label>
                        <select
                          value={businessLinkForm.businessPhase}
                          onChange={(e) => setBusinessLinkForm(prev => ({ ...prev, businessPhase: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="research">Research</option>
                          <option value="development">Development</option>
                          <option value="launch">Launch</option>
                          <option value="growth">Growth</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Expected Impact</label>
                        <select
                          value={businessLinkForm.expectedImpact}
                          onChange={(e) => setBusinessLinkForm(prev => ({ ...prev, expectedImpact: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!businessLinkForm.businessId}
                      className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Link to Business
                    </button>
                  </form>
                </div>

                {/* Right Column - Currently Linked Businesses */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">
                    Currently Linked Businesses ({linkedBusinesses.length})
                  </h4>

                  {linkedBusinesses.length === 0 ? (
                    <div className="text-center py-8">
                      <BuildingOffice2Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500">No businesses linked to this project</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {linkedBusinesses.map(linkedBusiness => (
                        <div 
                          key={linkedBusiness.businessId}
                          className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 mb-1">
                                {linkedBusiness.name}
                              </h5>
                              <p className="text-sm text-gray-600 mb-2">
                                {linkedBusiness.description}
                              </p>
                              
                              <div className="flex flex-wrap gap-2">
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${
                                  linkedBusiness.priority === 'critical' ? 'bg-red-100 text-red-800' :
                                  linkedBusiness.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                                  linkedBusiness.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {linkedBusiness.priority} priority
                                </span>
                                <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 font-medium">
                                  {linkedBusiness.role}
                                </span>
                                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                                  {linkedBusiness.businessPhase}
                                </span>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => handleUnlinkFromBusiness(selectedProject._id, linkedBusiness.businessId)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors ml-3"
                              title="Unlink from business"
                            >
                              <UnlinkIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200 mt-8">
                <button
                  onClick={() => { 
                    setShowBusinessLinkModal(false); 
                    setSelectedProject(null);
                    setLinkedBusinesses([]);
                  }}
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

export default SetProject;