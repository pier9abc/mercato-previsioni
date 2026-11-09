export type Side = 'YES' | 'NO';

export type Role = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  role: Role;
  token_balance: number;
}

export interface Market {
  id: string;
  title: string;
  description: string | null;
  q_yes: number;
  q_no: number;
  b: number;
  resolved: boolean;
  outcome: Side | null;
}
