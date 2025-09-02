import React, { useEffect, useRef, useState } from 'react';
import { QuestionMarkCircleIcon } from './components/Icons';
import { ImageEditor } from './components/ImageEditor';
import { ImageUploader } from './components/ImageUploader';
import { ManualModal } from './components/ManualModal';
import { ResultDisplay } from './components/ResultDisplay';
import { editImage, generateImage, generateRecipe, generateStoryImages, generateTextAndImages, getRecipeGenerationPrompt, ImageCategory, suggestCompositionPrompt, suggestOriginalImagePrompt, suggestPrimaryPrompt, suggestRecipeFromImage, suggestStoryFromImage, translateToEnglish } from './services/geminiService';
import { GeneratedPart, ImageData } from './types';

const stylePrompts = [
    { name: '피규어', prompt: 'Recreate the entire scene as a photograph of a detailed plastic toy figure diorama.' },
    { name: '디오라마', prompt: 'Recreate the entire scene as a hyper-realistic, handcrafted diorama.' },
    { name: '미니어처', prompt: 'Recreate the entire scene as a miniature tilt-shift style photograph, making it look like a tiny model world.' },
    { name: '픽셀 아트', prompt: 'Convert the entire image into a detailed 16-bit pixel art style, preserving the composition.' },
    { name: '양모 인형', prompt: 'Recreate the entire scene and its subjects as if they were made from felted wool in a doll diorama.' },
    { name: '클레이메이션', prompt: 'Recreate the entire scene as a high-quality stop-motion claymation still.'},
    { name: '실사화', prompt: `[SYSTEM COMMAND: CINEMATIC REALISM TRANSFORMATION]
[TASK] You are a VFX artist tasked with converting a 2D illustration (webtoon, anime) into a photorealistic, live-action film scene.
[PRIMARY DIRECTIVE] Your absolute priority is to PRESERVE the original image's core elements while completely REPLACING the artistic style.
[RULES OF PRESERVATION - WHAT YOU MUST KEEP]
-   **Composition & Framing**: The layout of the scene must remain identical.
-   **Characters & Poses**: The subjects' positions, poses, and expressions must be perfectly replicated.
-   **Mood & Atmosphere**: The emotional tone of the original scene must be maintained.
[RULES OF TRANSFORMATION - WHAT YOU MUST CHANGE]
-   **ART STYLE (DESTROY & REPLACE)**: You MUST completely discard the original art style (line art, cell-shading, cartoon features). The output MUST NOT look like a drawing.
-   **RENDERING (REPLACE WITH REALISM)**: Re-render every element with photorealistic textures, complex real-world lighting, and natural physics. Characters must become lifelike humans, objects must become real-world objects. The final output must look like a high-resolution still frame from a professionally shot movie.
[FAILURE CONDITION] Any output that retains a "drawn" or "illustrated" look is a complete failure of the task.` },
    { name: '페이퍼 아트', prompt: 'Recreate the entire image as an intricate, multi-layered paper art craft scene.' },
    { name: '스티커', prompt: 'Create a die-cut sticker of the main subject from the image. The sticker should have a thick white vinyl border and a slight glossy effect. The art style should be simplified and cute (chibi if applicable). The background MUST be solid white.' },
    { name: '로고', prompt: 'Transform the primary subject of the image into a modern, minimalist vector logo. The design must be simple, clean, and iconic, suitable for branding. Use a limited color palette. The final logo must be centered on a solid white background.' },
    { name: '미니멀리스트', prompt: 'Recreate the entire image in an extreme minimalist art style. Use a very limited and muted color palette, simple geometric shapes, and a significant amount of negative space to represent the scene. Focus only on the most essential forms.' },
    { name: '스테인드글라스', prompt: 'Recreate the entire scene as a vibrant stained glass window with thick black lead lines.' },
    { name: '자수', prompt: 'Transform the entire image into a detailed embroidery piece, emphasizing the texture of the thread and fabric.' },
    { name: '청사진', prompt: 'Convert the entire scene into a classic blueprint-style technical drawing on blue paper with white lines.' },
    { name: '모자이크', prompt: 'Recreate the entire scene as a detailed mosaic made of small, colorful ceramic tiles.' },
    { name: '복셀 아트', prompt: 'Transform the entire image into a 3D voxel art style, as if built from colorful cubes.' },
    { name: '유화', prompt: 'Recreate the entire scene as a classical oil painting with rich textures and visible brushstrokes.' },
    { name: '연필 스케치', prompt: 'Convert the entire image into a detailed, hand-drawn pencil sketch on textured paper.' },
    { name: '네온사인', prompt: 'Transform the main subjects of the image into glowing neon signs against a dark brick wall background.' },
    { name: '한국수묵화', prompt: 'Recreate the entire scene in the style of traditional Korean ink wash painting (Sumukhwa), emphasizing minimalist composition and expressive brushstrokes on Hanji paper.' }
];

const processPrompts = [
    { name: '복원', prompt: 'Restore this image to high quality, fixing any scratches, noise or imperfections.' },
    { name: '컬러화', prompt: 'Colorize this black and white image with realistic and vibrant colors.' },
    { name: '채색하기(스케치전용)', prompt: 'Colorize this sketch or line drawing with vibrant and fitting colors, bringing it to life as a full-color illustration.' },
    { name: '업스케일', prompt: 'UPSCALE_PLACEHOLDER' }, // Placeholder to trigger UI and dynamic prompt
];

const applyMaskToImage = (original: ImageData, mask: ImageData): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
        const originalImg = new Image();
        const maskImg = new Image();
        
        let loadedCount = 0;
        const onBothLoaded = () => {
            if (++loadedCount < 2) return;

            const canvas = document.createElement('canvas');
            // Use { willReadFrequently: true } for performance optimization with repeated getImageData calls.
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                return reject(new Error('Could not get canvas context'));
            }

            const width = originalImg.naturalWidth;
            const height = originalImg.naturalHeight;
            canvas.width = width;
            canvas.height = height;

            // 1. Draw original image to get its pixel data
            ctx.drawImage(originalImg, 0, 0);
            const originalData = ctx.getImageData(0, 0, width, height);
            
            // 2. Clear canvas and draw mask image to get its pixel data
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(maskImg, 0, 0, width, height);
            const maskData = ctx.getImageData(0, 0, width, height);

            // 3. Create a new ImageData object to store the final result
            const resultData = ctx.createImageData(width, height);

            // 4. Iterate through every pixel. The mask's brightness will define the final alpha.
            for (let i = 0; i < originalData.data.length; i += 4) {
                // We use the red channel of the mask as the luminance value (since it's grayscale, R=G=B).
                const alpha = maskData.data[i]; 

                // Copy RGB values from the original image
                resultData.data[i] = originalData.data[i];     // Red
                resultData.data[i + 1] = originalData.data[i + 1]; // Green
                resultData.data[i + 2] = originalData.data[i + 2]; // Blue
                // Set the alpha value from the mask
                resultData.data[i + 3] = alpha;                  // Alpha
            }

            // 5. Put the manipulated pixel data back onto the canvas
            ctx.putImageData(resultData, 0, 0);
            
            const finalDataUrl = canvas.toDataURL('image/png');
            const finalBase64 = finalDataUrl.split(',')[1];
            
            resolve({
                mimeType: 'image/png',
                data: finalBase64,
            });
        };

        originalImg.onload = onBothLoaded;
        maskImg.onload = onBothLoaded;
        originalImg.onerror = () => reject(new Error('Failed to load original image for masking.'));
        maskImg.onerror = () => reject(new Error('Failed to load mask image for masking.'));

        originalImg.src = `data:${original.mimeType};base64,${original.data}`;
        maskImg.src = `data:${mask.mimeType};base64,${mask.data}`;
    });
};

const upscaleImageClientSide = (image: ImageData, factor: 2 | 4): Promise<ImageData> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));

            const newWidth = img.naturalWidth * factor;
            const newHeight = img.naturalHeight * factor;

            canvas.width = newWidth;
            canvas.height = newHeight;
            
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            const upscaledDataUrl = canvas.toDataURL('image/png');
            const upscaledBase64 = upscaledDataUrl.split(',')[1];

            resolve({
                mimeType: 'image/png',
                data: upscaledBase64,
            });
        };
        img.onerror = () => reject(new Error('Failed to load image for upscaling.'));
        img.src = `data:${image.mimeType};base64,${image.data}`;
    });
};

const isBackgroundEffectivelyEmpty = (image: ImageData): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            // Use a small canvas for performance
            const checkWidth = Math.min(img.naturalWidth, 100);
            const checkHeight = Math.min(img.naturalHeight, 100);
            canvas.width = checkWidth;
            canvas.height = checkHeight;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) {
                return resolve(false); // Cannot check, assume not empty
            }

            ctx.drawImage(img, 0, 0, checkWidth, checkHeight);
            
            try {
                const imageData = ctx.getImageData(0, 0, checkWidth, checkHeight).data;
                
                // 1. Check for transparency first (more definitive)
                for (let i = 3; i < imageData.length; i += 4) {
                    if (imageData[i] < 255) {
                        return resolve(true);
                    }
                }

                // 2. If no transparency, check for solid color
                const firstPixelR = imageData[0];
                const firstPixelG = imageData[1];
                const firstPixelB = imageData[2];
                const tolerance = 5; // Allow for minor variations like JPEG artifacts

                for (let i = 4; i < imageData.length; i += 4) {
                    if (
                        Math.abs(imageData[i] - firstPixelR) > tolerance ||
                        Math.abs(imageData[i + 1] - firstPixelG) > tolerance ||
                        Math.abs(imageData[i + 2] - firstPixelB) > tolerance
                    ) {
                        return resolve(false); // Not a solid color
                    }
                }
                
                return resolve(true); // It's a solid color
            } catch (e) {
                console.error("Background check failed:", e);
                resolve(false); // Assume not empty on error
            }
        };
        img.onerror = () => reject(new Error('Failed to load image for background check.'));
        img.src = `data:${image.mimeType};base64,${image.data}`;
    });
};


const OptionButton: React.FC<{
    isActive: boolean;
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}> = ({ isActive, children, ...props }) => {
    const baseClasses = "px-3 py-1.5 text-sm font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const activeClasses = "bg-indigo-600 text-white shadow-lg";
    const inactiveClasses = "bg-gray-700 hover:bg-gray-600 text-gray-200";
    return (
        <button
            {...props}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        >
            {children}
        </button>
    );
};

const ImageModal: React.FC<{ src: string; onClose: () => void; }> = ({ src, onClose }) => {
    const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);

    useEffect(() => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
        };
    }, [src]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div className="relative" onClick={(e) => e.stopPropagation()}>
                <img src={src} alt="Enlarged result" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl" />
                {dimensions && (
                    <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded-md font-mono">
                        {dimensions.width} x {dimensions.height}
                    </div>
                )}
                 <button
                    onClick={onClose}
                    className="absolute -top-3 -right-3 w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-white hover:bg-gray-700 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white"
                    aria-label="Close image view"
                >
                    <span className="text-lg">❌</span>
                </button>
            </div>
        </div>
    );
};

type ComicStyle = 'noir' | 'webtoon' | 'american';
type ComicLanguage = 'ko' | 'en';
type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
type FullAspectRatio = 'original' | AspectRatio;

const ComicOptionButton: React.FC<{
    isActive: boolean;
    onClick: () => void;
    children: React.ReactNode;
}> = ({ isActive, onClick, children }) => {
    const baseClasses = "px-4 py-2 text-sm font-medium rounded-md transition-colors w-full";
    const activeClasses = "bg-indigo-600 text-white";
    const inactiveClasses = "bg-gray-700 hover:bg-gray-600 text-gray-300";
    return (
        <button
            onClick={onClick}
            className={`${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
        >
            {children}
        </button>
    );
};

const ASPECT_RATIO_PROMPT_APPENDIX = (ratio: AspectRatio | FullAspectRatio): string => {
    if (ratio === 'original') return '';
    return `
[ABSOLUTE COMMAND: ASPECT RATIO & SCENE EXPANSION]
- Target Aspect Ratio: ${ratio}
- Your primary task is to generate the final image directly in this target aspect ratio.
- You are strictly forbidden from cropping the original image's main subject.
- To achieve the new aspect ratio, you MUST creatively expand the scene (outpainting). If the target is wider, you must invent and seamlessly paint new details to the left and right. If it's taller, invent and paint new details above and below.
- The final image must contain the ENTIRE original scene, plus the new, expanded areas. Any cropping of the original content is a complete failure of this task.`;
};


const App: React.FC = () => {
    const [originalImage, setOriginalImage] = useState<ImageData | null>(null);
    const [synthesisImages, setSynthesisImages] = useState<{ id: number; image: ImageData }[]>([]);
    const [resultParts, setResultParts] = useState<GeneratedPart[] | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [compositionPrompt, setCompositionPrompt] = useState<string>('');
    const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
    const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
    const [customPrompt, setCustomPrompt] = useState<string>('');
    const [modalImageSrc, setModalImageSrc] = useState<string | null>(null);
    const [originalAge, setOriginalAge] = useState<string>('');
    const [isSuggesting, setIsSuggesting] = useState<boolean>(false);
    const [isPrimarySuggesting, setIsPrimarySuggesting] = useState<boolean>(false);
    const [originalImagePrompt, setOriginalImagePrompt] = useState<string>('');
    const [isGeneratingOriginal, setIsGeneratingOriginal] = useState<boolean>(false);
    const [isOriginalSuggesting, setIsOriginalSuggesting] = useState<boolean>(false);
    const [editMode, setEditMode] = useState<'none' | 'inpaint'>('none');
    const [upscaleFactor, setUpscaleFactor] = useState<2 | 4>(2); // State for 2x/4x selection
    const [imageCategory, setImageCategory] = useState<ImageCategory>('default');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [isComicModalOpen, setIsComicModalOpen] = useState(false);
    const [comicText, setComicText] = useState('');
    const [comicStyle, setComicStyle] = useState<ComicStyle>('noir');
    const [comicLanguage, setComicLanguage] = useState<ComicLanguage>('ko');
    const [lifeAlbumAspectRatio, setLifeAlbumAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('16:9');
    const [isManualOpen, setIsManualOpen] = useState(false);

    // New states for aspect ratios
    const [synthesisAspectRatio, setSynthesisAspectRatio] = useState<FullAspectRatio>('original');
    const [isFloorplanModalOpen, setIsFloorplanModalOpen] = useState(false);
    const [floorplanAspectRatio, setFloorplanAspectRatio] = useState<AspectRatio>('4:3');
    const [comicAspectRatio, setComicAspectRatio] = useState<AspectRatio>('4:3');

    // Special Features states
    const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
    const [storyPrompt, setStoryPrompt] = useState('');
    const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
    const [recipePrompt, setRecipePrompt] = useState('');
    const [isStorySuggesting, setIsStorySuggesting] = useState(false);
    const [isRecipeSuggesting, setIsRecipeSuggesting] = useState(false);


    const synthesisFileInputRef = useRef<HTMLInputElement>(null);


    const handleOriginalImageChange = (image: ImageData | null) => {
        setOriginalImage(image);
        // Reset all other settings to provide a clean slate for the new image
        setSynthesisImages([]);
        setResultParts(null);
        setError(null);
        setCompositionPrompt('');
        setSelectedProcesses([]);
        setSelectedStyle(null);
        setCustomPrompt('');
        setOriginalAge('');
        setEditMode('none');
        setSynthesisAspectRatio('original');
    };
    
    const handleProcessSelect = (prompt: string) => {
        setSelectedProcesses(prev =>
            prev.includes(prompt)
                ? prev.filter(p => p !== prompt)
                // FIX: `p` was used out of scope; it should be `prompt`.
                : [...prev, prompt]
        );
    };

    const handleStyleSelect = (prompt: string | null) => {
        setSelectedStyle(prompt);
    };

    const handleSynthesisImageChange = (newImageData: ImageData | null, id: number) => {
        if (newImageData === null) {
            // Remove the item with this id
            setSynthesisImages(prev => prev.filter(item => item.id !== id));
        } else {
            // Update the item with this id
            setSynthesisImages(prev => prev.map(item =>
                item.id === id ? { ...item, image: newImageData } : item
            ));
        }
    };

    const handleAddSynthesisFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            try {
                const reader = new FileReader();
                reader.onload = () => {
                    const dataUrl = reader.result as string;
                    const base64Data = dataUrl.split(',')[1];
                    const newImage: ImageData = { mimeType: file.type, data: base64Data };
                    const newEntry = { id: Date.now() + Math.random(), image: newImage };
                    setSynthesisImages(prev => [...prev, newEntry]);
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error("Error processing file:", error);
                setError("이미지 파일을 처리하는 중 오류가 발생했습니다.");
            }
        }
        if (event.target) {
            event.target.value = '';
        }
    };


    const handlePrimaryGenerate = async () => {
        const hasTask = selectedProcesses.length > 0 || selectedStyle || customPrompt.trim();
        if (!originalImage || !hasTask) return;
    
        setIsLoading(true);
        setError(null);
        setResultParts(null);
    
        try {
            const translatedCustomPrompt = customPrompt.trim() ? await translateToEnglish(customPrompt) : '';
    
            const otherProcesses = selectedProcesses.filter(p => p !== 'UPSCALE_PLACEHOLDER');
            const isUpscaleSelected = selectedProcesses.includes('UPSCALE_PLACEHOLDER');
    
            const finalPromptParts = [...otherProcesses, selectedStyle, translatedCustomPrompt];
    
            if (isUpscaleSelected) {
                const upscaleDetailPrompt = `Dramatically enhance the sharpness, resolution, and all fine details of this image. Redraw it with extreme clarity, making every texture crisp as if it were shot with a professional, super-high-resolution camera.`;
                finalPromptParts.unshift(upscaleDetailPrompt);
            }
    
            let finalPrompt = finalPromptParts.filter(Boolean).join('. ');
    
            const isBackgroundEmpty = await isBackgroundEffectivelyEmpty(originalImage);
            if (isBackgroundEmpty && selectedStyle) {
                finalPrompt = `[SPECIAL INSTRUCTION] The original image has a transparent or solid-color background. You MUST create a new, complete, and natural-looking background that is contextually appropriate for the chosen style and subject. The final image must be a fully realized scene.\n\n${finalPrompt}`;
            }
    
            const result = await editImage(originalImage, finalPrompt, []);
    
            const errorText = result.length > 0 ? result[0].text : "";
            const hasError = errorText && (errorText.toLowerCase().includes('error') || errorText.includes('오류'));
            const imagePart = result.find(p => p.inlineData);
    
            if (hasError) {
                setError(result[0].text!);
                setResultParts(result);
            } else if (imagePart?.inlineData) {
                let finalImage = imagePart.inlineData;
                let finalMessage = "편집이 완료되었습니다.";
    
                if (isUpscaleSelected) {
                    finalImage = await upscaleImageClientSide(finalImage, upscaleFactor);
                    finalMessage = `업스케일링 (${upscaleFactor}x) 및 디테일 향상이 완료되었습니다.`;
                }
    
                setResultParts([{ text: finalMessage }, { inlineData: finalImage }]);
            } else {
                setError("AI가 이미지를 반환하지 못했습니다.");
                setResultParts(result);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during generation.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };
    

    const handleLifeAlbumGenerate = async () => {
        if (!originalImage || !originalAge.trim()) return;

        setIsLoading(true);
        setError(null);
        setResultParts(null);

        try {
            const ageLabel = `${originalAge.trim()}세`;
            const lifeAlbumPrompt = `[최우선 임무]
당신의 절대적인 최우선 임무는 제공된 원본 이미지 속 **'바로 그 인물'**의 인생 앨범을 만드는 것입니다. 얼굴의 유사성을 유지하는 것이 다른 모든 예술적 요구사항보다 압도적으로 중요합니다. 생성된 모든 얼굴은 누가 보더라도 원본 사진의 인물이 나이를 먹은 모습으로 명확하게 인식되어야 합니다. 이 얼굴 일관성 유지에 실패하면, 생성 전체가 실패한 것입니다.

[결과물 상세 지침]
- **전체 이미지 형식**: ${lifeAlbumAspectRatio} 비율의 스크랩북 스타일 콜라주.
- **포함될 사진들**:
  1. **현재 (${ageLabel})**: 원본 사진 속 인물은 그대로 유지하되, 배경만 완전히 새로운 멋진 풍경으로 교체한 사진.
  2. **인생의 다른 시점들**: 동일 인물의 유아기, 어린이, 고등학생, 대학생, 30대, 50대, 70대 시절의 모습.
- **가장 중요한 규칙 (반드시 준수)**:
  - **절대적인 얼굴 일관성**: 모든 연령대의 사진에 나타난 얼굴의 특징(눈, 코, 입, 얼굴형 등)은 원본 인물과 명백하게 동일해야 합니다. 절대로 다른 사람처럼 보여서는 안 됩니다.
- **스타일 가이드**:
  - **레이아웃**: 사진들을 불규칙하면서도 미학적으로 아름답게 배열하세요.
  - **사진 프레임**: 각 사진마다 폴라로이드, 빈티지 액자 등 독특하고 다양한 프레임을 적용하세요.
  - **라벨링 금지**: 각 사진에 나이나 시점을 나타내는 어떠한 글자나 라벨도 추가하지 마세요.`;
            
            const translatedPrompt = await translateToEnglish(lifeAlbumPrompt);
            const result = await editImage(originalImage, translatedPrompt, []);
            
            const errorText = result.length > 0 ? result[0].text : "";
            const hasError = errorText && (errorText.toLowerCase().includes('error') || errorText.includes('오류'));
    
            if (hasError) {
                setError(result[0].text!);
            } else {
                setResultParts(result);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during generation.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSynthesisGenerate = async () => {
        if (!originalImage || synthesisImages.length === 0 || !compositionPrompt.trim()) return;
    
        setIsLoading(true);
        setError(null);
        setResultParts(null);
    
        try {
            const synthesisImageData = synthesisImages.map(entry => entry.image);
            const translatedCompositionPrompt = await translateToEnglish(compositionPrompt);
            const isBackgroundEmpty = await isBackgroundEffectivelyEmpty(originalImage);
    
            let backgroundInstruction = '';
            if (isBackgroundEmpty) {
                backgroundInstruction = `4.  **BACKGROUND GENERATION (MANDATORY)**: The BASE image has no background. You MUST create a new, photorealistic, and contextually appropriate background that seamlessly integrates with the synthesized subject. The final image must be a complete scene.`;
            } else {
                backgroundInstruction = `4.  **BACKGROUND INTEGRATION**: The BASE image has an existing background. You must seamlessly blend the synthesized subject with the existing background, ensuring consistent lighting, shadows, and perspective.`;
            }
    
            let enhancedPrompt = `[CORE MISSION: High-Fidelity Character Synthesis]

[ABSOLUTE RULE #1: FACIAL IDENTITY LOCK]
Your most critical, non-negotiable mission is to perfectly preserve the facial identity of the person in the BASE image. The final output's face MUST be a 1:1 match to the BASE image's face. Do NOT alter facial structure, features, or unique characteristics. This rule overrides all other artistic instructions. Any change to the face is a complete failure.

[TASK INSTRUCTIONS]
1.  **ANALYZE INPUTS**: You have a BASE image (the primary subject) and one or more SOURCE images (containing elements to add).
2.  **EXECUTE USER GOAL**: The user's instruction is: "${translatedCompositionPrompt}".
3.  **SYNTHESIZE**: Create a SINGLE new image by applying the user's goal to the BASE image.
${backgroundInstruction}
5.  **OUTPUT**: Your response MUST be ONLY the single, final, synthesized image. Do not return multiple images or text.`;
    
            enhancedPrompt += ASPECT_RATIO_PROMPT_APPENDIX(synthesisAspectRatio);
    
            const result = await editImage(originalImage, enhancedPrompt, synthesisImageData);
    
            const errorText = result.length > 0 ? result[0].text : "";
            const hasError = errorText && (errorText.toLowerCase().includes('error') || errorText.includes('오류'));
            const imagePart = result.find(p => p.inlineData);
    
            if (hasError) {
                setError(result[0].text!);
                setResultParts(result);
            } else if (imagePart?.inlineData) {
                let finalImage = imagePart.inlineData;
                let finalMessage = "합성이 완료되었습니다.";
    
                if (synthesisAspectRatio !== 'original') {
                    finalMessage = `합성 및 ${synthesisAspectRatio} 비율로 재구성이 완료되었습니다.`;
                }
                
                // Keep only the last generated image part
                const textParts = result.filter(part => part.text);
                setResultParts([...textParts, { text: finalMessage }, { inlineData: finalImage }]);
    
            } else {
                setResultParts(result.filter(part => !part.inlineData));
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during synthesis.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestComposition = async () => {
        if (!originalImage || synthesisImages.length === 0) return;

        setIsSuggesting(true);
        setError(null);
        try {
            const synthesisImageData = synthesisImages.map(entry => entry.image);
            const isBackgroundEmpty = await isBackgroundEffectivelyEmpty(originalImage);
            const suggestion = await suggestCompositionPrompt(originalImage, synthesisImageData, isBackgroundEmpty, synthesisAspectRatio);
            setCompositionPrompt(suggestion);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during suggestion.';
            setError(message);
        } finally {
            setIsSuggesting(false);
        }
    };
    
    const handleSuggestPrimaryPrompt = async () => {
        if (!originalImage) return;

        setIsPrimarySuggesting(true);
        setError(null);
        try {
            const processesInKorean = selectedProcesses
                .map(p => processPrompts.find(pp => pp.prompt === p)?.name)
                .filter(Boolean) as string[];

            const styleInKorean = stylePrompts.find(s => s.prompt === selectedStyle)?.name || null;
            const isBackgroundEmpty = await isBackgroundEffectivelyEmpty(originalImage);
            
            const suggestion = await suggestPrimaryPrompt(originalImage, processesInKorean, styleInKorean, customPrompt, isBackgroundEmpty, 'original');
            setCustomPrompt(suggestion);
            setSelectedStyle(null); // Clear style selection after suggesting to avoid redundant prompts
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during suggestion.';
            setError(message);
        } finally {
            setIsPrimarySuggesting(false);
        }
    };

    const handleSuggestOriginalPrompt = async () => {
        if (!originalImagePrompt.trim()) return;
        setIsOriginalSuggesting(true);
        setError(null);
        try {
            const suggestion = await suggestOriginalImagePrompt(originalImagePrompt, imageCategory);
            setOriginalImagePrompt(suggestion);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsOriginalSuggesting(false);
        }
    };

    const handleGenerateOriginalImage = async () => {
        if (!originalImagePrompt.trim()) return;
        setIsGeneratingOriginal(true);
        setIsLoading(true); // Use master loading state to disable other controls
        setError(null);
        setResultParts(null);
        try {
            const newImage = await generateImage(originalImagePrompt, aspectRatio);
            handleOriginalImageChange(newImage);
            setResultParts([{
                text: "원본 이미지가 성공적으로 생성되었습니다. 이제 아래 옵션을 사용하여 이미지를 편집하거나 합성할 수 있습니다."
            }]);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsGeneratingOriginal(false);
            setIsLoading(false); // Release master lock
        }
    };

    const handleRemoveBackground = async () => {
        if (!originalImage) return;

        setIsLoading(true);
        setError(null);
        setResultParts(null);

        try {
            const prompt = `Your task is to create a high-quality alpha mask. The main subject of the image must be white, and the background must be black. Use shades of gray on the edges of the subject for smooth, anti-aliased blending, especially for details like hair. The output must be only the black and white mask itself.`;

            const result = await editImage(originalImage, prompt, []);
            
            const maskPart = result.find(p => p.inlineData);

            if (maskPart?.inlineData) {
                // Verify the mask is a valid image format.
                if (!maskPart.inlineData.mimeType.includes('png') && !maskPart.inlineData.mimeType.includes('jpeg')) {
                     throw new Error(`AI returned an invalid mask format (${maskPart.inlineData.mimeType}).`);
                }
                const maskImageData = {
                    mimeType: maskPart.inlineData.mimeType,
                    data: maskPart.inlineData.data,
                };
                
                const finalImage = await applyMaskToImage(originalImage, maskImageData);

                setResultParts([{ text: "배경 제거가 완료되었습니다." }, { inlineData: finalImage }]);

            } else {
                 const errorText = (result.length > 0 ? result[0].text : null) || "배경 제거에 실패했습니다: AI로부터 마스크 이미지를 받지 못했습니다.";
                setError(errorText);
                setResultParts([{ text: errorText }]);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during background removal.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInpaint = async (mask: ImageData) => {
        if (!originalImage) return;

        setEditMode('none'); // Exit edit mode
        setIsLoading(true);
        setError(null);
        setResultParts(null);
        
        try {
            const prompt = `You are an expert image inpainting model. You will receive two images followed by this text prompt. 1. The first image is the original image. 2. The second image is a mask. The white area in this mask indicates the region that needs to be removed and realistically filled. Your task is to remove the content within the white masked area from the first image and intelligently fill it in so it blends seamlessly with the surrounding pixels. Output only the final, single, inpainted image.`;
            const result = await editImage(originalImage, prompt, [mask]);

            const imagePart = result.find(p => p.inlineData);

            if (imagePart?.inlineData) {
                const newImageData = {
                    mimeType: imagePart.inlineData.mimeType,
                    data: imagePart.inlineData.data,
                };
                setResultParts([{ text: "부분 삭제가 완료되었습니다." }, { inlineData: newImageData }]);
            } else {
                const errorText = (result.length > 0 ? result[0].text : null) || "부분 삭제에 실패했습니다.";
                setError(errorText);
                setResultParts([{ text: errorText }]);
            }
        } catch(e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during inpainting.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleProofPhoto = async () => {
        if (!originalImage) return;

        setIsLoading(true);
        setError(null);
        setResultParts(null);

        try {
            const prompt = `[TASK] Convert the provided photograph into a professional, Korean-style ID photo.

[STRICT INSTRUCTIONS]
1.  **Identity Preservation (Top Priority)**: The facial features MUST be identical to the original.
2.  **Mandatory Wardrobe Change**: The subject's clothing MUST be changed to a formal business suit.
3.  **Background**: The background MUST be a solid, pure white color (#FFFFFF).
4.  **Pose & Gaze**: The subject MUST face directly forward, looking at the camera.
5.  **Lighting**: Apply soft, even studio lighting typical of professional portraiture, such as butterfly lighting, to create a flattering look.
6.  **Framing (CRITICAL)**: The final output image MUST be generated with a perfect 3:4 aspect ratio. The composition must be a standard upper-body ID photo shot. DO NOT leave extra space; the subject must fill the 3:4 frame correctly.`;
            
            const result = await editImage(originalImage, prompt, []);
            
            const imagePart = result.find(p => p.inlineData);

            if (imagePart?.inlineData) {
                setResultParts([{ text: "증명사진 변환이 완료되었습니다." }, { inlineData: imagePart.inlineData }]);
            } else {
                const errorText = (result.length > 0 ? result[0].text : null) || "증명사진 변환에 실패했습니다.";
                setError(errorText);
                setResultParts([{ text: errorText }]);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFloorplan = async () => {
        if (!originalImage) return;
        setIsFloorplanModalOpen(true);
    };

    const executeFloorplanGenerate = async () => {
        if (!originalImage) return;

        setIsFloorplanModalOpen(false);
        setIsLoading(true);
        setError(null);
        setResultParts(null);

        try {
            const prompt = `[MISSION] Convert the provided 2D floor plan into a photorealistic 3D model.

[ABSOLUTE CAMERA RULE] You must replicate the following camera perspective precisely:
Imagine you are looking at a dollhouse from an upper corner.

[DETAILED VIEW SPECIFICATIONS]
1.  **Perspective**: A 3D isometric view. DO NOT create a flat top-down image.
2.  **Camera Angle**: A high-angle (bird's-eye view) tilted at approximately 45 degrees.
3.  **Composition**: Use a 'cutaway' style where the front and side walls are removed so the entire interior layout (rooms, furniture, pathways) is clearly visible. The camera should be positioned outside one of the corners.
4.  **Style**: The final image must be a high-quality, photorealistic 3D render.
5.  **Details**: Populate the space with modern furniture, realistic textures (wood floors, tiles), and natural lighting with soft shadows.
6.  **Background**: The area outside the rendered model should be a clean, solid white background.` + ASPECT_RATIO_PROMPT_APPENDIX(floorplanAspectRatio);

            const result = await editImage(originalImage, prompt, []);
            
            const imagePart = result.find(p => p.inlineData);

            if (imagePart?.inlineData) {
                setResultParts([{ text: `평면도 3D 변환(${floorplanAspectRatio})이 완료되었습니다.` }, { inlineData: imagePart.inlineData }]);
            } else {
                const errorText = (result.length > 0 ? result[0].text : null) || "평면도 3D 변환에 실패했습니다.";
                setError(errorText);
                setResultParts([{ text: errorText }]);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleComicPanelGenerate = async () => {
        if (!originalImage) return;

        setIsComicModalOpen(false);
        setIsLoading(true);
        setError(null);
        setResultParts(null);

        try {
            const languageInstruction = comicLanguage === 'ko'
                ? 'The following text is in Korean and must be rendered exactly as written.'
                : 'The following text is in English and must be rendered exactly as written.';
            
            let processedComicText = '';
            if (comicText.trim()) {
                processedComicText = comicLanguage === 'en'
                    ? await translateToEnglish(comicText)
                    : comicText;
            }

            const stylePrompts: { [key in ComicStyle]: string } = {
                noir: `A single comic book panel in a gritty, noir art style, using high-contrast black and white ink. The scene should be a dramatic re-imagining of the provided image's subject and pose. ${processedComicText ? `A caption box at the top of the panel must contain the following text: "${processedComicText}". ${languageInstruction}` : 'The panel must NOT contain any text, speech bubbles, or captions.'} The lighting must be harsh and dramatic, with deep shadows, to create a moody and somber atmosphere.`,
                webtoon: `A single panel in a clean, modern Korean webtoon style. The art should feature crisp digital line art, vibrant cell shading, and expressive characters based on the provided image. ${processedComicText ? `A speech bubble or caption, styled appropriately for a webtoon, must contain the following text: "${processedComicText}". ${languageInstruction}` : 'The panel must NOT contain any text, speech bubbles, or captions.'} The overall mood should be bright and engaging.`,
                american: `A single panel in the style of a classic American superhero comic book from the 1980s. The art must have bold inks and use Ben-Day dot patterns for color. The composition must be dynamic and action-oriented, based on the provided image. ${processedComicText ? `A caption box with a yellow background, typical of the era, must contain the following text: "${processedComicText}". ${languageInstruction}` : 'The panel must NOT contain any text, speech bubbles, or captions.'}`
            };
            
            const prompt = stylePrompts[comicStyle] + ASPECT_RATIO_PROMPT_APPENDIX(comicAspectRatio);
            const result = await editImage(originalImage, prompt, []);

            const imagePart = result.find(p => p.inlineData);
            const errorText = result.length > 0 ? result[0].text : "";
            const hasError = errorText && (errorText.toLowerCase().includes('error') || errorText.includes('오류'));
    
            if (hasError) {
                setError(result[0].text!);
                setResultParts(result);
            } else if (imagePart?.inlineData) {
                setResultParts([{ text: `만화 패널 생성(${comicAspectRatio})이 완료되었습니다.` }, { inlineData: imagePart.inlineData }]);
            } else {
                setError("AI가 만화 패널 이미지를 반환하지 못했습니다.");
                setResultParts(result);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during comic panel generation.';
            setError(message);
        } finally {
            setIsLoading(false);
            setComicText(''); // Reset for next time
        }
    };
    
    const handleStoryGenerate = async () => {
        if (!storyPrompt.trim()) return;
        setIsStoryModalOpen(false);
        setIsLoading(true);
        setError(null);
        setResultParts(null);
        try {
            const result = await generateStoryImages(storyPrompt);
            const errorText = result.length > 0 ? result[0].text : "";
            const hasError = errorText && (errorText.toLowerCase().includes('error') || errorText.includes('오류'));
            if (hasError) {
                setError(errorText!);
            } else {
                setResultParts(result);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during story generation.';
            setError(message);
        } finally {
            setIsLoading(false);
            setStoryPrompt('');
        }
    };

    const handleRecipeGenerate = async () => {
        if (!recipePrompt.trim()) return;
        setIsRecipeModalOpen(false);
        setIsLoading(true);
        setError(null);
        setResultParts(null);
        try {
            let result;
            const promptContent = recipePrompt.trim();
            // Check if it's our detailed prompt or just a dish name
            if (promptContent.startsWith('[SYSTEM COMMAND:')) {
                 result = await generateTextAndImages(promptContent);
            } else {
                 result = await generateRecipe(promptContent);
            }

            const errorText = result.length > 0 ? result[0].text : "";
            const hasError = errorText && (errorText.toLowerCase().includes('error') || errorText.includes('오류'));
             if (hasError) {
                setError(errorText!);
            } else {
                setResultParts(result);
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred during recipe generation.';
            setError(message);
        } finally {
            setIsLoading(false);
            setRecipePrompt('');
        }
    };

    const handleSuggestStory = async () => {
        if (!originalImage) return;
        setIsStorySuggesting(true);
        setError(null);
        try {
            const suggestion = await suggestStoryFromImage(originalImage);
            setStoryPrompt(suggestion);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsStorySuggesting(false);
        }
    };

    const handleSuggestRecipe = async () => {
        if (!originalImage) return;
        setIsRecipeSuggesting(true);
        setError(null);
        try {
            const dishName = await suggestRecipeFromImage(originalImage);
            const fullPrompt = getRecipeGenerationPrompt(dishName);
            setRecipePrompt(fullPrompt);
        } catch (e) {
            const message = e instanceof Error ? e.message : 'An unknown error occurred.';
            setError(message);
        } finally {
            setIsRecipeSuggesting(false);
        }
    };


    const isActionDisabled = isLoading || editMode !== 'none';
    const isPrimaryActionDisabled = isActionDisabled || !originalImage || (!selectedProcesses.length && !selectedStyle && !customPrompt.trim());
    const isLifeAlbumDisabled = isActionDisabled || !originalImage || !originalAge.trim();
    const isSynthesisDisabled = isActionDisabled || !originalImage || synthesisImages.length === 0 || !compositionPrompt.trim();
    const isQuickActionDisabled = isLoading || !originalImage;

    // Placed here to be available in render
    const upscalePromptPlaceholder = processPrompts.find(p => p.name === '업스케일')?.prompt;
    const isUpscaleSelected = upscalePromptPlaceholder ? selectedProcesses.includes(upscalePromptPlaceholder) : false;

    // Reusable component for aspect ratio selectors
    const AspectRatioSelector: React.FC<{
        label: string;
        options: readonly FullAspectRatio[];
        selected: FullAspectRatio;
        onSelect: (ratio: FullAspectRatio) => void;
        disabled?: boolean;
    }> = ({ label, options, selected, onSelect, disabled }) => (
        <div>
            <h4 className="font-semibold text-gray-400 mb-2">{label}:</h4>
            <div className="flex flex-wrap gap-2">
                {options.map(ratio => (
                    <OptionButton
                        key={ratio}
                        isActive={selected === ratio}
                        onClick={() => onSelect(ratio)}
                        disabled={disabled}
                    >
                        {ratio === 'original' ? '원본 비율' : ratio}
                    </OptionButton>
                ))}
            </div>
        </div>
    );

    const FloorplanModal: React.FC = () => (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-indigo-300">평면도 3D 변환 옵션</h3>
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-400">결과물 종횡비:</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['4:3', '16:9', '1:1'] as const).map(ratio => (
                            <ComicOptionButton key={ratio} isActive={floorplanAspectRatio === ratio} onClick={() => setFloorplanAspectRatio(ratio)}>{ratio}</ComicOptionButton>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2 mt-2">
                    <button onClick={() => setIsFloorplanModalOpen(false)} className="w-full p-2 font-medium text-gray-200 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">취소</button>
                    <button onClick={executeFloorplanGenerate} className="w-full p-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors">생성 실행</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-900 text-gray-200 flex flex-col items-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-7xl mx-auto">
                <header className="relative text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
                        Banana Canvas
                    </h1>
                    <p className="mt-2 text-lg text-gray-400">'Nano Banana' 을 이용한 이미지 생성,편집 도구</p>
                    <button
                        onClick={() => setIsManualOpen(true)}
                        className="absolute top-0 right-0 flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-300 bg-gray-700/80 rounded-lg hover:bg-gray-600 transition-colors"
                        aria-label="Open manual"
                    >
                        <QuestionMarkCircleIcon className="w-5 h-5" />
                        <span>사용 설명서</span>
                    </button>
                </header>

                <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* --- Left Column: Inputs & Quick Actions --- */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                        {editMode === 'inpaint' && originalImage ? (
                             <div className="sticky top-6">
                                <ImageUploader title="원본 이미지" onImageChange={() => {}} isDisabled={true} value={originalImage}/>
                                <ImageEditor
                                    image={originalImage}
                                    onApply={handleInpaint}
                                    onCancel={() => setEditMode('none')}
                                    isDisabled={isLoading}
                                />
                             </div>
                        ) : (
                            <>
                                {!originalImage && (
                                    <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                                       <h2 className="text-xl font-bold mb-4 text-center text-indigo-300">이미지 생성</h2>
                                        <div className="flex flex-col gap-3">
                                            <textarea
                                                value={originalImagePrompt}
                                                onChange={(e) => setOriginalImagePrompt(e.target.value)}
                                                placeholder="생성할 이미지에 대한 아이디어를 입력하세요... (예: 우주를 나는 고양이)"
                                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:opacity-50"
                                                rows={4}
                                                disabled={isActionDisabled}
                                            />
                                             <div className="flex flex-col gap-2">
                                                <label htmlFor="category-select" className="text-sm font-medium text-gray-400">카테고리 (프롬프트 제안용):</label>
                                                <select
                                                    id="category-select"
                                                    value={imageCategory}
                                                    onChange={(e) => setImageCategory(e.target.value as ImageCategory)}
                                                    disabled={isActionDisabled}
                                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                                                >
                                                    <option value="default">기본</option>
                                                    <option value="realistic">사실적인 사진</option>
                                                    <option value="food">음식 사진</option>
                                                    <option value="architecture">건축 사진</option>
                                                    <option value="fantasy">판타지 아트</option>
                                                    <option value="watercolor">수채화</option>
                                                    <option value="3d">3D 렌더</option>
                                                    <option value="vector">벡터 일러스트</option>
                                                    <option value="sticker">스티커</option>
                                                    <option value="logo">로고</option>
                                                    <option value="minimalist">미니멀리스트</option>
                                                </select>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <label className="text-sm font-medium text-gray-400">종횡비:</label>
                                                <div className="grid grid-cols-5 gap-2">
                                                    {(['1:1', '16:9', '9:16', '4:3', '3:4'] as const).map(ratio => (
                                                        <button
                                                            key={ratio}
                                                            onClick={() => setAspectRatio(ratio)}
                                                            disabled={isActionDisabled}
                                                            className={`py-1 px-2 text-xs rounded-md transition-colors ${aspectRatio === ratio ? 'bg-indigo-600 text-white' : 'bg-gray-600 hover:bg-gray-500'}`}
                                                        >
                                                            {ratio}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={handleSuggestOriginalPrompt}
                                                    disabled={isActionDisabled || isOriginalSuggesting || !originalImagePrompt.trim()}
                                                    className="w-full flex items-center justify-center gap-2 p-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-800 disabled:opacity-70"
                                                >
                                                    {isOriginalSuggesting ? '제안 중...' : '프롬프트 제안'}
                                                </button>
                                                <button
                                                    onClick={handleGenerateOriginalImage}
                                                    disabled={isActionDisabled || isGeneratingOriginal || !originalImagePrompt.trim()}
                                                    className="w-full p-2 font-semibold text-black bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-yellow-800 disabled:opacity-70"
                                                >
                                                    {isGeneratingOriginal ? '생성 중...' : '이미지 생성'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <ImageUploader
                                    title="원본 이미지"
                                    onImageChange={handleOriginalImageChange}
                                    isDisabled={isActionDisabled}
                                    value={originalImage}
                                    onImageClick={setModalImageSrc}
                                />
                                
                                {originalImage && (
                                     <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                                         <h3 className="text-lg font-semibold text-gray-300 mb-4">빠른 작업 (Quick Actions)</h3>
                                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                             <button onClick={handleRemoveBackground} disabled={isQuickActionDisabled} className="flex items-center gap-1.5 p-2 text-sm text-gray-200 bg-gray-700/80 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"><span>✂️</span><span>배경 제거</span></button>
                                             <button onClick={() => setEditMode('inpaint')} disabled={isQuickActionDisabled} className="flex items-center gap-1.5 p-2 text-sm text-gray-200 bg-gray-700/80 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"><span>🎨</span><span>부분 삭제</span></button>
                                             <button onClick={handleProofPhoto} disabled={isQuickActionDisabled} className="flex items-center gap-1.5 p-2 text-sm text-gray-200 bg-gray-700/80 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"><span>🆔</span><span>증명사진 변환</span></button>
                                             <button onClick={handleFloorplan} disabled={isQuickActionDisabled} className="flex items-center gap-1.5 p-2 text-sm text-gray-200 bg-gray-700/80 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"><span>🏠</span><span>평면도를 3D로</span></button>
                                         </div>
                                     </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* --- Middle Column: Edits & Synthesis --- */}
                    <div className="lg:col-span-1 flex flex-col gap-6">
                         <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                             <h2 className="text-xl font-bold mb-4 text-center text-indigo-300">이미지 편집</h2>
                            <div className="flex flex-col gap-4">
                                <div>
                                    <h4 className="font-semibold text-gray-400 mb-2">처리 방식:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {processPrompts.map(p => (
                                            <OptionButton
                                                key={p.name}
                                                isActive={selectedProcesses.includes(p.prompt)}
                                                onClick={() => handleProcessSelect(p.prompt)}
                                                disabled={isActionDisabled || !originalImage}
                                            >
                                                {p.name}
                                            </OptionButton>
                                        ))}
                                    </div>
                                    {isUpscaleSelected && (
                                        <div className="mt-3 flex items-center gap-2">
                                            <span className="text-sm font-medium text-gray-300">배율:</span>
                                            <OptionButton isActive={upscaleFactor === 2} onClick={() => setUpscaleFactor(2)}>2x</OptionButton>
                                            <OptionButton isActive={upscaleFactor === 4} onClick={() => setUpscaleFactor(4)}>4x</OptionButton>
                                        </div>
                                    )}
                                </div>
                                 <div>
                                    <h4 className="font-semibold text-gray-400 mb-2">스타일 변환:</h4>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={selectedStyle || ''}
                                            onChange={(e) => handleStyleSelect(e.target.value || null)}
                                            disabled={isActionDisabled || !originalImage}
                                            className="flex-grow p-2.5 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:opacity-50 text-sm"
                                        >
                                            <option value="">스타일을 선택하세요...</option>
                                            {stylePrompts.map(s => (
                                                <option key={s.name} value={s.prompt}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => setIsComicModalOpen(true)}
                                            disabled={isActionDisabled || !originalImage}
                                            className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            만화
                                        </button>
                                    </div>
                                </div>
                                 <div>
                                    <h4 className="font-semibold text-gray-400 mb-2">추가 요청:</h4>
                                     <textarea
                                        value={customPrompt}
                                        onChange={(e) => setCustomPrompt(e.target.value)}
                                        placeholder="AI에게 전달할 추가 요청사항을 입력하세요... (예: 배경에 은하수를 추가해줘)"
                                        className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:opacity-50"
                                        rows={3}
                                        disabled={isActionDisabled || !originalImage}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSuggestPrimaryPrompt}
                                        disabled={isActionDisabled || isPrimarySuggesting || !originalImage || (!selectedStyle && !selectedProcesses.length && !customPrompt.trim())}
                                        className="w-full flex items-center justify-center gap-2 p-3 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-800 disabled:opacity-70"
                                    >
                                        {isPrimarySuggesting ? '제안 중...' : '프롬프트 제안'}
                                    </button>
                                    <button
                                        onClick={handlePrimaryGenerate}
                                        disabled={isPrimaryActionDisabled}
                                        className="w-full p-3 font-semibold text-black bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-yellow-800 disabled:opacity-70"
                                    >
                                        편집 실행
                                    </button>
                                </div>
                            </div>
                        </div>

                         <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                             <h2 className="text-xl font-bold mb-4 text-center text-indigo-300">인생 앨범 제작</h2>
                             <div className="flex flex-col gap-4">
                                 <input
                                    type="number"
                                    value={originalAge}
                                    onChange={(e) => setOriginalAge(e.target.value)}
                                    placeholder="사진 속 인물의 현재 나이 입력 (예: 25)"
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                                    disabled={isActionDisabled || !originalImage}
                                />
                                <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-300">앨범 비율:</span>
                                    {(['16:9', '9:16', '1:1'] as const).map(ratio => (
                                        <OptionButton key={ratio} isActive={lifeAlbumAspectRatio === ratio} onClick={() => setLifeAlbumAspectRatio(ratio)}>{ratio}</OptionButton>
                                    ))}
                                </div>
                                 <button
                                    onClick={handleLifeAlbumGenerate}
                                    disabled={isLifeAlbumDisabled}
                                    className="w-full p-3 font-semibold text-black bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-yellow-800 disabled:opacity-70"
                                >
                                    앨범 제작 실행
                                </button>
                             </div>
                         </div>
                        
                         <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                             <h2 className="text-xl font-bold mb-4 text-center text-indigo-300">이미지 합성</h2>
                             <div className="flex flex-col gap-4">
                                <div className="grid grid-cols-2 gap-2">
                                     {synthesisImages.map((entry, index) => (
                                         <ImageUploader
                                             key={entry.id}
                                             title={`합성 소스 #${index + 1}`}
                                             onImageChange={(newImg) => handleSynthesisImageChange(newImg, entry.id)}
                                             isDisabled={isActionDisabled || !originalImage}
                                             value={entry.image}
                                             onImageClick={setModalImageSrc}
                                         />
                                     ))}
                                 </div>
                                 <button
                                     onClick={() => synthesisFileInputRef.current?.click()}
                                     disabled={isActionDisabled || !originalImage}
                                     className="w-full p-2 text-sm font-medium text-indigo-300 bg-gray-700 border-2 border-dashed border-gray-600 rounded-lg hover:border-indigo-500 hover:bg-gray-600 transition-colors disabled:opacity-50"
                                 >
                                     + 소스 추가
                                 </button>
                                 <input
                                     type="file"
                                     ref={synthesisFileInputRef}
                                     onChange={handleAddSynthesisFile}
                                     className="hidden"
                                     accept="image/*"
                                 />
                                <textarea
                                    value={compositionPrompt}
                                    onChange={(e) => setCompositionPrompt(e.target.value)}
                                    placeholder="합성 방식을 설명하세요... (예: 원본 인물에게 소스 갑옷을 입혀주세요)"
                                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors disabled:opacity-50"
                                    rows={3}
                                    disabled={isActionDisabled || !originalImage}
                                />
                                <AspectRatioSelector
                                    label="결과물 종횡비"
                                    options={['original', '1:1', '16:9', '9:16', '4:3', '3:4']}
                                    selected={synthesisAspectRatio}
                                    onSelect={setSynthesisAspectRatio}
                                    disabled={isActionDisabled || !originalImage}
                                />
                                <div className="flex gap-2">
                                     <button
                                        onClick={handleSuggestComposition}
                                        disabled={isActionDisabled || isSuggesting || !originalImage || synthesisImages.length === 0}
                                        className="w-full flex items-center justify-center gap-2 p-3 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-800 disabled:opacity-70"
                                    >
                                        {isSuggesting ? '제안 중...' : '프롬프트 제안'}
                                    </button>
                                    <button
                                        onClick={handleSynthesisGenerate}
                                        disabled={isSynthesisDisabled}
                                        className="w-full p-3 font-semibold text-black bg-yellow-600 rounded-lg hover:bg-yellow-700 transition-colors disabled:bg-yellow-800 disabled:opacity-70"
                                    >
                                        합성 실행
                                    </button>
                                </div>
                             </div>
                         </div>

                         <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                             <h2 className="text-xl font-bold mb-4 text-center text-indigo-300">스페셜 기능</h2>
                             <div className="flex flex-col gap-3">
                                 <button
                                    onClick={() => setIsStoryModalOpen(true)}
                                    disabled={isActionDisabled}
                                    className="w-full p-3 font-semibold text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:bg-teal-800 disabled:opacity-70"
                                 >
                                    연속 스토리 이미지
                                 </button>
                                 <button
                                    onClick={() => setIsRecipeModalOpen(true)}
                                    disabled={isActionDisabled}
                                    className="w-full p-3 font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:bg-rose-800 disabled:opacity-70"
                                 >
                                    이미지 레시피
                                 </button>
                             </div>
                         </div>

                    </div>

                    {/* --- Right Column: Results --- */}
                    <div className="lg:col-span-1">
                        <div className="sticky top-6 h-[calc(100vh-3rem)] max-h-[1200px]">
                           <ResultDisplay
                                isLoading={isLoading}
                                error={error}
                                parts={resultParts}
                                onImageClick={setModalImageSrc}
                            />
                        </div>
                    </div>
                </main>
                 {modalImageSrc && <ImageModal src={modalImageSrc} onClose={() => setModalImageSrc(null)} />}
                 {isComicModalOpen && (
                     <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                         <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                             <h3 className="text-xl font-bold text-indigo-300">만화 패널 옵션</h3>
                             <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-400">스타일:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <ComicOptionButton isActive={comicStyle === 'noir'} onClick={() => setComicStyle('noir')}>느와르</ComicOptionButton>
                                    <ComicOptionButton isActive={comicStyle === 'webtoon'} onClick={() => setComicStyle('webtoon')}>웹툰</ComicOptionButton>
                                    <ComicOptionButton isActive={comicStyle === 'american'} onClick={() => setComicStyle('american')}>미국 코믹스</ComicOptionButton>
                                </div>
                             </div>
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-400">언어 (텍스트 렌더링용):</label>
                                <div className="grid grid-cols-2 gap-2">
                                     <ComicOptionButton isActive={comicLanguage === 'ko'} onClick={() => setComicLanguage('ko')}>한국어</ComicOptionButton>
                                     <ComicOptionButton isActive={comicLanguage === 'en'} onClick={() => setComicLanguage('en')}>영어</ComicOptionButton>
                                </div>
                             </div>
                             <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium text-gray-400">종횡비:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['4:3', '1:1', '16:9'] as const).map(ratio => (
                                        <ComicOptionButton key={ratio} isActive={comicAspectRatio === ratio} onClick={() => setComicAspectRatio(ratio)}>{ratio}</ComicOptionButton>
                                    ))}
                                </div>
                             </div>
                             <textarea
                                value={comicText}
                                onChange={(e) => setComicText(e.target.value)}
                                placeholder="만화에 들어갈 대사나 캡션을 입력하세요..."
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                                rows={3}
                            />
                             <div className="flex gap-2 mt-2">
                                <button onClick={() => setIsComicModalOpen(false)} className="w-full p-2 font-medium text-gray-200 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">취소</button>
                                <button onClick={handleComicPanelGenerate} className="w-full p-2 font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">생성 실행</button>
                             </div>
                         </div>
                     </div>
                 )}
                {isFloorplanModalOpen && <FloorplanModal />}
                {isStoryModalOpen && (
                     <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-lg flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                             <h3 className="text-xl font-bold text-indigo-300">연속 스토리 이미지 생성</h3>
                             <p className="text-sm text-gray-400">생성하고 싶은 8컷짜리 비주얼 스토리의 아이디어를 입력하세요. AI가 텍스트 없이 오직 이미지로만 이야기를 전달해줍니다.</p>
                             <textarea
                                value={storyPrompt}
                                onChange={(e) => setStoryPrompt(e.target.value)}
                                placeholder="예: 1960년대 음악계를 배경으로 한 두 파란색 캐릭터의 모험 이야기..."
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                                rows={5}
                            />
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => setIsStoryModalOpen(false)} className="w-full p-2 font-medium text-gray-200 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">취소</button>
                                {originalImage && (
                                    <button 
                                        onClick={handleSuggestStory}
                                        disabled={isActionDisabled || isStorySuggesting || isRecipeSuggesting}
                                        className="w-full flex items-center justify-center gap-2 p-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-800 disabled:opacity-70"
                                    >
                                        {isStorySuggesting ? '제안 중...' : '프롬프트 제안'}
                                    </button>
                                )}
                                <button onClick={handleStoryGenerate} disabled={!storyPrompt.trim() || isStorySuggesting} className="w-full p-2 font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50">스토리 생성</button>
                            </div>
                        </div>
                     </div>
                )}
                {isRecipeModalOpen && (
                     <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
                            <h3 className="text-xl font-bold text-indigo-300">이미지 레시피 생성</h3>
                            <p className="text-sm text-gray-400">만드는 법을 알고 싶은 요리 이름을 입력하세요. AI가 각 단계별 설명과 이미지를 함께 생성해줍니다.</p>
                            <textarea
                                value={recipePrompt}
                                onChange={(e) => setRecipePrompt(e.target.value)}
                                placeholder="예: 마카롱 굽는 법"
                                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
                                rows={8}
                            />
                             <div className="flex gap-2 mt-2">
                                <button onClick={() => setIsRecipeModalOpen(false)} className="w-full p-2 font-medium text-gray-200 bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors">취소</button>
                                {originalImage && (
                                     <button 
                                        onClick={handleSuggestRecipe}
                                        disabled={isActionDisabled || isRecipeSuggesting || isStorySuggesting}
                                        className="w-full flex items-center justify-center gap-2 p-2 font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors disabled:bg-purple-800 disabled:opacity-70"
                                    >
                                        {isRecipeSuggesting ? '제안 중...' : '프롬프트 제안'}
                                    </button>
                                )}
                                <button onClick={handleRecipeGenerate} disabled={!recipePrompt.trim() || isRecipeSuggesting} className="w-full p-2 font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50">레시피 생성</button>
                             </div>
                        </div>
                     </div>
                )}
                {isManualOpen && <ManualModal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />}
            </div>
        </div>
    );
};

export default App;
