import { useState } from "react";
import { searchHS } from "../api";

export default function HSSearch() {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);

  async function handleSearch() {
    try {
      const data = await searchHS(keyword);
      setResults(data);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <h2>HS Code Search</h2>
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Enter keyword..."
      />
      <button onClick={handleSearch}>Search</button>

      <ul>
        {results.map((item, idx) => (
          <li key={idx}>
            <strong>{item.hscode}</strong> - {item.description}
          </li>
        ))}
      </ul>
    </div>
  );
}
