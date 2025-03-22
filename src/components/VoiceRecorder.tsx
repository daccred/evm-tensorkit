import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';

// Dynamically import the media recorder with no SSR
const ReactMediaRecorderComponent = dynamic(
  () => import('react-media-recorder').then(mod => {
    // Return the component that uses the hook
    return function UseMediaRecorder(props: any) {
      const recorder = mod.useReactMediaRecorder(props);
      return props.children(recorder);
    };
  }),
  { ssr: false }
);

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  isProcessing: boolean;
}

function VoiceRecorderComponent({ onTranscription, isProcessing }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // We'll use the recorder inside the dynamically loaded component
  const [recorderState, setRecorderState] = useState<any>({
    status: 'idle',
    startRecording: () => {},
    stopRecording: () => {},
    mediaBlobUrl: null
  });

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsTranscribing(true);
      
      // Create a FormData object to send the audio file
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      
      // Send the audio to OpenAI's Whisper API via a proxy endpoint
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Transcription failed');
      }
      
      const data = await response.json();
      
      // Pass the transcribed text to the parent component
      if (data.text) {
        onTranscription(data.text);
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      recorderState.stopRecording();
    } else {
      recorderState.startRecording();
    }
    setIsRecording(!isRecording);
  };

  return (
    <ReactMediaRecorderComponent
      audio
      onStop={async (blobUrl: string, blob: Blob) => {
        if (blob) {
          await transcribeAudio(blob);
        }
      }}
    >
      {(recorder: any) => {
        // Store the recorder state for use in toggleRecording
        useEffect(() => {
          setRecorderState(recorder);
        }, [recorder]);
        
        return (
          <div className="flex flex-col items-center space-y-4">
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
      }}
    </ReactMediaRecorderComponent>
  );
}

// Export a client-side only component
export const VoiceRecorder = dynamic(
  () => Promise.resolve(VoiceRecorderComponent),
  { ssr: false }
);