import { generateObject, zodSchema } from 'ai';
import { google as googleAI } from '@ai-sdk/google';
import { z } from 'zod';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

// Supabase client will be initialized dynamically in the request handler
export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

    const { providerToken, email, timezone } = await req.json();

    console.log("Weekly Report Generation Requested", {
      hasProviderToken: !!providerToken,
      email,
      timezone
    });

    let emailsToAnalyze: any[] = [];
    let receivedCount = 0;
    let readCount = 0;
    let unreadCount = 0;
    let repliedCount = 0;
    let isMockData = false;

    // Dates for the last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const dateString = startDate.toISOString().split('T')[0].replace(/-/g, '/');

    if (providerToken) {
      try {
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: providerToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Get received messages in the last 7 days (excluding sent messages)
        const receivedRes = await gmail.users.messages.list({
          userId: 'me',
          q: `after:${dateString} -from:me`,
          maxResults: 50
        });

        // Get sent messages in last 7 days to match thread replies
        const sentRes = await gmail.users.messages.list({
          userId: 'me',
          q: `after:${dateString} from:me`,
          maxResults: 50
        });

        const sentThreadIds = new Set<string>();
        if (sentRes.data.messages) {
          sentRes.data.messages.forEach(msg => {
            if (msg.threadId) sentThreadIds.add(msg.threadId);
          });
        }

        if (receivedRes.data.messages && receivedRes.data.messages.length > 0) {
          receivedCount = receivedRes.data.messages.length;

          for (const message of receivedRes.data.messages) {
            const msg = await gmail.users.messages.get({ userId: 'me', id: message.id! });
            const headers = msg.data.payload?.headers;
            const subject = headers?.find((h) => h.name === 'Subject')?.value || 'No Subject';
            const from = headers?.find((h) => h.name === 'From')?.value || 'Unknown';
            const snippet = msg.data.snippet || '';
            const labelIds = msg.data.labelIds || [];
            const threadId = msg.data.threadId || '';

            const isUnread = labelIds.includes('UNREAD');
            if (isUnread) unreadCount++;
            else readCount++;

            const isReplied = sentThreadIds.has(threadId);
            if (isReplied) repliedCount++;

            emailsToAnalyze.push({
              id: message.id,
              subject,
              from,
              snippet,
              isUnread,
              isReplied
            });
          }
        }
      } catch (gmailErr: any) {
        console.error("Gmail fetch error, falling back to mock data:", gmailErr);
        isMockData = true;
      }
    } else {
      isMockData = true;
    }

    // Populate mock data if Gmail fetch failed or is unconnected
    if (isMockData) {
      receivedCount = 28;
      readCount = 20;
      unreadCount = 8;
      repliedCount = 14;
      emailsToAnalyze = [
        { id: '1', subject: 'Urgent: Feedback needed on Project Apollo Proposal', from: 'john.doe@company.com', snippet: 'Hey Ahmed, I submitted the Apollo proposal yesterday but we need your sign-off before 5 PM to proceed. Let me know if you want changes.', isUnread: true, isReplied: false },
        { id: '2', subject: 'Weekly Sync rescheduled to Friday', from: 'alice.smith@design.org', snippet: 'Hi team, please note that the weekly design review is moved to Friday 10 AM due to schedule conflicts.', isUnread: false, isReplied: true },
        { id: '3', subject: 'Invoice #2045 pending approval', from: 'finance@bills.com', snippet: 'Your invoice for $1,250.00 is ready for review. Please authorize the payment by end of week.', isUnread: true, isReplied: false },
        { id: '4', subject: 'Partnership opportunity with DevCorp', from: 'partners@devcorp.net', snippet: 'Greetings Ahmed, we love your platform and would like to discuss a potential co-marketing partnership next quarter. Are you free for a call?', isUnread: false, isReplied: false },
        { id: '5', subject: 'System Alert: Low disk space on staging server', from: 'noreply@aws.com', snippet: 'Warning: Staging server disk utilization is at 88%. Please clean up logs or expand storage.', isUnread: false, isReplied: false }
      ];
    }

    const promptText = `
      You are the Executive Assistant AI Agent. Analyze the following list of emails from the user's inbox over the past week and synthesize a weekly email report.
      
      Timeframe: Last 7 days (${startDate.toDateString()} to ${endDate.toDateString()}).
      Timezone: ${timezone || 'UTC'}.
      Gmail connection status: ${isMockData ? 'NOT CONNECTED (showing demonstration data)' : 'CONNECTED'}.
      
      Emails:
      ${JSON.stringify(emailsToAnalyze, null, 2)}
      
      Please perform the following:
      1. Review the metrics: Received (${receivedCount}), Read (${readCount}), Unread (${unreadCount}), Replied (${repliedCount}).
      2. Identify the most IMPORTANT emails (up to 3) and explain why they are critical.
      3. Identify emails needing ATTENTION (up to 3) where the user needs to reply or act.
      4. Prepare a set of CLEAR ACTION ITEMS/TASKS (up to 5) for the user.
      5. Draft a premium, clean markdown report text summarizing the week. Use headings, lists, and quotes to make it look professional, business-grade, and sleek. In the report text, if isMockData is true, place a warning banner at the top informing the user that this is sample data since Gmail is not connected.
    `;

    // Define object schema for Vercel AI SDK generateObject
    const reportSchema = z.object({
      receivedCount: z.number(),
      readCount: z.number(),
      unreadCount: z.number(),
      repliedCount: z.number(),
      importantEmails: z.array(z.object({
        subject: z.string(),
        from: z.string(),
        snippet: z.string(),
        reason: z.string()
      })),
      needAttention: z.array(z.object({
        subject: z.string(),
        from: z.string(),
        snippet: z.string(),
        reason: z.string()
      })),
      actions: z.array(z.object({
        action: z.string(),
        description: z.string()
      })),
      reportText: z.string()
    });

    const { object } = await generateObject({
      model: googleAI('gemini-2.5-flash'),
      schema: zodSchema(reportSchema),
      prompt: promptText
    });

    // Try to insert report into Supabase
    let savedReport = null;
    try {
      if (supabase) {
        const { data, error } = await supabase
          .from('weekly_reports')
          .insert([{
            agent_id: 'executive-assistant',
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            received_count: object.receivedCount,
            read_count: object.readCount,
            unread_count: object.unreadCount,
            replied_count: object.repliedCount,
            important_emails: object.importantEmails,
            need_attention: object.needAttention,
            actions: object.actions,
            report_text: object.reportText
          }])
          .select('*');

        if (error) {
          console.error("Supabase insert error:", error.message);
        } else if (data && data.length > 0) {
          savedReport = data[0];
        }
      } else {
         console.warn("Skipping Supabase insert: Credentials not provided.");
      }
    } catch (dbErr: any) {
      console.error("Database connection error:", dbErr.message);
    }

    return Response.json({
      success: true,
      isMockData,
      report: {
        ...object,
        id: savedReport?.id || `local-${Date.now()}`,
        created_at: savedReport?.created_at || new Date().toISOString(),
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString()
      }
    });

  } catch (err: any) {
    console.error("Weekly report error:", err);
    return Response.json({
      success: false,
      error: err.message || 'Failed to generate weekly email summary.'
    }, { status: 500 });
  }
}
