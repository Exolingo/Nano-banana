import React from 'react';
import { GeneratedPart } from '../types';

interface ResultDisplayProps {
    isLoading: boolean;
    error: string | null;
    parts: GeneratedPart[] | null;
    onImageClick: (src: string) => void;
}

const LoadingSpinner: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-indigo-400">
        <svg className="animate-spin h-10 w-10 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg">결과물을 생성 중입니다...</p>
    </div>
);

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ isLoading, error, parts, onImageClick }) => {
    // Determine if the result is multi-image only (like a story) to switch to a grid layout.
    const isMultiImageOnly = parts && parts.length > 1 && parts.every(p => p.inlineData && !p.text);
    const containerClasses = isMultiImageOnly ? "grid grid-cols-2 gap-4" : "flex flex-col gap-4";

    return (
        <div className="h-full bg-gray-800 border border-gray-700 rounded-xl p-4 flex flex-col">
             <h3 className="text-lg font-semibold text-gray-300 mb-4 flex items-center gap-2">
                <span>✨</span>
                생성된 결과물
            </h3>
            <div className="flex-grow bg-gray-900/50 rounded-lg overflow-auto p-4">
                {isLoading && <LoadingSpinner />}
                {!isLoading && error && <div className="text-red-400 p-4 rounded-lg bg-red-900/50">{error}</div>}
                {!isLoading && !error && !parts && (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        생성된 이미지가 여기에 표시됩니다.
                    </div>
                )}
                {!isLoading && !error && parts && (
                    <div className={containerClasses}>
                        {parts.map((part, index) => {
                            if (part.text) {
                                return <p key={index} className="text-gray-300 whitespace-pre-wrap col-span-2">{part.text}</p>;
                            }
                            if (part.inlineData) {
                                const imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                                return (
                                    <div key={index} className="relative group">
                                        <img
                                            src={imageUrl}
                                            alt="Generated content"
                                            className="rounded-lg w-full object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                            onClick={() => onImageClick(imageUrl)}
                                        />
                                         <a
                                            href={imageUrl}
                                            download={`gemini-lab-result-${Date.now()}.png`}
                                            className="absolute top-2 right-2 p-1.5 bg-black bg-opacity-60 rounded-full text-white hover:bg-opacity-80 transition-opacity opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            aria-label="Download image"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <span>💾</span>
                                        </a>
                                    </div>
                                );
                            }
                            return null;
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
