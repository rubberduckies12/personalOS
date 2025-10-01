import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CpuChipIcon,
  CodeBracketIcon,
  PaintBrushIcon,
  BriefcaseIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  GlobeAltIcon,
  SparklesIcon,
  ChartBarIcon,
  AcademicCapIcon,
  WrenchScrewdriverIcon,
  HeartIcon,
  PlusIcon,
  EyeIcon,
  PencilIcon,
  TrashIcon,
  XMarkIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  TrophyIcon,
  FireIcon,
  LockClosedIcon,
  StarIcon,
  CheckCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

const SetSkills = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [filteredSkills, setFilteredSkills] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Filter and search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    status: 'all',
    level: 'all',
    priority: 'all'
  });
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [editingSkill, setEditingSkill] = useState(null);
  const [viewingSkill, setViewingSkill] = useState(null);
  
  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    category: 'technical',
    currentLevel: 'beginner',
    targetLevel: 'intermediate',
    status: 'not_started',
    priority: 'medium',
    tags: '',
    estimatedCompletionTime: '',
    resources: ''
  });
  
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    category: 'technical',
    currentLevel: 'beginner',
    targetLevel: 'intermediate',
    status: 'not_started',
    priority: 'medium',
    tags: '',
    estimatedCompletionTime: '',
    resources: ''
  });

  // Skill categories
  const skillCategories = [
    { id: 'technical', name: 'Technical', icon: CpuChipIcon, color: 'from-blue-500 to-blue-600' },
    { id: 'programming', name: 'Programming', icon: CodeBracketIcon, color: 'from-green-500 to-green-600' },
    { id: 'design', name: 'Design', icon: PaintBrushIcon, color: 'from-pink-500 to-pink-600' },
    { id: 'business', name: 'Business', icon: BriefcaseIcon, color: 'from-indigo-500 to-indigo-600' },
    { id: 'leadership', name: 'Leadership', icon: UserGroupIcon, color: 'from-orange-500 to-orange-600' },
    { id: 'communication', name: 'Communication', icon: ChatBubbleLeftRightIcon, color: 'from-purple-500 to-purple-600' },
    { id: 'language', name: 'Language', icon: GlobeAltIcon, color: 'from-teal-500 to-teal-600' },
    { id: 'creative', name: 'Creative', icon: SparklesIcon, color: 'from-yellow-500 to-yellow-600' },
    { id: 'analytical', name: 'Analytical', icon: ChartBarIcon, color: 'from-cyan-500 to-cyan-600' },
    { id: 'academic', name: 'Academic', icon: AcademicCapIcon, color: 'from-red-500 to-red-600' },
    { id: 'trade', name: 'Trade', icon: WrenchScrewdriverIcon, color: 'from-gray-500 to-gray-600' },
    { id: 'personal', name: 'Personal', icon: HeartIcon, color: 'from-rose-500 to-rose-600' }
  ];

  // Skill levels
  const skillLevels = [
    { id: 'beginner', name: 'Novice', color: 'text-gray-500', bgColor: 'bg-gray-100', icon: '🌱' },
    { id: 'novice', name: 'Apprentice', color: 'text-green-600', bgColor: 'bg-green-100', icon: '🌿' },
    { id: 'intermediate', name: 'Journeyman', color: 'text-blue-600', bgColor: 'bg-blue-100', icon: '⚡' },
    { id: 'advanced', name: 'Expert', color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: '🔮' },
    { id: 'expert', name: 'Master', color: 'text-orange-600', bgColor: 'bg-orange-100', icon: '👑' },
    { id: 'master', name: 'Grandmaster', color: 'text-red-600', bgColor: 'bg-red-100', icon: '🏆' }
  ];

  // Skill statuses
  const skillStatuses = [
    { id: 'not_started', name: 'Not Started', color: 'text-gray-500', bgColor: 'bg-gray-100' },
    { id: 'learning', name: 'Learning', color: 'text-blue-600', bgColor: 'bg-blue-100' },
    { id: 'practicing', name: 'Practicing', color: 'text-orange-600', bgColor: 'bg-orange-100' },
    { id: 'mastered', name: 'Mastered', color: 'text-green-600', bgColor: 'bg-green-100' },
    { id: 'on_hold', name: 'On Hold', color: 'text-yellow-600', bgColor: 'bg-yellow-100' }
  ];

  // Priorities
  const priorities = ['low', 'medium', 'high', 'urgent'];

  // Get helper functions
  const getCategoryInfo = (categoryId) => {
    return skillCategories.find(c => c.id === categoryId) || skillCategories[0];
  };

  const getLevelInfo = (levelId) => {
    return skillLevels.find(l => l.id === levelId) || skillLevels[0];
  };

  const getStatusInfo = (statusId) => {
    return skillStatuses.find(s => s.id === statusId) || skillStatuses[0];
  };

  const getPriorityInfo = (priority) => {
    const colors = {
      low: 'bg-gray-100 text-gray-700',
      medium: 'bg-blue-100 text-blue-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700'
    };
    return colors[priority] || colors.medium;
  };

  // Load skills data
  const loadSkillsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        navigate('/auth/login');
        return;
      }

      const response = await fetch('http://localhost:5001/api/skills?limit=1000', {
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
        setSkills(data.skills || []);
        setFilteredSkills(data.skills || []);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading skills:', error);
      setLoading(false);
    }
  };

  // Filter and search skills
  useEffect(() => {
    let filtered = skills;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(skill =>
        skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        skill.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter(skill => skill.category === filters.category);
    }

    // Apply status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(skill => skill.status === filters.status);
    }

    // Apply level filter
    if (filters.level !== 'all') {
      filtered = filtered.filter(skill => skill.currentLevel === filters.level);
    }

    // Apply priority filter
    if (filters.priority !== 'all') {
      filtered = filtered.filter(skill => skill.priority === filters.priority);
    }

    setFilteredSkills(filtered);
  }, [skills, searchTerm, filters]);

  // Reset forms
  const resetForms = () => {
    setCreateForm({
      name: '',
      description: '',
      category: 'technical',
      currentLevel: 'beginner',
      targetLevel: 'intermediate',
      status: 'not_started',
      priority: 'medium',
      tags: '',
      estimatedCompletionTime: '',
      resources: ''
    });
    setEditForm({
      name: '',
      description: '',
      category: 'technical',
      currentLevel: 'beginner',
      targetLevel: 'intermediate',
      status: 'not_started',
      priority: 'medium',
      tags: '',
      estimatedCompletionTime: '',
      resources: ''
    });
  };

  // Handle create skill
  const handleCreateSkill = async (e) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      const skillData = {
        ...createForm,
        tags: createForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        estimatedCompletionTime: createForm.estimatedCompletionTime ? parseInt(createForm.estimatedCompletionTime) : undefined
      };

      const response = await fetch('http://localhost:5001/api/skills', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(skillData)
      });

      if (response.ok) {
        setShowCreateModal(false);
        resetForms();
        loadSkillsData();
      } else {
        console.error('Error creating skill');
      }
    } catch (error) {
      console.error('Error creating skill:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle edit skill
  const handleEditSkill = async (e) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      const token = localStorage.getItem('accessToken');
      
      const skillData = {
        ...editForm,
        tags: editForm.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
        estimatedCompletionTime: editForm.estimatedCompletionTime ? parseInt(editForm.estimatedCompletionTime) : undefined
      };

      const response = await fetch(`http://localhost:5001/api/skills/${editingSkill._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(skillData)
      });

      if (response.ok) {
        setShowEditModal(false);
        setEditingSkill(null);
        resetForms();
        loadSkillsData();
      } else {
        console.error('Error updating skill');
      }
    } catch (error) {
      console.error('Error updating skill:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete skill
  const handleDeleteSkill = async (skillId) => {
    if (!window.confirm('Are you sure you want to delete this skill?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/skills/${skillId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        loadSkillsData();
      } else {
        console.error('Error deleting skill');
      }
    } catch (error) {
      console.error('Error deleting skill:', error);
    }
  };

  // Handle edit click
  const handleEditClick = (skill) => {
    setEditingSkill(skill);
    setEditForm({
      name: skill.name,
      description: skill.description || '',
      category: skill.category,
      currentLevel: skill.currentLevel,
      targetLevel: skill.targetLevel,
      status: skill.status,
      priority: skill.priority,
      tags: skill.tags ? skill.tags.join(', ') : '',
      estimatedCompletionTime: skill.estimatedCompletionTime || '',
      resources: skill.resources || ''
    });
    setShowEditModal(true);
  };

  // Handle view click
  const handleViewClick = (skill) => {
    setViewingSkill(skill);
    setShowViewModal(true);
  };

  useEffect(() => {
    loadSkillsData();
  }, []);

  useEffect(() => {
    const handleCreateModalEvent = () => {
      setShowCreateModal(true);
    };

    document.addEventListener('openCreateModal', handleCreateModalEvent);

    return () => {
      document.removeEventListener('openCreateModal', handleCreateModalEvent);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Manage Skills</h1>
              <p className="mt-2 text-gray-600">Add, edit, and organize your learning journey</p>
            </div>
            <div className="mt-4 sm:mt-0">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2 shadow-lg"
              >
                <PlusIcon className="w-5 h-5" />
                <span>Add New Skill</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search skills..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-4">
              <select
                value={filters.category}
                onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Categories</option>
                {skillCategories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Statuses</option>
                {skillStatuses.map(status => (
                  <option key={status.id} value={status.id}>{status.name}</option>
                ))}
              </select>

              <select
                value={filters.level}
                onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Levels</option>
                {skillLevels.map(level => (
                  <option key={level.id} value={level.id}>{level.name}</option>
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
          </div>
        </div>
      </div>

      {/* Skills Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredSkills.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-xl flex items-center justify-center">
              <TrophyIcon className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No Skills Found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || Object.values(filters).some(f => f !== 'all') 
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first skill.'}
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200"
            >
              Add Your First Skill
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredSkills.map((skill) => {
              const categoryInfo = getCategoryInfo(skill.category);
              const levelInfo = getLevelInfo(skill.currentLevel);
              const statusInfo = getStatusInfo(skill.status);
              const Icon = categoryInfo.icon;

              return (
                <div
                  key={skill._id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200 group"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 bg-gradient-to-r ${categoryInfo.color} rounded-lg flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewClick(skill)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEditClick(skill)}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Edit Skill"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteSkill(skill._id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Skill"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-1">{skill.name}</h3>
                      {skill.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{skill.description}</p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${levelInfo.bgColor} ${levelInfo.color}`}>
                        {levelInfo.icon} {levelInfo.name}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                        {statusInfo.name}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityInfo(skill.priority)}`}>
                        {skill.priority}
                      </span>
                    </div>

                    {/* Progress */}
                    {skill.progressPercentage !== undefined && (
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Progress</span>
                          <span>{skill.progressPercentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className={`bg-gradient-to-r ${categoryInfo.color} h-2 rounded-full transition-all duration-300`}
                            style={{ width: `${skill.progressPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Tags */}
                    {skill.tags && skill.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {skill.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            #{tag}
                          </span>
                        ))}
                        {skill.tags.length > 2 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            +{skill.tags.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Add New Skill</h3>
                <button
                  onClick={() => { setShowCreateModal(false); resetForms(); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreateSkill} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Skill Name *</label>
                    <input
                      type="text"
                      value={createForm.name}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={createForm.category}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillCategories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Level</label>
                    <select
                      value={createForm.currentLevel}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, currentLevel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillLevels.map(level => (
                        <option key={level.id} value={level.id}>{level.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Level</label>
                    <select
                      value={createForm.targetLevel}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, targetLevel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillLevels.map(level => (
                        <option key={level.id} value={level.id}>{level.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={createForm.status}
                      onChange={(e) => setCreateForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillStatuses.map(status => (
                        <option key={status.id} value={status.id}>{status.name}</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <input
                    type="text"
                    value={createForm.tags}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="comma separated tags"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Completion Time (hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={createForm.estimatedCompletionTime}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, estimatedCompletionTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    {isSubmitting ? 'Creating...' : 'Create Skill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingSkill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Edit Skill</h3>
                <button
                  onClick={() => { setShowEditModal(false); setEditingSkill(null); resetForms(); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleEditSkill} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Skill Name *</label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                    <select
                      value={editForm.category}
                      onChange={(e) => setEditForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillCategories.map(category => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows="3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current Level</label>
                    <select
                      value={editForm.currentLevel}
                      onChange={(e) => setEditForm(prev => ({ ...prev, currentLevel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillLevels.map(level => (
                        <option key={level.id} value={level.id}>{level.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Target Level</label>
                    <select
                      value={editForm.targetLevel}
                      onChange={(e) => setEditForm(prev => ({ ...prev, targetLevel: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillLevels.map(level => (
                        <option key={level.id} value={level.id}>{level.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {skillStatuses.map(status => (
                        <option key={status.id} value={status.id}>{status.name}</option>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tags</label>
                  <input
                    type="text"
                    value={editForm.tags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, tags: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="comma separated tags"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Estimated Completion Time (hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={editForm.estimatedCompletionTime}
                    onChange={(e) => setEditForm(prev => ({ ...prev, estimatedCompletionTime: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => { setShowEditModal(false); setEditingSkill(null); resetForms(); }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-colors disabled:opacity-50"
                  >
                    {isSubmitting ? 'Updating...' : 'Update Skill'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingSkill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  {(() => {
                    const categoryInfo = getCategoryInfo(viewingSkill.category);
                    const Icon = categoryInfo.icon;
                    
                    return (
                      <>
                        <div className={`w-16 h-16 bg-gradient-to-r ${categoryInfo.color} rounded-xl flex items-center justify-center shadow-lg`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">{viewingSkill.name}</h3>
                          <p className="text-gray-600">{viewingSkill.category}</p>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={() => { setShowViewModal(false); setViewingSkill(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Status Badges */}
                <div className="flex flex-wrap gap-3">
                  {(() => {
                    const levelInfo = getLevelInfo(viewingSkill.currentLevel);
                    const statusInfo = getStatusInfo(viewingSkill.status);
                    
                    return (
                      <>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${levelInfo.bgColor} ${levelInfo.color}`}>
                          {levelInfo.icon} {levelInfo.name}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
                          {statusInfo.name}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityInfo(viewingSkill.priority)}`}>
                          {viewingSkill.priority} priority
                        </span>
                      </>
                    );
                  })()}
                </div>

                {/* Description */}
                {viewingSkill.description && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Description</h4>
                    <p className="text-gray-700 leading-relaxed">{viewingSkill.description}</p>
                  </div>
                )}

                {/* Progress */}
                {viewingSkill.progressPercentage !== undefined && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Progress</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Current Progress</span>
                        <span>{viewingSkill.progressPercentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className={`bg-gradient-to-r ${getCategoryInfo(viewingSkill.category).color} h-3 rounded-full transition-all duration-300`}
                          style={{ width: `${viewingSkill.progressPercentage}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {viewingSkill.tags && viewingSkill.tags.length > 0 && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {viewingSkill.tags.map(tag => (
                        <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Time Estimate */}
                {viewingSkill.estimatedCompletionTime && (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3">Time Investment</h4>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-gray-700">
                        Estimated completion time: <span className="font-semibold">{viewingSkill.estimatedCompletionTime} hours</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowViewModal(false); setViewingSkill(null); }}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
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

export default SetSkills;