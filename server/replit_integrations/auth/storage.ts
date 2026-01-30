import { users, type User, type UpsertUser } from "@shared/models/auth";
import { userProfiles, userNotificationStatus } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { sendNewUserNotification, sendWelcomeEmail } from "../../email-service";

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
          // Check if a profile already exists for the new user ID
          const existingNewProfile = await tx
            .select()
            .from(userProfiles)
            .where(eq(userProfiles.userId, newUserId))
            .then(r => r[0]);
          
          if (existingNewProfile) {
            // New user already has a profile - just delete the old user's profile
            await tx.delete(userProfiles).where(eq(userProfiles.userId, oldUserId));
          } else {
            // Migrate old profile to new user ID
            await tx
              .update(userProfiles)
              .set({ userId: newUserId, updatedAt: new Date() })
              .where(eq(userProfiles.userId, oldUserId));
          }
          
          // For notification status, delete old and keep new (or migrate if no new exists)
          await tx.delete(userNotificationStatus).where(eq(userNotificationStatus.userId, oldUserId));
          
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

    // Check if this is a new user (not an update)
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, userData.id!))
      .then(r => r[0]);
    
    const isNewUser = !existingUser;

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
    
    // Send notifications for new users (async, don't block auth flow)
    if (isNewUser) {
      const userName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'New User';
      
      // Send admin notification
      sendNewUserNotification({
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        createdAt: user.createdAt || new Date()
      }).catch(err => console.error('[Auth] Failed to send admin notification:', err));
      
      // Send welcome email to user if they have an email
      if (user.email) {
        sendWelcomeEmail(user.email, userName)
          .catch(err => console.error('[Auth] Failed to send welcome email:', err));
      }
    }
    
    return user;
  }
}

export const authStorage = new AuthStorage();
