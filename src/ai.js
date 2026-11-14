
import { supabase } from './supabase';

export async function classifyVideo(title, description = '') {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.functions.invoke(
    'classify-video',
    {
      body: { title, description }
    }
  );

  if (error) {
    let message = error.message;

    if (error.context instanceof Response) {
      const details = await error.context
        .json()
        .catch(() => null);

      message = details?.error || message;
    }

    throw new Error(message);
  }

  return data;
}

export async function fetchVideoTitle(url) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data, error } = await supabase.functions.invoke(
    "fetch-video-title",
    {
      body: { url }
    }
  );

  if (error) {
    throw new Error("Unable to fetch video title.");
  }

  if (!data?.title) {
    throw new Error("No video title returned.");
  }

  return data.title;
}

// Fetch Instagram captions and clean metadata.
export async function fetchInstagramMetadata(url) {
  if (!supabase) throw new Error('Supabase is not configured.');

  const { data, error } = await supabase.functions.invoke(
    'fetch-instagram-metadata', 
    { body: { url } }
  );

  if (error) throw new Error('Instagram metadata is unavailable.');

  if (!data?.success) throw new Error('Instagram metadata is unavailable.');

  const clean = (value) => typeof value === 'string'
    ? value.replace(/View all (?:[\d,.]+ )?comments\s*$/i, '')
      .replace(/([^\s#])#/g, '$1 #').trim() : '';

  const description = clean(data.description) || clean(data.title);

  if (!description) throw new Error('No Instagram caption returned.');

  const title = description.replace(/#[\p{L}\p{N}_]+/gu, '').trim() || description;

  return {
    title: title.slice(0, 200),
    description: description.slice(0, 5000)
  };
}
