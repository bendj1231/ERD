import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Table, Relationship, Point, Size } from '../types';
import { TableNode } from './TableNode';
import { getIntersection, getCenter } from '../utils/geometry';
import { X, ZoomIn, ZoomOut, MousePointer2, Eye, EyeOff, Unlink, Trash2, Palette } from 'lucide-react';

interface CanvasProps {
  tables: Table[];
  relationships: Relationship[];
  onTablesUpdate: (tables: Table[]) => void;
  onRelationshipsUpdate: (rels: Relationship[]) => void;
  selectedTableId: string | null;
  onSelectTable: (id: string | null) => void;
  // Lifted state props
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  offset: Point;
  setOffset: React.Dispatch<React.SetStateAction<Point>>;
  theme: 'light' | 'dark';
}

const TABLE_SIZE: Size = { width: 280, height: 200 }; 

// Vibrant colors for relationships
const CONNECTION_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#f59e0b', // amber-500
  '#84cc16', // lime-500
  '#10b981', // emerald-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#d946ef', // fuchsia-500
  '#f43f5e', // rose-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
];

interface ConnectionState {
  tableId: string;
  fieldId?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  color: string;
  tableId?: string;
  fieldId?: string;
  relationshipId?: string; // ID of the specific relationship being modified
}

export const Canvas: React.FC<CanvasProps> = ({
  tables,
  relationships,
  onTablesUpdate,
  onRelationshipsUpdate,
  selectedTableId,
  onSelectTable,
  zoom,
  setZoom,
  offset,
  setOffset,
  theme
}) => {
  // offset and zoom are now props
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [draggingTableId, setDraggingTableId] = useState<string | null>(null);
  
  // State for active connection creation
  const [connectionStart, setConnectionStart] = useState<ConnectionState | null>(null);
  const [highlightedColor, setHighlightedColor] = useState<string | null>(null);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);

  // Compute map of field ID -> Color based on active relationships
  const fieldColors = useMemo(() => {
    const map: Record<string, string> = {};
    relationships.forEach(r => {
      // Use blue by default if no color set
      const effectiveColor = r.color || '#3b82f6';

      if (r.sourceFieldId) map[r.sourceFieldId] = effectiveColor;
      if (r.targetFieldId) map[r.targetFieldId] = effectiveColor;
    });
    return map;
  }, [relationships, theme]);

  // --- Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking inside context menu, if so, return
    if ((e.target as HTMLElement).closest('.context-menu')) return;
    
    // Close context menu on any interaction outside
    if (contextMenu) setContextMenu(null);

    // If clicking on background
    if (e.button === 0) { // Left click
      setIsDraggingCanvas(true);
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      onSelectTable(null); // Deselect
      setConnectionStart(null); // Cancel connection
      
      // Note: We don't reset highlightedColor on background click automatically 
      // if the user wants to keep the view focused while panning. 
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Canvas Pan
    if (isDraggingCanvas) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }

    // Table Drag
    if (draggingTableId) {
      const updatedTables = tables.map(t => {
        if (t.id === draggingTableId) {
          return {
            ...t,
            x: t.x + e.movementX / zoom,
            y: t.y + e.movementY / zoom,
          };
        }
        return t;
      });
      onTablesUpdate(updatedTables);
    }

    // Track mouse for connecting line preview
    if (connectionStart && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left - offset.x) / zoom,
        y: (e.clientY - rect.top - offset.y) / zoom,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingTableId(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    // Standardizing zoom behavior:
    // Scroll UP (negative deltaY) -> Zoom IN
    // Scroll DOWN (positive deltaY) -> Zoom OUT
    const zoomSensitivity = 0.001; 
    const delta = -e.deltaY * zoomSensitivity;
    
    // Clamp zoom between 0.2 and 3
    setZoom(z => Math.min(Math.max(0.2, z + delta), 3));
  };

  const handleTableMouseDown = (e: React.MouseEvent, tableId: string) => {
    e.stopPropagation(); // Stop canvas drag
    if (contextMenu) setContextMenu(null);

    // If we are connecting, this click might be attempting to end connection on the table header
    if (connectionStart) {
      return;
    }

    onSelectTable(tableId);
    setDraggingTableId(tableId);
  };

  const handleTableUpdate = (id: string, updates: Partial<Table>) => {
    const newTables = tables.map(t => t.id === id ? { ...t, ...updates } : t);
    onTablesUpdate(newTables);
  };

  const handleTableDelete = (id: string) => {
    onTablesUpdate(tables.filter(t => t.id !== id));
    onRelationshipsUpdate(relationships.filter(r => r.sourceTableId !== id && r.targetTableId !== id));
  };

  const handleConnect = (tableId: string, fieldId?: string) => {
    if (contextMenu) setContextMenu(null);

    if (!connectionStart) {
      // Start connection
      setConnectionStart({ tableId, fieldId });
    } else {
      // End connection
      if (connectionStart.tableId === tableId && connectionStart.fieldId === fieldId) {
         setConnectionStart(null);
         return;
      }
      
      const exists = relationships.some(r => 
        (r.sourceTableId === connectionStart.tableId && r.targetTableId === tableId && r.sourceFieldId === connectionStart.fieldId && r.targetFieldId === fieldId) ||
        (r.sourceTableId === tableId && r.targetTableId === connectionStart.tableId && r.sourceFieldId === fieldId && r.targetFieldId === connectionStart.fieldId)
      );

      if (!exists) {
        // --- IMPROVED COLOR LOGIC ---
        let color: string | undefined;

        // 1. Try to inherit from Source Field (Outgoing or Incoming)
        if (connectionStart.fieldId) {
            const r = relationships.find(rel => 
                (rel.sourceTableId === connectionStart.tableId && rel.sourceFieldId === connectionStart.fieldId) ||
                (rel.targetTableId === connectionStart.tableId && rel.targetFieldId === connectionStart.fieldId)
            );
            if (r?.color) color = r.color;
        }

        // 2. Try to inherit from Target Field (Outgoing or Incoming)
        if (!color && fieldId) {
            const r = relationships.find(rel => 
                (rel.sourceTableId === tableId && rel.sourceFieldId === fieldId) ||
                (rel.targetTableId === tableId && rel.targetFieldId === fieldId)
            );
            if (r?.color) color = r.color;
        }

        // 3. Try to inherit from Source Table (Flow continuity - any connection to this table)
        if (!color) {
            const r = relationships.find(rel => 
                rel.sourceTableId === connectionStart.tableId || rel.targetTableId === connectionStart.tableId
            );
            if (r?.color) color = r.color;
        }

        // 4. Try to inherit from Target Table
        if (!color) {
             const r = relationships.find(rel => 
                rel.sourceTableId === tableId || rel.targetTableId === tableId
            );
            if (r?.color) color = r.color;
        }

        // 5. New random color if isolated
        if (!color) {
            color = CONNECTION_COLORS[Math.floor(Math.random() * CONNECTION_COLORS.length)];
        }

        const newRel: Relationship = {
          id: crypto.randomUUID(),
          sourceTableId: connectionStart.tableId,
          sourceFieldId: connectionStart.fieldId,
          targetTableId: tableId,
          targetFieldId: fieldId,
          cardinality: '1:N',
          color: color
        };
        onRelationshipsUpdate([...relationships, newRel]);
      }
      setConnectionStart(null);
    }
  };
  
  const handleDisconnectField = (tableId: string, fieldId: string) => {
    onRelationshipsUpdate(relationships.filter(r => 
        !((r.sourceTableId === tableId && r.sourceFieldId === fieldId) ||
          (r.targetTableId === tableId && r.targetFieldId === fieldId))
    ));
  };

  const handleRelationshipDelete = (id: string) => {
      onRelationshipsUpdate(relationships.filter(r => r.id !== id));
  }

  const handleRelationshipContextMenu = (e: React.MouseEvent, r: Relationship) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        color: r.color || '#3b82f6',
        relationshipId: r.id
      });
    }
  };
  
  const handleFieldContextMenu = (e: React.MouseEvent, tableId: string, fieldId: string, color: string) => {
    e.preventDefault(); // Prevent browser context menu
    e.stopPropagation();

    // Find relationship associated with this field to allow specific editing
    const rel = relationships.find(r => 
        (r.sourceTableId === tableId && r.sourceFieldId === fieldId) ||
        (r.targetTableId === tableId && r.targetFieldId === fieldId)
    );

    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      setContextMenu({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        color,
        tableId,
        fieldId,
        relationshipId: rel?.id
      });
    }
  };

  const handleColorChange = (newColor: string) => {
    if (contextMenu?.relationshipId) {
      const updated = relationships.map(r => 
        r.id === contextMenu.relationshipId ? { ...r, color: newColor } : r
      );
      onRelationshipsUpdate(updated);
      setContextMenu(null);
      
      // If the user was highlighting this color, switch focus to the new color
      if (highlightedColor === contextMenu.color) {
        setHighlightedColor(newColor);
      }
    }
  };

  const handleRelationshipClick = (e: React.MouseEvent, r: Relationship) => {
      e.stopPropagation();
  };

  // --- Geometry Helpers ---

  const getTableDescHeight = (table: Table) => {
    return table.description ? Math.ceil(table.description.length / 42) * 16 + 10 : 0;
  }

  const calculateTableHeight = (table: Table) => {
     const base = 40 + 8 + 35; 
     const descHeight = getTableDescHeight(table);
     // Add image height (128px for h-32)
     const imageHeight = table.imageUrl ? 128 : 0;
     return base + (table.fields.length * 33) + descHeight + imageHeight;
  };

  const getFieldPosition = (table: Table, fieldId?: string): Point => {
      if (!fieldId) {
          const h = calculateTableHeight(table);
          return getCenter(table.x, table.y, TABLE_SIZE.width, h);
      }

      const fieldIndex = table.fields.findIndex(f => f.id === fieldId);
      if (fieldIndex === -1) {
          const h = calculateTableHeight(table);
          return getCenter(table.x, table.y, TABLE_SIZE.width, h);
      }

      const headerHeight = 40;
      const descHeight = getTableDescHeight(table);
      const imageHeight = table.imageUrl ? 128 : 0;
      const fieldsPaddingTop = 8;
      const fieldRowHeight = 33; 
      
      const yOffset = headerHeight + descHeight + imageHeight + fieldsPaddingTop + (fieldIndex * fieldRowHeight) + (fieldRowHeight / 2);
      
      return {
          x: table.x + TABLE_SIZE.width, 
          y: table.y + yOffset
      };
  };

  const renderConnectionLine = (r: Relationship) => {
    const source = tables.find(t => t.id === r.sourceTableId);
    const target = tables.find(t => t.id === r.targetTableId);
    if (!source || !target) return null;

    let color = r.color;
    // Fallback colors based on theme if no color set
    if (!color) {
        color = '#3b82f6'; // Default to Blue if no color is set
    }
    
    const isDimmed = highlightedColor && r.color !== highlightedColor;
    const opacity = isDimmed ? 0.1 : 1;

    let start: Point, end: Point;
    let pathD = '';
    let arrowAngle = 0;
    const isFieldConnection = !!(r.sourceFieldId || r.targetFieldId);

    if (isFieldConnection) {
        // Initial Positions
        const p1 = r.sourceFieldId ? getFieldPosition(source, r.sourceFieldId) : getCenter(source.x, source.y, TABLE_SIZE.width, calculateTableHeight(source));
        const p2 = r.targetFieldId ? getFieldPosition(target, r.targetFieldId) : getCenter(target.x, target.y, TABLE_SIZE.width, calculateTableHeight(target));
        
        let dir1 = { x: 1, y: 0 }; // Default source outgoing direction (Right)
        let dir2 = { x: 1, y: 0 }; // Default target outgoing normal (Right)
        
        // Adjust points and normals based on relative position
        if (source.x < target.x) {
             // Target is right of source. Connect Source Right -> Target Left.
             if (r.targetFieldId) {
                 p2.x = target.x; // Move p2 to Left edge
                 dir2 = { x: -1, y: 0 }; // Target Normal is Left
             }
        } else {
             // Target is left of source. Connect Source Left -> Target Right.
             if (r.sourceFieldId) {
                 p1.x = source.x; // Move p1 to Left edge
                 dir1 = { x: -1, y: 0 }; // Source Normal is Left
             }
             // p2 is already at Right edge (default)
        }
        
        start = p1;
        end = p2;
        
        const cp1 = { x: start.x + dir1.x * 50, y: start.y + dir1.y * 50 };
        const cp2 = { x: end.x + dir2.x * 50, y: end.y + dir2.y * 50 };
        
        pathD = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;
        
        // Calculate arrow angle based on tangent at end (end - cp2)
        const dx = end.x - cp2.x;
        const dy = end.y - cp2.y;
        arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    } else {
        // General Table-to-Table connection (fallback)
        const sourceH = calculateTableHeight(source);
        const targetH = calculateTableHeight(target);
        const sourceCenter = getCenter(source.x, source.y, TABLE_SIZE.width, sourceH);
        const targetCenter = getCenter(target.x, target.y, TABLE_SIZE.width, targetH);
        start = getIntersection(sourceCenter, { width: TABLE_SIZE.width, height: sourceH }, targetCenter);
        end = getIntersection(targetCenter, { width: TABLE_SIZE.width, height: targetH }, sourceCenter);
        
        pathD = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        arrowAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    }

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Don't show flow animation while dragging to avoid jitter
    const showFlow = !draggingTableId;

    return (
      <g 
        key={r.id} 
        className="group cursor-pointer transition-opacity duration-300" 
        style={{ opacity }}
        onClick={(e) => handleRelationshipClick(e, r)}
        onContextMenu={(e) => handleRelationshipContextMenu(e, r)}
      >
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="2"
          className="hover:opacity-80"
        />
        {/* Invisible thick path for easier clicking */}
        <path
          d={pathD}
          fill="none"
          stroke="transparent"
          strokeWidth="15"
        />
        
        {/* Manual Arrow Head */}
        <polygon 
          points="0 0, 10 3.5, 0 7" 
          fill={color} 
          transform={`translate(${end.x},${end.y}) rotate(${arrowAngle}) translate(-9,-3.5)`}
          className="hover:opacity-80"
        />
        
        {/* Flow Animation Ball */}
        {showFlow && (
             <circle r="3" fill="#ffffff" style={{ filter: 'drop-shadow(0 0 2px rgba(255,255,255,0.8))' }}>
                <animateMotion 
                    dur="1.5s" 
                    repeatCount="indefinite" 
                    path={pathD}
                    calcMode="linear"
                />
            </circle>
        )}

        <foreignObject x={midX - 12} y={midY - 12} width={24} height={24} className="overflow-visible pointer-events-none">
            <div className="group-hover:flex hidden bg-white rounded-full border shadow items-center justify-center w-6 h-6 hover:bg-red-50 pointer-events-auto cursor-pointer" 
                 style={{ borderColor: color }}
                 onClick={(e) => { e.stopPropagation(); handleRelationshipDelete(r.id); }}>
                <X size={14} style={{ color }}/>
            </div>
        </foreignObject>
      </g>
    );
  };

  const renderPreviewLine = () => {
    if (!connectionStart || !mousePos) return null;
    const source = tables.find(t => t.id === connectionStart.tableId);
    if (!source) return null;

    let start: Point;
    if (connectionStart.fieldId) {
         start = getFieldPosition(source, connectionStart.fieldId);
         if (source.x > mousePos.x) start.x = source.x; 
    } else {
        const sourceH = calculateTableHeight(source);
        const sourceCenter = getCenter(source.x, source.y, TABLE_SIZE.width, sourceH);
        start = getIntersection(sourceCenter, { width: TABLE_SIZE.width, height: sourceH }, mousePos);
    }

    return (
      <path
        d={`M ${start.x} ${start.y} L ${mousePos.x} ${mousePos.y}`}
        stroke="#3b82f6"
        strokeWidth="2"
        strokeDasharray="5,5"
        markerEnd="url(#arrowhead-blue)"
      />
    );
  };

  const gridColor = theme === 'dark' ? '#3f3f46' : '#cbd5e1'; // zinc-700 vs slate-300
  const bgColor = theme === 'dark' ? '#18181b' : '#f8fafc'; // zinc-900 vs slate-50
  const zoomBtnClass = theme === 'dark' ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-white text-slate-600 hover:bg-slate-50';
  const zoomTextClass = theme === 'dark' ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-slate-600';

  return (
    <div 
      ref={canvasRef}
      className="w-full h-full relative overflow-hidden cursor-grab active:cursor-grabbing print:bg-white print:!bg-none"
      style={{
        backgroundColor: bgColor,
        backgroundImage: `radial-gradient(${gridColor} 1px, transparent 1px)`,
        backgroundSize: '20px 20px'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()} // Disable default context menu on canvas
    >
      {/* Zoom Controls */}
      <div className="absolute bottom-4 right-4 flex gap-2 z-50 print:hidden">
          <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className={`p-2 rounded shadow ${zoomBtnClass}`}><ZoomOut size={20}/></button>
          <div className={`px-3 py-2 rounded shadow text-sm font-mono min-w-[60px] text-center ${zoomTextClass}`}>{Math.round(zoom * 100)}%</div>
          <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className={`p-2 rounded shadow ${zoomBtnClass}`}><ZoomIn size={20}/></button>
      </div>

      {/* Focus Mode Indicator */}
      {highlightedColor && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 print:hidden">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: highlightedColor }}></div>
            <span className="text-sm font-medium">Flow Focused</span>
            <button onClick={() => setHighlightedColor(null)} className="ml-2 hover:bg-slate-700 rounded-full p-1"><X size={14}/></button>
        </div>
      )}
      
      {/* Custom Context Menu */}
      {contextMenu && (
        <div 
            className="context-menu absolute z-[100] bg-white rounded-lg shadow-xl border border-slate-200 py-1 min-w-[200px] animate-in fade-in zoom-in-95 duration-100 origin-top-left print:hidden"
            style={{ top: contextMenu.y, left: contextMenu.x }}
        >
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 text-xs font-medium text-slate-500">
                <Palette size={14} /> Connection Color
            </div>
            
            {/* Color Grid */}
            <div className="p-3 grid grid-cols-6 gap-2 border-b border-slate-100">
                {CONNECTION_COLORS.map(c => (
                    <button
                        key={c}
                        className={`w-5 h-5 rounded-full hover:scale-110 transition-transform ${contextMenu.color === c ? 'ring-2 ring-offset-2 ring-slate-400' : ''}`}
                        style={{ backgroundColor: c }}
                        onClick={() => handleColorChange(c)}
                        title={c}
                    />
                ))}
            </div>

            {/* Actions */}
            <div className="py-1">
                {highlightedColor === contextMenu.color ? (
                     <button 
                        onClick={() => { setHighlightedColor(null); setContextMenu(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                        <EyeOff size={16} /> Exit Focus Mode
                    </button>
                ) : (
                    <button 
                        onClick={() => { setHighlightedColor(contextMenu.color); setContextMenu(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                        <Eye size={16} /> Focus this Flow
                    </button>
                )}

                {contextMenu.relationshipId && (
                     <button 
                        onClick={() => { handleRelationshipDelete(contextMenu.relationshipId!); setContextMenu(null); }}
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-slate-100 mt-1 pt-2"
                    >
                        <Trash2 size={16} /> Delete Connection
                    </button>
                )}
            </div>
        </div>
      )}

      {/* Connection Mode Indicator */}
      {connectionStart && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2 animate-bounce print:hidden">
              <MousePointer2 size={16} />
              <span className="text-sm font-medium">
                  {connectionStart.fieldId ? "Select target field" : "Select target table"}
              </span>
              <button onClick={() => setConnectionStart(null)} className="ml-2 hover:bg-blue-700 rounded-full p-1"><X size={14}/></button>
          </div>
      )}

      {/* Transform Container */}
      <div 
        className="origin-top-left w-full h-full"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
      >
        {/* SVG Layer for Lines */}
        <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none overflow-visible">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill={theme === 'dark' ? '#71717a' : '#94a3b8'} />
            </marker>
             <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
            </marker>
          </defs>
          {relationships.map(renderConnectionLine)}
          {renderPreviewLine()}
        </svg>

        {/* HTML Layer for Tables */}
        {tables.map(table => {
          // Calculate dimming status: Is this table part of the highlighted flow?
          // We check if the table has ANY relationship matching the highlighted color.
          const isRelatedToHighlight = highlightedColor 
            ? relationships.some(r => r.color === highlightedColor && (r.sourceTableId === table.id || r.targetTableId === table.id))
            : true;
          
          return (
            <TableNode
              key={table.id}
              table={table}
              isSelected={selectedTableId === table.id}
              onMouseDown={handleTableMouseDown}
              onUpdate={handleTableUpdate}
              onDelete={handleTableDelete}
              onConnect={handleConnect}
              onDisconnect={handleDisconnectField}
              scale={zoom}
              isConnecting={!!connectionStart}
              fieldColors={fieldColors}
              highlightedColor={highlightedColor}
              isDimmed={highlightedColor ? !isRelatedToHighlight : false}
              onFieldContextMenu={handleFieldContextMenu}
              theme={theme}
            />
          );
        })}
      </div>
    </div>
  );
};