import { create } from 'zustand';
import { NodeData, NodeType } from '../types';

interface CanvasState {
  nodes: NodeData[];
  isLoading: boolean;
  apiKeySelected: boolean | null;
  addNode: (node: NodeData) => void;
  updateNode: (updatedNode: Partial<NodeData> & { id: string }) => void;
  removeNode: (id: string) => void;
  setIsLoading: (isLoading: boolean) => void;
  setApiKeySelected: (isSelected: boolean | null) => void;
}

const initialNode: NodeData = {
    id: 'initial',
    type: NodeType.SYSTEM_MESSAGE,
    content: '欢迎来到 Mindscape —— 思想的景观。\n\n在下方输入框中播下您第一个想法的种子，或上传一张图片作为灵感之源。然后，在生成的节点上点击操作按钮，让创意在此无限生长、连接、演化。',
    x: window.innerWidth / 2 - 192,
    y: window.innerHeight / 3,
};

export const useCanvasStore = create<CanvasState>((set) => ({
  nodes: [initialNode],
  isLoading: false,
  apiKeySelected: null,
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNode: (updatedNode) => set((state) => {
    const existingNodeIndex = state.nodes.findIndex(n => n.id === updatedNode.id);
    if (existingNodeIndex !== -1) {
        const newNodes = [...state.nodes];
        newNodes[existingNodeIndex] = { ...newNodes[existingNodeIndex], ...updatedNode };
        return { nodes: newNodes };
    }
    return state;
  }),
  removeNode: (id) => set((state) => ({ nodes: state.nodes.filter(n => n.id !== id) })),
  setIsLoading: (isLoading) => set({ isLoading }),
  setApiKeySelected: (isSelected) => set({ apiKeySelected: isSelected }),
}));
