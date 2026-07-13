import { Capacitor } from '@capacitor/core';
import { Camera, CameraResultType, CameraSource, CameraDirection } from '@capacitor/camera';

/** True only inside the native Android/iOS app (not the web build). */
export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * Capture a photo with the device camera and return it as a File ready to upload.
 * Returns null if the user cancels. Throws only on real errors.
 *
 * @param {object} [opts]
 *   source: 'camera' (default) opens the camera directly; 'prompt' lets the
 *   user choose camera vs gallery.
 *   direction: 'rear' (default) or 'front' (e.g. for selfies).
 */
export async function capturePhotoFile({ source = 'camera', direction = 'rear' } = {}) {
  let photo;
  try {
    photo = await Camera.getPhoto({
      quality: 80,
      resultType: CameraResultType.Uri,
      source: source === 'prompt' ? CameraSource.Prompt : CameraSource.Camera,
      direction: direction === 'front' ? CameraDirection.Front : CameraDirection.Rear,
      saveToGallery: false,
      correctOrientation: true,
    });
  } catch (err) {
    // User cancelled the camera — treat as a no-op, not an error.
    if (/cancel/i.test(err?.message || '')) return null;
    throw err;
  }

  if (!photo?.webPath) return null;
  const res = await fetch(photo.webPath);
  const blob = await res.blob();
  const ext = (photo.format || 'jpeg').toLowerCase();
  return new File([blob], `photo-${Date.now()}.${ext}`, { type: `image/${ext}` });
}
