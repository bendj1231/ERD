import React, { useState, useCallback, useRef } from 'react';
import { Canvas } from './components/Canvas';
import { Table, Relationship, Point } from './types';
import { Database, Plus, Wand2, Download, Code, FileJson, Loader2, Save, Upload, Sun, Moon, Printer } from 'lucide-react';
import { generateSchemaFromPrompt } from './services/geminiService';

const EXAMPLE_PROMPT = "Create a school system with Students, Courses, and Teachers.";

export default function App() {
  const [tables, setTables] = useState<Table[]>([
    {
      id: '1',
      name: 'Users',
      description: 'System users',
      x: 100,
      y: 100,
      fields: [
        { id: 'f1', name: 'id', type: 'UUID', isPrimaryKey: true, isForeignKey: false, isNullable: false },
        { id: 'f2', name: 'username', type: 'VARCHAR', isPrimaryKey: false, isForeignKey: false, isNullable: false },
        { id: 'f3', name: 'email', type: 'VARCHAR', isPrimaryKey: false, isForeignKey: false, isNullable: false },
      ]
    },
    {
      id: '2',
      name: 'Logs',
      description: 'Activity logs',
      x: 500,
      y: 100,
      fields: [
         { id: 'p1', name: 'id', type: 'UUID', isPrimaryKey: true, isForeignKey: false, isNullable: false },
         { id: 'p2', name: 'user_id', type: 'UUID', isPrimaryKey: false, isForeignKey: true, isNullable: true },
         { id: 'p3', name: 'action', type: 'VARCHAR', isPrimaryKey: false, isForeignKey: false, isNullable: true },
         { id: 'p4', name: 'timestamp', type: 'TIMESTAMP', isPrimaryKey: false, isForeignKey: false, isNullable: false },
      ]
    }
  ]);

  const [relationships, setRelationships] = useState<Relationship[]>([
     { id: 'r1', sourceTableId: '2', sourceFieldId: 'p2', targetTableId: '1', targetFieldId: 'f1', cardinality: 'N:1', label: 'logs', color: '#3b82f6' }
  ]);

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<'SQL' | 'JSON'>('SQL');
  
  // Canvas View State (Lifted from Canvas)
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  
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

  const handlePrint = () => {
    window.print();
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
    a.download = 'database-schema.json';
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
          alert('Invalid file format. Please upload a valid JSON file.');
        }
      } catch (error) {
        alert('Failed to parse the file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${theme === 'dark' ? 'bg-zinc-900 text-zinc-100' : 'bg-zinc-100 text-zinc-900'} print:bg-white`}>
      
      {/* Sidebar */}
      <aside className="w-80 bg-zinc-950 border-r border-zinc-800 flex flex-col shadow-2xl z-20 text-zinc-300 print:hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-white text-zinc-950 p-2 rounded-lg shadow-lg shadow-white/10">
                <Database size={24} strokeWidth={2} />
             </div>
             <div>
                 <h1 className="font-bold text-lg tracking-tight text-white leading-tight">Database</h1>
                 <h1 className="font-bold text-lg tracking-tight text-zinc-400 leading-tight">Management</h1>
             </div>
          </div>
          <button 
             onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}
             className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
             title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
          >
             {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-8">
          
          {/* Actions */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Structure</h3>
             <button 
              onClick={handleAddTable}
              className="w-full flex items-center gap-2 justify-center bg-white text-zinc-950 hover:bg-zinc-200 py-3 rounded-lg font-bold transition-all shadow-lg shadow-white/5"
            >
              <Plus size={18} /> Add New Table
            </button>
          </div>

          <hr className="border-zinc-800" />

          {/* AI Generator */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-white font-semibold">
              <Wand2 size={18} className="text-zinc-100" />
              <h2>AI Architect</h2>
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Describe your system, and the AI will generate the optimal schema structure.
            </p>
            <textarea 
              className="w-full h-32 p-3 text-sm border border-zinc-700 rounded-lg focus:ring-1 focus:ring-white focus:border-white outline-none resize-none bg-zinc-900 text-zinc-200 placeholder:text-zinc-600 transition-all"
              placeholder="e.g. A CRM for a real estate agency with Agents, Properties, and Clients..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
             <button 
              onClick={handleGenerateAI}
              disabled={isGenerating || !prompt.trim()}
              className="w-full flex items-center justify-center gap-2 bg-zinc-800 text-white border border-zinc-700 py-2.5 rounded-lg font-medium hover:bg-zinc-700 hover:border-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
              {isGenerating ? 'Designing...' : 'Generate Schema'}
            </button>
            <button 
              onClick={() => setPrompt(EXAMPLE_PROMPT)} 
              className="text-xs text-zinc-500 hover:text-white underline transition-colors"
            >
              Load example prompt
            </button>
          </div>

          <hr className="border-zinc-800" />

          {/* Project & Export */}
          <div>
            <div className="flex items-center gap-2 text-white font-semibold mb-4">
              <Download size={18} className="text-zinc-100" />
              <h2>Project Data</h2>
            </div>
            
            <div className="space-y-3">
              {/* File Management */}
              <div className="grid grid-cols-2 gap-3">
                 <button 
                  onClick={handleDownloadFile}
                  className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white py-2 rounded text-sm font-medium transition-all"
                  title="Download Project File"
                >
                  <Save size={16} /> Save
                </button>
                 <button 
                  onClick={handleImportClick}
                  className="flex items-center justify-center gap-2 bg-transparent border border-zinc-700 hover:bg-zinc-800 text-zinc-300 py-2 rounded text-sm font-medium transition-all"
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
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => { setExportFormat('SQL'); setShowExport(true); }}
                  className="flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 hover:text-white bg-transparent py-2 rounded text-sm font-medium text-zinc-400 transition-all"
                >
                  <Code size={16} /> SQL
                </button>
                 <button 
                  onClick={() => { setExportFormat('JSON'); setShowExport(true); }}
                  className="flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 hover:text-white bg-transparent py-2 rounded text-sm font-medium text-zinc-400 transition-all"
                >
                  <FileJson size={16} /> JSON
                </button>
              </div>

               {/* Print / Export PDF */}
               <button
                  onClick={handlePrint}
                  className="w-full flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 hover:text-white bg-transparent py-2 rounded text-sm font-medium text-zinc-400 transition-all"
               >
                  <Printer size={16} /> Print / PDF
               </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-900 text-[10px] text-zinc-600 text-center uppercase tracking-widest font-semibold">
          Database Management Systems
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 relative print:fixed print:inset-0 print:z-50 print:bg-white print:w-screen print:h-screen">
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
          theme={theme}
        />
      </main>

      {/* Export Modal */}
      {showExport && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm print:hidden">
          <div className="bg-zinc-900 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] border border-zinc-700">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
              <h3 className="font-bold text-lg text-white">Export {exportFormat}</h3>
              <button onClick={() => setShowExport(false)} className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"><XIcon /></button>
            </div>
            <div className="flex-1 p-0 overflow-hidden bg-black">
               <pre className="w-full h-full p-4 overflow-auto text-sm font-mono text-zinc-300">
                 {getExportContent()}
               </pre>
            </div>
            <div className="p-4 border-t border-zinc-800 bg-zinc-900 rounded-b-xl flex justify-end gap-2">
              <button 
                onClick={() => { navigator.clipboard.writeText(getExportContent()); }}
                className="px-4 py-2 bg-white text-black rounded hover:bg-zinc-200 font-bold text-sm transition-colors"
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