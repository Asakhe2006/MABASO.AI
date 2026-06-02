import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const nodeTypeColors = {
  "main topic": { border: "#111827", background: "#ffffff", accent: "#111827" },
  concept: { border: "#2563eb", background: "#eff6ff", accent: "#1d4ed8" },
  definition: { border: "#059669", background: "#ecfdf5", accent: "#047857" },
  formula: { border: "#7c3aed", background: "#f5f3ff", accent: "#6d28d9" },
  process: { border: "#d97706", background: "#fffbeb", accent: "#b45309" },
  example: { border: "#0891b2", background: "#ecfeff", accent: "#0e7490" },
  application: { border: "#0f766e", background: "#f0fdfa", accent: "#0f766e" },
  principle: { border: "#4338ca", background: "#eef2ff", accent: "#3730a3" },
  warning: { border: "#dc2626", background: "#fef2f2", accent: "#b91c1c" },
  "key point": { border: "#475569", background: "#f8fafc", accent: "#334155" },
};

function compactText(value = "", fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getNodeTheme(type = "") {
  return nodeTypeColors[compactText(type, "Concept").toLowerCase()] || nodeTypeColors.concept;
}

function MindMapNode({ data }) {
  const node = data.node || {};
  const theme = getNodeTheme(node.type);
  const importance = Math.max(1, Math.min(100, Number(node.importance || node.importance_score || 50)));
  const isRoot = node.id === "root";

  return (
    <div
      className="mind-map-node min-w-[210px] max-w-[280px] rounded-[18px] border-2 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.14)]"
      style={{ borderColor: theme.border, background: theme.background, color: "#111827" }}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !bg-white" style={{ borderColor: theme.border }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>{compactText(node.type, isRoot ? "Main Topic" : "Concept")}</p>
          <p className={`${isRoot ? "text-base" : "text-sm"} mt-1 font-bold leading-snug text-slate-950`}>{node.title || node.label || "Mind map node"}</p>
        </div>
        {data.hasChildren ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              data.onToggle?.(node.id);
            }}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-800"
            title={data.isCollapsed ? "Expand node" : "Collapse node"}
          >
            {data.isCollapsed ? "+" : "-"}
          </button>
        ) : null}
      </div>
      {node.summary ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-700">{node.summary}</p> : null}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-700">Score {importance}</span>
        {node.source_location ? <span className="truncate text-[10px] font-semibold text-slate-500">{node.source_location}</span> : null}
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !bg-white" style={{ borderColor: theme.border }} />
    </div>
  );
}

const nodeTypes = { mindMapNode: MindMapNode };

function countVisibleLeaves(node, collapsedIds) {
  const children = Array.isArray(node?.children) ? node.children : [];
  if (!children.length || collapsedIds.has(node.id)) return 1;
  return children.reduce((total, child) => total + countVisibleLeaves(child, collapsedIds), 0);
}

function buildFlowElements(root, collapsedIds, onToggle) {
  if (!root || typeof root !== "object") return { nodes: [], edges: [] };
  const nodes = [];
  const edges = [];
  const levelGap = 340;
  const rowGap = 150;
  let nextLeaf = 0;

  function visit(node, depth = 0, parentId = "") {
    const nodeId = compactText(node.id, depth === 0 ? "root" : `${parentId}-${nodes.length}`);
    const children = Array.isArray(node.children) ? node.children : [];
    const isCollapsed = collapsedIds.has(nodeId);
    const leafCount = countVisibleLeaves({ ...node, id: nodeId }, collapsedIds);
    const startLeaf = nextLeaf;
    if (!children.length || isCollapsed) {
      nextLeaf += 1;
    } else {
      children.forEach((child) => visit(child, depth + 1, nodeId));
    }
    const endLeaf = nextLeaf - 1;
    const centerLeaf = children.length && !isCollapsed ? (startLeaf + endLeaf) / 2 : startLeaf;
    const importance = Math.max(1, Math.min(100, Number(node.importance || node.importance_score || 50)));
    nodes.push({
      id: nodeId,
      type: "mindMapNode",
      position: {
        x: depth * levelGap - Math.max(0, importance - 85),
        y: centerLeaf * rowGap - (leafCount > 1 ? 0 : 0),
      },
      data: {
        node: { ...node, id: nodeId },
        hasChildren: Boolean(children.length),
        isCollapsed,
        onToggle,
      },
    });
    if (parentId) {
      const theme = getNodeTheme(node.type);
      edges.push({
        id: `${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        animated: importance >= 85,
        type: "smoothstep",
        style: { stroke: theme.border, strokeWidth: importance >= 85 ? 2.6 : 1.8 },
      });
    }
  }

  visit(root);
  return { nodes, edges };
}

export default function MindMapFlow({ root, onSelectNode }) {
  const [collapsedIds, setCollapsedIds] = useState(() => new Set());
  const handleToggle = useCallback((nodeId) => {
    setCollapsedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);
  const flowElements = useMemo(() => buildFlowElements(root, collapsedIds, handleToggle), [root, collapsedIds]);
  const [nodes, setNodes, onNodesChange] = useNodesState(flowElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowElements.edges);

  useEffect(() => {
    setNodes(flowElements.nodes);
    setEdges(flowElements.edges);
  }, [flowElements, setEdges, setNodes]);

  if (!root || !Object.keys(root).length) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-[24px] border border-dashed border-slate-300 bg-white text-center text-sm leading-7 text-slate-600">
        Generate a mind map to render the knowledge graph.
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <div className="h-[640px] min-h-[520px] overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => onSelectNode?.(node.data?.node || null)}
          fitView
          fitViewOptions={{ padding: 0.18, duration: 650 }}
          minZoom={0.12}
          maxZoom={2.4}
          zoomOnScroll
          zoomOnPinch
          panOnDrag
          panOnScroll
          panOnScrollSpeed={0.85}
          elevateNodesOnSelect
          onlyRenderVisibleElements
          nodesDraggable
          proOptions={{ hideAttribution: true }}
          className="mind-map-flow"
        >
          <Background color="#d1d5db" gap={22} />
          <Controls showInteractive />
          <MiniMap
            nodeColor={(node) => getNodeTheme(node.data?.node?.type).border}
            maskColor="rgba(15,23,42,0.08)"
            pannable
            zoomable
          />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  );
}
