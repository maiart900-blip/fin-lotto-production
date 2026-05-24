export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: 'admin' | 'staff';
  created_at: string;
  updated_at: string;
}

export interface DbCustomer {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbEntry {
  id: string;
  number: string;
  bet_type: '3top' | '3tod' | '2top' | '2bot' | '1top' | '1bot';
  amount: number;
  customer_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface DbReceipt {
  id: string;
  receipt_number: string;
  customer_id: string | null;
  total_amount: number;
  entry_ids: string[];
  created_by: string | null;
  created_at: string;
}

export interface DbSettings {
  id: number;
  site_name: string;
  updated_at: string;
}

export interface DbBackup {
  id: string;
  backup_data: {
    entries: DbEntry[];
    customers: DbCustomer[];
    users: DbUser[];
    settings: DbSettings;
  };
  created_by: string | null;
  created_at: string;
}
