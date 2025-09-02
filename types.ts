export interface GeneratedPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export interface ImageData {
  mimeType: string;
  data: string;
}
