import React, { useState, useCallback, useRef } from 'react';
import { Canvas } from './components/Canvas';
import { Table, Relationship, Point } from './types';
import { Database, Plus, Wand2, Download, Code, FileJson, Loader2, Save, Upload } from 'lucide-react';
import { generateSchemaFromPrompt } from './services/geminiService';

const EXAMPLE_PROMPT = "Create a school system with Students, Courses, and Teachers.";

export default function App() {
  const [tables, setTables] = useState<Table[]>([
    {
      id: '1',
      name: 'Users',
      description: 'wingmentor portal',
      x: 100,
      y: 100,
      fields: [
        { id: 'f1', name: 'id', type: 'UUID', isPrimaryKey: true, isForeignKey: false, isNullable: false },
        { id: 'f2', name: 'password', type: 'VARCHAR', isPrimaryKey: false, isForeignKey: false, isNullable: false },
      ]
    },
    {
      id: '2',
      name: 'Posts',
      description: 'platform page',
      x: 500,
      y: 100,
      fields: [
         { id: 'p1', name: 'pathways', type: 'UUID', isPrimaryKey: false, isForeignKey: false, isNullable: true },
         { id: 'p2', name: 'programs', type: 'UUID', isPrimaryKey: false, isForeignKey: false, isNullable: true },
         { id: 'p3', name: 'systems', type: 'VARCHAR', isPrimaryKey: false, isForeignKey: false, isNullable: true },
      ]
    }
  ]);

  const [relationships, setRelationships] = useState<Relationship[]>([
     { id: 'r1', sourceTableId: '1', sourceFieldId: 'f1', targetTableId: '2', targetFieldId: 'p2', cardinality: '1:N', label: 'access', color: '#8b5cf6' }
  ]);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<'SQL' | 'JSON'>('SQL');
  
  // Canvas View State (Lifted from Canvas)
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTable = () => {
    // Calculate position to center the new table in the current viewport
    const sidebarWidth = 320; // 20rem or w-80
    const viewportWidth = window.innerWidth - sidebarWidth;
    const viewportHeight = window.innerHeight;

    // Viewport Center relative to the canvas container (main element)
    // We assume the canvas container starts at x=0 (relative to itself) and has width = viewportWidth
    const cx = viewportWidth / 2;
    const cy = viewportHeight / 2;

    // Convert Screen Coordinate to World Coordinate
    // World = (Screen - Offset) / Zoom
    const worldX = (cx - offset.x) / zoom;
    const worldY = (cy - offset.y) / zoom;

    const newTable: Table = {
      id: crypto.randomUUID(),
      name: 'New_Table',
      description: '',
      // Center the table (approx width 280, height 200)
      x: worldX - 140, 
      y: worldY - 100,
      fields: [
        { id: crypto.randomUUID(), name: 'id', type: 'INT', isPrimaryKey: true, isForeignKey: false, isNullable: false }
      ]
    };
    setTables([...tables, newTable]);
    setSelectedTableId(newTable.id);
  };

  const handleGenerateAI = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const data = await generateSchemaFromPrompt(prompt);
      setTables(data.tables);
      setRelationships(data.relationships);
    } catch (e) {
      alert("Failed to generate schema. Please try again or check your API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSQL = () => {
    let sql = '';
    tables.forEach(t => {
      sql += `-- Table: ${t.name}\n`;
      if (t.description) {
        sql += `-- Description: ${t.description}\n`;
      }
      sql += `CREATE TABLE ${t.name} (\n`;
      const lines: string[] = [];
      
      // Fields
      t.fields.forEach(f => {
        let line = `  ${f.name} ${f.type}`;
        if (f.isPrimaryKey) line += ' PRIMARY KEY';
        if (!f.isNullable && !f.isPrimaryKey) line += ' NOT NULL';
        if (f.description) line += ` -- ${f.description}`;
        lines.push(line);
      });

      // Foreign Keys (based on relationships)
      // We look for relationships where THIS table is the SOURCE (the one holding the FK)
      // Usually in ERD visualization:
      // Line connects FK (Source) -> PK (Target)
      // So if 'Posts.user_id' -> 'Users.id', then Source=Posts, Target=Users.
      
      relationships
        .filter(r => r.sourceTableId === t.id && r.sourceFieldId && r.targetTableId && r.targetFieldId)
        .forEach(r => {
          const sourceField = t.fields.find(f => f.id === r.sourceFieldId);
          const targetTable = tables.find(tbl => tbl.id === r.targetTableId);
          const targetField = targetTable?.fields.find(f => f.id === r.targetFieldId);

          if (sourceField && targetTable && targetField) {
             lines.push(`  FOREIGN KEY (${sourceField.name}) REFERENCES ${targetTable.name}(${targetField.name})`);
          }
        });

      sql += lines.join(',\n');
      sql += `\n);\n\n`;
    });
    return sql;
  };

  const getExportContent = () => {
    if (exportFormat === 'JSON') {
      return JSON.stringify({ tables, relationships }, null, 2);
    }
    return generateSQL();
  };

  // --- File I/O ---

  const handleDownloadFile = () => {
    const data = JSON.stringify({ tables, relationships }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erd-design.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        if (data.tables && Array.isArray(data.tables) && data.relationships && Array.isArray(data.relationships)) {
          setTables(data.tables);
          setRelationships(data.relationships);
        } else {
          alert('Invalid file format. Please upload a valid EasyERD JSON file.');
        }
      } catch (error) {
        alert('Failed to parse the file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  return (
    <div className="flex h-screen w-screen bg-slate-100 text-slate-900 overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-xl z-20">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <div className="bg-blue-600 text-white p-2 rounded-lg">
             <Database size={20} />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-slate-800">EasyERD</h1>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          
          {/* Actions */}
          <div className="space-y-2">
             <button 
              onClick={handleAddTable}
              className="w-full flex items-center gap-2 justify-center bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 py-2.5 rounded-lg font-medium transition-all"
            >
              <Plus size={18} /> Add New Table
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* AI Generator */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Wand2 size={18} className="text-purple-500" />
              <h2>AI Generator</h2>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              Describe your app, and Gemini will build the database structure for you.
            </p>
            <textarea 
              className="w-full h-32 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none resize-none bg-slate-50"
              placeholder="e.g. A library system with Books, Authors, and Loans..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
             <button 
              onClick={handleGenerateAI}
              disabled={isGenerating || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 bg-purple-600 text-white py-2.5 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm shadow-purple-200"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              {isGenerating ? 'Designing...' : 'Generate Schema'}
            </button>
            <button 
              onClick={() => setPrompt(EXAMPLE_PROMPT)} 
              className="text-xs text-slate-400 hover:text-purple-600 underline"
            >
              Try example
            </button>
          </div>

          <hr className="border-slate-100" />

          {/* Project & Export */}
          <div>
            <div className="flex items-center gap-2 text-slate-800 font-semibold mb-3">
              <Download size={18} className="text-emerald-500" />
              <h2>Project Data</h2>
            </div>
            
            <div className="space-y-3">
              {/* File Management */}
              <div className="grid grid-cols-2 gap-2">
                 <button 
                  onClick={handleDownloadFile}
                  className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-900 text-white py-2 rounded text-sm font-medium transition-colors"
                  title="Download Project File"
                >
                  <Save size={16} /> Save
                </button>
                 <button 
                  onClick={handleImportClick}
                  className="flex items-center justify-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 py-2 rounded text-sm font-medium transition-colors"
                  title="Load Project File"
                >
                  <Upload size={16} /> Load
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".json" 
                  onChange={handleFileChange} 
                />
              </div>

              {/* View Code */}
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => { setExportFormat('SQL'); setShowExport(true); }}
                  className="flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 py-2 rounded text-sm font-medium text-slate-600"
                >
                  <Code size={16} /> SQL
                </button>
                 <button 
                  onClick={() => { setExportFormat('JSON'); setShowExport(true); }}
                  className="flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 hover:bg-slate-50 py-2 rounded text-sm font-medium text-slate-600"
                >
                  <FileJson size={16} /> JSON
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-400 text-center">
          Powered by Gemini 3 Flash
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative">
        <Canvas 
          tables={tables} 
          relationships={relationships}
          onTablesUpdate={setTables}
          onRelationshipsUpdate={setRelationships}
          selectedTableId={selectedTableId}
          onSelectTable={setSelectedTableId}
          zoom={zoom}
          setZoom={setZoom}
          offset={offset}
          setOffset={setOffset}
        />
      </main>

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-lg">Export {exportFormat}</h3>
              <button onClick={() => setShowExport(false)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><XIcon /></button>
            </div>
            <div className="flex-1 p-0 overflow-hidden bg-slate-900">
               <pre className="w-full h-full p-4 overflow-auto text-sm font-mono text-emerald-400">
                 {getExportContent()}
               </pre>
            </div>
            <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
              <button 
                onClick={() => { navigator.clipboard.writeText(getExportContent()); }}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium text-sm"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple X Icon component for the modal
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);