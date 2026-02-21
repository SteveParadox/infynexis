import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  LayoutDashboard, 
  FileText, 
  Share2, 
  Search, 
  Users, 
  Zap, 
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Settings,
  LogOut,
  Plus
} from 'lucide-react';
import type { User } from '@/types';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: User;
}

const navigation = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'notes', label: 'Notes', icon: FileText },
  { id: 'graph', label: 'Knowledge Graph', icon: Share2 },
  { id: 'search', label: 'AI Search', icon: Search },
  { id: 'workspaces', label: 'Workspaces', icon: Users },
  { id: 'workflows', label: 'Workflows', icon: Zap },
  { id: 'pricing', label: 'Pricing', icon: CreditCard },
];

export function Sidebar({ 
  currentView, 
  onViewChange, 
  collapsed, 
  onToggleCollapse,
  user 
}: SidebarProps) {
  return (
    <div className={cn(
      "h-full bg-slate-950 border-r border-white/10 flex flex-col transition-all duration-300",
      collapsed ? "w-20" : "w-72"
    )}>
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
        {!collapsed && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-semibold text-white">CogniFlow</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:flex text-slate-400 hover:text-white hover:bg-white/10"
          onClick={onToggleCollapse}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* New Note Button */}
      <div className="p-4">
        <Button
          className={cn(
            "w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white",
            collapsed && "px-2"
          )}
          onClick={() => onViewChange('notes')}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span className="ml-2">New Note</span>}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive 
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" 
                    : "text-slate-400 hover:text-white hover:bg-white/5",
                  collapsed && "justify-center px-2"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 flex-shrink-0",
                  isActive && "text-indigo-400"
                )} />
                {!collapsed && <span>{item.label}</span>}
                {!collapsed && item.id === 'search' && (
                  <Sparkles className="h-3 w-3 ml-auto text-indigo-400" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Pro Badge */}
        {!collapsed && user.plan === 'pro' && (
          <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-medium text-white">Pro Plan</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              You have access to all AI features and unlimited notes.
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full text-xs border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20"
              onClick={() => onViewChange('pricing')}
            >
              Upgrade to Team
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* User Section */}
      <div className="p-4 border-t border-white/10">
        <div className={cn(
          "flex items-center gap-3",
          collapsed && "justify-center"
        )}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-medium">
            {user.name.charAt(0)}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          )}
          {!collapsed && (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                <Settings className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
