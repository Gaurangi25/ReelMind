
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
      body: { url },
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

