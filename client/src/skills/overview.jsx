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
  EllipsisHorizontalIcon,
  PlusIcon,
  EyeIcon,
  XMarkIcon,
  TrophyIcon,
  FireIcon,
  StarIcon,
  LockClosedIcon,
  ClockIcon,
  CheckCircleIcon,
  PlayIcon,
  BookOpenIcon,
  ArrowPathIcon,
  BoltIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';

const Overview = () => {
  const navigate = useNavigate();
  
  // State
  const [loading, setLoading] = useState(true);
  const [skills, setSkills] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [skillsStats, setSkillsStats] = useState({
    overview: { total: 0, learning: 0, practicing: 0, mastered: 0, totalPracticeTime: 0 },
    categoryBreakdown: [],
    levelDistribution: []
  });
  
  // Modal states
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Skill categories with matching color scheme
  const skillCategories = [
    { id: 'technical', name: 'Technical', icon: CpuChipIcon, color: 'from-blue-500 to-blue-600', theme: 'Cyber' },
    { id: 'programming', name: 'Programming', icon: CodeBracketIcon, color: 'from-green-500 to-green-600', theme: 'Matrix' },
    { id: 'design', name: 'Design', icon: PaintBrushIcon, color: 'from-pink-500 to-pink-600', theme: 'Creative' },
    { id: 'business', name: 'Business', icon: BriefcaseIcon, color: 'from-indigo-500 to-indigo-600', theme: 'Corporate' },
    { id: 'leadership', name: 'Leadership', icon: UserGroupIcon, color: 'from-orange-500 to-orange-600', theme: 'Command' },
    { id: 'communication', name: 'Communication', icon: ChatBubbleLeftRightIcon, color: 'from-purple-500 to-purple-600', theme: 'Social' },
    { id: 'language', name: 'Language', icon: GlobeAltIcon, color: 'from-teal-500 to-teal-600', theme: 'Linguistic' },
    { id: 'creative', name: 'Creative', icon: SparklesIcon, color: 'from-yellow-500 to-yellow-600', theme: 'Artistic' },
    { id: 'analytical', name: 'Analytical', icon: ChartBarIcon, color: 'from-cyan-500 to-cyan-600', theme: 'Logic' },
    { id: 'academic', name: 'Academic', icon: AcademicCapIcon, color: 'from-red-500 to-red-600', theme: 'Scholar' },
    { id: 'trade', name: 'Trade', icon: WrenchScrewdriverIcon, color: 'from-gray-500 to-gray-600', theme: 'Craft' },
    { id: 'personal', name: 'Personal', icon: HeartIcon, color: 'from-rose-500 to-rose-600', theme: 'Life' }
  ];

  // Skill levels with matching color scheme
  const skillLevels = [
    { id: 'beginner', name: 'Novice', xp: 0, color: 'text-gray-500', bgColor: 'bg-gray-100', icon: '🌱' },
    { id: 'novice', name: 'Apprentice', xp: 100, color: 'text-green-600', bgColor: 'bg-green-100', icon: '🌿' },
    { id: 'intermediate', name: 'Journeyman', xp: 500, color: 'text-blue-600', bgColor: 'bg-blue-100', icon: '⚡' },
    { id: 'advanced', name: 'Expert', xp: 1500, color: 'text-indigo-600', bgColor: 'bg-indigo-100', icon: '🔮' },
    { id: 'expert', name: 'Master', xp: 3000, color: 'text-orange-600', bgColor: 'bg-orange-100', icon: '👑' },
    { id: 'master', name: 'Grandmaster', xp: 5000, color: 'text-red-600', bgColor: 'bg-red-100', icon: '🏆' }
  ];

  // Get level info
  const getLevelInfo = (levelId) => {
    return skillLevels.find(l => l.id === levelId) || skillLevels[0];
  };

  // Get category info
  const getCategoryInfo = (categoryId) => {
    return skillCategories.find(c => c.id === categoryId) || skillCategories[0];
  };

  // Calculate skill tree position (gaming layout)
  const getSkillTreePosition = (skills, categoryId) => {
    const categorySkills = skills.filter(s => s.category === categoryId);
    const positions = [];
    
    // Arrange skills in a tree-like structure
    categorySkills.forEach((skill, index) => {
      const row = Math.floor(index / 4); // 4 skills per row
      const col = index % 4;
      const levelInfo = getLevelInfo(skill.currentLevel);
      
      positions.push({
        ...skill,
        position: {
          x: col * 180 + (row % 2) * 90, // Offset every other row
          y: row * 120,
          level: levelInfo,
          unlocked: skill.status !== 'not_started' || skill.progressPercentage > 0
        }
      });
    });
    
    return positions;
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

      // Load skills and analytics
      const [skillsResponse, analyticsResponse] = await Promise.all([
        fetch('http://localhost:5001/api/skills?limit=1000', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('http://localhost:5001/api/skills/analytics/overview', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (skillsResponse.status === 401 || analyticsResponse.status === 401) {
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        navigate('/auth/login');
        return;
      }

      if (skillsResponse.ok) {
        const skillsData = await skillsResponse.json();
        setSkills(skillsData.skills || []);
      }

      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setSkillsStats(analyticsData);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading skills data:', error);
      setLoading(false);
    }
  };

  // Load specific skill details
  const loadSkillDetails = async (skillId) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(`http://localhost:5001/api/skills/${skillId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const skillData = await response.json();
        setSelectedSkill(skillData);
        setShowSkillModal(true);
      }
    } catch (error) {
      console.error('Error loading skill details:', error);
    }
  };

  // Filter skills by category
  const getFilteredSkills = () => {
    if (selectedCategory === 'all') return skills;
    return skills.filter(skill => skill.category === selectedCategory);
  };

  // Get total XP (practice time as XP)
  const getTotalXP = () => {
    return skillsStats.overview.totalPracticeTime || 0;
  };

  // Get player level based on total XP
  const getPlayerLevel = () => {
    const totalXP = getTotalXP();
    const level = skillLevels.findIndex(l => totalXP < l.xp);
    return level === -1 ? skillLevels.length : Math.max(1, level);
  };

  // Helper function to get rating stars
  const getRatingStars = (rating) => {
    return Array.from({ length: 5 }, (_, i) => (
      <StarIcon
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
      />
    ));
  };

  useEffect(() => {
    loadSkillsData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  const playerLevel = getPlayerLevel();
  const totalXP = getTotalXP();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header with matching color scheme */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Player Stats */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center border-2 border-blue-400">
                  <span className="text-white font-bold">Lv.{playerLevel}</span>
                </div>
                <div>
                  <h2 className="text-gray-900 font-bold text-lg">Skills Mastery</h2>
                  <div className="flex items-center space-x-2">
                    <span className="text-blue-600 text-sm">XP: {totalXP.toLocaleString()}</span>
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full"
                        style={{ width: `${Math.min(100, (totalXP / (skillLevels[Math.min(playerLevel, skillLevels.length - 1)]?.xp || 1)) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{skillsStats.overview.mastered}</div>
                  <div className="text-xs text-gray-500">Mastered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{skillsStats.overview.learning + skillsStats.overview.practicing}</div>
                  <div className="text-xs text-gray-500">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-indigo-600">{skillsStats.overview.total}</div>
                  <div className="text-xs text-gray-500">Total</div>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2 shadow-lg"
            >
              <PlusIcon className="w-5 h-5" />
              <span>Learn New Skill</span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Selection Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto space-x-1 py-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <EllipsisHorizontalIcon className="w-4 h-4" />
              <span>All Skills</span>
              <span className={`px-2 py-1 rounded text-xs ${selectedCategory === 'all' ? 'bg-white/20' : 'bg-gray-200'}`}>
                {skills.length}
              </span>
            </button>
            
            {skillCategories.map(category => {
              const Icon = category.icon;
              const categorySkills = skills.filter(s => s.category === category.id);
              
              return (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center space-x-2 px-4 py-3 rounded-lg font-medium text-sm transition-all whitespace-nowrap ${
                    selectedCategory === category.id
                      ? `bg-gradient-to-r ${category.color} text-white shadow-lg`
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{category.name}</span>
                  <span className={`px-2 py-1 rounded text-xs ${selectedCategory === category.id ? 'bg-white/20' : 'bg-gray-200'}`}>
                    {categorySkills.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedCategory === 'all' ? (
          // All Categories Overview
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {skillCategories.map(category => {
              const Icon = category.icon;
              const categorySkills = skills.filter(s => s.category === category.id);
              const masteredCount = categorySkills.filter(s => s.status === 'mastered').length;
              const activeCount = categorySkills.filter(s => s.status === 'learning' || s.status === 'practicing').length;
              
              return (
                <div
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className="relative bg-white rounded-xl p-6 cursor-pointer hover:scale-105 transition-all duration-300 border border-gray-200 hover:border-blue-300 hover:shadow-lg group"
                >
                  {/* Category Icon */}
                  <div className={`w-16 h-16 mx-auto mb-4 bg-gradient-to-r ${category.color} rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all`}>
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  
                  {/* Category Info */}
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{category.name}</h3>
                    <p className="text-gray-500 text-sm mb-3">{category.theme} Tree</p>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-gray-900 font-bold">{categorySkills.length}</div>
                        <div className="text-gray-500">Skills</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-green-600 font-bold">{masteredCount}</div>
                        <div className="text-gray-500">Mastered</div>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-blue-600 font-bold">{activeCount}</div>
                        <div className="text-gray-500">Active</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Unlock indicator */}
                  {categorySkills.length > 0 && (
                    <div className="absolute -top-2 -right-2">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                        <CheckCircleIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          // Category Skills Tree
          <div className="space-y-8">
            {/* Category Header */}
            <div className="text-center">
              {(() => {
                const categoryInfo = getCategoryInfo(selectedCategory);
                const Icon = categoryInfo.icon;
                const categorySkills = getFilteredSkills();
                
                return (
                  <div className="inline-flex items-center space-x-4 bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                    <div className={`w-16 h-16 bg-gradient-to-r ${categoryInfo.color} rounded-xl flex items-center justify-center shadow-lg`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    <div className="text-left">
                      <h2 className="text-2xl font-bold text-gray-900">{categoryInfo.name} Tree</h2>
                      <p className="text-gray-500">{categoryInfo.theme} • {categorySkills.length} Skills</p>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Skills Tree */}
            <div className="relative">
              {(() => {
                const filteredSkills = getFilteredSkills();
                
                if (filteredSkills.length === 0) {
                  return (
                    <div className="text-center py-20">
                      <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-r from-gray-400 to-gray-500 rounded-xl flex items-center justify-center">
                        <LockClosedIcon className="w-12 h-12 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No Skills in This Tree</h3>
                      <p className="text-gray-500 mb-6">Start your journey in the {getCategoryInfo(selectedCategory).name} skill tree.</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200"
                      >
                        Add First Skill
                      </button>
                    </div>
                  );
                }
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {filteredSkills.map((skill, index) => {
                      const levelInfo = getLevelInfo(skill.currentLevel);
                      const targetLevelInfo = getLevelInfo(skill.targetLevel);
                      const isUnlocked = skill.status !== 'not_started' || skill.progressPercentage > 0;
                      const categoryInfo = getCategoryInfo(skill.category);
                      
                      return (
                        <div
                          key={skill._id}
                          onClick={() => loadSkillDetails(skill._id)}
                          className={`relative bg-white rounded-xl p-6 cursor-pointer transition-all duration-300 border ${
                            isUnlocked 
                              ? 'border-gray-200 hover:border-blue-300 hover:scale-105 hover:shadow-lg' 
                              : 'border-gray-200 opacity-75'
                          } group`}
                        >
                          {/* Status Indicator */}
                          <div className="absolute -top-2 -right-2">
                            {skill.status === 'mastered' ? (
                              <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                                <TrophyIcon className="w-5 h-5 text-white" />
                              </div>
                            ) : skill.status === 'learning' || skill.status === 'practicing' ? (
                              <div className="w-8 h-8 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg">
                                <FireIcon className="w-5 h-5 text-white" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-500 rounded-full flex items-center justify-center border-2 border-white">
                                <LockClosedIcon className="w-5 h-5 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Skill Content */}
                          <div className="text-center">
                            {/* Level Badge */}
                            <div className={`inline-flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium mb-3 ${levelInfo.bgColor} ${levelInfo.color}`}>
                              <span>{levelInfo.icon}</span>
                              <span>{levelInfo.name}</span>
                            </div>
                            
                            {/* Skill Name */}
                            <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors">
                              {skill.name}
                            </h3>
                            
                            {/* Progress Bar */}
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-sm text-gray-500 mb-1">
                                <span>Progress</span>
                                <span>{skill.progressPercentage || 0}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`bg-gradient-to-r ${categoryInfo.color} h-2 rounded-full transition-all duration-500`}
                                  style={{ width: `${skill.progressPercentage || 0}%` }}
                                ></div>
                              </div>
                            </div>
                            
                            {/* Skill Stats */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="bg-gray-50 rounded-lg p-2">
                                <div className="text-gray-900 font-bold">{Math.round((skill.totalPracticeTime || 0) / 60)}h</div>
                                <div className="text-gray-500">Practice</div>
                              </div>
                              <div className="bg-gray-50 rounded-lg p-2">
                                <div className="text-blue-600 font-bold">{targetLevelInfo.name}</div>
                                <div className="text-gray-500">Target</div>
                              </div>
                            </div>
                            
                            {/* Skill Description Preview */}
                            {skill.description && (
                              <p className="text-gray-500 text-xs mt-3 line-clamp-2">
                                {skill.description}
                              </p>
                            )}
                          </div>

                          {/* Connection Lines (for tree effect) */}
                          {index > 0 && index % 4 !== 0 && (
                            <div className="absolute left-0 top-1/2 w-6 h-0.5 bg-gradient-to-r from-transparent to-blue-300 -translate-x-6 -translate-y-1/2"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Skill Details Modal */}
      {showSkillModal && selectedSkill && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  {(() => {
                    const levelInfo = getLevelInfo(selectedSkill.currentLevel);
                    const categoryInfo = getCategoryInfo(selectedSkill.category);
                    const Icon = categoryInfo.icon;
                    
                    return (
                      <>
                        <div className={`w-16 h-16 bg-gradient-to-r ${categoryInfo.color} rounded-xl flex items-center justify-center shadow-lg`}>
                          <Icon className="w-8 h-8 text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold text-gray-900">{selectedSkill.name}</h3>
                          <div className="flex items-center space-x-3 mt-1">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${levelInfo.bgColor} ${levelInfo.color}`}>
                              {levelInfo.icon} {levelInfo.name}
                            </span>
                            <span className="text-gray-500 text-sm">{selectedSkill.category}</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
                <button
                  onClick={() => { setShowSkillModal(false); setSelectedSkill(null); }}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column - Skill Info */}
                <div className="space-y-6">
                  {/* Description */}
                  {selectedSkill.description && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Description</h4>
                      <p className="text-gray-600 leading-relaxed">{selectedSkill.description}</p>
                    </div>
                  )}

                  {/* Progress Overview */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Progress Overview</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
                          <span>Overall Progress</span>
                          <span>{selectedSkill.analytics?.progressPercentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-indigo-500 h-3 rounded-full transition-all duration-500"
                            style={{ width: `${selectedSkill.analytics?.progressPercentage || 0}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-blue-600">
                            {Math.round((selectedSkill.analytics?.totalPracticeTime || 0) / 60)}
                          </div>
                          <div className="text-sm text-gray-500">Hours</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-green-600">
                            {selectedSkill.analytics?.practiceStreak || 0}
                          </div>
                          <div className="text-sm text-gray-500">Day Streak</div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-orange-600">
                            {selectedSkill.analytics?.avgPracticeEffectiveness || 0}
                          </div>
                          <div className="text-sm text-gray-500">Avg Rating</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Tags */}
                  {selectedSkill.tags && selectedSkill.tags.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-3">Tags</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSkill.tags.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full border border-blue-200">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Learning Plan & Practice */}
                <div className="space-y-6">
                  {/* Learning Plan */}
                  {selectedSkill.learningPlan?.phases && selectedSkill.learningPlan.phases.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Learning Path</h4>
                      <div className="space-y-3">
                        {selectedSkill.learningPlan.phases.map((phase, index) => (
                          <div
                            key={index}
                            className={`p-4 rounded-lg border transition-colors ${
                              phase.completed 
                                ? 'bg-green-50 border-green-200' 
                                : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex items-start space-x-3 flex-1">
                                <div className="mt-0.5">
                                  {phase.completed ? (
                                    <CheckCircleIcon className="w-5 h-5 text-green-500" />
                                  ) : (
                                    <ClockIcon className="w-5 h-5 text-gray-400" />
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h6 className={`font-medium text-sm ${phase.completed ? 'text-green-900' : 'text-gray-900'}`}>
                                    {phase.title}
                                  </h6>
                                  {phase.description && (
                                    <p className="text-xs text-gray-500 mt-1">{phase.description}</p>
                                  )}
                                  {phase.estimatedDuration && (
                                    <p className="text-xs text-blue-600 mt-1">
                                      ~{phase.estimatedDuration} weeks
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recent Practice */}
                  {selectedSkill.practiceLog && selectedSkill.practiceLog.length > 0 && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Recent Practice</h4>
                      <div className="space-y-3 max-h-60 overflow-y-auto">
                        {selectedSkill.practiceLog.slice(-5).reverse().map((session, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-900">
                                {session.activity}
                              </span>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span>{session.duration} min</span>
                                {session.effectiveness && (
                                  <div className="flex items-center space-x-1">
                                    <StarIcon className="w-3 h-3 text-yellow-400" />
                                    <span>{session.effectiveness}/5</span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(session.practiceDate).toLocaleDateString()}
                            </div>
                            {session.notes && (
                              <p className="text-xs text-gray-600 mt-1">{session.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Linked Resources */}
                  {selectedSkill.linkedResources && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Linked Resources</h4>
                      <div className="space-y-3">
                        {selectedSkill.linkedResources.projects?.length > 0 && (
                          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                            <h6 className="text-sm font-medium text-blue-700 mb-2">Projects ({selectedSkill.linkedResources.projects.length})</h6>
                          </div>
                        )}
                        {selectedSkill.linkedResources.books?.length > 0 && (
                          <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                            <h6 className="text-sm font-medium text-green-700 mb-2">Books ({selectedSkill.linkedResources.books.length})</h6>
                          </div>
                        )}
                        {selectedSkill.linkedResources.courses?.length > 0 && (
                          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-200">
                            <h6 className="text-sm font-medium text-indigo-700 mb-2">Courses ({selectedSkill.linkedResources.courses.length})</h6>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-6 border-t border-gray-200">
                <button
                  onClick={() => { setShowSkillModal(false); setSelectedSkill(null); }}
                  className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Skill Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg border border-gray-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center">
                <PlusIcon className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Create New Skill</h3>
              <p className="text-gray-500 mb-6">This will redirect you to the skill creation form.</p>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    navigate('/skills/create');
                  }}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overview;