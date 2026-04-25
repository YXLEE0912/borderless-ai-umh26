export async function searchHS(keyword) {
  const response = await fetch(
    `${import.meta.env.VITE_API_URL}/hs/search?keyword=${keyword}`
  );
  if (!response.ok) {
    throw new Error("API request failed");
  }
  return await response.json();
}
