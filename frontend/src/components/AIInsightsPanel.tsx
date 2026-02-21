import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, Sparkles, Link2, TrendingUp, Lightbulb, Check, X as XIcon } from 'lucide-react';
import type { AIInsight } from '@/types';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIInsightsPanelProps {
  insights: AIInsight[];
  isOpen: boolean;
  onClose: () => void;
}

const insightIcons = {
  connection: Link2,
  trend: TrendingUp,
  suggestion: Lightbulb,
  summary: Sparkles,
};

const insightColors = {
  connection: 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  trend: 'text-green-400 bg-green-500/20 border-green-500/30',
  suggestion: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  summary: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
};

export function AIInsightsPanel({ insights, isOpen, onClose }: AIInsightsPanelProps) {
  const [dismissedInsights, setDismissedInsights] = useState<string[]>([]);
  const [acceptedInsights, setAcceptedInsights] = useState<string[]>([]);

  const handleDismiss = (id: string) => {
    setDismissedInsights(prev => [...prev, id]);
  };

  const handleAccept = (id: string) => {
    setAcceptedInsights(prev => [...prev, id]);
  };

  const visibleInsights = insights.filter(
    i => !dismissedInsights.includes(i.id) && !acceptedInsights.includes(i.id)
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 lg:hidden"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-slate-950 border-l border-white/10 z-50 flex flex-col"
          >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">AI Insights</h2>
                  <p className="text-xs text-slate-400">
                    {visibleInsights.length} new insights
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-slate-400 hover:text-white"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 p-6">
              {visibleInsights.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-slate-900 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-medium text-white mb-2">All caught up!</h3>
                  <p className="text-sm text-slate-400">
                    No new insights at the moment. Check back later.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {visibleInsights.map((insight, index) => {
                    const Icon = insightIcons[insight.type];
                    const colorClass = insightColors[insight.type];
                    
                    return (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 rounded-xl bg-slate-900/50 border border-white/10"
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                            colorClass
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-200 leading-relaxed">
                              {insight.content}
                            </p>
                            <div className="flex items-center gap-2 mt-3">
                              <span className="text-xs text-slate-500">
                                Confidence: {Math.round(insight.confidence * 100)}%
                              </span>
                              <span className="text-slate-600">•</span>
                              <span className="text-xs text-slate-500">
                                {new Date(insight.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {/* Sources */}
                            {insight.sources.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {insight.sources.map(source => (
                                  <span 
                                    key={source}
                                    className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full"
                                  >
                                    {source}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 mt-4">
                              <Button
                                size="sm"
                                className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white"
                                onClick={() => handleAccept(insight.id)}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                Apply
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 border-slate-700 text-slate-400 hover:text-white"
                                onClick={() => handleDismiss(insight.id)}
                              >
                                <XIcon className="h-4 w-4 mr-1" />
                                Dismiss
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-slate-900/50">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Powered by CogniFlow AI</span>
                <span>v2.1.0</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
