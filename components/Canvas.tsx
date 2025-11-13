import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeData } from '../types';
import Node from './Node';
import { ZoomInIcon, ZoomOutIcon, FitToScreenIcon } from './Icons';

interface CanvasProps {
  nodes: NodeData[];
  onNodeAction: (sourceNode: NodeData, action: any, prompt?: string) => void;
  onNodeDrag: (id: string, x: number, y: number) => void;
}

const NODE_WIDTH = 384; // 96 * 4 (tailwind w-96)

// NEW: Implemented a 4-anchor point system for cleaner connections.
const calculateSynapsePoints = (from: NodeData, to: NodeData, fromEl: HTMLElement | null, toEl: HTMLElement | null) => {
    if (!fromEl || !toEl) {
        // Fallback for when elements are not rendered yet
        return { start: { x: from.x, y: from.y }, end: { x: to.x, y: to.y } };
    }

    const fromHeight = fromEl.clientHeight;
    const toHeight = toEl.clientHeight;

    const fromAnchors = [
        { x: from.x + NODE_WIDTH / 2, y: from.y }, // Top
        { x: from.x + NODE_WIDTH / 2, y: from.y + fromHeight }, // Bottom
        { x: from.x, y: from.y + fromHeight / 2 }, // Left
        { x: from.x + NODE_WIDTH, y: from.y + fromHeight / 2 }, // Right
    ];

    const toAnchors = [
        { x: to.x + NODE_WIDTH / 2, y: to.y }, // Top
        { x: to.x + NODE_WIDTH / 2, y: to.y + toHeight }, // Bottom
        { x: to.x, y: to.y + toHeight / 2 }, // Left
        { x: to.x + NODE_WIDTH, y: to.y + toHeight / 2 }, // Right
    ];

    let minDistance = Infinity;
    let bestPair = { start: fromAnchors[0], end: toAnchors[0] };

    for (const fromPoint of fromAnchors) {
        for (const toPoint of toAnchors) {
            const distance = Math.sqrt(Math.pow(fromPoint.x - toPoint.x, 2) + Math.pow(fromPoint.y - toPoint.y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                bestPair = { start: fromPoint, end: toPoint };
            }
        }
    }
    return bestPair;
};


const Synapse: React.FC<{ from: NodeData, to: NodeData, fromEl: HTMLElement | null, toEl: HTMLElement | null }> = ({ from, to, fromEl, toEl }) => {
    const { start, end } = calculateSynapsePoints(from, to, fromEl, toEl);

    const controlPointX1 = start.x + (end.x - start.x) * 0.3;
    const controlPointY1 = start.y;
    const controlPointX2 = end.x - (end.x - start.x) * 0.3;
    const controlPointY2 = end.y;

    const pathData = `M ${start.x} ${start.y} C ${controlPointX1} ${controlPointY1}, ${controlPointX2} ${controlPointY2}, ${end.x} ${end.y}`;

    return (
        <path
            d={pathData}
            stroke="url(#synapse-gradient)"
            strokeWidth="2"
            fill="none"
            className="synapse-path"
        />
    );
};

const CanvasControls: React.FC<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
    scale: number;
}> = ({ zoomIn, zoomOut, resetView, scale }) => {
    return (
        // REFACTORED: Changed to vertical layout on the right side of the screen to avoid conflict with input bar.
        <div className="absolute top-1/2 -translate-y-1/2 right-4 z-10 flex flex-col items-center gap-2 bg-black/50 backdrop-blur-md p-2 rounded-lg border border-cyan-500/30">
            <button onClick={zoomIn} className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-700/50 rounded-md transition-colors"><ZoomInIcon className="w-5 h-5" /></button>
            <span className="text-sm font-semibold text-cyan-300 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={zoomOut} className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-700/50 rounded-md transition-colors"><ZoomOutIcon className="w-5 h-5" /></button>
            <div className="h-px w-8 bg-cyan-500/30 my-1"></div>
            <button onClick={resetView} className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-700/50 rounded-md transition-colors"><FitToScreenIcon className="w-5 h-5" /></button>
        </div>
    );
};


const Canvas: React.FC<CanvasProps> = ({ nodes, onNodeAction, onNodeDrag }) => {
  const [transform, setTransform] = useState({ x: window.innerWidth / 4, y: window.innerHeight / 8, scale: 0.8 });
  const isPanning = useRef(false);
  const lastMousePosition = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeElements = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    // Cache node elements for performance
    const newElements: Record<string, HTMLElement | null> = {};
    for (const node of nodes) {
        newElements[node.id] = document.querySelector(`[data-node-id="${node.id}"]`);
    }
    nodeElements.current = newElements;
  }, [nodes]);


  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== canvasRef.current || e.button !== 0) return;
    isPanning.current = true;
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
    canvasRef.current!.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - lastMousePosition.current.x;
    const dy = e.clientY - lastMousePosition.current.y;
    setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    lastMousePosition.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    setTransform(prev => {
        const newScale = Math.min(Math.max(0.1, prev.scale + scaleAmount), 3);
        return { ...prev, scale: newScale };
    });
  }, []);

  const handleZoomIn = () => setTransform(prev => ({...prev, scale: Math.min(prev.scale * 1.2, 3)}));
  const handleZoomOut = () => setTransform(prev => ({...prev, scale: Math.max(prev.scale * 0.8, 0.1)}));
  
  const handleResetView = useCallback(() => {
    if (nodes.length === 0 || !canvasRef.current) {
        setTransform({ x: 0, y: 0, scale: 1 });
        return;
    }
    const PADDING = 100;
    const { clientWidth: viewportWidth, clientHeight: viewportHeight } = canvasRef.current;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        const el = nodeElements.current[node.id];
        const height = el ? el.clientHeight : 200; // Fallback height
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x + NODE_WIDTH);
        maxY = Math.max(maxY, node.y + height);
    });
    
    const bbWidth = maxX - minX;
    const bbHeight = maxY - minY;

    if (bbWidth === 0 || bbHeight === 0) {
        const scale = 1;
        const x = viewportWidth / 2 - (minX + NODE_WIDTH / 2) * scale;
        const y = viewportHeight / 2 - (minY + 100) * scale;
        setTransform({ x, y, scale });
        return;
    }

    const scaleX = (viewportWidth - PADDING * 2) / bbWidth;
    const scaleY = (viewportHeight - PADDING * 2) / bbHeight;
    const scale = Math.min(scaleX, scaleY, 1.5);

    const newX = (viewportWidth - bbWidth * scale) / 2 - minX * scale;
    const newY = (viewportHeight - bbHeight * scale) / 2 - minY * scale;

    setTransform({ x: newX, y: newY, scale });
  }, [nodes]);

  
  const nodesById = React.useMemo(() => 
    nodes.reduce((acc, node) => {
        acc[node.id] = node;
        return acc;
    }, {} as Record<string, NodeData>), 
  [nodes]);

  return (
    <div
      ref={canvasRef}
      className="flex-1 w-full h-full overflow-hidden relative cursor-grab neural-canvas-bg"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div
        className="absolute top-0 left-0"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: 'top left' }}
      >
        <svg className="absolute top-0 left-0" style={{ width: '100vw', height: '100vh', pointerEvents: 'none', transform: `scale(${1/transform.scale}) translate(${-transform.x}px, ${-transform.y}px)` }}>
           <defs>
                <linearGradient id="synapse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" style={{stopColor: 'rgb(107, 33, 168, 0.7)'}} />
                    <stop offset="100%" style={{stopColor: 'rgb(8, 145, 178, 0.7)'}} />
                </linearGradient>
            </defs>
            <style>{`
                .synapse-path {
                    stroke-dasharray: 1000;
                    stroke-dashoffset: 1000;
                    animation: dash 5s linear forwards infinite;
                }
                @keyframes dash {
                    to {
                        stroke-dashoffset: 0;
                    }
                }
            `}</style>
          <g style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}>
            {nodes.map(node => {
                if (node.parentId && nodesById[node.parentId]) {
                    const fromEl = nodeElements.current[node.parentId];
                    const toEl = nodeElements.current[node.id];
                    return <Synapse key={`${node.parentId}-${node.id}`} from={nodesById[node.parentId]} to={node} fromEl={fromEl} toEl={toEl} />;
                }
                return null;
            })}
          </g>
        </svg>

        {nodes.map((node) => (
          <Node key={node.id} node={node} onAction={onNodeAction} onDrag={onNodeDrag} canvasTransform={transform} />
        ))}
      </div>
      <CanvasControls zoomIn={handleZoomIn} zoomOut={handleZoomOut} resetView={handleResetView} scale={transform.scale} />
    </div>
  );
};

export default Canvas;