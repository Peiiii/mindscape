import { GoogleGenAI, Modality } from "@google/genai";
import { NodeData, NodeAction } from '../types';

const fileToGenerativePart = async (file: File | null) => {
  if (!file) return null;
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

const pollVideoOperation = async (ai: GoogleGenAI, operation: any, onProgress: (message: string) => void): Promise<any> => {
  let currentOperation = operation;
  const progressMessages = [
      "正在初始化视频引擎...",
      "正在分析提示词和图像...",
      "核心渲染已开始...",
      "正在生成关键帧...",
      "正在应用视觉效果...",
      "正在进行后期处理和编码...",
      "即将完成..."
  ];
  let messageIndex = 0;

  while (!currentOperation.done) {
    onProgress(progressMessages[messageIndex % progressMessages.length]);
    messageIndex++;
    await new Promise(resolve => setTimeout(resolve, 10000));
    try {
        currentOperation = await ai.operations.getVideosOperation({ operation: currentOperation });
    } catch (e) {
        console.error("Polling video operation failed", e);
        throw e;
    }
  }
  return currentOperation;
};

export const processRequest = async (
    prompt: string,
    file: File | null,
    onNodeUpdate: (update: Partial<NodeData> & { id: string }) => void,
    loadingNodeId: string,
    action?: NodeAction,
): Promise<NodeData> => {
    try {
        const apiKey = process.env.API_KEY;
        if (!apiKey) {
            throw new Error("API 密钥未配置。");
        }

        const lowerCasePrompt = prompt.toLowerCase();
        
        if (action === NodeAction.GENERATE_VIDEO || lowerCasePrompt.includes("生成视频") || lowerCasePrompt.includes("创建视频")) {
            return await generateVideo(prompt, file, onNodeUpdate, loadingNodeId);
        } else if (action === NodeAction.GENERATE_IMAGE || lowerCasePrompt.includes("生成图片") || lowerCasePrompt.includes("创建图片") || (file && file.type.startsWith('image/'))) {
            return await generateImage(prompt, file);
        } else {
            return await generateText(prompt, action);
        }

    } catch (error: any) {
        console.error("Gemini Service Error:", error);
        throw error;
    }
};

const generateText = async (prompt: string, action?: NodeAction): Promise<NodeData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const model = prompt.length > 200 ? 'gemini-2.5-pro' : 'gemini-2.5-flash';
    
    let finalPrompt = prompt;
    if (action === NodeAction.DEEPEN_THOUGHT) {
        finalPrompt = `请基于以下内容进行深化、扩展或提供不同角度的思考：\n\n"${prompt}"`;
    }

    const response = await ai.models.generateContent({
        model: model,
        contents: finalPrompt,
    });

    return {
        id: Date.now().toString(),
        type: 'AI_RESPONSE' as any,
        content: response.text,
        x: 0, y: 0, // Position will be set by the manager
    };
};

const generateImage = async (prompt: string, file: File | null): Promise<NodeData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const parts: any[] = [{ text: prompt }];

    if (file) {
        const imagePart = await fileToGenerativePart(file);
        if (imagePart) parts.unshift(imagePart);
    }
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: parts },
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imagePart?.inlineData) {
        const base64Image = imagePart.inlineData.data;
        return {
            id: Date.now().toString(),
            type: 'GENERATED_IMAGE' as any,
            content: `data:${imagePart.inlineData.mimeType};base64,${base64Image}`,
            x: 0, y: 0,
        };
    }
    throw new Error("未能从AI响应中提取图像。");
};

const generateVideo = async (
    prompt: string,
    file: File | null,
    onNodeUpdate: (update: Partial<NodeData> & { id: string }) => void,
    loadingNodeId: string
): Promise<NodeData> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    const videoGenerationPayload: any = {
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
            numberOfVideos: 1,
            resolution: '720p',
            aspectRatio: '16:9'
        }
    };

    if (file) {
        const imagePart = await fileToGenerativePart(file);
        if (imagePart) {
             videoGenerationPayload.image = {
                imageBytes: imagePart.inlineData.data,
                mimeType: imagePart.inlineData.mimeType,
            };
        }
    }

    let operation = await ai.models.generateVideos(videoGenerationPayload);
    
    const onProgress = (message: string) => {
        onNodeUpdate({
            id: loadingNodeId,
            content: message,
        });
    };
    
    onProgress("视频生成请求已发送，请稍候...");

    operation = await pollVideoOperation(ai, operation, onProgress);
    
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (downloadLink) {
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await response.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        
        return {
            id: Date.now().toString(),
            type: 'GENERATED_VIDEO' as any,
            content: videoUrl,
            x: 0, y: 0,
        };
    }
    
    throw new Error("未能生成视频或获取下载链接。");
};
