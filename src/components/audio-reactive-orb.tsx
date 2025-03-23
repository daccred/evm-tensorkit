"use client"

import { useRef, useState, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"
import { MeshDistortMaterial } from "@react-three/drei"

interface AudioReactiveOrbProps {
  audioData: Uint8Array | null
}

export function AudioReactiveOrb({ audioData }: AudioReactiveOrbProps) {
  // Refs for all cloud layers
  const groupRef = useRef<THREE.Group>(null)
  const primaryMeshRef = useRef<THREE.Mesh>(null)
  const secondaryMeshRef = useRef<THREE.Mesh>(null)
  const tertiaryMeshRef = useRef<THREE.Mesh>(null)
  const quaternaryMeshRef = useRef<THREE.Mesh>(null)

  // State for primary cloud layer
  const [primaryDistort, setPrimaryDistort] = useState(0.3)
  const [primarySpeed, setPrimarySpeed] = useState(0.5)
  const [primaryEmissive, setPrimaryEmissive] = useState(0.5)

  // State for secondary cloud layer
  const [secondaryDistort, setSecondaryDistort] = useState(0.4)
  const [secondarySpeed, setSecondarySpeed] = useState(0.3)
  const [secondaryEmissive, setSecondaryEmissive] = useState(0.4)

  // State for tertiary cloud layer
  const [tertiaryDistort, setTertiaryDistort] = useState(0.5)
  const [tertiarySpeed, setTertiarySpeed] = useState(0.2)
  const [tertiaryEmissive, setTertiaryEmissive] = useState(0.3)

  // State for quaternary cloud layer
  const [quaternaryDistort, setQuaternaryDistort] = useState(0.6)
  const [quaternarySpeed, setQuaternarySpeed] = useState(0.15)
  const [quaternaryEmissive, setQuaternaryEmissive] = useState(0.2)

  // Create gradient textures for different cloud layers
  const primaryGradient = useMemo(() => createGradientTexture(["#ff3d00", "#ff9e00", "#0072ff", "#00c6ff"]), [])
  const secondaryGradient = useMemo(() => createGradientTexture(["#ff5722", "#ff9800", "#2196f3", "#03a9f4"]), [])
  const tertiaryGradient = useMemo(() => createGradientTexture(["#f44336", "#ff9800", "#3f51b5", "#00bcd4"]), [])
  const quaternaryGradient = useMemo(() => createGradientTexture(["#e91e63", "#ff9800", "#673ab7", "#4fc3f7"]), [])

  // Animation loop
  useFrame((state, delta) => {
    if (
      !groupRef.current ||
      !primaryMeshRef.current ||
      !secondaryMeshRef.current ||
      !tertiaryMeshRef.current ||
      !quaternaryMeshRef.current
    )
      return

    // Rotate the entire group slowly
    groupRef.current.rotation.y += delta * 0.05
    groupRef.current.rotation.x += delta * 0.02

    // Different rotation speeds for each cloud layer to create more organic movement
    primaryMeshRef.current.rotation.y += delta * 0.03
    secondaryMeshRef.current.rotation.z += delta * 0.02
    tertiaryMeshRef.current.rotation.x += delta * 0.04
    quaternaryMeshRef.current.rotation.z -= delta * 0.01

    if (audioData && audioData.length > 0) {
      // Calculate average volume from audio data
      const sum = audioData.reduce((acc, val) => acc + val, 0)
      const avg = sum / audioData.length / 255 // Normalize to 0-1

      // Get frequency bands for more interesting effects
      const bassFreq = audioData.slice(0, 5).reduce((a, b) => a + b, 0) / (5 * 255)
      const lowMidFreq = audioData.slice(5, 10).reduce((a, b) => a + b, 0) / (5 * 255)
      const highMidFreq = audioData.slice(10, 20).reduce((a, b) => a + b, 0) / (10 * 255)
      const highFreq = audioData.slice(20, 30).reduce((a, b) => a + b, 0) / (10 * 255)

      // Update primary cloud layer (responds most to high frequencies)
      const newPrimaryDistort = 0.3 + highFreq * 0.4
      const newPrimarySpeed = 0.5 + highFreq * 1.2
      const newPrimaryEmissive = 0.5 + avg * 0.8

      // Update secondary cloud layer (responds most to high-mid frequencies)
      const newSecondaryDistort = 0.4 + highMidFreq * 0.4
      const newSecondarySpeed = 0.3 + highMidFreq * 1.0
      const newSecondaryEmissive = 0.4 + avg * 0.7

      // Update tertiary cloud layer (responds most to low-mid frequencies)
      const newTertiaryDistort = 0.5 + lowMidFreq * 0.4
      const newTertiarySpeed = 0.2 + lowMidFreq * 0.8
      const newTertiaryEmissive = 0.3 + avg * 0.6

      // Update quaternary cloud layer (responds most to bass frequencies)
      const newQuaternaryDistort = 0.6 + bassFreq * 0.4
      const newQuaternarySpeed = 0.15 + bassFreq * 0.6
      const newQuaternaryEmissive = 0.2 + avg * 0.5

      // Smooth transitions (80% old value, 20% new value for more cloud-like slow movement)
      setPrimaryDistort((prev) => prev * 0.8 + newPrimaryDistort * 0.2)
      setPrimarySpeed((prev) => prev * 0.8 + newPrimarySpeed * 0.2)
      setPrimaryEmissive((prev) => prev * 0.8 + newPrimaryEmissive * 0.2)

      setSecondaryDistort((prev) => prev * 0.8 + newSecondaryDistort * 0.2)
      setSecondarySpeed((prev) => prev * 0.8 + newSecondarySpeed * 0.2)
      setSecondaryEmissive((prev) => prev * 0.8 + newSecondaryEmissive * 0.2)

      setTertiaryDistort((prev) => prev * 0.8 + newTertiaryDistort * 0.2)
      setTertiarySpeed((prev) => prev * 0.8 + newTertiarySpeed * 0.2)
      setTertiaryEmissive((prev) => prev * 0.8 + newTertiaryEmissive * 0.2)

      setQuaternaryDistort((prev) => prev * 0.8 + newQuaternaryDistort * 0.2)
      setQuaternarySpeed((prev) => prev * 0.8 + newQuaternarySpeed * 0.2)
      setQuaternaryEmissive((prev) => prev * 0.8 + newQuaternaryEmissive * 0.2)

      // Subtle scale changes based on different frequency bands
      const primaryScale = 1 + highFreq * 0.1
      const secondaryScale = 0.9 + highMidFreq * 0.1
      const tertiaryScale = 0.8 + lowMidFreq * 0.1
      const quaternaryScale = 0.7 + bassFreq * 0.1

      primaryMeshRef.current.scale.set(primaryScale, primaryScale, primaryScale)
      secondaryMeshRef.current.scale.set(secondaryScale, secondaryScale, secondaryScale)
      tertiaryMeshRef.current.scale.set(tertiaryScale, tertiaryScale, tertiaryScale)
      quaternaryMeshRef.current.scale.set(quaternaryScale, quaternaryScale, quaternaryScale)
    }
  })

  // Helper function to create gradient textures
  function createGradientTexture(colors: string[]) {
    const canvas = document.createElement("canvas")
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext("2d")

    if (ctx) {
      // Create a radial gradient
      const gradient = ctx.createRadialGradient(
        256,
        256,
        0, // inner circle center and radius
        256,
        256,
        256, // outer circle center and radius
      )

      // Add color stops
      if (colors.length >= 4) {
        gradient.addColorStop(0, colors[0])
        gradient.addColorStop(0.4, colors[1])
        gradient.addColorStop(0.7, colors[2])
        gradient.addColorStop(1, colors[3])
      }

      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 512, 512)

      // Add some noise/texture for cloud-like appearance
      ctx.globalCompositeOperation = "overlay"
      for (let i = 0; i < 20000; i++) {
        const x = Math.random() * 512
        const y = Math.random() * 512
        const r = Math.random() * 1.5
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`
        ctx.fill()
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.needsUpdate = true
    return texture
  }

  return (
    <group ref={groupRef}>
      {/* Primary cloud layer */}
      <mesh ref={primaryMeshRef} position={[0, 0, 0]}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshDistortMaterial
          color="#ffffff"
          emissive="#4facfe"
          emissiveIntensity={primaryEmissive}
          metalness={0.6}
          roughness={0.4}
          distort={primaryDistort}
          speed={primarySpeed}
          transparent={true}
          opacity={0.8}
          map={primaryGradient}
        />
      </mesh>

      {/* Secondary cloud layer */}
      <mesh ref={secondaryMeshRef} position={[0.2, 0.1, 0.1]} rotation={[0, Math.PI / 6, 0]}>
        <sphereGeometry args={[0.9, 48, 48]} />
        <MeshDistortMaterial
          color="#ffffff"
          emissive="#4facfe"
          emissiveIntensity={secondaryEmissive}
          metalness={0.5}
          roughness={0.5}
          distort={secondaryDistort}
          speed={secondarySpeed}
          transparent={true}
          opacity={0.7}
          map={secondaryGradient}
        />
      </mesh>

      {/* Tertiary cloud layer */}
      <mesh ref={tertiaryMeshRef} position={[-0.2, -0.1, 0.2]} rotation={[0, -Math.PI / 8, 0]}>
        <sphereGeometry args={[0.8, 40, 40]} />
        <MeshDistortMaterial
          color="#ffffff"
          emissive="#4facfe"
          emissiveIntensity={tertiaryEmissive}
          metalness={0.4}
          roughness={0.6}
          distort={tertiaryDistort}
          speed={tertiarySpeed}
          transparent={true}
          opacity={0.6}
          map={tertiaryGradient}
        />
      </mesh>

      {/* Quaternary cloud layer */}
      <mesh ref={quaternaryMeshRef} position={[0, -0.2, -0.1]} rotation={[Math.PI / 10, 0, 0]}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <MeshDistortMaterial
          color="#ffffff"
          emissive="#4facfe"
          emissiveIntensity={quaternaryEmissive}
          metalness={0.3}
          roughness={0.7}
          distort={quaternaryDistort}
          speed={quaternarySpeed}
          transparent={true}
          opacity={0.5}
          map={quaternaryGradient}
        />
      </mesh>

      {/* Inner core - shared by all cloud layers */}
      <mesh scale={[0.5, 0.5, 0.5]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ff3d00" transparent={true} opacity={0.4} />
      </mesh>
    </group>
  )
}

