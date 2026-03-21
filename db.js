/* ============================================================
   SAVE4SAVE — db.js
   Supabase database integration
   Replaces localStorage for contacts, photos, admin profile
   ============================================================ */

const SUPABASE_URL = "https://brmtdvfrucgbctffuajr.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJybXRkdmZydWNnYmN0ZmZ1YWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDQwNzQsImV4cCI6MjA4OTYyMDA3NH0.GAlYICHhUKjysRpvEIz3fOfeGCWMhg9s57SXcTTHrX4";

// ---- SUPABASE CLIENT ----
const _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ---- CONTACTS ----

async function db_getContacts() {
  try {
    const { data, error } = await _supa
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error("db_getContacts:", e);
    return ls_get(CONTACTS_KEY) || [];
  }
}

async function db_addContact(contact) {
  try {
    const { error } = await _supa.from("contacts").insert([
      {
        id: contact.id,
        name: contact.name,
        phone: contact.phone,
        institution: contact.inst,
        course: contact.course,
        year: contact.year,
        bio: contact.bio,
        photo: contact.photo || null,
      },
    ]);
    if (error) throw error;
    // also keep local copy for offline
    const local = ls_get(CONTACTS_KEY) || [];
    local.push(contact);
    ls_set(CONTACTS_KEY, local);
    return true;
  } catch (e) {
    console.error("db_addContact:", e);
    // fallback to localStorage
    const local = ls_get(CONTACTS_KEY) || [];
    local.push(contact);
    ls_set(CONTACTS_KEY, local);
    showToast("⚠️ Saved locally — database offline");
    return false;
  }
}

async function db_deleteContact(id) {
  try {
    const { error } = await _supa.from("contacts").delete().eq("id", id);
    if (error) throw error;
    // remove from local too
    let local = ls_get(CONTACTS_KEY) || [];
    local = local.filter((c) => c.id !== id);
    ls_set(CONTACTS_KEY, local);
    return true;
  } catch (e) {
    console.error("db_deleteContact:", e);
    let local = ls_get(CONTACTS_KEY) || [];
    local = local.filter((c) => c.id !== id);
    ls_set(CONTACTS_KEY, local);
    return false;
  }
}

async function db_checkDuplicate(phone) {
  try {
    const { data, error } = await _supa
      .from("contacts")
      .select("id")
      .eq("phone", phone)
      .limit(1);
    if (error) throw error;
    return data && data.length > 0;
  } catch (e) {
    // fallback: check local
    const local = ls_get(CONTACTS_KEY) || [];
    return local.some((c) => c.phone === phone);
  }
}

// ---- CAMPUS PHOTOS ----

async function db_getPhotos() {
  try {
    const { data, error } = await _supa
      .from("campus_photos")
      .select("*")
      .eq("is_default", false)
      .order("created_at", { ascending: false });
    if (error) throw error;
    // Convert snake_case to camelCase for compatibility
    return (data || []).map((p) => ({
      id: p.id,
      src: p.src,
      inst: p.inst,
      caption: p.caption,
      cat: p.cat,
      target: p.target,
      likes: p.likes || 0,
      likedBy: p.liked_by || [],
      comments: p.comments || [],
      date: p.date,
      isDefault: false,
    }));
  } catch (e) {
    console.error("db_getPhotos:", e);
    return ls_get(PHOTOS_KEY) || [];
  }
}

async function db_addPhoto(photo) {
  try {
    const { error } = await _supa.from("campus_photos").insert([
      {
        id: photo.id,
        src: photo.src,
        inst: photo.inst,
        caption: photo.caption,
        cat: photo.cat || "moments",
        target: photo.target || "both",
        likes: photo.likes || 0,
        liked_by: photo.likedBy || [],
        comments: photo.comments || [],
        date: photo.date,
        is_default: false,
      },
    ]);
    if (error) throw error;
    const local = ls_get(PHOTOS_KEY) || [];
    local.unshift(photo);
    ls_set(PHOTOS_KEY, local);
    return true;
  } catch (e) {
    console.error("db_addPhoto:", e);
    const local = ls_get(PHOTOS_KEY) || [];
    local.unshift(photo);
    ls_set(PHOTOS_KEY, local);
    showToast("⚠️ Saved locally — database offline");
    return false;
  }
}

async function db_deletePhoto(id) {
  try {
    const { error } = await _supa.from("campus_photos").delete().eq("id", id);
    if (error) throw error;
    let local = ls_get(PHOTOS_KEY) || [];
    local = local.filter((p) => p.id !== id);
    ls_set(PHOTOS_KEY, local);
    return true;
  } catch (e) {
    let local = ls_get(PHOTOS_KEY) || [];
    local = local.filter((p) => p.id !== id);
    ls_set(PHOTOS_KEY, local);
    return false;
  }
}

async function db_updatePhotoLikes(id, likes, likedBy) {
  try {
    const { error } = await _supa
      .from("campus_photos")
      .update({ likes, liked_by: likedBy })
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("db_updatePhotoLikes:", e);
    return false;
  }
}

async function db_updatePhotoComments(id, comments) {
  try {
    const { error } = await _supa
      .from("campus_photos")
      .update({ comments })
      .eq("id", id);
    if (error) throw error;
    return true;
  } catch (e) {
    console.error("db_updatePhotoComments:", e);
    return false;
  }
}

// ---- ADMIN PROFILE ----

async function db_getAdminProfile() {
  try {
    const { data, error } = await _supa
      .from("admin_profile")
      .select("*")
      .eq("id", "admin")
      .single();
    if (error && error.code !== "PGRST116") throw error;
    if (!data) return ls_get(ADMIN_PROF_KEY) || {};
    return {
      name: data.name,
      bio: data.bio,
      course: data.course,
      year: data.year,
      inst: data.inst,
      photo: data.photo,
      skills: data.skills || [],
      experience: data.experience || [],
    };
  } catch (e) {
    console.error("db_getAdminProfile:", e);
    return ls_get(ADMIN_PROF_KEY) || {};
  }
}

async function db_saveAdminProfile(profile) {
  try {
    const { error } = await _supa.from("admin_profile").upsert([
      {
        id: "admin",
        name: profile.name,
        bio: profile.bio,
        course: profile.course,
        year: profile.year,
        inst: profile.inst,
        photo: profile.photo || null,
        skills: profile.skills || [],
        experience: profile.experience || [],
        updated_at: new Date().toISOString(),
      },
    ]);
    if (error) throw error;
    ls_set(ADMIN_PROF_KEY, profile);
    return true;
  } catch (e) {
    console.error("db_saveAdminProfile:", e);
    ls_set(ADMIN_PROF_KEY, profile);
    showToast("⚠️ Saved locally — database offline");
    return false;
  }
}

// ---- REAL-TIME SUBSCRIPTIONS ----
// Live updates when new contacts are added

function db_subscribeContacts(callback) {
  return _supa
    .channel("contacts-changes")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "contacts",
      },
      (payload) => {
        const c = payload.new;
        callback({
          id: c.id,
          name: c.name,
          phone: c.phone,
          inst: c.institution,
          course: c.course,
          year: c.year,
          bio: c.bio,
          photo: c.photo,
          date: new Date(c.created_at).toLocaleDateString("en-KE"),
        });
      },
    )
    .subscribe();
}

// ---- CONNECTION TEST ----
async function db_ping() {
  try {
    const { error } = await _supa.from("contacts").select("id").limit(1);
    return !error;
  } catch (e) {
    return false;
  }
}
