import { IConnector, Transaction, FinancialSummary } from './IConnector';

export class QuickBooksConnector implements IConnector {
  async addTransaction(transaction: Transaction, config: any): Promise<{ success: boolean; message: string }> {
    // Mock implementation for QBO
    console.log("Mock QBO addTransaction", transaction);
    return { success: true, message: `Added ${transaction.type} to QuickBooks mock.` };
  }

  async addTransactionsBulk(transactions: Transaction[], config: any): Promise<{ success: boolean; message: string }> {
    console.log("Mock QBO addTransactionsBulk", transactions.length);
    return { success: true, message: `Successfully imported ${transactions.length} transactions to QBO mock.` };
  }

  async getFinancialSummary(config: any): Promise<FinancialSummary> {
    // Mock implementation for QBO
    return {
      totalIncome: 5000,
      totalExpense: 2000,
      netCash: 3000,
      transactions: []
    };
  }

  async getAlerts(config: any): Promise<any> {
    return {
      currentBalance: 3000,
      averageExpense: "500.00",
      alerts: ["No anomalies detected in QBO mock."],
      forecast: "Stable."
    };
  }
}
