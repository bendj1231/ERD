export type FieldType = 'INT' | 'VARCHAR' | 'TEXT' | 'BOOLEAN' | 'DATE' | 'TIMESTAMP' | 'DECIMAL' | 'UUID';

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  description?: string;
}

export interface Table {
  id: string;
  name: string;
  x: number;
  y: number;
  fields: Field[];
  description?: string;
  imageUrl?: string; // Optional image URL for preview
  width?: number; // Optional for dynamic sizing
  isComplete?: boolean; // New: status check
}

export type Cardinality = '1:1' | '1:N' | 'N:M';

export interface Relationship {
  id: string;
  sourceTableId: string;
  sourceFieldId?: string; // New: Optional specific source field
  targetTableId: string;
  targetFieldId?: string; // New: Optional specific target field
  cardinality: Cardinality;
  label?: string;
  color?: string; // Color for visual identification
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}