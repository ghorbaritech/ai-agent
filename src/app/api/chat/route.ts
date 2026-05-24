import { streamText, tool, stepCountIs, zodSchema, convertToModelMessages } from 'ai';
import { google as googleAI } from '@ai-sdk/google';
import { z } from 'zod';
import { google } from 'googleapis';

export async function POST(req: Request) {
  const { messages, providerToken, email, agentName, agentId, timezone, localTime } = await req.json();

  console.log("Chat Request Received:", { 
    messageCount: messages?.length, 
    agentId,
    agentName,
    hasProviderToken: !!providerToken,
    email,
    hasGeminiKey: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY 
  });

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error("CRITICAL: GOOGLE_GENERATIVE_AI_API_KEY is missing from environment variables.");
  }

  // SDK v6: messages arrive as UIMessage[] with parts arrays.
  // Strip the initial assistant greeting (no tool history in it) to keep the
  // first user message first, which is required by most model APIs.
  const filteredMessages = (messages || []).filter(
    (m: any, i: number) => !(i === 0 && m.role === 'assistant')
  );

  // Initialize Google OAuth client if token is provided
  const oauth2Client = new google.auth.OAuth2();
  if (providerToken) {
    oauth2Client.setCredentials({ access_token: providerToken });
  }

  const result = streamText({
    model: googleAI('gemini-2.5-flash'),
    system: `You are the ${agentName || 'Executive Assistant'} AI Agent. Your role is ${agentId || 'Operations'}. 
    Manage emails, schedule meetings, and help organize the user's day based on your specific expertise.
    The user's email address is: ${email || 'Unknown'}.
    You have access to tools to read emails, send emails, and check calendar availability.
    Always be professional, concise, and helpful. 
    Current date/time for the user: ${localTime || new Date().toISOString()}.
    User's Timezone: ${timezone || 'UTC'}. Use this timezone for all scheduling unless specified otherwise.

    CRITICAL EMAIL DRAFTING WORKFLOW:
    When asked to write or send an email, act as an expert executive communication assistant. DO NOT send the email immediately. You MUST follow this workflow:
    1. Information Gathering: If the request is vague, ask for the recipient, tone (e.g., formal, friendly), and key points.
    2. Drafting: Present a complete, well-structured, professional email draft. Include a strong Subject Line, proper greeting, well-structured body, and a professional sign-off. Expand the user's prompt into a polished business email.
    3. Review: Ask the user to review the draft and explicitly confirm it for sending.
    4. Revisions: Make any requested changes until the user is satisfied.
    5. Sending: ONLY call the \`sendEmail\` tool AFTER the user explicitly approves the final draft.`,
    messages: await convertToModelMessages(filteredMessages),
    stopWhen: stepCountIs(5),
    tools: {
      readEmails: tool({
        description: 'Read the latest unread emails from the user\'s Gmail inbox. Always use this to check for new messages.',
        inputSchema: zodSchema(z.object({
          maxResults: z.number().optional().describe('Maximum number of emails to return')
        })),
        execute: async ({ maxResults = 5 }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Gmail. Ask the user to connect their account.' };
          
          try {
             const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
             const res = await gmail.users.messages.list({ userId: 'me', q: 'is:unread', maxResults });
             
             if (!res.data.messages || res.data.messages.length === 0) {
               return { emails: [] };
             }

             const emails = [];
             for (const message of res.data.messages) {
               const msg = await gmail.users.messages.get({ userId: 'me', id: message.id! });
               const headers = msg.data.payload?.headers;
               const subject = headers?.find((h) => h.name === 'Subject')?.value || 'No Subject';
               const from = headers?.find((h) => h.name === 'From')?.value || 'Unknown';
               const snippet = msg.data.snippet;
               emails.push({ id: message.id, subject, from, snippet });
             }
             return { emails };
          } catch (error: any) {
             console.error("Gmail Error:", error);
             return { error: 'Failed to fetch emails: ' + error.message };
          }
        },
      }),
      sendEmail: tool({
        description: 'Send an email to a recipient.',
        inputSchema: zodSchema(z.object({
          to: z.string().email().describe('Recipient email address'),
          subject: z.string().describe('Email subject'),
          body: z.string().describe('Email body (HTML supported)')
        })),
        execute: async ({ to, subject, body }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Gmail.' };
          
          try {
             const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
             const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
             const messageParts = [
               `To: ${to}`,
               'Content-Type: text/html; charset=utf-8',
               'MIME-Version: 1.0',
               `Subject: ${utf8Subject}`,
               '',
               body,
             ];
             const message = messageParts.join('\n');
             const encodedMessage = Buffer.from(message)
               .toString('base64')
               .replace(/\+/g, '-')
               .replace(/\//g, '_')
               .replace(/=+$/, '');
               
             await gmail.users.messages.send({
               userId: 'me',
               requestBody: { raw: encodedMessage },
             });
             return { success: true, message: `Email sent to ${to}` };
          } catch (error: any) {
             console.error("Gmail Send Error:", error);
             return { error: 'Failed to send email: ' + error.message };
          }
        },
      }),
      checkCalendar: tool({
        description: 'Check upcoming calendar events for the user.',
        inputSchema: zodSchema(z.object({
          timeMin: z.string().optional().describe('ISO string format for the start time'),
          maxResults: z.number().optional().describe('Maximum number of events to return')
        })),
        execute: async ({ timeMin, maxResults = 5 }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Google Calendar.' };
          
          try {
             const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
             const res = await calendar.events.list({
               calendarId: 'primary',
               timeMin: timeMin || new Date().toISOString(),
               maxResults,
               singleEvents: true,
               orderBy: 'startTime',
             });
             
             const events = res.data.items?.map(event => ({
               id: event.id,
               summary: event.summary,
               start: event.start?.dateTime || event.start?.date,
               end: event.end?.dateTime || event.end?.date,
             })) || [];
             
             return { events };
          } catch (error: any) {
             console.error("Calendar Error:", error);
             return { error: 'Failed to fetch calendar: ' + error.message };
          }
        },
      }),
      createMeeting: tool({
        description: 'Create a new meeting/event in Google Calendar.',
        inputSchema: zodSchema(z.object({
          summary: z.string().describe('Title of the meeting'),
          description: z.string().optional().describe('Optional description'),
          startTime: z.string().describe('ISO string format for start time'),
          endTime: z.string().describe('ISO string format for end time'),
          attendeeEmails: z.array(z.string().email()).optional().describe('List of attendee emails')
        })),
        execute: async ({ summary, description, startTime, endTime, attendeeEmails }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Google Calendar.' };
          
          try {
             const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
             const event = {
               summary,
               description,
               start: { dateTime: startTime, timeZone: timezone || 'UTC' }, 
               end: { dateTime: endTime, timeZone: timezone || 'UTC' },
               attendees: attendeeEmails?.map((email: string) => ({ email })),
             };
             
             const res = await calendar.events.insert({
               calendarId: 'primary',
               requestBody: event,
               sendUpdates: 'all',
             });
             
             return { success: true, eventLink: res.data.htmlLink, eventId: res.data.id };
          } catch (error: any) {
             console.error("Calendar Insert Error:", error);
             if (error.message && (error.message.includes('invalid authentication') || error.message.includes('OAuth'))) {
                return { error: 'Your Google integration token has expired. Please sign out and sign back in to refresh your access.' };
             }
             return { error: 'Failed to create meeting: ' + error.message };
          }
        },
      }),
      createAgentTask: tool({
        description: 'Record a new mission or task in the dashboard when the user asks you to perform an action. Call this to formally log the task before executing it.',
        inputSchema: zodSchema(z.object({
          title: z.string().describe('Title of the mission/task'),
          priority: z.enum(['Low', 'Medium', 'High', 'Critical']).describe('Priority of the task')
        })),
        execute: async ({ title, priority }): Promise<any> => {
          return { success: true, title, priority };
        }
      }),
      createLedger: tool({
        description: 'Creates a new Google Sheet to act as the Financial Ledger. Use this if the user does not have a spreadsheet yet.',
        inputSchema: zodSchema(z.object({})),
        execute: async (): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Google. Ask user to connect.' };
          try {
            const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
            const res = await sheets.spreadsheets.create({
              requestBody: {
                properties: { title: 'AgentCore Financial Ledger' },
                sheets: [
                  { properties: { title: 'Transactions' } }
                ]
              }
            });
            const spreadsheetId = res.data.spreadsheetId as string;
            
            // Add header row
            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: 'Transactions!A1:E1',
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [['Date', 'Type', 'Category', 'Description', 'Amount']]
              }
            });
            
            return { 
              success: true, 
              spreadsheetId, 
              url: res.data.spreadsheetUrl,
              message: 'Tell the user to save this Spreadsheet ID in their configurations.'
            };
          } catch (error: any) {
            console.error("Sheets Create Error:", error);
            return { error: 'Failed to create ledger: ' + error.message };
          }
        }
      }),
      addTransaction: tool({
        description: 'Log a new transaction (Income or Expense) into the Financial Ledger.',
        inputSchema: zodSchema(z.object({
          spreadsheetId: z.string().describe('The ID of the Google Sheet'),
          date: z.string().describe('Date of transaction (YYYY-MM-DD)'),
          type: z.enum(['Income', 'Expense']).describe('Type of transaction'),
          category: z.string().describe('Category (e.g., Marketing, Software, Sales)'),
          description: z.string().describe('Short description of the transaction'),
          amount: z.number().describe('Amount as a positive number')
        })),
        execute: async ({ spreadsheetId, date, type, category, description, amount }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Google.' };
          try {
            const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
            await sheets.spreadsheets.values.append({
              spreadsheetId,
              range: 'Transactions!A:E',
              valueInputOption: 'USER_ENTERED',
              insertDataOption: 'INSERT_ROWS',
              requestBody: {
                values: [[date, type, category, description, amount]]
              }
            });
            return { success: true, message: `Added ${type} of $${amount} to Ledger.` };
          } catch (error: any) {
            return { error: 'Failed to add transaction: ' + error.message };
          }
        }
      }),
      queryFinancials: tool({
        description: 'Read the financial ledger to aggregate totals or find specific transactions.',
        inputSchema: zodSchema(z.object({
          spreadsheetId: z.string().describe('The ID of the Google Sheet')
        })),
        execute: async ({ spreadsheetId }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Google.' };
          try {
            const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
            const res = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: 'Transactions!A:E',
            });
            const rows = res.data.values;
            if (!rows || rows.length <= 1) return { transactions: [], summary: "No data found." };
            
            // Basic mapping
            const headers = rows[0];
            const data = rows.slice(1).map(row => {
              return {
                date: row[0] || '',
                type: row[1] || '',
                category: row[2] || '',
                description: row[3] || '',
                amount: parseFloat(row[4] || '0')
              };
            });
            
            // Simple aggregation
            let totalIncome = 0;
            let totalExpense = 0;
            data.forEach(t => {
              if (t.type === 'Income') totalIncome += t.amount;
              if (t.type === 'Expense') totalExpense += t.amount;
            });
            
            return { 
              totalIncome, 
              totalExpense, 
              netCash: totalIncome - totalExpense,
              transactions: data 
            };
          } catch (error: any) {
            return { error: 'Failed to query financials: ' + error.message };
          }
        }
      }),
      checkBalanceAndAlerts: tool({
        description: 'Analyze the ledger to calculate the current balance, detect anomalies (like sudden large expenses), and generate a cash flow forecast.',
        inputSchema: zodSchema(z.object({
          spreadsheetId: z.string().describe('The ID of the Google Sheet')
        })),
        execute: async ({ spreadsheetId }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Google.' };
          try {
            const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
            const res = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: 'Transactions!A:E',
            });
            const rows = res.data.values;
            if (!rows || rows.length <= 1) return { balance: 0, alerts: ["No transaction history found."] };
            
            const data = rows.slice(1).map(row => ({
              date: row[0] || '',
              type: row[1] || '',
              category: row[2] || '',
              description: row[3] || '',
              amount: parseFloat(row[4] || '0')
            }));
            
            let balance = 0;
            let expenses: any[] = [];
            data.forEach(t => {
              if (t.type === 'Income') balance += t.amount;
              if (t.type === 'Expense') {
                 balance -= t.amount;
                 expenses.push(t);
              }
            });
            
            // Anomaly Detection: An expense larger than 3x the average
            const avgExpense = expenses.length ? expenses.reduce((a, b) => a + b.amount, 0) / expenses.length : 0;
            const anomalies = expenses.filter(e => e.amount > avgExpense * 3);
            const alerts = anomalies.map(a => `Anomaly detected: Large expense of $${a.amount} on ${a.date} for ${a.description}.`);
            
            if (balance < 1000) {
               alerts.push(`Low balance warning: Current balance is $${balance}. Please review upcoming liabilities.`);
            }
            if (alerts.length === 0) {
               alerts.push("No anomalies detected. Cash flow looks stable.");
            }
            
            return { 
              currentBalance: balance, 
              averageExpense: avgExpense.toFixed(2),
              alerts,
              forecast: `Based on average spending, expect a monthly burn rate of ~$${(avgExpense * 30).toFixed(2)}.`
            };
          } catch (error: any) {
            return { error: 'Failed to check balance: ' + error.message };
          }
        }
      })
    }
  });

  return result.toUIMessageStreamResponse();
}

