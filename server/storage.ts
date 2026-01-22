import { userProfiles, type UserProfile, type InsertUserProfile } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUserProfile(userId: string): Promise<UserProfile | undefined>;
  upsertUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateSelectedLeague(userId: string, leagueId: string): Promise<void>;
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
}

export const storage = new DatabaseStorage();
