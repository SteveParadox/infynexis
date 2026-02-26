import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Users, 
  Plus, 
  Edit2,
  Trash2,
  UserPlus,
  Crown,
  Shield,
  User,
  FolderOpen,
  FileText,
  Clock
} from 'lucide-react';
import type { Workspace, User as UserType } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface WorkspacesViewProps {
  workspaces: Workspace[];
  user: UserType;
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User,
};

const roleColors = {
  owner: 'text-amber-400 bg-amber-500/20',
  admin: 'text-blue-400 bg-blue-500/20',
  member: 'text-slate-400 bg-slate-500/20',
};

export function WorkspacesView({ workspaces, user }: WorkspacesViewProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });

  const handleCreateWorkspace = () => {
    if (!newWorkspace.name.trim()) return;
    // In real app, this would call an API
    setIsCreating(false);
    setNewWorkspace({ name: '', description: '' });
  };

  const handleUpdateWorkspace = () => {
    if (!editingWorkspace) return;
    setEditingWorkspace(null);
  };

  const handleDeleteWorkspace = (id: string) => {
    // In real app, this would call an API
    if (selectedWorkspace?.id === id) {
      setSelectedWorkspace(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-400" />
            Workspaces
          </h1>
          <p className="text-slate-400">
            Organize your knowledge into collaborative spaces
          </p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Workspace
        </Button>
      </div>

      {/* Workspaces Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {workspaces.map((workspace, index) => {
          const isOwner = workspace.members.some(
            m => m.userId === user.id && m.role === 'owner'
          );

          return (
            <motion.div
              key={workspace.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card 
                className="bg-slate-900/50 border-white/10 hover:border-indigo-500/30 transition-all cursor-pointer group h-full"
                onClick={() => setSelectedWorkspace(workspace)}
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                      <FolderOpen className="h-6 w-6 text-indigo-400" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingWorkspace(workspace);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {isOwner && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkspace(workspace.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <h3 className="font-semibold text-white mb-1 group-hover:text-indigo-300 transition-colors">
                    {workspace.name}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 mb-4">
                    {workspace.description}
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Users className="h-4 w-4" />
                      <span>{workspace.members.length} members</span>
                    </div>
                    <span className="text-slate-600">
                      {formatDistanceToNow(workspace.updatedAt, { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}

        {/* Create New Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: workspaces.length * 0.1 }}
        >
          <Card 
            className="bg-slate-900/30 border-dashed border-white/20 hover:border-indigo-500/30 transition-all cursor-pointer h-full"
            onClick={() => setIsCreating(true)}
          >
            <CardContent className="p-5 flex flex-col items-center justify-center h-full min-h-[200px]">
              <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-3">
                <Plus className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-slate-400 font-medium">Create New Workspace</p>
              <p className="text-sm text-slate-600 text-center mt-1">
                Start a new collaborative space
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Workspace Detail Modal */}
      {selectedWorkspace && (
        <Dialog open={!!selectedWorkspace} onOpenChange={() => setSelectedWorkspace(null)}>
          <DialogContent className="bg-slate-950 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                    <FolderOpen className="h-8 w-8 text-indigo-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-xl">{selectedWorkspace.name}</DialogTitle>
                    <p className="text-slate-400 mt-1">{selectedWorkspace.description}</p>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="mt-6 space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">{selectedWorkspace.members.length}</p>
                  <p className="text-sm text-slate-400">Members</p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">24</p>
                  <p className="text-sm text-slate-400">Notes</p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-white">156</p>
                  <p className="text-sm text-slate-400">Connections</p>
                </div>
              </div>

              {/* Members */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-indigo-400" />
                    Members
                  </h3>
                  <Button size="sm" variant="outline" className="border-slate-700">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite
                  </Button>
                </div>

                <div className="space-y-2">
                  {selectedWorkspace.members.map((member, i) => {
                    const RoleIcon = roleIcons[member.role];
                    return (
                      <div 
                        key={i}
                        className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-medium">
                            {member.userId === user.id ? user.name.charAt(0) : 'U'}
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {member.userId === user.id ? user.name : `User ${member.userId}`}
                            </p>
                            <p className="text-sm text-slate-500">
                              Joined {formatDistanceToNow(member.joinedAt, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <Badge className={roleColors[member.role]}>
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {member.role}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="text-lg font-medium text-white flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-indigo-400" />
                  Recent Activity
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <FileText className="h-5 w-5 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-sm text-white">New note created</p>
                      <p className="text-xs text-slate-500">AI Agent Architecture Patterns</p>
                    </div>
                    <span className="text-xs text-slate-600">2 hours ago</span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                    <UserPlus className="h-5 w-5 text-slate-500" />
                    <div className="flex-1">
                      <p className="text-sm text-white">New member joined</p>
                      <p className="text-xs text-slate-500">sarah@example.com</p>
                    </div>
                    <span className="text-xs text-slate-600">1 day ago</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Create Workspace Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Name</label>
              <Input
                value={newWorkspace.name}
                onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                placeholder="e.g., Product Team"
                className="bg-slate-900 border-white/10 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Description</label>
              <Textarea
                value={newWorkspace.description}
                onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                placeholder="What is this workspace for?"
                rows={3}
                className="bg-slate-900 border-white/10 text-white resize-none"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateWorkspace}
                className="bg-gradient-to-r from-indigo-500 to-violet-600"
              >
                Create Workspace
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      <Dialog open={!!editingWorkspace} onOpenChange={() => setEditingWorkspace(null)}>
        <DialogContent className="bg-slate-950 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
          </DialogHeader>
          {editingWorkspace && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Name</label>
                <Input
                  value={editingWorkspace.name}
                  onChange={(e) => setEditingWorkspace({ ...editingWorkspace, name: e.target.value })}
                  className="bg-slate-900 border-white/10 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Description</label>
                <Textarea
                  value={editingWorkspace.description}
                  onChange={(e) => setEditingWorkspace({ ...editingWorkspace, description: e.target.value })}
                  rows={3}
                  className="bg-slate-900 border-white/10 text-white resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setEditingWorkspace(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateWorkspace}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
