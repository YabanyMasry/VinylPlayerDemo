const demoLyrics = [
  { time: 2, text: "🎵 Welcome to the Vinyl Player Demo! 🎵" },
  { time: 6, text: "This is a basic demo of synchronized lyrics." },
  { time: 10, text: "You can drag the timeline to seek through the track." },
  { time: 14, text: "Try playing with the DJ Effects on the right!" },
  { time: 18, text: "Add some Vinyl Crackle or Reverb for texture." },
  { time: 23, text: "Enjoy the music and the immersive experience! 🎧" }
];

const SONG_FILES = [
  { file: "/song1.mp3", duration: 372 },
  { file: "/song2.mp3", duration: 425 },
  { file: "/song3.mp3", duration: 344 },
];

const unsplash = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&q=80`;
const picsum = (seed) => `https://picsum.photos/seed/${seed}/400/400`;

// Compact album definitions; tracks are generated below.
const ALBUM_DEFS = [
  { album: "Lo-Fi Beats", artist: "Chillhop", cover: unsplash("photo-1514525253161-7a46d19cd819"), titles: ["Morning Coffee", "Night Study", "Rainy Window"] },
  { album: "Synthwave Nights", artist: "Neon Dreams", cover: unsplash("photo-1557672172-298e090bd0f1"), titles: ["Neon Rider", "Cyber City", "Retro Highway"] },
  { album: "Jazz Vibes", artist: "Smooth Cats", cover: unsplash("photo-1511192336575-5a79af67a629"), titles: ["Midnight Sax", "Blue Lounge", "Velvet Keys"] },
  { album: "Classic Rock", artist: "The Distortions", cover: unsplash("photo-1459749411175-04bf5292ceea"), titles: ["Guitar Solo", "Highway Anthem", "Amp Overload"] },
  { album: "Ocean Drift", artist: "Tidal Waves", cover: picsum("ocean"), titles: ["Salt Air", "Deep Current", "Horizon"] },
  { album: "Golden Hour", artist: "Sunset Club", cover: picsum("golden"), titles: ["Amber Skies", "Last Light", "Warm Breeze"] },
  { album: "Midnight Drive", artist: "Neon Dreams", cover: picsum("midnight"), titles: ["Tail Lights", "Empty Streets", "Dashboard Glow"] },
  { album: "Forest Echoes", artist: "Mossy Stone", cover: picsum("forest"), titles: ["Pine Whisper", "Hidden Creek", "Canopy"] },
  { album: "Electric Pulse", artist: "Voltage", cover: picsum("electric"), titles: ["Overdrive", "Static", "Circuit Breaker"] },
  { album: "Acoustic Sessions", artist: "Wooden Hearts", cover: picsum("acoustic"), titles: ["Porch Song", "Campfire", "Old Strings"] },
  { album: "Cosmic Dust", artist: "Stargazer", cover: picsum("cosmic"), titles: ["Nebula", "Orbit", "Event Horizon"] },
  { album: "City Lights", artist: "Urban Fox", cover: picsum("citylights"), titles: ["Rooftop", "Subway Glow", "After Hours"] },
  { album: "Desert Mirage", artist: "Dune Walker", cover: picsum("desert"), titles: ["Heat Haze", "Sandstorm", "Oasis"] },
  { album: "Winter Static", artist: "Frost Bite", cover: picsum("winter"), titles: ["Snowfall", "Cold Breath", "Ice Lake"] },
  { album: "Velvet Underground Club", artist: "Smooth Cats", cover: picsum("velvet"), titles: ["Smoke Rings", "Low Light", "Last Call"] },
  { album: "Pixel Paradise", artist: "8-Bit Heroes", cover: picsum("pixel"), titles: ["Level One", "Boss Fight", "Game Over"] },
  { album: "Mountain High", artist: "Alpine Sound", cover: picsum("mountain"), titles: ["Summit", "Thin Air", "Valley Below"] },
  { album: "Neon Jungle", artist: "Voltage", cover: picsum("neonjungle"), titles: ["Vines", "Glow Worm", "Wild Signal"] },
  { album: "Sunday Morning", artist: "Wooden Hearts", cover: picsum("sunday"), titles: ["Slow Pancakes", "Window Light", "Newspaper"] },
  { album: "Analog Dreams", artist: "Tape Hiss", cover: picsum("analog"), titles: ["Reel to Reel", "Warm Dial", "Fade Out"] },
  { album: "Rainy Season", artist: "Chillhop", cover: picsum("rainy"), titles: ["Puddles", "Umbrella", "Petrichor"] },
  { album: "Starlight Express", artist: "Stargazer", cover: picsum("starlight"), titles: ["Departure", "Milky Way", "Arrival"] },
  { album: "Concrete Waves", artist: "Urban Fox", cover: picsum("concrete"), titles: ["Skate Park", "Graffiti", "Overpass"] },
  { album: "Crimson Sky", artist: "The Distortions", cover: picsum("crimson"), titles: ["Red Horizon", "Burning Out", "Ember"] },
  { album: "Coral Reef", artist: "Tidal Waves", cover: picsum("coral"), titles: ["Shallows", "Anemone", "Blue Hole"] },
  { album: "Lunar Landing", artist: "Stargazer", cover: picsum("lunar"), titles: ["Countdown", "Moon Dust", "One Small Step"] },
  { album: "Midnight Cafe", artist: "Smooth Cats", cover: picsum("cafe"), titles: ["Espresso", "Corner Booth", "Closing Time"] },
  { album: "Chrome Hearts", artist: "Neon Dreams", cover: picsum("chrome"), titles: ["Mirror Ball", "Polished", "Reflection"] },
  { album: "Wildflower", artist: "Mossy Stone", cover: picsum("wildflower"), titles: ["Meadow", "Pollen", "Bloom"] },
  { album: "Thunder Road", artist: "The Distortions", cover: picsum("thunder"), titles: ["Rumble", "Open Throttle", "Lightning"] },
  { album: "Paper Planes", artist: "Wooden Hearts", cover: picsum("paper"), titles: ["Folded", "Updraft", "Soft Landing"] },
  { album: "Glass Garden", artist: "Tape Hiss", cover: picsum("glass"), titles: ["Greenhouse", "Fragile", "Prism"] },
  { album: "Solar Flare", artist: "Voltage", cover: picsum("solar"), titles: ["Corona", "Photon", "Heatwave"] },
  { album: "Tokyo Nights", artist: "Neon Dreams", cover: picsum("tokyo"), titles: ["Shibuya", "Last Train", "Ramen Steam"] },
  { album: "Lazy River", artist: "Chillhop", cover: picsum("river"), titles: ["Float", "Driftwood", "Slow Current"] },
  { album: "Echo Chamber", artist: "Tape Hiss", cover: picsum("echo"), titles: ["Reverb Tail", "Hollow", "Answer Back"] },
  { album: "Golden Age", artist: "Sunset Club", cover: picsum("goldenage"), titles: ["Vinyl Days", "Jukebox", "Encore"] },
];

const MOCK_TRACKS = ALBUM_DEFS.flatMap((def, albumIdx) =>
  def.titles.map((title, i) => {
    const song = SONG_FILES[(albumIdx + i) % SONG_FILES.length];
    const slug = title.replace(/\s+/g, "_");
    const id = `${def.album.toLowerCase().replace(/\s+/g, "-")}-${i + 1}`;
    return {
      id,
      album: def.album,
      albumArtist: def.artist,
      artist: def.artist,
      title,
      filename: `${slug}.mp3`,
      relativePath: `demo/${slug}.mp3`,
      absolutePath: `/mock/demo/${slug}.mp3`,
      discNumber: 1,
      trackNumber: i + 1,
      coverUrl: def.cover,
      lyrics: demoLyrics,
      orderKey: i + 1,
      duration: song.duration,
      // Unique query string so the player reloads audio when skipping between tracks sharing a file.
      url: `${song.file}?track=${id}`,
    };
  })
);

const MOCK_LIBRARY = {
  rootPath: "mock_demo_mode",
  scannedAt: new Date().toISOString(),
  tracks: MOCK_TRACKS,
  albumsRoot: "mock_albums",
  playlistsRoot: "mock_playlists"
};

const originalFetch = window.fetch;

window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;

  if (url.startsWith('/api/library')) {
    return new Response(JSON.stringify(MOCK_LIBRARY), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  if (url === '/api/playlists') {
    return new Response(JSON.stringify([
      { name: "Demo Playlist", filename: "Demo Playlist.m3u8" }
    ]), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (url.startsWith('/api/playlists/') && !url.includes('/add-track') && !url.includes('/remove-track')) {
    return new Response(JSON.stringify({
      name: "Demo Playlist",
      filename: "Demo Playlist.m3u8",
      tracks: [MOCK_TRACKS[0], MOCK_TRACKS[2]]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  
  if (url.startsWith('/api/playlists/') && url.includes('/add-track')) {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (url.startsWith('/api/playlists/') && url.includes('/remove-track')) {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  
  if (url === '/api/playlists/import-status') {
     return new Response(JSON.stringify({ connected: false }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  
  if (url === '/api/auth/me') {
     return new Response(JSON.stringify({ error: "Not logged in" }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
  
  if (url === '/api/settings/directories') {
     return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  if (url.startsWith('/api/')) {
     return new Response(JSON.stringify({ error: "Mock Backend: Not implemented" }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  // Fallback to original fetch for anything else
  return originalFetch(input, init);
};
