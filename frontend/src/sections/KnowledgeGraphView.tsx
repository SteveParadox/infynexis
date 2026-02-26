import { useState, useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Share2,
  Search,
  X
} from 'lucide-react';
import type { Note, KnowledgeNode } from '@/types';
import { generateKnowledgeGraph } from '@/lib/mockData';

interface KnowledgeGraphViewProps {
  notes: Note[];
}

export function KnowledgeGraphView({ notes }: KnowledgeGraphViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const { nodes, links } = useMemo(() => generateKnowledgeGraph(notes), [notes]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    return nodes.filter(n => 
      n.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [nodes, searchQuery]);

  const filteredLinks = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(n => n.id));
    return links.filter(l => 
      nodeIds.has(l.source as string) && nodeIds.has(l.target as string)
    );
  }, [links, filteredNodes]);

  // Simple force-directed layout simulation
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const width = 800;
    const height = 600;
    const newPositions = new Map<string, { x: number; y: number }>();
    
    // Initialize random positions
    filteredNodes.forEach((node, i) => {
      const angle = (i / filteredNodes.length) * 2 * Math.PI;
      const radius = Math.min(width, height) * 0.35;
      newPositions.set(node.id, {
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      });
    });

    // Simple force simulation
    for (let iteration = 0; iteration < 50; iteration++) {
      // Repulsion
      filteredNodes.forEach((node1, i) => {
        const pos1 = newPositions.get(node1.id)!;
        let fx = 0, fy = 0;
        
        filteredNodes.forEach((node2, j) => {
          if (i === j) return;
          const pos2 = newPositions.get(node2.id)!;
          const dx = pos1.x - pos2.x;
          const dy = pos1.y - pos2.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = 2000 / (dist * dist);
          fx += (dx / dist) * force;
          fy += (dy / dist) * force;
        });

        pos1.x += fx * 0.1;
        pos1.y += fy * 0.1;
      });

      // Attraction along links
      filteredLinks.forEach(link => {
        const sourcePos = newPositions.get(link.source as string);
        const targetPos = newPositions.get(link.target as string);
        if (!sourcePos || !targetPos) return;

        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (dist - 100) * 0.01;
        
        sourcePos.x += (dx / dist) * force;
        sourcePos.y += (dy / dist) * force;
        targetPos.x -= (dx / dist) * force;
        targetPos.y -= (dy / dist) * force;
      });

      // Center gravity
      filteredNodes.forEach(node => {
        const pos = newPositions.get(node.id)!;
        pos.x += (width / 2 - pos.x) * 0.05;
        pos.y += (height / 2 - pos.y) * 0.05;
      });
    }

    setPositions(newPositions);
  }, [filteredNodes, filteredLinks]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === svgRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const connectedNotes = useMemo(() => {
    if (!selectedNode) return [];
    return notes.filter(n => selectedNode.noteIds.includes(n.id));
  }, [selectedNode, notes]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Share2 className="h-6 w-6 text-indigo-400" />
            Knowledge Graph
          </h1>
          <p className="text-slate-400">
            Visualize connections between your notes and concepts
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Find concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-48 bg-slate-900/50 border-white/10 text-white"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{nodes.length}</p>
            <p className="text-sm text-slate-400">Knowledge Nodes</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{links.length}</p>
            <p className="text-sm text-slate-400">Connections</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">{notes.length}</p>
            <p className="text-sm text-slate-400">Notes</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/50 border-white/10">
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-white">
              {new Set(notes.flatMap(n => n.tags)).size}
            </p>
            <p className="text-sm text-slate-400">Unique Tags</p>
          </CardContent>
        </Card>
      </div>

      {/* Graph Container */}
      <div className="relative bg-slate-950 rounded-xl border border-white/10 overflow-hidden" style={{ height: '600px' }}>
        {/* Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <Button variant="outline" size="icon" onClick={handleZoomIn} className="bg-slate-900/80 border-white/10">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleZoomOut} className="bg-slate-900/80 border-white/10">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleReset} className="bg-slate-900/80 border-white/10">
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-slate-900/90 backdrop-blur rounded-lg p-4 border border-white/10">
          <p className="text-sm font-medium text-white mb-2">Legend</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-slate-400" />
              <span className="text-slate-400">Note</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-indigo-500" />
              <span className="text-slate-400">AI/ML</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Database</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500" />
              <span className="text-slate-400">Business</span>
            </div>
          </div>
        </div>

        {/* SVG Graph */}
        <svg
          ref={svgRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
            {/* Links */}
            {filteredLinks.map((link, i) => {
              const sourcePos = positions.get(link.source as string);
              const targetPos = positions.get(link.target as string);
              if (!sourcePos || !targetPos) return null;

              const isHighlighted = hoveredNode && 
                (link.source === hoveredNode || link.target === hoveredNode);

              return (
                <line
                  key={i}
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke={isHighlighted ? '#6366f1' : '#334155'}
                  strokeWidth={isHighlighted ? 2 : 1}
                  opacity={hoveredNode && !isHighlighted ? 0.2 : 0.6}
                />
              );
            })}

            {/* Nodes */}
            {filteredNodes.map((node) => {
              const pos = positions.get(node.id);
              if (!pos) return null;

              const isHovered = hoveredNode === node.id;
              const isSelected = selectedNode?.id === node.id;
              const isNote = node.category === 'note';

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x}, ${pos.y})`}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  onClick={() => setSelectedNode(node)}
                  className="cursor-pointer"
                >
                  <circle
                    r={(node.val || 10) + (isHovered ? 3 : 0)}
                    fill={node.color}
                    stroke={isSelected ? '#fff' : 'transparent'}
                    strokeWidth={isSelected ? 3 : 0}
                    opacity={hoveredNode && !isHovered ? 0.3 : 1}
                  />
                  {!isNote && (
                    <text
                      dy={node.val + 15}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize={10}
                      style={{ pointerEvents: 'none' }}
                    >
                      {node.name}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Selected Node Panel */}
      {selectedNode && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900/50 border border-white/10 rounded-xl p-6"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div 
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: selectedNode.color }}
                />
                <h3 className="text-lg font-semibold text-white">{selectedNode.name}</h3>
                <Badge variant="secondary" className="bg-slate-800">
                  {selectedNode.noteIds.length} notes
                </Badge>
              </div>
              <p className="text-slate-400">
                {selectedNode.category === 'note' 
                  ? 'This is a note in your knowledge base' 
                  : `Knowledge category: ${selectedNode.category}`}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSelectedNode(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {connectedNotes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-white mb-2">Connected Notes</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {connectedNotes.slice(0, 4).map(note => (
                  <div 
                    key={note.id}
                    className="p-3 bg-slate-950/50 rounded-lg border border-white/5"
                  >
                    <p className="text-sm text-white truncate">{note.title}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {note.tags.slice(0, 3).join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
