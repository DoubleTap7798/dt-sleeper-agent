import { 
  userProfiles, 
  leagueNotifications, 
  userNotificationStatus,
  leagueSyncStatus,
  userLeagueTakeover,
  leagueSettings,
  type UserProfile, 
  type InsertUserProfile,
  type LeagueNotification,
  type InsertLeagueNotification,
  type LeagueSyncStatus,
  type UserLeagueTakeover,
  type InsertUserLeagueTakeover,
  type LeagueSettings
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, notInArray, inArray } from "drizzle-orm";

export interface IStorage {
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateSelectedLeague(userId: string, leagueId: string): Promise<void>;
  
  // Notifications
  createNotification(notification: InsertLeagueNotification): Promise<LeagueNotification>;
  getNotificationsByLeague(leagueId: string, limit?: number): Promise<LeagueNotification[]>;
  getUnreadNotifications(userId: string, leagueId: string): Promise<LeagueNotification[]>;
  markNotificationsRead(userId: string, notificationIds: string[]): Promise<void>;
  notificationExists(transactionId: string): Promise<boolean>;
  
  // Sync status
  getSyncStatus(leagueId: string): Promise<LeagueSyncStatus | undefined>;
  updateSyncStatus(leagueId: string, updates: Partial<LeagueSyncStatus>): Promise<void>;
  
  // League takeover (for orphan teams)
  getLeagueTakeover(userId: string, leagueId: string): Promise<UserLeagueTakeover | undefined>;
  getAllLeagueTakeovers(userId: string): Promise<UserLeagueTakeover[]>;
  upsertLeagueTakeover(userId: string, leagueId: string, takeoverSeason: number): Promise<UserLeagueTakeover>;
  deleteLeagueTakeover(userId: string, leagueId: string): Promise<void>;

  // League Settings
  getLeagueSettings(userId: string, leagueId: string): Promise<LeagueSettings | undefined>;
  upsertLeagueSettings(userId: string, leagueId: string, settings: { devyEnabled: boolean }): Promise<LeagueSettings>;
}

export class DatabaseStorage implements IStorage {
  async getUserProfile(userId: string): Promise<UserProfile | undefined> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId));
    return profile || undefined;
  }

  async upsertUserProfile(profileData: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(profileData)
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          sleeperUsername: profileData.sleeperUsername,
          sleeperUserId: profileData.sleeperUserId,
          selectedLeagueId: profileData.selectedLeagueId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  }

  async updateSelectedLeague(userId: string, leagueId: string): Promise<void> {
    await db
      .update(userProfiles)
      .set({ selectedLeagueId: leagueId, updatedAt: new Date() })
      .where(eq(userProfiles.userId, userId));
  }

  async createNotification(notification: InsertLeagueNotification): Promise<LeagueNotification> {
    const [created] = await db
      .insert(leagueNotifications)
      .values(notification)
      .returning();
    return created;
  }

  async getNotificationsByLeague(leagueId: string, limit = 50): Promise<LeagueNotification[]> {
    return db
      .select()
      .from(leagueNotifications)
      .where(eq(leagueNotifications.leagueId, leagueId))
      .orderBy(desc(leagueNotifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotifications(userId: string, leagueId: string): Promise<LeagueNotification[]> {
    const readNotificationIds = await db
      .select({ notificationId: userNotificationStatus.notificationId })
      .from(userNotificationStatus)
      .where(eq(userNotificationStatus.userId, userId));
    
    const readIds = readNotificationIds.map(r => r.notificationId);
    
    if (readIds.length === 0) {
      return this.getNotificationsByLeague(leagueId, 50);
    }
    
    return db
      .select()
      .from(leagueNotifications)
      .where(
        and(
          eq(leagueNotifications.leagueId, leagueId),
          notInArray(leagueNotifications.id, readIds)
        )
      )
      .orderBy(desc(leagueNotifications.createdAt))
      .limit(50);
  }

  async markNotificationsRead(userId: string, notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;
    
    const existingReads = await db
      .select({ notificationId: userNotificationStatus.notificationId })
      .from(userNotificationStatus)
      .where(
        and(
          eq(userNotificationStatus.userId, userId),
          inArray(userNotificationStatus.notificationId, notificationIds)
        )
      );
    
    const existingIds = new Set(existingReads.map(r => r.notificationId));
    const newIds = notificationIds.filter(id => !existingIds.has(id));
    
    if (newIds.length > 0) {
      await db.insert(userNotificationStatus).values(
        newIds.map(notificationId => ({
          userId,
          notificationId,
        }))
      );
    }
  }

  async notificationExists(transactionId: string): Promise<boolean> {
    const [existing] = await db
      .select({ id: leagueNotifications.id })
      .from(leagueNotifications)
      .where(eq(leagueNotifications.transactionId, transactionId))
      .limit(1);
    return !!existing;
  }

  async getSyncStatus(leagueId: string): Promise<LeagueSyncStatus | undefined> {
    const [status] = await db
      .select()
      .from(leagueSyncStatus)
      .where(eq(leagueSyncStatus.leagueId, leagueId));
    return status || undefined;
  }

  async updateSyncStatus(leagueId: string, updates: Partial<LeagueSyncStatus>): Promise<void> {
    const existing = await this.getSyncStatus(leagueId);
    if (existing) {
      await db
        .update(leagueSyncStatus)
        .set(updates)
        .where(eq(leagueSyncStatus.leagueId, leagueId));
    } else {
      await db.insert(leagueSyncStatus).values({
        leagueId,
        ...updates,
      });
    }
  }

  async getLeagueTakeover(userId: string, leagueId: string): Promise<UserLeagueTakeover | undefined> {
    const [takeover] = await db
      .select()
      .from(userLeagueTakeover)
      .where(
        and(
          eq(userLeagueTakeover.userId, userId),
          eq(userLeagueTakeover.leagueId, leagueId)
        )
      );
    return takeover || undefined;
  }

  async getAllLeagueTakeovers(userId: string): Promise<UserLeagueTakeover[]> {
    return db
      .select()
      .from(userLeagueTakeover)
      .where(eq(userLeagueTakeover.userId, userId));
  }

  async upsertLeagueTakeover(userId: string, leagueId: string, takeoverSeason: number): Promise<UserLeagueTakeover> {
    const existing = await this.getLeagueTakeover(userId, leagueId);
    
    if (existing) {
      await db
        .update(userLeagueTakeover)
        .set({ takeoverSeason, updatedAt: new Date() })
        .where(eq(userLeagueTakeover.id, existing.id));
      return { ...existing, takeoverSeason };
    } else {
      const [created] = await db
        .insert(userLeagueTakeover)
        .values({ userId, leagueId, takeoverSeason })
        .returning();
      return created;
    }
  }

  async deleteLeagueTakeover(userId: string, leagueId: string): Promise<void> {
    await db
      .delete(userLeagueTakeover)
      .where(
        and(
          eq(userLeagueTakeover.userId, userId),
          eq(userLeagueTakeover.leagueId, leagueId)
        )
      );
  }

  async getLeagueSettings(userId: string, leagueId: string): Promise<LeagueSettings | undefined> {
    const [settings] = await db
      .select()
      .from(leagueSettings)
      .where(and(eq(leagueSettings.userId, userId), eq(leagueSettings.leagueId, leagueId)));
    return settings || undefined;
  }

  async upsertLeagueSettings(userId: string, leagueId: string, settings: { devyEnabled: boolean }): Promise<LeagueSettings> {
    const existing = await this.getLeagueSettings(userId, leagueId);
    if (existing) {
      const [updated] = await db
        .update(leagueSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(and(eq(leagueSettings.userId, userId), eq(leagueSettings.leagueId, leagueId)))
        .returning();
      return updated;
    }
    const [created] = await db
      .insert(leagueSettings)
      .values({ userId, leagueId, ...settings })
      .returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
