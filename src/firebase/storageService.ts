import { File, Paths } from 'expo-file-system';
import { copyAsync, deleteAsync } from 'expo-file-system/legacy';
import { supabase, STORAGE_BUCKET } from '../supabase/config';

type ImageType = 'avatar' | 'banner' | 'gif-bg';

async function toFileUri(uri: string, ext: string): Promise<string> {
  if (uri.startsWith('file://')) return uri;
  const dest = new File(Paths.cache, `${Date.now()}.${ext}`);
  await copyAsync({ from: uri, to: dest.uri });
  return dest.uri;
}

async function xhrUpload(
  signedUrl: string,
  fileUri: string,
  contentType: string
): Promise<void> {
  const buffer = await new File(fileUri).arrayBuffer();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error('XHR network error'));
    xhr.send(buffer);
  });
}

export async function uploadProfileImage(
  uid: string,
  type: ImageType,
  localUri: string
): Promise<string> {
  const timestamp = Date.now();
  const path = `${type}s/${uid}/${timestamp}.jpg`;

  const { data: signed, error: signErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);
  if (signErr) throw new Error(`Signed URL failed: ${signErr.message}`);

  const isTemp = !localUri.startsWith('file://');
  const fileUri = await toFileUri(localUri, 'jpg');
  try {
    await xhrUpload(signed.signedUrl, fileUri, 'image/jpeg');
  } finally {
    if (isTemp) deleteAsync(fileUri, { idempotent: true }).catch(() => {});
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadGifBackground(uid: string, localUri: string): Promise<string> {
  const timestamp = Date.now();
  const path = `gif-backgrounds/${uid}/${timestamp}.gif`;

  const { data: signed, error: signErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(path);
  if (signErr) throw new Error(`Signed URL failed: ${signErr.message}`);

  const isTemp = !localUri.startsWith('file://');
  const fileUri = await toFileUri(localUri, 'gif');
  try {
    await xhrUpload(signed.signedUrl, fileUri, 'image/gif');
  } finally {
    if (isTemp) deleteAsync(fileUri, { idempotent: true }).catch(() => {});
  }

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProfileImage(publicUrl: string): Promise<void> {
  const urlObj = new URL(publicUrl);
  const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const path = urlObj.pathname.replace(prefix, '');
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}
