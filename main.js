import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, Loader, Shirt, ImageOff, Sparkles, Search, User, Users } from 'lucide-react';

// --- Chave da API Unsplash integrada ---
const UNSPLASH_ACCESS_KEY = 'QNlbhdqEmkq1Mg-eGN1AFvdJmbofcfKi7CqvbWmAfc4';

// --- Componente do Card de Resultado ---
const CombinationCard = ({ combination }) => (
  <div className="bg-white rounded-xl shadow-lg overflow-hidden transform transition-all hover:shadow-2xl hover:-translate-y-1 duration-300 group break-inside-avoid mb-6">
    <a href={combination.links.html} target="_blank" rel="noopener noreferrer" title={`Foto por ${combination.user.name}`}>
      <img 
        src={combination.urls.small} 
        alt={combination.alt_description || 'Look de moda'} 
        className="w-full h-auto object-cover" 
        onError={(e) => { e.target.onerror = null; e.target.src='https://placehold.co/400x600/e9ecef/495057?text=Imagem+Indisponível'; }}
      />
      <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <p className="text-white text-sm font-light">
          Por {combination.user.name}
        </p>
      </div>
    </a>
  </div>
);

// --- Componente de Links de Busca Externa (Apenas Pinterest) ---
const ExternalSearch = ({ analysisResult, selectedStyle, gender }) => {
    if (!analysisResult || !selectedStyle || !gender) return null;

    const { type, color } = analysisResult;
    const pinterestQuery = `${gender} ${selectedStyle} look com ${type} ${color}`;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg mt-8">
            <h3 className="text-xl font-bold text-gray-800 mb-4 text-center md:text-left">Continue sua busca</h3>
            <div className="flex justify-center md:justify-start">
                <a
                    href={`https://br.pinterest.com/search/pins/?q=${encodeURIComponent(pinterestQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
                >
                    <Search size={16} />
                    Buscar mais no Pinterest
                </a>
            </div>
        </div>
    )
}

// --- Componente de Upload de Imagem ---
const ImageUploader = ({ onUpload }) => {
  const onDrop = useCallback(acceptedFiles => {
    const file = acceptedFiles[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        onUpload(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.jpg'] }
  });

  return (
    <div
      {...getRootProps()}
      className={`relative border-4 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-indigo-600 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'}`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center text-gray-500">
        <Camera size={48} className="mb-4 text-gray-400" />
        {isDragActive ?
          <p className="text-lg font-semibold text-indigo-700">Solte a imagem aqui!</p> :
          <p className="text-lg font-semibold">Arraste e solte a foto da sua peça, ou clique para selecionar.</p>
        }
        <p className="text-sm mt-2">PNG, JPG, JPEG</p>
      </div>
    </div>
  );
};

// --- Componente Principal da Aplicação ---
export default function App() {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [gender, setGender] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [combinations, setCombinations] = useState([]);
  const [styleTip, setStyleTip] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingTip, setIsGeneratingTip] = useState(false);
  const [error, setError] = useState(null);
  const loaderRef = useRef(null);

  const styles = ['Casual', 'Social', 'Streetwear', 'Old Money', 'Minimalista', 'Esportivo'];
  
  const callGeminiAPI = async (payload) => {
    const apiKey = ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) {
            const errorBody = await response.json();
            throw new Error(`Erro na API Gemini: ${errorBody.error.message}`);
        }
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0) return result.candidates[0].content.parts[0].text;
        throw new Error("Resposta inesperada da API Gemini.");
    } catch (err) {
        console.error("Erro ao chamar a API Gemini:", err);
        setError(`Erro de comunicação com a IA. ${err.message}`);
        return null;
    }
  };

  const handleImageAnalysis = async () => {
    if (!uploadedImage) return;
    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setSelectedStyle('');
    setGender('');
    setCombinations([]);
    setStyleTip('');
    const base64ImageData = uploadedImage.split(',')[1];
    const prompt = "Analise a imagem desta peça de roupa. Identifique o tipo principal (ex: vestido, calça, camisa) e sua cor predominante. Responda APENAS com um objeto JSON no formato: {\"type\": \"tipo_da_roupa\", \"color\": \"cor_da_roupa\"}. Use português do Brasil.";
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64ImageData } }] }] };
    const jsonResponse = await callGeminiAPI(payload);
    if (jsonResponse) {
        try {
            const cleanedJson = jsonResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const result = JSON.parse(cleanedJson);
            setAnalysisResult(result);
        } catch (e) {
            setError("Não foi possível entender a análise da imagem. Tente outra foto.");
            console.error("Erro ao parsear JSON da Gemini:", e);
        }
    }
    setIsAnalyzing(false);
  };
  
  useEffect(() => { if (uploadedImage) handleImageAnalysis() }, [uploadedImage]);

  const fetchAndFilterCombinations = useCallback(async (gender, style, clothingType, clothingColor, pageNum) => {
    setIsFetching(true);
    setError(null);
    const searchQuery = `${gender} ${style} fashion outfit`;
    try {
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(searchQuery)}&page=${pageNum}&per_page=30&client_id=${UNSPLASH_ACCESS_KEY}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Erro na API Unsplash: ${errorData.errors ? errorData.errors[0] : response.statusText}`);
      }
      const data = await response.json();
      const colorEn = clothingColor.toLowerCase().includes('vermelho') ? 'red' : clothingColor.toLowerCase().includes('azul') ? 'blue' : clothingColor;
      const typeEn = clothingType.toLowerCase().includes('vestido') ? 'dress' : clothingType.toLowerCase().includes('calça') ? 'pants' : clothingType;
      const filteredResults = data.results.filter(img => {
        const description = (img.alt_description || '').toLowerCase();
        return description.includes(colorEn) && description.includes(typeEn);
      });
      setCombinations(prev => pageNum === 1 ? filteredResults : [...prev, ...filteredResults]);
      setHasMore(data.results.length > 0 && pageNum < data.total_pages);
    } catch (err) {
      setError(`Não foi possível buscar as imagens. ${err.message}`);
    } finally {
      setIsFetching(false);
    }
  }, []);

  const handleGenderSelect = (selectedGender) => {
      setGender(selectedGender);
      setSelectedStyle('');
      setCombinations([]);
      setStyleTip('');
  };

  const handleStyleSelect = (style) => {
    if (!analysisResult || !gender) return;
    setSelectedStyle(style);
    setCombinations([]);
    setPage(1);
    setHasMore(true);
    setStyleTip('');
    fetchAndFilterCombinations(gender, style, analysisResult.type, analysisResult.color, 1);
  };

  const handleGenerateTip = async () => {
      if (!analysisResult || !selectedStyle || !gender) return;
      setIsGeneratingTip(true);
      setStyleTip('');
      setError(null);
      const prompt = `Como personal stylist, dê uma dica de moda curta e moderna para um look ${gender} estilo ${selectedStyle}, combinando um(a) ${analysisResult.type} ${analysisResult.color}. Fale em português do Brasil.`;
      const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
      const tip = await callGeminiAPI(payload);
      if (tip) setStyleTip(tip);
      setIsGeneratingTip(false);
  };

  useEffect(() => {
     if (page > 1 && analysisResult && selectedStyle && gender) {
        fetchAndFilterCombinations(gender, selectedStyle, analysisResult.type, analysisResult.color, page);
     }
  }, [page, analysisResult, selectedStyle, gender, fetchAndFilterCombinations])
  
  const handleReset = () => {
    setUploadedImage(null);
    setAnalysisResult(null);
    setGender('');
    setCombinations([]);
    setIsFetching(false);
    setError(null);
    setPage(1);
    setHasMore(true);
    setSelectedStyle('');
    setStyleTip('');
    setIsAnalyzing(false);
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !isFetching && combinations.length > 0) setPage(p => p + 1) },
      { threshold: 1.0 }
    );
    const currentLoaderRef = loaderRef.current;
    if (currentLoaderRef) observer.observe(currentLoaderRef);
    return () => { if (currentLoaderRef) observer.unobserve(currentLoaderRef) };
  }, [hasMore, isFetching, combinations.length]);

  return (
    <div className="min-h-screen bg-gray-100 font-sans">
      <header className="bg-white/80 backdrop-blur-lg shadow-sm sticky top-0 z-20">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
            <div className="flex items-center gap-2"> <Shirt className="text-indigo-600" size={32}/> <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Estilo.AI</h1> </div>
            {uploadedImage && <button onClick={handleReset} className="text-sm font-medium text-gray-600 hover:text-indigo-600 transition-colors">Analisar Outra Peça</button>}
        </div>
      </header>
      <main className="container mx-auto p-4 md:p-8">
        {!uploadedImage ? (
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Inspiração de moda com Inteligência Artificial.</h2>
            <p className="text-lg text-gray-600 mb-8">Envie a foto de uma peça e nossa IA encontrará looks e dicas incríveis para você.</p>
            <ImageUploader onUpload={setUploadedImage} />
          </div>
        ) : (
          <div>
            <div className="bg-white p-6 rounded-2xl shadow-lg mb-8">
                {isAnalyzing && <div className="text-center py-8 flex flex-col justify-center items-center gap-3 text-gray-600"><Loader className="animate-spin" size={32}/> <p className="font-semibold">Analisando sua peça com a IA...</p></div>}
                {analysisResult && !isAnalyzing && (
                    <div className="flex flex-col md:flex-row items-center gap-6">
                        <div className="flex-shrink-0"> <img src={uploadedImage} alt="Peça enviada" className="w-32 h-32 object-cover rounded-xl shadow-md" /> </div>
                        <div className="flex-grow text-center md:text-left">
                           <p className="text-sm text-gray-500">A IA identificou:</p>
                           <h3 className="text-2xl font-bold text-indigo-600 capitalize">{analysisResult.type} {analysisResult.color}</h3>
                           {!gender ? (
                               <div className="mt-4">
                                   <p className="font-semibold text-gray-700 mb-2">Para qual gênero é a busca?</p>
                                   <div className="flex gap-3 justify-center md:justify-start">
                                       <button onClick={() => handleGenderSelect('Feminino')} className="flex items-center gap-2 bg-pink-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-pink-600 transition-colors"><User/> Feminino</button>
                                       <button onClick={() => handleGenderSelect('Masculino')} className="flex items-center gap-2 bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"><Users/> Masculino</button>
                                   </div>
                               </div>
                           ) : (
                               <div className="flex flex-wrap gap-2 mt-4 justify-center md:justify-start">
                                {styles.map(style => (<button key={style} onClick={() => handleStyleSelect(style)} disabled={isFetching} className={`px-4 py-2 text-sm font-semibold rounded-full transition-colors disabled:opacity-50 ${selectedStyle === style ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>{style}</button>))}
                               </div>
                           )}
                        </div>
                    </div>
                )}
                {!isAnalyzing && !analysisResult && <div className="text-center text-red-500">Não foi possível analisar a imagem. Tente outra.</div>}
            </div>
            {selectedStyle && (
                 <div className="mb-8 text-center">
                     <button onClick={handleGenerateTip} disabled={isGeneratingTip} className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold py-3 px-6 rounded-lg flex items-center justify-center mx-auto hover:from-purple-600 hover:to-indigo-700 transition-all duration-300 disabled:opacity-50">
                        {isGeneratingTip ? <Loader className="animate-spin mr-2" /> : <Sparkles className="mr-2" />} {isGeneratingTip ? 'Gerando...' : '✨ Gerar Dica de Estilo'}
                     </button>
                     {styleTip && <p className="mt-4 p-4 bg-purple-50 rounded-lg text-purple-800 italic">"{styleTip}"</p>}
                 </div>
            )}
            {error && <p className="text-red-500 text-center text-sm mb-4 font-semibold">{error}</p>}
            
            <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6">
                {combinations.map(comb => <CombinationCard key={`${comb.id}-${Math.random()}`} combination={comb} />)}
            </div>

            {isFetching && page === 1 && <div className="text-center py-8 flex justify-center items-center gap-3 text-gray-600"><Loader className="animate-spin" size={24}/> Procurando e filtrando inspirações...</div>}
            
            <div ref={loaderRef} className="h-10">
                {isFetching && page > 1 && <div className="text-center py-8 flex justify-center items-center gap-3 text-gray-600"><Loader className="animate-spin" size={24}/> Carregando mais looks...</div>}
                {!hasMore && combinations.length > 0 && <p className="text-center py-8 text-gray-500"><b>Chegou ao fim dos resultados!</b></p>}
            </div>

            {combinations.length === 0 && !isFetching && selectedStyle && !error && (
                <div className="text-center py-16 px-6 bg-white rounded-2xl shadow-lg">
                    <ImageOff size={48} className="mx-auto text-gray-400 mb-4"/> <h3 className="text-xl font-semibold text-gray-800">Nenhum resultado encontrado</h3>
                    <p className="text-gray-500 mt-2">Não encontrámos looks que combinam a peça enviada com o estilo selecionado. Tente outro estilo.</p>
                </div>
            )}
             {/* Seção de Busca Externa aparece no final */}
            <ExternalSearch analysisResult={analysisResult} selectedStyle={selectedStyle} gender={gender} />
          </div>
        )}
      </main>
    </div>
  );
}
