"use client"

import { useRef, useMemo } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface AudioReactiveOrbProps {
  audioData: Uint8Array | null
}

interface ShaderUniforms {
  [uniform: string]: THREE.IUniform<any>
  time: { value: number }
  distort: { value: number }
  speed: { value: number }
  color: { value: THREE.Color }
  emissive: { value: THREE.Color }
  emissiveIntensity: { value: number }
  map: { value: THREE.Texture | null }
}

export function AudioReactiveOrb({ audioData }: AudioReactiveOrbProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRefs = useRef<THREE.Mesh[]>([])
  const materialRefs = useRef<THREE.ShaderMaterial[]>([])

  // Custom shader for distortion effect
  const shaderData = useMemo(() => {
    const uniforms: ShaderUniforms = {
      time: { value: 0 },
      distort: { value: 0.3 },
      speed: { value: 0.5 },
      color: { value: new THREE.Color("#ffffff") },
      emissive: { value: new THREE.Color("#4facfe") },
      emissiveIntensity: { value: 0.5 },
      map: { value: null }
    }

    return {
      uniforms,
      vertexShader: `
        uniform float time;
        uniform float distort;
        uniform float speed;
        varying vec2 vUv;
        varying vec3 vNormal;
        
        void main() {
          vUv = uv;
          vNormal = normal;
          
          // Create distortion
          vec3 pos = position;
          float noise = sin(pos.x * 10.0 + time * speed) * 
                       sin(pos.y * 10.0 + time * speed) * 
                       sin(pos.z * 10.0 + time * speed);
          pos += normal * noise * distort;
          
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 color;
        uniform vec3 emissive;
        uniform float emissiveIntensity;
        uniform sampler2D map;
        varying vec2 vUv;
        varying vec3 vNormal;
        
        void main() {
          vec4 texColor = texture2D(map, vUv);
          vec3 light = normalize(vec3(1.0, 1.0, 1.0));
          float diff = max(dot(vNormal, light), 0.0);
          
          vec3 finalColor = mix(color, texColor.rgb, texColor.a);
          finalColor += emissive * emissiveIntensity;
          finalColor *= (diff * 0.5 + 0.5);
          
          gl_FragColor = vec4(finalColor, 0.8);
        }
      `
    }
  }, [])

  // Create gradient textures
  const gradients = useMemo(() => {
    const createGradientTexture = (colors: string[]) => {
      const canvas = document.createElement("canvas")
      canvas.width = 512
      canvas.height = 512
      const ctx = canvas.getContext("2d")

      if (ctx) {
        const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256)
        colors.forEach((color, i) => {
          gradient.addColorStop(i / (colors.length - 1), color)
        })

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 512, 512)

        // Add noise for cloud-like appearance
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

    return [
      createGradientTexture(["#ff3d00", "#ff9e00", "#0072ff", "#00c6ff"]),
      createGradientTexture(["#ff5722", "#ff9800", "#2196f3", "#03a9f4"]),
      createGradientTexture(["#f44336", "#ff9800", "#3f51b5", "#00bcd4"]),
      createGradientTexture(["#e91e63", "#ff9800", "#673ab7", "#4fc3f7"])
    ]
  }, [])

  // Animation loop
  useFrame((state, delta) => {
    if (!groupRef.current) return

    // Base rotation
    groupRef.current.rotation.y += delta * 0.05
    groupRef.current.rotation.x += delta * 0.02

    if (audioData && audioData.length > 0) {
      // Calculate frequency bands
      const bands = {
        bass: audioData.slice(0, 5).reduce((a, b) => a + b, 0) / (5 * 255),
        lowMid: audioData.slice(5, 10).reduce((a, b) => a + b, 0) / (5 * 255),
        highMid: audioData.slice(10, 20).reduce((a, b) => a + b, 0) / (10 * 255),
        high: audioData.slice(20, 30).reduce((a, b) => a + b, 0) / (10 * 255)
      }

      const avg = audioData.reduce((acc, val) => acc + val, 0) / (audioData.length * 255)

      // Update each layer
      meshRefs.current.forEach((mesh, index) => {
        if (!mesh) return

        // Calculate layer-specific values
        const layerValues = {
          distort: 0.3 + (index === 0 ? bands.high : 
                         index === 1 ? bands.highMid : 
                         index === 2 ? bands.lowMid : 
                         bands.bass) * 0.4,
          speed: 0.5 + (index === 0 ? bands.high : 
                       index === 1 ? bands.highMid : 
                       index === 2 ? bands.lowMid : 
                       bands.bass) * 0.8,
          emissive: 0.5 + avg * (0.8 - index * 0.1),
          scale: 1 - (index * 0.1) + (index === 0 ? bands.high : 
                                     index === 1 ? bands.highMid : 
                                     index === 2 ? bands.lowMid : 
                                     bands.bass) * 0.1
        }

        // Update material uniforms
        if (materialRefs.current[index]) {
          const material = materialRefs.current[index]
          material.uniforms.time.value += delta
          material.uniforms.distort.value = layerValues.distort
          material.uniforms.speed.value = layerValues.speed
          material.uniforms.emissiveIntensity.value = layerValues.emissive
        }

        // Update mesh properties
        mesh.scale.setScalar(layerValues.scale)
        mesh.rotation.y += delta * (0.03 - index * 0.01)
        mesh.rotation.z += delta * (0.02 - index * 0.005)
      })
    }
  })

  return (
    <group ref={groupRef}>
      {[0, 1, 2, 3].map((index) => {
        const shader = { ...shaderData }
        // Create a deep copy of uniforms to avoid sharing references
        shader.uniforms = {
          time: { value: 0 },
          distort: { value: 0.3 },
          speed: { value: 0.5 },
          color: { value: new THREE.Color("#ffffff") },
          emissive: { value: new THREE.Color("#4facfe") },
          emissiveIntensity: { value: 0.5 },
          map: { value: gradients[index] }
        }
        
        return (
          <mesh
            key={index}
            ref={(el) => {
              if (el) {
                meshRefs.current[index] = el
                if (el.material) {
                  materialRefs.current[index] = el.material as THREE.ShaderMaterial
                }
              }
            }}
            position={[
              index === 0 ? 0 : (index % 2 === 0 ? -0.2 : 0.2),
              index === 0 ? 0 : (index < 2 ? 0.1 : -0.1),
              index === 0 ? 0 : (index % 2 === 0 ? 0.2 : -0.1)
            ]}
            rotation={[
              index === 0 ? 0 : (index === 3 ? Math.PI / 10 : 0),
              index === 0 ? 0 : (index === 1 ? Math.PI / 6 : -Math.PI / 8),
              0
            ]}
          >
            <sphereGeometry args={[1 - (index * 0.1), 64 - (index * 8), 64 - (index * 8)]} />
            <shaderMaterial
              transparent
              uniforms={shader.uniforms}
              vertexShader={shader.vertexShader}
              fragmentShader={shader.fragmentShader}
            />
          </mesh>
        )
      })}

      {/* Inner core */}
      <mesh scale={[0.5, 0.5, 0.5]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#ff3d00" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

