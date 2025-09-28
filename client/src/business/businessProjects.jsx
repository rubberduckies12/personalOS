import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FolderIcon,
  LinkIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';

// FIXED: Accept businessData prop to prevent separate loading
const BusinessProjects = ({ businessData }) => {
  const { businessId } = useParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(businessData || null);
  const [roadmapData, setRoadmapData] = useState(null);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [viewMode, setViewMode] = useState('roadmap'); // roadmap, list, kanban
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [draggedProject, setDraggedProject] = useState(null);

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

  // FIXED: Load only roadmap and project data when business data is passed
  const loadBusinessData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use passed business data or load from API
      let currentBusiness = businessData;
      if (!currentBusiness) {
        console.log('📊 Loading business data for ID:', businessId);
        const businessRes = await fetch(`http://localhost:5001/api/businesses/${businessId}`, createFetchOptions());
        
        if (businessRes.ok) {
          currentBusiness = await businessRes.json();
          console.log('✅ Business data loaded:', currentBusiness.name);
        } else {
          const errorText = await businessRes.text();
          console.error('❌ Failed to load business data:', businessRes.status, errorText);
          setLoading(false);
          return;
        }
      }
      setBusiness(currentBusiness);

      // FIXED: Use the existing linked-projects endpoint with better error handling
      console.log('🔗 Fetching linked projects...');
      const linkedProjectsRes = await fetch(`http://localhost:5001/api/businesses/${businessId}/linked-projects`, createFetchOptions());
      
      if (linkedProjectsRes.ok) {
        const linkedProjectsData = await linkedProjectsRes.json();
        console.log('✅ Linked projects data received:', linkedProjectsData);
        console.log('📊 Projects count:', linkedProjectsData.linkedProjects?.length || 0);
        
        if (linkedProjectsData.linkedProjects && linkedProjectsData.linkedProjects.length > 0) {
          // Transform the data into roadmap format
          const roadmapResult = transformToRoadmapFormat(linkedProjectsData);
          setRoadmapData(roadmapResult);
          console.log('✅ Roadmap data transformed successfully');
        } else {
          console.log('ℹ️  No linked projects found, creating empty structure');
          setRoadmapData(createEmptyRoadmapStructure());
        }
      } else {
        // Enhanced error logging
        const errorText = await linkedProjectsRes.text();
        console.error('❌ Failed to fetch linked projects:', {
          status: linkedProjectsRes.status,
          statusText: linkedProjectsRes.statusText,
          error: errorText
        });
        
        try {
          const errorJson = JSON.parse(errorText);
          console.error('📋 Server error details:', errorJson);
        } catch (parseError) {
          console.error('📋 Raw server response:', errorText);
        }
        
        console.warn('⚠️  Creating empty structure due to server error');
        setRoadmapData(createEmptyRoadmapStructure());
      }

      // Load available projects
      console.log('📋 Fetching available projects...');
      const availableProjectsRes = await fetch(`http://localhost:5001/api/businesses/${businessId}/available-projects`, createFetchOptions());
      
      if (availableProjectsRes.ok) {
        const availableProjectsData = await availableProjectsRes.json();
        console.log('✅ Available projects loaded:', availableProjectsData.availableProjects?.length || 0);
        setAvailableProjects(availableProjectsData.availableProjects || []);
      } else {
        const errorText = await availableProjectsRes.text();
        console.warn('⚠️  Failed to load available projects:', availableProjectsRes.status, errorText);
        setAvailableProjects([]);
      }

    } catch (error) {
      console.error('💥 Error in loadBusinessData:', error);
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      setRoadmapData(createEmptyRoadmapStructure());
      setAvailableProjects([]);
    } finally {
      setLoading(false);
    }
  }, [businessData, businessId]);

  // Transform linked projects data into roadmap format
  const transformToRoadmapFormat = (linkedProjectsData) => {
    const { linkedProjects } = linkedProjectsData;
    
    // Group projects by business phase
    const lanes = {
      research: [],
      development: [],
      launch: [],
      growth: [],
      maintenance: []
    };

    let totalMilestones = 0;
    let completedMilestones = 0;
    let overdueMilestones = 0;

    linkedProjects.forEach(linkedProject => {
      const phase = linkedProject.linkDetails.businessPhase || 'development';
      
      // Create project object with proper structure for rendering
      const projectData = {
        _id: linkedProject.linkId,
        businessPhase: phase,
        priority: linkedProject.linkDetails.priority,
        role: linkedProject.linkDetails.role,
        linkedAt: linkedProject.linkDetails.linkedAt,
        linkedBy: linkedProject.linkDetails.linkedBy,
        projectId: {
          _id: linkedProject.projectId,
          title: linkedProject.projectTitle,
          description: linkedProject.projectDescription,
          status: linkedProject.projectStatus,
          priority: linkedProject.projectPriority,
          category: linkedProject.projectCategory,
          createdAt: linkedProject.createdAt,
          updatedAt: linkedProject.updatedAt
        },
        projectDetails: {
          _id: linkedProject.projectId,
          title: linkedProject.projectTitle,
          description: linkedProject.projectDescription,
          status: linkedProject.projectStatus,
          priority: linkedProject.projectPriority,
          progress: linkedProject.projectProgress || 0,
          category: linkedProject.projectCategory,
          createdAt: linkedProject.createdAt,
          updatedAt: linkedProject.updatedAt,
          userId: linkedProject.projectOwner,
          totalMilestones: 0, // Will be updated if we have milestone data
          completedMilestones: 0,
          overdueMilestones: 0,
          timeMetrics: {
            daysUntilDeadline: null,
            isOverdue: false
          }
        }
      };

      // Add to appropriate lane
      lanes[phase].push(projectData);
    });

    return {
      phases: ['research', 'development', 'launch', 'growth', 'maintenance'],
      lanes,
      dependencies: [],
      timeline: {
        startDate: Date.now(),
        endDate: Date.now()
      },
      statistics: {
        totalProjects: linkedProjects.length,
        totalMilestones,
        completedMilestones,
        overdueMilestones,
        avgProgress: linkedProjects.length > 0 ? 
          Math.round(linkedProjects.reduce((sum, p) => sum + (p.projectProgress || 0), 0) / linkedProjects.length) : 0
      }
    };
  };

  // Create empty roadmap structure
  const createEmptyRoadmapStructure = () => ({
    phases: ['research', 'development', 'launch', 'growth', 'maintenance'],
    lanes: {
      research: [],
      development: [],
      launch: [],
      growth: [],
      maintenance: []
    },
    dependencies: [],
    statistics: {
      totalProjects: 0,
      totalMilestones: 0,
      completedMilestones: 0,
      overdueMilestones: 0,
      avgProgress: 0
    }
  });

  // FIXED: Update the linkProject function to use the correct endpoint
  const linkProject = async (projectId, phase = 'development', role = 'related', priority = 'medium') => {
    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/link-project`, 
        createFetchOptions({
          method: 'POST',
          body: JSON.stringify({
            projectId,
            businessPhase: phase,
            role,
            priority
          })
        })
      );

      if (response.ok) {
        setShowLinkModal(false);
        setSelectedProject(null);
        loadBusinessData(); // Refresh data
        console.log('✅ Project linked successfully');
      } else {
        const errorData = await response.json();
        console.error('Error linking project:', errorData);
        alert(`Error linking project: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error linking project:', error);
      alert('Error linking project. Please try again.');
    }
  };

  // FIXED: Update the unlinkProject function
  const unlinkProject = async (projectId) => {
    try {
      if (!window.confirm('Are you sure you want to unlink this project from the business?')) {
        return;
      }

      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/unlink-project/${projectId}`, 
        createFetchOptions({ method: 'DELETE' })
      );

      if (response.ok) {
        loadBusinessData(); // Refresh data
        console.log('✅ Project unlinked successfully');
      } else {
        const errorData = await response.json();
        console.error('Error unlinking project:', errorData);
        alert(`Error unlinking project: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error unlinking project:', error);
      alert('Error unlinking project. Please try again.');
    }
  };

  // FIXED: Update the updateProjectPhase function
  const updateProjectPhase = async (projectId, newPhase) => {
    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/projects/${projectId}/phase`, 
        createFetchOptions({
          method: 'PUT',
          body: JSON.stringify({
            businessPhase: newPhase
          })
        })
      );

      if (response.ok) {
        loadBusinessData(); // Refresh data
        console.log('✅ Project phase updated successfully');
      } else {
        console.warn('Phase update endpoint not available, refreshing data');
        loadBusinessData();
      }
    } catch (error) {
      console.error('Error updating project phase:', error);
      loadBusinessData(); // Refresh anyway
    }
  };

  // FIXED: Render project card with better error handling
  const renderProjectCard = (linkedProject, isRoadmapView = false) => {
    // FIXED: Handle the data structure properly
    const project = linkedProject.projectDetails || linkedProject.projectId || linkedProject;
    
    if (!project || !project.title) {
      console.warn('Invalid project data:', linkedProject);
      return null;
    }

    const isOverdue = project.timeMetrics?.isOverdue || false;
    const progress = project.progress || 0;
    const priority = linkedProject.priority || project.priority || 'medium';

    return (
      <div
        key={project._id}
        className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition-all duration-200 ${
          isOverdue ? 'border-red-200' : 'border-gray-200'
        }`}
        draggable={isRoadmapView}
        onDragStart={() => setDraggedProject(linkedProject)}
        onDragEnd={() => setDraggedProject(null)}
      >
        {/* Project Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-semibold text-gray-900 line-clamp-1">
                  {project.title}
                </h4>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  priority === 'critical' ? 'bg-red-100 text-red-800' :
                  priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {priority}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {project.description}
              </p>
            </div>
            
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/projects/${project._id}`);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Project"
              >
                <EyeIcon className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  unlinkProject(project._id);
                }}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Unlink Project"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex items-center space-x-2 mb-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  progress >= 100 ? 'bg-green-500' :
                  progress >= 75 ? 'bg-blue-500' :
                  progress >= 50 ? 'bg-yellow-500' :
                  'bg-orange-500'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
            <span className="text-xs font-medium text-gray-600">
              {progress}%
            </span>
          </div>

          {/* Project Metrics */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <CheckCircleIcon className="w-3 h-3" />
                <span>{project.completedMilestones || 0}/{project.totalMilestones || 0}</span>
              </span>
              <span className="flex items-center space-x-1">
                <UserGroupIcon className="w-3 h-3" />
                <span>{project.collaborators?.length || 0}</span>
              </span>
              {project.timeMetrics?.daysUntilDeadline !== undefined && (
                <span className={`flex items-center space-x-1 ${
                  project.timeMetrics.daysUntilDeadline < 0 ? 'text-red-600' :
                  project.timeMetrics.daysUntilDeadline <= 7 ? 'text-orange-600' :
                  'text-gray-500'
                }`}>
                  <CalendarDaysIcon className="w-3 h-3" />
                  <span>
                    {project.timeMetrics.daysUntilDeadline < 0 
                      ? `${Math.abs(project.timeMetrics.daysUntilDeadline)}d overdue`
                      : `${project.timeMetrics.daysUntilDeadline}d left`
                    }
                  </span>
                </span>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                project.status === 'completed' ? 'bg-green-100 text-green-800' :
                project.status === 'active' ? 'bg-blue-100 text-blue-800' :
                project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {project.status}
              </span>
              
              {/* Business Role Badge */}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                linkedProject.role === 'primary' ? 'bg-purple-100 text-purple-800' :
                linkedProject.role === 'supporting' ? 'bg-indigo-100 text-indigo-800' :
                linkedProject.role === 'dependency' ? 'bg-orange-100 text-orange-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {linkedProject.role || 'related'}
              </span>
            </div>
          </div>
        </div>

        {/* Business Link Info */}
        <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600">
          <div className="flex items-center justify-between">
            <span>Business Phase: <strong className="capitalize">{linkedProject.businessPhase || 'development'}</strong></span>
            <span>Linked: {new Date(linkedProject.linkedAt).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    );
  };

  // Render roadmap lane
  const renderRoadmapLane = (phaseName, projects) => (
    <div
      key={phaseName}
      className="flex-1 min-w-80"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (draggedProject && draggedProject.businessPhase !== phaseName) {
          const projectId = draggedProject.projectDetails?._id || 
                           draggedProject.projectId?._id || 
                           draggedProject._id;
          if (projectId) {
            updateProjectPhase(projectId, phaseName);
          }
        }
      }}
    >
      <div className="bg-gray-50 rounded-lg p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 capitalize">
            {phaseName.replace('_', ' ')} ({Array.isArray(projects) ? projects.length : 0})
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"></div>
          </div>
        </div>
        
        <div className="space-y-3 min-h-40">
          {Array.isArray(projects) && projects.map(project => {
            const renderedCard = renderProjectCard(project, true);
            return renderedCard;
          })}
          
          {(!Array.isArray(projects) || projects.length === 0) && (
            <div className="text-center py-8 text-gray-400">
              <FolderIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No projects in this phase</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render link project modal
  const renderLinkModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Link Project to Business</h3>
          <button
            onClick={() => setShowLinkModal(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {availableProjects.length === 0 ? (
            <div className="text-center py-8">
              <FolderIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No available projects to link</p>
              <button
                onClick={() => navigate('/projects/new')}
                className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Create New Project
              </button>
            </div>
          ) : (
            availableProjects.map(project => (
              <div key={project._id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-emerald-300 transition-colors">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{project.title}</h4>
                  <p className="text-sm text-gray-600 line-clamp-2">{project.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-xs text-gray-500">Status: {project.status}</span>
                    <span className="text-xs text-gray-500">Priority: {project.priority}</span>
                    <span className="text-xs text-gray-500">Category: {project.category}</span>
                  </div>
                </div>
                <div className="ml-4 space-y-2">
                  <select
                    defaultValue="development"
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                    onChange={(e) => setSelectedProject({ ...project, selectedPhase: e.target.value })}
                  >
                    <option value="research">Research</option>
                    <option value="development">Development</option>
                    <option value="launch">Launch</option>
                    <option value="growth">Growth</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                  <button
                    onClick={() => linkProject(
                      project._id, 
                      selectedProject?.selectedPhase || 'development'
                    )}
                    className="block w-full bg-emerald-600 text-white px-3 py-1 rounded text-sm hover:bg-emerald-700 transition-colors"
                  >
                    Link Project
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Load data on mount or when businessData changes
  useEffect(() => {
    if (businessId && (!businessData || businessData._id !== businessId)) {
      loadBusinessData();
    } else if (businessData) {
      // Use passed business data immediately and load project data
      setBusiness(businessData);
      loadBusinessData(); // Still load project-specific data
    }
  }, [businessId, businessData, loadBusinessData]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading business projects...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (!business) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <p className="text-gray-600">No business data available</p>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
            <p className="text-gray-600">Manage projects linked to {business.name}</p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('roadmap')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'roadmap' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Roadmap
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                List
              </button>
            </div>

            <button
              onClick={() => setShowLinkModal(true)}
              className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-2"
            >
              <LinkIcon className="w-4 h-4" />
              <span>Link Project</span>
            </button>
          </div>
        </div>

        {/* Statistics */}
        {roadmapData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100">
                  <FolderIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Projects</p>
                  <p className="text-2xl font-semibold text-gray-900">{roadmapData.statistics.totalProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-green-100">
                  <CheckCircleIconSolid className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Progress</p>
                  <p className="text-2xl font-semibold text-gray-900">{roadmapData.statistics.avgProgress}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-yellow-100">
                  <ClockIcon className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed Milestones</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {roadmapData.statistics.completedMilestones}/{roadmapData.statistics.totalMilestones}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-red-100">
                  <ExclamationTriangleIconSolid className="w-6 h-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Overdue</p>
                  <p className="text-2xl font-semibold text-gray-900">{roadmapData.statistics.overdueMilestones}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {viewMode === 'roadmap' ? (
          // Roadmap View
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex space-x-6 overflow-x-auto pb-4">
              {roadmapData?.phases?.map(phase => 
                renderRoadmapLane(phase, roadmapData.lanes[phase])
              )}
            </div>
          </div>
        ) : (
          // List View
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">All Linked Projects</h3>
              
              {roadmapData?.statistics?.totalProjects === 0 ? (
                <div className="text-center py-12">
                  <FolderIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No projects linked</h3>
                  <p className="text-gray-500 mb-6">Link existing projects to this business to get started.</p>
                  <button
                    onClick={() => setShowLinkModal(true)}
                    className="bg-emerald-600 text-white px-6 py-3 rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Link Your First Project
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                  {Object.values(roadmapData?.lanes || {}).flat().map(project => 
                    renderProjectCard(project, false)
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Debug Info - Enhanced */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <details>
              <summary className="text-xs text-yellow-800 cursor-pointer">Debug Information</summary>
              <div className="mt-2 space-y-1 text-xs text-yellow-700">
                <p><strong>Business ID:</strong> {businessId}</p>
                <p><strong>Business Name:</strong> {business?.name}</p>
                <p><strong>Roadmap phases:</strong> {Object.keys(roadmapData?.lanes || {}).length}</p>
                <p><strong>Total projects in roadmap:</strong> {Object.values(roadmapData?.lanes || {}).reduce((sum, projects) => sum + (Array.isArray(projects) ? projects.length : 0), 0)}</p>
                <p><strong>Available to link:</strong> {availableProjects.length}</p>
                <p><strong>Phase breakdown:</strong></p>
                {roadmapData?.phases?.map(phase => (
                  <p key={phase} className="ml-4">
                    • {phase}: {Array.isArray(roadmapData.lanes[phase]) ? roadmapData.lanes[phase].length : 0} projects
                  </p>
                ))}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Link Project Modal */}
      {showLinkModal && renderLinkModal()}
    </main>
  );
};

export default BusinessProjects;