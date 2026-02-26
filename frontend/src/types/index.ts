export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
}

export interface Note {
  id: string;
  title: string;
  content: string;
  summary?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  workspaceId?: string;
  source?: string;
  confidence?: number;
  connections: string[];
  type: 'note' | 'web-clip' | 'document' | 'voice' | 'ai-generated';
}

export interface KnowledgeNode {
  id: string;
  name: string;
  val: number;
  color: string;
  category: string;
  noteIds: string[];
}

export interface KnowledgeLink {
  source: string;
  target: string;
  value: number;
  type: 'related' | 'similar' | 'references';
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  userId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

export interface SearchResult {
  note: Note;
  score: number;
  highlights: string[];
  matchedNodes?: string[];
}

export interface AIInsight {
  id: string;
  content: string;
  sources: string[];
  confidence: number;
  createdAt: Date;
  type: 'connection' | 'summary' | 'suggestion' | 'trend';
}

export interface Workflow {
  id: string;
  name: string;
  trigger: WorkflowTrigger;
  actions: WorkflowAction[];
  isActive: boolean;
  createdAt: Date;
}

export interface WorkflowTrigger {
  type: 'note-created' | 'tag-added' | 'scheduled' | 'webhook';
  config: Record<string, any>;
}

export interface WorkflowAction {
  type: 'send-notification' | 'create-task' | 'export' | 'webhook' | 'ai-summarize';
  config: Record<string, any>;
}

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  priceUnit: string;
  features: string[];
  limitations: string[];
  highlighted?: boolean;
  cta: string;
}
