import React, { useState, forwardRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./ImageGenerationSection.css";
import { dalleImagePrompt } from "../../../prompts/openai/dalleImagePrompt";
import { API_URLS } from "../../../config/api";
import { downloadImage } from "../../../utils/downloadImage";
import { replicateCatImagePrompt, replicateImagePrompt } from "../../../prompts/replicate/replicateImagePrompt";

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
        
        const uploadResponse = await fetch(API_URLS.UPLOAD_PHOTO, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            photoBase64: photoBase64 
          }),
        });

        if (!uploadResponse.ok) {
          throw new Error('Помилка при завантаженні фото');
        }

        const uploadData = await uploadResponse.json();
        photoUrl = uploadData.url;
        
        console.log('Фото завантажено на Cloudinary:', photoUrl);
      }
      
      // Крок 2: Генерація промпта з URL фото
      const formDataWithUrl = {
        ...formData,
        photoUrl: photoUrl
      };
      
      const prompt = replicateImagePrompt(formDataWithUrl);
      console.log('Промпт для replicate:', prompt);
      
      const response = await fetch(API_URLS.GENERATE_IMAGE_PROMPT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('Перевищено ліміт запитів. Будь ласка, спробуйте через кілька хвилин.');
        } else if (response.status === 500) {
          throw new Error('Помилка сервера. Спробуйте пізніше.');
        } else if (response.status === 503) {
          throw new Error('Сервіс тимчасово недоступний. Спробуйте пізніше.');
        } else {
          throw new Error(`Помилка при генерації промпта: ${response.status} ${response.statusText}`);
        }
         console.log('Згенерований промпт:', data.generatedPrompt);
      }

      const data = await response.json();
      
      if (data.generatedPrompt) {
        console.log('Згенерований промпт:', data.generatedPrompt);
        // Крок 3: Генерація зображення через Make.com webhook
        try {
          console.log('Відправляю запит до Replicate.');
          
          // Перевіряємо наявність обов'язкових даних
          if (!data.generatedPrompt) {
            throw new Error('Відсутній згенерований промпт');
          }
          
          // Спробуємо FormData формат
          const formDataForMake = new FormData();
          formDataForMake.append('prompt', data.generatedPrompt);
          formDataForMake.append('imageUrl', photoUrl);
          
          if (formDataWithUrl.photo) {
            console.log('✅ Використовую реальне фото користувача:', photoUrl);
          } else {
            console.log('⚠️ Використовую ваше зображення як заглушку:', photoUrl);
          }
          
          formDataForMake.append('style', formDataWithUrl.cardStyle || '');
          formDataForMake.append('mood', formDataWithUrl.cardMood || '');
          formDataForMake.append('hobby', formDataWithUrl.hobby || '');
          formDataForMake.append('trait', formDataWithUrl.trait || '');
          formDataForMake.append('greeting', formDataWithUrl.greetingText || '');
          
          // Крок 3: Генерація зображення через локальний бекенд Replicate
          const imageGenerationResponse = await fetch(API_URLS.GENERATE_IMAGE_REPLICATE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              modelId: "black-forest-labs/flux-kontext-pro",
              input: {
                prompt: "Make this a 90s cartoon",
                input_image: photoUrl,
                aspect_ratio: "match_input_image",
                // strength: 0.8 // можна додати додаткові параметри за потреби
              }
            }),
          });


          if (imageGenerationResponse.ok) {
            const responseText = await imageGenerationResponse.text();

            console.log('Відповідь від Replicate (text):', responseText);

            // Якщо відповідь - це просто URL зображення
            if (responseText && (responseText.startsWith('http') || responseText.startsWith('"http'))) {
              const generatedImageUrl = responseText.trim().replace(/"/g, '');
              setGeneratedImageUrl(generatedImageUrl);
              
              if (onImageGenerated) {
                onImageGenerated("finalGeneratedImageUrl", generatedImageUrl);
              }
            } else {
              // Спробуємо парсити як JSON
              try {
                const imageData = JSON.parse(responseText);
                console.log('Дані від replicate (JSON):', imageData);
                
                if (imageData.generatedImageUrl) {
                  setGeneratedImageUrl(imageData.generatedImageUrl);
                  
                  if (onImageGenerated) {
                    onImageGenerated("finalGeneratedImageUrl", imageData.generatedImageUrl);
                  }
                } else {
                  console.warn('replicateповернув дані без generatedImageUrl:', imageData);
                }
              } catch (parseError) {
                console.warn('Не вдалося парсити відповідь replicateяк JSON:', parseError);
              }
            }
          } else {
            const errorText = await imageGenerationResponse.text();
            console.error('❌ replicateпомилка:', {
              status: imageGenerationResponse.status,
              statusText: imageGenerationResponse.statusText,
              body: errorText,
            });
            
            console.warn('Помилка при генерації фінального зображення через replicate');
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
