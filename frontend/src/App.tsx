import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './sections/Dashboard';
import { KnowledgeGraphView } from './sections/KnowledgeGraphView';
import { NotesView } from './sections/NotesView';
import { SearchView } from './sections/SearchView';
import { WorkspacesView } from './sections/WorkspacesView';
import { WorkflowsView } from './sections/WorkflowsView';
import { PricingView } from './sections/PricingView';
import { AIInsightsPanel } from './components/AIInsightsPanel';
import { Button } from '@/components/ui/button';
import { Sparkles, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Note, AIInsight, Workspace } from './types';
import { mockNotes, mockInsights, mockWorkspaces } from './lib/mockData';

type View = 'dashboard' | 'notes' | 'graph' | 'search' | 'workspaces' | 'workflows' | 'pricing';

function App() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [notes, setNotes] = useState<Note[]>(mockNotes);
  const [insights] = useState<AIInsight[]>(mockInsights);
  const [workspaces] = useState<Workspace[]>(mockWorkspaces);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);

  // Handle responsive sidebar
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(true);
      } else {
        setSidebarCollapsed(false);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /**
   * Handle user logout
   */
  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch {
      // Error is handled by auth context
    }
  };

  const handleNoteCreate = (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newNote: Note = {
      ...note,
      id: `note-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setNotes(prev => [newNote, ...prev]);
  };

  const handleNoteUpdate = (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(note => 
      note.id === id ? { ...note, ...updates, updatedAt: new Date() } : note
    ));
  };

  const handleNoteDelete = (id: string) => {
    setNotes(prev => prev.filter(note => note.id !== id));
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard 
            user={user}
            notes={notes}
            insights={insights}
            workspaces={workspaces}
            onCreateNote={() => setCurrentView('notes')}
            onViewGraph={() => setCurrentView('graph')}
          />
        );
      case 'notes':
        return (
          <NotesView
            notes={notes}
            workspaces={workspaces}
            selectedWorkspace={selectedWorkspace}
            onNoteCreate={handleNoteCreate}
            onNoteUpdate={handleNoteUpdate}
            onNoteDelete={handleNoteDelete}
            onWorkspaceChange={setSelectedWorkspace}
          />
        );
      case 'graph':
        return <KnowledgeGraphView notes={notes} />;
      case 'search':
        return <SearchView notes={notes} />;
      case 'workspaces':
        return <WorkspacesView workspaces={workspaces} user={user} />;
      case 'workflows':
        return <WorkflowsView />;
      case 'pricing':
        return <PricingView currentPlan={user.plan} />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex">
      {/* Mobile Sidebar Overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 transition-all duration-300",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        sidebarCollapsed ? "w-20" : "w-72"
      )}>
        <Sidebar
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view as View);
            setMobileSidebarOpen(false);
          }}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          user={user}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-white/10 bg-slate-950/50 backdrop-blur-xl flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden text-slate-400 hover:text-white"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">CogniFlow</h1>
                <p className="text-xs text-slate-400 hidden sm:block">AI Knowledge OS</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex items-center gap-2 text-slate-300 hover:text-white"
              onClick={() => setInsightsOpen(!insightsOpen)}
            >
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>AI Insights</span>
              {insights.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 rounded-full">
                  {insights.length}
                </span>
              )}
            </Button>
            
            {/* User Menu */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white">{user?.full_name || 'User'}</p>
                <p className="text-xs text-slate-400">{user?.email}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white flex-shrink-0"
                onClick={handleLogout}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-8 max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>

      {/* AI Insights Panel */}
      <AIInsightsPanel
        insights={insights}
        isOpen={insightsOpen}
        onClose={() => setInsightsOpen(false)}
      />
    </div>
  );
}

export default App;
