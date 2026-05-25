import { google } from 'googleapis';
import { IConnector, Transaction, FinancialSummary } from './IConnector';

export class GoogleSheetsConnector implements IConnector {
  async addTransaction(transaction: Transaction, config: { spreadsheetId: string, oauth2Client: any }): Promise<{ success: boolean; message: string }> {
    const { spreadsheetId, oauth2Client } = config;
    if (!oauth2Client) throw new Error('Not connected to Google.');
    
    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Transactions!A:F',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          transaction.date, 
          transaction.type, 
          transaction.category, 
          transaction.description, 
          transaction.amount,
          transaction.referenceUrl || ''
        ]]
      }
    });
    return { success: true, message: `Added ${transaction.type} of $${transaction.amount} to Ledger.` };
  }

  async addTransactionsBulk(transactions: Transaction[], config: { spreadsheetId: string, oauth2Client: any }): Promise<{ success: boolean; message: string }> {
    const { spreadsheetId, oauth2Client } = config;
    if (!oauth2Client) throw new Error('Not connected to Google.');
    
    if (transactions.length === 0) return { success: true, message: 'No transactions to insert.' };

    const values = transactions.map(transaction => [
      transaction.date, 
      transaction.type, 
      transaction.category, 
      transaction.description, 
      transaction.amount,
      transaction.referenceUrl || ''
    ]);

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Transactions!A:F',
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values
      }
    });
    return { success: true, message: `Successfully imported ${transactions.length} transactions.` };
  }

  async getFinancialSummary(config: { spreadsheetId: string, oauth2Client: any }): Promise<FinancialSummary> {
    const { spreadsheetId, oauth2Client } = config;
    if (!oauth2Client) throw new Error('Not connected to Google.');

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Transactions!A:F',
    });
    
    const rows = res.data.values;
    if (!rows || rows.length <= 1) return { totalIncome: 0, totalExpense: 0, netCash: 0, transactions: [] };
    
    const data: Transaction[] = rows.slice(1).map((row: any) => ({
      date: row[0] || '',
      type: row[1] || '',
      category: row[2] || '',
      description: row[3] || '',
      amount: parseFloat(row[4] || '0'),
      referenceUrl: row[5] || ''
    }));
    
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
  }

  async getAlerts(config: { spreadsheetId: string, oauth2Client: any }): Promise<any> {
    const summary = await this.getFinancialSummary(config);
    let expenses: Transaction[] = [];
    let balance = summary.netCash;

    summary.transactions.forEach(t => {
      if (t.type === 'Expense') {
         expenses.push(t);
      }
    });
    
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
  }
}
