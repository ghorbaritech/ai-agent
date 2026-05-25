import { streamText, tool, stepCountIs, zodSchema, convertToModelMessages } from 'ai';
import { google as googleAI } from '@ai-sdk/google';
import { z } from 'zod';
import { google } from 'googleapis';
import { Readable } from 'stream';
import Papa from 'papaparse';
import { ConnectorFactory } from '../../../lib/financials/ConnectorFactory';
import { Transaction } from '../../../lib/financials/IConnector';

export async function POST(req: Request) {
  const { messages, providerToken, email, agentName, agentId, timezone, localTime, spreadsheetId: reqSpreadsheetId } = await req.json();

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
  // Normalize messages to ensure they all contain 'parts' (essential for SDK v6 compat)
  const filteredMessages = (messages || []).filter(
    (m: any, i: number) => !(i === 0 && m.role === 'assistant')
  ).map((m: any) => {
    if (m.parts) return m;
    const parts = [];
    if (typeof m.content === 'string' && m.content) {
      parts.push({ type: 'text', text: m.content });
    } else if (Array.isArray(m.content)) {
      parts.push(...m.content.map((c: any) => {
        if (typeof c === 'string') return { type: 'text', text: c };
        return c;
      }));
    }
    return {
      ...m,
      parts: parts.length > 0 ? parts : [{ type: 'text', text: '' }]
    };
  });

  // Extract latest uploaded image
  let latestFileBase64: string | null = null;
  let latestMimeType: string = 'image/jpeg';
  for (let i = filteredMessages.length - 1; i >= 0; i--) {
     const msg = filteredMessages[i];
     if (msg.role === 'user') {
       const imagePart = msg.parts?.find((p: any) => p.type === 'image' || p.type === 'file');
       if (imagePart && (imagePart.image || imagePart.data)) {
          let rawData = imagePart.image || imagePart.data;
          if (typeof rawData === 'string') {
            if (rawData.startsWith('data:')) {
              const match = rawData.match(/^data:(.*?);base64,(.*)$/);
              if (match) {
                latestMimeType = match[1];
                latestFileBase64 = match[2];
              } else {
                latestFileBase64 = rawData;
              }
            } else {
              latestFileBase64 = rawData;
            }
          }
          break;
       }
     }
  }

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
      uploadReceiptToDrive: tool({
        description: 'Uploads a provided receipt or document to Google Drive and returns a reference link. Call this when the user shares a receipt.',
        inputSchema: zodSchema(z.object({
          filename: z.string().describe('The name of the file being uploaded (e.g. receipt_2024.jpg)')
        })),
        execute: async ({ filename }): Promise<any> => {
          if (!providerToken) return { error: 'Not connected to Google.' };
          if (!latestFileBase64) return { error: 'No image or file found in the recent chat messages.' };

          try {
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            
            // Find or create "AgentCore Receipts" folder
            const folderName = 'AgentCore Receipts';
            let folderId = '';
            
            const folderRes = await drive.files.list({
              q: `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`,
              fields: 'files(id, name)',
              spaces: 'drive'
            });
            
            if (folderRes.data.files && folderRes.data.files.length > 0) {
              folderId = folderRes.data.files[0].id!;
            } else {
              const createRes = await drive.files.create({
                requestBody: {
                  name: folderName,
                  mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
              });
              folderId = createRes.data.id!;
            }

            // Upload the file
            const fileMetadata = {
              name: filename,
              parents: [folderId]
            };
            
            const media = {
              mimeType: latestMimeType,
              body: Readable.from(Buffer.from(latestFileBase64, 'base64'))
            };
            
            const uploadRes = await drive.files.create({
              requestBody: fileMetadata,
              media: media,
              fields: 'id, webViewLink'
            });
            
            // Make file publicly readable for easy access via link
            if (uploadRes.data.id) {
              await drive.permissions.create({
                fileId: uploadRes.data.id,
                requestBody: { role: 'reader', type: 'anyone' }
              });
            }

            return { 
              success: true, 
              url: uploadRes.data.webViewLink, 
              message: `Receipt ${filename} successfully uploaded to Google Drive.` 
            };
          } catch (error: any) {
            console.error("Drive Upload Error:", error);
            return { error: 'Failed to upload receipt: ' + error.message };
          }
        }
      }),
      recordTransaction: tool({
        description: 'Log a new transaction (Income or Expense) into the active Financial Ledger (Sheets or ERP).',
        inputSchema: zodSchema(z.object({
          connectorType: z.enum(['sheets', 'qbo']).describe('The active integration type'),
          date: z.string().describe('Date of transaction (YYYY-MM-DD)'),
          type: z.enum(['Income', 'Expense']).describe('Type of transaction'),
          category: z.string().describe('Category (e.g., Marketing, Software, Sales)'),
          description: z.string().describe('Short description of the transaction'),
          amount: z.number().describe('Amount as a positive number'),
          referenceUrl: z.string().optional().describe('Link to the receipt in Google Drive')
        })),
        execute: async ({ connectorType, date, type, category, description, amount, referenceUrl }): Promise<any> => {
          try {
            const connector = ConnectorFactory.getConnector(connectorType);
            const transaction: Transaction = { date, type, category, description, amount, referenceUrl };
            const config = { spreadsheetId: reqSpreadsheetId, oauth2Client };
            const result = await connector.addTransaction(transaction, config);
            return result;
          } catch (error: any) {
            return { error: 'Failed to add transaction: ' + error.message };
          }
        }
      }),
      generateFinancialReport: tool({
        description: 'Read the financial ledger to aggregate totals or generate a PnL/Cashflow statement.',
        inputSchema: zodSchema(z.object({
          connectorType: z.enum(['sheets', 'qbo']).describe('The active integration type')
        })),
        execute: async ({ connectorType }): Promise<any> => {
          try {
            const connector = ConnectorFactory.getConnector(connectorType);
            const summary = await connector.getFinancialSummary({ spreadsheetId: reqSpreadsheetId, oauth2Client });
            return summary;
          } catch (error: any) {
            return { error: 'Failed to generate financial report: ' + error.message };
          }
        }
      }),
      queryFinancials: tool({
        description: 'Analyze the ledger to calculate the current balance, detect anomalies (like sudden large expenses), and generate alerts.',
        inputSchema: zodSchema(z.object({
          connectorType: z.enum(['sheets', 'qbo']).describe('The active integration type')
        })),
        execute: async ({ connectorType }): Promise<any> => {
          try {
            const connector = ConnectorFactory.getConnector(connectorType);
            const alerts = await connector.getAlerts({ spreadsheetId: reqSpreadsheetId, oauth2Client });
            return alerts;
          } catch (error: any) {
            return { error: 'Failed to check balance: ' + error.message };
          }
        }
      }),
      process_bulk_journal: tool({
        description: 'Process a bulk journal export (CSV format) uploaded by the user and import the transactions into the ledger.',
        inputSchema: zodSchema(z.object({
          connectorType: z.enum(['sheets', 'qbo']).describe('The active integration type'),
          filename: z.string().describe('The name of the CSV file being uploaded')
        })),
        execute: async ({ connectorType, filename }): Promise<any> => {
          if (!latestFileBase64) return { error: 'No file found in the recent chat messages.' };
          
          try {
            // Convert base64 to string for parsing
            const csvText = Buffer.from(latestFileBase64, 'base64').toString('utf-8');
            
            // Parse CSV using PapaParse
            const parseResult = Papa.parse(csvText, { header: true, skipEmptyLines: true });
            if (parseResult.errors.length > 0 && !parseResult.data.length) {
               return { error: 'Failed to parse CSV.', details: parseResult.errors };
            }
            
            // Map rows to our Transaction format
            // Assumes standard CSV columns like Date, Description, Amount or Debit/Credit
            const mappedTransactions: Transaction[] = parseResult.data.map((row: any) => {
              // Try to find common date columns
              const rawDate = row['Date'] || row['date'] || row['Transaction Date'] || new Date().toISOString().split('T')[0];
              
              // Handle Amount / Debit / Credit columns
              let amount = 0;
              let type: 'Income' | 'Expense' = 'Expense';
              
              if (row['Amount']) {
                amount = parseFloat(row['Amount']);
                if (amount > 0) type = 'Income';
                if (amount < 0) { type = 'Expense'; amount = Math.abs(amount); }
              } else if (row['Credit'] && parseFloat(row['Credit']) > 0) {
                amount = parseFloat(row['Credit']);
                type = 'Income';
              } else if (row['Debit'] && parseFloat(row['Debit']) > 0) {
                amount = parseFloat(row['Debit']);
                type = 'Expense';
              }
              
              // Find description
              const description = row['Description'] || row['Memo'] || row['Payee'] || 'Bulk Imported Transaction';
              
              return {
                date: rawDate,
                type: type,
                category: row['Category'] || 'Uncategorized',
                description: description,
                amount: isNaN(amount) ? 0 : amount
              };
            }).filter(t => t.amount > 0);
            
            if (mappedTransactions.length === 0) {
               return { error: 'No valid transactions found in the file to import.' };
            }
            
            // Call the bulk insert method on the connector
            const connector = ConnectorFactory.getConnector(connectorType);
            const config = { spreadsheetId: reqSpreadsheetId, oauth2Client };
            const result = await connector.addTransactionsBulk(mappedTransactions, config);
            
            return {
              success: true,
              message: `Processed ${filename}. ${result.message}`,
              importedCount: mappedTransactions.length
            };
          } catch (error: any) {
            console.error("Bulk Import Error:", error);
            return { error: 'Failed to process bulk journal: ' + error.message };
          }
        }
      })
    }
  });

  return result.toUIMessageStreamResponse();
}

