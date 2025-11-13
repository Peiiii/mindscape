import React, { useRef, useEffect } from 'react';
import { NodeData, NodeType, NodeAction } from '../types';
import { AiSparkleIcon, SendIcon, ImageIcon, VideoIcon, DeepenIcon } from './Icons';

interface NodeProps {
    node: NodeData;
    onAction: (sourceNode: NodeData, action: NodeAction, prompt?: string) => void;
    onDrag: (id: string, x: number, y: number) => void;
    canvasTransform: { x: number; y: number; scale: number; }; // Receive canvas transform for accurate drag calculation
}


const NodeHeader: React.FC<{ type: NodeType }> = ({ type }) => {
    let title = '';
    let icon = null;

    switch (type) {
        case NodeType.PROMPT: title = '用户指令'; icon = <SendIcon className="w-4 h-4 text-cyan-400" />; break;
        case NodeType.AI_RESPONSE: title = 'AI 回复'; icon = <AiSparkleIcon className="w-4 h-4 text-purple-400" />; break;
        case NodeType.GENERATED_IMAGE: title = 'AI 生成图像'; icon = <AiSparkleIcon className="w-4 h-4 text-purple-400" />; break;
        case NodeType.GENERATED_VIDEO: title = 'AI 生成视频'; icon = <AiSparkleIcon className="w-4 h-4 text-purple-400" />; break;
        case NodeType.LOADING: title = 'AI 正在处理...'; icon = <div className="w-4 h-4 border-2 border-t-transparent border-cyan-400 rounded-full animate-spin"></div>; break;
        case NodeType.ERROR: title = '错误'; icon = <div className="w-4 h-4 text-red-500">!</div>; break;
        case NodeType.SYSTEM_MESSAGE: title = '系统消息'; icon = null; break;
    }

    return (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 text-sm font-semibold text-cyan-300 cursor-grab">
            {icon}
            <span>{title}</span>
        </div>
    );
};

const ActionButton: React.FC<{ onClick: () => void, icon: React.ReactNode, label: string }> = ({ onClick, icon, label }) => (
    <button onClick={onClick} className="flex items-center gap-1.5 px-2 py-1 text-xs text-cyan-300 bg-cyan-900/50 hover:bg-cyan-800/70 rounded-md transition-colors">
        {icon}
        {label}
    </button>
);

const NodeActions: React.FC<{ node: NodeData, onAction: NodeProps['onAction'] }> = ({ node, onAction }) => {
    const handleAction = (action: NodeAction) => {
        let prompt: string | undefined = undefined;
        if(action === NodeAction.GENERATE_IMAGE || action === NodeAction.GENERATE_VIDEO){
            prompt = window.prompt(`请输入用于生成${action === NodeAction.GENERATE_IMAGE ? '图像' : '视频'}的附加描述:`, '') || '根据内容生成';
            if (prompt === null) return;
        }
        onAction(node, action, prompt);
    };

    const canGenerateImage = [NodeType.PROMPT, NodeType.AI_RESPONSE].includes(node.type);
    const canGenerateVideo = [NodeType.PROMPT, NodeType.AI_RESPONSE, NodeType.GENERATED_IMAGE].includes(node.type);
    const canDeepen = [NodeType.PROMPT, NodeType.AI_RESPONSE].includes(node.type);

    if (node.type === NodeType.LOADING || node.type === NodeType.ERROR || node.type === NodeType.SYSTEM_MESSAGE) return null;
    
    return (
        <div className="px-4 py-2 border-t border-white/10 flex items-center justify-end gap-2">
            {canGenerateImage && <ActionButton onClick={() => handleAction(NodeAction.GENERATE_IMAGE)} icon={<ImageIcon className="w-3 h-3" />} label="生成图像" />}
            {canGenerateVideo && <ActionButton onClick={() => handleAction(NodeAction.GENERATE_VIDEO)} icon={<VideoIcon className="w-3 h-3" />} label="生成视频" />}
            {canDeepen && <ActionButton onClick={() => handleAction(NodeAction.DEEPEN_THOUGHT)} icon={<DeepenIcon className="w-3 h-3" />} label="深化思考" />}
        </div>
    );
}


const NodeContent: React.FC<{ node: NodeData }> = ({ node }) => {
    switch (node.type) {
        case NodeType.PROMPT:
            return (
                <div className="flex flex-col gap-2">
                    {node.file?.mimeType.startsWith('image/') && <img src={node.file.base64} alt={node.file.name} className="rounded-lg object-contain max-w-xs max-h-48" />}
                    <p className="text-gray-200 whitespace-pre-wrap">{node.content}</p>
                </div>
            );
        case NodeType.AI_RESPONSE:
        case NodeType.SYSTEM_MESSAGE:
            return <p className="text-gray-200 whitespace-pre-wrap">{node.content}</p>;
        case NodeType.GENERATED_IMAGE:
            return <img src={node.content} alt="Generated" className="rounded-lg object-contain max-w-full max-h-[60vh]" />;
        case NodeType.GENERATED_VIDEO:
            return <video controls src={node.content} className="rounded-lg max-w-full max-h-[60vh]">您的浏览器不支持视频标签。</video>;
        case NodeType.LOADING:
            return (
                <div className="flex flex-col items-center justify-center gap-4 text-center">
                    <div className="w-8 h-8 border-4 border-t-transparent border-cyan-400 rounded-full animate-spin"></div>
                    <p className="text-cyan-200 animate-pulse">{node.content}</p>
                </div>
            );
        case NodeType.ERROR:
             return <p className="text-red-400">{node.content}</p>;
        default:
            return null;
    }
};

const Node: React.FC<NodeProps> = ({ node, onAction, onDrag, canvasTransform }) => {
    const nodeRef = useRef<HTMLDivElement>(null);
    const dragState = useRef({
        isDragging: false,
        startX: 0,
        startY: 0,
        nodeStartX: 0,
        nodeStartY: 0,
    });

    const handlePointerDown = (e: React.PointerEvent) => {
        if (e.button !== 0) return; // Only drag with left mouse button
        e.stopPropagation();
        
        dragState.current = {
            isDragging: true,
            startX: e.clientX,
            startY: e.clientY,
            nodeStartX: node.x,
            nodeStartY: node.y,
        };
        
        nodeRef.current!.style.cursor = 'grabbing';
        nodeRef.current!.setPointerCapture(e.pointerId);
    };

    useEffect(() => {
        const nodeEl = nodeRef.current;
        if (!nodeEl) return;

        const handlePointerMove = (e: PointerEvent) => {
            if (!dragState.current.isDragging) return;

            const deltaX = (e.clientX - dragState.current.startX) / canvasTransform.scale;
            const deltaY = (e.clientY - dragState.current.startY) / canvasTransform.scale;
            
            const newX = dragState.current.nodeStartX + deltaX;
            const newY = dragState.current.nodeStartY + deltaY;

            // Performance: Directly manipulate transform during drag
            nodeEl.style.transform = `translate(${newX}px, ${newY}px)`;
        };

        const handlePointerUp = (e: PointerEvent) => {
            if (!dragState.current.isDragging) return;

            const deltaX = (e.clientX - dragState.current.startX) / canvasTransform.scale;
            const deltaY = (e.clientY - dragState.current.startY) / canvasTransform.scale;

            const finalX = dragState.current.nodeStartX + deltaX;
            const finalY = dragState.current.nodeStartY + deltaY;

            // Update React state only on drag end
            onDrag(node.id, finalX, finalY);

            dragState.current.isDragging = false;
            nodeEl.style.cursor = 'grab';
            try {
                nodeEl.releasePointerCapture(e.pointerId);
            } catch (error) {
                // This can happen if the element is removed, it's safe to ignore.
            }
        };
        
        const handlePointerCancel = (e: PointerEvent) => {
            if (!dragState.current.isDragging) return;
            // Revert to original position on cancel if needed, or commit
            handlePointerUp(e);
        };

        // We attach listeners to the node itself to handle move/up/cancel events
        // after a pointerdown has been captured.
        nodeEl.addEventListener('pointermove', handlePointerMove);
        nodeEl.addEventListener('pointerup', handlePointerUp);
        nodeEl.addEventListener('pointercancel', handlePointerCancel);
        
        return () => {
            nodeEl.removeEventListener('pointermove', handlePointerMove);
            nodeEl.removeEventListener('pointerup', handlePointerUp);
            nodeEl.removeEventListener('pointercancel', handlePointerCancel);
        };
    }, [node.id, onDrag, canvasTransform]);


    const nodeBaseStyle = "absolute w-96 max-w-lg border rounded-xl shadow-lg bg-black/50 backdrop-blur-xl transition-all duration-300 node-enter-active cursor-grab";
    const borderColor = node.type === NodeType.PROMPT ? "border-cyan-500/30" : "border-purple-500/30";

    return (
        <div 
            ref={nodeRef}
            className={`${nodeBaseStyle} ${borderColor}`} 
            style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
            data-node-id={node.id}
            onPointerDown={handlePointerDown}
        >
            <div className="p-4 pt-0">
                <NodeHeader type={node.type} />
                <div className="pt-4">
                  <NodeContent node={node} />
                </div>
            </div>
            <NodeActions node={node} onAction={onAction} />
        </div>
    );
};

export default Node;
