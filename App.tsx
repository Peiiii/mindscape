import React, { useState, useEffect, useCallback } from 'react';
import Canvas from './components/Canvas';
import InputBar from './components/InputBar';
import { NodeData, NodeType, NodeAction } from './types';
import { processRequest } from './services/geminiService';
import { AiSparkleIcon } from './components/Icons';


const App: React.FC = () => {
    const [nodes, setNodes] = useState<NodeData[]>(() => {
        const initialNode: NodeData = {
            id: 'initial',
            type: NodeType.SYSTEM_MESSAGE,
            content: '欢迎来到 Mindscape —— 思想的景观。\n\n在下方输入框中播下您第一个想法的种子，或上传一张图片作为灵感之源。然后，在生成的节点上点击操作按钮，让创意在此无限生长、连接、演化。',
            x: window.innerWidth / 2 - 192, // Center the node
            y: window.innerHeight / 3,
        };
        return [initialNode];
    });
    const [isLoading, setIsLoading] = useState(false);
    const [apiKeySelected, setApiKeySelected] = useState<boolean | null>(null);

    const checkApiKey = useCallback(async () => {
        if(window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            setApiKeySelected(hasKey);
        } else {
            setApiKeySelected(true); 
        }
    }, []);

    useEffect(() => { checkApiKey(); }, [checkApiKey]);

    const addNode = (node: NodeData) => {
        setNodes(prev => [...prev, node]);
    }

    const updateNode = useCallback((updatedNode: NodeData) => {
        setNodes(currentNodes => {
            const existingNodeIndex = currentNodes.findIndex(n => n.id === updatedNode.id);
            if (existingNodeIndex !== -1) {
                const newNodes = [...currentNodes];
                newNodes[existingNodeIndex] = { ...newNodes[existingNodeIndex], ...updatedNode };
                return newNodes;
            }
            return currentNodes;
        });
    }, []);
    
    const removeNode = (id: string) => {
        setNodes(prev => prev.filter(n => n.id !== id));
    }
    
    const handleNodeDrag = useCallback((id: string, x: number, y: number) => {
        setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
    }, []);

    const handleNodeUpdateForService = useCallback((updatedNode: NodeData) => {
        // This callback is for services like video polling to update a node's content
        updateNode(updatedNode);
    }, [updateNode]);
    
    const getNewNodePosition = (parentNode: NodeData) => {
        const existingChildren = nodes.filter(n => n.parentId === parentNode.id);
        const yOffset = 300;
        const xOffset = (existingChildren.length - 1) * 220;
        return {
            x: parentNode.x + xOffset,
            y: parentNode.y + yOffset,
        };
    };

    const runAIProcess = async (promptNode: NodeData, file: File | null, action?: NodeAction) => {
        setIsLoading(true);

        const isVideo = action === NodeAction.GENERATE_VIDEO || promptNode.content.toLowerCase().includes('视频');
        if (isVideo && !apiKeySelected) {
            try {
                if (window.aistudio) {
                    await window.aistudio.openSelectKey();
                    // FIX: Avoid race condition by assuming API key selection was successful, as per guidelines.
                    setApiKeySelected(true);
                } else {
                    throw new Error("视频生成需要选择API密钥。");
                }
            } catch (e) {
                const { x, y } = getNewNodePosition(promptNode);
                addNode({ id: `error-${Date.now()}`, type: NodeType.ERROR, content: `错误: ${(e as Error).message}`, parentId: promptNode.id, x, y });
                setIsLoading(false);
                return;
            }
        }

        const loadingNodeId = `loading-${Date.now()}`;
        const { x, y } = getNewNodePosition(promptNode);
        const loadingNode: NodeData = { id: loadingNodeId, type: NodeType.LOADING, content: "正在连接AI...", parentId: promptNode.id, x, y };
        addNode(loadingNode);

        try {
            const responseNode = await processRequest(promptNode.content, file, handleNodeUpdateForService, action);
            removeNode(loadingNodeId);
            addNode({ ...responseNode, parentId: promptNode.id, x, y });
        } catch (error: any) {
            removeNode(loadingNodeId);
            // FIX: Add specific error handling for invalid API keys during video generation.
            if (typeof error.message === 'string' && error.message.includes("Requested entity was not found.")) {
                setApiKeySelected(false);
                addNode({ id: `error-${Date.now()}`, type: NodeType.ERROR, content: `API密钥无效或已过期。下次生成视频时将提示您重新选择。`, parentId: promptNode.id, x, y });
            } else {
                addNode({ id: `error-${Date.now()}`, type: NodeType.ERROR, content: `处理请求时出错: ${error.message}`, parentId: promptNode.id, x, y });
            }
        } finally {
            setIsLoading(false);
        }
    }

    const handleSubmit = async (prompt: string, file: File | null) => {
        const rootNode: NodeData = {
            id: Date.now().toString(),
            type: NodeType.PROMPT,
            content: prompt,
            x: window.innerWidth / 2 - 192,
            y: window.innerHeight / 2 - 100,
        };

        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                rootNode.file = { base64: reader.result as string, mimeType: file.type, name: file.name };
                addNode(rootNode);
                runAIProcess(rootNode, file);
            };
            reader.readAsDataURL(file);
        } else {
            addNode(rootNode);
            runAIProcess(rootNode, file);
        }
    };
    
    const handleNodeAction = async (sourceNode: NodeData, action: NodeAction, prompt?: string) => {
        const newPrompt = prompt || sourceNode.content;
        
        let file: File | null = null;
        if (sourceNode.type === NodeType.GENERATED_IMAGE) {
            const response = await fetch(sourceNode.content);
            const blob = await response.blob();
            file = new File([blob], "source_image.png", { type: blob.type });
        } else if (sourceNode.file) {
             const response = await fetch(sourceNode.file.base64);
            const blob = await response.blob();
            file = new File([blob], sourceNode.file.name, { type: blob.type });
        }

        const actionNode: NodeData = {
            id: Date.now().toString(),
            type: NodeType.PROMPT,
            content: newPrompt,
            parentId: sourceNode.id,
            triggeredByAction: action,
            ...getNewNodePosition(sourceNode)
        };
        // We can choose to not show the action node for a cleaner look
        // addNode(actionNode); 
        
        runAIProcess({ ...sourceNode, content: newPrompt }, file, action);
    };

    return (
        <main className="bg-gray-900 text-white h-screen w-screen flex flex-col overflow-hidden">
            <header className="absolute top-0 left-0 right-0 flex items-center justify-center p-4 z-10 pointer-events-none">
                <div className="flex items-center p-2 rounded-full bg-black/30 backdrop-blur-md">
                    <AiSparkleIcon className="w-6 h-6 text-cyan-400" />
                    <h1 className="text-xl font-bold ml-2 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
                        Mindscape
                    </h1>
                </div>
            </header>
            <Canvas nodes={nodes} onNodeAction={handleNodeAction} onNodeDrag={handleNodeDrag} />
            <InputBar onSubmit={handleSubmit} isLoading={isLoading} />
        </main>
    );
};

export default App;