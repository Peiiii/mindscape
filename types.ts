export enum NodeType {
  PROMPT = 'PROMPT',
  AI_RESPONSE = 'AI_RESPONSE',
  GENERATED_IMAGE = 'GENERATED_IMAGE',
  GENERATED_VIDEO = 'GENERATED_VIDEO',
  LOADING = 'LOADING',
  ERROR = 'ERROR',
  SYSTEM_MESSAGE = 'SYSTEM_MESSAGE',
}

export enum NodeAction {
    GENERATE_IMAGE = 'GENERATE_IMAGE',
    GENERATE_VIDEO = 'GENERATE_VIDEO',
    DEEPEN_THOUGHT = 'DEEPEN_THOUGHT',
}

export interface NodeData {
  id: string;
  type: NodeType;
  content: string;
  file?: {
    base64: string;
    mimeType: string;
    name: string;
  };
  x: number;
  y: number;
  parentId?: string;
  triggeredByAction?: NodeAction;
}

// FIX: To resolve module conflicts, AIStudio is no longer exported. The `aistudio` property on `Window` is now optional to match runtime checks.
// FIX: Moved AIStudio interface into `declare global` to resolve the "Subsequent property declarations must have the same type" error.
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
