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

  // Generate image paths for your 1160 frames
  const images = Array.from({ length: 1160 }, (_, i) => ({
    id: i,
    url: `/images/frame_${i}.jpg`,
    thumb: `/images/frame_${i}.jpg`
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
    if (audioRef.current) {
      audioRef.current.play().catch(e => console.log('Auto-play prevented:', e));
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
    ctx.strokeStyle = '#FFFF00';
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
    <div className="w-full h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="bg-red-600 text-black text-center py-3 text-2xl font-bold italic">
        ALL NOISE IS POTENTIAL SIGNAL
      </div>

      {/* Audio Element */}
      <audio ref={audioRef} loop>
        <source src="/audio.mp3" type="audio/mpeg" />
      </audio>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Image Grid */}
        <div className="grid gap-px bg-yellow-600 h-full overflow-y-auto p-px" style={{
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
        }}>
          {images.map((img) => (
            <div
              key={img.id}
              className="bg-black cursor-pointer relative hover:opacity-80 transition-opacity"
              style={{ aspectRatio: '16/9' }}
              onClick={() => openGalleryView(img.id)}
            >
              <img
                src={img.thumb}
                alt={`Frame ${img.id}`}
                className="w-full h-full object-cover"
              />
              {annotations[img.id] && annotations[img.id].length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {annotations[img.id].map((ann, idx) => (
                    <div
                      key={idx}
                      className="absolute border-2 border-yellow-400"
                      style={{
                        left: `${(Math.min(ann.startX, ann.endX) / 1600) * 100}%`,
                        top: `${(Math.min(ann.startY, ann.endY) / 900) * 100}%`,
                        width: ann.type === 'rectangle' ? `${(Math.abs(ann.endX - ann.startX) / 1600) * 100}%` : '20px',
                        height: ann.type === 'rectangle' ? `${(Math.abs(ann.endY - ann.startY) / 900) * 100}%` : '20px',
                        borderRadius: ann.type === 'circle' ? '50%' : '0'
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Gallery View Modal */}
        {selectedImage !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center p-4">
              {/* Close Button */}
              <button
                onClick={closeGalleryView}
                className="absolute top-4 right-4 text-yellow-400 hover:text-yellow-300 z-50"
              >
                <X size={48} />
              </button>

              {/* Previous Button */}
              <button
                onClick={() => navigateImage(-1)}
                className="absolute left-4 text-yellow-400 hover:text-yellow-300 text-6xl z-50"
              >
                <ChevronLeft size={64} />
              </button>

              {/* Image Container */}
              <div className="relative max-w-5xl max-h-[80vh] border-4 border-yellow-400">
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
                {/* Custom Cursor */}
                {showCursor && (
                  <div
                    className="absolute pointer-events-none"
                    style={{
                      left: cursorPos.x,
                      top: cursorPos.y,
                      width: '40px',
                      height: '40px',
                      border: '5px solid red',
                      borderRadius: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 1000
                    }}
                  />
                )}
              </div>

              {/* Next Button */}
              <button
                onClick={() => navigateImage(1)}
                className="absolute right-4 text-yellow-400 hover:text-yellow-300 text-6xl z-50"
              >
                <ChevronRight size={64} />
              </button>

              {/* Tool Selection */}
              <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex gap-4 bg-yellow-400 p-3 rounded z-50">
                <button
                  onClick={() => setCurrentTool(currentTool === 'circle' ? null : 'circle')}
                  className={`p-3 rounded ${currentTool === 'circle' ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black'} hover:bg-gray-800 hover:text-yellow-400 transition-colors`}
                >
                  <Circle size={24} />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'rectangle' ? null : 'rectangle')}
                  className={`p-3 rounded ${currentTool === 'rectangle' ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black'} hover:bg-gray-800 hover:text-yellow-400 transition-colors`}
                >
                  <Square size={24} />
                </button>
                <button
                  onClick={() => setCurrentTool(currentTool === 'arrow' ? null : 'arrow')}
                  className={`p-3 rounded ${currentTool === 'arrow' ? 'bg-black text-yellow-400' : 'bg-yellow-400 text-black'} hover:bg-gray-800 hover:text-yellow-400 transition-colors`}
                >
                  <MoveRight size={24} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Information Panel */}
        <div
          className={`absolute bottom-0 left-0 right-0 bg-red-600 transition-transform duration-300 ${
            infoOpen ? 'translate-y-0' : 'translate-y-full'
          }`}
          style={{ height: 'calc(100% - 120px)' }}
        >
          <div className="p-8 text-black overflow-y-auto h-full">
            <p className="text-lg leading-relaxed mb-4">
              Lorem ipsum dolor sit amet, consectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat. Duis autem vel eum iriure dolor in hendrerit in vulputate velit esse molestie consequat, vel illum dolore eu feugiat nulla facilisis at vero eros et accumsan et iusto odio dignissim qui blandit praesent luptatum zzril delenit augue duis dolore te feugait nulla facilisi.
            </p>
            <p className="text-lg leading-relaxed">
              Lorem ipsum dolor sit amet, cons ectetuer adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim veniam, quis nostrud exerci tation ullamcorper suscipit lobortis nisl ut aliquip ex ea commodo consequat.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-red-600 text-black py-3 px-6 flex justify-between items-center text-lg font-bold italic">
        <button
          onClick={() => setInfoOpen(!infoOpen)}
          className="hover:underline"
        >
          INFORMATION
        </button>
        <div className="flex gap-8">
          <button
            onClick={toggleAudio}
            className={!audioPlaying ? 'underline' : ''}
          >
            PLAY
          </button>
          <button
            onClick={toggleAudio}
            className={audioPlaying ? 'underline' : ''}
          >
            / PAUSE
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;