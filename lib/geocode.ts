if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY is not set");
}

export async function geocodeLocation(
  location: string
): Promise<{ latitude: number; longitude: number }> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", location);
  url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY!);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (data.status !== "OK" || !data.results.length) {
    throw new Error(`Could not geocode location: "${location}" (status: ${data.status})`);
  }

  const { lat, lng } = data.results[0].geometry.location;
  return { latitude: lat, longitude: lng };
}
