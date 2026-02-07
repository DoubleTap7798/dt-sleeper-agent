import { users, type User } from "@shared/models/auth";
import { userProfiles } from "@shared/schema";
import { db } from "../../db";
import { eq } from "drizzle-orm";
import { sendNewUserNotification, sendWelcomeEmail } from "../../email-service";

export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(userData: { email: string; passwordHash: string; firstName: string; lastName: string | null }): Promise<User>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase()));
    return user;
  }

  async updateUserPassword(id: string, passwordHash: string, firstName: string, lastName: string | null): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        passwordHash,
        firstName,
        lastName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createUser(userData: { email: string; passwordHash: string; firstName: string; lastName: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email.toLowerCase(),
        passwordHash: userData.passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
      })
      .returning();

    const userName = [userData.firstName, userData.lastName].filter(Boolean).join(' ') || 'New User';

    sendNewUserNotification({
      userId: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt || new Date()
    }).catch(err => console.error('[Auth] Failed to send admin notification:', err));

    if (user.email) {
      sendWelcomeEmail(user.email, userName)
        .catch(err => console.error('[Auth] Failed to send welcome email:', err));
    }

    return user;
  }
}

export const authStorage = new AuthStorage();
