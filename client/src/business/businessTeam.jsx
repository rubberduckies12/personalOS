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

const BusinessTeam = ({ businessData }) => {
  const { businessId } = useParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(false); // Start false since we have data
  const [business, setBusiness] = useState(businessData || null);
  const [teamMembers, setTeamMembers] = useState(businessData?.teamMembers || []);
  const [chartData, setChartData] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({
    email: '',
    role: 'member',
    jobTitle: '',
    level: 1,
    permissions: []
  });
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

  // FIXED: Only load additional data when business data is passed
  const loadTeamData = async () => {
    try {
      setLoading(true);
      
      // Use passed business data or load from API
      let currentBusiness = businessData;
      if (!currentBusiness) {
        console.log('No business data passed, loading from API...');
        const businessRes = await fetch(`http://localhost:5001/api/businesses/${businessId}`, createFetchOptions());
        if (businessRes.ok) {
          currentBusiness = await businessRes.json();
        } else {
          console.error('Failed to load business data:', businessRes.status);
          setLoading(false);
          return;
        }
      }
      
      setBusiness(currentBusiness);
      setTeamMembers(currentBusiness.teamMembers || []);

      // FIXED: Don't try to load chart data if endpoint doesn't exist
      // Instead, generate basic chart data from team members
      if (currentBusiness.teamMembers && currentBusiness.teamMembers.length > 0) {
        const roles = {};
        const levels = {};
        const departments = {};

        currentBusiness.teamMembers.forEach(member => {
          // Count by role
          roles[member.role] = (roles[member.role] || 0) + 1;
          
          // Count by level
          const level = member.level || 1;
          levels[`Level ${level}`] = (levels[`Level ${level}`] || 0) + 1;
          
          // Count by department
          const dept = member.department || 'General';
          departments[dept] = (departments[dept] || 0) + 1;
        });

        setChartData({
          roles: Object.entries(roles).map(([role, count]) => ({ role, count })),
          levels: Object.entries(levels).map(([level, count]) => ({ level, count })),
          departments: Object.entries(departments).map(([dept, count]) => ({ department: dept, count })),
          totalMembers: currentBusiness.teamMembers.length,
          activeMembers: currentBusiness.teamMembers.filter(m => m.status === 'active').length,
          pendingInvites: currentBusiness.teamMembers.filter(m => m.status === 'pending').length
        });
      } else {
        setChartData({
          roles: [],
          levels: [],
          departments: [],
          totalMembers: 0,
          activeMembers: 0,
          pendingInvites: 0
        });
      }

    } catch (error) {
      console.error('Error loading team data:', error);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: Load data when component mounts or businessData changes
  useEffect(() => {
    if (businessId && (!businessData || businessData._id !== businessId)) {
      loadTeamData();
    } else if (businessData) {
      // Use passed business data immediately
      setBusiness(businessData);
      setTeamMembers(businessData.teamMembers || []);
      
      // Generate chart data from passed business data
      if (businessData.teamMembers && businessData.teamMembers.length > 0) {
        const roles = {};
        const levels = {};
        const departments = {};

        businessData.teamMembers.forEach(member => {
          roles[member.role] = (roles[member.role] || 0) + 1;
          const level = member.level || 1;
          levels[`Level ${level}`] = (levels[`Level ${level}`] || 0) + 1;
          const dept = member.department || 'General';
          departments[dept] = (departments[dept] || 0) + 1;
        });

        setChartData({
          roles: Object.entries(roles).map(([role, count]) => ({ role, count })),
          levels: Object.entries(levels).map(([level, count]) => ({ level, count })),
          departments: Object.entries(departments).map(([dept, count]) => ({ department: dept, count })),
          totalMembers: businessData.teamMembers.length,
          activeMembers: businessData.teamMembers.filter(m => m.status === 'active').length,
          pendingInvites: businessData.teamMembers.filter(m => m.status === 'pending').length
        });
      }
    }
  }, [businessId, businessData]);

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
        setInviteData({
          email: '',
          role: 'member',
          jobTitle: '',
          level: 1,
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
              ...inviteData,
              permissions: inviteData.permissions.length > 0 ? inviteData.permissions : rolePermissions[inviteData.role]
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
                  value={inviteData.email}
                  onChange={(e) => setInviteData(prev => ({ ...prev, email: e.target.value }))}
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
                  value={inviteData.jobTitle}
                  onChange={(e) => setInviteData(prev => ({ ...prev, jobTitle: e.target.value }))}
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
                  value={inviteData.role}
                  onChange={(e) => setInviteData(prev => ({ ...prev, role: e.target.value }))}
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
                  value={inviteData.level}
                  onChange={(e) => setInviteData(prev => ({ ...prev, level: parseInt(e.target.value) }))}
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
                  value={inviteData.employmentType}
                  onChange={(e) => setInviteData(prev => ({ ...prev, employmentType: e.target.value }))}
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
                  value={inviteData.department}
                  onChange={(e) => setInviteData(prev => ({ ...prev, department: e.target.value }))}
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
                  value={inviteData.startDate}
                  onChange={(e) => setInviteData(prev => ({ ...prev, startDate: e.target.value }))}
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
                value={inviteData.responsibilities}
                onChange={(e) => setInviteData(prev => ({ ...prev, responsibilities: e.target.value }))}
                placeholder="Describe the key responsibilities, duties, and expectations for this role..."
              />
              <p className="text-sm text-gray-500 mt-1">Max 1000 characters</p>
            </div>

            {/* Permissions Preview */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Permissions for {inviteData.role}:</h4>
              <div className="flex flex-wrap gap-2">
                {rolePermissions[inviteData.role]?.map(permission => (
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
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading team data...</p>
        </div>
      </div>
    );
  }

  if (!business) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-gray-600">No business data available</p>
        </div>
      </div>
    );
  }

  // Main render - Updated to use new team management UI
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Team Overview */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Team Management</h2>
          
          {/* Team Stats */}
          {chartData && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600">{chartData.totalMembers}</div>
                <div className="text-sm text-blue-800">Total Members</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600">{chartData.activeMembers}</div>
                <div className="text-sm text-green-800">Active Members</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-600">{chartData.pendingInvites}</div>
                <div className="text-sm text-yellow-800">Pending Invites</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600">{chartData.roles.length}</div>
                <div className="text-sm text-purple-800">Different Roles</div>
              </div>
            </div>
          )}

          {/* Team Members List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Team Members</h3>
              <button
                onClick={() => setShowInviteModal(true)}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Invite Member
              </button>
            </div>

            {teamMembers.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No team members yet.</p>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="mt-4 bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Invite First Member
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {teamMembers.map((member, index) => (
                  <div key={member._id || index} className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-emerald-600 font-medium">
                          {member.email?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">
                          {member.userId ? `${member.userId.firstName} ${member.userId.lastName}` : member.email}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {member.jobTitle || member.role} • Level {member.level || 1}
                        </p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        member.status === 'active' ? 'bg-green-100 text-green-800' :
                        member.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {member.status}
                      </span>
                      <span className="text-sm text-gray-500 capitalize">{member.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Departments & Roles - Chart */}
        {chartData && chartData.departments.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Department & Role Distribution</h3>
            
            {/* Department Chart */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-2">By Department</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chartData.departments.map(dept => (
                  <div key={dept.department} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">
                          {dept.department.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{dept.department}</p>
                        <p className="text-xs text-gray-500">{dept.count} members</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">
                      {Math.round((dept.count / chartData.totalMembers) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Role Chart */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">By Role</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {chartData.roles.map(role => (
                  <div key={role.role} className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-purple-600">
                          {role.role.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{role.role}</p>
                        <p className="text-xs text-gray-500">{role.count} members</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-700">
                      {Math.round((role.count / chartData.totalMembers) * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {showInviteModal && <InviteModal />}
        {/* Edit modal would go here - similar structure to invite modal */}
      </div>
    </main>
  );
};

export default BusinessTeam;