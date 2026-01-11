/**
 * Team Manager Tests
 *
 * Feature: F5.10 - Team Management
 */

import {
  TeamManager,
  type Team,
  type CreateTeamRequest,
  type AddMemberRequest,
  DEFAULT_TEAM_SETTINGS,
} from '../../../../src/core/enterprise/team/index.js';

describe('TeamManager', () => {
  let manager: TeamManager;
  const creatorId = 'user-creator';

  beforeEach(() => {
    manager = new TeamManager();
  });

  afterEach(() => {
    manager.dispose();
  });

  // ==================== Team Management ====================

  describe('Team Management', () => {
    describe('createTeam', () => {
      it('should create a team with default settings', async () => {
        const request: CreateTeamRequest = {
          name: 'Engineering Team',
          description: 'Core engineering team',
        };

        const team = await manager.createTeam(request, creatorId);

        expect(team.id).toBeDefined();
        expect(team.name).toBe('Engineering Team');
        expect(team.description).toBe('Core engineering team');
        expect(team.slug).toBe('engineering-team');
        expect(team.status).toBe('active');
        expect(team.visibility).toBe('private');
        expect(team.createdBy).toBe(creatorId);
        expect(team.settings).toEqual(expect.objectContaining(DEFAULT_TEAM_SETTINGS));
      });

      it('should add creator as owner automatically', async () => {
        const team = await manager.createTeam({ name: 'Test Team' }, creatorId);
        const member = await manager.getMember(team.id, creatorId);

        expect(member).toBeDefined();
        expect(member!.role).toBe('owner');
        expect(member!.status).toBe('active');
      });

      it('should create team with custom settings', async () => {
        const request: CreateTeamRequest = {
          name: 'Custom Team',
          visibility: 'public',
          settings: {
            maxMembers: 10,
            requireApproval: true,
            quotas: {
              maxProjects: 100,
              maxWorkflowsPerDay: 500,
              maxAgentHoursPerMonth: 1000,
              maxStorageBytes: 1024 * 1024 * 1024,
              maxApiCallsPerHour: 5000,
            },
          },
        };

        const team = await manager.createTeam(request, creatorId);

        expect(team.visibility).toBe('public');
        expect(team.settings.maxMembers).toBe(10);
        expect(team.settings.requireApproval).toBe(true);
        expect(team.settings.quotas.maxProjects).toBe(100);
      });

      it('should reject duplicate slug', async () => {
        await manager.createTeam({ name: 'Test Team' }, creatorId);

        await expect(manager.createTeam({ name: 'Test Team' }, creatorId)).rejects.toThrow(
          'already exists'
        );
      });

      it('should create team with parent', async () => {
        const parent = await manager.createTeam({ name: 'Parent Team' }, creatorId);
        const child = await manager.createTeam(
          { name: 'Child Team', parentId: parent.id },
          creatorId
        );

        expect(child.parentId).toBe(parent.id);
      });

      it('should reject invalid parent', async () => {
        await expect(
          manager.createTeam({ name: 'Test', parentId: 'invalid' }, creatorId)
        ).rejects.toThrow('not found');
      });

      it('should emit team.created event', async () => {
        const handler = jest.fn();
        manager.onTeamEvent(handler);

        await manager.createTeam({ name: 'Event Team' }, creatorId);

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'team.created',
          })
        );
      });
    });

    describe('getTeam', () => {
      it('should get team by ID', async () => {
        const created = await manager.createTeam({ name: 'Test' }, creatorId);
        const team = await manager.getTeam(created.id);

        expect(team).toBeDefined();
        expect(team!.id).toBe(created.id);
      });

      it('should return undefined for non-existent team', async () => {
        const team = await manager.getTeam('non-existent');
        expect(team).toBeUndefined();
      });
    });

    describe('getTeamBySlug', () => {
      it('should get team by slug', async () => {
        await manager.createTeam({ name: 'My Team' }, creatorId);
        const team = await manager.getTeamBySlug('my-team');

        expect(team).toBeDefined();
        expect(team!.name).toBe('My Team');
      });
    });

    describe('updateTeam', () => {
      it('should update team properties', async () => {
        const team = await manager.createTeam({ name: 'Original' }, creatorId);
        const updated = await manager.updateTeam(team.id, {
          name: 'Updated',
          description: 'New description',
          visibility: 'public',
        });

        expect(updated.name).toBe('Updated');
        expect(updated.description).toBe('New description');
        expect(updated.visibility).toBe('public');
        expect(updated.slug).toBe('updated');
        // Use >= because operations may complete within same millisecond
        expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(team.updatedAt.getTime());
      });

      it('should update team settings', async () => {
        const team = await manager.createTeam({ name: 'Test' }, creatorId);
        const updated = await manager.updateTeam(team.id, {
          settings: {
            maxMembers: 50,
          },
        });

        expect(updated.settings.maxMembers).toBe(50);
        // Other settings should be preserved
        expect(updated.settings.allowMemberInvite).toBe(true);
      });

      it('should reject non-existent team', async () => {
        await expect(manager.updateTeam('invalid', { name: 'Test' })).rejects.toThrow('not found');
      });
    });

    describe('deleteTeam', () => {
      it('should delete team with only owner', async () => {
        const team = await manager.createTeam({ name: 'Test' }, creatorId);
        const result = await manager.deleteTeam(team.id);

        expect(result).toBe(true);
        expect(await manager.getTeam(team.id)).toBeUndefined();
      });

      it('should not delete team with members without force', async () => {
        const team = await manager.createTeam({ name: 'Test' }, creatorId);
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User 2', skipInvitation: true },
          creatorId
        );

        await expect(manager.deleteTeam(team.id)).rejects.toThrow('force=true');
      });

      it('should delete team with members when force=true', async () => {
        const team = await manager.createTeam({ name: 'Test' }, creatorId);
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User 2', skipInvitation: true },
          creatorId
        );

        const result = await manager.deleteTeam(team.id, true);
        expect(result).toBe(true);
      });
    });

    describe('archiveTeam / restoreTeam', () => {
      it('should archive and restore team', async () => {
        const team = await manager.createTeam({ name: 'Test' }, creatorId);

        const archived = await manager.archiveTeam(team.id);
        expect(archived.status).toBe('archived');

        const restored = await manager.restoreTeam(team.id);
        expect(restored.status).toBe('active');
      });
    });

    describe('getTeams', () => {
      beforeEach(async () => {
        await manager.createTeam({ name: 'Team A', visibility: 'public' }, creatorId);
        await manager.createTeam({ name: 'Team B', visibility: 'private' }, creatorId);
        const archived = await manager.createTeam({ name: 'Team C' }, creatorId);
        await manager.archiveTeam(archived.id);
      });

      it('should get all active teams', async () => {
        const teams = await manager.getTeams();
        expect(teams.length).toBe(2);
      });

      it('should filter by visibility', async () => {
        const teams = await manager.getTeams({ visibility: 'public' });
        expect(teams.length).toBe(1);
        expect(teams[0].name).toBe('Team A');
      });

      it('should include archived when specified', async () => {
        const teams = await manager.getTeams({ includeArchived: true });
        expect(teams.length).toBe(3);
      });

      it('should filter by name pattern', async () => {
        const teams = await manager.getTeams({ namePattern: 'Team A' });
        expect(teams.length).toBe(1);
      });
    });

    describe('getUserTeams', () => {
      it('should get teams for user', async () => {
        await manager.createTeam({ name: 'Team 1' }, creatorId);
        await manager.createTeam({ name: 'Team 2' }, creatorId);

        const teams = await manager.getUserTeams(creatorId);
        expect(teams.length).toBe(2);
      });

      it('should return empty for user with no teams', async () => {
        const teams = await manager.getUserTeams('unknown-user');
        expect(teams).toEqual([]);
      });
    });

    describe('getTeamHierarchy', () => {
      it('should build team hierarchy', async () => {
        const parent = await manager.createTeam({ name: 'Parent' }, creatorId);
        await manager.createTeam({ name: 'Child 1', parentId: parent.id }, 'user1');
        await manager.createTeam({ name: 'Child 2', parentId: parent.id }, 'user2');

        const hierarchy = await manager.getTeamHierarchy();

        expect(hierarchy.length).toBe(1);
        expect(hierarchy[0].team.name).toBe('Parent');
        expect(hierarchy[0].children.length).toBe(2);
        expect(hierarchy[0].depth).toBe(0);
        expect(hierarchy[0].children[0].depth).toBe(1);
      });
    });
  });

  // ==================== Member Management ====================

  describe('Member Management', () => {
    let team: Team;

    beforeEach(async () => {
      team = await manager.createTeam({ name: 'Test Team' }, creatorId);
    });

    describe('addMember', () => {
      it('should add member with default role', async () => {
        const request: AddMemberRequest = {
          userId: 'user2',
          email: 'user2@test.com',
          displayName: 'User Two',
          skipInvitation: true,
        };

        const member = await manager.addMember(team.id, request, creatorId);

        expect(member.userId).toBe('user2');
        expect(member.role).toBe('member'); // default role
        expect(member.status).toBe('active');
      });

      it('should add member with specified role', async () => {
        const member = await manager.addMember(
          team.id,
          { userId: 'admin', email: 'admin@test.com', displayName: 'Admin', role: 'admin', skipInvitation: true },
          creatorId
        );

        expect(member.role).toBe('admin');
      });

      it('should reject duplicate member', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User', skipInvitation: true },
          creatorId
        );

        await expect(
          manager.addMember(
            team.id,
            { userId: 'user2', email: 'user2@test.com', displayName: 'User', skipInvitation: true },
            creatorId
          )
        ).rejects.toThrow('already a member');
      });

      it('should respect member limit', async () => {
        await manager.updateTeam(team.id, { settings: { maxMembers: 2 } });

        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User 2', skipInvitation: true },
          creatorId
        );

        await expect(
          manager.addMember(
            team.id,
            { userId: 'user3', email: 'user3@test.com', displayName: 'User 3', skipInvitation: true },
            creatorId
          )
        ).rejects.toThrow('maximum member limit');
      });

      it('should emit member.added event', async () => {
        const handler = jest.fn();
        manager.onTeamEvent(handler);

        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User', skipInvitation: true },
          creatorId
        );

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'member.added' })
        );
      });
    });

    describe('removeMember', () => {
      it('should remove member', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User', skipInvitation: true },
          creatorId
        );

        const result = await manager.removeMember(team.id, 'user2');

        expect(result).toBe(true);
        expect(await manager.getMember(team.id, 'user2')).toBeUndefined();
      });

      it('should not remove last owner', async () => {
        await expect(manager.removeMember(team.id, creatorId)).rejects.toThrow('last owner');
      });

      it('should allow removing owner if another exists', async () => {
        await manager.addMember(
          team.id,
          { userId: 'owner2', email: 'owner2@test.com', displayName: 'Owner 2', role: 'owner', skipInvitation: true },
          creatorId
        );

        const result = await manager.removeMember(team.id, creatorId);
        expect(result).toBe(true);
      });
    });

    describe('updateMember', () => {
      it('should update member', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User', skipInvitation: true },
          creatorId
        );

        const updated = await manager.updateMember(team.id, 'user2', { role: 'admin' });

        expect(updated.role).toBe('admin');
      });

      it('should emit role change event', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User', skipInvitation: true },
          creatorId
        );

        const handler = jest.fn();
        manager.onTeamEvent(handler);

        await manager.updateMember(team.id, 'user2', { role: 'admin' });

        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'member.role_changed' })
        );
      });
    });

    describe('getMembers', () => {
      beforeEach(async () => {
        await manager.addMember(
          team.id,
          { userId: 'admin1', email: 'admin1@test.com', displayName: 'Admin 1', role: 'admin', skipInvitation: true },
          creatorId
        );
        await manager.addMember(
          team.id,
          { userId: 'member1', email: 'member1@test.com', displayName: 'Member 1', skipInvitation: true },
          creatorId
        );
      });

      it('should get all members', async () => {
        const members = await manager.getMembers(team.id);
        expect(members.length).toBe(3); // creator + 2 added
      });

      it('should filter by role', async () => {
        const admins = await manager.getMembers(team.id, { role: 'admin' });
        expect(admins.length).toBe(1);
      });

      it('should search by name', async () => {
        const members = await manager.getMembers(team.id, { search: 'admin' });
        expect(members.length).toBe(1);
      });
    });

    describe('isMember', () => {
      it('should return true for member', async () => {
        expect(await manager.isMember(team.id, creatorId)).toBe(true);
      });

      it('should return false for non-member', async () => {
        expect(await manager.isMember(team.id, 'unknown')).toBe(false);
      });
    });

    describe('changeMemberRole', () => {
      it('should change member role', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User', skipInvitation: true },
          creatorId
        );

        const member = await manager.changeMemberRole(team.id, 'user2', 'admin');
        expect(member.role).toBe('admin');
      });
    });

    describe('transferOwnership', () => {
      it('should transfer ownership', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User', role: 'admin', skipInvitation: true },
          creatorId
        );

        await manager.transferOwnership(team.id, 'user2');

        const oldOwner = await manager.getMember(team.id, creatorId);
        const newOwner = await manager.getMember(team.id, 'user2');

        expect(oldOwner!.role).toBe('admin');
        expect(newOwner!.role).toBe('owner');
      });

      it('should reject non-member', async () => {
        await expect(manager.transferOwnership(team.id, 'unknown')).rejects.toThrow('not a member');
      });
    });
  });

  // ==================== Invitation Management ====================

  describe('Invitation Management', () => {
    let team: Team;

    beforeEach(async () => {
      team = await manager.createTeam({ name: 'Test Team' }, creatorId);
    });

    describe('createInvitation', () => {
      it('should create invitation', async () => {
        const invitation = await manager.createInvitation(
          team.id,
          'new@test.com',
          'member',
          creatorId,
          'Welcome!'
        );

        expect(invitation.email).toBe('new@test.com');
        expect(invitation.role).toBe('member');
        expect(invitation.status).toBe('pending');
        expect(invitation.token).toBeDefined();
        expect(invitation.message).toBe('Welcome!');
      });

      it('should reject duplicate pending invitation', async () => {
        await manager.createInvitation(team.id, 'test@test.com', 'member', creatorId);

        await expect(
          manager.createInvitation(team.id, 'test@test.com', 'member', creatorId)
        ).rejects.toThrow('already pending');
      });
    });

    describe('acceptInvitation', () => {
      it('should accept invitation and add member', async () => {
        const invitation = await manager.createInvitation(
          team.id,
          'new@test.com',
          'member',
          creatorId
        );

        const member = await manager.acceptInvitation(invitation.token, 'new-user', 'New User');

        expect(member.userId).toBe('new-user');
        expect(member.role).toBe('member');

        const updatedInvitation = await manager.getInvitationByToken(invitation.token);
        expect(updatedInvitation!.status).toBe('accepted');
      });

      it('should reject expired invitation', async () => {
        const invitation = await manager.createInvitation(
          team.id,
          'new@test.com',
          'member',
          creatorId
        );

        // Manually expire
        (invitation as any).expiresAt = new Date(Date.now() - 1000);

        await expect(
          manager.acceptInvitation(invitation.token, 'new-user', 'New User')
        ).rejects.toThrow('expired');
      });
    });

    describe('declineInvitation', () => {
      it('should decline invitation', async () => {
        const invitation = await manager.createInvitation(
          team.id,
          'new@test.com',
          'member',
          creatorId
        );

        await manager.declineInvitation(invitation.token);

        const updated = await manager.getInvitationByToken(invitation.token);
        expect(updated!.status).toBe('declined');
      });
    });

    describe('getPendingInvitations', () => {
      it('should get pending invitations', async () => {
        await manager.createInvitation(team.id, 'user1@test.com', 'member', creatorId);
        await manager.createInvitation(team.id, 'user2@test.com', 'admin', creatorId);

        const invitations = await manager.getPendingInvitations(team.id);
        expect(invitations.length).toBe(2);
      });
    });

    describe('cancelInvitation', () => {
      it('should cancel invitation', async () => {
        const invitation = await manager.createInvitation(
          team.id,
          'new@test.com',
          'member',
          creatorId
        );

        await manager.cancelInvitation(invitation.id);

        const found = await manager.getInvitationByToken(invitation.token);
        expect(found).toBeUndefined();
      });
    });

    describe('resendInvitation', () => {
      it('should resend invitation with new token', async () => {
        const original = await manager.createInvitation(
          team.id,
          'new@test.com',
          'member',
          creatorId
        );

        const resent = await manager.resendInvitation(original.id);

        expect(resent.email).toBe(original.email);
        expect(resent.token).not.toBe(original.token);
        expect(await manager.getInvitationByToken(original.token)).toBeUndefined();
      });
    });
  });

  // ==================== Permissions ====================

  describe('Permissions', () => {
    let team: Team;

    beforeEach(async () => {
      team = await manager.createTeam({ name: 'Test Team' }, creatorId);
      await manager.addMember(
        team.id,
        { userId: 'admin1', email: 'admin@test.com', displayName: 'Admin', role: 'admin', skipInvitation: true },
        creatorId
      );
      await manager.addMember(
        team.id,
        { userId: 'member1', email: 'member@test.com', displayName: 'Member', skipInvitation: true },
        creatorId
      );
      await manager.addMember(
        team.id,
        { userId: 'guest1', email: 'guest@test.com', displayName: 'Guest', role: 'guest', skipInvitation: true },
        creatorId
      );
    });

    describe('hasPermission', () => {
      it('owner should have all permissions', async () => {
        expect(await manager.hasPermission(team.id, creatorId, 'team:manage')).toBe(true);
        expect(await manager.hasPermission(team.id, creatorId, 'member:remove')).toBe(true);
        expect(await manager.hasPermission(team.id, creatorId, 'billing:manage')).toBe(true);
      });

      it('admin should have management permissions', async () => {
        expect(await manager.hasPermission(team.id, 'admin1', 'member:manage')).toBe(true);
        expect(await manager.hasPermission(team.id, 'admin1', 'billing:manage')).toBe(false);
      });

      it('member should have limited permissions', async () => {
        expect(await manager.hasPermission(team.id, 'member1', 'project:create')).toBe(true);
        expect(await manager.hasPermission(team.id, 'member1', 'member:manage')).toBe(false);
      });

      it('guest should have read-only permissions', async () => {
        expect(await manager.hasPermission(team.id, 'guest1', 'project:view')).toBe(true);
        expect(await manager.hasPermission(team.id, 'guest1', 'project:create')).toBe(false);
      });

      it('non-member should have no permissions', async () => {
        expect(await manager.hasPermission(team.id, 'unknown', 'project:view')).toBe(false);
      });
    });

    describe('getEffectivePermissions', () => {
      it('should return all effective permissions', async () => {
        const permissions = await manager.getEffectivePermissions(team.id, 'admin1');

        expect(permissions).toContain('member:manage');
        expect(permissions).toContain('project:create');
        expect(permissions).not.toContain('billing:manage');
      });

      it('should include custom permissions', async () => {
        await manager.updateMember(team.id, 'member1', {
          customPermissions: ['billing:view'],
        });

        const permissions = await manager.getEffectivePermissions(team.id, 'member1');
        expect(permissions).toContain('billing:view');
      });
    });

    describe('getRolePermissions', () => {
      it('should return role permissions', () => {
        const ownerPerms = manager.getRolePermissions('owner');
        expect(ownerPerms).toContain('team:manage');

        const guestPerms = manager.getRolePermissions('guest');
        expect(guestPerms).toContain('project:view');
        expect(guestPerms).not.toContain('project:create');
      });
    });
  });

  // ==================== Activity & Statistics ====================

  describe('Activity & Statistics', () => {
    let team: Team;

    beforeEach(async () => {
      team = await manager.createTeam({ name: 'Test Team' }, creatorId);
    });

    describe('logActivity', () => {
      it('should log activity', async () => {
        const activity = await manager.logActivity({
          teamId: team.id,
          type: 'member.added',
          actorId: creatorId,
          description: 'Test activity',
        });

        expect(activity.id).toBeDefined();
        expect(activity.timestamp).toBeDefined();
      });
    });

    describe('getActivities', () => {
      it('should get activities in reverse chronological order', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user1', email: 'user1@test.com', displayName: 'User 1', skipInvitation: true },
          creatorId
        );
        await manager.addMember(
          team.id,
          { userId: 'user2', email: 'user2@test.com', displayName: 'User 2', skipInvitation: true },
          creatorId
        );

        const activities = await manager.getActivities(team.id);

        expect(activities.length).toBeGreaterThan(0);
        // Most recent first
        expect(activities[0].timestamp.getTime()).toBeGreaterThanOrEqual(
          activities[1].timestamp.getTime()
        );
      });

      it('should support pagination', async () => {
        const activities = await manager.getActivities(team.id, 1, 0);
        expect(activities.length).toBe(1);
      });
    });

    describe('getStatistics', () => {
      it('should return team statistics', async () => {
        await manager.addMember(
          team.id,
          { userId: 'user1', email: 'user1@test.com', displayName: 'User 1', skipInvitation: true },
          creatorId
        );

        const stats = await manager.getStatistics(team.id);

        expect(stats.totalMembers).toBe(2);
        expect(stats.pendingInvitations).toBe(0);
        expect(stats.totalProjects).toBe(0);
      });
    });

    describe('checkQuotas', () => {
      it('should check quotas', async () => {
        const result = await manager.checkQuotas(team.id);

        expect(result.exceeded).toBe(false);
        expect(result.warning).toBe(false);
        expect(result.quotas.projects).toBeDefined();
        expect(result.quotas.storage).toBeDefined();
      });
    });
  });

  // ==================== Events ====================

  describe('Events', () => {
    it('should subscribe and unsubscribe from events', async () => {
      const handler = jest.fn();
      const unsubscribe = manager.onTeamEvent(handler);

      await manager.createTeam({ name: 'Test' }, creatorId);
      expect(handler).toHaveBeenCalled();

      handler.mockClear();
      unsubscribe();

      await manager.createTeam({ name: 'Test 2' }, 'user2');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  // ==================== Lifecycle ====================

  describe('Lifecycle', () => {
    it('should throw after dispose', async () => {
      manager.dispose();

      await expect(manager.createTeam({ name: 'Test' }, creatorId)).rejects.toThrow('disposed');
    });

    it('should clean up data on dispose', async () => {
      await manager.createTeam({ name: 'Test' }, creatorId);

      manager.dispose();

      // Create new manager to verify cleanup
      const newManager = new TeamManager();
      const teams = await newManager.getTeams();
      expect(teams.length).toBe(0);
      newManager.dispose();
    });
  });
});
