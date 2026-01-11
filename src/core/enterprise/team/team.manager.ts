/**
 * Team Manager Implementation
 *
 * Feature: F5.10 - Team Management
 * Provides team organization, member management, and role assignment
 *
 * @module core/enterprise/team
 */

import { randomUUID, randomBytes } from 'crypto';
import type {
  ITeamManager,
  Team,
  TeamMember,
  TeamInvitation,
  TeamActivity,
  TeamStatistics,
  TeamHierarchyNode,
  TeamMemberRole,
  TeamFilter,
  MemberFilter,
  TeamEvent,
  CreateTeamRequest,
  UpdateTeamRequest,
  AddMemberRequest,
  UpdateMemberRequest,
  QuotaCheckResult,
  QuotaStatus,
} from './team.interface.js';
import { DEFAULT_TEAM_SETTINGS, TEAM_ROLE_PERMISSIONS } from './team.interface.js';

/**
 * Team Manager implementation
 */
export class TeamManager implements ITeamManager {
  private teams: Map<string, Team> = new Map();
  private teamsBySlug: Map<string, string> = new Map();
  private members: Map<string, Map<string, TeamMember>> = new Map(); // teamId -> userId -> member
  private invitations: Map<string, TeamInvitation> = new Map();
  private invitationsByToken: Map<string, string> = new Map();
  private activities: Map<string, TeamActivity[]> = new Map();
  private userTeams: Map<string, Set<string>> = new Map(); // userId -> teamIds
  private eventHandlers: Set<(event: TeamEvent) => void> = new Set();
  private usageCounters: Map<string, TeamUsageCounters> = new Map();
  private disposed = false;

  constructor() {
    // Initialize
  }

  // ==================== Team Management ====================

  async createTeam(request: CreateTeamRequest, creatorId: string): Promise<Team> {
    this.ensureNotDisposed();

    const id = randomUUID();
    const slug = this.generateSlug(request.name);

    // Check for duplicate slug
    if (this.teamsBySlug.has(slug)) {
      throw new Error(`Team with slug "${slug}" already exists`);
    }

    // Validate parent if specified
    if (request.parentId && !this.teams.has(request.parentId)) {
      throw new Error(`Parent team "${request.parentId}" not found`);
    }

    const team: Team = {
      id,
      name: request.name,
      description: request.description,
      slug,
      status: 'active',
      visibility: request.visibility || 'private',
      parentId: request.parentId,
      settings: {
        ...DEFAULT_TEAM_SETTINGS,
        ...request.settings,
        quotas: {
          ...DEFAULT_TEAM_SETTINGS.quotas,
          ...request.settings?.quotas,
        },
        notifications: {
          ...DEFAULT_TEAM_SETTINGS.notifications,
          ...request.settings?.notifications,
        },
      },
      metadata: request.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: creatorId,
    };

    this.teams.set(id, team);
    this.teamsBySlug.set(slug, id);
    this.members.set(id, new Map());
    this.activities.set(id, []);
    this.usageCounters.set(id, this.createUsageCounters());

    // Add creator as owner
    await this.addMember(
      id,
      {
        userId: creatorId,
        email: `${creatorId}@system`,
        displayName: 'Team Creator',
        role: 'owner',
        skipInvitation: true,
      },
      creatorId
    );

    // Log activity
    await this.logActivity({
      teamId: id,
      type: 'team.created',
      actorId: creatorId,
      description: `Team "${team.name}" was created`,
      metadata: { teamName: team.name },
    });

    this.emitEvent({
      type: 'team.created',
      teamId: id,
      data: { team },
      timestamp: new Date(),
    });

    return team;
  }

  async getTeam(teamId: string): Promise<Team | undefined> {
    this.ensureNotDisposed();
    return this.teams.get(teamId);
  }

  async getTeamBySlug(slug: string): Promise<Team | undefined> {
    this.ensureNotDisposed();
    const teamId = this.teamsBySlug.get(slug);
    return teamId ? this.teams.get(teamId) : undefined;
  }

  async updateTeam(teamId: string, updates: UpdateTeamRequest): Promise<Team> {
    this.ensureNotDisposed();

    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team "${teamId}" not found`);
    }

    const updatedTeam: Team = {
      ...team,
      ...updates,
      settings: updates.settings
        ? {
            ...team.settings,
            ...updates.settings,
            quotas: {
              ...team.settings.quotas,
              ...updates.settings.quotas,
            },
            notifications: {
              ...team.settings.notifications,
              ...updates.settings.notifications,
            },
          }
        : team.settings,
      updatedAt: new Date(),
    };

    // Update slug if name changed
    if (updates.name && updates.name !== team.name) {
      const newSlug = this.generateSlug(updates.name);
      if (this.teamsBySlug.has(newSlug) && this.teamsBySlug.get(newSlug) !== teamId) {
        throw new Error(`Team with slug "${newSlug}" already exists`);
      }
      this.teamsBySlug.delete(team.slug);
      this.teamsBySlug.set(newSlug, teamId);
      updatedTeam.slug = newSlug;
    }

    this.teams.set(teamId, updatedTeam);

    await this.logActivity({
      teamId,
      type: 'team.updated',
      actorId: 'system',
      description: `Team "${updatedTeam.name}" was updated`,
      metadata: { updates },
    });

    this.emitEvent({
      type: 'team.updated',
      teamId,
      data: { team: updatedTeam, updates },
      timestamp: new Date(),
    });

    return updatedTeam;
  }

  async deleteTeam(teamId: string, force = false): Promise<boolean> {
    this.ensureNotDisposed();

    const team = this.teams.get(teamId);
    if (!team) {
      return false;
    }

    const members = this.members.get(teamId);
    if (members && members.size > 1 && !force) {
      throw new Error('Cannot delete team with members. Use force=true to override.');
    }

    // Remove all members
    if (members) {
      for (const [userId] of members) {
        this.userTeams.get(userId)?.delete(teamId);
      }
    }

    // Delete team data
    this.teams.delete(teamId);
    this.teamsBySlug.delete(team.slug);
    this.members.delete(teamId);
    this.activities.delete(teamId);
    this.usageCounters.delete(teamId);

    // Delete pending invitations
    const toDelete: string[] = [];
    for (const [id, inv] of this.invitations) {
      if (inv.teamId === teamId) {
        toDelete.push(id);
        this.invitationsByToken.delete(inv.token);
      }
    }
    toDelete.forEach((id) => this.invitations.delete(id));

    this.emitEvent({
      type: 'team.deleted',
      teamId,
      data: { teamName: team.name },
      timestamp: new Date(),
    });

    return true;
  }

  async archiveTeam(teamId: string): Promise<Team> {
    return this.updateTeam(teamId, { status: 'archived' });
  }

  async restoreTeam(teamId: string): Promise<Team> {
    return this.updateTeam(teamId, { status: 'active' });
  }

  async getTeams(filter?: TeamFilter): Promise<Team[]> {
    this.ensureNotDisposed();

    let teams = Array.from(this.teams.values());

    if (filter) {
      if (filter.status) {
        teams = teams.filter((t) => t.status === filter.status);
      }
      if (filter.visibility) {
        teams = teams.filter((t) => t.visibility === filter.visibility);
      }
      if (filter.parentId !== undefined) {
        teams = teams.filter((t) => t.parentId === filter.parentId);
      }
      if (filter.namePattern) {
        const pattern = new RegExp(filter.namePattern, 'i');
        teams = teams.filter((t) => pattern.test(t.name));
      }
      if (!filter.includeArchived) {
        teams = teams.filter((t) => t.status !== 'archived');
      }
    } else {
      teams = teams.filter((t) => t.status !== 'archived');
    }

    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getUserTeams(userId: string): Promise<Team[]> {
    this.ensureNotDisposed();

    const teamIds = this.userTeams.get(userId);
    if (!teamIds) {
      return [];
    }

    const teams: Team[] = [];
    for (const teamId of teamIds) {
      const team = this.teams.get(teamId);
      if (team && team.status !== 'archived') {
        teams.push(team);
      }
    }

    return teams.sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTeamHierarchy(rootTeamId?: string): Promise<TeamHierarchyNode[]> {
    this.ensureNotDisposed();

    const buildNode = async (team: Team, depth: number): Promise<TeamHierarchyNode> => {
      const children: TeamHierarchyNode[] = [];
      for (const t of this.teams.values()) {
        if (t.parentId === team.id) {
          children.push(await buildNode(t, depth + 1));
        }
      }
      return {
        team,
        children: children.sort((a, b) => a.team.name.localeCompare(b.team.name)),
        statistics: await this.getStatistics(team.id),
        depth,
      };
    };

    const rootTeams: Team[] = [];
    for (const team of this.teams.values()) {
      if (rootTeamId) {
        if (team.id === rootTeamId) {
          rootTeams.push(team);
          break;
        }
      } else if (!team.parentId) {
        rootTeams.push(team);
      }
    }

    const hierarchy: TeamHierarchyNode[] = [];
    for (const team of rootTeams) {
      hierarchy.push(await buildNode(team, 0));
    }

    return hierarchy.sort((a, b) => a.team.name.localeCompare(b.team.name));
  }

  // ==================== Member Management ====================

  async addMember(
    teamId: string,
    request: AddMemberRequest,
    inviterId: string
  ): Promise<TeamMember> {
    this.ensureNotDisposed();

    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team "${teamId}" not found`);
    }

    const teamMembers = this.members.get(teamId)!;

    // Check if already a member
    if (teamMembers.has(request.userId)) {
      throw new Error(`User "${request.userId}" is already a member of this team`);
    }

    // Check member limit
    if (team.settings.maxMembers > 0 && teamMembers.size >= team.settings.maxMembers) {
      throw new Error(`Team has reached maximum member limit (${team.settings.maxMembers})`);
    }

    const member: TeamMember = {
      id: randomUUID(),
      teamId,
      userId: request.userId,
      email: request.email,
      displayName: request.displayName,
      role: request.role || team.settings.defaultMemberRole,
      customPermissions: request.customPermissions,
      joinedAt: new Date(),
      invitedBy: inviterId,
      status: request.skipInvitation ? 'active' : 'pending',
    };

    teamMembers.set(request.userId, member);

    // Track user teams
    if (!this.userTeams.has(request.userId)) {
      this.userTeams.set(request.userId, new Set());
    }
    this.userTeams.get(request.userId)!.add(teamId);

    await this.logActivity({
      teamId,
      type: 'member.added',
      actorId: inviterId,
      targetId: request.userId,
      targetType: 'user',
      description: `${request.displayName} was added to the team`,
      metadata: { role: member.role },
    });

    this.emitEvent({
      type: 'member.added',
      teamId,
      data: { member },
      timestamp: new Date(),
    });

    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<boolean> {
    this.ensureNotDisposed();

    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      return false;
    }

    const member = teamMembers.get(userId);
    if (!member) {
      return false;
    }

    // Cannot remove the last owner
    if (member.role === 'owner') {
      const owners = Array.from(teamMembers.values()).filter((m) => m.role === 'owner');
      if (owners.length <= 1) {
        throw new Error('Cannot remove the last owner. Transfer ownership first.');
      }
    }

    teamMembers.delete(userId);
    this.userTeams.get(userId)?.delete(teamId);

    await this.logActivity({
      teamId,
      type: 'member.removed',
      actorId: 'system',
      targetId: userId,
      targetType: 'user',
      description: `${member.displayName} was removed from the team`,
    });

    this.emitEvent({
      type: 'member.removed',
      teamId,
      data: { userId, displayName: member.displayName },
      timestamp: new Date(),
    });

    return true;
  }

  async updateMember(
    teamId: string,
    userId: string,
    updates: UpdateMemberRequest
  ): Promise<TeamMember> {
    this.ensureNotDisposed();

    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      throw new Error(`Team "${teamId}" not found`);
    }

    const member = teamMembers.get(userId);
    if (!member) {
      throw new Error(`Member "${userId}" not found in team`);
    }

    const updatedMember: TeamMember = {
      ...member,
      ...updates,
      metadata: {
        ...member.metadata,
        ...updates.metadata,
      },
    };

    teamMembers.set(userId, updatedMember);

    if (updates.role && updates.role !== member.role) {
      await this.logActivity({
        teamId,
        type: 'member.role_changed',
        actorId: 'system',
        targetId: userId,
        targetType: 'user',
        description: `${member.displayName}'s role changed from ${member.role} to ${updates.role}`,
        metadata: { oldRole: member.role, newRole: updates.role },
      });

      this.emitEvent({
        type: 'member.role_changed',
        teamId,
        data: { userId, oldRole: member.role, newRole: updates.role },
        timestamp: new Date(),
      });
    }

    return updatedMember;
  }

  async getMember(teamId: string, userId: string): Promise<TeamMember | undefined> {
    this.ensureNotDisposed();
    return this.members.get(teamId)?.get(userId);
  }

  async getMembers(teamId: string, filter?: MemberFilter): Promise<TeamMember[]> {
    this.ensureNotDisposed();

    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      return [];
    }

    let members = Array.from(teamMembers.values());

    if (filter) {
      if (filter.role) {
        members = members.filter((m) => m.role === filter.role);
      }
      if (filter.status) {
        members = members.filter((m) => m.status === filter.status);
      }
      if (filter.search) {
        const search = filter.search.toLowerCase();
        members = members.filter(
          (m) =>
            m.displayName.toLowerCase().includes(search) || m.email.toLowerCase().includes(search)
        );
      }
    }

    return members.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  async isMember(teamId: string, userId: string): Promise<boolean> {
    this.ensureNotDisposed();
    return this.members.get(teamId)?.has(userId) ?? false;
  }

  async changeMemberRole(
    teamId: string,
    userId: string,
    newRole: TeamMemberRole
  ): Promise<TeamMember> {
    return this.updateMember(teamId, userId, { role: newRole });
  }

  async transferOwnership(teamId: string, newOwnerId: string): Promise<void> {
    this.ensureNotDisposed();

    const teamMembers = this.members.get(teamId);
    if (!teamMembers) {
      throw new Error(`Team "${teamId}" not found`);
    }

    const newOwner = teamMembers.get(newOwnerId);
    if (!newOwner) {
      throw new Error(`User "${newOwnerId}" is not a member of this team`);
    }

    // Find current owners and demote them to admin
    for (const [uid, member] of teamMembers) {
      if (member.role === 'owner' && uid !== newOwnerId) {
        await this.updateMember(teamId, uid, { role: 'admin' });
      }
    }

    // Promote new owner
    await this.updateMember(teamId, newOwnerId, { role: 'owner' });

    await this.logActivity({
      teamId,
      type: 'member.role_changed',
      actorId: 'system',
      targetId: newOwnerId,
      targetType: 'user',
      description: `Ownership transferred to ${newOwner.displayName}`,
    });
  }

  // ==================== Invitation Management ====================

  async createInvitation(
    teamId: string,
    email: string,
    role: TeamMemberRole,
    inviterId: string,
    message?: string
  ): Promise<TeamInvitation> {
    this.ensureNotDisposed();

    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team "${teamId}" not found`);
    }

    // Check if already invited
    for (const inv of this.invitations.values()) {
      if (inv.teamId === teamId && inv.email === email && inv.status === 'pending') {
        throw new Error(`Invitation already pending for "${email}"`);
      }
    }

    const invitation: TeamInvitation = {
      id: randomUUID(),
      teamId,
      email,
      role,
      token: randomBytes(32).toString('hex'),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      invitedBy: inviterId,
      status: 'pending',
      message,
    };

    this.invitations.set(invitation.id, invitation);
    this.invitationsByToken.set(invitation.token, invitation.id);

    await this.logActivity({
      teamId,
      type: 'invitation.sent',
      actorId: inviterId,
      description: `Invitation sent to ${email}`,
      metadata: { email, role },
    });

    this.emitEvent({
      type: 'invitation.sent',
      teamId,
      data: { email, role },
      timestamp: new Date(),
    });

    return invitation;
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | undefined> {
    this.ensureNotDisposed();
    const id = this.invitationsByToken.get(token);
    return id ? this.invitations.get(id) : undefined;
  }

  async getPendingInvitations(teamId: string): Promise<TeamInvitation[]> {
    this.ensureNotDisposed();

    const now = new Date();
    const invitations: TeamInvitation[] = [];

    for (const inv of this.invitations.values()) {
      if (inv.teamId === teamId && inv.status === 'pending') {
        // Auto-expire old invitations
        if (inv.expiresAt < now) {
          inv.status = 'expired';
        } else {
          invitations.push(inv);
        }
      }
    }

    return invitations.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async acceptInvitation(
    token: string,
    userId: string,
    displayName: string
  ): Promise<TeamMember> {
    this.ensureNotDisposed();

    const invitation = await this.getInvitationByToken(token);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation is ${invitation.status}`);
    }

    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      throw new Error('Invitation has expired');
    }

    invitation.status = 'accepted';

    const member = await this.addMember(
      invitation.teamId,
      {
        userId,
        email: invitation.email,
        displayName,
        role: invitation.role,
        skipInvitation: true,
      },
      invitation.invitedBy
    );

    await this.logActivity({
      teamId: invitation.teamId,
      type: 'invitation.accepted',
      actorId: userId,
      description: `${displayName} accepted the invitation`,
    });

    this.emitEvent({
      type: 'invitation.accepted',
      teamId: invitation.teamId,
      data: { userId, displayName },
      timestamp: new Date(),
    });

    return member;
  }

  async declineInvitation(token: string): Promise<void> {
    this.ensureNotDisposed();

    const invitation = await this.getInvitationByToken(token);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    if (invitation.status !== 'pending') {
      throw new Error(`Invitation is ${invitation.status}`);
    }

    invitation.status = 'declined';

    await this.logActivity({
      teamId: invitation.teamId,
      type: 'invitation.declined',
      actorId: 'system',
      description: `Invitation to ${invitation.email} was declined`,
    });

    this.emitEvent({
      type: 'invitation.declined',
      teamId: invitation.teamId,
      data: { email: invitation.email },
      timestamp: new Date(),
    });
  }

  async cancelInvitation(invitationId: string): Promise<void> {
    this.ensureNotDisposed();

    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    this.invitations.delete(invitationId);
    this.invitationsByToken.delete(invitation.token);
  }

  async resendInvitation(invitationId: string): Promise<TeamInvitation> {
    this.ensureNotDisposed();

    const invitation = this.invitations.get(invitationId);
    if (!invitation) {
      throw new Error('Invitation not found');
    }

    // Store old invitation data
    const { teamId, email, role, invitedBy, message } = invitation;

    // Cancel old invitation first
    await this.cancelInvitation(invitationId);

    // Create new invitation
    const newInvitation = await this.createInvitation(
      teamId,
      email,
      role,
      invitedBy,
      message
    );

    return newInvitation;
  }

  // ==================== Permissions & Roles ====================

  async hasPermission(teamId: string, userId: string, permission: string): Promise<boolean> {
    this.ensureNotDisposed();

    const member = await this.getMember(teamId, userId);
    if (!member || member.status !== 'active') {
      return false;
    }

    // Check custom permissions first
    if (member.customPermissions?.includes(permission)) {
      return true;
    }

    // Check role permissions
    const rolePermissions = TEAM_ROLE_PERMISSIONS[member.role];
    return rolePermissions.includes(permission) || rolePermissions.includes('team:manage');
  }

  async getEffectivePermissions(teamId: string, userId: string): Promise<string[]> {
    this.ensureNotDisposed();

    const member = await this.getMember(teamId, userId);
    if (!member || member.status !== 'active') {
      return [];
    }

    const permissions = new Set<string>(TEAM_ROLE_PERMISSIONS[member.role]);

    if (member.customPermissions) {
      member.customPermissions.forEach((p) => permissions.add(p));
    }

    return Array.from(permissions).sort();
  }

  getRolePermissions(role: TeamMemberRole): string[] {
    return [...TEAM_ROLE_PERMISSIONS[role]];
  }

  // ==================== Activity & Statistics ====================

  async logActivity(
    activity: Omit<TeamActivity, 'id' | 'timestamp'>
  ): Promise<TeamActivity> {
    this.ensureNotDisposed();

    const fullActivity: TeamActivity = {
      ...activity,
      id: randomUUID(),
      timestamp: new Date(),
    };

    const teamActivities = this.activities.get(activity.teamId);
    if (teamActivities) {
      teamActivities.unshift(fullActivity);
      // Keep only last 1000 activities
      if (teamActivities.length > 1000) {
        teamActivities.pop();
      }
    }

    return fullActivity;
  }

  async getActivities(
    teamId: string,
    limit = 50,
    offset = 0
  ): Promise<TeamActivity[]> {
    this.ensureNotDisposed();

    const teamActivities = this.activities.get(teamId);
    if (!teamActivities) {
      return [];
    }

    return teamActivities.slice(offset, offset + limit);
  }

  async getStatistics(teamId: string): Promise<TeamStatistics> {
    this.ensureNotDisposed();

    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team "${teamId}" not found`);
    }

    const members = this.members.get(teamId);
    const invitations = await this.getPendingInvitations(teamId);
    const counters = this.usageCounters.get(teamId) || this.createUsageCounters();
    const activities = this.activities.get(teamId) || [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    let activeMembers = 0;

    if (members) {
      for (const member of members.values()) {
        if (member.lastActiveAt && member.lastActiveAt > thirtyDaysAgo) {
          activeMembers++;
        }
      }
    }

    return {
      totalMembers: members?.size ?? 0,
      activeMembers,
      totalProjects: counters.projects,
      workflowsThisMonth: counters.workflowsThisMonth,
      agentHoursThisMonth: counters.agentHoursThisMonth,
      storageUsedBytes: counters.storageUsedBytes,
      apiCallsThisHour: counters.apiCallsThisHour,
      pendingInvitations: invitations.length,
      lastActivityAt: activities[0]?.timestamp,
    };
  }

  async checkQuotas(teamId: string): Promise<QuotaCheckResult> {
    this.ensureNotDisposed();

    const team = this.teams.get(teamId);
    if (!team) {
      throw new Error(`Team "${teamId}" not found`);
    }

    const stats = await this.getStatistics(teamId);
    const quotas = team.settings.quotas;
    const warningThreshold = team.settings.notifications.quotaWarningThreshold / 100;

    const checkQuota = (current: number, max: number): QuotaStatus => {
      const percentage = max > 0 ? (current / max) * 100 : 0;
      return {
        current,
        max,
        percentage,
        exceeded: max > 0 && current >= max,
        warning: max > 0 && percentage >= warningThreshold * 100,
      };
    };

    const result: QuotaCheckResult = {
      exceeded: false,
      warning: false,
      quotas: {
        projects: checkQuota(stats.totalProjects, quotas.maxProjects),
        workflowsPerDay: checkQuota(stats.workflowsThisMonth / 30, quotas.maxWorkflowsPerDay),
        agentHoursPerMonth: checkQuota(stats.agentHoursThisMonth, quotas.maxAgentHoursPerMonth),
        storage: checkQuota(stats.storageUsedBytes, quotas.maxStorageBytes),
        apiCallsPerHour: checkQuota(stats.apiCallsThisHour, quotas.maxApiCallsPerHour),
      },
    };

    result.exceeded = Object.values(result.quotas).some((q) => q.exceeded);
    result.warning = Object.values(result.quotas).some((q) => q.warning);

    if (result.exceeded) {
      await this.logActivity({
        teamId,
        type: 'quota.exceeded',
        actorId: 'system',
        description: 'Team quota exceeded',
        metadata: { quotas: result.quotas },
      });
    } else if (result.warning) {
      await this.logActivity({
        teamId,
        type: 'quota.warning',
        actorId: 'system',
        description: 'Team approaching quota limit',
        metadata: { quotas: result.quotas },
      });
    }

    return result;
  }

  // ==================== Events ====================

  onTeamEvent(handler: (event: TeamEvent) => void): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  // ==================== Lifecycle ====================

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.teams.clear();
    this.teamsBySlug.clear();
    this.members.clear();
    this.invitations.clear();
    this.invitationsByToken.clear();
    this.activities.clear();
    this.userTeams.clear();
    this.eventHandlers.clear();
    this.usageCounters.clear();
  }

  // ==================== Private Helpers ====================

  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new Error('TeamManager has been disposed');
    }
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private emitEvent(event: TeamEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  private createUsageCounters(): TeamUsageCounters {
    return {
      projects: 0,
      workflowsThisMonth: 0,
      agentHoursThisMonth: 0,
      storageUsedBytes: 0,
      apiCallsThisHour: 0,
    };
  }
}

/**
 * Team usage counters
 */
interface TeamUsageCounters {
  projects: number;
  workflowsThisMonth: number;
  agentHoursThisMonth: number;
  storageUsedBytes: number;
  apiCallsThisHour: number;
}
