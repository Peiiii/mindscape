import React, { useState, useRef, useCallback, useEffect } from 'react';
import { NodeData } from '../types';
import Node from './Node';
import { ZoomInIcon, ZoomOutIcon, FitToScreenIcon } from './Icons';
import { useCanvasStore } from '../stores/canvasStore';

interface CanvasProps {}

const NODE_WIDTH = 384; // 96 * 4 (tailwind w-96)

const CanvasControls: React.FC<{
    zoomIn: () => void;
    zoomOut: () => void;
    resetView: () => void;
    scale: number;
}> = ({ zoomIn, zoomOut, resetView, scale }) => {
    return (
        <div className="absolute top-1/2 -translate-y-1/2 right-4 z-10 flex flex-col items-center gap-2 bg-black/50 backdrop-blur-md p-2 rounded-lg border border-cyan-500/30">
            <button onClick={zoomIn} className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-700/50 rounded-md transition-colors"><ZoomInIcon className="w-5 h-5" /></button>
            <span className="text-sm font-semibold text-cyan-300 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button onClick={zoomOut} className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-700/50 rounded-md transition-colors"><ZoomOutIcon className="w-5 h-5" /></button>
            <div className="h-px w-8 bg-cyan-500/30 my-1"></div>
            <button onClick={resetView} className="p-2 text-cyan-300 hover:text-white hover:bg-cyan-700/50 rounded-md transition-colors"><FitToScreenIcon className="w-5 h-5" /></button>
        </div>
    );
};


const Canvas: React.FC<CanvasProps> = () => {
  const nodes = useCanvasStore((state) => state.nodes);
  const [transform, setTransform] = useState({ x: window.innerWidth / 4, y: window.innerHeight / 8, scale: 0.8 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeElements = useRef<Record<string, HTMLElement | null>>({});
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());

  useEffect(() => {
    const newElements: Record<string, HTMLElement | null> = {};
    for (const node of nodes) {
        newElements[node.id] = document.querySelector(`[data-node-id="${node.id}"]`);
    }
    nodeElements.current = newElements;
  }, [nodes]);
  
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
      if (e.target !== canvasRef.current) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      canvasRef.current?.setPointerCapture(e.pointerId);
      if (pointers.current.size === 1) {
          canvasRef.current!.style.cursor = 'grabbing';
      }
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
      if (!pointers.current.has(e.pointerId)) return;
      
      // FIX: Explicitly typing oldPointers prevents a TypeScript inference issue where
      // creating a new Map from an existing one was losing type information.
      const oldPointers: Map<number, { x: number; y: number }> = new Map(pointers.current);
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // FIX: Explicitly type pArr and oldPArr to prevent TypeScript from inferring them as unknown[], which causes property access errors.
      const pArr: { x: number; y: number }[] = Array.from(pointers.current.values());
      const oldPArr: { x: number; y: number }[] = Array.from(oldPointers.values());

      if (pArr.length === 1) { // Panning
          const oldPos = oldPointers.get(e.pointerId)!;
          const dx = e.clientX - oldPos.x;
          const dy = e.clientY - oldPos.y;
          setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      } else if (pArr.length === 2 && oldPArr.length === 2) { // Pinching
          const oldDist = Math.hypot(oldPArr[0].x - oldPArr[1].x, oldPArr[0].y - oldPArr[1].y);
          const newDist = Math.hypot(pArr[0].x - pArr[1].x, pArr[0].y - pArr[1].y);
          const oldMidpoint = { x: (oldPArr[0].x + oldPArr[1].x) / 2, y: (oldPArr[0].y + oldPArr[1].y) / 2 };
          const newMidpoint = { x: (pArr[0].x + pArr[1].x) / 2, y: (pArr[0].y + pArr[1].y) / 2 };

          if (oldDist === 0) return;
          const scaleFactor = newDist / oldDist;
          
          const panDx = newMidpoint.x - oldMidpoint.x;
          const panDy = newMidpoint.y - oldMidpoint.y;

          setTransform(prev => {
              const newScale = Math.min(Math.max(0.1, prev.scale * scaleFactor), 3);
              const newX = newMidpoint.x - (newMidpoint.x - (prev.x + panDx)) * scaleFactor;
              const newY = newMidpoint.y - (newMidpoint.y - (prev.y + panDy)) * scaleFactor;
              return { scale: newScale, x: newX, y: newY };
          });
      }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
      pointers.current.delete(e.pointerId);
      canvasRef.current?.releasePointerCapture(e.pointerId);
      if (pointers.current.size < 1) {
          canvasRef.current!.style.cursor = 'grab';
      }
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const scaleAmount = -e.deltaY * 0.001;
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform(prev => {
        const newScale = Math.min(Math.max(0.1, prev.scale + scaleAmount), 3);
        const newX = mouseX - (mouseX - prev.x) * (newScale / prev.scale);
        const newY = mouseY - (mouseY - prev.y) * (newScale / prev.scale);
        return { scale: newScale, x: newX, y: newY };
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

  return (
    <div
      ref={canvasRef}
      className="flex-1 w-full h-full overflow-hidden relative cursor-grab neural-canvas-bg"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
      style={{ touchAction: 'none' }}
    >
      <div
        className="absolute top-0 left-0"
        style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transformOrigin: 'top left' }}
      >
        {nodes.map((node) => (
          <Node key={node.id} node={node} canvasTransform={transform} />
        ))}
      </div>
      <CanvasControls zoomIn={handleZoomIn} zoomOut={handleZoomOut} resetView={handleResetView} scale={transform.scale} />
    </div>
  );
};

export default Canvas;