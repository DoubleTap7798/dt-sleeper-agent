import { users, type User, type UpsertUser } from "@shared/models/auth";
import { userProfiles, userNotificationStatus } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Check for existing user by email first to handle ID changes
    // This can happen in testing scenarios where the OIDC provider returns different subs
    if (userData.email) {
      const existingByEmail = await db
        .select()
        .from(users)
        .where(eq(users.email, userData.email))
        .then(r => r[0]);

      if (existingByEmail && existingByEmail.id !== userData.id) {
        const oldUserId = existingByEmail.id;
        const newUserId = userData.id!;
        
        // Update related tables and migrate user atomically within a transaction
        // This preserves user data and associations while preventing partial state
        return await db.transaction(async (tx) => {
          // Update related tables to use the new user ID
          await tx
            .update(userProfiles)
            .set({ userId: newUserId, updatedAt: new Date() })
            .where(eq(userProfiles.userId, oldUserId));
          
          await tx
            .update(userNotificationStatus)
            .set({ userId: newUserId })
            .where(eq(userNotificationStatus.userId, oldUserId));
          
          // Delete the old user record
          await tx.delete(users).where(eq(users.id, oldUserId));
          
          // Insert the new user record
          const [user] = await tx
            .insert(users)
            .values(userData)
            .onConflictDoUpdate({
              target: users.id,
              set: {
                ...userData,
                updatedAt: new Date(),
              },
            })
            .returning();
          return user;
        });
      }
    }

    // Standard upsert by ID (no email conflict)
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
