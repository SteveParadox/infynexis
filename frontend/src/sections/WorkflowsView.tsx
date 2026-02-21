import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Zap, 
  Plus, 
  Edit2,
  Trash2,
  Clock,
  FileText,
  Bell,
  Webhook,
  Brain,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import type { Workflow } from '@/types';

// Mock workflows data
const mockWorkflows: Workflow[] = [
  {
    id: 'wf-1',
    name: 'Auto-summarize Daily Notes',
    trigger: { type: 'scheduled', config: { cron: '0 18 * * *' } },
    actions: [
      { type: 'ai-summarize', config: {} },
      { type: 'send-notification', config: { channel: 'email' } },
    ],
    isActive: true,
    createdAt: new Date('2025-02-10'),
  },
  {
    id: 'wf-2',
    name: 'New Note to Slack',
    trigger: { type: 'note-created', config: { workspace: 'ws-1' } },
    actions: [
      { type: 'webhook', config: { url: 'https://hooks.slack.com/...' } },
    ],
    isActive: true,
    createdAt: new Date('2025-02-12'),
  },
  {
    id: 'wf-3',
    name: 'Weekly Knowledge Report',
    trigger: { type: 'scheduled', config: { cron: '0 9 * * 1' } },
    actions: [
      { type: 'export', config: { format: 'pdf' } },
      { type: 'send-notification', config: { channel: 'email' } },
    ],
    isActive: false,
    createdAt: new Date('2025-02-14'),
  },
];

const triggerIcons = {
  'note-created': FileText,
  'tag-added': CheckCircle2,
  'scheduled': Clock,
  'webhook': Webhook,
};

const actionIcons = {
  'send-notification': Bell,
  'create-task': CheckCircle2,
  'export': FileText,
  'webhook': Webhook,
  'ai-summarize': Brain,
};

export function WorkflowsView() {
  const [workflows, setWorkflows] = useState<Workflow[]>(mockWorkflows);
  const [isCreating, setIsCreating] = useState(false);

  const toggleWorkflow = (id: string) => {
    setWorkflows(prev => prev.map(wf => 
      wf.id === id ? { ...wf, isActive: !wf.isActive } : wf
    ));
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows(prev => prev.filter(wf => wf.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="h-6 w-6 text-amber-400" />
            Workflows
          </h1>
          <p className="text-slate-400">
            Automate your knowledge management with AI-powered workflows
          </p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{workflows.length}</p>
            <p className="text-sm text-slate-400">Total Workflows</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-400">
              {workflows.filter(w => w.isActive).length}
            </p>
            <p className="text-sm text-slate-400">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">1,247</p>
            <p className="text-sm text-slate-400">Runs this month</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">98.5%</p>
            <p className="text-sm text-slate-400">Success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      <div className="space-y-4">
        {workflows.map((workflow, index) => {
          const TriggerIcon = triggerIcons[workflow.trigger.type];
          
          return (
            <motion.div
              key={workflow.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="bg-slate-900/50 border-white/10 hover:border-indigo-500/30 transition-all group">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center",
                        workflow.isActive 
                          ? "bg-emerald-500/20 text-emerald-400" 
                          : "bg-slate-700 text-slate-400"
                      )}>
                        <Zap className="h-6 w-6" />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold text-white">{workflow.name}</h3>
                          <Badge 
                            variant={workflow.isActive ? 'default' : 'secondary'}
                            className={workflow.isActive 
                              ? 'bg-emerald-500/20 text-emerald-400' 
                              : 'bg-slate-700 text-slate-400'
                            }
                          >
                            {workflow.isActive ? 'Active' : 'Paused'}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-2 text-sm text-slate-400">
                            <TriggerIcon className="h-4 w-4" />
                            <span className="capitalize">{workflow.trigger.type.replace('-', ' ')}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-600" />
                          <div className="flex items-center gap-2">
                            {workflow.actions.map((action, i) => {
                              const ActionIcon = actionIcons[action.type];
                              return (
                                <div 
                                  key={i}
                                  className="flex items-center gap-1 text-sm text-slate-400"
                                >
                                  <ActionIcon className="h-4 w-4" />
                                  <span className="capitalize">{action.type.replace('-', ' ')}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Switch
                        checked={workflow.isActive}
                        onCheckedChange={() => toggleWorkflow(workflow.id)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => {/* TODO: Edit workflow */}}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteWorkflow(workflow.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Empty State */}
      {workflows.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-4">
            <Zap className="h-8 w-8 text-slate-600" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No workflows yet</h3>
          <p className="text-slate-400 mb-4">
            Create your first workflow to automate your knowledge management
          </p>
          <Button 
            onClick={() => setIsCreating(true)}
            className="bg-gradient-to-r from-indigo-500 to-violet-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      )}

      {/* Templates */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Workflow Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              name: 'Daily Summary',
              description: 'Get AI summaries of your daily notes',
              icon: Brain,
              color: 'from-indigo-500 to-violet-600',
            },
            {
              name: 'Team Sync',
              description: 'Share new notes with your team on Slack',
              icon: Bell,
              color: 'from-emerald-500 to-teal-600',
            },
            {
              name: 'Weekly Export',
              description: 'Export your knowledge base weekly',
              icon: FileText,
              color: 'from-amber-500 to-orange-600',
            },
          ].map((template, i) => (
            <Card 
              key={i}
              className="bg-slate-900/50 border-white/10 hover:border-indigo-500/30 transition-all cursor-pointer"
              onClick={() => setIsCreating(true)}
            >
              <CardContent className="p-5">
                <div className={cn(
                  "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-3",
                  template.color
                )}>
                  <template.icon className="h-5 w-5 text-white" />
                </div>
                <h3 className="font-medium text-white mb-1">{template.name}</h3>
                <p className="text-sm text-slate-400">{template.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Create Workflow Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="bg-slate-950 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Workflow</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-indigo-400" />
              </div>
              <h3 className="text-lg font-medium text-white mb-2">Coming Soon</h3>
              <p className="text-slate-400 max-w-sm mx-auto">
                The workflow builder is being enhanced with AI capabilities. 
                Stay tuned for the full release!
              </p>
            </div>
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Got it
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
