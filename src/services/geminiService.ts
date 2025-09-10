import { GoogleGenAI, Modality, Part } from "@google/genai";
import { GeneratedPart, ImageData } from '../types';

if (!process.env.GOOGLE_API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

export const translateToEnglish = async (text: string): Promise<string> => {
    if (!text.trim()) {
        return "";
    }
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Translate the following Korean text to English. Respond with only the translated text, without any introductory phrases or explanations:\n\n"${text}"`,
            config: {
                temperature: 0.1,
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error translating text:", error);
        // Fallback to original text if translation fails
        return text;
    }
};


export const editImage = async (
    originalImage: ImageData,
    prompt: string,
    synthesisImages: ImageData[]
): Promise<GeneratedPart[]> => {
    try {
        const originalImagePart = {
            inlineData: {
                mimeType: originalImage.mimeType,
                data: originalImage.data,
            },
        };

        const synthesisImageParts = synthesisImages.map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data,
            },
        }));
        
        const textPart = { text: prompt };

        // For synthesis, the order is [base, source, source..., prompt]
        // For primary edits, the order is [base, prompt]
        const parts: Part[] = [originalImagePart, ...synthesisImageParts, textPart];

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        // The API returns all parts, including images and potentially text.
        // FIX: The response `Part[]` from the SDK has an optional `mimeType` for inlineData,
        // which is incompatible with our stricter `GeneratedPart[]` type. This safely transforms
        // the SDK's response parts into our application's type, filtering out any image
        // parts that might be missing a mimeType.
        const responseParts = response.candidates?.[0]?.content?.parts;

        if (!responseParts) {
            return [{ text: "No content generated." }];
        }

        const generatedParts = responseParts.reduce<GeneratedPart[]>((acc, part) => {
            if (part.text) {
                acc.push({ text: part.text });
            } else if (part.inlineData && part.inlineData.mimeType) {
                acc.push({
                    inlineData: {
                        mimeType: part.inlineData.mimeType,
                        data: part.inlineData.data,
                    },
                });
            }
            return acc;
        }, []);

        return generatedParts.length > 0 ? generatedParts : [{ text: "No content generated." }];
    } catch (error) {
        console.error("Error editing image:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return [{ text: `An error occurred: ${errorMessage}` }];
    }
};

export const suggestCompositionPrompt = async (
    originalImage: ImageData,
    synthesisImages: ImageData[],
    isBackgroundEmpty: boolean,
    aspectRatio: 'original' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
): Promise<string> => {
    try {
        const imageParts: Part[] = [originalImage, ...synthesisImages].map(img => ({
            inlineData: {
                mimeType: img.mimeType,
                data: img.data,
            },
        }));
        
        const backgroundStatus = isBackgroundEmpty
            ? "NO_BACKGROUND"
            : "HAS_BACKGROUND";
        
        const aspectRatioInstruction = aspectRatio !== 'original'
            ? `3.  **Generate Part C (Aspect Ratio) - MANDATORY**: You MUST complete the sentence with a phrase that commands the AI to expand the scene to a **${aspectRatio}** ratio without cropping.
    - **Example**: "...중세 시대의 성으로 바꿔주세요. 그리고 전체 장면을 16:9 비율로 확장하여, 성 주변의 풍경을 더 보여주세요."`
            : '';
        
        const finalCheckInstruction = aspectRatio !== 'original'
            ? `-   Does your sentence have Part A, B, and C?`
            : `-   Does your sentence have both an action part and a background part?`;

        const prompt = `
[YOUR MISSION]
Your mission is to generate ONE creative Korean sentence suggesting how to combine the provided images.

[BACKGROUND CONTEXT]
-   **Background Status**: ${backgroundStatus}
-   This status is CRITICAL. Your entire response depends on it.

[STEP-BY-STEP INSTRUCTIONS]
1.  **Generate Part A (The Action)**: First, describe the core action of combining the images in Korean. (e.g., "여성에게 선글라스를 씌우고", "인물에게 갑옷을 입히고").
2.  **Generate Part B (The Background) - MANDATORY**: Second, you MUST complete the sentence by describing the background, strictly following the rule for the given 'Background Status'.
${aspectRatioInstruction}

[RULES FOR PART B]
-   **If Status is 'NO_BACKGROUND'**: You MUST invent a new, interesting background that fits the action in Part A. Your main task is to be creative here.
    -   **Example**: (Action: put sunglasses on woman) -> (Full Sentence): "여성에게 선글라스를 씌우고, 햇살 좋은 캘리포니아 해변에 서 있는 모습으로 만들어 주세요."
-   **If Status is 'HAS_BACKGROUND'**: You MUST suggest TRANSFORMING the existing background to create a cohesive new scene. Do NOT just say "blend it". Be creative.
    -   **Example**: (Action: put armor on a person in an office) -> (Full Sentence): "인물에게 갑옷을 입히고, 사무실 배경을 중세 시대의 성으로 바꿔주세요."

[FINAL CHECK]
${finalCheckInstruction}
-   Did you follow the correct rule for the given Background Status?
-   Is the output ONLY the single Korean sentence?

Now, generate the sentence.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [...imageParts, { text: prompt }] },
            config: {
                temperature: 0.7,
            }
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error suggesting composition prompt:", error);
        throw new Error("Failed to get a suggestion from the AI.");
    }
};

export const suggestPrimaryPrompt = async (
    originalImage: ImageData,
    processes: string[],
    style: string | null,
    customText: string,
    isBackgroundEmpty: boolean,
    aspectRatio: 'original' | '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
): Promise<string> => {
     try {
        const imagePart: Part = {
            inlineData: {
                mimeType: originalImage.mimeType,
                data: originalImage.data,
            },
        };

        const backgroundStatus = isBackgroundEmpty ? "The original image has a transparent or meaningless solid-color background." : "The original image has a meaningful background.";

        const aspectRatioRule = aspectRatio !== 'original' 
            ? `4.  **RULE #4: ASPECT RATIO RECOMPOSITION**: Your generated prompt MUST command the AI to achieve a **${aspectRatio}** aspect ratio by **creatively expanding the scene (outpainting)**, not by cropping. It must describe what to add to the expanded areas (e.g., "...expand the view to include more of the cityscape..."). The prompt must explicitly forbid cropping the original subject.`
            : '';

        const prompt = `[SYSTEM ROLE]
You are a world-class visual concept artist and prompt engineer. Your mission is to analyze the user's original image and their selections, then write a new, masterful prompt in KOREAN. This new prompt should completely reimagine the original image, preserving its core concept but transforming it into the chosen style.

[CONTEXT]
- **Background Status**: ${backgroundStatus}

[USER SELELECTIONS]
1.  **Style**: "${style ? `"${style}"` : 'None'}" (This is the button label the user clicked, in Korean)
2.  **Processes**: [${processes.length > 0 ? processes.map(p => `"${p}"`).join(', ') : 'None'}]
3.  **Additional Request**: "${customText || 'None'}"

[PROMPT GENERATION RULES]
1.  **ABSOLUTE RULE #1: THE CONVERSION COMMAND**: Your generated prompt **MUST** start with a clear, natural-sounding conversion command. It should follow the pattern: "원본 이미지를 [Elaborated Style]으로 변환하여..." (e.g., "Convert the original image into [Elaborated Style]...").
    -   **CRITICAL**: Do NOT just use the user's raw style selection (e.g., '애니화'). You **MUST** elaborate it into a more descriptive, official-sounding style name (e.g., '생생한 애니메이션 스타일' for '애니화', '극사실적인 실사 영화 스타일' for '실사화').
    -   The prompt must **NEVER** start with the style name itself (e.g., "피규어 스타일. ...").
    -   **Correct Example**: "원본 이미지를 생생한 일본 애니메이션 스타일로 변환하여, 영화의 한 장면처럼 보이게 만드세요..."
    -   **Incorrect Example (Unnatural Start)**: "애니화 스타일. 원본 이미지를 이 스타일로 변환하여..."
    -   **Incorrect Example (Missing Command)**: "A vivid Japanese animation style image."
    -   If no style is selected, this rule does not apply.
2.  **ABSOLUTE RULE #2: MATERIAL DESCRIPTION**: If the user's selected style is listed in the [Style-Specific Guidelines] below, you **MUST** include the specified 'material' and 'texture' descriptions in the prompt. This is mandatory.
3.  **RULE #3: BACKGROUND GENERATION**: Based on the **Background Status** provided in [CONTEXT], you **MUST** follow this rule. If the background is empty, you **MUST** create a natural background that best suits the selected style and place the subject within it. (e.g., for 'Figure' style -> 'on a collector's desk'). If the original has a meaningful background, you must transform that background into the new style along with the subject. This is not optional.
${aspectRatioRule}
${aspectRatio !== 'original' ? '5.' : '4.'}  **CORE MISSION**: Eliminate any hint that the original image was a 'photo' or 'live-action'. Describe the scene as if painting it from scratch, using the terminology and material descriptions of the target style. Use the original's composition and mood only as a reference.
${aspectRatio !== 'original' ? '6.' : '5.'}  **LANGUAGE**: The final output prompt **MUST** be in **KOREAN**.
${aspectRatio !== 'original' ? '7.' : '6.'}  **OUTPUT FORMAT**: Return **ONLY** the generated Korean prompt text, with no other explanations, prefixes, or markdown.

[STYLE-SPECIFIC GUIDELINES: Materials & Textures]
-   **피규어 (Figure)**: Describe the entire scene as a diorama composed of detailed 'plastic', 'PVC', or 'die-cast alloy' action figures. Include textures like smooth or matte surfaces, seam lines, joints, and meticulous paintwork.
-   **디오라마 (Diorama)**: Emphasize that everything is a hyper-realistic, handcrafted diorama. Meticulously describe the textures of 'real materials' like moss, soil, grass, wood, and fabric to maximize the feel of a miniature world.
-   **미니어처 (Miniature)**: Describe it as if shot with a tilt-shift lens, making the real world look like a toy model. It is crucial to express extremely shallow depth of field and increase saturation to give it a 'plastic' toy feel.
-   **양모 인형 (Wool Doll)**: Describe the scene as if all subjects and background elements are a puppet show set made of 'wool felt'. Emphasize the unique soft, fuzzy fiber texture and the slightly clumsy silhouette created by needle felting.
-   **페이퍼 아트 (Paper Art)**: Describe the scene as an intricate papercraft (Quilling art) made by cutting, folding, and rolling multiple layers of 'colored paper' or 'cardstock'. Emphasize the 3D feel through paper cut edges and depth from shadows.
-   **스티커 (Sticker)**: Make the subject a die-cut sticker made of 'shiny vinyl' with a thick white border. Bring out the sticker feel by describing its glossy surface along with a simplified graphic style.
-   **클레이메이션 (Claymation)**: Describe the entire scene as a still from a stop-motion animation made of 'polymer clay' or 'plasticine'. Bring out the soft, chewy texture of clay by including handmade traces like fingerprints or tool marks.
-   **스테인드글라스 (Stained Glass)**: Describe the scene as a vibrant stained glass window. Emphasize the thick, black 'lead lines' that separate distinct color fields, and the luminous, translucent quality of the 'glass' with light shining through it.
-   **자수 (Embroidery)**: Describe the scene as a detailed embroidery piece on a 'fabric' canvas. Emphasize the texture of 'thread', using terms like satin stitch, cross-stitch, and french knots to create a tactile feel.
-   **청사진 (Blueprint)**: Convert the scene into a technical blueprint. The background MUST be 'blue paper', and all elements should be rendered as precise 'white lines' and schematics. Include technical annotations or measurement lines where appropriate.
-   **모자이크 (Mosaic)**: Recreate the scene as a mosaic made from small, distinct tiles ('tesserae') of 'ceramic' or 'glass'. Emphasize the grid-like pattern and the texture created by the grout between the tiles.
-   **복셀 아트 (Voxel Art)**: Transform the entire scene into a 3D world made of 'voxels' (3D cubes). Describe all objects and characters as being constructed from these blocks, giving it a distinct, geometric, and pixelated 3D look.
-   **유화 (Oil Painting)**: Describe the scene as a classical oil painting on 'canvas'. Emphasize rich textures, visible 'brushstrokes', and the glossy, impasto effect of thick paint application. The lighting should be dramatic, like a Rembrandt painting.
-   **연필 스케치 (Pencil Sketch)**: Convert the scene into a hand-drawn pencil sketch on 'textured paper'. Describe different shading techniques like cross-hatching, stippling, and blending. Mention the use of different 'graphite' pencils for varying line weights and darkness.
-   **네온사인 (Neon Sign)**: Transform the main subjects into glowing 'neon light tubes'. Describe the vibrant, luminous colors and the characteristic hum or glow against a dark background, like a 'brick wall' at night.
-   **한국수묵화 (Korean Ink Wash Painting)**: Recreate the scene in the style of traditional Korean ink wash painting (Sumukhwa). Emphasize the use of a 'brush' and black 'ink' on 'Hanji paper' (Korean mulberry paper). Describe the minimalist composition, the importance of empty space (yeobaek), and the expressive, calligraphic brushstrokes that capture the essence of the subject rather than fine details. Mention the subtle gradations of ink tones (meok).

[PROCEDURE]
1.  Analyze the original image to identify key elements (subject, action, background).
2.  Strictly adhere to the [PROMPT GENERATION RULES] and [STYLE-SPECIFIC GUIDELINES] to write the new prompt.
3.  Before finalizing, double-check that the prompt perfectly satisfies [ABSOLUTE RULE #1], [ABSOLUTE RULE #2], and [RULE #3].

Now, based on the user's selections and the rules above, create the new prompt in KOREAN.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
             config: {
                temperature: 0.8,
            }
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error suggesting primary prompt:", error);
        throw new Error("Failed to get a prompt suggestion from the AI.");
    }
};

export type ImageCategory = 'default' | 'realistic' | 'sticker' | 'logo' | 'minimalist' | 'food' | 'architecture' | 'fantasy' | 'vector' | 'watercolor' | '3d';

export const suggestOriginalImagePrompt = async (idea: string, category: ImageCategory): Promise<string> => {
    try {
        let systemPrompt = '';
        const baseInstructions = `[OUTPUT FORMAT]
- **Language**: MUST be in KOREAN.
- **Style**: Use vivid, specific descriptions to paint a visually rich scene.
- **Response Format**: Do NOT include any extra explanations (like "Of course, here is a suggestion:"). The response must be only the generated prompt sentence, ready for the user to copy and use.`;

        switch(category) {
            case 'realistic':
                systemPrompt = `[MISSION]
You are a world-class photographer and prompt engineer. Given a user's simple idea, you must generate a highly detailed and professional photography prompt in KOREAN, following the 'Realistic Photo Template' structure below. Describe every element specifically to paint a complete scene.

[REALISTIC PHOTO TEMPLATE]
A realistic [Shot Type] of [Subject], [Action or Expression], in [Environment]. The scene is lit with [Lighting Description], creating a [Mood/Atmosphere]. Shot on a [Camera/Lens Details], highlighting [Key Textures and Details].

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'food':
                systemPrompt = `[MISSION]
You are a top food photographer. Based on the user's idea, generate a mouth-watering, highly detailed food photography prompt in KOREAN.

[FOOD PHOTO TEMPLATE]
Dramatic close-up shot of [Food], [Cooked State]. Placed in [Setting/Plating], with [Specific Ingredient] emphasized. Lit with [Lighting Style] to accentuate [Texture]. Shot on a professional DSLR, macro lens.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'architecture':
                systemPrompt = `[MISSION]
You are a renowned architectural photographer. Based on the user's idea, generate a grand and inspiring architectural photography prompt in KOREAN.

[ARCHITECTURAL PHOTO TEMPLATE]
Dramatic wide-angle shot of a [Building Type] at [Time of Day], in a [Architectural Style] style. Located in [Environment]. [Key Architectural Element] is highlighted under [Lighting Conditions]. Shot on a professional camera, wide-angle lens, long exposure.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'fantasy':
                systemPrompt = `[MISSION]
You are a digital fantasy artist. Based on the user's idea, generate an epic and imaginative fantasy art prompt in KOREAN.

[FANTASY ART TEMPLATE]
An epic digital painting of [Subject], in a [Mood/Atmosphere] mood. They are [Key Action] against a backdrop of [Background]. Featuring a [Color Palette] and [Magical Effects]. Highly detailed, cinematic, trending on ArtStation.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'watercolor':
                systemPrompt = `[MISSION]
You are a watercolor artist. Based on the user's idea, generate a soft and emotional watercolor painting prompt in KOREAN.

[WATERCOLOR TEMPLATE]
A delicate watercolor painting of [Subject], [Style]. Soft [Colors] bleed onto the paper. Wet-on-wet technique, loose and expressive brushstrokes. Textured watercolor paper background.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case '3d':
                systemPrompt = `[MISSION]
You are a 3D rendering artist. Based on the user's idea, generate a realistic and detailed 3D render prompt in KOREAN.

[3D RENDER TEMPLATE]
A realistic 3D render of [Subject], [Style]. Featuring [Materials] and [Textures]. Rendered under [Lighting Setup]. Octane render, Cinema 4D, highly detailed and photorealistic.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'vector':
                systemPrompt = `[MISSION]
You are a professional vector illustrator. Based on the user's idea, generate a clean and modern flat vector illustration prompt in KOREAN.

[VECTOR ILLUSTRATION TEMPLATE]
A flat vector illustration of [Subject], [Style]. Using [Key Features] and a limited [Color Palette]. Clean lines, geometric shapes, no shadows. Adobe Illustrator style.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'sticker':
                systemPrompt = `[MISSION]
You are a professional sticker designer. Based on the user's idea, create a cute and original sticker design prompt in KOREAN, following the 'Sticker Design Template' below.

[STICKER DESIGN TEMPLATE]
A [Style] sticker of [Subject], featuring [Key Features] and a [Color Palette]. The design should have [Line Style] and [Shading Style]. The background should be white.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'logo':
                systemPrompt = `[MISSION]
You are a branding expert and logo designer. Based on the user's idea, create a modern and sleek logo design prompt in KOREAN, following the 'Logo Design Template' below. You must clearly instruct the text rendering.

[LOGO DESIGN TEMPLATE]
Create a [Image Type] for [Brand/Concept]. The text "[[Text to Render]]" should be displayed in a [Font Style]. The design should be [Style Description], using a [Color Scheme].

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'minimalist':
                systemPrompt = `[MISSION]
You are a minimalist design expert. Based on the user's idea, generate a sleek minimalist design prompt in KOREAN that makes strong use of negative space.

[MINIMALIST DESIGN TEMPLATE]
A minimalist composition with a single [Subject] placed in the [bottom right/top left/etc.] of the frame. The background is a vast, empty [Color] canvas, creating significant negative space. Soft, subtle lighting.

[USER IDEA]
"${idea}"

${baseInstructions}`;
                break;
            case 'default':
            default:
                systemPrompt = `[MISSION]
You are a creative prompt generation expert. Given a user's simple idea, you must write a detailed and creative prompt in KOREAN that an AI image generation model (like Imagen) can easily understand to produce a rich result.

[USER IDEA]
"${idea}"

[EXAMPLE]
- (User Idea: a cat flying in space) -> "Photorealistic style, a cute baby cat wearing a spacesuit is floating against the backdrop of the Milky Way. Planets and stars twinkle in the background, the reflection of Earth is visible on the cat's helmet, cinematic lighting, dramatic composition, 8K, high definition."

${baseInstructions}`;
                break;
        }


        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: systemPrompt,
            config: {
                temperature: 0.8,
            }
        });

        return response.text.trim();
    } catch (error) {
        console.error("Error suggesting original image prompt:", error);
        throw new Error("Failed to get a prompt suggestion from the AI.");
    }
};


export const generateImage = async (prompt: string, aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1'): Promise<ImageData> => {
    try {
        const englishPrompt = await translateToEnglish(prompt);
        if (!englishPrompt) {
            throw new Error("Prompt translation failed.");
        }

        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: englishPrompt,
            config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: aspectRatio,
            },
        });

        if (!response.generatedImages || response.generatedImages.length === 0) {
            throw new Error("Image generation failed, no images returned.");
        }
        
        const imageData = response.generatedImages[0].image;

        return {
            mimeType: 'image/png', // The API is configured to return PNG
            data: imageData.imageBytes,
        };
    } catch (error) {
        console.error("Error generating image:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to generate image: ${errorMessage}`);
    }
};

/**
 * Generic function to generate mixed text and image content from a text prompt.
 * This is used for complex features like story and recipe generation.
 */
export const generateTextAndImages = async (
    prompt: string,
    modalities: Modality[] = [Modality.IMAGE, Modality.TEXT]
): Promise<GeneratedPart[]> => {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image-preview',
            contents: { parts: [{ text: prompt }] },
            config: {
                responseModalities: modalities,
            },
        });

        const responseParts = response.candidates?.[0]?.content?.parts;

        if (!responseParts) {
            return [{ text: "콘텐츠를 생성하지 못했습니다." }];
        }

        const generatedParts = responseParts.reduce<GeneratedPart[]>((acc, part) => {
            if (part.text) {
                acc.push({ text: part.text });
            } else if (part.inlineData && part.inlineData.mimeType) {
                acc.push({
                    inlineData: {
                        mimeType: part.inlineData.mimeType,
                        data: part.inlineData.data,
                    },
                });
            }
            return acc;
        }, []);

        return generatedParts.length > 0 ? generatedParts : [{ text: "생성된 콘텐츠가 없습니다." }];
    } catch (error) {
        console.error("Error generating text and images:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return [{ text: `오류가 발생했습니다: ${errorMessage}` }];
    }
};

/**
 * Generates an 8-part visual story from a user's idea.
 */
export const generateStoryImages = async (idea: string): Promise<GeneratedPart[]> => {
    const systemPrompt = `[SYSTEM COMMAND: VISUAL STORY GENERATION]
- **Task**: Create a sequence of exactly 8 images that tell a complete, silent story based on the user's idea.
- **Absolute Rule**: The images MUST NOT contain any text, words, captions, or speech bubbles. The storytelling must be purely visual.
- **Output Format**: Your entire response MUST consist of only the 8 generated image parts.
[USER'S STORY IDEA]
"${idea}"`;
    return generateTextAndImages(systemPrompt, [Modality.IMAGE]);
};

export const getRecipeGenerationPrompt = (dish: string): string => {
    return `[SYSTEM COMMAND: ILLUSTRATED KOREAN RECIPE GENERATION - STRICT ENFORCEMENT]

[ABSOLUTE, NON-NEGOTIABLE CORE MISSION]
Your task is to generate a **complete, unabridged, step-by-step recipe** for the user's requested dish, from the very first ingredient preparation to the final plated dish.

[UNBREAKABLE RULES]
1.  **LANGUAGE**: All text, including step instructions, titles, and any descriptions, MUST be in **KOREAN (한국어)**. No exceptions.
2.  **FORMAT**: The recipe MUST be a strict sequence of TEXT-IMAGE PAIRS. For EVERY single text instruction, you MUST IMMEDIATELY follow it with a corresponding generated image that visually represents that exact step.
3.  **COMPLETENESS**: The recipe MUST be **fully comprehensive**. It must guide the user from the very first step (e.g., "재료를 준비합니다: ...") to the final, finished dish, ready to be served ("완성된 요리를 접시에 담아냅니다."). It must not be a summary or a partial recipe. All necessary steps must be included.
4.  **IMAGE CONTENT (CRITICAL)**: The generated images MUST be **purely visual**. They MUST NOT contain any text, letters, numbers, step indicators, watermarks, or any other overlays. The image should only show the food and the action of that step.

[FAILURE CONDITION]
A response is considered a COMPLETE FAILURE if:
-   A text step is provided WITHOUT an image immediately following it.
-   The recipe is incomplete or just a summary.
-   The total number of text parts does not EXACTLY match the total number of image parts.
-   Any of the text is not in Korean.
-   Any of the generated images contain text.

[OUTPUT STRUCTURE - YOU MUST FOLLOW THIS]
Your entire response must be an interleaved sequence of text parts and image parts.

1.  **Part 1 (Text in KOREAN):** "1단계: [단계별 설명]"
2.  **Part 2 (Image):** [A purely visual, text-free generated image for Step 1]
3.  **Part 3 (Text in KOREAN):** "2단계: [단계별 설명]"
4.  **Part 4 (Image):** [A purely visual, text-free generated image for Step 2]
...and so on until the dish is complete.

[USER'S REQUESTED DISH]
"${dish}"

Now, begin generating the complete recipe in KOREAN, strictly adhering to the TEXT-IMAGE PAIR format and all content requirements, ensuring all images are text-free.`;
};


/**
 * Generates a step-by-step recipe with an image for each step.
 */
export const generateRecipe = async (dish: string): Promise<GeneratedPart[]> => {
    const systemPrompt = getRecipeGenerationPrompt(dish);
    return generateTextAndImages(systemPrompt, [Modality.IMAGE, Modality.TEXT]);
};

/**
 * Suggests a story idea based on a provided image.
 */
export const suggestStoryFromImage = async (image: ImageData): Promise<string> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: image.mimeType,
                data: image.data,
            },
        };
        const prompt = `[YOUR MISSION]
Analyze the provided image and generate a creative and concise story idea in KOREAN that could be told in 8 silent images. The story should have a clear beginning, middle, and a compelling end.

[OUTPUT FORMAT]
- **Language**: MUST be in KOREAN.
- **Response Format**: Do NOT include any extra explanations. The response must be ONLY the generated story idea sentence.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                temperature: 0.8,
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error suggesting story from image:", error);
        throw new Error("Failed to get a story suggestion from the AI.");
    }
};

/**
 * Suggests a recipe name (dish) based on a provided image.
 */
export const suggestRecipeFromImage = async (image: ImageData): Promise<string> => {
    try {
        const imagePart = {
            inlineData: {
                mimeType: image.mimeType,
                data: image.data,
            },
        };
        const prompt = `[YOUR MISSION]
Analyze the provided image of a food dish. Identify the name of the dish as specifically as possible.

[OUTPUT FORMAT]
- **Language**: MUST be in KOREAN.
- **Response Format**: Do NOT include any extra explanations (like "The dish in the image is..."). The response must be ONLY the name of the dish.
- **Example**: If the image is of macarons, the output should be "마카롱".`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts: [imagePart, { text: prompt }] },
            config: {
                temperature: 0.2,
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error suggesting recipe from image:", error);
        throw new Error("Failed to get a recipe suggestion from the AI.");
    }
};