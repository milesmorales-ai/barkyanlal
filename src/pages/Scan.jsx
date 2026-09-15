import { useState, useRef } from 'react';
import { useItems } from '../context/ItemContext';

export default function Scan() {
  const [image, setImage] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedItems, setDetectedItems] = useState([]);
  const fileInputRef = useRef(null);
  const { addItem } = useItems();

  const handleCapture = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result);
        setIsScanning(true);
        // Simulate AI detection (replace with actual AI later)
        setTimeout(() => {
          const mockDetections = [
            { name: 'Tomato', confidence: 92, location: 'fridge' },
            { name: 'Onion', confidence: 85, location: 'cabinet' },
          ];
          setDetectedItems(mockDetections);
          setIsScanning(false);
        }, 2000);
      };
      reader.readAsDataURL(file);
    }
  };

  const addDetectedItem = (item) => {
    addItem({
      name: item.name,
      quantity: 1,
      location: item.location || 'fridge',
      expiryDate: '',
      notes: `Detected with ${item.confidence}% confidence`
    });
    alert(`✅ Added ${item.name} to your items!`);
  };

  return (
    <div>
      <h2>📸 Scan Items</h2>
      <p style={{ color: '#555', marginBottom: '20px' }}>
        Take a photo of your items and AI will detect them
      </p>

      {/* Camera Button */}
      <div style={{
        background: '#f5f5f5',
        borderRadius: '16px',
        padding: '30px',
        textAlign: 'center',
        border: '2px dashed #ddd',
        marginBottom: '20px'
      }}>
        {image ? (
          <div>
            <img 
              src={image} 
              alt="Captured" 
              style={{ 
                maxWidth: '100%', 
                maxHeight: '300px', 
                borderRadius: '12px',
                marginBottom: '15px'
              }} 
            />
            <button
              onClick={() => {
                setImage(null);
                setDetectedItems([]);
              }}
              style={{
                padding: '8px 20px',
                background: '#ff4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              Retake
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '64px', margin: '0' }}>📷</p>
            <p style={{ color: '#888' }}>Tap to capture items</p>
            <button
              onClick={() => fileInputRef.current.click()}
              style={{
                padding: '12px 30px',
                background: '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '30px',
                fontSize: '18px',
                cursor: 'pointer',
                marginTop: '10px'
              }}
            >
              Open Camera
            </button>
          </div>
        )}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleCapture}
          style={{ display: 'none' }}
        />
      </div>

      {/* Scanning Status */}
      {isScanning && (
        <div style={{
          textAlign: 'center',
          padding: '20px',
          background: 'white',
          borderRadius: '12px'
        }}>
          <p style={{ fontSize: '24px' }}>🤖</p>
          <p>Scanning items...</p>
          <div style={{
            width: '100%',
            height: '4px',
            background: '#e0e0e0',
            borderRadius: '2px',
            marginTop: '10px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: '100%',
              height: '100%',
              background: '#4CAF50',
              animation: 'scanProgress 2s ease-in-out'
            }} />
          </div>
        </div>
      )}

      {/* Detected Items */}
      {detectedItems.length > 0 && (
        <div>
          <h3 style={{ marginBottom: '10px' }}>🔍 Detected Items</h3>
          {detectedItems.map((item, index) => (
            <div
              key={index}
              style={{
                background: 'white',
                padding: '12px 16px',
                borderRadius: '10px',
                marginBottom: '10px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
            >
              <div>
                <strong>{item.name}</strong>
                <span style={{ 
                  marginLeft: '10px', 
                  fontSize: '12px', 
                  color: '#4CAF50',
                  background: '#e8f5e9',
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {item.confidence}% confidence
                </span>
              </div>
              <button
                onClick={() => addDetectedItem(item)}
                style={{
                  padding: '6px 16px',
                  background: '#4CAF50',
                  color: 'white',
                  border: 'none',
                  borderRadius: '20px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                + Add
              </button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes scanProgress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}