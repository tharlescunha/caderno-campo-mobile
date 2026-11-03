import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { newId } from '../db';

// Usa a API de arquivos "legacy" (copyAsync/getInfoAsync): a nova (File.copy) devolveu arquivos vazios no iPhone.

/** Arquivos de fotos e áudios do usuário ficam aqui, dentro do app (não são apagados pelo sistema como o cache). */
async function mediaDir() {
  const dir = `${FileSystem.documentDirectory}media/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

const sizeOf = async (uri: string) => {
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? ((info as { size?: number }).size ?? 0) : 0;
};

export interface StoredPhoto {
  id: string;
  uri: string;
  sizeBytes: number;
  mime: 'image/jpeg';
  width: number;
  height: number;
}

const MAX_SIDE = 1920;

/**
 * Reduz a foto (lado maior até 1920 px, JPEG) e guarda uma cópia no app. O original da câmera não é mantido.
 * `width` e `height` vêm do seletor de imagens; sem eles a foto só é recomprimida.
 */
export async function storePhoto(sourceUri: string, width?: number, height?: number): Promise<StoredPhoto> {
  const context = ImageManipulator.ImageManipulator.manipulate(sourceUri);
  if (width && height && Math.max(width, height) > MAX_SIDE) {
    context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 });
  const id = newId();
  const target = `${await mediaDir()}${id}.jpg`;
  const resultSize = await sizeOf(result.uri);
  await FileSystem.copyAsync({ from: result.uri, to: target });
  const size = await sizeOf(target);
  if (size === 0) throw new Error(`A foto não foi gravada (reduzida: ${resultSize} bytes, cópia: ${size} bytes, ${result.width}x${result.height}).`);
  return { id, uri: target, sizeBytes: size, mime: 'image/jpeg', width: result.width, height: result.height };
}

export interface StoredAudio {
  id: string;
  uri: string;
  sizeBytes: number;
  mime: 'audio/mp4';
}

/**
 * Guarda a gravação (m4a) dentro do app. O arquivo original fica na pasta temporária do sistema:
 * apagá-lo aqui faz o gravador falhar ao tentar abri-lo depois.
 */
export async function storeAudio(sourceUri: string): Promise<StoredAudio> {
  const id = newId();
  const target = `${await mediaDir()}${id}.m4a`;
  const sourceSize = await sizeOf(sourceUri);
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  const size = await sizeOf(target);
  if (size === 0) throw new Error(`O áudio não foi gravado (original: ${sourceSize} bytes, cópia: ${size} bytes).`);
  return { id, uri: target, sizeBytes: size, mime: 'audio/mp4' };
}

export function removeFile(uri: string | null) {
  if (!uri) return;
  void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
