import { supabase, STORAGE_BUCKET } from '../supabase/config';

type ImageType = 'avatar' | 'banner' | 'gif-bg';

export async function uploadProfileImage(
  uid: string,
  type: ImageType,
  localUri: string
): Promise<string> {
  const timestamp = Date.now();
  const path = `${type}s/${uid}/${timestamp}.jpg`;

  // FormData is the reliable way to upload local file:// URIs in React Native
  const formData = new FormData();
  formData.append('file', { uri: localUri, name: `${timestamp}.jpg`, type: 'image/jpeg' } as any);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, formData, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadGifBackground(uid: string, localUri: string): Promise<string> {
  const timestamp = Date.now();
  const path = `gif-backgrounds/${uid}/${timestamp}.gif`;

  const formData = new FormData();
  formData.append('file', { uri: localUri, name: `${timestamp}.gif`, type: 'image/gif' } as any);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, formData, { contentType: 'image/gif', upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteProfileImage(publicUrl: string): Promise<void> {
  const urlObj = new URL(publicUrl);
  const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
  const path = urlObj.pathname.replace(prefix, '');
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}
