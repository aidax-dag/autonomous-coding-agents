/**
 * Team Management Interfaces
 *
 * Feature: F5.10 - Team Management
 * Provides team organization, member management, and role assignment
 *
 * @module core/enterprise/team
 */

import type { IDisposable } from '../../di/interfaces/container.interface.js';

/**
 * Team status
 */
export type TeamStatus = 'active' | 'inactive' | 'suspended' | 'archived';

/**
 * Team visibility
 */
export type TeamVisibility = 'public' | 'private' | 'internal';

/**
 * Member role within a team
 */
export type TeamMemberRole = 'owner' | 'admin' | 'member' | 'guest';

/**
 * Team definition
 */
export interface Team {
  /** Team unique identifier */
  id: string;
  /** Team name */
  name: string;
  /** Team description */
  description?: string;
  /** Team slug for URLs */
  slug: string;
  /** Team status */
  status: TeamStatus;
  /** Team visibility */
  visibility: TeamVisibility;
  /** Parent team ID (for hierarchy) */
  parentId?: string;
  /** Team settings */
  settings: TeamSettings;
  /** Team metadata */
  metadata?: Record<string, unknown>;
  /** When team was created */
  createdAt: Date;
  /** When team was last updated */
  updatedAt: Date;
  /** Who created the team */
  createdBy: string;
  /** Team avatar URL */
  avatarUrl?: string;
}

/**
 * Team settings
 */
export interface TeamSettings {
  /** Allow members to invite others */
  allowMemberInvite: boolean;
  /** Require approval for new members */
  requireApproval: boolean;
  /** Default role for new members */
  defaultMemberRole: TeamMemberRole;
  /** Maximum team members (0 = unlimited) */
  maxMembers: number;
  /** Allowed project types */
  allowedProjectTypes?: string[];
  /** Resource quotas */
  quotas: TeamQuotas;
  /** Notification settings */
  notifications: TeamNotificationSettings;
}

/**
 * Team resource quotas
 */
export interface TeamQuotas {
  /** Maximum projects */
  maxProjects: number;
  /** Maximum workflows per day */
  maxWorkflowsPerDay: number;
  /** Maximum agent hours per month */
  maxAgentHoursPerMonth: number;
  /** Maximum storage in bytes */
  maxStorageBytes: number;
  /** Maximum API calls per hour */
  maxApiCallsPerHour: number;
}

/**
 * Team notification settings
 */
export interface TeamNotificationSettings {
  /** Notify on member join */
  onMemberJoin: boolean;
  /** Notify on member leave */
  onMemberLeave: boolean;
  /** Notify on project create */
  onProjectCreate: boolean;
  /** Notify on workflow complete */
  onWorkflowComplete: boolean;
  /** Notify on quota warning (percentage) */
  quotaWarningThreshold: number;
}

/**
 * Team member
 */
export interface TeamMember {
  /** Member unique identifier */
  id: string;
  /** Team ID */
  teamId: string;
  /** User ID */
  userId: string;
  /** User email */
  email: string;
  /** User display name */
  displayName: string;
  /** Role within the team */
  role: TeamMemberRole;
  /** Custom permissions (override role defaults) */
  customPermissions?: string[];
  /** When member joined */
  joinedAt: Date;
  /** Who invited the member */
  invitedBy?: string;
  /** Member status */
  status: 'active' | 'pending' | 'suspended';
  /** Last activity timestamp */
  lastActiveAt?: Date;
  /** Member metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Team invitation
 */
export interface TeamInvitation {
  /** Invitation unique identifier */
  id: string;
  /** Team ID */
  teamId: string;
  /** Invitee email */
  email: string;
  /** Assigned role */
  role: TeamMemberRole;
  /** Invitation token */
  token: string;
  /** When invitation was created */
  createdAt: Date;
  /** When invitation expires */
  expiresAt: Date;
  /** Who sent the invitation */
  invitedBy: string;
  /** Invitation status */
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  /** Personal message */
  message?: string;
}

/**
 * Team activity log entry
 */
export interface TeamActivity {
  /** Activity unique identifier */
  id: string;
  /** Team ID */
  teamId: string;
  /** Activity type */
  type: TeamActivityType;
  /** Actor user ID */
  actorId: string;
  /** Activity target (user, project, etc.) */
  targetId?: string;
  /** Activity target type */
  targetType?: string;
  /** Activity description */
  description: string;
  /** Activity metadata */
  metadata?: Record<string, unknown>;
  /** When activity occurred */
  timestamp: Date;
}

/**
 * Team activity types
 */
export type TeamActivityType =
  | 'team.created'
  | 'team.updated'
  | 'team.deleted'
  | 'member.added'
  | 'member.removed'
  | 'member.role_changed'
  | 'member.suspended'
  | 'invitation.sent'
  | 'invitation.accepted'
  | 'invitation.declined'
  | 'project.created'
  | 'project.removed'
  | 'settings.changed'
  | 'quota.warning'
  | 'quota.exceeded';

/**
 * Team statistics
 */
export interface TeamStatistics {
  /** Total members */
  totalMembers: number;
  /** Active members (last 30 days) */
  activeMembers: number;
  /** Total projects */
  totalProjects: number;
  /** Workflows run this month */
  workflowsThisMonth: number;
  /** Agent hours used this month */
  agentHoursThisMonth: number;
  /** Storage used in bytes */
  storageUsedBytes: number;
  /** API calls this hour */
  apiCallsThisHour: number;
  /** Pending invitations */
  pendingInvitations: number;
  /** Last activity timestamp */
  lastActivityAt?: Date;
}

/**
 * Team hierarchy node
 */
export interface TeamHierarchyNode {
  /** Team data */
  team: Team;
  /** Child teams */
  children: TeamHierarchyNode[];
  /** Team statistics */
  statistics?: TeamStatistics;
  /** Depth in hierarchy */
  depth: number;
}

/**
 * Create team request
 */
export interface CreateTeamRequest {
  /** Team name */
  name: string;
  /** Team description */
  description?: string;
  /** Team visibility */
  visibility?: TeamVisibility;
  /** Parent team ID */
  parentId?: string;
  /** Initial settings */
  settings?: Partial<TeamSettings>;
  /** Initial metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Update team request
 */
export interface UpdateTeamRequest {
  /** Team name */
  name?: string;
  /** Team description */
  description?: string;
  /** Team status */
  status?: TeamStatus;
  /** Team visibility */
  visibility?: TeamVisibility;
  /** Team settings */
  settings?: Partial<TeamSettings>;
  /** Team metadata */
  metadata?: Record<string, unknown>;
  /** Avatar URL */
  avatarUrl?: string;
}

/**
 * Add member request
 */
export interface AddMemberRequest {
  /** User ID to add */
  userId: string;
  /** User email */
  email: string;
  /** User display name */
  displayName: string;
  /** Role to assign */
  role?: TeamMemberRole;
  /** Custom permissions */
  customPermissions?: string[];
  /** Skip invitation (direct add) */
  skipInvitation?: boolean;
}

/**
 * Update member request
 */
export interface UpdateMemberRequest {
  /** New role */
  role?: TeamMemberRole;
  /** Custom permissions */
  customPermissions?: string[];
  /** Member status */
  status?: 'active' | 'suspended';
  /** Metadata updates */
  metadata?: Record<string, unknown>;
}

/**
 * Team filter options
 */
export interface TeamFilter {
  /** Filter by status */
  status?: TeamStatus;
  /** Filter by visibility */
  visibility?: TeamVisibility;
  /** Filter by parent ID */
  parentId?: string | null;
  /** Filter by name pattern */
  namePattern?: string;
  /** Include archived teams */
  includeArchived?: boolean;
}

/**
 * Member filter options
 */
export interface MemberFilter {
  /** Filter by role */
  role?: TeamMemberRole;
  /** Filter by status */
  status?: 'active' | 'pending' | 'suspended';
  /** Search by name or email */
  search?: string;
}

/**
 * Team event
 */
export interface TeamEvent {
  /** Event type */
  type: TeamActivityType;
  /** Team ID */
  teamId: string;
  /** Event data */
  data: Record<string, unknown>;
  /** Event timestamp */
  timestamp: Date;
}

/**
 * Team Manager interface
 */
export interface ITeamManager extends IDisposable {
  // ==================== Team Management ====================

  /**
   * Create a new team
   * @param request Team creation request
   * @param creatorId Creator user ID
   */
  createTeam(request: CreateTeamRequest, creatorId: string): Promise<Team>;

  /**
   * Get a team by ID
   * @param teamId Team identifier
   */
  getTeam(teamId: string): Promise<Team | undefined>;

  /**
   * Get a team by slug
   * @param slug Team slug
   */
  getTeamBySlug(slug: string): Promise<Team | undefined>;

  /**
   * Update a team
   * @param teamId Team identifier
   * @param updates Update request
   */
  updateTeam(teamId: string, updates: UpdateTeamRequest): Promise<Team>;

  /**
   * Delete a team
   * @param teamId Team identifier
   * @param force Force delete even with members
   */
  deleteTeam(teamId: string, force?: boolean): Promise<boolean>;

  /**
   * Archive a team
   * @param teamId Team identifier
   */
  archiveTeam(teamId: string): Promise<Team>;

  /**
   * Restore an archived team
   * @param teamId Team identifier
   */
  restoreTeam(teamId: string): Promise<Team>;

  /**
   * Get all teams
   * @param filter Optional filter
   */
  getTeams(filter?: TeamFilter): Promise<Team[]>;

  /**
   * Get teams for a user
   * @param userId User identifier
   */
  getUserTeams(userId: string): Promise<Team[]>;

  /**
   * Get team hierarchy
   * @param rootTeamId Optional root team ID (null for top-level)
   */
  getTeamHierarchy(rootTeamId?: string): Promise<TeamHierarchyNode[]>;

  // ==================== Member Management ====================

  /**
   * Add a member to a team
   * @param teamId Team identifier
   * @param request Add member request
   * @param inviterId Inviter user ID
   */
  addMember(teamId: string, request: AddMemberRequest, inviterId: string): Promise<TeamMember>;

  /**
   * Remove a member from a team
   * @param teamId Team identifier
   * @param userId User identifier
   */
  removeMember(teamId: string, userId: string): Promise<boolean>;

  /**
   * Update a member
   * @param teamId Team identifier
   * @param userId User identifier
   * @param updates Update request
   */
  updateMember(teamId: string, userId: string, updates: UpdateMemberRequest): Promise<TeamMember>;

  /**
   * Get a member
   * @param teamId Team identifier
   * @param userId User identifier
   */
  getMember(teamId: string, userId: string): Promise<TeamMember | undefined>;

  /**
   * Get all members of a team
   * @param teamId Team identifier
   * @param filter Optional filter
   */
  getMembers(teamId: string, filter?: MemberFilter): Promise<TeamMember[]>;

  /**
   * Check if user is a member of a team
   * @param teamId Team identifier
   * @param userId User identifier
   */
  isMember(teamId: string, userId: string): Promise<boolean>;

  /**
   * Change member role
   * @param teamId Team identifier
   * @param userId User identifier
   * @param newRole New role
   */
  changeMemberRole(teamId: string, userId: string, newRole: TeamMemberRole): Promise<TeamMember>;

  /**
   * Transfer team ownership
   * @param teamId Team identifier
   * @param newOwnerId New owner user ID
   */
  transferOwnership(teamId: string, newOwnerId: string): Promise<void>;

  // ==================== Invitation Management ====================

  /**
   * Create an invitation
   * @param teamId Team identifier
   * @param email Invitee email
   * @param role Role to assign
   * @param inviterId Inviter user ID
   * @param message Optional message
   */
  createInvitation(
    teamId: string,
    email: string,
    role: TeamMemberRole,
    inviterId: string,
    message?: string
  ): Promise<TeamInvitation>;

  /**
   * Get an invitation by token
   * @param token Invitation token
   */
  getInvitationByToken(token: string): Promise<TeamInvitation | undefined>;

  /**
   * Get pending invitations for a team
   * @param teamId Team identifier
   */
  getPendingInvitations(teamId: string): Promise<TeamInvitation[]>;

  /**
   * Accept an invitation
   * @param token Invitation token
   * @param userId User ID accepting
   * @param displayName User display name
   */
  acceptInvitation(token: string, userId: string, displayName: string): Promise<TeamMember>;

  /**
   * Decline an invitation
   * @param token Invitation token
   */
  declineInvitation(token: string): Promise<void>;

  /**
   * Cancel an invitation
   * @param invitationId Invitation identifier
   */
  cancelInvitation(invitationId: string): Promise<void>;

  /**
   * Resend an invitation
   * @param invitationId Invitation identifier
   */
  resendInvitation(invitationId: string): Promise<TeamInvitation>;

  // ==================== Permissions & Roles ====================

  /**
   * Check if user has permission in team
   * @param teamId Team identifier
   * @param userId User identifier
   * @param permission Permission to check
   */
  hasPermission(teamId: string, userId: string, permission: string): Promise<boolean>;

  /**
   * Get effective permissions for a user in a team
   * @param teamId Team identifier
   * @param userId User identifier
   */
  getEffectivePermissions(teamId: string, userId: string): Promise<string[]>;

  /**
   * Get team role permissions
   * @param role Team member role
   */
  getRolePermissions(role: TeamMemberRole): string[];

  // ==================== Activity & Statistics ====================

  /**
   * Log team activity
   * @param activity Activity to log
   */
  logActivity(activity: Omit<TeamActivity, 'id' | 'timestamp'>): Promise<TeamActivity>;

  /**
   * Get team activities
   * @param teamId Team identifier
   * @param limit Maximum activities to return
   * @param offset Offset for pagination
   */
  getActivities(teamId: string, limit?: number, offset?: number): Promise<TeamActivity[]>;

  /**
   * Get team statistics
   * @param teamId Team identifier
   */
  getStatistics(teamId: string): Promise<TeamStatistics>;

  /**
   * Check team quotas
   * @param teamId Team identifier
   */
  checkQuotas(teamId: string): Promise<QuotaCheckResult>;

  // ==================== Events ====================

  /**
   * Subscribe to team events
   * @param handler Event handler
   */
  onTeamEvent(handler: (event: TeamEvent) => void): () => void;
}

/**
 * Quota check result
 */
export interface QuotaCheckResult {
  /** Whether any quota is exceeded */
  exceeded: boolean;
  /** Whether any quota is at warning level */
  warning: boolean;
  /** Detailed quota status */
  quotas: {
    projects: QuotaStatus;
    workflowsPerDay: QuotaStatus;
    agentHoursPerMonth: QuotaStatus;
    storage: QuotaStatus;
    apiCallsPerHour: QuotaStatus;
  };
}

/**
 * Individual quota status
 */
export interface QuotaStatus {
  /** Current usage */
  current: number;
  /** Maximum allowed */
  max: number;
  /** Usage percentage */
  percentage: number;
  /** Whether exceeded */
  exceeded: boolean;
  /** Whether at warning level */
  warning: boolean;
}

/**
 * Default team settings
 */
export const DEFAULT_TEAM_SETTINGS: TeamSettings = {
  allowMemberInvite: true,
  requireApproval: false,
  defaultMemberRole: 'member',
  maxMembers: 0, // unlimited
  quotas: {
    maxProjects: 50,
    maxWorkflowsPerDay: 1000,
    maxAgentHoursPerMonth: 500,
    maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10GB
    maxApiCallsPerHour: 10000,
  },
  notifications: {
    onMemberJoin: true,
    onMemberLeave: true,
    onProjectCreate: false,
    onWorkflowComplete: false,
    quotaWarningThreshold: 80,
  },
};

/**
 * Team role permissions mapping
 */
export const TEAM_ROLE_PERMISSIONS: Record<TeamMemberRole, string[]> = {
  owner: [
    'team:manage',
    'team:delete',
    'team:settings',
    'member:manage',
    'member:invite',
    'member:remove',
    'project:manage',
    'project:create',
    'project:delete',
    'workflow:manage',
    'workflow:execute',
    'billing:manage',
    'audit:view',
  ],
  admin: [
    'team:settings',
    'member:manage',
    'member:invite',
    'member:remove',
    'project:manage',
    'project:create',
    'project:delete',
    'workflow:manage',
    'workflow:execute',
    'audit:view',
  ],
  member: [
    'member:invite',
    'project:create',
    'project:view',
    'workflow:execute',
    'workflow:view',
  ],
  guest: [
    'project:view',
    'workflow:view',
  ],
};
