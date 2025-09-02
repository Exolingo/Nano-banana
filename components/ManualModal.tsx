import React, { useEffect } from 'react';

interface ManualModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ManualModal: React.FC<ManualModalProps> = ({ isOpen, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'auto';
        };
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-gray-800 text-gray-300 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between p-4 border-b border-gray-700 sticky top-0 bg-gray-800 rounded-t-lg z-10">
                    <h2 className="text-2xl font-bold text-indigo-400">Banana Canvas 사용 설명서</h2>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full text-white hover:bg-gray-600 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label="Close manual"
                    >
                        <span className="text-lg">❌</span>
                    </button>
                </header>
                <main className="overflow-y-auto p-6 space-y-8">
                    <section>
                        <h3 className="text-2xl font-semibold text-yellow-400 mb-3">1. 앱 개요</h3>
                        <p className="text-gray-400 leading-relaxed">
                            'Banana Canvas'는 Google의 강력한 AI 모델(<strong className="text-white">'gemini-2.5-flash-image-preview'</strong>, <strong className="text-white">'imagen-4.0-generate-001'</strong> 등)을 기반으로 하는 올인원 이미지 생성 및 편집 도구입니다. 이 앱을 통해 사용자는 텍스트 설명만으로 세상에 없던 이미지를 창조하고, 기존 이미지를 업로드하여 전문가 수준으로 편집하며, 여러 이미지를 창의적으로 합성하는 등 다채로운 시각적 작업을 수행할 수 있습니다.
                            <br/><br/>
                            특히, 이 앱의 핵심 차별점은 강력한 <strong className="text-yellow-300">'프롬프트 제안'</strong> 기능입니다. 각 기능 단계마다 AI가 사용자의 의도를 분석하여 최적의 지시문을 자동으로 생성해주므로, 복잡한 프롬프트 엔지니어링 지식 없이도 누구나 전문가 수준의 결과물을 손쉽게 얻을 수 있습니다.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-2xl font-semibold text-yellow-400 mb-3">2. 화면 구성</h3>
                        <p className="text-gray-400 leading-relaxed mb-4">
                            화면은 크게 <strong className="text-indigo-300">입력 → 제어 → 결과</strong>의 3단 구조로 설계되어, 작업 흐름을 직관적으로 따라갈 수 있습니다.
                        </p>
                        <div className="grid md:grid-cols-3 gap-4">
                            <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <h4 className="font-bold text-lg text-white mb-2">① 왼쪽: 시작점</h4>
                                <p className="text-sm text-gray-400">모든 작업의 시작점입니다. 텍스트로 새 이미지를 만들거나, PC의 이미지를 불러와서 '빠른 작업'을 즉시 실행할 수 있습니다.</p>
                            </div>
                             <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <h4 className="font-bold text-lg text-white mb-2">② 중앙: 핵심 제어</h4>
                                <p className="text-sm text-gray-400">이미지 편집과 합성의 핵심 영역입니다. 불러온 이미지의 스타일을 바꾸거나, 여러 이미지를 합성하는 등 구체적인 지시를 내리는 곳입니다.</p>
                            </div>
                             <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                                <h4 className="font-bold text-lg text-white mb-2">③ 오른쪽: 결과 확인</h4>
                                <p className="text-sm text-gray-400">AI가 생성한 최종 결과물이 표시됩니다. 로딩 상태, 오류, 완성된 이미지를 확인하고 저장할 수 있습니다.</p>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="text-2xl font-semibold text-yellow-400 mb-3">3. 기능 상세 가이드</h3>

                        {/* --- Part 1: Starting Point (Left Column) --- */}
                        <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-6">
                            <h4 className="text-xl font-bold text-indigo-300">파트 1: 프로젝트 시작하기 (왼쪽 영역)</h4>
                            
                            <div>
                                <h5 className="font-semibold text-white text-lg mb-2">A. 텍스트로 새 이미지 만들기</h5>
                                <p className="text-gray-400 mb-4 text-sm">편집할 이미지가 없을 때, 아이디어만으로 완전히 새로운 이미지를 만들어냅니다.</p>
                                <ul className="list-disc list-inside space-y-3 text-gray-400">
                                    <li><strong>아이디어 입력:</strong> 만들고 싶은 이미지에 대한 아이디어를 자유롭게 입력하세요. (예: "밤하늘을 나는 고래") 구체적이고 묘사가 풍부할수록 좋습니다.</li>
                                    <li><strong>카테고리 선택:</strong> 아이디어에 맞는 카테고리를 선택하면, AI가 해당 분야에 최적화된 전문적인 프롬프트로 아이디어를 발전시켜줍니다.
                                        <ul className="list-['-_'] list-inside ml-6 mt-2 text-sm space-y-1">
                                            <li><strong className="text-white">사실적인 사진:</strong> 실사 사진처럼 보이도록 카메라 렌즈, 조명, 분위기 등을 묘사하는 프롬프트를 생성합니다.</li>
                                            <li><strong className="text-white">스티커/로고:</strong> 특정 목적(예: '죽음의 신' 컨셉 로고)의 디자인 에셋을 생성하기 위한 구조화된 프롬프트를 만듭니다.</li>
                                            <li><strong className="text-white">판타지 아트/3D 렌더 등:</strong> 특정 예술 스타일에 맞는 전문 용어를 사용하여 프롬프트를 구성합니다.</li>
                                        </ul>
                                    </li>
                                    <li><strong>종횡비 선택:</strong> 생성될 이미지의 비율(정사각형, 와이드스크린, 세로 등)을 결정합니다.</li>
                                    <li><strong className="text-yellow-300">⭐ 프롬프트 제안 (핵심 기능):</strong> 사용자의 간단한 아이디어를 AI가 분석하여, 이미지 생성 모델이 가장 잘 이해할 수 있는 <strong className="text-white">훨씬 상세하고 창의적인 전문 지시문으로 다듬어줍니다.</strong> 이 기능을 통해 사용자는 복잡한 묘사를 고민할 필요 없이, 아이디어만으로도 풍부한 결과물을 얻을 수 있습니다. 제안된 프롬프트를 그대로 사용하거나 원하는 대로 수정할 수 있습니다.</li>
                                    <li><strong>이미지 생성:</strong> 최종 프롬프트를 바탕으로 이미지를 생성합니다. 생성된 이미지는 자동으로 '원본 이미지' 슬롯에 등록되어, 바로 이어서 편집/합성 작업을 시작할 수 있습니다.</li>
                                </ul>
                            </div>

                            <div>
                                <h5 className="font-semibold text-white text-lg mb-2 mt-4">B. 내 이미지 업로드하기</h5>
                                <p className="text-gray-400 text-sm">PC에 저장된 이미지를 불러와 편집, 합성, 변환 등 모든 작업의 기준으로 삼습니다. 이미지를 업로드하면 모든 설정이 초기화되어 새 작업을 시작할 준비가 됩니다.</p>
                            </div>
                            
                            <div>
                                 <h5 className="font-semibold text-white text-lg mb-2 mt-4">C. 빠른 작업 (Quick Actions)</h5>
                                 <p className="text-gray-400 mb-4 text-sm">업로드된 이미지를 대상으로 자주 사용하는 편집 기능을 원클릭으로 실행합니다.</p>
                                <ul className="list-disc list-inside space-y-3 text-gray-400">
                                    <li><strong>배경 제거:</strong> AI가 피사체를 정확히 인식하여 배경만 깔끔하게 제거합니다. 결과물은 배경이 투명한 PNG 파일입니다.</li>
                                    <li><strong>부분 삭제:</strong> 클릭 시 '부분 삭제 모드'로 전환됩니다. 이미지 위에서 지우고 싶은 부분을 마우스로 칠하면, AI가 그 부분을 주변과 어울리게 감쪽같이 채워줍니다. 브러시 크기를 조절하여 섬세한 작업이 가능합니다.</li>
                                    <li><strong>증명사진 변환:</strong> 인물 사진을 정장을 입은 단정한 모습으로 바꾸고, 배경을 깨끗한 흰색으로 처리합니다. 최종 결과물은 표준 증명사진 비율(3:4)에 맞게 자동으로 잘립니다.</li>
                                    <li><strong>평면도를 3D로 변환:</strong> 2D 건축 도면(평면도) 이미지를 입력하면, 가구가 배치된 사실적인 3D 아이소메트릭 뷰(모델하우스 조감도)로 시각화해줍니다.</li>
                                    <li><strong>만화 패널 변환:</strong> 이미지를 만화의 한 장면처럼 바꿔줍니다.
                                        <ul className="list-['-_'] list-inside ml-6 mt-2 text-sm space-y-1">
                                            <li><strong className="text-white">스타일:</strong> 느와르(거친 흑백), 웹툰(선명한 컬러), 미국 코믹스(복고풍) 중 선택합니다.</li>
                                            <li><strong className="text-white">언어:</strong> 삽입될 텍스트의 언어(한국어/영어)를 지정합니다. <strong className="text-yellow-300">⭐ '영어' 선택 시, 한글로 대사를 입력해도 자동으로 영어로 번역되어 반영됩니다.</strong></li>
                                            <li><strong className="text-white">대사/캡션:</strong> 만화에 넣을 텍스트를 직접 입력하여 장면을 완성합니다.</li>
                                        </ul>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* --- Part 2: Core Controls (Center Column) --- */}
                        <div className="p-4 mt-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-6">
                            <h4 className="text-xl font-bold text-indigo-300">파트 2: 핵심 제어 (중앙 영역)</h4>
                            
                            <div>
                                <h5 className="font-semibold text-white text-lg mb-2">A. 이미지 편집</h5>
                                <p className="text-gray-400 mb-4 text-sm">'원본 이미지'를 기반으로 다양한 변형을 가하는 핵심 기능입니다.</p>
                                
                                <h6 className="font-semibold text-gray-200 mb-2 mt-4">처리 방식</h6>
                                <p className="text-gray-400 mb-2 text-sm">이미지의 품질을 개선하거나 기본적인 수정을 가합니다.</p>
                                <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm">
                                    <li><strong>복원:</strong> 오래되거나 손상된 사진의 노이즈, 흠집 등을 제거하여 선명하게 만듭니다.</li>
                                    <li><strong>컬러화:</strong> 흑백 사진에 자연스럽고 사실적인 색을 입힙니다.</li>
                                    <li><strong>채색하기(스케치전용):</strong> 선으로만 그려진 스케치나 라인 아트에 어울리는 색과 명암을 칠해 완성된 일러스트로 만듭니다.</li>
                                    <li><strong>업스케일:</strong> 단순 확대가 아닙니다. AI가 먼저 이미지의 디테일을 분석하고 강화한 후, 그 결과물을 물리적으로 2배 또는 4배 확대하여 고해상도 결과물을 만듭니다.</li>
                                </ul>

                                <h6 className="font-semibold text-gray-200 mb-2 mt-4">스타일 변환</h6>
                                <p className="text-gray-400 mb-2 text-sm">원본 이미지의 구도와 내용은 유지하면서, 전체적인 아트 스타일을 완전히 새로운 형태로 재창조합니다. (예: 평범한 인물 사진을 '클레이메이션' 스타일로 변환)</p>

                                <h6 className="font-semibold text-gray-200 mb-2 mt-4">결과물 종횡비</h6>
                                <p className="text-gray-400 mb-2 text-sm">
                                    결과물의 비율을 선택할 수 있습니다. '원본 비율'을 선택하면 원본 이미지와 동일한 비율로 결과가 생성됩니다. 다른 비율(예: 16:9, 1:1)을 선택하면, AI는 단순히 이미지를 잘라내는 것이 아니라, <strong className="text-green-300">선택된 비율에 맞게 장면을 창의적으로 재구성하거나 확장하여 최적의 구도를 만들어냅니다.</strong> 예를 들어, 세로로 긴 사진을 가로(16:9)로 변경하도록 요청하면, AI는 사진의 양옆에 어울리는 배경을 자연스럽게 추가하여 캔버스를 채워줍니다. 이 과정을 통해 중요한 피사체가 잘려나가는 것을 방지하고, 새로운 비율에 완벽하게 어울리는 자연스러운 결과물을 얻을 수 있습니다.
                                </p>

                                <h6 className="font-semibold text-gray-200 mb-2 mt-4">추가 요청 및 프롬프트 제안</h6>
                                <p className="text-gray-400 mb-2 text-sm">선택한 '처리 방식'이나 '스타일'에 더해, 자유로운 텍스트로 추가적인 지시를 내리거나 AI의 도움을 받을 수 있습니다.</p>
                                <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm">
                                    <li><strong>직접 입력:</strong> "배경에 은하수를 추가해줘"와 같이 원하는 바를 직접 입력합니다.</li>
                                    <li><strong className="text-yellow-300">⭐ 프롬프트 제안 (핵심 기능):</strong> 어떤 지시를 내릴지 막막할 때 사용합니다. 버튼을 누르면 AI가 <strong className="text-white">현재 원본 이미지와 선택된 옵션들을 종합적으로 분석</strong>하여, 원본의 컨셉은 유지하면서 새로운 스타일로 이미지를 재창조하기 위한 최적의 전문 프롬프트를 자동으로 생성해줍니다.</li>
                                    <li><strong className="text-green-300">⭐ 자동 배경 생성:</strong> 원본 이미지의 배경이 투명하거나 의미 없는 단색일 경우, 앱이 이를 자동으로 감지합니다. 이 경우 AI는 편집된 결과물에 가장 잘 어울리는 자연스러운 배경을 자동으로 생성하여 포함시켜 줍니다.</li>
                                </ul>
                            </div>

                             <div>
                                <h5 className="font-semibold text-white text-lg mb-2 mt-6">B. 인생 앨범 제작</h5>
                                <p className="text-gray-400 mb-4 text-sm">인물 사진 한 장과 사진 속 인물의 현재 나이를 입력하면, AI가 얼굴 특징을 최대한 유지하면서 유아기부터 노년기까지의 모습을 상상하여 한 장의 콜라주 앨범으로 만들어주는 특별한 기능입니다. 결과물의 비율도 선택할 수 있습니다.</p>
                             </div>

                             <div>
                                <h5 className="font-semibold text-white text-lg mb-2 mt-6">C. 이미지 합성</h5>
                                <p className="text-gray-400 mb-4 text-sm">두 개 이상의 이미지를 결합하여 새로운 결과물을 만듭니다.</p>
                                <ul className="list-disc list-inside space-y-3 text-gray-400 text-sm">
                                    <li><strong>원본 이미지:</strong> 합성의 중심이 될 주체입니다. (예: 인물 사진)</li>
                                    <li><strong>합성 소스 이미지:</strong> <strong className="text-white">'소스 추가' 버튼</strong>을 클릭하여 합성할 요소를 제공하는 이미지를 등록합니다. 여러 장을 자유롭게 추가할 수 있습니다. 각 이미지는 개별적으로 교체하거나 우측 상단의 '❌' 버튼으로 삭제할 수 있습니다.</li>
                                    <li><strong>합성 방식 설명:</strong> AI에게 어떻게 합성할지 구체적으로 지시합니다. (예: "원본 인물에게 소스 갑옷을 입혀주세요.") <strong className="text-yellow-300">⭐ '프롬프트 제안' (핵심 기능)</strong>을 누르면, AI가 <strong className="text-white">업로드된 원본 및 소스 이미지들을 모두 분석</strong>하여 가장 자연스럽고 창의적인 합성 방식을 문장으로 추천해줍니다. 특히 원본 이미지의 배경이 없을 경우 새로운 배경을 함께 제안하며, 기존 배경이 있는 경우에도 결과물과 어울리도록 배경을 변환하는 아이디어를 제공하여, 복잡한 합성 지시를 고민할 필요가 없어집니다.</li>
                                    <li><strong>결과물 종횡비:</strong> 편집 기능과 마찬가지로, 합성 결과물의 비율을 선택할 수 있습니다. AI는 선택된 비율에 맞게 <strong className="text-green-300">합성된 전체 장면의 구도를 최적화하여 확장</strong> 생성합니다. 이를 통해 단순히 잘려나가는 느낌 없이, 원하는 비율에 완벽하게 맞는 완성도 높은 이미지를 만들 수 있습니다.</li>
                                    <li><strong className="text-green-300">⭐ 자동 배경 생성:</strong> 원본 이미지의 배경이 투명하거나 의미 없는 단색일 경우, 앱이 이를 자동으로 감지합니다. AI는 합성 결과물에 가장 잘 어울리는 자연스러운 배경을 자동으로 생성하여 포함시켜 줍니다. 이를 통해 훨씬 완성도 높은 결과물을 얻을 수 있습니다.</li>
                                </ul>
                            </div>
                        </div>
                         {/* --- Part 3: Results (Right Column) --- */}
                        <div className="p-4 mt-4 bg-gray-900/50 rounded-lg border border-gray-700 space-y-4">
                            <h4 className="text-xl font-bold text-indigo-300">파트 3: 결과 확인 및 저장 (오른쪽 영역)</h4>
                            <p className="text-gray-400 text-sm">모든 AI 작업의 최종 결과물이 표시되는 공간입니다.</p>
                            <ul className="list-disc list-inside space-y-2 text-gray-400 text-sm">
                                <li><strong>로딩 표시:</strong> AI가 작업 중일 때는 스피너 애니메이션과 함께 "결과물을 생성 중입니다..." 메시지가 표시됩니다.</li>
                                <li><strong>오류 메시지:</strong> 작업에 실패하면 어떤 문제가 발생했는지 알려주는 붉은색 오류 메시지가 나타납니다.</li>
                                <li><strong>결과물 표시:</strong> 작업이 성공하면 생성된 이미지나 텍스트가 표시됩니다.</li>
                                <li><strong>확대 보기:</strong> 결과 이미지를 클릭하면 원본 해상도로 확대하여 세부 사항을 확인할 수 있습니다. 이미지 크기(가로x세로) 정보도 함께 표시됩니다.</li>
                                <li><strong>저장하기:</strong> 이미지 위에 마우스를 올리면 나타나는 '저장(💾)' 아이콘을 클릭하여 결과물을 내 PC에 다운로드할 수 있습니다.</li>
                            </ul>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
};
