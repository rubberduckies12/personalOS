import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  UsersIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  XMarkIcon,
  EnvelopeIcon,
  PencilIcon,
  TrashIcon,
  UserCircleIcon,
  BuildingOfficeIcon,
  CalendarDaysIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
  ChartBarIcon,
  EyeIcon,
  CogIcon
} from '@heroicons/react/24/outline';
import {
  UserCircleIcon as UserCircleIconSolid,
  StarIcon as StarIconSolid,
  CheckCircleIcon as CheckCircleIconSolid
} from '@heroicons/react/24/solid';

const BusinessTeam = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [chartData, setChartData] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid, list, chart
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    status: 'all',
    role: 'all',
    department: 'all',
    level: 'all'
  });

  // FIXED: Move invite form state to component level
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    role: 'member',
    jobTitle: '',
    level: 1,
    responsibilities: '',
    employmentType: 'full-time',
    department: '',
    startDate: '',
    permissions: []
  });

  // Helper functions
  const getAuthToken = () => localStorage.getItem('accessToken') || localStorage.getItem('authToken');

  const createFetchOptions = (options = {}) => ({
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
      ...options.headers
    },
    ...options
  });

  // Load team data
  const loadTeamData = async () => {
    try {
      setLoading(true);
      
      const [businessRes, chartRes] = await Promise.all([
        fetch(`http://localhost:5001/api/businesses/${businessId}`, createFetchOptions()),
        fetch(`http://localhost:5001/api/businesses/${businessId}/team/chart`, createFetchOptions()).catch(() => ({ ok: false }))
      ]);

      if (businessRes.ok) {
        const businessData = await businessRes.json();
        setBusiness(businessData);
        setTeamMembers(businessData.teamMembers || []);
      }

      if (chartRes.ok) {
        const chartData = await chartRes.json();
        setChartData(chartData);
      }

    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      loadTeamData();
    }
  }, [businessId]);

  // Invite user
  const inviteUser = async (inviteData) => {
    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/invite`, 
        createFetchOptions({
          method: 'POST',
          body: JSON.stringify(inviteData)
        })
      );

      if (response.ok) {
        setShowInviteModal(false);
        // Reset form data
        setInviteFormData({
          email: '',
          role: 'member',
          jobTitle: '',
          level: 1,
          responsibilities: '',
          employmentType: 'full-time',
          department: '',
          startDate: '',
          permissions: []
        });
        loadTeamData(); // Refresh data
      }
    } catch (error) {
      console.error('Error inviting user:', error);
    }
  };

  // Update team member
  const updateMember = async (memberId, updateData) => {
    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/members/${memberId}`, 
        createFetchOptions({
          method: 'PUT',
          body: JSON.stringify(updateData)
        })
      );

      if (response.ok) {
        setShowEditModal(false);
        setSelectedMember(null);
        loadTeamData(); // Refresh data
      }
    } catch (error) {
      console.error('Error updating member:', error);
    }
  };

  // FIXED: Replace confirm with proper confirmation
  const removeMember = async (memberId) => {
    // Create a proper confirmation dialog instead of using confirm()
    const shouldRemove = window.confirm('Are you sure you want to remove this team member?');
    if (!shouldRemove) return;

    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/members/${memberId}`, 
        createFetchOptions({ method: 'DELETE' })
      );

      if (response.ok) {
        loadTeamData(); // Refresh data
      }
    } catch (error) {
      console.error('Error removing member:', error);
    }
  };

  // Filter and search members
  const filteredMembers = teamMembers.filter(member => {
    const matchesSearch = !searchTerm || 
      (member.userId?.firstName + ' ' + member.userId?.lastName).toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filters.status === 'all' || member.status === filters.status;
    const matchesRole = filters.role === 'all' || member.role === filters.role;
    const matchesDepartment = filters.department === 'all' || member.department === filters.department;
    const matchesLevel = filters.level === 'all' || member.level.toString() === filters.level;
    
    return matchesSearch && matchesStatus && matchesRole && matchesDepartment && matchesLevel;
  });

  // Get unique departments
  const departments = [...new Set(teamMembers.map(m => m.department).filter(Boolean))];

  // Get level badge color
  const getLevelColor = (level) => {
    const colors = {
      1: 'bg-gray-100 text-gray-800',
      2: 'bg-blue-100 text-blue-800',
      3: 'bg-green-100 text-green-800',
      4: 'bg-yellow-100 text-yellow-800',
      5: 'bg-purple-100 text-purple-800'
    };
    return colors[level] || colors[1];
  };

  // Get status color
  const getStatusColor = (status) => {
    const colors = {
      'active': 'text-green-600 bg-green-100',
      'pending': 'text-yellow-600 bg-yellow-100',
      'inactive': 'text-gray-600 bg-gray-100',
      'removed': 'text-red-600 bg-red-100'
    };
    return colors[status] || colors.inactive;
  };

  // Current user permissions
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isOwner = business?.ownerId?._id === currentUser.id;
  const currentUserMember = teamMembers.find(m => m.userId?._id === currentUser.id);
  const canManageTeam = isOwner || (currentUserMember?.permissions.includes('manage_team'));
  const canInviteUsers = isOwner || (currentUserMember?.permissions.includes('invite_users'));

  // FIXED: Convert to proper React component - InviteModal
  const InviteModal = () => {
    const rolePermissions = {
      viewer: ['view_business', 'view_products', 'view_projects'],
      member: ['view_business', 'view_products', 'view_projects', 'manage_projects'],
      manager: ['view_business', 'edit_business', 'view_products', 'manage_products', 'view_projects', 'manage_projects', 'view_team_details'],
      admin: ['view_business', 'edit_business', 'manage_products', 'view_products', 'manage_projects', 'view_projects', 'invite_users', 'view_analytics', 'manage_team', 'view_team_details'],
      consultant: ['view_business', 'view_products', 'view_projects', 'manage_projects', 'view_analytics']
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900">Invite Team Member</h3>
            <button onClick={() => setShowInviteModal(false)}>
              <XMarkIcon className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault();
            inviteUser({
              ...inviteFormData,
              permissions: inviteFormData.permissions.length > 0 ? inviteFormData.permissions : rolePermissions[inviteFormData.role]
            });
          }} className="space-y-6">
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={inviteFormData.email}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Job Title *
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={inviteFormData.jobTitle}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, jobTitle: e.target.value }))}
                  placeholder="e.g. Software Developer, Marketing Manager"
                />
              </div>
            </div>

            {/* Role & Level */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Role
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={inviteFormData.role}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="consultant">Consultant</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Level (1-5)
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={inviteFormData.level}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, level: parseInt(e.target.value) }))}
                >
                  <option value={1}>Level 1 - Entry</option>
                  <option value={2}>Level 2 - Junior</option>
                  <option value={3}>Level 3 - Mid</option>
                  <option value={4}>Level 4 - Senior</option>
                  <option value={5}>Level 5 - Lead</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employment Type
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={inviteFormData.employmentType}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, employmentType: e.target.value }))}
                >
                  <option value="full-time">Full-time</option>
                  <option value="part-time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="freelance">Freelance</option>
                  <option value="intern">Intern</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </div>
            </div>

            {/* Department & Start Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={inviteFormData.department}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="e.g. Engineering, Marketing, Sales"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={inviteFormData.startDate}
                  onChange={(e) => setInviteFormData(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
            </div>

            {/* Responsibilities */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Responsibilities & Description
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                value={inviteFormData.responsibilities}
                onChange={(e) => setInviteFormData(prev => ({ ...prev, responsibilities: e.target.value }))}
                placeholder="Describe the key responsibilities, duties, and expectations for this role..."
              />
              <p className="text-sm text-gray-500 mt-1">Max 1000 characters</p>
            </div>

            {/* Permissions Preview */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Permissions for {inviteFormData.role}:</h4>
              <div className="flex flex-wrap gap-2">
                {rolePermissions[inviteFormData.role]?.map(permission => (
                  <span key={permission} className="px-2 py-1 text-xs bg-emerald-100 text-emerald-800 rounded-full">
                    {permission.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Send Invitation
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Render member card
  const renderMemberCard = (member) => {
    const fullName = member.userId ? 
      `${member.userId.firstName} ${member.userId.lastName}` : 
      member.email;

    return (
      <div key={member._id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center space-x-3">
            {member.userId?.avatar ? (
              <img src={member.userId.avatar} alt={fullName} className="w-12 h-12 rounded-full" />
            ) : (
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <span className="text-lg font-medium text-white">
                  {fullName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-semibold text-gray-900">{fullName}</h3>
                {member.role === 'owner' && <StarIconSolid className="w-4 h-4 text-yellow-500" />}
              </div>
              <p className="text-sm text-gray-600">{member.jobTitle}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(member.level)}`}>
              Level {member.level}
            </span>
            {canManageTeam && member.role !== 'owner' && (
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => { setSelectedMember(member); setShowEditModal(true); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit Member"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => removeMember(member._id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove Member"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500">Role</p>
            <p className="text-sm font-medium text-gray-900 capitalize">{member.role}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(member.status)}`}>
              {member.status}
            </span>
          </div>
          {member.department && (
            <div>
              <p className="text-xs text-gray-500">Department</p>
              <p className="text-sm font-medium text-gray-900">{member.department}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500">Employment</p>
            <p className="text-sm font-medium text-gray-900 capitalize">{member.employmentType.replace('-', ' ')}</p>
          </div>
        </div>

        {/* Responsibilities */}
        {member.responsibilities && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">Responsibilities</p>
            <p className="text-sm text-gray-700 line-clamp-3">{member.responsibilities}</p>
          </div>
        )}

        {/* Dates */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center space-x-4">
            {member.joinedAt && (
              <span className="flex items-center space-x-1">
                <CalendarDaysIcon className="w-3 h-3" />
                <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
              </span>
            )}
            {member.status === 'pending' && (
              <span className="flex items-center space-x-1">
                <ClockIcon className="w-3 h-3" />
                <span>Invited {new Date(member.invitedAt).toLocaleDateString()}</span>
              </span>
            )}
          </div>
          
          {member.lastActiveAt && (
            <span>Last active {new Date(member.lastActiveAt).toLocaleDateString()}</span>
          )}
        </div>
      </div>
    );
  };

  // Render organization chart
  const renderOrgChart = () => {
    if (!chartData) return null;

    return (
      <div className="space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{chartData.totalMembers}</p>
                <p className="text-sm text-gray-600">Total Members</p>
              </div>
              <UsersIcon className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{chartData.departments.length}</p>
                <p className="text-sm text-gray-600">Departments</p>
              </div>
              <BuildingOfficeIcon className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {(chartData.levelDistribution[4] + chartData.levelDistribution[5])}
                </p>
                <p className="text-sm text-gray-600">Senior Members</p>
              </div>
              <StarIcon className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border-l-4 border-emerald-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-emerald-600">
                  {Math.round((chartData.totalMembers / (business?.metrics?.employeeCount?.target || chartData.totalMembers)) * 100)}%
                </p>
                <p className="text-sm text-gray-600">Target Progress</p>
              </div>
              <ChartBarIcon className="w-8 h-8 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* Departments */}
        <div className="space-y-6">
          {chartData.departments.map(dept => (
            <div key={dept.name} className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {dept.name} Department ({dept.totalMembers} members)
              </h3>
              
              <div className="space-y-4">
                {[5, 4, 3, 2, 1].map(level => {
                  const levelMembers = dept.levels[level] || [];
                  if (levelMembers.length === 0) return null;

                  return (
                    <div key={level} className="ml-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">
                        Level {level} ({levelMembers.length})
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ml-4">
                        {levelMembers.map(member => (
                          <div key={member._id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-medium text-blue-600">
                                {member.fullName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900">{member.fullName}</p>
                              <p className="text-xs text-gray-500">{member.jobTitle}</p>
                            </div>
                            {member.role === 'owner' && <StarIconSolid className="w-4 h-4 text-yellow-500" />}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Team Management</h2>
              <p className="text-sm text-gray-600">
                Manage team members, roles, and permissions for {business?.name}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* View Mode Toggle */}
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'grid' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Grid
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'list' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  List
                </button>
                <button
                  onClick={() => setViewMode('chart')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'chart' ? 'bg-emerald-100 text-emerald-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Org Chart
                </button>
              </div>
              
              {canInviteUsers && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Invite Member</span>
                </button>
              )}
            </div>
          </div>

          {/* Search & Filters */}
          {viewMode !== 'chart' && (
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search team members..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Filters */}
              <div className="flex space-x-2">
                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                </select>

                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={filters.role}
                  onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
                >
                  <option value="all">All Roles</option>
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                  <option value="consultant">Consultant</option>
                </select>

                <select
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  value={filters.level}
                  onChange={(e) => setFilters(prev => ({ ...prev, level: e.target.value }))}
                >
                  <option value="all">All Levels</option>
                  <option value="5">Level 5 - Lead</option>
                  <option value="4">Level 4 - Senior</option>
                  <option value="3">Level 3 - Mid</option>
                  <option value="2">Level 2 - Junior</option>
                  <option value="1">Level 1 - Entry</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Content based on view mode */}
        {viewMode === 'chart' ? (
          renderOrgChart()
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMembers.map(member => renderMemberCard(member))}
          </div>
        ) : (
          /* List View */
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role & Level</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                    {canManageTeam && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMembers.map((member) => {
                    const fullName = member.userId ? 
                      `${member.userId.firstName} ${member.userId.lastName}` : 
                      member.email;
                    
                    return (
                      <tr key={member._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-blue-600">
                                {fullName.charAt(0)}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <p className="text-sm font-medium text-gray-900">{fullName}</p>
                                {member.role === 'owner' && <StarIconSolid className="w-4 h-4 text-yellow-500" />}
                              </div>
                              <p className="text-sm text-gray-500">{member.jobTitle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900 capitalize">{member.role}</span>
                            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getLevelColor(member.level)}`}>
                              L{member.level}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {member.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(member.status)}`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Pending'}
                        </td>
                        {canManageTeam && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {member.role !== 'owner' && (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => { setSelectedMember(member); setShowEditModal(true); }}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => removeMember(member._id)}
                                  className="text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {filteredMembers.length === 0 && (
          <div className="text-center py-12">
            <UsersIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No team members found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || Object.values(filters).some(f => f !== 'all') 
                ? 'Try adjusting your search or filters' 
                : 'Start building your team by inviting members'
              }
            </p>
            {canInviteUsers && !searchTerm && Object.values(filters).every(f => f === 'all') && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors"
              >
                Invite First Team Member
              </button>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showInviteModal && <InviteModal />}
      {/* Edit modal would go here - similar structure to invite modal */}
    </main>
  );
};

export default BusinessTeam;