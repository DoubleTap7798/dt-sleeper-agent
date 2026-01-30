// Email service using Resend integration
// Per Resend integration requirements: Never cache the client - always get fresh credentials
import { Resend } from 'resend';

async function getResendClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  
  return {
    client: new Resend(connectionSettings.settings.api_key),
    fromEmail: connectionSettings.settings.from_email
  };
}

// Admin email for notifications - can be configured via environment variable
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
    // Get fresh client per integration requirements
    const { client, fromEmail } = await getResendClient();
    
    const userName = [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown';
    const userEmail = user.email || 'No email provided';
    
    await client.emails.send({
      from: fromEmail || 'DT Sleeper Agent <noreply@resend.dev>',
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
    
    console.log(`[Email] New user notification sent for ${userEmail}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send new user notification:', error);
    return false;
  }
}

export async function sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
  try {
    // Get fresh client per integration requirements
    const { client, fromEmail } = await getResendClient();
    
    await client.emails.send({
      from: fromEmail || 'DT Sleeper Agent <noreply@resend.dev>',
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
    
    console.log(`[Email] Welcome email sent to ${userEmail}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send welcome email:', error);
    return false;
  }
}
