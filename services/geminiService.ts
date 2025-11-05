
import { GoogleGenAI } from '@google/genai';
import type { AspectRatio } from '../types';

const dataUrlToMimeAndBase64 = (dataUrl: string): { mimeType: string; base64: string } => {
  const [header, base64] = dataUrl.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] ?? 'application/octet-stream';
  return { mimeType, base64 };
};

export const generateVideo = async (
  prompt: string,
  imageDataUrl: string,
  aspectRatio: AspectRatio,
  onProgress: (message: string) => void
): Promise<string> => {
  // A new instance must be created before each call to use the latest API key.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const { mimeType, base64: imageBase64 } = dataUrlToMimeAndBase64(imageDataUrl);

  onProgress('Sending request to the AI...');

  let operation = await ai.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    image: {
      imageBytes: imageBase64,
      mimeType: mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio,
    }
  });

  onProgress('AI is warming up its creative engines...');

  let pollCount = 0;
  while (!operation.done) {
    pollCount++;
    onProgress(`Video generation in progress... (check #${pollCount})`);
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  onProgress('Video generation complete! Downloading...');

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    throw new Error('Video generation failed: No download link found.');
  }

  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  if (!videoResponse.ok) {
    throw new Error(`Failed to download video: ${videoResponse.statusText}`);
  }
  const videoBlob = await videoResponse.blob();
  
  return URL.createObjectURL(videoBlob);
};
