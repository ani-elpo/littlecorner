// Supabase Edge Function: post-daily-photo
//
// Triggered once a day by a pg_cron job (see README). Picks a random unused
// photo from `photo_pool`, posts it to the board as a `daily_photo` post,
// and marks it used. When every photo has been used, the whole pool is
// reset (used = false) before picking, so the rotation cycles forever.
//
// This function is only meant to be called by the cron job using the
// Supabase service role key - see the auth check below.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DAILY_PHOTO_AUTHOR_NAME = "Today's Photo";
const DAILY_PHOTO_AUTHOR_ID = "daily-photo-bot";

type PhotoPoolRow = {
  id: string;
  file_path: string;
};

function unauthorized(message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  // Only the cron job (calling with the service role key as its bearer
  // token) is allowed to trigger this function.
  const authHeader = req.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!bearerToken || bearerToken !== SERVICE_ROLE_KEY) {
    return unauthorized("This function can only be triggered by the scheduled job.");
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1. Try to find unused photos.
  const { data: firstAttempt, error: unusedError } = await supabase
    .from("photo_pool")
    .select("id, file_path")
    .eq("used", false)
    .limit(1000);
  let unused = firstAttempt;

  if (unusedError) {
    return new Response(JSON.stringify({ error: unusedError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. If none left, the pool has been fully cycled through - reset it and
  // try again.
  if (!unused || unused.length === 0) {
    const { error: resetError } = await supabase
      .from("photo_pool")
      .update({ used: false, used_at: null })
      .eq("used", true);

    if (resetError) {
      return new Response(JSON.stringify({ error: resetError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { data: refreshed, error: refreshedError } = await supabase
      .from("photo_pool")
      .select("id, file_path")
      .eq("used", false)
      .limit(1000);

    if (refreshedError) {
      return new Response(JSON.stringify({ error: refreshedError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    unused = refreshed;
  }

  // 3. Still nothing? The pool is completely empty - nothing to post today.
  if (!unused || unused.length === 0) {
    return new Response(
      JSON.stringify({ message: "Photo pool is empty, nothing to post today." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // 4. Pick one at random.
  const chosen: PhotoPoolRow = unused[Math.floor(Math.random() * unused.length)];

  // 5. Post it to the board.
  const { data: post, error: postError } = await supabase
    .from("posts")
    .insert({
      author_id: DAILY_PHOTO_AUTHOR_ID,
      author_name: DAILY_PHOTO_AUTHOR_NAME,
      type: "daily_photo",
      body: null,
      media: [{ path: chosen.file_path, mime: "image/jpeg", kind: "image" }],
    })
    .select()
    .single();

  if (postError) {
    return new Response(JSON.stringify({ error: postError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 6. Mark the photo as used.
  const { error: markUsedError } = await supabase
    .from("photo_pool")
    .update({ used: true, used_at: new Date().toISOString() })
    .eq("id", chosen.id);

  if (markUsedError) {
    return new Response(JSON.stringify({ error: markUsedError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, post }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
