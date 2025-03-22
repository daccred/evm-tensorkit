import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Line } from 'react-konva';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface CustomAudioRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

const CustomAudioRecorder: React.FC<CustomAudioRecorderProps> = ({ 
  onTranscription, 
  isProcessing 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioData, setAudioData] = useState<number[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const stageWidth = 300;
  const stageHeight = 100;

  // Initialize audio context and analyzer
  const initAudio = async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      // Create audio context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      // Create analyzer
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      // Create buffer
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;
      
      // Connect microphone to analyzer
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;
      
      // Create media recorder
      const recorder = new MediaRecorder(stream);
      setMediaRecorder(recorder);
      
      // Handle data available event
      recorder.ondataavailable = (e) => {
        setAudioChunks(prev => [...prev, e.data]);
      };
      
      // Handle recording stop event
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        setAudioChunks([]);
      };
      
      // Start visualization
      startVisualization();
    } catch (error) {
      console.error('Error initializing audio:', error);
    }
  };
  
  // Start audio visualization
  const startVisualization = () => {
    if (!analyserRef.current || !dataArrayRef.current) return;
    
    const draw = () => {
      if (!analyserRef.current || !dataArrayRef.current) return;
      
      // Get frequency data
      analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
      
      // Convert to array for visualization
      const newData = Array.from(dataArrayRef.current).map(value => {
        // Convert 0-255 values to waveform representation
        // 128 is the center line (silence)
        return ((value - 128) / 128) * (stageHeight / 2) + (stageHeight / 2);
      });
      
      setAudioData(newData);
      
      // Continue animation loop
      animationFrameRef.current = requestAnimationFrame(draw);
    };
    
    draw();
  };
  
  // Start recording
  const startRecording = () => {
    if (!mediaRecorder) return;
    
    mediaRecorder.start();
    setIsRecording(true);
  };
  
  // Stop recording
  const stopRecording = () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    
    mediaRecorder.stop();
    setIsRecording(false);
  };
  
  // Toggle recording state
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };
  
  // Transcribe audio using OpenAI Whisper API
  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      
      // Send to transcription API
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const data = await response.json();
      
      // Pass transcribed text to parent component
      if (data.text) {
        onTranscription(data.text);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
    } finally {
      setIsTranscribing(false);
    }
  };
  
  // Initialize audio on component mount
  useEffect(() => {
    initAudio();
    
    // Cleanup function
    return () => {
      // Stop animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      
      // Stop media stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  // Generate points for waveform visualization
  const generatePoints = () => {
    if (audioData.length === 0) {
      // Generate flat line if no data
      return Array(50).fill(0).flatMap((_, i) => [i * (stageWidth / 50), stageHeight / 2]);
    }
    
    // Map audio data to x,y coordinates
    return audioData.flatMap((value, i) => {
      const x = i * (stageWidth / audioData.length);
      return [x, value];
    });
  };
  
  // Calculate waveform color based on recording state
  const getWaveformColor = () => {
    if (isRecording) {
      return '#ef4444'; // Red for recording
    }
    return '#3b82f6'; // Blue for idle
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Waveform visualization */}
      <div className={`border rounded-md p-2 ${isRecording ? 'border-red-500' : 'border-gray-500'}`}>
        <Stage width={stageWidth} height={stageHeight}>
          <Layer>
            <Line
              points={generatePoints()}
              stroke={getWaveformColor()}
              strokeWidth={2}
              tension={0.5}
              lineCap="round"
            />
          </Layer>
        </Stage>
      </div>
      
      {/* Recording button */}
      <Button
        onClick={toggleRecording}
        disabled={isTranscribing || isProcessing}
        variant={isRecording ? "destructive" : "default"}
        size="lg"
        className="rounded-full w-16 h-16 flex items-center justify-center"
      >
        {isRecording ? (
          <MicOff className="h-6 w-6" />
        ) : (
          <Mic className="h-6 w-6" />
        )}
      </Button>
      
      {/* Status text */}
      <div className="text-sm text-muted-foreground">
        {isRecording ? (
          <span className="text-destructive">Recording...</span>
        ) : isTranscribing ? (
          <div className="flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <span>Transcribing...</span>
          </div>
        ) : isProcessing ? (
          <div className="flex items-center">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            <span>Processing...</span>
          </div>
        ) : (
          <span>Click to record</span>
        )}
      </div>
    </div>
  );
};

export default CustomAudioRecorder;