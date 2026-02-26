import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Sparkles, 
  Brain,
  Filter,
  Clock,
  ArrowRight,
  X,
  Lightbulb,
  Quote
} from 'lucide-react';
import type { Note, SearchResult } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface SearchViewProps {
  notes: Note[];
}

export function SearchView({ notes }: SearchViewProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Simulate AI-powered semantic search
  const searchResults = useMemo<SearchResult[]>(() => {
    if (!query.trim()) return [];

    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(' ').filter(w => w.length > 2);

    return notes
      .map(note => {
        let score = 0;
        const highlights: string[] = [];

        // Title match (highest weight)
        if (note.title.toLowerCase().includes(queryLower)) {
          score += 10;
          highlights.push(`Title matches "${query}"`);
        }

        // Content match
        const contentLower = note.content.toLowerCase();
        if (contentLower.includes(queryLower)) {
          score += 5;
          const index = contentLower.indexOf(queryLower);
          const snippet = note.content.substring(Math.max(0, index - 50), index + query.length + 50);
          highlights.push(`...${snippet}...`);
        }

        // Tag match
        const matchingTags = note.tags.filter(tag => 
          tag.toLowerCase().includes(queryLower)
        );
        if (matchingTags.length > 0) {
          score += 8;
          highlights.push(`Tags: ${matchingTags.join(', ')}`);
        }

        // Semantic similarity (word overlap)
        const contentWords = contentLower.split(/\s+/);
        const wordMatches = queryWords.filter(qw => 
          contentWords.some(cw => cw.includes(qw) || qw.includes(cw))
        ).length;
        score += wordMatches * 0.5;

        // AI-generated content bonus
        if (note.type === 'ai-generated') {
          score *= 1.1;
        }

        // Confidence boost
        if (note.confidence) {
          score *= (0.9 + note.confidence * 0.2);
        }

        return { note, score, highlights };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [query, notes]);

  const filteredResults = useMemo(() => {
    if (activeFilters.length === 0) return searchResults;
    return searchResults.filter(r => 
      activeFilters.some(f => r.note.tags.includes(f))
    );
  }, [searchResults, activeFilters]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    notes.forEach(n => n.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [notes]);

  const toggleFilter = (tag: string) => {
    setActiveFilters(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => setIsSearching(false), 500);
  };

  const suggestedQueries = [
    'AI agent patterns',
    'RAG best practices',
    'Product strategy',
    'Meeting notes',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-indigo-400" />
          AI-Powered Search
        </h1>
        <p className="text-slate-400">
          Search your knowledge base with natural language understanding
        </p>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Ask anything about your knowledge base..."
          className="pl-12 pr-4 py-6 text-lg bg-slate-900/50 border-white/10 text-white placeholder:text-slate-600"
        />
        <Button 
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-indigo-500 hover:bg-indigo-600"
          onClick={handleSearch}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Search
        </Button>
      </div>

      {/* Suggested Queries */}
      {!query && (
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-slate-500 mr-2">Try:</span>
          {suggestedQueries.map(q => (
            <button
              key={q}
              onClick={() => {
                setQuery(q);
                handleSearch();
              }}
              className="text-sm px-3 py-1 bg-slate-800 text-slate-300 rounded-full hover:bg-slate-700 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      {query && (
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          <span className="text-sm text-slate-500">Filter by tag:</span>
          {allTags.slice(0, 8).map(tag => (
            <button
              key={tag}
              onClick={() => toggleFilter(tag)}
              className={`text-xs px-2 py-1 rounded-full transition-colors ${
                activeFilters.includes(tag)
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tag}
            </button>
          ))}
          {activeFilters.length > 0 && (
            <button
              onClick={() => setActiveFilters([])}
              className="text-xs text-slate-500 hover:text-white flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Results */}
      <AnimatePresence mode="wait">
        {isSearching ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-12"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              <span className="text-slate-400">Searching with AI...</span>
            </div>
          </motion.div>
        ) : query ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-slate-400">
                Found <span className="text-white font-medium">{filteredResults.length}</span> results
              </p>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-indigo-400" />
                <span className="text-sm text-indigo-400">AI-enhanced</span>
              </div>
            </div>

            {filteredResults.length === 0 ? (
              <div className="text-center py-12">
                <Lightbulb className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No results found</h3>
                <p className="text-slate-400">
                  Try different keywords or check your spelling
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredResults.map((result, index) => (
                  <motion.div
                    key={result.note.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card 
                      className="bg-slate-900/50 border-white/10 hover:border-indigo-500/30 transition-all cursor-pointer"
                      onClick={() => setSelectedNote(result.note)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium text-white group-hover:text-indigo-300">
                                {result.note.title}
                              </h3>
                              <div className="flex items-center gap-1">
                                <Brain className="h-3 w-3 text-indigo-400" />
                                <span className="text-xs text-indigo-400">
                                  {Math.round(result.score * 10)}% match
                                </span>
                              </div>
                            </div>

                            {/* Highlights */}
                            <div className="space-y-1 mb-3">
                              {result.highlights.slice(0, 2).map((highlight, i) => (
                                <p key={i} className="text-sm text-slate-400 line-clamp-1">
                                  {highlight.startsWith('...') ? (
                                    <span className="flex items-center gap-2">
                                      <Quote className="h-3 w-3 text-slate-600 flex-shrink-0" />
                                      {highlight}
                                    </span>
                                  ) : (
                                    highlight
                                  )}
                                </p>
                              ))}
                            </div>

                            <div className="flex items-center gap-2">
                              {result.note.tags.slice(0, 4).map(tag => (
                                <Badge 
                                  key={tag} 
                                  variant="secondary"
                                  className="bg-slate-800 text-slate-400 text-xs"
                                >
                                  {tag}
                                </Badge>
                              ))}
                              <span className="text-xs text-slate-600 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(result.note.updatedAt, { addSuffix: true })}
                              </span>
                            </div>
                          </div>

                          <ArrowRight className="h-5 w-5 text-slate-600 group-hover:text-indigo-400 transition-colors ml-4" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <Card className="bg-slate-900/50 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-indigo-500/20 flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-indigo-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Semantic Search</h3>
                <p className="text-slate-400 text-sm">
                  Our AI understands the meaning behind your queries, not just keywords. 
                  Search with natural language and get relevant results.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-white/10">
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-violet-500/20 flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Smart Highlights</h3>
                <p className="text-slate-400 text-sm">
                  AI automatically highlights the most relevant sections of your notes, 
                  saving you time when reviewing search results.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note Detail Modal */}
      {selectedNote && (
        <div 
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedNote(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-950 border border-white/10 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">{selectedNote.title}</h2>
                <Button variant="ghost" size="icon" onClick={() => setSelectedNote(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedNote.tags.map(tag => (
                  <Badge key={tag} className="bg-slate-800 text-slate-300">
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="prose prose-invert max-w-none">
                <p className="text-slate-300 whitespace-pre-wrap">{selectedNote.content}</p>
              </div>

              <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-sm text-slate-500">
                <span>Created {formatDistanceToNow(selectedNote.createdAt, { addSuffix: true })}</span>
                {selectedNote.confidence && (
                  <span className="text-indigo-400">
                    AI confidence: {Math.round(selectedNote.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
