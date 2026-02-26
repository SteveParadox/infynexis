import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  FileText, 
  Share2, 
  Sparkles, 
  TrendingUp, 
  Clock,
  ArrowRight,
  Zap,
  Users,
  Brain
} from 'lucide-react';
import type { User, Note, AIInsight, Workspace } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface DashboardProps {
  user: User;
  notes: Note[];
  insights: AIInsight[];
  workspaces: Workspace[];
  onCreateNote: () => void;
  onViewGraph: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1] as const,
    },
  },
};

export function Dashboard({ 
  user, 
  notes, 
  insights, 
  workspaces,
  onCreateNote,
  onViewGraph 
}: DashboardProps) {
  const recentNotes = notes.slice(0, 5);
  const totalTags = new Set(notes.flatMap(n => n.tags)).size;

  const stats = [
    { 
      label: 'Total Notes', 
      value: notes.length, 
      icon: FileText, 
      change: '+12%',
      color: 'from-blue-500 to-cyan-500'
    },
    { 
      label: 'Knowledge Nodes', 
      value: totalTags, 
      icon: Share2, 
      change: '+8%',
      color: 'from-violet-500 to-purple-500'
    },
    { 
      label: 'AI Insights', 
      value: insights.length, 
      icon: Sparkles, 
      change: '+24%',
      color: 'from-amber-500 to-orange-500'
    },
    { 
      label: 'Workspaces', 
      value: workspaces.length, 
      icon: Users, 
      change: '+1',
      color: 'from-emerald-500 to-teal-500'
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-8"
    >
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-white">
            Welcome back, {user.name.split(' ')[0]}
          </h1>
          <span className="px-3 py-1 text-xs font-medium bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
            {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}
          </span>
        </div>
        <p className="text-slate-400">
          Your knowledge base has grown by <span className="text-emerald-400 font-medium">12%</span> this week. 
          Here&apos;s what&apos;s happening.
        </p>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <Button 
          onClick={onCreateNote}
          className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white"
        >
          <FileText className="h-4 w-4 mr-2" />
          Create Note
        </Button>
        <Button 
          variant="outline" 
          onClick={onViewGraph}
          className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <Share2 className="h-4 w-4 mr-2" />
          Explore Graph
        </Button>
        <Button 
          variant="outline"
          className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
        >
          <Zap className="h-4 w-4 mr-2" />
          Run Workflow
        </Button>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card 
                key={stat.label}
                className="bg-slate-900/50 border-white/10 hover:border-white/20 transition-all duration-300 group"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-slate-400">{stat.label}</p>
                      <p className="text-3xl font-bold text-white mt-2">{stat.value}</p>
                    </div>
                    <div className={cn(
                      "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center",
                      stat.color
                    )}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-4">
                    <TrendingUp className="h-3 w-3 text-emerald-400" />
                    <span className="text-xs text-emerald-400">{stat.change}</span>
                    <span className="text-xs text-slate-500 ml-1">vs last month</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Notes */}
        <motion.div variants={itemVariants} className="lg:col-span-2">
          <Card className="bg-slate-900/50 border-white/10 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-400" />
                Recent Notes
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-indigo-400 hover:text-indigo-300">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentNotes.map((note, index) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="group p-4 rounded-lg bg-slate-950/50 border border-white/5 hover:border-indigo-500/30 transition-all duration-200 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors truncate">
                          {note.title}
                        </h3>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {note.summary || note.content.substring(0, 100)}...
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {note.tags.slice(0, 3).map(tag => (
                            <span 
                              key={tag}
                              className="text-xs px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          <span className="text-xs text-slate-600">
                            {formatDistanceToNow(note.updatedAt, { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                      {note.confidence && (
                        <div className="flex items-center gap-1 ml-4">
                          <Brain className="h-3 w-3 text-indigo-400" />
                          <span className="text-xs text-indigo-400">
                            {Math.round(note.confidence * 100)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* AI Insights Preview */}
        <motion.div variants={itemVariants}>
          <Card className="bg-slate-900/50 border-white/10 h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-400" />
                AI Insights
              </CardTitle>
              <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full">
                {insights.length} new
              </span>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {insights.slice(0, 3).map((insight) => (
                  <div
                    key={insight.id}
                    className="p-3 rounded-lg bg-slate-950/50 border border-white/5 hover:border-amber-500/30 transition-all duration-200"
                  >
                    <p className="text-sm text-slate-300 line-clamp-3">
                      {insight.content}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-slate-500 capitalize">
                        {insight.type}
                      </span>
                      <span className="text-xs text-slate-600">
                        {Math.round(insight.confidence * 100)}% confidence
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4 border-slate-700 text-slate-400 hover:text-white"
              >
                View all insights
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Knowledge Activity */}
      <motion.div variants={itemVariants}>
        <Card className="bg-slate-900/50 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              Knowledge Growth
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-32 gap-2">
              {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 100].map((height, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-indigo-500/50 to-violet-500/50 rounded-t-sm hover:from-indigo-500 hover:to-violet-500 transition-all duration-300 cursor-pointer"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between mt-4 text-xs text-slate-500">
              <span>Jan</span>
              <span>Feb</span>
              <span>Mar</span>
              <span>Apr</span>
              <span>May</span>
              <span>Jun</span>
              <span>Jul</span>
              <span>Aug</span>
              <span>Sep</span>
              <span>Oct</span>
              <span>Nov</span>
              <span>Dec</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// Helper function for className
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ');
}
