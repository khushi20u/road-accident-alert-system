const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export async function reportAccident({ description, latitude, longitude, locationDescription, image }) {
  const formData = new FormData();
  formData.append("description", description);
  formData.append("latitude", latitude);
  formData.append("longitude", longitude);
  formData.append("location_description", locationDescription || "");
  if (image) formData.append("image", image);

  const res = await fetch(`${BASE_URL}/accidents/report`, {
    method: "POST",
    body: formData,
  });

  if (res.status === 429) {
    const err = new Error("Rate limit exceeded");
    err.status = 429;
    throw err;
  }

  if (!res.ok) throw new Error("Failed to report accident");
  return res.json();
}

export async function getActiveAccidents() {
  const res = await fetch(`${BASE_URL}/accidents/active`);
  return res.json();
}

export async function getStats() {
  const res = await fetch(`${BASE_URL}/accidents/stats`);
  return res.json();
}

export async function updateStatus(accidentId, status) {
  const res = await fetch(`${BASE_URL}/accidents/${accidentId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  return res.json();
}