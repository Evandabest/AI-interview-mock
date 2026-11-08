export interface User {
  id: string;
  email: string;
  user_metadata: { username: string };
}
export type Row = Record<string, any>;
export interface Query {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  columns: string;
  values?: Row | Row[];
  filters: { column: string; op: string; value: unknown }[];
  or?: string;
  order?: { column: string; ascending: boolean };
  limit?: number;
  single?: boolean;
  optional?: boolean;
  count?: boolean;
}
export interface Result { data: any; error: { message: string } | null; count?: number }
