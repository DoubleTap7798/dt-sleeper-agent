// Email service using Resend
// Uses RESEND_API_KEY secret directly for reliable authentication
import { Resend } from 'resend';

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }
  return {
    client: new Resend(apiKey),
    fromEmail: 'DT Sleeper Agent <onboarding@resend.dev>'
  };
}

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'admin@example.com';

export interface NewUserNotification {
  userId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
}

export async function sendNewUserNotification(user: NewUserNotification): Promise<boolean> {
  try {
    const { client, fromEmail } = getResendClient();
    
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
    const userEmail = user.email || 'No email provided';
    
    const result = await client.emails.send({
      from: fromEmail,
      to: ADMIN_EMAIL,
      subject: `New User Signup: ${userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">New User Registration</h2>
          <p>A new user has signed up for DT Sleeper Agent:</p>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Name</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${userName}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Email</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${userEmail}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">User ID</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${user.userId}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">Signed Up</td>
              <td style="padding: 10px; border: 1px solid #ddd;">${user.createdAt.toLocaleString()}</td>
            </tr>
          </table>
          <p style="color: #666; font-size: 12px;">This is an automated notification from DT Sleeper Agent.</p>
        </div>
      `
    });
    
    if (result.error) {
      console.error('[Email] Resend API error for admin notification:', result.error);
      return false;
    }
    
    console.log(`[Email] New user notification sent for ${userEmail} (id: ${result.data?.id})`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send new user notification:', error);
    return false;
  }
}

export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
  try {
    const { client, fromEmail } = getResendClient();
    
    const result = await client.emails.send({
      from: fromEmail,
      to: userEmail,
      subject: 'Welcome to DT Sleeper Agent!',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Welcome to DT Sleeper Agent!</h1>
          <p>Hi ${userName || 'there'},</p>
          <p>Thank you for signing up for DT Sleeper Agent - your fantasy football companion for Sleeper leagues.</p>
          <p>With DT Sleeper Agent, you can:</p>
          <ul>
            <li>Track your dynasty league roster values</li>
            <li>Analyze trades with our custom dynasty value calculator</li>
            <li>View detailed player statistics and trends</li>
            <li>Get AI-powered lineup advice</li>
            <li>Follow devy prospects for your dynasty leagues</li>
          </ul>
          <p>Connect your Sleeper username to get started!</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            If you have any questions, please reply to this email.
          </p>
        </div>
      `
    });
    
    if (result.error) {
      console.error('[Email] Resend API error for welcome email:', result.error);
      return false;
    }
    
    console.log(`[Email] Welcome email sent to ${userEmail} (id: ${result.data?.id})`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send welcome email:', error);
    return false;
  }
}
