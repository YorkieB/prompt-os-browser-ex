import { CameraPhysics } from './types'

export const CAMERA_PHYSICS_PRESETS: Record<string, CameraPhysics> = {
  cinematic: {
    lens: 'Arri Master Prime 35mm',
    aperture: 'f/2.8',
    focalLength: '35mm',
    shutterSpeed: '1/48s (180° shutter)',
    iso: 'ISO 800',
    sensor: 'ARRI ALEXA Mini LF (Large Format)',
    lighting: 'Three-point lighting with soft key, subtle fill, rim for depth',
    temperature: '5600K daylight balanced',
  },
  portrait: {
    lens: 'Canon EF 85mm f/1.4L IS USM',
    aperture: 'f/2.0',
    focalLength: '85mm',
    shutterSpeed: '1/200s',
    iso: 'ISO 400',
    sensor: 'Full-frame 35mm sensor',
    lighting: 'Soft window light with reflector fill, hair light for separation',
    temperature: '5200K slightly warm',
  },
  product: {
    lens: 'Zeiss Makro-Planar 100mm f/2',
    aperture: 'f/11',
    focalLength: '100mm',
    shutterSpeed: '1/125s',
    iso: 'ISO 100',
    sensor: 'Medium format (Hasselblad H6D)',
    lighting: 'Controlled studio softboxes, accent lights for highlights',
    temperature: '5500K neutral white',
  },
  landscape: {
    lens: 'Canon EF 16-35mm f/2.8L III USM at 24mm',
    aperture: 'f/11',
    focalLength: '24mm',
    shutterSpeed: '1/60s',
    iso: 'ISO 200',
    sensor: 'Full-frame 35mm sensor',
    lighting: 'Natural golden hour sunlight, diffused through atmosphere',
    temperature: '3500K warm golden hour',
  },
  action: {
    lens: 'Sony FE 24-70mm f/2.8 GM at 50mm',
    aperture: 'f/4.0',
    focalLength: '50mm',
    shutterSpeed: '1/1000s',
    iso: 'ISO 1600',
    sensor: 'Full-frame BSI-CMOS sensor',
    lighting: 'Available light, high dynamic range capture',
    temperature: '5600K balanced',
  },
}

export function applyCameraPhysics(style: string): CameraPhysics {
  const lowerStyle = style.toLowerCase()
  
  if (lowerStyle.includes('portrait') || lowerStyle.includes('headshot')) {
    return CAMERA_PHYSICS_PRESETS.portrait
  }
  
  if (lowerStyle.includes('product') || lowerStyle.includes('commercial')) {
    return CAMERA_PHYSICS_PRESETS.product
  }
  
  if (lowerStyle.includes('landscape') || lowerStyle.includes('nature') || lowerStyle.includes('scenic')) {
    return CAMERA_PHYSICS_PRESETS.landscape
  }
  
  if (lowerStyle.includes('action') || lowerStyle.includes('sports') || lowerStyle.includes('motion')) {
    return CAMERA_PHYSICS_PRESETS.action
  }
  
  return CAMERA_PHYSICS_PRESETS.cinematic
}

export function formatCameraPhysics(physics: CameraPhysics): string {
  return `
## Camera Physics Applied

**Optics:**
- Lens: ${physics.lens}
- Focal Length: ${physics.focalLength}
- Aperture: ${physics.aperture}

**Sensor:**
- Sensor Type: ${physics.sensor}
- ISO: ${physics.iso}
- Shutter Speed: ${physics.shutterSpeed}

**Lighting:**
- Setup: ${physics.lighting}
- Color Temperature: ${physics.temperature}
`.trim()
}
