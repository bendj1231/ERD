import React, { useState, useRef, useEffect } from 'react';
import { Table, Field, FieldType } from '../types';
import { Trash2, Key, GripVertical, Plus, ChevronDown, ChevronRight, Circle, Link as LinkIcon, Image as ImageIcon, X, Unlink } from 'lucide-react';

interface TableNodeProps {
  table: Table;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, tableId: string) => void;
  onUpdate: (tableId: string, updates: Partial<Table>) => void;
  onDelete: (tableId: string) => void;
  onConnect: (tableId: string, fieldId?: string) => void;
  onDisconnect: (tableId: string, fieldId: string) => void;
  scale: number;
  isConnecting: boolean;
  fieldColors: Record<string, string>; // Map of field ID to color
  highlightedColor: string | null;
  onFieldContextMenu: (e: React.MouseEvent, tableId: string, fieldId: string, color: string) => void;
}

const FIELD_TYPES: FieldType[] = ['UUID', 'INT', 'VARCHAR', 'TEXT', 'BOOLEAN', 'DATE', 'TIMESTAMP', 'DECIMAL'];

const TYPE_LABELS: Record<FieldType, string> = {
  UUID: 'Unique ID',
  INT: 'Number',
  VARCHAR: 'Short Text',
  TEXT: 'Long Text',
  BOOLEAN: 'Yes/No',
  DATE: 'Date',
  TIMESTAMP: 'Date & Time',
  DECIMAL: 'Decimal/Money'
};

const ConnectionHandle = ({ 
  side, 
  isConnected, 
  isConnecting, 
  color, 
  onClick, 
  onContextMenu 
}: {
  side: 'left' | 'right';
  isConnected: boolean;
  isConnecting: boolean;
  color?: string;
  onClick: (e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) => (
  <button
    onClick={onClick}
    onContextMenu={onContextMenu}
    className={`
      flex items-center justify-center w-4 h-6 cursor-crosshair
      transition-all hover:scale-110 active:scale-95
      ${side === 'left' ? '-ml-2 mr-1' : '-mr-2 ml-1'}
      z-20
    `}
    title={isConnected ? "Click to add another link, Right-click for options" : "Connect"}
  >
    <div 
      className={`
        flex items-center justify-center rounded-full border shadow-sm transition-all
        ${isConnecting ? 'w-4 h-4' : 'w-2.5 h-2.5'}
      `}
      style={{
         // Prioritize showing 'connecting' state (violet) if isConnecting is true, 
         // otherwise show connected color or default gray
         borderColor: isConnecting ? '#8b5cf6' : (isConnected ? color : '#cbd5e1'),
         
         // If connecting, keep background white to show the Plus icon clearly.
         // If not connecting but connected, show solid color.
         backgroundColor: isConnecting ? '#ffffff' : (isConnected ? color : '#f8fafc'),
         
         // Thicker border for connected nodes when idle, thinner for connecting target/source
         borderWidth: isConnected && !isConnecting ? '4px' : (isConnecting ? '2px' : '1px')
      }}
    >
       {isConnecting && (
         <Plus size={10} className="text-violet-500" strokeWidth={3} />
       )}
    </div>
  </button>
);

export const TableNode: React.FC<TableNodeProps> = ({ 
  table, 
  isSelected, 
  onMouseDown, 
  onUpdate,
  onDelete,
  onConnect,
  onDisconnect,
  scale,
  isConnecting,
  fieldColors,
  highlightedColor,
  onFieldContextMenu
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [expandedFieldId, setExpandedFieldId] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditingName]);

  // Auto-resize description textarea
  useEffect(() => {
    if (descriptionRef.current) {
      descriptionRef.current.style.height = 'auto';
      descriptionRef.current.style.height = descriptionRef.current.scrollHeight + 'px';
    }
  }, [table.description]);

  const handleAddField = () => {
    const newField: Field = {
      id: crypto.randomUUID(),
      name: `field_${table.fields.length + 1}`,
      type: 'VARCHAR',
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: true,
      description: ''
    };
    onUpdate(table.id, { fields: [...table.fields, newField] });
  };

  const handleUpdateField = (fieldId: string, updates: Partial<Field>) => {
    const newFields = table.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f);
    onUpdate(table.id, { fields: newFields });
  };

  const handleRemoveField = (fieldId: string) => {
    onUpdate(table.id, { fields: table.fields.filter(f => f.id !== fieldId) });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdate(table.id, { imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again if needed
    if (e.target) {
        e.target.value = '';
    }
  };

  // Check if this table has any fields involved in the highlighted flow
  const hasHighlightedField = highlightedColor 
    ? table.fields.some(f => fieldColors[f.id] === highlightedColor)
    : true;
    
  // If highlightedColor is active, and this table doesn't have it, dim it significantly
  const isTableDimmed = highlightedColor && !hasHighlightedField;

  return (
    <div
      className={`absolute flex flex-col bg-white rounded-lg shadow-lg border-2 transition-all duration-300 select-none ${
        isSelected ? 'border-blue-500 shadow-blue-200 ring-2 ring-blue-100' : 'border-slate-200 hover:border-slate-300'
      }`}
      style={{
        left: table.x,
        top: table.y,
        width: 280,
        zIndex: isSelected ? 50 : 10,
        opacity: isTableDimmed ? 0.2 : 1,
        filter: isTableDimmed ? 'blur(1px) grayscale(50%)' : 'none'
      }}
      onMouseDown={(e) => onMouseDown(e, table.id)}
    >
      {/* Header (Height ~40px) */}
      <div className="flex items-center justify-between p-2 bg-slate-50 border-b border-slate-100 rounded-t-lg cursor-grab active:cursor-grabbing h-[40px] box-border">
        <div className="flex items-center gap-2 flex-1 overflow-hidden">
          <GripVertical size={14} className="text-slate-400" />
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              className="w-full text-sm font-bold bg-white border border-blue-300 rounded px-1 outline-none"
              value={table.name}
              onChange={(e) => onUpdate(table.id, { name: e.target.value })}
              onBlur={() => setIsEditingName(false)}
              onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            />
          ) : (
            <span 
              className="text-sm font-bold text-slate-700 truncate cursor-pointer hover:text-blue-600"
              onDoubleClick={() => setIsEditingName(true)}
            >
              {table.name}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Image Upload */}
          <button 
             onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
             className="p-1 rounded transition-colors text-slate-400 hover:bg-blue-100 hover:text-blue-600"
             title="Add Image Preview"
          >
              <ImageIcon size={14} />
          </button>
          <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleImageUpload} 
              onClick={(e) => e.stopPropagation()}
          />
          
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}
            className="p-1 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Table Description */}
      <div className="px-2 pt-2 bg-white">
        <textarea
          ref={descriptionRef}
          className="w-full text-xs text-slate-500 bg-slate-50 border border-transparent hover:border-slate-200 focus:border-blue-300 rounded px-1.5 py-1 outline-none resize-none overflow-hidden placeholder:text-slate-300"
          placeholder="Add description..."
          rows={1}
          value={table.description || ''}
          onChange={(e) => onUpdate(table.id, { description: e.target.value })}
        />
      </div>

      {/* Image Preview */}
      {table.imageUrl && (
        <div className="relative w-full h-32 bg-slate-100 group/image border-b border-slate-100">
            <img src={table.imageUrl} alt="Table Preview" className="w-full h-full object-cover" />
            <button 
                onClick={(e) => { e.stopPropagation(); onUpdate(table.id, { imageUrl: undefined }); }}
                className="absolute top-1 right-1 p-1 bg-black/50 hover:bg-red-500 text-white rounded opacity-0 group-hover/image:opacity-100 transition-opacity"
                title="Remove Image"
            >
                <X size={12} />
            </button>
        </div>
      )}

      {/* Fields (Container padding top 8px) */}
      <div className="p-2 space-y-1 bg-white pt-2">
        {table.fields.map((field) => {
          const fieldColor = fieldColors[field.id];
          // Logic for dimming specific fields if the table itself isn't dimmed
          
          let fieldOpacity = 1;
          if (highlightedColor) {
             if (fieldColor === highlightedColor) fieldOpacity = 1;
             else if (fieldColor) fieldOpacity = 0.2; 
             else fieldOpacity = 0.5;
          }

          const handleProps = {
            isConnected: !!fieldColor,
            isConnecting,
            color: fieldColor,
            onClick: (e: React.MouseEvent) => {
              e.stopPropagation();
              // Always allow clicking to connect, even if already connected (enables multiple links)
              onConnect(table.id, field.id);
            },
            onContextMenu: (e: React.MouseEvent) => {
              if (fieldColor) {
                e.preventDefault();
                e.stopPropagation();
                onFieldContextMenu(e, table.id, field.id, fieldColor);
              }
            }
          };

          return (
            <div 
              key={field.id} 
              className="flex flex-col relative group/field" 
              style={{ opacity: fieldOpacity, transition: 'opacity 0.3s' }}
              onContextMenu={(e) => {
                if (fieldColor) {
                  e.preventDefault();
                  e.stopPropagation();
                  onFieldContextMenu(e, table.id, field.id, fieldColor);
                }
              }}
            >
              {/* Field Row (Height ~32px with margin/padding) */}
              <div 
                className="flex items-center gap-1 group text-xs h-[32px] rounded px-1"
                style={{
                  backgroundColor: fieldColor ? `${fieldColor}10` : 'transparent', // Very light tint
                  // Border only on top/bottom for row separation if needed, but keeping clear for now
                }}
              >
                
                {/* Left Handle */}
                <ConnectionHandle side="left" {...handleProps} />

                {/* Expand for Details/Description */}
                <button
                  onClick={() => setExpandedFieldId(expandedFieldId === field.id ? null : field.id)}
                  className="text-slate-300 hover:text-blue-500 -ml-1"
                >
                  {expandedFieldId === field.id ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>

                {/* PK Toggle */}
                <button
                  onClick={() => handleUpdateField(field.id, { isPrimaryKey: !field.isPrimaryKey })}
                  className={`p-0.5 rounded ${field.isPrimaryKey ? 'text-yellow-500' : 'text-slate-200 hover:text-slate-400'}`}
                  title="Toggle Primary Key"
                >
                  <Key size={12} fill={field.isPrimaryKey ? "currentColor" : "none"} />
                </button>

                {/* Name */}
                <input
                  className="flex-1 min-w-0 outline-none border-b border-transparent focus:border-blue-300 hover:bg-slate-50 rounded px-1 py-0.5 font-medium text-slate-700 bg-transparent"
                  value={field.name}
                  onChange={(e) => handleUpdateField(field.id, { name: e.target.value })}
                  placeholder="Field name"
                  style={{ color: fieldColor ? 'inherit' : undefined }}
                />

                {/* Type */}
                <select
                  className="w-24 outline-none text-slate-500 bg-transparent text-[11px] font-medium cursor-pointer hover:text-blue-600"
                  value={field.type}
                  onChange={(e) => handleUpdateField(field.id, { type: e.target.value as FieldType })}
                  title={`Technical Type: ${field.type}`}
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>

                {/* Right Handle */}
                <ConnectionHandle side="right" {...handleProps} />

                {/* Unlink Button - Visible on hover if connected */}
                {fieldColor && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDisconnect(table.id, field.id);
                        }}
                        className="opacity-0 group-hover/field:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity ml-1"
                        title="Disconnect Field"
                    >
                        <Unlink size={12} />
                    </button>
                )}

                {/* Delete Field Button */}
                <button
                  onClick={() => handleRemoveField(field.id)}
                  className="opacity-0 group-hover/field:opacity-100 text-slate-300 hover:text-red-500 transition-opacity ml-1"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              
              {/* Field Description (Collapsible) */}
              {expandedFieldId === field.id && (
                <div className="ml-8 mr-6 mt-1 mb-2">
                  <input
                    className="w-full text-[10px] text-slate-500 bg-slate-50 border border-slate-100 rounded px-1.5 py-1 outline-none focus:border-blue-300 placeholder:text-slate-300"
                    placeholder="Describe this field..."
                    value={field.description || ''}
                    onChange={(e) => handleUpdateField(field.id, { description: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-slate-100 bg-slate-50 rounded-b-lg">
        <button
          onClick={handleAddField}
          className="flex items-center justify-center w-full gap-1 py-1 text-xs font-medium text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
        >
          <Plus size={12} /> Add Field
        </button>
      </div>
    </div>
  );
};