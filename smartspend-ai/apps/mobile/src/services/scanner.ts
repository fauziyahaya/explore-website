import * as DocumentPicker from 'expo-document-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { NativeModules, TurboModuleRegistry } from 'react-native';

export interface Capture {
  uri: string;
  mimeType: string;
  source: 'camera' | 'library' | 'pdf';
}

/** True when the native VisionKit document scanner is compiled into this build (dev / App Store builds, not Expo Go). */
export function hasDocumentScanner(): boolean {
  try {
    return !!(TurboModuleRegistry.get('DocumentScanner') ?? NativeModules.DocumentScanner);
  } catch {
    return false;
  }
}

/**
 * iOS VisionKit document camera: automatic receipt edge detection,
 * perspective-corrected crop and enhancement on device.
 */
export async function scanWithDocumentScanner(): Promise<Capture | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const DocumentScanner = (require('react-native-document-scanner-plugin') as typeof import('react-native-document-scanner-plugin')).default;
  const res = await DocumentScanner.scanDocument({ maxNumDocuments: 1, croppedImageQuality: 90 });
  const uri = res.scannedImages?.[0];
  if (!uri) return null;
  return { uri: await enhance(uri), mimeType: 'image/jpeg', source: 'camera' };
}

/** Normalise size/compression so uploads are fast but text stays legible for OCR. */
export async function enhance(uri: string): Promise<string> {
  try {
    const ctx = ImageManipulator.manipulate(uri);
    ctx.resize({ width: 1800 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return uri;
  }
}

export async function pickFromLibrary(): Promise<Capture | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted && perm.accessPrivileges !== 'limited') throw new Error('Photo library access is needed to import receipts. You can enable it in Settings.');
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true });
  if (res.canceled || !res.assets[0]) return null;
  return { uri: await enhance(res.assets[0].uri), mimeType: 'image/jpeg', source: 'library' };
}

export async function pickPdf(): Promise<Capture | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled || !res.assets[0]) return null;
  const a = res.assets[0];
  if ((a.size ?? 0) > 15 * 1024 * 1024) throw new Error('This file is larger than 15 MB. Please choose a smaller file.');
  const mime = a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  return { uri: mime.startsWith('image/') ? await enhance(a.uri) : a.uri, mimeType: mime.startsWith('image/') ? 'image/jpeg' : mime, source: 'pdf' };
}
