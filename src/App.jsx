import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Circle, Square, MoveRight } from 'lucide-react';
import { ref, onValue, set } from 'firebase/database';
import { database } from './firebase';

const App = () => {
  const [infoOpen, setInfoOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [annotations, setAnnotations] = useState({});
  const [currentTool, setCurrentTool] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentAnnotation, setCurrentAnnotation] = useState(null);
  const [audioPlaying, setAudioPlaying] = useState(true);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const audioRef = useRef(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [showCursor, setShowCursor] = useState(false);

  // Generate image paths for your 1001 frames (frame_0000.jpg to frame_1000.jpg)
  const images = Array.from({ length: 1001 }, (_, i) => ({
    id: i,
    url: `/images/frame_${i.toString().padStart(4, '0')}.jpg`,
    thumb: `/images/frame_${i.toString().padStart(4, '0')}.jpg`
  }));

  // Load annotations from Firebase
  useEffect(() => {
    const annotationsRef = ref(database, 'annotations');
    
    const unsubscribe = onValue(annotationsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setAnnotations(data);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (selectedImage !== null) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          navigateImage(-1);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          navigateImage(1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedImage]);

  useEffect(() => {
    if (audioRef.current) {
      // Try to play automatically, but handle if browser blocks it
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Auto-play was blocked:', error);
          setAudioPlaying(false); // Update state if auto-play fails
        });
      }
    }
  }, []);

  const toggleAudio = () => {
    if (audioRef.current) {
      if (audioPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setAudioPlaying(!audioPlaying);
    }
  };

  const openGalleryView = (imageId) => {
    setSelectedImage(imageId);
    setCurrentTool(null);
  };

  const closeGalleryView = () => {
    setSelectedImage(null);
    setCurrentTool(null);
  };

  const navigateImage = (direction) => {
    const currentIndex = images.findIndex(img => img.id === selectedImage);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = images.length - 1;
    if (newIndex >= images.length) newIndex = 0;
    setSelectedImage(images[newIndex].id);
  };

  const getMousePos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e) => {
    if (!currentTool) return;
    const pos = getMousePos(e);
    setIsDrawing(true);
    setCurrentAnnotation({
      type: currentTool,
      startX: pos.x,
      startY: pos.y,
      endX: pos.x,
      endY: pos.y
    });
  };

  const handleMouseMove = (e) => {
    const pos = getMousePos(e);
    const rect = canvasRef.current.getBoundingClientRect();
    setCursorPos({ 
      x: e.clientX - rect.left, 
      y: e.clientY - rect.top 
    });

    if (!isDrawing || !currentAnnotation) return;
    setCurrentAnnotation({
      ...currentAnnotation,
      endX: pos.x,
      endY: pos.y
    });
    drawCanvas();
  };

  const handleMouseUp = () => {
    if (isDrawing && currentAnnotation) {
      const imageAnnotationsRef = ref(database, `annotations/${selectedImage}`);
      const currentImageAnnotations = annotations[selectedImage] || [];
      const newAnnotations = [...currentImageAnnotations, currentAnnotation];
      
      set(imageAnnotationsRef, newAnnotations);
      
      setCurrentAnnotation(null);
      setIsDrawing(false);
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    if (!img || !img.complete) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const imageAnnotations = annotations[selectedImage] || [];
    imageAnnotations.forEach(ann => drawAnnotation(ctx, ann));
    
    if (currentAnnotation) {
      drawAnnotation(ctx, currentAnnotation);
    }
  };

  const drawAnnotation = (ctx, ann) => {
    ctx.strokeStyle = '#fff200';
    ctx.lineWidth = 3;
    
    const width = ann.endX - ann.startX;
    const height = ann.endY - ann.startY;
    
    if (ann.type === 'circle') {
      const radius = Math.sqrt(width * width + height * height) / 2;
      const centerX = (ann.startX + ann.endX) / 2;
      const centerY = (ann.startY + ann.endY) / 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (ann.type === 'rectangle') {
      ctx.strokeRect(ann.startX, ann.startY, width, height);
    } else if (ann.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(ann.startX, ann.startY);
      ctx.lineTo(ann.endX, ann.endY);
      ctx.stroke();
      
      const angle = Math.atan2(ann.endY - ann.startY, ann.endX - ann.startX);
      const headLength = 20;
      ctx.beginPath();
      ctx.moveTo(ann.endX, ann.endY);
      ctx.lineTo(
        ann.endX - headLength * Math.cos(angle - Math.PI / 6),
        ann.endY - headLength * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(ann.endX, ann.endY);
      ctx.lineTo(
        ann.endX - headLength * Math.cos(angle + Math.PI / 6),
        ann.endY - headLength * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (selectedImage !== null) {
      drawCanvas();
    }
  }, [annotations, currentAnnotation, selectedImage]);

  const handleImageLoad = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (canvas && img) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      drawCanvas();
    }
  };

  return (
    <div className="w-full h-screen bg-black flex flex-col" style={{ cursor: 'none' }}>
      {/* Custom Cursor for homepage */}
      {!selectedImage && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: cursorPos.x,
            top: cursorPos.y,
            width: '70px',
            height: '70px',
            border: '5px solid #fff200',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}

      {/* Header */}
      <div className="bg-black text-white text-center py-3 text-2xl font-bold italic text-header">
        ALL NOISE IS POTENTIAL <span style={{ color: '#fff200' }}>SIGNAL</span>
      </div>

      {/* Audio Element */}
      <audio ref={audioRef} loop>
        <source src="/audio.mp3" type="audio/mpeg" />
      </audio>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative" 
           onMouseMove={(e) => setCursorPos({ x: e.clientX, y: e.clientY })}>
        {/* Image Grid */}
        <div className="grid bg-black h-full overflow-y-auto" style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))'
        }}>
          {images.map((img) => (
            <div
              key={img.id}
              data-image-id={img.id}
              className="bg-black cursor-pointer relative"
              style={{ aspectRatio: '16/9', border: '1px solid white' }}
              onClick={() => openGalleryView(img.id)}
            >
              <img
                src={img.thumb}
                alt={`Frame ${img.id}`}
                className="w-full h-full object-cover"
              />
              {annotations[img.id] && annotations[img.id].length > 0 && (
                <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
                  {annotations[img.id].map((ann, idx) => {
                    console.log('Rendering annotation:', ann, 'for image:', img.id);
                    
                    // Use actual image dimensions from your files
                    const originalWidth = 1600;  // Your actual image width
                    const originalHeight = 900;  // Your actual image height
                    
                    // Get the actual thumbnail container dimensions
                    const thumbnailContainer = document.querySelector(`[data-image-id="${img.id}"]`);
                    const thumbWidth = thumbnailContainer ? thumbnailContainer.offsetWidth : 280;
                    const thumbHeight = thumbnailContainer ? thumbnailContainer.offsetHeight : 157.5; // 16:9 ratio
                    
                    const scaleX = thumbWidth / originalWidth;
                    const scaleY = thumbHeight / originalHeight;
                    
                    if (ann.type === 'rectangle') {
                      // Clamp rectangle to thumbnail bounds
                      const left = Math.max(0, Math.min(ann.startX, ann.endX) * scaleX);
                      const top = Math.max(0, Math.min(ann.startY, ann.endY) * scaleY);
                      const right = Math.min(thumbWidth, Math.max(ann.startX, ann.endX) * scaleX);
                      const bottom = Math.min(thumbHeight, Math.max(ann.startY, ann.endY) * scaleY);
                      const width = right - left;
                      const height = bottom - top;
                      
                      if (width > 0 && height > 0) {
                        return (
                          <div
                            key={idx}
                            className="absolute bg-transparent"
                            style={{
                              left: `${left}px`,
                              top: `${top}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                              border: '2px solid #fff200',
                              zIndex: 20,
                            }}
                          />
                        );
                      }
                    } else if (ann.type === 'circle') {
                      const width = ann.endX - ann.startX;
                      const height = ann.endY - ann.startY;
                      const radius = Math.sqrt(width * width + height * height) / 2;
                      const centerX = (ann.startX + ann.endX) / 2;
                      const centerY = (ann.startY + ann.endY) / 2;
                      const scaledRadius = radius * Math.min(scaleX, scaleY);
                      
                      // Clamp circle to thumbnail bounds
                      const scaledCenterX = Math.max(scaledRadius, Math.min(thumbWidth - scaledRadius, centerX * scaleX));
                      const scaledCenterY = Math.max(scaledRadius, Math.min(thumbHeight - scaledRadius, centerY * scaleY));
                      
                      return (
                        <div
                          key={idx}
                          className="absolute rounded-full bg-transparent"
                          style={{
                            left: `${scaledCenterX - scaledRadius}px`,
                            top: `${scaledCenterY - scaledRadius}px`,
                            width: `${scaledRadius * 2}px`,
                            height: `${scaledRadius * 2}px`,
                            border: '2px solid #fff200',
                            zIndex: 20,
                          }}
                        />
                      );
                    } else if (ann.type === 'arrow') {
                      // Clamp arrow endpoints to thumbnail bounds
                      const startX = Math.max(0, Math.min(thumbWidth, ann.startX * scaleX));
                      const startY = Math.max(0, Math.min(thumbHeight, ann.startY * scaleY));
                      const endX = Math.max(0, Math.min(thumbWidth, ann.endX * scaleX));
                      const endY = Math.max(0, Math.min(thumbHeight, ann.endY * scaleY));
                      
                      const length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
                      const angle = Math.atan2(endY - startY, endX - startX);
                      
                      if (length > 0) {
                        return (
                          <div
                            key={idx}
                            className="absolute"
                            style={{
                              left: `${startX}px`,
                              top: `${startY}px`,
                              width: `${length}px`,
                              height: '2px',
                              backgroundColor: '#fff200',
                              transformOrigin: '0 0',
                              transform: `rotate(${angle}rad)`,
                              zIndex: 20,
                            }}
                          />
                        );
                      }
                    }
                    return null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Gallery View Modal */}
        {selectedImage !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center"
               onMouseMove={(e) => setCursorPos({ x: e.clientX, y: e.clientY })}>
            {/* Custom Cursor for gallery view */}
            <div
              className="fixed pointer-events-none z-50"
              style={{
                left: cursorPos.x,
                top: cursorPos.y,
                width: '70px',
                height: '70px',
                border: '5px solid #fff200',
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
            
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* Close Button */}
              <button
                onClick={closeGalleryView}
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-50"
              >
                <X size={48} />
              </button>

              {/* Previous Button */}
              <button
                onClick={() => navigateImage(-1)}
                className="absolute left-4 text-white hover:text-gray-300 text-6xl z-50"
              >
                <ChevronLeft size={64} />
              </button>

              {/* Image Container */}
              <div className="relative max-w-5xl max-h-[80vh]" style={{ border: '4px solid white' }}>
                <img
                  ref={imageRef}
                  src={images[selectedImage].url}
                  alt={`Frame ${selectedImage}`}
                  className="max-w-full max-h-[80vh] object-contain"
                  onLoad={handleImageLoad}
                />
                <canvas
                  ref={canvasRef}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ cursor: 'none' }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onMouseEnter={() => setShowCursor(true)}
                  onMouseLeave={() => setShowCursor(false)}
                />
              </div>

              {/* Next Button */}
              <button
                onClick={() => navigateImage(1)}
                className="absolute right-4 text-white hover:text-gray-300 text-6xl z-50"
              >
                <ChevronRight size={64} />
              </button>

              {/* Tool Selection */}
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-4 p-3 rounded z-50 bg-black">
                <button
                  onClick={() => setCurrentTool(currentTool === 'circle' ? null : 'circle')}
                  className={`p-3 rounded ${currentTool === 'circle' ? 'bg-white text-black' : 'bg-black text-white border border-white'}`}
                >
                  <Circle size={24} />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'rectangle' ? null : 'rectangle')}
                  className={`p-3 rounded ${currentTool === 'rectangle' ? 'bg-white text-black' : 'bg-black text-white border border-white'}`}
                >
                  <Square size={24} />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'arrow' ? null : 'arrow')}
                  className={`p-3 rounded ${currentTool === 'arrow' ? 'bg-white text-black' : 'bg-black text-white border border-white'}`}
                >
                  <MoveRight size={24} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Information Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 transition-transform duration-300 ${
            infoOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ height: 'calc(100% - 120px)', backgroundColor: 'black', zIndex: 100 }}
        >
          <div className="p-8 text-white overflow-y-auto h-full">
            <div className="max-w-none md:max-w-[60%]">
              <p className="text-lg leading-relaxed mb-4">
The night of September 28, 2025, Brian taught Avrie about ghost hunting in Saint Patrick’s Cemetery in Providence, Rhode Island. They brought a GoPro camera, a cassette audio recorder, a digital audio recorder, and iPhones to take long exposure photos. This website documents their most interesting encounter through photo and audio documentation. The photos are stills from Avrie’s GoPro, which mysteriously turned out as a time lapse for this particular encounter, and the audio is from Brian’s audio recorders layered over one another. The documentation has not been edited aside from the audio layering. However, due to the failure of the video camera, Avrie created this website to find potential anomalies in the stills. Please play the audio and label images using the provided tool in the gallery view. 
             </p>
              <p className="text-lg leading-relaxed">
The interpretation is subjective, and all noise is potential signal. Thanks for your help.               </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-black text-white py-3 px-6 flex justify-between items-center text-lg font-bold italic">
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className="hover:underline"
        >
          INFORMATION
        </button>
        <div className="flex gap-8">
          <button
            onClick={toggleAudio}
            className={audioPlaying ? 'underline' : ''}
          >
            PLAY
          </button>
          <button
            onClick={toggleAudio}
            className={!audioPlaying ? 'underline' : ''}
          >
            PAUSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;