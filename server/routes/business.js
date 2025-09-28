const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');

// Import models and middleware - Fixed import
const Business = require('../models/businessModel');
const Account = require('../models/accountModel'); // Changed from User to Account
const Project = require('../models/projectsModel');
const Task = require('../models/tasksModel');
const { authenticateUser } = require('../middleware/auth');

// Helper function to generate invite token
const generateInviteToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Helper function to get user's businesses (owned + member)
const getUserBusinesses = async (userId) => {
  return await Business.find({
    $or: [
      { ownerId: userId },
      { 'teamMembers.userId': userId, 'teamMembers.status': 'active' }
    ],
    status: { $ne: 'closed' },
    archivedAt: { $exists: false }
  }).populate([
    { path: 'ownerId', select: 'firstName lastName email' },
    { path: 'teamMembers.userId', select: 'firstName lastName email' },
    { path: 'linkedProjects.projectId', select: 'title status priority' }
  ]).sort({ updatedAt: -1 });
};

// ============================================================================
// BUSINESS CRUD OPERATIONS
// ============================================================================

// GET /api/businesses - List all businesses for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    console.log('📊 Fetching businesses for user:', req.userId);
    
    const { 
      page = 1, 
      limit = 10, 
      status = 'all',
      industry = 'all',
      search = '',
      sortBy = 'updatedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter
    const filter = {
      $or: [
        { ownerId: req.userId },
        { 'teamMembers.userId': req.userId, 'teamMembers.status': 'active' }
      ],
      archivedAt: { $exists: false }
    };

    if (status !== 'all') {
      filter.status = status;
    }

    if (industry !== 'all') {
      filter.industry = industry;
    }

    if (search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      });
    }

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const businesses = await Business.find(filter)
      .populate([
        { path: 'ownerId', select: 'firstName lastName email avatar' },
        { path: 'teamMembers.userId', select: 'firstName lastName email avatar' },
        { path: 'linkedProjects.projectId', select: 'title status priority targetCompletionDate' }
      ])
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Business.countDocuments(filter);

    console.log(`✅ Found ${businesses.length} businesses for user`);

    res.json({
      businesses,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: parseInt(limit)
      }
    });

  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ error: 'Failed to fetch businesses' });
  }
});

// GET /api/businesses/:id - Get specific business
router.get('/:id', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate([
        { path: 'ownerId', select: 'firstName lastName email avatar' },
        { path: 'teamMembers.userId', select: 'firstName lastName email avatar' },
        { path: 'teamMembers.invitedBy', select: 'firstName lastName email' },
        { path: 'linkedProjects.projectId', populate: { path: 'assignedTo', select: 'firstName lastName email' } },
        { path: 'createdBy', select: 'firstName lastName email' },
        { path: 'lastUpdatedBy', select: 'firstName lastName email' }
      ]);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check if user has access (owner or team member)
    const hasAccess = business.ownerId._id.toString() === req.userId ||
      business.teamMembers.some(member => 
        member.userId?.toString() === req.userId && member.status === 'active'
      );

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get linked tasks from linked projects
    const linkedProjectIds = business.linkedProjects.map(lp => lp.projectId._id);
    const linkedTasks = await Task.find({
      projectId: { $in: linkedProjectIds },
      status: { $ne: 'deleted' }
    }).populate([
      { path: 'assignedTo', select: 'firstName lastName email' },
      { path: 'projectId', select: 'title' }
    ]).sort({ updatedAt: -1 });

    res.json({
      ...business.toObject(),
      linkedTasks
    });

  } catch (error) {
    console.error('Error fetching business:', error);
    res.status(500).json({ error: 'Failed to fetch business' });
  }
});

// POST /api/businesses - Create new business
router.post('/', authenticateUser, async (req, res) => {
  try {
    console.log('🏢 Creating new business for user:', req.userId);

    const businessData = {
      ...req.body,
      ownerId: req.userId,
      createdBy: req.userId,
      lastUpdatedBy: req.userId
    };

    const business = new Business(businessData);
    await business.save();

    // Populate the created business
    await business.populate([
      { path: 'ownerId', select: 'firstName lastName email avatar' },
      { path: 'createdBy', select: 'firstName lastName email' }
    ]);

    console.log('✅ Business created successfully:', business.name);

    res.status(201).json(business);

  } catch (error) {
    console.error('Error creating business:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }
    
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// PUT /api/businesses/:id - Update business
router.put('/:id', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canEdit = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('edit_business'));

    if (!canEdit) {
      return res.status(403).json({ error: 'Insufficient permissions to edit business' });
    }

    // Update business
    const updateData = {
      ...req.body,
      lastUpdatedBy: req.userId
    };

    const updatedBusiness = await Business.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'ownerId', select: 'firstName lastName email avatar' },
      { path: 'teamMembers.userId', select: 'firstName lastName email avatar' },
      { path: 'lastUpdatedBy', select: 'firstName lastName email' }
    ]);

    console.log('✅ Business updated successfully:', updatedBusiness.name);

    res.json(updatedBusiness);

  } catch (error) {
    console.error('Error updating business:', error);
    
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }
    
    res.status(500).json({ error: 'Failed to update business' });
  }
});

// DELETE /api/businesses/:id - Delete business (soft delete)
router.delete('/:id', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Only owner can delete business
    if (business.ownerId.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only business owner can delete business' });
    }

    // Soft delete (archive) - Update without triggering validation
    await Business.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          archivedAt: new Date(),
          archivedBy: req.userId,
          archiveReason: req.body.reason || 'Deleted by owner',
          status: 'closed'
        }
      },
      { 
        new: false, // Don't return the updated document
        runValidators: false // Skip validation to avoid email requirement issues
      }
    );

    console.log('✅ Business deleted successfully:', business.name);

    res.json({ message: 'Business deleted successfully' });

  } catch (error) {
    console.error('Error deleting business:', error);
    res.status(500).json({ error: 'Failed to delete business' });
  }
});

// ============================================================================
// TEAM MANAGEMENT
// ============================================================================

// POST /api/businesses/:id/invite - Invite user to business
router.post('/:id/invite', authenticateUser, async (req, res) => {
  try {
    const { email, role = 'member', permissions = [] } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check if user can invite others
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canInvite = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('invite_users'));

    if (!canInvite) {
      return res.status(403).json({ error: 'Insufficient permissions to invite users' });
    }

    // Check if email is already invited
    const existingInvite = business.teamMembers.find(member => 
      member.email.toLowerCase() === email.toLowerCase()
    );

    if (existingInvite) {
      return res.status(400).json({ error: 'User already invited or is a member' });
    }

    // Check if user exists - Changed from User to Account
    const invitedUser = await Account.findOne({ email: email.toLowerCase() });
    
    const inviteToken = generateInviteToken();
    
    // Set default permissions based on role
    const defaultPermissions = {
      viewer: ['view_business', 'view_products', 'view_projects'],
      member: ['view_business', 'view_products', 'view_projects', 'manage_projects'],
      manager: ['view_business', 'edit_business', 'view_products', 'manage_products', 'view_projects', 'manage_projects'],
      admin: ['view_business', 'edit_business', 'manage_products', 'view_products', 'manage_projects', 'view_projects', 'invite_users', 'view_analytics']
    };

    const teamMemberData = {
      userId: invitedUser?._id || null,
      email: email.toLowerCase(),
      role,
      permissions: permissions.length > 0 ? permissions : (defaultPermissions[role] || defaultPermissions.member),
      status: 'pending',
      invitedBy: req.userId,
      inviteToken,
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    business.teamMembers.push(teamMemberData);
    await business.save();

    // TODO: Send invitation email with inviteToken
    console.log(`📧 Invite sent to ${email} for business ${business.name}`);

    // Populate and return the new team member
    await business.populate([
      { path: 'teamMembers.userId', select: 'firstName lastName email avatar' },
      { path: 'teamMembers.invitedBy', select: 'firstName lastName email' }
    ]);

    const newMember = business.teamMembers[business.teamMembers.length - 1];

    res.status(201).json({
      message: 'Invitation sent successfully',
      teamMember: newMember,
      inviteUrl: `${process.env.CLIENT_URL}/business/invite/${inviteToken}`
    });

  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: 'Failed to send invitation' });
  }
});

// POST /api/businesses/join/:token - Accept business invitation
router.post('/join/:token', authenticateUser, async (req, res) => {
  try {
    const { token } = req.params;

    const business = await Business.findOne({
      'teamMembers.inviteToken': token,
      'teamMembers.inviteExpiresAt': { $gt: new Date() },
      'teamMembers.status': 'pending'
    });

    if (!business) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const memberIndex = business.teamMembers.findIndex(member => 
      member.inviteToken === token
    );

    if (memberIndex === -1) {
      return res.status(400).json({ error: 'Invitation not found' });
    }

    const member = business.teamMembers[memberIndex];

    // Get user info - Changed from User to Account
    const user = await Account.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if invitation email matches user email
    if (member.email !== user.email.toLowerCase()) {
      return res.status(400).json({ error: 'Invitation email does not match your account' });
    }

    // Update member status
    business.teamMembers[memberIndex].userId = req.userId;
    business.teamMembers[memberIndex].status = 'active';
    business.teamMembers[memberIndex].joinedAt = new Date();
    business.teamMembers[memberIndex].inviteToken = undefined;
    business.teamMembers[memberIndex].inviteExpiresAt = undefined;

    await business.save();

    // Grant access to linked projects and tasks
    const linkedProjects = await Project.find({
      _id: { $in: business.linkedProjects.map(lp => lp.projectId) }
    });

    for (const project of linkedProjects) {
      // Add user as collaborator if not already added
      if (!project.collaborators.some(c => c.userId.toString() === req.userId)) {
        project.collaborators.push({
          userId: req.userId,
          role: 'member',
          permissions: ['view_project', 'edit_tasks'],
          addedAt: new Date(),
          addedBy: business.ownerId
        });
        await project.save();
      }
    }

    // Get linked tasks and grant access
    const linkedTasks = await Task.find({
      projectId: { $in: business.linkedProjects.map(lp => lp.projectId) }
    });

    // Update tasks to include user in visibility (if your task model supports it)
    // This depends on your Task model structure

    console.log(`✅ User ${user.email} joined business ${business.name}`);

    await business.populate([
      { path: 'ownerId', select: 'firstName lastName email avatar' },
      { path: 'teamMembers.userId', select: 'firstName lastName email avatar' }
    ]);

    res.json({
      message: 'Successfully joined business',
      business,
      linkedProjectsCount: linkedProjects.length,
      linkedTasksCount: linkedTasks.length
    });

  } catch (error) {
    console.error('Error joining business:', error);
    res.status(500).json({ error: 'Failed to join business' });
  }
});

// PUT /api/businesses/:id/members/:memberId - Update team member
router.put('/:id/members/:memberId', authenticateUser, async (req, res) => {
  try {
    const { role, permissions, status } = req.body;

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageTeam = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_team'));

    if (!canManageTeam) {
      return res.status(403).json({ error: 'Insufficient permissions to manage team' });
    }

    const memberIndex = business.teamMembers.findIndex(member => 
      member._id.toString() === req.params.memberId
    );

    if (memberIndex === -1) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Cannot demote or remove owner
    if (business.teamMembers[memberIndex].role === 'owner') {
      return res.status(400).json({ error: 'Cannot modify owner role' });
    }

    // Update member
    if (role) business.teamMembers[memberIndex].role = role;
    if (permissions) business.teamMembers[memberIndex].permissions = permissions;
    if (status) business.teamMembers[memberIndex].status = status;

    await business.save();

    await business.populate([
      { path: 'teamMembers.userId', select: 'firstName lastName email avatar' }
    ]);

    console.log('✅ Team member updated successfully');

    res.json({
      message: 'Team member updated successfully',
      member: business.teamMembers[memberIndex]
    });

  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

// DELETE /api/businesses/:id/members/:memberId - Remove team member
router.delete('/:id/members/:memberId', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageTeam = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_team'));

    const memberToRemove = business.teamMembers.find(member => 
      member._id.toString() === req.params.memberId
    );

    // Allow users to remove themselves
    const isSelfRemoval = memberToRemove?.userId?.toString() === req.userId;

    if (!canManageTeam && !isSelfRemoval) {
      return res.status(403).json({ error: 'Insufficient permissions to remove team member' });
    }

    if (!memberToRemove) {
      return res.status(404).json({ error: 'Team member not found' });
    }

    // Cannot remove owner
    if (memberToRemove.role === 'owner') {
      return res.status(400).json({ error: 'Cannot remove business owner' });
    }

    // Remove member from business
    business.teamMembers = business.teamMembers.filter(member => 
      member._id.toString() !== req.params.memberId
    );

    await business.save();

    // Remove from linked projects
    if (memberToRemove.userId) {
      const linkedProjects = await Project.find({
        _id: { $in: business.linkedProjects.map(lp => lp.projectId) }
      });

      for (const project of linkedProjects) {
        project.collaborators = project.collaborators.filter(c => 
          c.userId.toString() !== memberToRemove.userId.toString()
        );
        await project.save();
      }
    }

    console.log('✅ Team member removed successfully');

    res.json({ message: 'Team member removed successfully' });

  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// ============================================================================
// PROJECT LINKING
// ============================================================================

// POST /api/businesses/:id/projects - Link project to business
router.post('/:id/projects', authenticateUser, async (req, res) => {
  try {
    const { projectId, role = 'related' } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageProjects = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_projects'));

    if (!canManageProjects) {
      return res.status(403).json({ error: 'Insufficient permissions to link projects' });
    }

    // Check if project exists and user has access
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const hasProjectAccess = project.userId.toString() === req.userId ||
      project.collaborators.some(c => c.userId.toString() === req.userId);

    if (!hasProjectAccess) {
      return res.status(403).json({ error: 'Access denied to project' });
    }

    // Link project
    await business.linkProject(projectId, role, req.userId);

    // Add business team members as project collaborators
    for (const member of business.activeTeamMembers) {
      if (member.userId && !project.collaborators.some(c => c.userId.toString() === member.userId.toString())) {
        project.collaborators.push({
          userId: member.userId,
          role: 'member',
          permissions: ['view_project', 'edit_tasks'],
          addedAt: new Date(),
          addedBy: req.userId
        });
      }
    }

    await project.save();

    await business.populate([
      { path: 'linkedProjects.projectId', select: 'title status priority targetCompletionDate' }
    ]);

    console.log('✅ Project linked to business successfully');

    res.json({
      message: 'Project linked successfully',
      linkedProject: business.linkedProjects[business.linkedProjects.length - 1]
    });

  } catch (error) {
    console.error('Error linking project:', error);
    res.status(500).json({ error: 'Failed to link project' });
  }
});

// DELETE /api/businesses/:id/projects/:projectId - Unlink project
router.delete('/:id/projects/:projectId', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageProjects = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_projects'));

    if (!canManageProjects) {
      return res.status(403).json({ error: 'Insufficient permissions to unlink projects' });
    }

    // Unlink project
    await business.unlinkProject(req.params.projectId);

    console.log('✅ Project unlinked from business successfully');

    res.json({ message: 'Project unlinked successfully' });

  } catch (error) {
    console.error('Error unlinking project:', error);
    res.status(500).json({ error: 'Failed to unlink project' });
  }
});

// ============================================================================
// PRODUCTS MANAGEMENT
// ============================================================================

// POST /api/businesses/:id/products - Add product
router.post('/:id/products', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageProducts = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_products'));

    if (!canManageProducts) {
      return res.status(403).json({ error: 'Insufficient permissions to manage products' });
    }

    business.products.push(req.body);
    await business.save();

    console.log('✅ Product added successfully');

    res.status(201).json({
      message: 'Product added successfully',
      product: business.products[business.products.length - 1]
    });

  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// PUT /api/businesses/:id/products/:productId - Update product
router.put('/:id/products/:productId', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageProducts = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_products'));

    if (!canManageProducts) {
      return res.status(403).json({ error: 'Insufficient permissions to manage products' });
    }

    const productIndex = business.products.findIndex(product => 
      product._id.toString() === req.params.productId
    );

    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update product
    business.products[productIndex] = {
      ...business.products[productIndex].toObject(),
      ...req.body,
      _id: business.products[productIndex]._id
    };

    await business.save();

    console.log('✅ Product updated successfully');

    res.json({
      message: 'Product updated successfully',
      product: business.products[productIndex]
    });

  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// DELETE /api/businesses/:id/products/:productId - Remove product
router.delete('/:id/products/:productId', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageProducts = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_products'));

    if (!canManageProducts) {
      return res.status(403).json({ error: 'Insufficient permissions to manage products' });
    }

    business.products = business.products.filter(product => 
      product._id.toString() !== req.params.productId
    );

    await business.save();

    console.log('✅ Product removed successfully');

    res.json({ message: 'Product removed successfully' });

  } catch (error) {
    console.error('Error removing product:', error);
    res.status(500).json({ error: 'Failed to remove product' });
  }
});

// ============================================================================
// ANALYTICS AND STATS
// ============================================================================

// GET /api/businesses/:id/analytics - Business analytics
router.get('/:id/analytics', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canViewAnalytics = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('view_analytics'));

    if (!canViewAnalytics) {
      return res.status(403).json({ error: 'Insufficient permissions to view analytics' });
    }

    // Get linked projects data
    const linkedProjectIds = business.linkedProjects.map(lp => lp.projectId);
    const projects = await Project.find({ _id: { $in: linkedProjectIds } });
    
    // Get linked tasks data
    const tasks = await Task.find({ 
      projectId: { $in: linkedProjectIds },
      status: { $ne: 'deleted' }
    });

    const analytics = {
      business: {
        totalProducts: business.products.length,
        activeProducts: business.products.filter(p => p.status === 'active').length,
        totalRevenue: business.products.reduce((sum, p) => sum + (p.metrics?.revenue || 0), 0),
        teamSize: business.activeTeamMembers.length
      },
      projects: {
        total: projects.length,
        completed: projects.filter(p => p.status === 'completed').length,
        active: projects.filter(p => p.status === 'active').length,
        overdue: projects.filter(p => 
          p.targetCompletionDate && 
          new Date(p.targetCompletionDate) < new Date() && 
          p.status !== 'completed'
        ).length
      },
      tasks: {
        total: tasks.length,
        completed: tasks.filter(t => t.status === 'completed').length,
        active: tasks.filter(t => ['pending', 'in-progress'].includes(t.status)).length,
        overdue: tasks.filter(t => 
          t.dueDate && 
          new Date(t.dueDate) < new Date() && 
          t.status !== 'completed'
        ).length
      },
      timeline: {
        recentActivity: [
          ...projects.map(p => ({
            type: 'project',
            action: 'updated',
            item: p.title,
            date: p.updatedAt
          })),
          ...tasks.slice(0, 5).map(t => ({
            type: 'task',
            action: t.status === 'completed' ? 'completed' : 'updated',
            item: t.title,
            date: t.updatedAt
          }))
        ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10)
      }
    };

    res.json(analytics);

  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// GET /api/businesses/dashboard/stats - Dashboard stats for all user's businesses
router.get('/dashboard/stats', authenticateUser, async (req, res) => {
  try {
    const businesses = await getUserBusinesses(req.userId);

    const stats = {
      totalBusinesses: businesses.length,
      activeBusinesses: businesses.filter(b => b.status === 'active').length,
      ownedBusinesses: businesses.filter(b => b.ownerId._id.toString() === req.userId).length,
      memberBusinesses: businesses.filter(b => 
        b.ownerId._id.toString() !== req.userId && 
        b.teamMembers.some(m => m.userId?._id.toString() === req.userId)
      ).length,
      totalTeamMembers: businesses.reduce((sum, b) => sum + b.activeTeamMembers.length, 0),
      totalLinkedProjects: businesses.reduce((sum, b) => sum + (b.linkedProjects?.length || 0), 0),
      recentBusinesses: businesses.slice(0, 3)
    };

    res.json(stats);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// GET /api/businesses/:id/projects/roadmap - Get projects roadmap data
router.get('/:id/projects/roadmap', authenticateUser, async (req, res) => {
  try {
    const business = await Business.findById(req.params.id)
      .populate({
        path: 'linkedProjects.projectId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const hasAccess = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('view_projects'));

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get detailed project data with milestones
    const projectsData = await Promise.all(
      business.linkedProjects.map(async (linkedProject) => {
        const project = await Project.findById(linkedProject.projectId._id)
          .populate('userId', 'firstName lastName email')
          .populate('collaborators.userId', 'firstName lastName email')
          .lean();

        if (!project) return null;

        // Calculate progress
        const progress = project.milestones && project.milestones.length > 0 
          ? Math.round((project.milestones.filter(m => m.completed).length / project.milestones.length) * 100)
          : 0;

        // Process milestones for roadmap
        const roadmapMilestones = project.milestones?.map((milestone, index) => ({
          ...milestone,
          id: milestone._id || `milestone-${index}`,
          projectId: project._id,
          businessRole: linkedProject.role,
          position: index,
          estimatedDuration: milestone.estimatedHours ? Math.ceil(milestone.estimatedHours / 8) : 1, // Convert to days
          dependencies: milestone.dependencies || [],
          status: milestone.completed ? 'completed' : 
                 milestone.dueDate && new Date(milestone.dueDate) < new Date() ? 'overdue' : 'pending'
        })) || [];

        // Calculate project timeline
        const now = new Date();
        const timeMetrics = {
          daysActive: project.startDate ? Math.ceil((now - new Date(project.startDate)) / (1000 * 60 * 60 * 24)) : 0,
          daysUntilDeadline: project.targetCompletionDate ? 
            Math.ceil((new Date(project.targetCompletionDate) - now) / (1000 * 60 * 60 * 24)) : null,
          isOverdue: project.targetCompletionDate && new Date(project.targetCompletionDate) < now && progress < 100
        };

        return {
          ...linkedProject.toObject(),
          projectDetails: {
            ...project,
            progress,
            timeMetrics,
            roadmapMilestones,
            totalMilestones: roadmapMilestones.length,
            completedMilestones: roadmapMilestones.filter(m => m.status === 'completed').length,
            overdueMilestones: roadmapMilestones.filter(m => m.status === 'overdue').length
          }
        };
      })
    );

    // Filter out null projects and organize by business phase
    const validProjects = projectsData.filter(p => p !== null);
    
    // Create roadmap structure
    const roadmapData = {
      phases: ['research', 'development', 'launch', 'growth', 'maintenance'],
      lanes: {
        research: validProjects.filter(p => p.businessPhase === 'research'),
        development: validProjects.filter(p => p.businessPhase === 'development'),
        launch: validProjects.filter(p => p.businessPhase === 'launch'),
        growth: validProjects.filter(p => p.businessPhase === 'growth'),
        maintenance: validProjects.filter(p => p.businessPhase === 'maintenance')
      },
      dependencies: [],
      timeline: {
        startDate: Math.min(...validProjects.map(p => 
          p.projectDetails.startDate ? new Date(p.projectDetails.startDate).getTime() : Date.now()
        )),
        endDate: Math.max(...validProjects.map(p => 
          p.projectDetails.targetCompletionDate ? new Date(p.projectDetails.targetCompletionDate).getTime() : Date.now()
        ))
      },
      statistics: {
        totalProjects: validProjects.length,
        totalMilestones: validProjects.reduce((sum, p) => sum + p.projectDetails.totalMilestones, 0),
        completedMilestones: validProjects.reduce((sum, p) => sum + p.projectDetails.completedMilestones, 0),
        overdueMilestones: validProjects.reduce((sum, p) => sum + p.projectDetails.overdueMilestones, 0),
        avgProgress: validProjects.length > 0 ? 
          Math.round(validProjects.reduce((sum, p) => sum + p.projectDetails.progress, 0) / validProjects.length) : 0
      }
    };

    // Calculate project dependencies
    validProjects.forEach(project => {
      if (project.dependencies && project.dependencies.length > 0) {
        project.dependencies.forEach(dep => {
          const dependsOn = validProjects.find(p => p.projectId._id.toString() === dep.projectId.toString());
          if (dependsOn) {
            roadmapData.dependencies.push({
              from: dependsOn.projectId._id,
              to: project.projectId._id,
              type: dep.type,
              status: dependsOn.projectDetails.progress >= 100 ? 'satisfied' : 'pending'
            });
          }
        });
      }
    });

    console.log(`✅ Roadmap data fetched for business: ${validProjects.length} projects`);

    res.json(roadmapData);

  } catch (error) {
    console.error('Error fetching business roadmap:', error);
    res.status(500).json({ error: 'Failed to fetch business roadmap' });
  }
});

// PUT /api/businesses/:id/projects/:projectId/roadmap - Update project roadmap position
router.put('/:id/projects/:projectId/roadmap', authenticateUser, async (req, res) => {
  try {
    const { businessPhase, priority, roadmapPosition, dependencies } = req.body;

    const business = await Business.findById(req.params.id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Check permissions
    const userMember = business.teamMembers.find(member => 
      member.userId?.toString() === req.userId
    );
    
    const canManageProjects = business.ownerId.toString() === req.userId ||
      (userMember && userMember.permissions.includes('manage_projects'));

    if (!canManageProjects) {
      return res.status(403).json({ error: 'Insufficient permissions to update roadmap' });
    }

    // Find and update the linked project
    const linkedProjectIndex = business.linkedProjects.findIndex(
      lp => lp.projectId.toString() === req.params.projectId
    );

    if (linkedProjectIndex === -1) {
      return res.status(404).json({ error: 'Project not linked to this business' });
    }

    // Update project roadmap data
    if (businessPhase) business.linkedProjects[linkedProjectIndex].businessPhase = businessPhase;
    if (priority) business.linkedProjects[linkedProjectIndex].priority = priority;
    if (roadmapPosition) business.linkedProjects[linkedProjectIndex].roadmapPosition = roadmapPosition;
    if (dependencies) business.linkedProjects[linkedProjectIndex].dependencies = dependencies;

    await business.save();

    console.log('✅ Project roadmap position updated');

    res.json({
      message: 'Project roadmap updated successfully',
      linkedProject: business.linkedProjects[linkedProjectIndex]
    });

  } catch (error) {
    console.error('Error updating project roadmap:', error);
    res.status(500).json({ error: 'Failed to update project roadmap' });
  }
});

module.exports = router;