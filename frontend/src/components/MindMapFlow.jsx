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

const layoutOptions = [
  ["auto", "NotebookLM Style"],
  ["radial", "Radial"],
  ["horizontal", "Horizontal"],
  ["clustered", "Knowledge Graph"],
  ["study", "Study Mode"],
  ["research", "Research Mode"],
];

const nodeTypes = { mindMapNode: MindMapNode };

function compactText(value = "", fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function getNodeTheme(type = "") {
  return nodeTypeColors[compactText(type, "Concept").toLowerCase()] || nodeTypeColors.concept;
}

function getImportance(node) {
  return Math.max(1, Math.min(100, Number(node?.importance || node?.importance_score || 50)));
}

function getNodeSize(importance, isRoot = false) {
  if (isRoot) return { width: 320, className: "min-w-[270px] max-w-[340px] px-5 py-4", titleClass: "text-lg" };
  if (importance >= 90) return { width: 290, className: "min-w-[250px] max-w-[310px] px-4 py-3.5", titleClass: "text-base" };
  if (importance >= 70) return { width: 250, className: "min-w-[220px] max-w-[280px] px-4 py-3", titleClass: "text-sm" };
  return { width: 220, className: "min-w-[190px] max-w-[240px] px-3.5 py-2.5", titleClass: "text-xs" };
}

function countNodes(node) {
  if (!node || typeof node !== "object") return 0;
  return 1 + (Array.isArray(node.children) ? node.children : []).reduce((total, child) => total + countNodes(child), 0);
}

function sortByImportance(children = []) {
  return [...children].sort((left, right) => getImportance(right) - getImportance(left));
}

function normalizeTree(node, parentId = "", index = 0, depth = 0) {
  if (!node || typeof node !== "object") return null;
  const rawId = compactText(node.id || node.title || node.label);
  const id = depth === 0 ? "root" : `${parentId || "root"}-${rawId.replace(/[^a-z0-9_-]+/gi, "-").slice(0, 40) || index}`;
  const children = (Array.isArray(node.children) ? node.children : [])
    .map((child, childIndex) => normalizeTree(child, id, childIndex, depth + 1))
    .filter(Boolean);
  return { ...node, id, children };
}

function getPromotableBranchRoot(root) {
  let current = root;
  let safety = 0;
  while (
    current
    && Array.isArray(current.children)
    && current.children.length === 1
    && Array.isArray(current.children[0]?.children)
    && current.children[0].children.length
    && safety < 5
  ) {
    current = current.children[0];
    safety += 1;
  }
  return current || root;
}

function rebalanceRootBranches(root) {
  if (!root || !Array.isArray(root.children)) return root;
  const directChildren = root.children;
  if (directChildren.length >= 3) return root;
  const branchRoot = getPromotableBranchRoot(root);
  const promotedChildren = Array.isArray(branchRoot.children) ? branchRoot.children : [];
  if (promotedChildren.length < 3) return root;
  return {
    ...root,
    summary: compactText(root.summary, branchRoot.summary),
    children: sortByImportance(promotedChildren),
    originalChainRoot: branchRoot.title || branchRoot.label || "",
  };
}

function createMoreNode(parentId, children, depth, expandedIds, options) {
  const moreId = `${parentId}-more-${depth}`;
  const isExpanded = expandedIds.has(moreId);
  const visibleChildren = isExpanded
    ? children
        .slice(0, options.childLimit)
        .map((child) => buildVisibleTree(child, expandedIds, options, depth + 1))
        .filter(Boolean)
    : [];
  const remainingCount = Math.max(0, children.length - visibleChildren.length);
  return {
    id: moreId,
    title: `More Details (${children.length})`,
    type: "Key Point",
    importance: 49,
    summary: isExpanded
      ? "Expanded lower-priority concepts. Collapse this group to return to study mode."
      : "Additional lower-priority concepts are hidden to keep the visible map readable.",
    children: visibleChildren,
    hiddenChildCount: isExpanded ? remainingCount : children.length,
    isSyntheticMoreNode: true,
  };
}

function buildVisibleTree(node, expandedIds, options, depth = 0) {
  if (!node) return null;
  const maxDepth = options.maxVisibleDepth;
  const childLimit = depth === 0 ? options.rootBranchLimit : options.childLimit;
  const importance = getImportance(node);
  const rawChildren = sortByImportance(Array.isArray(node.children) ? node.children : []);
  const nodeExpanded = expandedIds.has(node.id) || depth === 0 || options.expandAll;
  const shouldShowChildren = rawChildren.length && nodeExpanded && depth < maxDepth;

  let visibleChildren = [];
  let hiddenChildren = [];
  if (shouldShowChildren) {
    const eligibleChildren = rawChildren.filter((child) => options.showLowPriority || getImportance(child) >= options.lowPriorityThreshold || expandedIds.has(node.id));
    visibleChildren = eligibleChildren.slice(0, childLimit);
    hiddenChildren = rawChildren.filter((child) => !visibleChildren.includes(child));
  } else if (rawChildren.length && (depth >= maxDepth || !nodeExpanded || importance < options.lowPriorityThreshold)) {
    hiddenChildren = rawChildren;
  }

  const mappedChildren = visibleChildren
    .map((child) => buildVisibleTree(child, expandedIds, options, depth + 1))
    .filter(Boolean);

  if (hiddenChildren.length && depth < maxDepth) {
    mappedChildren.push(createMoreNode(node.id, hiddenChildren, depth + 1, expandedIds, options));
  }

  return { ...node, children: mappedChildren, hiddenChildCount: hiddenChildren.length };
}

function flattenVisibleTree(root) {
  const nodes = [];
  const edges = [];

  function visit(node, depth = 0, parentId = "") {
    if (!node) return;
    nodes.push({ node, depth, parentId });
    if (parentId) {
      edges.push({ source: parentId, target: node.id, node });
    }
    (Array.isArray(node.children) ? node.children : []).forEach((child) => visit(child, depth + 1, node.id));
  }

  visit(root);
  return { flatNodes: nodes, flatEdges: edges };
}

function getSubtreeSize(node) {
  if (!node || !Array.isArray(node.children) || !node.children.length) return 1;
  return 1 + node.children.reduce((total, child) => total + getSubtreeSize(child), 0);
}

function chooseLayoutMode(requestedMode, totalNodeCount, visibleNodeCount) {
  if (requestedMode === "radial" || requestedMode === "horizontal" || requestedMode === "clustered") return requestedMode;
  if (requestedMode === "study") return "radial";
  if (requestedMode === "research") return totalNodeCount > 80 ? "clustered" : "horizontal";
  if (totalNodeCount < 25 && visibleNodeCount <= 35) return "radial";
  if (visibleNodeCount <= 45) return "radial";
  if (totalNodeCount <= 80) return "horizontal";
  return "clustered";
}

function buildRadialPositions(root) {
  const positions = new Map();
  const rootChildren = Array.isArray(root.children) ? root.children : [];
  positions.set(root.id, { x: 0, y: 0 });
  const branchCount = Math.max(1, rootChildren.length);
  const baseRadius = Math.max(420, Math.min(760, 320 + branchCount * 54));

  rootChildren.forEach((branch, branchIndex) => {
    const angle = (Math.PI * 2 * branchIndex) / branchCount - Math.PI / 2;
    const branchSize = getSubtreeSize(branch);
    const radius = baseRadius + Math.min(180, branchSize * 14);
    const branchX = Math.cos(angle) * radius;
    const branchY = Math.sin(angle) * radius;
    positions.set(branch.id, { x: branchX, y: branchY });

    const children = Array.isArray(branch.children) ? branch.children : [];
    const spread = Math.min(Math.PI / 1.8, Math.max(Math.PI / 4, children.length * 0.22));
    children.forEach((child, childIndex) => {
      const offset = children.length <= 1 ? 0 : (childIndex / (children.length - 1) - 0.5) * spread;
      const childAngle = angle + offset;
      const childRadius = 300 + Math.min(140, getSubtreeSize(child) * 12);
      const childX = branchX + Math.cos(childAngle) * childRadius;
      const childY = branchY + Math.sin(childAngle) * childRadius;
      positions.set(child.id, { x: childX, y: childY });

      const grandchildren = Array.isArray(child.children) ? child.children : [];
      grandchildren.forEach((grandchild, grandchildIndex) => {
        const sideOffset = (grandchildIndex - (grandchildren.length - 1) / 2) * 150;
        positions.set(grandchild.id, {
          x: childX + Math.cos(childAngle) * 250 - Math.sin(childAngle) * sideOffset,
          y: childY + Math.sin(childAngle) * 250 + Math.cos(childAngle) * sideOffset,
        });
      });
    });
  });

  return positions;
}

function collectLevels(root) {
  const levels = new Map();
  function visit(node, depth = 0) {
    if (!levels.has(depth)) levels.set(depth, []);
    levels.get(depth).push(node);
    (Array.isArray(node.children) ? node.children : []).forEach((child) => visit(child, depth + 1));
  }
  visit(root);
  return levels;
}

function buildHorizontalPositions(root) {
  const positions = new Map();
  const levels = collectLevels(root);
  const levelGap = 390;
  const rowGap = 150;
  const sortedDepths = [...levels.keys()].sort((left, right) => left - right);

  sortedDepths.forEach((depth) => {
    const levelNodes = levels.get(depth) || [];
    const totalHeight = (levelNodes.length - 1) * rowGap;
    levelNodes.forEach((node, index) => {
      const parentBias = depth > 1 ? Math.sin(index * 0.95) * 34 : 0;
      positions.set(node.id, {
        x: depth * levelGap,
        y: index * rowGap - totalHeight / 2 + parentBias,
      });
    });
  });

  positions.set(root.id, { x: 0, y: 0 });
  return positions;
}

function buildClusteredPositions(root) {
  const positions = new Map();
  const rootChildren = Array.isArray(root.children) ? root.children : [];
  positions.set(root.id, { x: 0, y: 0 });
  const clusterCount = Math.max(1, rootChildren.length);
  const clusterRadius = Math.max(560, Math.min(980, 460 + clusterCount * 42));

  rootChildren.forEach((cluster, clusterIndex) => {
    const angle = (Math.PI * 2 * clusterIndex) / clusterCount - Math.PI / 2;
    const centerX = Math.cos(angle) * clusterRadius;
    const centerY = Math.sin(angle) * clusterRadius;
    positions.set(cluster.id, { x: centerX, y: centerY });
    const descendants = Array.isArray(cluster.children) ? cluster.children : [];
    const columns = Math.max(1, Math.ceil(Math.sqrt(descendants.length)));
    descendants.forEach((child, childIndex) => {
      const column = childIndex % columns;
      const row = Math.floor(childIndex / columns);
      positions.set(child.id, {
        x: centerX + (column - (columns - 1) / 2) * 270,
        y: centerY + 240 + row * 140,
      });
      (Array.isArray(child.children) ? child.children : []).forEach((grandchild, grandchildIndex) => {
        positions.set(grandchild.id, {
          x: centerX + (column - (columns - 1) / 2) * 270 + 90,
          y: centerY + 400 + row * 140 + grandchildIndex * 95,
        });
      });
    });
  });

  return positions;
}

function getProgressiveOptions(mode) {
  const researchMode = mode === "research";
  return {
    rootBranchLimit: researchMode ? 8 : 8,
    childLimit: researchMode ? 8 : 6,
    maxVisibleDepth: researchMode ? 4 : 3,
    lowPriorityThreshold: researchMode ? 35 : 50,
    showLowPriority: researchMode,
    expandAll: false,
  };
}

function buildFlowElements(root, expandedIds, onToggle, requestedLayoutMode) {
  const normalizedRoot = normalizeTree(root);
  if (!normalizedRoot) return { nodes: [], edges: [], layoutMode: "radial", visibleCount: 0, totalCount: 0 };
  const balancedRoot = rebalanceRootBranches(normalizedRoot);
  const totalCount = countNodes(normalizedRoot);
  const progressiveOptions = getProgressiveOptions(requestedLayoutMode);
  const visibleRoot = buildVisibleTree(balancedRoot, expandedIds, progressiveOptions);
  const { flatNodes, flatEdges } = flattenVisibleTree(visibleRoot);
  const layoutMode = chooseLayoutMode(requestedLayoutMode, totalCount, flatNodes.length);
  const positions = layoutMode === "radial"
    ? buildRadialPositions(visibleRoot)
    : layoutMode === "horizontal"
      ? buildHorizontalPositions(visibleRoot)
      : buildClusteredPositions(visibleRoot);

  const nodes = flatNodes.map(({ node, depth }) => {
    const importance = getImportance(node);
    const isRoot = node.id === "root";
    const size = getNodeSize(importance, isRoot);
    const position = positions.get(node.id) || { x: depth * 360, y: 0 };
    const hasChildren = Boolean((Array.isArray(node.children) && node.children.length) || node.hiddenChildCount);
    return {
      id: node.id,
      type: "mindMapNode",
      position,
      data: {
        node,
        hasChildren,
        isCollapsed: hasChildren && !expandedIds.has(node.id) && !isRoot,
        onToggle,
        size,
        layoutMode,
      },
    };
  });

  const edges = flatEdges.map(({ source, target, node }) => {
    const theme = getNodeTheme(node.type);
    const importance = getImportance(node);
    return {
      id: `${source}-${target}`,
      source,
      target,
      animated: importance >= 90,
      type: layoutMode === "horizontal" ? "smoothstep" : "default",
      style: { stroke: theme.border, strokeWidth: importance >= 85 ? 2.8 : 1.9 },
    };
  });

  return { nodes, edges, layoutMode, visibleCount: nodes.length, totalCount };
}

function MindMapNode({ data }) {
  const node = data.node || {};
  const theme = getNodeTheme(node.type);
  const importance = getImportance(node);
  const isRoot = node.id === "root";
  const size = data.size || getNodeSize(importance, isRoot);
  const targetPosition = data.layoutMode === "horizontal" ? Position.Left : Position.Top;
  const sourcePosition = data.layoutMode === "horizontal" ? Position.Right : Position.Bottom;

  return (
    <div
      className={`mind-map-node rounded-[18px] border-2 shadow-[0_12px_28px_rgba(15,23,42,0.14)] ${size.className}`}
      style={{ borderColor: theme.border, background: theme.background, color: "#111827", width: size.width }}
    >
      <Handle type="target" position={targetPosition} className="!h-3 !w-3 !border-2 !bg-white" style={{ borderColor: theme.border }} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: theme.accent }}>{compactText(node.type, isRoot ? "Main Topic" : "Concept")}</p>
          <p className={`${size.titleClass} mt-1 font-bold leading-snug text-slate-950`}>{node.title || node.label || "Mind map node"}</p>
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
        {node.hiddenChildCount ? <span className="text-[10px] font-semibold text-slate-500">+{node.hiddenChildCount} hidden</span> : null}
        {node.source_location ? <span className="truncate text-[10px] font-semibold text-slate-500">{node.source_location}</span> : null}
      </div>
      <Handle type="source" position={sourcePosition} className="!h-3 !w-3 !border-2 !bg-white" style={{ borderColor: theme.border }} />
    </div>
  );
}

export default function MindMapFlow({ root, onSelectNode }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [layoutMode, setLayoutMode] = useState("auto");

  useEffect(() => {
    setExpandedIds(new Set());
    setLayoutMode("auto");
  }, [root]);

  const handleToggle = useCallback((nodeId) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const flowElements = useMemo(
    () => buildFlowElements(root, expandedIds, handleToggle, layoutMode),
    [root, expandedIds, handleToggle, layoutMode],
  );
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
      <div className="relative h-[680px] min-h-[560px] overflow-hidden rounded-[24px] border border-slate-200 bg-white">
        <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2 rounded-full border border-slate-200 bg-white/92 px-3 py-2 shadow-[0_10px_28px_rgba(15,23,42,0.12)] backdrop-blur">
          {layoutOptions.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLayoutMode(value)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${layoutMode === value ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
            >
              {label}
            </button>
          ))}
          <span className="px-2 text-[11px] font-semibold text-slate-500">
            {flowElements.visibleCount}/{flowElements.totalCount} visible · {flowElements.layoutMode}
          </span>
        </div>
        <ReactFlow
          key={`${flowElements.layoutMode}-${nodes.length}-${edges.length}`}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => onSelectNode?.(node.data?.node || null)}
          fitView
          fitViewOptions={{ padding: 0.28, duration: 800, includeHiddenNodes: false }}
          minZoom={0.08}
          maxZoom={2.8}
          zoomOnScroll
          zoomOnPinch
          panOnDrag
          panOnScroll
          panOnScrollSpeed={0.75}
          elevateNodesOnSelect
          onlyRenderVisibleElements
          nodesDraggable
          proOptions={{ hideAttribution: true }}
          className="mind-map-flow"
        >
          <Background color="#d1d5db" gap={24} />
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
