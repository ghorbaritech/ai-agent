import { IConnector } from './IConnector';
import { GoogleSheetsConnector } from './GoogleSheetsConnector';
import { QuickBooksConnector } from './QuickBooksConnector';

export class ConnectorFactory {
  static getConnector(type: 'sheets' | 'qbo'): IConnector {
    if (type === 'sheets') {
      return new GoogleSheetsConnector();
    } else if (type === 'qbo') {
      return new QuickBooksConnector();
    }
    throw new Error('Unknown connector type');
  }
}
