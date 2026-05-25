export interface Transaction {
  id?: string;
  date: string;
  type: 'Income' | 'Expense';
  category: string;
  description: string;
  amount: number;
  referenceUrl?: string; // e.g. receipt Google Drive link
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  netCash: number;
  transactions: Transaction[];
}

export interface IConnector {
  addTransaction(transaction: Transaction, config: any): Promise<{ success: boolean; message: string }>;
  addTransactionsBulk(transactions: Transaction[], config: any): Promise<{ success: boolean; message: string }>;
  getFinancialSummary(config: any): Promise<FinancialSummary>;
  getAlerts(config: any): Promise<any>;
}
