// "use client"

// import { useRef, useState, useEffect } from "react"
// import { Canvas } from "@react-three/fiber"
// import { OrbitControls } from "@react-three/drei"
// import { Mic, MicOff } from "lucide-react"
// import { Button } from "@/components/ui/button"
// import { AudioReactiveOrb } from "@/components/audio-reactive-orb"

// export function AudioVisualizer() {
//   const [audioData, setAudioData] = useState<Uint8Array | null>(null)
//   const [isCapturing, setIsCapturing] = useState(false)
//   const [circleSize, setCircleSize] = useState(300) // Base size in pixels

//   const audioContextRef = useRef<AudioContext | null>(null)
//   const analyserRef = useRef<AnalyserNode | null>(null)
//   const dataArrayRef = useRef<Uint8Array | null>(null)
//   const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
//   const streamRef = useRef<MediaStream | null>(null)
//   const animationFrameRef = useRef<number | null>(null)

//   // Update circle size based on audio
//   useEffect(() => {
//     if (audioData && audioData.length > 0) {
//       // Get bass frequency for size changes (first few frequency bins)
//       const bassFreq = audioData.slice(0, 5).reduce((a, b) => a + b, 0) / (5 * 255)

//       // Calculate new size with smoothing (base size + audio response)
//       const newSize = 300 + bassFreq * 60 // Base size 300px + up to 60px extra
//       setCircleSize((prevSize) => prevSize * 0.8 + newSize * 0.2) // Smooth transition
//     }
//   }, [audioData])

//   const toggleAudioCapture = async () => {
//     if (isCapturing) {
//       // Stop capturing
//       if (animationFrameRef.current) {
//         cancelAnimationFrame(animationFrameRef.current)
//         animationFrameRef.current = null
//       }

//       if (streamRef.current) {
//         streamRef.current.getTracks().forEach((track) => track.stop())
//         streamRef.current = null
//       }

//       if (audioContextRef.current) {
//         await audioContextRef.current.close()
//         audioContextRef.current = null
//       }

//       setAudioData(null)
//       setIsCapturing(false)
//       setCircleSize(300) // Reset to base size
//     } else {
//       // Start capturing
//       try {
//         // Request microphone access
//         const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
//         streamRef.current = stream

//         // Create audio context and analyzer
//         const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
//         audioContextRef.current = audioContext

//         const analyser = audioContext.createAnalyser()
//         analyser.fftSize = 256
//         analyserRef.current = analyser

//         const bufferLength = analyser.frequencyBinCount
//         const dataArray = new Uint8Array(bufferLength)
//         dataArrayRef.current = dataArray

//         const source = audioContext.createMediaStreamSource(stream)
//         source.connect(analyser)
//         sourceRef.current = source

//         // Start the animation loop
//         const updateAudioData = () => {
//           if (!analyserRef.current || !dataArrayRef.current) return

//           analyserRef.current.getByteFrequencyData(dataArrayRef.current)
//           // Create a new Uint8Array to ensure React detects the change
//           setAudioData(new Uint8Array(dataArrayRef.current))

//           animationFrameRef.current = requestAnimationFrame(updateAudioData)
//         }

//         updateAudioData()
//         setIsCapturing(true)
//       } catch (error) {
//         console.error("Error accessing microphone:", error)
//       }
//     }
//   }

//   // Clean up on unmount
//   useEffect(() => {
//     return () => {
//       if (animationFrameRef.current) {
//         cancelAnimationFrame(animationFrameRef.current)
//       }

//       if (streamRef.current) {
//         streamRef.current.getTracks().forEach((track) => track.stop())
//       }

//       if (audioContextRef.current) {
//         audioContextRef.current.close()
//       }
//     }
//   }, [])

//   return (
//     <div className="relative flex items-center justify-center w-full h-full">
//       {/* Circular container that grows and shrinks with audio */}
//       <div
//         className="relative rounded-full overflow-hidden border border-gray-700/40 shadow-[0_0_30px_rgba(0,114,255,0.2)]"
//         style={{
//           width: `${circleSize}px`,
//           height: `${circleSize}px`,
//           transition: "width 0.2s ease-out, height 0.2s ease-out",
//           aspectRatio: "1/1",
//         }}
//       >
//         {/* Canvas with the cloud-like visualization confined to the circle */}
//         <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
//           <ambientLight intensity={0.5} />
//           <pointLight position={[10, 10, 10]} intensity={1} />
//           <pointLight position={[-10, -10, -10]} intensity={0.5} color="#0080ff" />
//           <AudioReactiveOrb audioData={audioData} />
//           <OrbitControls enableZoom={false} enablePan={false} />
//         </Canvas>
//       </div>

//       {/* Controls */}
//       <div className="absolute bottom-4 right-4 z-20">
//         <Button
//           variant="outline"
//           size="icon"
//           onClick={toggleAudioCapture}
//           className={`rounded-full ${isCapturing ? "bg-red-500 hover:bg-red-600" : "bg-primary hover:bg-primary/90"}`}
//         >
//           {isCapturing ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
//         </Button>
//       </div>
//     </div>
//   )
// }

