import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FolderIcon,
  PlusIcon,
  LinkIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowRightIcon,
  ChartBarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  CogIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import {
  CheckCircleIcon as CheckCircleIconSolid,
  ExclamationTriangleIcon as ExclamationTriangleIconSolid
} from '@heroicons/react/24/solid';
import BusinessHeader from './businessHeader';

const BusinessProjects = () => {
  const { businessId } = useParams();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [business, setBusiness] = useState(null);
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

  // Load data
  const loadBusinessData = async () => {
    try {
      setLoading(true);
      const [businessRes, roadmapRes, projectsRes] = await Promise.all([
        fetch(`http://localhost:5001/api/businesses/${businessId}`, createFetchOptions()),
        fetch(`http://localhost:5001/api/businesses/${businessId}/projects/roadmap`, createFetchOptions()),
        fetch(`http://localhost:5001/api/projects?status=all&limit=100`, createFetchOptions())
      ]);

      if (businessRes.ok) {
        const businessData = await businessRes.json();
        setBusiness(businessData);
      }

      if (roadmapRes.ok) {
        const roadmap = await roadmapRes.json();
        setRoadmapData(roadmap);
      }

      if (projectsRes.ok) {
        const projectsData = await projectsRes.json();
        const linkedProjectIds = roadmapData?.lanes ? 
          Object.values(roadmapData.lanes).flat().map(p => p.projectId._id) : [];
        const unlinkedProjects = projectsData.projects.filter(p => 
          !linkedProjectIds.includes(p._id)
        );
        setAvailableProjects(unlinkedProjects);
      }

    } catch (error) {
      console.error('Error loading business projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessId) {
      loadBusinessData();
    }
  }, [businessId]);

  // Milestone status helpers
  const getMilestoneStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getMilestoneIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircleIconSolid className="w-4 h-4 text-green-600" />;
      case 'overdue': return <ExclamationTriangleIconSolid className="w-4 h-4 text-red-600" />;
      case 'pending': return <ClockIcon className="w-4 h-4 text-blue-600" />;
      default: return <ClockIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  // Link project to business
  const linkProject = async (projectId, phase = 'development', role = 'related', priority = 'medium') => {
    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/projects`, 
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
      }
    } catch (error) {
      console.error('Error linking project:', error);
    }
  };

  // Unlink project from business
  const unlinkProject = async (projectId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/projects/${projectId}`, 
        createFetchOptions({ method: 'DELETE' })
      );

      if (response.ok) {
        loadBusinessData(); // Refresh data
      }
    } catch (error) {
      console.error('Error unlinking project:', error);
    }
  };

  // Update project phase (drag & drop)
  const updateProjectPhase = async (projectId, newPhase) => {
    try {
      const response = await fetch(`http://localhost:5001/api/businesses/${businessId}/projects/${projectId}/roadmap`, 
        createFetchOptions({
          method: 'PUT',
          body: JSON.stringify({
            businessPhase: newPhase
          })
        })
      );

      if (response.ok) {
        loadBusinessData(); // Refresh data
      }
    } catch (error) {
      console.error('Error updating project phase:', error);
    }
  };

  // Render project card
  const renderProjectCard = (linkedProject, isRoadmapView = false) => {
    const project = linkedProject.projectDetails;
    const isOverdue = project.timeMetrics.isOverdue;
    const progress = project.progress;

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
                  linkedProject.priority === 'critical' ? 'bg-red-100 text-red-800' :
                  linkedProject.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                  linkedProject.priority === 'medium' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {linkedProject.priority}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {project.description}
              </p>
            </div>
            
            <div className="flex items-center space-x-1 ml-2">
              <button
                onClick={() => navigate(`/projects/${project._id}`)}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="View Project"
              >
                <EyeIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => unlinkProject(project._id)}
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
                <span>{project.completedMilestones}/{project.totalMilestones}</span>
              </span>
              <span className="flex items-center space-x-1">
                <UserGroupIcon className="w-3 h-3" />
                <span>{project.collaborators?.length || 0}</span>
              </span>
              {project.timeMetrics.daysUntilDeadline && (
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
            
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
              project.status === 'completed' ? 'bg-green-100 text-green-800' :
              project.status === 'active' ? 'bg-blue-100 text-blue-800' :
              project.status === 'on_hold' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {project.status}
            </span>
          </div>
        </div>

        {/* Milestones Roadmap */}
        {isRoadmapView && project.roadmapMilestones && project.roadmapMilestones.length > 0 && (
          <div className="p-3">
            <div className="flex items-center space-x-2 mb-3">
              <ChartBarIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-700">Milestone Roadmap</span>
            </div>
            
            <div className="space-y-2">
              {project.roadmapMilestones.slice(0, 3).map((milestone, index) => (
                <div key={milestone.id} className="flex items-center space-x-2">
                  <div className="flex items-center space-x-1">
                    {getMilestoneIcon(milestone.status)}
                    <span className="text-xs text-gray-600">
                      {index + 1}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`px-2 py-1 rounded-md border text-xs ${getMilestoneStatusColor(milestone.status)}`}>
                      <div className="font-medium line-clamp-1">{milestone.title}</div>
                      {milestone.dueDate && (
                        <div className="text-xs opacity-75">
                          Due: {new Date(milestone.dueDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  {index < project.roadmapMilestones.length - 1 && (
                    <ArrowRightIcon className="w-3 h-3 text-gray-300" />
                  )}
                </div>
              ))}
              
              {project.roadmapMilestones.length > 3 && (
                <div className="text-xs text-gray-500 text-center pt-1">
                  +{project.roadmapMilestones.length - 3} more milestones
                </div>
              )}
            </div>
          </div>
        )}
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
          updateProjectPhase(draggedProject.projectId._id, phaseName);
        }
      }}
    >
      <div className="bg-gray-50 rounded-lg p-4 h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 capitalize">
            {phaseName.replace('_', ' ')} ({projects.length})
          </h3>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500"></div>
          </div>
        </div>
        
        <div className="space-y-3 min-h-40">
          {projects.map(project => renderProjectCard(project, true))}
          
          {projects.length === 0 && (
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <BusinessHeader business={business} activeTab="projects" />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <BusinessHeader business={business} activeTab="projects" />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Controls Header */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Project Roadmap</h2>
                <p className="text-sm text-gray-600">
                  Visualize and manage projects linked to this business
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('roadmap')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === 'roadmap' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Roadmap
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      viewMode === 'list' 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    List
                  </button>
                </div>
                
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-2"
                >
                  <LinkIcon className="w-4 h-4" />
                  <span>Link Project</span>
                </button>
              </div>
            </div>

            {/* Statistics */}
            {roadmapData?.statistics && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-emerald-600">
                    {roadmapData.statistics.totalProjects}
                  </div>
                  <div className="text-xs text-gray-600">Total Projects</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-blue-600">
                    {roadmapData.statistics.totalMilestones}
                  </div>
                  <div className="text-xs text-gray-600">Total Milestones</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">
                    {roadmapData.statistics.completedMilestones}
                  </div>
                  <div className="text-xs text-gray-600">Completed</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-600">
                    {roadmapData.statistics.overdueMilestones}
                  </div>
                  <div className="text-xs text-gray-600">Overdue</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-2xl font-bold text-purple-600">
                    {roadmapData.statistics.avgProgress}%
                  </div>
                  <div className="text-xs text-gray-600">Avg Progress</div>
                </div>
              </div>
            )}
          </div>

          {/* Roadmap View */}
          {viewMode === 'roadmap' && roadmapData?.lanes && (
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex space-x-6 overflow-x-auto pb-4">
                {roadmapData.phases.map(phase => 
                  renderRoadmapLane(phase, roadmapData.lanes[phase] || [])
                )}
              </div>
            </div>
          )}

          {/* List View */}
          {viewMode === 'list' && roadmapData?.lanes && (
            <div className="space-y-6">
              {roadmapData.phases.map(phase => {
                const projects = roadmapData.lanes[phase] || [];
                if (projects.length === 0) return null;

                return (
                  <div key={phase} className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 capitalize">
                      {phase.replace('_', ' ')} ({projects.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map(project => renderProjectCard(project, false))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {(!roadmapData?.statistics || roadmapData.statistics.totalProjects === 0) && (
            <div className="bg-white rounded-xl shadow-sm p-12 text-center">
              <FolderIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Projects Linked</h3>
              <p className="text-gray-500 mb-6">
                Start by linking existing projects or create new ones for this business.
              </p>
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setShowLinkModal(true)}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-2"
                >
                  <LinkIcon className="w-5 h-5" />
                  <span>Link Existing Project</span>
                </button>
                <button
                  onClick={() => navigate('/projects/new')}
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center space-x-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Create New Project</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showLinkModal && renderLinkModal()}
    </div>
  );
};

export default BusinessProjects;
