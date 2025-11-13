import { NodeData, NodeType, NodeAction } from '../types';
import { processRequest } from '../services/geminiService';
import { useCanvasStore } from '../stores/canvasStore';

const NODE_WIDTH = 384; // Corresponds to tailwind 'w-96'

export class CanvasManager {

    init = () => {
        this.checkApiKey();
    }

    checkApiKey = async () => {
        if (window.aistudio) {
            const hasKey = await window.aistudio.hasSelectedApiKey();
            useCanvasStore.getState().setApiKeySelected(hasKey);
        } else {
            useCanvasStore.getState().setApiKeySelected(true); 
        }
    };

    handleNodeDrag = (id: string, x: number, y: number) => {
        useCanvasStore.getState().updateNode({ id, x, y });
    };

    private getNewNodePosition = (parentNode: NodeData) => {
        const { nodes } = useCanvasStore.getState();
        const existingChildren = nodes.filter(n => n.parentId === parentNode.id);
        const yOffset = 300;
        
        // This logic spreads children out horizontally below the parent
        const childrenCount = existingChildren.length;
        const groupWidth = childrenCount * NODE_WIDTH + Math.max(0, childrenCount - 1) * 40;
        const startX = parentNode.x + (NODE_WIDTH / 2) - (groupWidth / 2);
        const newX = startX + childrenCount * (NODE_WIDTH + 40);

        return {
            x: newX,
            y: parentNode.y + yOffset,
        };
    };

    private runAIProcess = async (promptNode: NodeData, file: File | null, action?: NodeAction) => {
        const { setIsLoading, setApiKeySelected, addNode, removeNode, updateNode } = useCanvasStore.getState();
        
        setIsLoading(true);
        const { apiKeySelected } = useCanvasStore.getState();

        const isVideo = action === NodeAction.GENERATE_VIDEO || promptNode.content.toLowerCase().includes('视频');
        if (isVideo && !apiKeySelected) {
            try {
                if (window.aistudio) {
                    await window.aistudio.openSelectKey();
                    setApiKeySelected(true);
                } else {
                    throw new Error("视频生成需要选择API密钥。");
                }
            } catch (e) {
                const { x, y } = this.getNewNodePosition(promptNode);
                addNode({ id: `error-${Date.now()}`, type: NodeType.ERROR, content: `错误: ${(e as Error).message}`, parentId: promptNode.id, x, y });
                setIsLoading(false);
                return;
            }
        }

        const loadingNodeId = `loading-${Date.now()}`;
        const { x, y } = this.getNewNodePosition(promptNode);
        const loadingNode: NodeData = { id: loadingNodeId, type: NodeType.LOADING, content: "正在连接AI...", parentId: promptNode.id, x, y };
        addNode(loadingNode);

        try {
            const responseNode = await processRequest(promptNode.content, file, updateNode, loadingNodeId, action);
            removeNode(loadingNodeId);
            addNode({ ...responseNode, parentId: promptNode.id, x, y, triggeredByAction: action });
        } catch (error: any) {
            removeNode(loadingNodeId);
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

    handleSubmit = async (prompt: string, file: File | null) => {
        const { nodes, addNode } = useCanvasStore.getState();
        const lastNode = nodes.find(n => !n.parentId);
        
        const rootNode: NodeData = {
            id: Date.now().toString(),
            type: NodeType.PROMPT,
            content: prompt,
            x: lastNode ? lastNode.x + NODE_WIDTH + 100 : window.innerWidth / 2 - 192,
            y: lastNode ? lastNode.y : window.innerHeight / 2 - 100,
        };

        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                rootNode.file = { base64: reader.result as string, mimeType: file.type, name: file.name };
                addNode(rootNode);
                this.runAIProcess(rootNode, file);
            };
            reader.readAsDataURL(file);
        } else {
            addNode(rootNode);
            this.runAIProcess(rootNode, file);
        }
    };

    handleNodeAction = async (sourceNode: NodeData, action: NodeAction, prompt?: string) => {
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
        
        this.runAIProcess({ ...sourceNode, content: newPrompt }, file, action);
    };
}
