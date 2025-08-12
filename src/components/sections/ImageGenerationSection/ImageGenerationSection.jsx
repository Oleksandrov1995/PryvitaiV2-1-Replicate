import React, { useState, forwardRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./ImageGenerationSection.css";
import { dalleImagePrompt } from "../../../prompts/openai/dalleImagePrompt";
import { API_URLS } from "../../../config/api";
import { uploadPhoto } from "../../../config/uploadPhoto";
import { generateImagePrompt } from "../../../config/generateImagePrompt";
import { downloadImage } from "../../../utils/downloadImage";
import { replicateCatImagePrompt, replicateImagePrompt } from "../../../prompts/replicate/replicateImagePrompt";
import { generateImageReplicate } from "../../../config/generateImageReplicate";

const ImageGenerationSection = forwardRef(({ onImageGenerated, scrollToNextSection, formData, onGenerateImageRef, greetingTextRef }, ref) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const navigate = useNavigate();

  // Функція для переходу до редактора
  const handleEditImage = () => {
    if (generatedImageUrl) {
      // Отримуємо текст з GreetingTextSection або з formData
      let textToUse = '';
      
      if (greetingTextRef && greetingTextRef.current && greetingTextRef.current.getCurrentText) {
        textToUse = greetingTextRef.current.getCurrentText();
      } else {
        textToUse = formData.greetingText || '';
      }
      
      const params = new URLSearchParams({
        imageUrl: generatedImageUrl,
        text: textToUse
      });
      navigate(`/editor?${params.toString()}`);
    }
  };

  const generateImage = useCallback(async () => {
    setIsGenerating(true);
    
    try {
      console.log('FormData для генерації зображення:', formData);
      
      // Використовуємо ваш публічний URL як заглушку
      let photoUrl = "https://res.cloudinary.com/dnma2ioeb/image/upload/v1754218865/pryvitai-photos/tldl1woyxzaqadwzogx1.jpg";
      
      // Крок 1: Завантаження фото на Cloudinary (якщо є фото)
      if (formData.photo) {
        // Перетворюємо файл в base64
        const convertToBase64 = (file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
          });
        };

        const photoBase64 = await convertToBase64(formData.photo);
        photoUrl = await uploadPhoto(photoBase64);
      }
      
      // Крок 2: Генерація промпта з URL фото
      const formDataWithUrl = {
        ...formData,
        photoUrl: photoUrl
      };
      
      const generatedPrompt = replicateImagePrompt(formDataWithUrl);
      console.log('Промпт для replicate:', generatedPrompt);
      
      const data = await generateImagePrompt(generatedPrompt);
      
      if (data.generatedPrompt) {
        console.log('Згенерований промпт:', data.generatedPrompt);
        // Крок 3: Генерація зображення через Replicate
        try {
          console.log('Відправляю запит до Replicate.');
          if (!data.generatedPrompt) {
            throw new Error('Відсутній згенерований промпт');
          }
          const generatedImageUrl = await generateImageReplicate({
            modelId: "black-forest-labs/flux-kontext-pro",
            input: {
              prompt: "Make this a 90s cartoon",
              input_image: photoUrl,
              aspect_ratio: "match_input_image",
              // strength: 0.8 // можна додати додаткові параметри за потреби
            }
          });
          setGeneratedImageUrl(generatedImageUrl);
          if (onImageGenerated) {
            onImageGenerated("finalGeneratedImageUrl", generatedImageUrl);
          }
        } catch (makeError) {
          console.error('Помилка replicate:', makeError);
        }
        
        if (onImageGenerated) {
          onImageGenerated("generatedImagePrompt", data.generatedPrompt);
          onImageGenerated("imageUrl", photoUrl);
        }
        
        // Автоскрол після успішної генерації
        if (scrollToNextSection) {
          setTimeout(() => scrollToNextSection(), 1000);
        }
      }
      
    } catch (error) {
      console.error('Помилка генерації зображення:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [formData, onImageGenerated, scrollToNextSection]);

  const isFormComplete = () => {
    let completedFields = 0;
    
    if (formData.cardStyle) completedFields++;
    if (formData.cardMood) completedFields++;
    if (formData.photo) completedFields++;
    if (formData.gender) completedFields++;
    if (formData.age) completedFields++;
    if (formData.hobby) completedFields++;
    if (formData.greetingText) completedFields++;
    if (formData.greetingSubject) completedFields++;
    if (formData.trait) completedFields++;
    
    return completedFields >= 2;
  };

  // Передаємо функцію generateImage через ref
  useEffect(() => {
    if (onGenerateImageRef) {
      onGenerateImageRef.current = { generateImage, isGenerating };
    }
  }, [generateImage, isGenerating, onGenerateImageRef]);

  // Функція для скачування зображення
  const handleDownloadImage = async () => {
    if (!generatedImageUrl) return;
    
    const filename = `pryvitai-${Date.now()}.png`;
    await downloadImage(generatedImageUrl, filename);
  };




  return (
    <section ref={ref} className="image-generation-section">
      <button 
        onClick={generateImage}
        disabled={isGenerating || !isFormComplete()}
        className={`generate-image-button ${!isFormComplete() ? 'disabled' : ''}`}
      >
        {isGenerating ? (
          <>
            <span className="loading-spinner"></span>
            Генерую привітайку
          </>
        ) : (
          generatedImageUrl ? '🔄 Генерувати повторно' : '🎨 Згенерувати зображення'
        )}
      </button>

      {isGenerating && (
        <div className="generation-time-info">
          <p>Генерація займає орієнтовно 2-3 хвилини</p>
        </div>
      )}

      {generatedImageUrl && (
        <div className="final-image-result">
          <p><strong>🖼️ Фінальне згенероване зображення:</strong></p>
         
          <div className="image-preview">
            <img src={generatedImageUrl} alt="Згенероване зображення" className="preview-image" />
          </div>
          <p>🌟 Фінальне зображення успішно згенеровано!</p>
          
          <button 
            onClick={handleDownloadImage}
            className="download-button"
          >
            💾 Зберегти привітайку
          </button>
          
          <button 
            onClick={handleEditImage}
            className="edit-button"
          >
            ✏️ Додати текст привітання
          </button>
        </div>
      )}
    </section>
  );
});

export default ImageGenerationSection;
