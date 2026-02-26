import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit2, 
  Trash2, 
  Link2,
  Sparkles,
  Brain,
  Globe,
  Mic,
  FileText,
  X,
  Check,
  Tag
} from 'lucide-react';
import type { Note, Workspace } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface NotesViewProps {
  notes: Note[];
  workspaces: Workspace[];
  selectedWorkspace: string | null;
  onNoteCreate: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onNoteUpdate: (id: string, updates: Partial<Note>) => void;
  onNoteDelete: (id: string) => void;
  onWorkspaceChange: (workspaceId: string | null) => void;
}

const noteTypeIcons = {
  note: FileText,
  'web-clip': Globe,
  document: FileText,
  voice: Mic,
  'ai-generated': Sparkles,
};

const noteTypeColors = {
  note: 'bg-slate-700',
  'web-clip': 'bg-blue-500/20 text-blue-400',
  document: 'bg-purple-500/20 text-purple-400',
  voice: 'bg-amber-500/20 text-amber-400',
  'ai-generated': 'bg-indigo-500/20 text-indigo-400',
};

export function NotesView({
  notes,
  workspaces,
  selectedWorkspace,
  onNoteCreate,
  onNoteUpdate,
  onNoteDelete,
  onWorkspaceChange,
}: NotesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [newNote, setNewNote] = useState({
    title: '',
    content: '',
    tags: [] as string[],
    workspaceId: selectedWorkspace || '',
    type: 'note' as Note['type'],
  });
  const [newTag, setNewTag] = useState('');

  const filteredNotes = notes.filter(note => {
    const matchesSearch = 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesWorkspace = !selectedWorkspace || note.workspaceId === selectedWorkspace;
    return matchesSearch && matchesWorkspace;
  });

  const handleCreateNote = () => {
    if (!newNote.title.trim()) return;
    
    onNoteCreate({
      title: newNote.title,
      content: newNote.content,
      tags: newNote.tags,
      userId: 'user-1',
      workspaceId: newNote.workspaceId || undefined,
      connections: [],
      type: newNote.type,
    });
    
    setNewNote({ title: '', content: '', tags: [], workspaceId: '', type: 'note' });
    setIsCreating(false);
  };

  const handleUpdateNote = () => {
    if (!editingNote) return;
    onNoteUpdate(editingNote.id, {
      title: editingNote.title,
      content: editingNote.content,
      tags: editingNote.tags,
    });
    setEditingNote(null);
  };

  const addTag = (isEditing: boolean) => {
    if (!newTag.trim()) return;
    
    if (isEditing && editingNote) {
      setEditingNote({
        ...editingNote,
        tags: [...editingNote.tags, newTag.trim()],
      });
    } else {
      setNewNote({
        ...newNote,
        tags: [...newNote.tags, newTag.trim()],
      });
    }
    setNewTag('');
  };

  const removeTag = (tag: string, isEditing: boolean) => {
    if (isEditing && editingNote) {
      setEditingNote({
        ...editingNote,
        tags: editingNote.tags.filter(t => t !== tag),
      });
    } else {
      setNewNote({
        ...newNote,
        tags: newNote.tags.filter(t => t !== tag),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notes</h1>
          <p className="text-slate-400">
            {filteredNotes.length} notes in your knowledge base
          </p>
        </div>
        <Button 
          onClick={() => setIsCreating(true)}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Note
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-900/50 border-white/10 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={selectedWorkspace || 'all'} onValueChange={(v) => onWorkspaceChange(v === 'all' ? null : v)}>
          <SelectTrigger className="w-full sm:w-48 bg-slate-900/50 border-white/10 text-white">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All workspaces" />
          </SelectTrigger>
          <SelectContent className="bg-slate-900 border-white/10">
            <SelectItem value="all">All workspaces</SelectItem>
            {workspaces.map(ws => (
              <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {filteredNotes.map((note, index) => {
            const Icon = noteTypeIcons[note.type];
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card 
                  className="bg-slate-900/50 border-white/10 hover:border-indigo-500/30 transition-all duration-300 cursor-pointer group h-full"
                  onClick={() => setSelectedNote(note)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center",
                        noteTypeColors[note.type]
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingNote(note);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-slate-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            onNoteDelete(note.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <h3 className="font-medium text-white mb-2 line-clamp-2 group-hover:text-indigo-300 transition-colors">
                      {note.title}
                    </h3>
                    
                    <p className="text-sm text-slate-500 line-clamp-2 mb-3">
                      {note.summary || note.content.substring(0, 100)}...
                    </p>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {note.tags.slice(0, 3).map(tag => (
                        <Badge 
                          key={tag} 
                          variant="secondary"
                          className="bg-slate-800 text-slate-400 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {note.tags.length > 3 && (
                        <Badge variant="secondary" className="bg-slate-800 text-slate-400 text-xs">
                          +{note.tags.length - 3}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-600">
                      <span>{formatDistanceToNow(note.updatedAt, { addSuffix: true })}</span>
                      {note.confidence && (
                        <div className="flex items-center gap-1">
                          <Brain className="h-3 w-3 text-indigo-400" />
                          <span className="text-indigo-400">{Math.round(note.confidence * 100)}%</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Create Note Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="bg-slate-950 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              Create New Note
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm text-slate-400 mb-2 block">Title</label>
              <Input
                value={newNote.title}
                onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                placeholder="Enter note title..."
                className="bg-slate-900 border-white/10 text-white"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Content</label>
              <Textarea
                value={newNote.content}
                onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                placeholder="Start typing..."
                rows={8}
                className="bg-slate-900 border-white/10 text-white resize-none"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Workspace</label>
              <Select 
                value={newNote.workspaceId} 
                onValueChange={(v) => setNewNote({ ...newNote, workspaceId: v })}
              >
                <SelectTrigger className="bg-slate-900 border-white/10 text-white">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10">
                  {workspaces.map(ws => (
                    <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm text-slate-400 mb-2 block">Tags</label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag..."
                  className="bg-slate-900 border-white/10 text-white"
                  onKeyDown={(e) => e.key === 'Enter' && addTag(false)}
                />
                <Button variant="outline" onClick={() => addTag(false)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {newNote.tags.map(tag => (
                  <Badge key={tag} className="bg-indigo-500/20 text-indigo-300">
                    {tag}
                    <X 
                      className="h-3 w-3 ml-1 cursor-pointer" 
                      onClick={() => removeTag(tag, false)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleCreateNote}
                className="bg-gradient-to-r from-indigo-500 to-violet-600"
              >
                <Check className="h-4 w-4 mr-2" />
                Create Note
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Note Dialog */}
      <Dialog open={!!editingNote} onOpenChange={() => setEditingNote(null)}>
        <DialogContent className="bg-slate-950 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
          </DialogHeader>
          
          {editingNote && (
            <div className="space-y-4 mt-4">
              <div>
                <label className="text-sm text-slate-400 mb-2 block">Title</label>
                <Input
                  value={editingNote.title}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  className="bg-slate-900 border-white/10 text-white"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Content</label>
                <Textarea
                  value={editingNote.content}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  rows={8}
                  className="bg-slate-900 border-white/10 text-white resize-none"
                />
              </div>

              <div>
                <label className="text-sm text-slate-400 mb-2 block">Tags</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    className="bg-slate-900 border-white/10 text-white"
                    onKeyDown={(e) => e.key === 'Enter' && addTag(true)}
                  />
                  <Button variant="outline" onClick={() => addTag(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingNote.tags.map(tag => (
                    <Badge key={tag} className="bg-indigo-500/20 text-indigo-300">
                      {tag}
                      <X 
                        className="h-3 w-3 ml-1 cursor-pointer" 
                        onClick={() => removeTag(tag, true)}
                      />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setEditingNote(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateNote}
                  className="bg-gradient-to-r from-indigo-500 to-violet-600"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* View Note Dialog */}
      <Dialog open={!!selectedNote} onOpenChange={() => setSelectedNote(null)}>
        <DialogContent className="bg-slate-950 border-white/10 text-white max-w-3xl max-h-[90vh] overflow-auto">
          {selectedNote && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={noteTypeColors[selectedNote.type]}>
                        {selectedNote.type}
                      </Badge>
                      {selectedNote.source && (
                        <Badge variant="outline" className="text-slate-400">
                          <Link2 className="h-3 w-3 mr-1" />
                          Source
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-xl">{selectedNote.title}</DialogTitle>
                  </div>
                  {selectedNote.confidence && (
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 rounded-lg">
                      <Brain className="h-4 w-4 text-indigo-400" />
                      <span className="text-sm text-indigo-400">
                        {Math.round(selectedNote.confidence * 100)}% confidence
                      </span>
                    </div>
                  )}
                </div>
              </DialogHeader>

              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap gap-2">
                  {selectedNote.tags.map(tag => (
                    <Badge key={tag} className="bg-slate-800 text-slate-300">
                      <Tag className="h-3 w-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="p-4 bg-slate-900/50 rounded-lg">
                  <p className="text-slate-300 whitespace-pre-wrap">{selectedNote.content}</p>
                </div>

                {selectedNote.summary && (
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-indigo-400" />
                      <span className="text-sm font-medium text-indigo-400">AI Summary</span>
                    </div>
                    <p className="text-sm text-slate-400">{selectedNote.summary}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Created {formatDistanceToNow(selectedNote.createdAt, { addSuffix: true })}</span>
                  <span>Updated {formatDistanceToNow(selectedNote.updatedAt, { addSuffix: true })}</span>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
